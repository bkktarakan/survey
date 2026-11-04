# Survey Penilaian Kepuasan & Pemilihan Petugas Pelayanan Terbaik BKK Kelas I Tarakan 2026

Aplikasi web penilaian kepuasan pengguna layanan dan pemilihan petugas pelayanan terbaik **Balai Kekarantinaan Kesehatan (BKK) Kelas I Tarakan Tahun 2026**.

## Fitur Utama
- **Form Penilaian Terintegrasi (Bagian A, B, C):** Pilihan petugas berdasarkan Wilayah Kerja lengkap dengan kartu foto visual dan penilaian 5 komponen pelayanan.
- **Anti-Spam / Validasi Penilaian Harian:** Mencegah duplikasi penilaian dari nama/perusahaan atau nomor HP/WhatsApp yang sama terhadap petugas yang sama di hari yang sama.
- **Dashboard Admin & Klasemen Real-time:**
  - Filter per Wilayah Kerja & Ambang Batas Minimum Penilai (*Minimum Quota*).
  - Grafik Visual Indeks 5 Komponen Pelayanan & Juara #1 per Wilayah Kerja.
  - Kelola Data Pegawai (Input manual, Upload Foto, & Import Massal CSV).
  - Generator QR Code & Cetak Poster QR per Wilayah Kerja (`?wilker=...`).
  - Cetak Berita Acara Resmi / Laporan PDF ber-Kop Surat BKK Kelas I Tarakan.
  - Export Rekapitulasi CSV & Integrasi Google Sheets (Apps Script).

## Cara Menjalankan Aplikasi

### 1. Menggunakan Node.js + Database MySQL
1. Pastikan **MySQL / MariaDB (XAMPP)** aktif.
2. Impor skema database dari `database.sql` (atau jalankan `node server.js` yang akan otomatis membuat database `bkk_tarakan_2026` beserta tabel dan data awal).
3. Atur variabel lingkungan (*environment variables*) bila diperlukan:
   - `PORT` (default: `8080`)
   - `DB_HOST` (default: `127.0.0.1`)
   - `DB_PORT` (default: `3306`)
   - `DB_USER` (default: `root`)
   - `DB_PASSWORD` (default: kosong)
   - `DB_NAME` (default: `bkk_tarakan_2026`)
4. Jalankan server:
   ```bash
   node server.js
   ```
5. Buka `http://localhost:8080` di browser.

### 2. Menggunakan Static Hosting (GitHub Pages / Netlify / Vercel) + Google Sheets
- File `index.html` dapat langsung di-host di **GitHub Pages** dan tetap berjalan menggunakan *fallback* penyimpanan lokal + sinkronisasi **Google Apps Script (`google-apps-script.js`)** ke Google Sheets.
