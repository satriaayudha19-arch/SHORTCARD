"""Integration tests untuk core business logic Short Card.
Jalankan: cd /app/backend && python -m pytest tests/test_core.py -v
Membutuhkan backend berjalan di localhost:8001.
"""
import concurrent.futures
import os
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE = os.environ.get("SHORTCARD_API", "http://localhost:8001/api")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

pytestmark = pytest.mark.skipif(
    not (ADMIN_EMAIL and ADMIN_PASSWORD),
    reason="ADMIN_EMAIL/ADMIN_PASSWORD tidak diatur (dibaca dari backend/.env atau environment)",
)


@pytest.fixture(scope="session")
def admin_token():
    res = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


@pytest.fixture(scope="session")
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_login_success(admin_token):
    assert admin_token


def test_login_wrong_password_rejected():
    res = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": "salah"})
    assert res.status_code == 401


def test_admin_endpoint_requires_auth():
    res = requests.get(f"{BASE}/admin/stats")
    assert res.status_code in (401, 403)


def test_concurrent_card_creation_unique(auth):
    """10 request bersamaan tidak boleh menghasilkan Card Code duplikat."""

    def create(_):
        res = requests.post(f"{BASE}/admin/cards", json={"count": 1}, headers=auth)
        assert res.status_code == 200, res.text
        return res.json()["codes"][0]

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        codes = list(pool.map(create, range(10)))
    assert len(codes) == len(set(codes)), f"Duplikat ditemukan: {codes}"


def test_card_code_invalid_rejected():
    res = requests.get(f"{BASE}/public/cards/INVALID-CODE")
    assert res.status_code == 400


def test_card_not_found():
    res = requests.get(f"{BASE}/public/cards/SC-9999")
    assert res.status_code == 404
    res = requests.get(f"{BASE}/r/SC-9999", allow_redirects=False)
    assert res.status_code == 404 and "Kartu Tidak Ditemukan" in res.text


def test_activation_requires_admin():
    """Aktivasi adalah operasi khusus admin/operator — anonim harus ditolak."""
    payload = {
        "destination_type": "CUSTOM",
        "destination_url": "https://example.com",
        "business": {"name": "Hijack Attempt"},
    }
    res = requests.post(f"{BASE}/admin/cards/SC-0005/activate", json=payload)
    assert res.status_code in (401, 403)
    # Endpoint publik lama sudah tidak tersedia
    res = requests.post(f"{BASE}/public/cards/SC-0005/activate", json=payload)
    assert res.status_code in (404, 405)


def test_active_card_cannot_be_reactivated(auth):
    """Kartu ACTIVE tidak bisa diaktivasi ulang / di-hijack."""
    res = requests.post(f"{BASE}/admin/cards/SC-0001/activate", json={
        "destination_type": "GOOGLE_REVIEW",
        "destination_url": "https://search.google.com/local/writereview?placeid=ChIJHijack",
        "business": {"name": "Hijack Attempt"},
    }, headers=auth)
    assert res.status_code == 409
    # Tujuan kartu tidak berubah
    res = requests.get(f"{BASE}/r/SC-0001", allow_redirects=False)
    assert res.status_code == 302
    assert "ChIJHijack" not in res.headers["location"]


def test_full_card_lifecycle(auth):
    """Create → activate → redirect → update link → redirect baru → disable."""
    res = requests.post(f"{BASE}/admin/cards", json={"count": 1}, headers=auth)
    code = res.json()["codes"][0]

    # Belum aktif: redirect menampilkan halaman error informatif, bukan redirect
    res = requests.get(f"{BASE}/r/{code}", allow_redirects=False)
    assert res.status_code == 200 and "Link Belum Dikonfigurasi" in res.text

    # Aktivasi oleh admin/operator
    res = requests.post(f"{BASE}/admin/cards/{code}/activate", json={
        "destination_type": "INSTAGRAM",
        "destination_url": "https://instagram.com/testlifecycle",
        "business": {"name": "Test Lifecycle Biz"},
    }, headers=auth)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "ACTIVE"
    assert f"/r/{code}" in body["public_url"]

    # Redirect ke tujuan awal (URL social dinormalisasi oleh Engine B)
    res = requests.get(f"{BASE}/r/{code}", allow_redirects=False)
    assert res.status_code == 302
    assert res.headers["location"] == "https://www.instagram.com/testlifecycle/"

    # QR Code harus berisi URL Short Card, bukan URL tujuan
    res = requests.get(f"{BASE}/public/cards/{code}/qr.png")
    assert res.status_code == 200 and res.headers["content-type"] == "image/png"

    # Ubah destination tanpa mengganti kartu (inti Lifetime Garansi Link)
    res = requests.patch(f"{BASE}/admin/cards/{code}", json={
        "destination_url": "https://instagram.com/testlifecycle.baru",
        "reason": "test update",
    }, headers=auth)
    assert res.status_code == 200, res.text

    # URL kartu sama, redirect kini ke link baru
    res = requests.get(f"{BASE}/r/{code}", allow_redirects=False)
    assert res.status_code == 302
    assert res.headers["location"] == "https://www.instagram.com/testlifecycle.baru/"

    # History tercatat
    res = requests.get(f"{BASE}/admin/cards/{code}", headers=auth)
    history = res.json()["history"]
    assert any(h["new_url"] == "https://www.instagram.com/testlifecycle.baru/" for h in history)

    # Disable: redirect berhenti
    res = requests.post(f"{BASE}/admin/cards/{code}/disable", headers=auth)
    assert res.status_code == 200
    res = requests.get(f"{BASE}/r/{code}", allow_redirects=False)
    assert res.status_code == 410 and "Kartu Tidak Aktif" in res.text


def test_activation_validates_url(auth):
    res = requests.post(f"{BASE}/admin/cards", json={"count": 1}, headers=auth)
    code = res.json()["codes"][0]
    # javascript: scheme harus ditolak
    res = requests.post(f"{BASE}/admin/cards/{code}/activate", json={
        "destination_type": "CUSTOM",
        "destination_url": "javascript:alert(1)",
        "business": {"name": "Test Sec"},
    }, headers=auth)
    assert res.status_code == 400
    # URL non-Instagram untuk tipe INSTAGRAM harus ditolak
    res = requests.post(f"{BASE}/admin/cards/{code}/activate", json={
        "destination_type": "INSTAGRAM",
        "destination_url": "https://example.com/page",
        "business": {"name": "Test Sec"},
    }, headers=auth)
    assert res.status_code == 400


def test_correction_flow(auth):
    """Submit koreksi → admin approve → destination berubah → history tercatat."""
    res = requests.post(f"{BASE}/admin/cards", json={"count": 1}, headers=auth)
    code = res.json()["codes"][0]
    requests.post(f"{BASE}/admin/cards/{code}/activate", json={
        "destination_type": "WHATSAPP",
        "destination_url": "https://wa.me/6281111111111",
        "business": {"name": "Test Correction Biz"},
    }, headers=auth)

    marker = uuid.uuid4().hex[:8]
    res = requests.post(f"{BASE}/public/corrections", json={
        "card_code": code,
        "business_name": "Test Correction Biz",
        "new_url": "https://wa.me/6282222222222",
        "reason": f"Nomor WA berubah {marker}",
        "requester_name": "Penguji",
        "requester_phone": "6283333333333",
    })
    assert res.status_code == 200, res.text

    # Masuk dashboard admin
    res = requests.get(f"{BASE}/admin/corrections?status=PENDING&limit=50", headers=auth)
    match = [c for c in res.json()["items"] if c["card_code"] == code and marker in c["reason"]]
    assert len(match) == 1
    correction_id = match[0]["id"]

    # Approve
    res = requests.patch(f"{BASE}/admin/corrections/{correction_id}", json={
        "action": "APPROVE", "admin_note": "OK",
    }, headers=auth)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "COMPLETED"

    # Redirect ke link baru
    res = requests.get(f"{BASE}/r/{code}", allow_redirects=False)
    assert res.headers["location"] == "https://wa.me/6282222222222"

    # History mencatat request_id
    res = requests.get(f"{BASE}/admin/cards/{code}", headers=auth)
    history = res.json()["history"]
    assert any(h.get("request_id") == correction_id for h in history)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _create_active_card(auth, dtype, url, biz_name):
    res = requests.post(f"{BASE}/admin/cards", json={"count": 1}, headers=auth)
    code = res.json()["codes"][0]
    res = requests.post(f"{BASE}/admin/cards/{code}/activate", json={
        "destination_type": dtype, "destination_url": url, "business": {"name": biz_name},
    }, headers=auth)
    assert res.status_code == 200, res.text
    return code


def _validate_social(auth, platform, url):
    return requests.post(f"{BASE}/admin/businesses/validate-social", json={"platform": platform, "url": url}, headers=auth)


# ---------------------------------------------------------------------------
# Engine B — Social Media Destination Validator
# ---------------------------------------------------------------------------
def test_instagram_validation(auth):
    body = _validate_social(auth, "INSTAGRAM", "https://instagram.com/KopiKita").json()
    assert body["valid"] is True
    assert body["normalized_url"] == "https://www.instagram.com/KopiKita/"
    assert _validate_social(auth, "INSTAGRAM", "https://www.instagram.com/kopikita/").json()["valid"] is True
    assert _validate_social(auth, "INSTAGRAM", "https://example.com/kopikita").json()["valid"] is False
    assert _validate_social(auth, "INSTAGRAM", "https://instagram.com/p/abc123").json()["valid"] is False
    assert _validate_social(auth, "INSTAGRAM", "javascript:alert(1)").json()["valid"] is False
    assert _validate_social(auth, "INSTAGRAM", "http://instagram.com/kopikita").json()["valid"] is False


def test_tiktok_validation(auth):
    assert _validate_social(auth, "TIKTOK", "https://www.tiktok.com/@kopikita").json()["valid"] is True
    assert _validate_social(auth, "TIKTOK", "https://tiktok.com/@kopikita").json()["normalized_url"] == "https://www.tiktok.com/@kopikita"
    assert _validate_social(auth, "TIKTOK", "https://example.com/@kopikita").json()["valid"] is False
    assert _validate_social(auth, "TIKTOK", "https://www.tiktok.com/kopikita").json()["valid"] is False


def test_facebook_validation(auth):
    assert _validate_social(auth, "FACEBOOK", "https://www.facebook.com/kopikita").json()["valid"] is True
    assert _validate_social(auth, "FACEBOOK", "https://facebook.com/kopikita").json()["normalized_url"] == "https://www.facebook.com/kopikita"
    assert _validate_social(auth, "FACEBOOK", "https://example.com/kopikita").json()["valid"] is False
    assert _validate_social(auth, "FACEBOOK", "https://www.facebook.com").json()["valid"] is False


def test_youtube_validation(auth):
    assert _validate_social(auth, "YOUTUBE", "https://youtube.com/@kopikita").json()["valid"] is True
    channel = "UC" + "x" * 22
    assert _validate_social(auth, "YOUTUBE", f"https://www.youtube.com/channel/{channel}").json()["valid"] is True
    assert _validate_social(auth, "YOUTUBE", "https://example.com/@kopikita").json()["valid"] is False
    assert _validate_social(auth, "YOUTUBE", "https://www.youtube.com/watch?v=abc123").json()["valid"] is False
    assert _validate_social(auth, "YOUTUBE", "https://youtu.be/abc123").json()["valid"] is False


def test_social_card_redirects(auth):
    """Setiap destination type: Card aktif → redirect ke URL tersimpan (dinormalisasi)."""
    cases = [
        ("INSTAGRAM", "https://instagram.com/e2e.ig", "https://www.instagram.com/e2e.ig/"),
        ("TIKTOK", "https://www.tiktok.com/@e2e.tt", "https://www.tiktok.com/@e2e.tt"),
        ("FACEBOOK", "https://www.facebook.com/e2efb", "https://www.facebook.com/e2efb"),
        ("YOUTUBE", "https://youtube.com/@e2eyt", "https://www.youtube.com/@e2eyt"),
        ("WHATSAPP", "https://wa.me/6281234567890", "https://wa.me/6281234567890"),
        ("CUSTOM", "https://contoh-website.id/promo", "https://contoh-website.id/promo"),
    ]
    for dtype, url, expected in cases:
        code = _create_active_card(auth, dtype, url, f"E2E {dtype}")
        res = requests.get(f"{BASE}/r/{code}", allow_redirects=False)
        assert res.status_code == 302, dtype
        assert res.headers["location"] == expected, f"{dtype}: {res.headers['location']}"


# ---------------------------------------------------------------------------
# Engine A — Google Business Verification
# ---------------------------------------------------------------------------
def test_google_verify_rejects_non_google_url(auth):
    res = requests.post(f"{BASE}/admin/businesses/verify-google", json={"google_maps_url": "https://example.com/maps"}, headers=auth)
    assert res.status_code == 400


def test_google_verify_requires_api_key(auth):
    """Tanpa GOOGLE_MAPS_API_KEY: error 503 yang jelas — TIDAK ADA fake success."""
    res = requests.post(f"{BASE}/admin/businesses/verify-google", json={"google_maps_url": "https://maps.app.goo.gl/HzeHM1gp3wFzWvWJ8"}, headers=auth)
    if res.status_code == 503:
        assert "GOOGLE_MAPS_API_KEY" in res.json()["detail"]
    else:
        # Jika key sudah dikonfigurasi: harus hasil verifikasi nyata atau error Google yang jelas
        assert res.status_code in (200, 400, 404, 429, 502)
        if res.status_code == 200:
            body = res.json()
            assert body["verified"] is True
            assert len(body["place_id"]) > 10
            assert "placeid=" in body["google_review_url"]


def test_fake_place_id_never_accepted(auth):
    """URL berisi Place ID karangan tidak boleh menghasilkan verified=true."""
    res = requests.post(
        f"{BASE}/admin/businesses/verify-google",
        json={"google_maps_url": "https://www.google.com/maps/place/?q=place_id:ChIJFakePlaceIdKopi123"},
        headers=auth,
    )
    assert res.status_code != 200, "Fake Place ID diterima sebagai valid!"
    assert res.status_code in (400, 404, 429, 502, 503)


# ---------------------------------------------------------------------------
# Business single source of truth → propagasi ke Card
# ---------------------------------------------------------------------------
def test_business_update_propagates_to_cards(auth):
    code = _create_active_card(auth, "INSTAGRAM", "https://instagram.com/prop.awal", "Biz Propagasi")
    res = requests.get(f"{BASE}/r/{code}", allow_redirects=False)
    assert res.headers["location"] == "https://www.instagram.com/prop.awal/"
    detail = requests.get(f"{BASE}/admin/cards/{code}", headers=auth).json()
    biz_id = detail["business"]["id"]
    res = requests.patch(f"{BASE}/admin/businesses/{biz_id}", json={"instagram_url": "https://instagram.com/prop.baru"}, headers=auth)
    assert res.status_code == 200, res.text
    assert res.json()["instagram_url"] == "https://www.instagram.com/prop.baru/"
    res = requests.get(f"{BASE}/r/{code}", allow_redirects=False)
    assert res.headers["location"] == "https://www.instagram.com/prop.baru/"
    detail = requests.get(f"{BASE}/admin/cards/{code}", headers=auth).json()
    assert any(h["new_url"] == "https://www.instagram.com/prop.baru/" for h in detail["history"])


def test_business_rejects_foreign_social_domain(auth):
    res = requests.post(f"{BASE}/admin/businesses", json={"name": "Biz Domain Jahat", "instagram_url": "https://example.com/kopikita"}, headers=auth)
    assert res.status_code == 400


def test_business_rejects_non_google_maps_url(auth):
    res = requests.post(f"{BASE}/admin/businesses", json={"name": "Biz Maps Palsu", "google_maps_url": "https://example.com/maps"}, headers=auth)
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# Unit tests — host validation & Place ID extraction (pure functions)
# ---------------------------------------------------------------------------
import sys as _sys
_sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server import _extract_place_id, _is_google_maps_host  # noqa: E402


def test_google_host_validation_unit():
    # Domain regional Google: google.<ccTLD 2 huruf> diterima (google.de, google.io, google.co.id, dst).
    # Gerbang akhir tetap Places API — Place ID palsu/tidak ada akan ditolak Google.
    for good in ["maps.app.goo.gl", "www.google.com", "google.com", "maps.google.com",
                 "www.google.co.id", "google.de", "google.com.au", "search.google.com", "goo.gl", "g.page", "google.io"]:
        assert _is_google_maps_host(good), f"seharusnya diterima: {good}"
    # gTLD >2 huruf & domain tiruan harus DITOLAK
    for bad in ["google.evil.com", "google.football", "google.xyz", "www.google.com.evil.com",
                "maps.app.goo.gl.evil.com", "evilgoogle.com", "notgoogle.com", "google.io.evil.com"]:
        assert not _is_google_maps_host(bad), f"seharusnya DITOLAK: {bad}"


def test_place_id_extraction_unit():
    pid = "ChIJN1t_tDeuEmsRUsoyG83frY4"
    assert _extract_place_id(f"https://www.google.com/maps/place/X/data=!3m1!4b1!4m5!3m4!1s{pid}!8m2!3d1!4d1") == pid
    assert _extract_place_id(f"https://www.google.com/maps?place_id={pid}") == pid
    # hex CID (0x...) BUKAN Place ID → jangan diekstrak
    assert _extract_place_id("https://www.google.com/maps/data=!1s0x89c259a9b3117469:0x87fb9f6f68f9f01b") is None
    # token short URL BUKAN Place ID
    assert _extract_place_id("https://maps.app.goo.gl/HzeHM1gp3wFzWvWJ8") is None
    # /place/<nama> tanpa data blob → tidak ada Place ID
    assert _extract_place_id("https://www.google.com/maps/place/Kopi+ABC") is None


def test_google_like_malicious_domains_rejected_api(auth):
    for bad in [
        "https://google.evil.com/maps/place/x",
        "https://google.football/maps/place/x",
        "https://www.google.com.evil.com/maps",
        "https://maps.app.goo.gl.evil.com/abc",
        "https://notgoogle.com/maps",
    ]:
        res = requests.post(f"{BASE}/admin/businesses/verify-google", json={"google_maps_url": bad}, headers=auth)
        assert res.status_code == 400, f"domain jahat harus 400: {bad}"
    # Domain regional Google legitimate tetap lolos host-check (tanpa API key → 503, bukan 400)
    res = requests.post(f"{BASE}/admin/businesses/verify-google",
                        json={"google_maps_url": "https://www.google.co.id/maps/place/Kopi+ABC"}, headers=auth)
    assert res.status_code != 400


# ---------------------------------------------------------------------------
# Propagation matrix — satu Business, banyak Card tipe berbeda
# ---------------------------------------------------------------------------
def test_propagation_matrix_only_matching_cards_change(auth):
    res = requests.post(f"{BASE}/admin/businesses", json={
        "name": "Biz Matrix",
        "instagram_url": "https://instagram.com/matrix.ig",
        "tiktok_url": "https://tiktok.com/@matrix.tt",
        "facebook_url": "https://facebook.com/matrixfb",
        "youtube_url": "https://youtube.com/@matrixyt",
        "whatsapp_url": "https://wa.me/6281111111111",
        "google_review_url": "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4",
    }, headers=auth)
    assert res.status_code == 200, res.text
    biz_id = res.json()["id"]

    dest = {
        "GOOGLE_REVIEW": "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4",
        "INSTAGRAM": "https://instagram.com/matrix.ig",
        "TIKTOK": "https://tiktok.com/@matrix.tt",
        "FACEBOOK": "https://facebook.com/matrixfb",
        "YOUTUBE": "https://youtube.com/@matrixyt",
    }
    norm_awal = {
        "GOOGLE_REVIEW": dest["GOOGLE_REVIEW"],
        "INSTAGRAM": "https://www.instagram.com/matrix.ig/",
        "TIKTOK": "https://www.tiktok.com/@matrix.tt",
        "FACEBOOK": "https://www.facebook.com/matrixfb",
        "YOUTUBE": "https://www.youtube.com/@matrixyt",
    }
    cards = {}
    for dtype, url in dest.items():
        code = requests.post(f"{BASE}/admin/cards", json={"count": 1}, headers=auth).json()["codes"][0]
        res = requests.patch(f"{BASE}/admin/cards/{code}", json={"business_id": biz_id}, headers=auth)
        assert res.status_code == 200, res.text
        res = requests.patch(f"{BASE}/admin/cards/{code}",
                             json={"destination_type": dtype, "destination_url": url, "status": "ACTIVE", "reason": "setup matrix"},
                             headers=auth)
        assert res.status_code == 200, res.text
        cards[dtype] = code

    # Kartu DISABLED bertipe INSTAGRAM TIDAK boleh ikut berubah
    disabled_code = requests.post(f"{BASE}/admin/cards", json={"count": 1}, headers=auth).json()["codes"][0]
    requests.patch(f"{BASE}/admin/cards/{disabled_code}", json={"business_id": biz_id}, headers=auth)
    requests.patch(f"{BASE}/admin/cards/{disabled_code}",
                   json={"destination_type": "INSTAGRAM", "destination_url": "https://instagram.com/matrix.ig", "status": "ACTIVE"},
                   headers=auth)
    requests.post(f"{BASE}/admin/cards/{disabled_code}/disable", headers=auth)

    # Ubah HANYA instagram_url pada Business
    res = requests.patch(f"{BASE}/admin/businesses/{biz_id}", json={"instagram_url": "https://instagram.com/matrix.baru"}, headers=auth)
    assert res.status_code == 200, res.text

    for dtype in dest:
        detail = requests.get(f"{BASE}/admin/cards/{cards[dtype]}", headers=auth).json()
        want = "https://www.instagram.com/matrix.baru/" if dtype == "INSTAGRAM" else norm_awal[dtype]
        assert detail["destination_url"] == want, f"{dtype}: {detail['destination_url']} != {want}"

    # Kartu DISABLED tetap URL lama
    detail = requests.get(f"{BASE}/admin/cards/{disabled_code}", headers=auth).json()
    assert detail["destination_url"] == "https://www.instagram.com/matrix.ig/"

    # Redirect kartu INSTAGRAM → URL baru; kartu lain → URL lama
    res = requests.get(f"{BASE}/r/{cards['INSTAGRAM']}", allow_redirects=False)
    assert res.headers["location"] == "https://www.instagram.com/matrix.baru/"
    res = requests.get(f"{BASE}/r/{cards['TIKTOK']}", allow_redirects=False)
    assert res.headers["location"] == "https://www.tiktok.com/@matrix.tt"


def test_activation_writes_business_destination_field(auth):
    """Snapshot konsisten: aktivasi menulis destination ke field Business yang sesuai."""
    code = _create_active_card(auth, "TIKTOK", "https://tiktok.com/@snap.test", "Biz Snapshot")
    detail = requests.get(f"{BASE}/admin/cards/{code}", headers=auth).json()
    assert detail["business"]["tiktok_url"] == "https://www.tiktok.com/@snap.test"
    assert detail["destination_url"] == "https://www.tiktok.com/@snap.test"
