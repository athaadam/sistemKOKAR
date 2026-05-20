# SIKOKAR New (v1.5)

Konversi dari Flask/Docker ke **Node.js Express + Knex + MySQL** (backend) dan **Next.js** (frontend).

## Struktur

```
sikokar_New/
├── be-sikokar/     # API Express + Knex + MySQL
└── fe-sikokar/     # Frontend Next.js 14
```

## Prasyarat

- Node.js 18+
- MySQL 8+ (atau MariaDB)

## Setup Database

```sql
CREATE DATABASE sikokar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Backend (`be-sikokar`)

```powershell
cd be-sikokar
copy .env.example .env
# Edit .env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME

npm install
npx knex migrate:latest
npx knex seed:run
npm start
```

API berjalan di `http://localhost:3001/api` (proxy dari FE lewat `/api`)

Login demo (setelah seed):

| Username | Password |
|----------|----------|
| admin | admin123 |
| kasir1 | kasir123 |
| simpin | simpin123 |

## Frontend (`fe-sikokar`)

```powershell
cd fe-sikokar
copy .env.local.example .env.local
npm install lucide-react
npm install
npm run dev
```

Buka `http://localhost:3000`

Next.js mem-proxy `/api/*` ke backend (lihat `next.config.js`).

## Fitur

Semua modul dari SIKOKAR v1.5 Flask:

- Dashboard, Anggota, Barang, Supplier, COA
- Toko/POS (checkout, shift, hold, void, struk)
- Pembelian, Simpanan (trx, setor massal, jasa)
- Pinjaman (kolektif, slip, topup, restrukturisasi)
- Kredit barang, PPOB, Rental (+ maintenance, dokumen, biaya)
- Labor, Kwitansi, Usaha lain, Promo
- Pembukuan (jurnal, neraca, laba rugi, SHU, ledger, trial balance, arus kas, CALK, tutup periode)
- Aset tetap, Laporan, Konsolidasi, Setting, Audit log

## Catatan

- Tidak menggunakan Docker maupun Python.
- Session disimpan di MySQL (`sessions` table, auto-create).
- Upload logo: `POST /api/setting/params/save` dengan `logo_file`.
- Backup DB: `GET /api/setting/backup` atau `backup_now`.
