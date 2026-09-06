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
- Public: `GET /api/public/config`, `GET /api/public/cards/{code}`, `POST /api/public/cards/{code}/activate`,
  `POST /api/public/corrections`, `GET /api/public/cards/{code}/qr.png|qr.svg`
- Redirect: `GET /api/r/{code}` → 302 ke destination / halaman error HTML informatif
- Admin: `GET /api/admin/stats`, CRUD `/api/admin/cards` (+`/{code}`, `/disable`, `/enable`),
  CRUD `/api/admin/businesses`, `GET/PATCH /api/admin/corrections(/{id})`,
  `GET /api/admin/history`, `GET/PATCH /api/admin/settings`

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
- 9 integration tests (`/app/backend/tests/test_core.py`) — semua lulus, termasuk concurrency 10 request
- Validasi URL per destination type + blokir scheme berbahaya; HTTPS only

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
