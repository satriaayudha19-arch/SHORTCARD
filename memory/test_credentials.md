# Test Credentials

## Admin (platform administrator)
- Email: satriaayudha19@gmail.com
- Password: SCg#2026!xQ7mP4wZk
- Role: admin
- Sourced from backend/.env (ADMIN_EMAIL / ADMIN_PASSWORD), seeded at backend startup.

## Auth endpoints
- POST /api/auth/login  {email, password} → sets httpOnly cookies (access_token, refresh_token)
- POST /api/auth/logout
- GET  /api/auth/me
- POST /api/auth/refresh

## Demo data (seeded)
- Business: Kopi Demo, Barber Demo
- Cards: SC-0001 (ACTIVE, Google Review), SC-0002 (ACTIVE, Instagram), SC-0003 (ASSIGNED),
  SC-0004 (UNASSIGNED), SC-0005 (UNASSIGNED), SC-0006 (DISABLED)
- Correction request: 1 PENDING for SC-0002
- Public redirect: /api/r/SC-0001 → 302 to Google Review URL
- Pretty public URL: /r/SC-0001 (frontend bounce) — QR encodes {PUBLIC_BASE_URL}/r/{code}

## Customer Service (placeholder, configurable via /admin/settings or env CS_WHATSAPP)
- WA: 6281234567890
