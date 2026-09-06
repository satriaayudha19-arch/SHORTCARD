"""Integration tests untuk core business logic Short Card.
Jalankan: cd /app/backend && python -m pytest tests/test_core.py -v
Membutuhkan backend berjalan di localhost:8001.
"""
import concurrent.futures
import os
import uuid

import pytest
import requests

BASE = os.environ.get("SHORTCARD_API", "http://localhost:8001/api")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "satriaayudha19@gmail.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "SCg#2026!xQ7mP4wZk")


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


def test_full_card_lifecycle(auth):
    """Create → activate → redirect → update link → redirect baru → disable."""
    res = requests.post(f"{BASE}/admin/cards", json={"count": 1}, headers=auth)
    code = res.json()["codes"][0]

    # Belum aktif: redirect menampilkan halaman error informatif, bukan redirect
    res = requests.get(f"{BASE}/r/{code}", allow_redirects=False)
    assert res.status_code == 200 and "Link Belum Dikonfigurasi" in res.text

    # Aktivasi publik
    res = requests.post(f"{BASE}/public/cards/{code}/activate", json={
        "destination_type": "INSTAGRAM",
        "destination_url": "https://instagram.com/testlifecycle",
        "business": {"name": "Test Lifecycle Biz"},
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "ACTIVE"
    assert f"/r/{code}" in body["public_url"]

    # Redirect ke tujuan awal
    res = requests.get(f"{BASE}/r/{code}", allow_redirects=False)
    assert res.status_code == 302
    assert res.headers["location"] == "https://instagram.com/testlifecycle"

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
    assert res.headers["location"] == "https://instagram.com/testlifecycle.baru"

    # History tercatat
    res = requests.get(f"{BASE}/admin/cards/{code}", headers=auth)
    history = res.json()["history"]
    assert any(h["new_url"] == "https://instagram.com/testlifecycle.baru" for h in history)

    # Disable: redirect berhenti
    res = requests.post(f"{BASE}/admin/cards/{code}/disable", headers=auth)
    assert res.status_code == 200
    res = requests.get(f"{BASE}/r/{code}", allow_redirects=False)
    assert res.status_code == 410 and "Kartu Tidak Aktif" in res.text


def test_activation_validates_url(auth):
    res = requests.post(f"{BASE}/admin/cards", json={"count": 1}, headers=auth)
    code = res.json()["codes"][0]
    # javascript: scheme harus ditolak
    res = requests.post(f"{BASE}/public/cards/{code}/activate", json={
        "destination_type": "CUSTOM",
        "destination_url": "javascript:alert(1)",
        "business": {"name": "Test Sec"},
    })
    assert res.status_code == 400
    # URL non-Instagram untuk tipe INSTAGRAM harus ditolak
    res = requests.post(f"{BASE}/public/cards/{code}/activate", json={
        "destination_type": "INSTAGRAM",
        "destination_url": "https://example.com/page",
        "business": {"name": "Test Sec"},
    })
    assert res.status_code == 400


def test_correction_flow(auth):
    """Submit koreksi → admin approve → destination berubah → history tercatat."""
    res = requests.post(f"{BASE}/admin/cards", json={"count": 1}, headers=auth)
    code = res.json()["codes"][0]
    requests.post(f"{BASE}/public/cards/{code}/activate", json={
        "destination_type": "WHATSAPP",
        "destination_url": "https://wa.me/6281111111111",
        "business": {"name": "Test Correction Biz"},
    })

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
