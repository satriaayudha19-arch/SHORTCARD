from dotenv import load_dotenv
load_dotenv()

import os
import io
import re
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Annotated
from urllib.parse import urlparse, unquote

import bcrypt
import httpx
import jwt
import qrcode
import qrcode.image.svg
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Request, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse, HTMLResponse, Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict, EmailStr
from starlette.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
CS_WHATSAPP = os.environ.get("CS_WHATSAPP", "")
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Domain constants
# ---------------------------------------------------------------------------
CARD_STATUSES = ["UNASSIGNED", "ASSIGNED", "ACTIVE", "DISABLED"]
DESTINATION_TYPES = ["GOOGLE_REVIEW", "INSTAGRAM", "TIKTOK", "YOUTUBE", "FACEBOOK", "WHATSAPP", "CUSTOM"]
CORRECTION_STATUSES = ["PENDING", "REVIEWING", "APPROVED", "REJECTED", "COMPLETED"]
CARD_CODE_RE = re.compile(r"^SC-\d{4,6}$")

# Engine B — Social Media Destination Validator: host whitelist ketat per platform
SOCIAL_HOSTS = {
    "INSTAGRAM": {"instagram.com", "www.instagram.com"},
    "TIKTOK": {"tiktok.com", "www.tiktok.com"},
    "FACEBOOK": {"facebook.com", "www.facebook.com", "m.facebook.com"},
    "YOUTUBE": {"youtube.com", "www.youtube.com", "m.youtube.com"},
}

WHATSAPP_HOSTS = {"wa.me", "whatsapp.com", "www.whatsapp.com", "api.whatsapp.com"}
GOOGLE_SHORT_HOSTS = {"maps.app.goo.gl", "goo.gl", "g.page", "g.co"}

INSTAGRAM_RESERVED = {"p", "reel", "reels", "explore", "accounts", "stories", "direct", "tv"}
IG_USERNAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._]{0,29}$")
TT_HANDLE_RE = re.compile(r"^@[A-Za-z0-9][A-Za-z0-9._]{1,23}$")
YT_HANDLE_RE = re.compile(r"^@[A-Za-z0-9][A-Za-z0-9._-]{1,29}$")
YT_CHANNEL_RE = re.compile(r"^UC[A-Za-z0-9_-]{22}$")

# Business adalah single source of truth untuk destination per jenis
DEST_TO_BIZ_FIELD = {
    "GOOGLE_REVIEW": "google_review_url",
    "INSTAGRAM": "instagram_url",
    "TIKTOK": "tiktok_url",
    "YOUTUBE": "youtube_url",
    "FACEBOOK": "facebook_url",
    "WHATSAPP": "whatsapp_url",
}
BIZ_SOCIAL_FIELDS = {v: k for k, v in DEST_TO_BIZ_FIELD.items() if k in SOCIAL_HOSTS}

DEST_LABELS = {
    "GOOGLE_REVIEW": "Google Review",
    "INSTAGRAM": "Instagram",
    "TIKTOK": "TikTok",
    "YOUTUBE": "YouTube",
    "FACEBOOK": "Facebook",
    "WHATSAPP": "WhatsApp",
    "CUSTOM": "Custom URL",
}

PyObjectId = Annotated[str, BeforeValidator(str)]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: Optional[datetime] = None) -> str:
    return (dt or utcnow()).isoformat()


def pub(doc: Optional[dict]) -> Optional[dict]:
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    for key in ("business_id", "card_id", "request_id"):
        if isinstance(doc.get(key), ObjectId):
            doc[key] = str(doc[key])
    return doc


def public_card_url(code: str) -> str:
    return f"{PUBLIC_BASE_URL}/r/{code}"


def normalize_code(code: str) -> str:
    code = code.strip().upper()
    if not CARD_CODE_RE.match(code):
        raise HTTPException(status_code=400, detail="Format kode kartu tidak valid. Contoh: SC-0001")
    return code


def _host_of(url: str) -> str:
    return urlparse(url).netloc.lower().split(":")[0]


def _is_google_maps_host(host: str) -> bool:
    return (
        host in GOOGLE_SHORT_HOSTS
        or host == "maps.google.com"
        or host == "google.com"
        or host.endswith(".google.com")
        or re.match(r"^(www\.)?google\.[a-z]{2,}(\.[a-z]{2,})?$", host) is not None
        or host.endswith(".g.co")
    )


def validate_social_destination(platform: str, url: str) -> dict:
    """Engine B — validasi + normalisasi URL social media. Murni lokal, tanpa API eksternal."""
    platform = (platform or "").upper()
    raw = (url or "").strip()
    if platform not in SOCIAL_HOSTS:
        return {"platform": platform, "valid": False, "normalized_url": None, "error": "Platform tidak didukung."}
    if not raw:
        return {"platform": platform, "valid": False, "normalized_url": None, "error": "URL wajib diisi."}
    lowered = raw.lower()
    for scheme in ("javascript:", "data:", "file:", "vbscript:", "blob:"):
        if lowered.startswith(scheme):
            return {"platform": platform, "valid": False, "normalized_url": None, "error": "URL tidak aman dan tidak diizinkan."}
    parsed = urlparse(raw)
    if parsed.scheme != "https" or not parsed.netloc:
        return {"platform": platform, "valid": False, "normalized_url": None, "error": "URL harus menggunakan HTTPS yang valid."}
    host = parsed.netloc.lower().split(":")[0]
    if host not in SOCIAL_HOSTS[platform]:
        return {"platform": platform, "valid": False, "normalized_url": None,
                "error": f"Domain harus domain resmi {DEST_LABELS[platform]} — domain asing ditolak."}
    segments = [s for s in parsed.path.split("/") if s]

    if platform == "INSTAGRAM":
        if len(segments) != 1 or not IG_USERNAME_RE.match(segments[0]) or segments[0].lower() in INSTAGRAM_RESERVED:
            return {"platform": platform, "valid": False, "normalized_url": None,
                    "error": "Format URL profil Instagram tidak valid. Contoh: https://instagram.com/username"}
        return {"platform": platform, "valid": True, "normalized_url": f"https://www.instagram.com/{segments[0]}/", "error": None}

    if platform == "TIKTOK":
        if len(segments) != 1 or not TT_HANDLE_RE.match(segments[0]):
            return {"platform": platform, "valid": False, "normalized_url": None,
                    "error": "Format URL profil TikTok tidak valid. Contoh: https://www.tiktok.com/@username"}
        return {"platform": platform, "valid": True, "normalized_url": f"https://www.tiktok.com/{segments[0]}", "error": None}

    if platform == "FACEBOOK":
        if not segments:
            return {"platform": platform, "valid": False, "normalized_url": None,
                    "error": "URL Facebook harus mengarah ke halaman/profil. Contoh: https://www.facebook.com/namapage"}
        if segments[0].lower() in {"sharer", "login", "help", "policies", "watch", "events"}:
            return {"platform": platform, "valid": False, "normalized_url": None,
                    "error": "Format URL halaman Facebook tidak didukung."}
        return {"platform": platform, "valid": True, "normalized_url": f"https://www.facebook.com/{'/'.join(segments)}", "error": None}

    if platform == "YOUTUBE":
        if len(segments) == 1 and YT_HANDLE_RE.match(segments[0]):
            return {"platform": platform, "valid": True, "normalized_url": f"https://www.youtube.com/{segments[0]}", "error": None}
        if len(segments) == 2 and segments[0] == "channel" and YT_CHANNEL_RE.match(segments[1]):
            return {"platform": platform, "valid": True, "normalized_url": f"https://www.youtube.com/channel/{segments[1]}", "error": None}
        if len(segments) == 2 and segments[0] in ("c", "user"):
            return {"platform": platform, "valid": True, "normalized_url": f"https://www.youtube.com/{segments[0]}/{segments[1]}", "error": None}
        return {"platform": platform, "valid": False, "normalized_url": None,
                "error": "Gunakan URL channel YouTube (@handle atau /channel/UC...). URL video tidak didukung."}

    return {"platform": platform, "valid": False, "normalized_url": None, "error": "Platform tidak didukung."}


def validate_destination_url(destination_type: str, url: str) -> str:
    url = (url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL tujuan wajib diisi.")
    lowered = url.lower()
    for scheme in ("javascript:", "data:", "file:", "vbscript:", "blob:"):
        if lowered.startswith(scheme):
            raise HTTPException(status_code=400, detail="URL tidak aman dan tidak diizinkan.")
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise HTTPException(status_code=400, detail="URL tujuan harus menggunakan HTTPS yang valid.")
    if destination_type not in DESTINATION_TYPES:
        raise HTTPException(status_code=400, detail="Jenis tujuan tidak valid.")
    host = parsed.netloc.lower().split(":")[0]
    if destination_type in SOCIAL_HOSTS:
        result = validate_social_destination(destination_type, url)
        if not result["valid"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result["normalized_url"]
    if destination_type == "GOOGLE_REVIEW":
        if not _is_google_maps_host(host):
            raise HTTPException(status_code=400, detail="URL harus berasal dari Google (Maps / Review).")
        return url
    if destination_type == "WHATSAPP":
        if host not in WHATSAPP_HOSTS:
            raise HTTPException(status_code=400, detail="URL tidak sesuai dengan jenis tujuan WhatsApp. Gunakan https://wa.me/628xxxxxxxxxx")
        return url
    return url  # CUSTOM: HTTPS valid sudah dipastikan di atas


def sanitize_business_payload(data: dict) -> dict:
    """Validasi/normalisasi field URL bisnis (Engine B + pemeriksaan host Google)."""
    for field, dtype in BIZ_SOCIAL_FIELDS.items():
        if data.get(field):
            result = validate_social_destination(dtype, data[field])
            if not result["valid"]:
                raise HTTPException(status_code=400, detail=result["error"])
            data[field] = result["normalized_url"]
    if data.get("whatsapp_url"):
        data["whatsapp_url"] = validate_destination_url("WHATSAPP", data["whatsapp_url"])
    for field in ("google_maps_url", "google_review_url"):
        if data.get(field):
            parsed = urlparse(data[field])
            if parsed.scheme != "https" or not _is_google_maps_host(parsed.netloc.lower().split(":")[0]):
                raise HTTPException(status_code=400, detail="URL harus berasal dari Google (Maps / Review) dengan HTTPS valid.")
    return data


async def propagate_business_destination(business_id, field: str, new_url, changed_by: str, reason: str):
    """Business → Card: perubahan URL bisnis terpropagasi ke kartu ACTIVE dengan destination_type terkait."""
    dtype = BIZ_SOCIAL_FIELDS.get(field) or ("GOOGLE_REVIEW" if field == "google_review_url" else None) or ("WHATSAPP" if field == "whatsapp_url" else None)
    if not dtype:
        return
    now = iso()
    async for card in db.cards.find({"business_id": business_id, "destination_type": dtype, "status": "ACTIVE"}):
        if card.get("destination_url") != new_url:
            await db.cards.update_one({"_id": card["_id"]}, {"$set": {"destination_url": new_url, "updated_at": now}})
            await db.card_history.insert_one({
                "card_id": str(card["_id"]),
                "card_code": card["code"],
                "old_url": card.get("destination_url"),
                "new_url": new_url,
                "changed_by": changed_by,
                "reason": reason,
                "request_id": None,
                "created_at": now,
            })


# ---------------------------------------------------------------------------
# Engine A — Google Business Verification (Places API resmi, server-side only)
# ---------------------------------------------------------------------------
GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1"
GOOGLE_REVIEW_URL_TEMPLATE = "https://search.google.com/local/writereview?placeid={place_id}"


def _extract_place_id(text: str) -> Optional[str]:
    m = re.search(r"[?&]place_id=([A-Za-z0-9_-]{10,})", text)
    if m:
        return m.group(1)
    m = re.search(r"!1s([A-Za-z][A-Za-z0-9_-]{9,})", text)
    if m:
        return m.group(1)
    m = re.search(r"!19s([A-Za-z][A-Za-z0-9_-]{9,})", text)
    if m:
        return m.group(1)
    return None


def _extract_place_name(text: str) -> Optional[str]:
    m = re.search(r"/place/([^/@?]+)", text)
    if m:
        return unquote(m.group(1)).replace("+", " ")
    m = re.search(r"[?&]q=([^&]+)", text)
    if m:
        return unquote(m.group(1)).replace("+", " ")
    return None


def _handle_google_errors(resp) -> None:
    if resp.status_code == 200:
        return
    if resp.status_code in (401, 403):
        raise HTTPException(status_code=502, detail="Autentikasi Google API gagal. Periksa konfigurasi GOOGLE_MAPS_API_KEY dan pastikan Places API (New) aktif.")
    if resp.status_code == 429:
        raise HTTPException(status_code=429, detail="Kuota Google API terlampaui. Coba lagi nanti.")
    if resp.status_code == 400:
        raise HTTPException(status_code=400, detail="Permintaan ke Google Places API tidak valid.")
    raise HTTPException(status_code=502, detail="Layanan Google sedang bermasalah. Coba lagi nanti.")


async def verify_google_business(google_maps_url: str) -> dict:
    """Google Maps URL → resolve → REAL Place ID (via Places API resmi) → Review URL.
    TIDAK PERNAH mengembalikan sukses palsu: tanpa API key → error 503 yang jelas."""
    url = (google_maps_url or "").strip()
    parsed = urlparse(url)
    host = parsed.netloc.lower().split(":")[0] if parsed.netloc else ""
    if parsed.scheme not in ("https", "http") or not host or not _is_google_maps_host(host):
        raise HTTPException(status_code=400, detail="URL harus berasal dari Google Maps (maps.app.goo.gl atau google.com/maps).")

    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=503, detail="Verifikasi Google belum dapat dilakukan: GOOGLE_MAPS_API_KEY belum dikonfigurasi di server.")

    # Resolve short URL (maps.app.goo.gl) → URL Google Maps penuh. Tanpa HTML scraping.
    resolved = url
    if host in GOOGLE_SHORT_HOSTS:
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as http:
                resp = await http.get(url, headers={"User-Agent": "ShortCard-Verification/1.0"})
                resolved = str(resp.url)
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Gagal menghubungi Google Maps untuk resolve URL. Coba lagi nanti.")
        if not _is_google_maps_host(urlparse(resolved).netloc.lower().split(":")[0]):
            raise HTTPException(status_code=400, detail="Short URL tidak mengarah ke Google Maps yang valid.")

    place_id = _extract_place_id(resolved) or _extract_place_id(url)
    headers = {"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": "id,displayName,formattedAddress"}

    async with httpx.AsyncClient(timeout=15.0) as http:
        if not place_id:
            name = _extract_place_name(resolved) or _extract_place_name(url)
            if not name:
                raise HTTPException(status_code=400, detail="Tidak dapat menemukan identitas bisnis dari URL tersebut. Gunakan URL halaman bisnis di Google Maps.")
            ts = await http.post(
                f"{GOOGLE_PLACES_BASE}/places:searchText",
                json={"textQuery": name},
                headers={**headers, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress"},
            )
            _handle_google_errors(ts)
            places = ts.json().get("places", [])
            if not places:
                raise HTTPException(status_code=404, detail="Bisnis tidak ditemukan di Google. Periksa kembali Google Maps URL.")
            place_id = places[0]["id"]
        detail = await http.get(f"{GOOGLE_PLACES_BASE}/places/{place_id}", headers=headers)
        if detail.status_code == 404:
            raise HTTPException(status_code=404, detail="Place ID tidak ditemukan di Google. Link mungkin sudah tidak valid.")
        _handle_google_errors(detail)
        data = detail.json()

    real_id = data.get("id") or place_id
    return {
        "verified": True,
        "business_name": (data.get("displayName") or {}).get("text", ""),
        "address": data.get("formattedAddress", ""),
        "place_id": real_id,
        "google_maps_url": url,
        "google_review_url": GOOGLE_REVIEW_URL_TEMPLATE.format(place_id=real_id),
    }


# ---------------------------------------------------------------------------
# Rate limiting (in-memory, public endpoints)
# ---------------------------------------------------------------------------
_rate_store: dict = {}


def rate_limit(key: str, limit: int, window: int):
    now = time.time()
    entries = [t for t in _rate_store.get(key, []) if now - t < window]
    if len(entries) >= limit:
        raise HTTPException(status_code=429, detail="Terlalu banyak permintaan. Silakan coba lagi nanti.")
    entries.append(now)
    _rate_store[key] = entries


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": utcnow() + timedelta(minutes=30),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": utcnow() + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie("access_token", access_token, httponly=True, secure=True, samesite="none", max_age=1800, path="/")
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


async def get_current_admin(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi.")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token tidak valid.")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi berakhir. Silakan masuk kembali.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid.")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak. Hanya administrator.")
    user["id"] = str(user.pop("_id"))
    user.pop("password_hash", None)
    return user


# ---------------------------------------------------------------------------
# Pydantic input models
# ---------------------------------------------------------------------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str


class BusinessInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=2, max_length=120)
    owner_name: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    google_maps_url: Optional[str] = None
    google_review_url: Optional[str] = None
    instagram_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    youtube_url: Optional[str] = None
    facebook_url: Optional[str] = None
    whatsapp_url: Optional[str] = None
    logo_data: Optional[str] = None


class ActivationInput(BaseModel):
    destination_type: str
    destination_url: str
    business: BusinessInput


class CardCreateInput(BaseModel):
    count: int = Field(default=1, ge=1, le=500)


class CardUpdateInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: Optional[str] = None
    destination_type: Optional[str] = None
    destination_url: Optional[str] = None
    business_id: Optional[str] = None
    reason: Optional[str] = None


class CorrectionInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    card_code: str
    business_name: str = Field(min_length=2, max_length=120)
    old_url: Optional[str] = None
    new_url: str
    reason: str = Field(min_length=5, max_length=1000)
    requester_name: str = Field(min_length=2, max_length=120)
    requester_phone: str = Field(min_length=6, max_length=30)
    requester_email: Optional[EmailStr] = None


class CorrectionUpdateInput(BaseModel):
    action: str  # REVIEWING | APPROVE | REJECT
    admin_note: Optional[str] = None


class BusinessUpdateInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    owner_name: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    google_maps_url: Optional[str] = None
    google_review_url: Optional[str] = None
    instagram_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    youtube_url: Optional[str] = None
    facebook_url: Optional[str] = None
    whatsapp_url: Optional[str] = None


class SettingsInput(BaseModel):
    cs_whatsapp: str = Field(min_length=6, max_length=30)


class GoogleVerifyInput(BaseModel):
    google_maps_url: str
    business_id: Optional[str] = None
    business_name: Optional[str] = None  # jika diisi tanpa business_id → bisnis baru dibuat dengan data terverifikasi


class SocialValidateInput(BaseModel):
    platform: str
    url: str


# ---------------------------------------------------------------------------
# App & routers
# ---------------------------------------------------------------------------
app = FastAPI(title="Short Card API")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Short Card API", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "healthy"}


# ------------------------------- AUTH --------------------------------------
@api_router.post("/auth/login")
async def login(body: LoginInput, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"_id": identifier})
    if attempt and attempt.get("locked_until") and attempt["locked_until"] > iso():
        raise HTTPException(status_code=429, detail="Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        attempts = (attempt or {}).get("attempts", 0) + 1
        doc = {"attempts": attempts, "updated_at": iso()}
        if attempts >= 5:
            doc["locked_until"] = (utcnow() + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"_id": identifier}, {"$set": doc}, upsert=True)
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah.")
    await db.login_attempts.delete_one({"_id": identifier})
    access = create_access_token(str(user["_id"]), email)
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    return {
        "id": str(user["_id"]),
        "email": email,
        "name": user.get("name"),
        "role": user.get("role"),
        "access_token": access,
    }


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Berhasil keluar."}


@api_router.get("/auth/me")
async def me(admin: dict = Depends(get_current_admin)):
    return admin


@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi.")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token tidak valid.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid.")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan.")
    access = create_access_token(str(user["_id"]), user["email"])
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=1800, path="/")
    return {"access_token": access}


# ------------------------------- PUBLIC ------------------------------------
async def get_settings() -> dict:
    settings = await db.settings.find_one({"_id": "platform"})
    return settings or {"cs_whatsapp": CS_WHATSAPP}


@api_router.get("/public/config")
async def public_config():
    settings = await get_settings()
    return {
        "brand": "Short Card",
        "parent_brand": "GlobalConnex",
        "cs_whatsapp": settings.get("cs_whatsapp") or CS_WHATSAPP,
        "destination_types": DESTINATION_TYPES,
        "destination_labels": DEST_LABELS,
    }


@api_router.get("/public/cards/{code}")
async def public_card_status(code: str):
    code = normalize_code(code)
    card = await db.cards.find_one({"code": code})
    if not card:
        raise HTTPException(status_code=404, detail="Kartu tidak ditemukan. Periksa kembali kode kartu Anda.")
    result = {"code": card["code"], "status": card["status"]}
    if card.get("business_id"):
        business = await db.businesses.find_one({"_id": card["business_id"]})
        if business:
            result["business_name"] = business.get("name")
    if card["status"] == "ACTIVE":
        result["destination_type"] = card.get("destination_type")
        result["public_url"] = public_card_url(code)
    return result


async def perform_activation(card: dict, code: str, body: ActivationInput, destination_url: str, changed_by: str) -> dict:
    if card["status"] == "DISABLED":
        raise HTTPException(status_code=403, detail="Kartu ini dinonaktifkan. Hubungi Customer Service.")
    if card["status"] == "ACTIVE":
        raise HTTPException(status_code=409, detail="Kartu sudah aktif. Gunakan Ubah Tujuan atau alur Koreksi Link untuk mengubah tujuan.")
    if body.business.logo_data and len(body.business.logo_data) > 500_000:
        raise HTTPException(status_code=400, detail="Ukuran logo terlalu besar (maks 350KB).")

    now = iso()
    biz_data = sanitize_business_payload(body.business.model_dump(exclude_none=True))
    if card.get("business_id"):
        await db.businesses.update_one({"_id": card["business_id"]}, {"$set": {**biz_data, "updated_at": now}})
        business_id = card["business_id"]
    else:
        biz_data.update({"created_at": now, "updated_at": now})
        result = await db.businesses.insert_one(biz_data)
        business_id = result.inserted_id

    old_url = card.get("destination_url")
    await db.cards.update_one(
        {"code": code},
        {"$set": {
            "status": "ACTIVE",
            "destination_type": body.destination_type,
            "destination_url": destination_url,
            "business_id": business_id,
            "activated_at": card.get("activated_at") or now,
            "updated_at": now,
        }},
    )
    await db.card_history.insert_one({
        "card_id": str(card["_id"]),
        "card_code": code,
        "old_url": old_url,
        "new_url": destination_url,
        "changed_by": changed_by,
        "reason": "Aktivasi kartu oleh operator",
        "request_id": None,
        "created_at": now,
    })
    return {
        "message": "Kartu berhasil diaktifkan.",
        "code": code,
        "status": "ACTIVE",
        "business_name": body.business.name,
        "destination_type": body.destination_type,
        "destination_url": destination_url,
        "public_url": public_card_url(code),
    }


@api_router.post("/public/corrections")
async def create_correction(body: CorrectionInput, request: Request):
    rate_limit(f"cor:{request.client.host if request.client else 'unknown'}", 5, 60)
    code = normalize_code(body.card_code)
    card = await db.cards.find_one({"code": code})
    if not card:
        raise HTTPException(status_code=404, detail="Kartu tidak ditemukan. Periksa kembali kode kartu Anda.")
    if card["status"] == "DISABLED":
        raise HTTPException(status_code=403, detail="Kartu ini dinonaktifkan. Hubungi Customer Service.")
    new_url = validate_destination_url(card.get("destination_type") or "CUSTOM", body.new_url)
    now = iso()
    doc = {
        "card_id": str(card["_id"]),
        "card_code": code,
        "business_name": body.business_name.strip(),
        "old_url": body.old_url or card.get("destination_url"),
        "new_url": new_url,
        "reason": body.reason.strip(),
        "requester_name": body.requester_name.strip(),
        "requester_phone": body.requester_phone.strip(),
        "requester_email": body.requester_email.lower() if body.requester_email else None,
        "status": "PENDING",
        "admin_note": None,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    }
    result = await db.corrections.insert_one(doc)
    return {"message": "Permintaan koreksi link berhasil dikirim. Tim kami akan memprosesnya.", "id": str(result.inserted_id)}


@api_router.get("/public/cards/{code}/qr.png")
async def card_qr_png(code: str, download: bool = False):
    code = normalize_code(code)
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=12, border=4)
    qr.add_data(public_card_url(code))
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    headers = {}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="shortcard-{code}-qr.png"'
    return Response(content=buf.getvalue(), media_type="image/png", headers=headers)


@api_router.get("/public/cards/{code}/qr.svg")
async def card_qr_svg(code: str, download: bool = False):
    code = normalize_code(code)
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=12, border=4)
    qr.add_data(public_card_url(code))
    qr.make(fit=True)
    img = qr.make_image(image_factory=qrcode.image.svg.SvgPathImage)
    buf = io.BytesIO()
    img.save(buf)
    headers = {}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="shortcard-{code}-qr.svg"'
    return Response(content=buf.getvalue(), media_type="image/svg+xml", headers=headers)


# ------------------------------ REDIRECT -----------------------------------
def error_page(title: str, message: str, wa: str, status_code: int = 200) -> HTMLResponse:
    cs_button = ""
    if wa:
        cs_button = (
            f'<a href="https://wa.me/{wa}?text=Halo%20CS%20Short%20Card%2C%20saya%20butuh%20bantuan%20terkait%20kartu%20saya."'
            ' style="display:inline-block;margin-top:24px;background:#10B981;color:#fff;padding:14px 28px;'
            'border-radius:9999px;font-weight:700;text-decoration:none;">Hubungi Customer Service</a>'
        )
    html = f"""<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — Short Card</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0F17;
font-family:'Segoe UI',system-ui,sans-serif;color:#F8FAFC;">
<div style="text-align:center;padding:32px;max-width:420px;">
<div style="font-size:13px;letter-spacing:3px;color:#64748B;text-transform:uppercase;margin-bottom:16px;">Short Card · GlobalConnex</div>
<h1 style="font-size:28px;margin:0 0 12px;">{title}</h1>
<p style="color:#94A3B8;line-height:1.7;margin:0;">{message}</p>{cs_button}</div></body></html>"""
    return HTMLResponse(content=html, status_code=status_code)


@api_router.get("/r/{code}")
async def redirect_card(code: str):
    code = normalize_code(code)
    card = await db.cards.find_one({"code": code})
    settings = await get_settings()
    wa = settings.get("cs_whatsapp") or CS_WHATSAPP
    if not card:
        return error_page("Kartu Tidak Ditemukan", f"Kode kartu {code} tidak terdaftar di sistem Short Card. Pastikan kartu Anda asli dan hubungi Customer Service jika perlu bantuan.", wa, status_code=404)
    if card["status"] == "DISABLED":
        return error_page("Kartu Tidak Aktif", "Kartu ini telah dinonaktifkan dan tidak dapat digunakan. Silakan hubungi Customer Service untuk informasi lebih lanjut.", wa, status_code=410)
    if card["status"] != "ACTIVE" or not card.get("destination_url"):
        return error_page("Link Belum Dikonfigurasi", "Kartu ini belum diaktifkan atau belum memiliki link tujuan. Aktifkan kartu Anda terlebih dahulu di halaman aktivasi Short Card.", wa)
    return RedirectResponse(url=card["destination_url"], status_code=302)


# ------------------------------ ADMIN: STATS --------------------------------
@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_current_admin)):
    return {
        "total_cards": await db.cards.count_documents({}),
        "active_cards": await db.cards.count_documents({"status": "ACTIVE"}),
        "unassigned_cards": await db.cards.count_documents({"status": "UNASSIGNED"}),
        "assigned_cards": await db.cards.count_documents({"status": "ASSIGNED"}),
        "disabled_cards": await db.cards.count_documents({"status": "DISABLED"}),
        "total_businesses": await db.businesses.count_documents({}),
        "pending_corrections": await db.corrections.count_documents({"status": {"$in": ["PENDING", "REVIEWING"]}}),
    }


# ------------------------------ ADMIN: CARDS --------------------------------
@api_router.get("/admin/cards")
async def list_cards(
    search: str = "",
    status: str = "",
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    admin: dict = Depends(get_current_admin),
):
    query = {}
    if search:
        query["code"] = {"$regex": re.escape(search.strip().upper()), "$options": "i"}
    if status in CARD_STATUSES:
        query["status"] = status
    total = await db.cards.count_documents(query)
    cursor = db.cards.find(query).sort("code", 1).skip((page - 1) * limit).limit(limit)
    cards = [pub(doc) async for doc in cursor]
    biz_ids = [c["business_id"] for c in cards if c.get("business_id")]
    if biz_ids:
        businesses = await db.businesses.find({"_id": {"$in": [ObjectId(b) for b in biz_ids]}}).to_list(len(biz_ids))
        biz_map = {str(b["_id"]): b.get("name") for b in businesses}
        for c in cards:
            c["business_name"] = biz_map.get(c.get("business_id"))
    for c in cards:
        c["public_url"] = public_card_url(c["code"])
    return {"items": cards, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@api_router.post("/admin/cards")
async def create_cards(body: CardCreateInput, admin: dict = Depends(get_current_admin)):
    now = iso()
    created = []
    for _ in range(body.count):
        counter = await db.counters.find_one_and_update(
            {"_id": "card_code"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
        )
        code = f"SC-{counter['seq']:04d}"
        doc = {
            "code": code,
            "status": "UNASSIGNED",
            "destination_type": None,
            "destination_url": None,
            "business_id": None,
            "created_at": now,
            "updated_at": now,
            "activated_at": None,
        }
        await db.cards.insert_one(doc)
        created.append(code)
    return {"message": f"{len(created)} kartu berhasil dibuat.", "codes": created}


@api_router.post("/admin/cards/{code}/activate")
async def admin_activate_card(code: str, body: ActivationInput, admin: dict = Depends(get_current_admin)):
    code = normalize_code(code)
    destination_url = validate_destination_url(body.destination_type, body.destination_url)
    card = await get_card_or_404(code)
    return await perform_activation(card, code, body, destination_url, admin["email"])


async def get_card_or_404(code: str) -> dict:
    code = normalize_code(code)
    card = await db.cards.find_one({"code": code})
    if not card:
        raise HTTPException(status_code=404, detail="Kartu tidak ditemukan.")
    return card


@api_router.get("/admin/cards/{code}")
async def card_detail(code: str, admin: dict = Depends(get_current_admin)):
    card = await get_card_or_404(code)
    result = pub(card)
    result["public_url"] = public_card_url(card["code"])
    if card.get("business_id"):
        result["business"] = pub(await db.businesses.find_one({"_id": card["business_id"]}))
    history = await db.card_history.find({"card_code": card["code"]}).sort("created_at", -1).to_list(50)
    result["history"] = [pub(h) for h in history]
    return result


@api_router.patch("/admin/cards/{code}")
async def update_card(code: str, body: CardUpdateInput, admin: dict = Depends(get_current_admin)):
    card = await get_card_or_404(code)
    now = iso()
    updates = {"updated_at": now}

    if body.status:
        if body.status not in CARD_STATUSES:
            raise HTTPException(status_code=400, detail="Status kartu tidak valid.")
        if body.status == "ACTIVE" and not (body.destination_url or card.get("destination_url")):
            raise HTTPException(status_code=400, detail="Kartu tidak dapat diaktifkan tanpa URL tujuan.")
        updates["status"] = body.status
        if body.status == "ACTIVE" and not card.get("activated_at"):
            updates["activated_at"] = now

    if body.destination_url is not None and body.destination_url.strip():
        dtype = body.destination_type or card.get("destination_type") or "CUSTOM"
        new_url = validate_destination_url(dtype, body.destination_url)
        if new_url != card.get("destination_url"):
            updates["destination_url"] = new_url
            updates["destination_type"] = dtype
            await db.card_history.insert_one({
                "card_id": str(card["_id"]),
                "card_code": card["code"],
                "old_url": card.get("destination_url"),
                "new_url": new_url,
                "changed_by": admin["email"],
                "reason": body.reason or "Diperbarui oleh admin",
                "request_id": None,
                "created_at": now,
            })

    if body.business_id is not None:
        if body.business_id == "":
            updates["business_id"] = None
            if card["status"] == "ASSIGNED":
                updates["status"] = "UNASSIGNED"
        else:
            business = await db.businesses.find_one({"_id": ObjectId(body.business_id)})
            if not business:
                raise HTTPException(status_code=404, detail="Bisnis tidak ditemukan.")
            updates["business_id"] = business["_id"]
            if card["status"] == "UNASSIGNED":
                updates["status"] = "ASSIGNED"

    await db.cards.update_one({"_id": card["_id"]}, {"$set": updates})
    updated = await db.cards.find_one({"_id": card["_id"]})
    result = pub(updated)
    result["public_url"] = public_card_url(updated["code"])
    return result


@api_router.post("/admin/cards/{code}/disable")
async def disable_card(code: str, admin: dict = Depends(get_current_admin)):
    card = await get_card_or_404(code)
    await db.cards.update_one({"_id": card["_id"]}, {"$set": {"status": "DISABLED", "updated_at": iso()}})
    return {"message": f"Kartu {card['code']} dinonaktifkan."}


@api_router.post("/admin/cards/{code}/enable")
async def enable_card(code: str, admin: dict = Depends(get_current_admin)):
    card = await get_card_or_404(code)
    new_status = "ACTIVE" if card.get("destination_url") else ("ASSIGNED" if card.get("business_id") else "UNASSIGNED")
    await db.cards.update_one({"_id": card["_id"]}, {"$set": {"status": new_status, "updated_at": iso()}})
    return {"message": f"Kartu {card['code']} diaktifkan kembali dengan status {new_status}.", "status": new_status}


# ---------------------------- ADMIN: BUSINESSES -----------------------------
@api_router.get("/admin/businesses")
async def list_businesses(
    search: str = "",
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    admin: dict = Depends(get_current_admin),
):
    query = {}
    if search:
        query["name"] = {"$regex": re.escape(search.strip()), "$options": "i"}
    total = await db.businesses.count_documents(query)
    cursor = db.businesses.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    items = [pub(doc) async for doc in cursor]
    for item in items:
        item["cards"] = await db.cards.distinct("code", {"business_id": ObjectId(item["id"])})
    return {"items": items, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@api_router.post("/admin/businesses")
async def create_business(body: BusinessInput, admin: dict = Depends(get_current_admin)):
    now = iso()
    doc = sanitize_business_payload(body.model_dump(exclude_none=True))
    doc.update({"created_at": now, "updated_at": now})
    result = await db.businesses.insert_one(doc)
    created = {k: v for k, v in doc.items() if k != "_id"}
    created["id"] = str(result.inserted_id)
    return created


@api_router.get("/admin/businesses/{business_id}")
async def business_detail(business_id: str, admin: dict = Depends(get_current_admin)):
    business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not business:
        raise HTTPException(status_code=404, detail="Bisnis tidak ditemukan.")
    result = pub(business)
    cards = await db.cards.find({"business_id": business["_id"]}).sort("code", 1).to_list(100)
    result["cards"] = [pub(c) for c in cards]
    return result


@api_router.patch("/admin/businesses/{business_id}")
async def update_business(business_id: str, body: BusinessUpdateInput, admin: dict = Depends(get_current_admin)):
    business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not business:
        raise HTTPException(status_code=404, detail="Bisnis tidak ditemukan.")
    updates = sanitize_business_payload({k: v for k, v in body.model_dump(exclude_none=True).items()})
    if updates.get("google_maps_url") and updates["google_maps_url"] != business.get("google_maps_url"):
        updates["google_verified"] = False  # URL Maps berubah → wajib verifikasi ulang
    updates["updated_at"] = iso()
    await db.businesses.update_one({"_id": business["_id"]}, {"$set": updates})
    for field in list(BIZ_SOCIAL_FIELDS.keys()) + ["whatsapp_url", "google_review_url"]:
        if field in updates and updates[field] != business.get(field):
            await propagate_business_destination(business["_id"], field, updates[field], admin["email"], "URL bisnis diperbarui oleh admin")
    return pub(await db.businesses.find_one({"_id": business["_id"]}))


@api_router.post("/admin/businesses/verify-google")
async def verify_google(body: GoogleVerifyInput, admin: dict = Depends(get_current_admin)):
    """Engine A — verifikasi Google Business via Places API resmi. Opsional: simpan ke Business."""
    result = await verify_google_business(body.google_maps_url)
    now = iso()
    verified_fields = {
        "google_maps_url": body.google_maps_url.strip(),
        "google_place_id": result["place_id"],
        "google_review_url": result["google_review_url"],
        "google_verified": True,
        "google_verified_at": now,
        "updated_at": now,
    }
    if body.business_id:
        business = await db.businesses.find_one({"_id": ObjectId(body.business_id)})
        if not business:
            raise HTTPException(status_code=404, detail="Bisnis tidak ditemukan.")
        await db.businesses.update_one({"_id": business["_id"]}, {"$set": verified_fields})
        await propagate_business_destination(business["_id"], "google_review_url", result["google_review_url"], admin["email"], "Google Business terverifikasi")
        result["business_id"] = body.business_id
    elif body.business_name:
        doc = {"name": body.business_name.strip(), **verified_fields, "created_at": now}
        created = await db.businesses.insert_one(doc)
        result["business_id"] = str(created.inserted_id)
    return result


@api_router.post("/admin/businesses/validate-social")
async def validate_social(body: SocialValidateInput, admin: dict = Depends(get_current_admin)):
    """Engine B — validasi/normalisasi URL social media (tanpa API eksternal)."""
    return validate_social_destination(body.platform, body.url)


# ---------------------------- ADMIN: CORRECTIONS ----------------------------
@api_router.get("/admin/corrections")
async def list_corrections(
    status: str = "",
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    admin: dict = Depends(get_current_admin),
):
    query = {}
    if status in CORRECTION_STATUSES:
        query["status"] = status
    total = await db.corrections.count_documents(query)
    cursor = db.corrections.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    items = [pub(doc) async for doc in cursor]
    return {"items": items, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@api_router.patch("/admin/corrections/{correction_id}")
async def process_correction(correction_id: str, body: CorrectionUpdateInput, admin: dict = Depends(get_current_admin)):
    correction = await db.corrections.find_one({"_id": ObjectId(correction_id)})
    if not correction:
        raise HTTPException(status_code=404, detail="Permintaan koreksi tidak ditemukan.")
    if correction["status"] in ("COMPLETED", "REJECTED"):
        raise HTTPException(status_code=409, detail="Permintaan ini sudah diproses sebelumnya.")
    action = body.action.upper()
    now = iso()
    updates = {"admin_note": body.admin_note, "updated_at": now}

    if action == "REVIEWING":
        updates["status"] = "REVIEWING"
    elif action == "REJECT":
        updates["status"] = "REJECTED"
        updates["completed_at"] = now
    elif action == "APPROVE":
        card = await db.cards.find_one({"_id": ObjectId(correction["card_id"])})
        if not card:
            raise HTTPException(status_code=404, detail="Kartu terkait tidak ditemukan.")
        dtype = card.get("destination_type") or "CUSTOM"
        new_url = validate_destination_url(dtype, correction["new_url"])
        await db.cards.update_one(
            {"_id": card["_id"]},
            {"$set": {"destination_url": new_url, "updated_at": now}},
        )
        await db.card_history.insert_one({
            "card_id": str(card["_id"]),
            "card_code": card["code"],
            "old_url": card.get("destination_url"),
            "new_url": new_url,
            "changed_by": admin["email"],
            "reason": f"Koreksi link: {correction.get('reason', '-')}",
            "request_id": str(correction["_id"]),
            "created_at": now,
        })
        updates["status"] = "COMPLETED"
        updates["completed_at"] = now
    else:
        raise HTTPException(status_code=400, detail="Aksi tidak valid.")

    await db.corrections.update_one({"_id": correction["_id"]}, {"$set": updates})
    return pub(await db.corrections.find_one({"_id": correction["_id"]}))


# ----------------------------- ADMIN: HISTORY -------------------------------
@api_router.get("/admin/history")
async def global_history(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    admin: dict = Depends(get_current_admin),
):
    total = await db.card_history.count_documents({})
    cursor = db.card_history.find({}).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    items = [pub(doc) async for doc in cursor]
    return {"items": items, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


# ----------------------------- ADMIN: SETTINGS ------------------------------
@api_router.get("/admin/settings")
async def get_admin_settings(admin: dict = Depends(get_current_admin)):
    settings = await get_settings()
    return {"cs_whatsapp": settings.get("cs_whatsapp") or CS_WHATSAPP, "public_base_url": PUBLIC_BASE_URL}


@api_router.patch("/admin/settings")
async def update_settings(body: SettingsInput, admin: dict = Depends(get_current_admin)):
    wa = re.sub(r"[^\d]", "", body.cs_whatsapp)
    await db.settings.update_one(
        {"_id": "platform"},
        {"$set": {"cs_whatsapp": wa, "updated_at": iso(), "updated_by": admin["email"]}},
        upsert=True,
    )
    return {"message": "Pengaturan berhasil disimpan.", "cs_whatsapp": wa}


# ---------------------------------------------------------------------------
app.include_router(api_router)

_cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
if "*" in _cors_origins:
    _cors_origins = [o for o in [PUBLIC_BASE_URL, "http://localhost:3000", "http://localhost:8001"] if o]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
async def seed_admin():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        logger.warning("ADMIN_EMAIL / ADMIN_PASSWORD tidak diatur, seed admin dilewati.")
        return
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if existing is None:
        await db.users.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Admin Short Card",
            "role": "admin",
            "created_at": iso(),
        })
        logger.info("Admin user seeded: %s", ADMIN_EMAIL)
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})
        logger.info("Admin password updated from env: %s", ADMIN_EMAIL)


async def seed_settings():
    await db.settings.update_one(
        {"_id": "platform"},
        {"$setOnInsert": {"cs_whatsapp": CS_WHATSAPP, "created_at": iso()}},
        upsert=True,
    )


async def seed_demo():
    if await db.cards.count_documents({}) > 0:
        return
    now = iso()
    biz1 = await db.businesses.insert_one({
        "name": "Kopi Demo",
        "owner_name": "Demo Owner",
        "whatsapp": "6281234567890",
        "email": "demo@kopidemo.id",
        "address": "Jl. Contoh No. 1, Jakarta",
        "instagram_url": "https://www.instagram.com/kopidemo/",
        "google_verified": False,
        "created_at": now,
        "updated_at": now,
    })
    biz2 = await db.businesses.insert_one({
        "name": "Barber Demo",
        "owner_name": "Demo Barber",
        "whatsapp": "6281234567891",
        "instagram_url": "https://instagram.com/barberdemo",
        "created_at": now,
        "updated_at": now,
    })
    cards = [
        {"code": "SC-0001", "status": "ACTIVE", "destination_type": "INSTAGRAM",
         "destination_url": "https://www.instagram.com/kopidemo/", "business_id": biz1.inserted_id, "activated_at": now},
        {"code": "SC-0002", "status": "ACTIVE", "destination_type": "INSTAGRAM",
         "destination_url": "https://www.instagram.com/kopidemo/", "business_id": biz1.inserted_id, "activated_at": now},
        {"code": "SC-0003", "status": "ASSIGNED", "destination_type": None, "destination_url": None,
         "business_id": biz2.inserted_id, "activated_at": None},
        {"code": "SC-0004", "status": "UNASSIGNED", "destination_type": None, "destination_url": None,
         "business_id": None, "activated_at": None},
        {"code": "SC-0005", "status": "UNASSIGNED", "destination_type": None, "destination_url": None,
         "business_id": None, "activated_at": None},
        {"code": "SC-0006", "status": "DISABLED", "destination_type": None, "destination_url": None,
         "business_id": None, "activated_at": None},
    ]
    for c in cards:
        c.update({"created_at": now, "updated_at": now})
    await db.cards.insert_many(cards)
    await db.counters.update_one({"_id": "card_code"}, {"$set": {"seq": 6}}, upsert=True)
    sc2 = await db.cards.find_one({"code": "SC-0002"})
    await db.corrections.insert_one({
        "card_id": str(sc2["_id"]),
        "card_code": "SC-0002",
        "business_name": "Kopi Demo",
        "old_url": "https://www.instagram.com/kopidemo/",
        "new_url": "https://www.instagram.com/kopidemo.official/",
        "reason": "Akun Instagram bisnis berpindah ke handle baru.",
        "requester_name": "Demo Owner",
        "requester_phone": "6281234567890",
        "requester_email": "demo@kopidemo.id",
        "status": "PENDING",
        "admin_note": None,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    })
    await db.card_history.insert_one({
        "card_id": str(sc2["_id"]),
        "card_code": "SC-0002",
        "old_url": None,
        "new_url": "https://www.instagram.com/kopidemo/",
        "changed_by": "customer_activation",
        "reason": "Aktivasi kartu oleh pelanggan",
        "request_id": None,
        "created_at": now,
    })
    logger.info("Demo data seeded (SC-0001..SC-0006).")


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.cards.create_index("code", unique=True)
    await db.cards.create_index("status")
    await db.cards.create_index("business_id")
    await db.corrections.create_index("status")
    await db.corrections.create_index("card_code")
    await db.card_history.create_index("card_code")
    await db.login_attempts.create_index("locked_until")
    await seed_admin()
    await seed_settings()
    await seed_demo()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
