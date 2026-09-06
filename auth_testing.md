# Auth Testing Playbook (Short Card)

Step 1: MongoDB verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`; unique index on users.email; unique index on cards.code.

Step 2: API testing
```
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"satriaayudha19@gmail.com","password":"SCg#2026!xQ7mP4wZk"}'
curl -b cookies.txt http://localhost:8001/api/auth/me
curl -b cookies.txt http://localhost:8001/api/admin/stats
```
Login returns admin user + sets access_token & refresh_token cookies. /me returns same user.

Step 3: Redirect testing
```
curl -sI http://localhost:8001/api/r/SC-0001   # expect 302 to Google Review URL
curl -s  http://localhost:8001/api/r/SC-9999   # HTML "Kartu Tidak Ditemukan"
curl -s  http://localhost:8001/api/r/SC-0006   # HTML "Kartu Tidak Aktif"
curl -s  http://localhost:8001/api/r/SC-0004   # HTML "Link Belum Dikonfigurasi"
```
