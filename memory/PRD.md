# PRD — Short Card by GlobalConnex

## Problem Statement (ringkasan)
Platform web untuk aktivasi & pengelolaan kartu fisik QR + NFC ("Short Card"). Setiap kartu memiliki
public URL unik `/r/SC-XXXX` yang me-redirect server-side (302) ke destination URL aktif
(Google Review, Instagram, TikTok, YouTube, Facebook, WhatsApp, Custom). Destination dapat diubah
kapan saja tanpa mengganti kartu/QR/NFC → fitur **Lifetime Garansi Link**. Target domain produksi:
`globalconnex.id/shortcard`.

## Arsitektur
- **Frontend**: React (CRA + craco), Tailwind + shadcn/ui, framer-motion, sonner, react-router v7.
  Public: dark premium (#0B0F17, aksen biru #3B82F6, emas #F59E0B), font Plus Jakarta Sans + JetBrains Mono.
  Admin: SaaS light slate dengan sidebar gelap.
- **Backend**: FastAPI + Motor (MongoDB async), prefix `/api`. JWT auth via httpOnly cookie
  (access 30 mnt + refresh 7 hari) + Bearer fallback. Bcrypt password hashing. Brute-force lockout
  (5x gagal → 15 mnt). Rate limit in-memory untuk endpoint publik.
- **Database**: MongoDB (env MONGO_URL/DB_NAME). Unique index: `users.email`, `cards.code`.
  Card code generator: atomic counter `find_one_and_update($inc)` → concurrency-safe.

## User Personas
1. **Calon pelanggan / pemilik kartu** — landing page, aktivasi kartu, koreksi link, hubungi CS.
2. **Pelanggan bisnis (end-user)** — tap NFC / scan QR → langsung redirect. Tanpa login/aplikasi.
3. **Admin GlobalConnex** — kelola kartu, bisnis, koreksi, pengaturan.

## Database Schema (collections)
- `users`: email (unique), password_hash, name, role=admin, created_at
- `cards`: code (unique, SC-XXXX), status (UNASSIGNED|ASSIGNED|ACTIVE|DISABLED),
  destination_type, destination_url, business_id, created_at, updated_at, activated_at
- `businesses`: name, owner_name, whatsapp, email, address, google_maps_url, google_review_url,
  instagram_url, tiktok_url, youtube_url, facebook_url, whatsapp_url, logo_data, timestamps
- `corrections`: card_id, card_code, business_name, old_url, new_url, reason, requester_name/phone/email,
  status (PENDING|REVIEWING|APPROVED|REJECTED|COMPLETED), admin_note, created_at, updated_at, completed_at
- `card_history`: card_id, card_code, old_url, new_url, changed_by, reason, request_id, created_at
- `settings`: _id="platform", cs_whatsapp
- `counters`: _id="card_code", seq (atomic card code generator)
- `login_attempts`: brute-force tracking

## API Endpoints
- Auth: `POST /api/auth/login|logout|refresh`, `GET /api/auth/me`
- Public: `GET /api/public/config`, `GET /api/public/cards/{code}` (status read-only),
  `POST /api/public/corrections`, `GET /api/public/cards/{code}/qr.png|qr.svg`
- Redirect: `GET /api/r/{code}` → 302 ke destination / halaman error HTML informatif
- Admin: `GET /api/admin/stats`, CRUD `/api/admin/cards` (+`/{code}`, **`POST /{code}/activate` (operator-only)**,
  `/disable`, `/enable`), CRUD `/api/admin/businesses`, `GET/PATCH /api/admin/corrections(/{id})`,
  `GET /api/admin/history`, `GET/PATCH /api/admin/settings`
- Catatan keamanan (7 Sep 2026): endpoint aktivasi publik DIHAPUS — aktivasi/konfigurasi kartu
  hanya bisa dilakukan admin/operator terautentikasi (anti-hijack kartu inventaris fisik).

## Routes
- Public: `/` landing, `/activate` (alias `/aktivasi`), `/correction` (alias `/koreksi`),
  `/r/:code` (bounce ke `/api/r/:code`)
- Admin: `/admin/login`, `/admin` (dashboard, cards, cards/:code, businesses, corrections, history, settings)

## Yang Sudah Diimplementasikan (6 Sep 2026)
- Landing page premium (hero, 6 benefit, varian kartu hitam/putih + gambar AI, 7 use case, cara kerja,
  Lifetime Garansi Link, CS WhatsApp CTA, SEO meta/OG/robots)
- Aktivasi kartu multi-step mobile-first (validasi kode → jenis tujuan → URL + data bisnis + upload logo
  → konfirmasi → QR + public URL + download PNG/SVG)
- Form koreksi link publik + sukses state + CTA WhatsApp
- Redirect publik 302 + halaman error: Kartu Tidak Ditemukan / Kartu Tidak Aktif / Link Belum Dikonfigurasi
- Admin: login JWT, dashboard stats, kartu (buat bulk concurrency-safe, search/filter/pagination, detail,
  ubah tujuan, assign bisnis, disable/enable, QR download), bisnis CRUD, koreksi (review/approve/reject +
  catatan internal), riwayat audit global, pengaturan CS WhatsApp
- Seed: admin dari env, demo data (SC-0001..SC-0006, 2 bisnis, 1 koreksi PENDING)
- 11 integration tests (`/app/backend/tests/test_core.py`) — semua lulus, termasuk concurrency 10 request,
  anti-hijack (aktivasi anonim → 401/404, kartu ACTIVE → 409)
- Validasi URL per destination type + blokir scheme berbahaya; HTTPS only

## Update 8 Sep 2026 — Google Business Verification Engine + Social Media Destination Validator
- **Engine A (Google)**: `verify_google_business()` di server.py — validasi host Google Maps →
  resolve short URL `maps.app.goo.gl` via HTTP redirect (tanpa scraping) → ekstrak Place ID dari URL
  (`place_id=`, `!1s`, `!19s`) atau Text Search by name → verifikasi via **Places API (New)**
  (`GET /v1/places/{id}`, fieldMask id/displayName/formattedAddress) → generate
  `search.google.com/local/writereview?placeid=<REAL_ID>`. Tanpa `GOOGLE_MAPS_API_KEY` → **503 error jelas,
  tidak ada fake success**. Error dibedakan: 400 invalid URL, 404 place not found, 429 quota, 502 auth/service.
  Endpoint: `POST /api/admin/businesses/verify-google` (admin; opsional `business_id` simpan+propagasi,
  atau `business_name` untuk membuat bisnis baru dengan data terverifikasi).
- **Engine B (Social)**: `validate_social_destination()` — whitelist host ketat per platform
  (Instagram/TikTok/Facebook/YouTube), validasi format profile/channel (IG username, TikTok @handle,
  FB page, YT @handle|/channel/UC…|/c/|/user/), normalisasi ke `https://www.<domain>/...`.
  Murni lokal — tanpa API eksternal. Endpoint: `POST /api/admin/businesses/validate-social`.
- **Business = single source of truth**: `google_place_id`, `google_verified`, `google_verified_at`
  ditambahkan (non-destruktif). `propagate_business_destination()` — perubahan URL bisnis
  (social/WA/google_review) otomatis terpropagasi ke kartu ACTIVE dengan destination_type terkait
  + tercatat di card_history. Redirect tetap pakai `card.destination_url` (cepat, tanpa API call saat scan).
- **Validasi diperketat**: host exact-match (menutup celah `google.evil.com`), whatsapp host whitelist,
  youtu.be ditolak (bukan channel). Social divalidasi di create/update business & aktivasi.
- **No-fake-data**: seed dibersihkan dari `ChIJDemoPlaceIdKopi`; DB produksi-preview dibersihkan
  (SC-0001 → INSTAGRAM kopidemo + history cleanup).
- **UI**: form bisnis punya section "Google Business" (tombol Verifikasi + state loading/success/error +
  Place ID & review URL) dan section "Social Media" (IG/TikTok/FB/YT/WA, validasi otomatis saat simpan).
- **Konfigurasi tersisa**: isi `GOOGLE_MAPS_API_KEY` di backend/.env (Places API (New) aktif di
  Google Cloud Console + billing) lalu restart backend. Sampai saat itu verifikasi Google mengembalikan
  503 yang jelas — fitur lain tidak terpengaruh.
- Tests: 22/22 lulus (termasuk validator per platform, redirect per destination type, propagasi
  Business→Card, penolakan fake Place ID, Google 503 tanpa key).

## Update 9 Sep 2026 — Production Readiness Audit (commit 3bbbeb0 → hardening)
- **Fix host validation Google**: regex regional lama menerima `google.evil.com`/`google.football`/
  `google.xyz`. Diganti `GOOGLE_REGIONAL_RE` — hanya `google.<ccTLD 2 huruf>` (google.de, google.io,
  google.co.id) atau `google.(com|co|net|org|ac|go|ne|or).<ccTLD>` (google.com.au). gTLD >2 huruf ditolak.
- **Fix SSRF short-URL resolution**: `follow_redirects=True` diganti follow manual per-hop
  (maks 5 hop); setiap hop divalidasi wajib HTTPS + host Google; chain panjang/non-Google ditolak 400.
- **Fix Text Search ambiguity**: hasil >1 → **409 gagal-aman** dengan daftar kandidat (nama — alamat),
  tidak lagi memilih hasil pertama secara diam-diam. Case: 1 hasil → lanjut; 0 → 404; quota → 429;
  auth → 502.
- **Fix konsistensi snapshot**: `perform_activation` kini menulis destination ke field Business yang
  sesuai (`DEST_TO_BIZ_FIELD`) sejak aktivasi → Business (source of truth) dan card.destination_url
  (runtime snapshot) konsisten.
- Audit lulus tanpa perubahan: extraction Place ID (hex CID & token short URL ditolak, selalu
  diverifikasi Places API), review URL hanya dari Place ID terverifikasi, redirect publik tanpa API call
  per scan, social validator murni lokal, propagasi hanya kartu ACTIVE dengan tipe cocok (DISABLED/
  ASSIGNED/UNASSIGNED tidak tersentuh), state `google_verified` direset saat Maps URL berubah.
- Tests: **27/27 lulus** (tambah: unit host validation, unit Place ID extraction, malicious domain API,
  propagation matrix 5 tipe + kartu DISABLED, konsistensi snapshot aktivasi).
- Real Google API test: NOT EXECUTED — `GOOGLE_MAPS_API_KEY` belum dikonfigurasi.
- **Aktivasi menjadi operator-only**: halaman `/activate` diproteksi auth (redirect ke `/admin/login`,
  kembali ke `/activate` setelah login). Endpoint pindah ke `POST /api/admin/cards/{code}/activate`
  (JWT wajib); endpoint publik lama dihapus (404).
- **Layar hasil aktivasi operator**: Kode Kartu, Bisnis, Jenis Tujuan, URL Tujuan Saat Ini,
  URL Short Card Permanen, status "QR sudah tercetak pada kartu", status "NFC siap diprogram",
  tombol prominen **Salin URL NFC** + panel NFC NTAG213 dengan instruksi penulisan via aplikasi
  NFC writer Android + test tap. Tidak ada pembuatan QR baru di flow aktivasi — generator QR
  (`/api/public/cards/{code}/qr.png|svg`) tetap tersedia untuk verifikasi/admin (pratinjau kecil opsional
  di layar sukses, download di halaman detail kartu admin).
- **QR/NFC permanen**: keduanya selalu berisi `{PUBLIC_BASE_URL}/r/{code}`; destination berubah →
  kartu fisik, QR, dan URL NFC tidak berubah (Lifetime Garansi Link). CardDetailPage admin diperbarui
  dengan instruksi NTAG213.
- Frontend dev server direstart setelah edit (bundle lama tersaji saat hot-reload parsial).

## Environment Variables (backend/.env)
- `MONGO_URL`, `DB_NAME` (pre-existing), `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
  `PUBLIC_BASE_URL` (prefix URL publik kartu), `CS_WHATSAPP` (default nomor CS; bisa dioverride via settings)
- Frontend: `REACT_APP_BACKEND_URL` (pre-existing)

## Backlog
- P0: —
- P1: analytics scan/tap (click tracking per kartu), notifikasi email/WA ke pemohon saat koreksi selesai
- P2: multi-link profile page, multi-card per bisnis UI, subscription/payment, inventory & order kartu,
  custom landing per kartu, export riwayat CSV

## Cara Menjalankan Lokal
1. `cd /app/backend && pip install -r requirements.txt && uvicorn server:app --port 8001` (atau supervisor)
2. `cd /app/frontend && yarn install && yarn start`
3. Test: `cd /app/backend && python -m pytest tests/test_core.py -v`

## Deployment ke globalconnex.id/shortcard
1. Set env produksi: `PUBLIC_BASE_URL=https://globalconnex.id/shortcard`, `CS_WHATSAPP`, `JWT_SECRET` baru, kredensial admin.
2. Build frontend (`yarn build`) & serve di bawah path `/shortcard`; proxy `/shortcard/api/*` → backend FastAPI.
3. **Penting**: proxy `/shortcard/r/*` langsung ke backend `/api/r/*` agar tap/scan redirect tanpa JS (hapus hop frontend).
4. MongoDB managed + backup; HTTPS wajib (cookie secure).
