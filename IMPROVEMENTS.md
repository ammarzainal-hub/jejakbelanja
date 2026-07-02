# PENAMBAHBAIKAN JULAI 2026

Ringkasan semua penambahbaikan yang dibuat ke atas `code.gs` dan `index.html`.

---

## Modul Baharu: Bil Bulanan (Tab 4)

### Backend (`code.gs`)
- **`BIL_TEMPLATE`** — Sheet template untuk senarai bil tetap (NAMA, KATEGORI, ANGGARAN, TETAP, LOKASI, IKON_LOKASI, IKON_KATEGORI)
- **`BIL_REKOD`** — Sheet rekod bayaran bulanan (auto-dijana dari template)
- **`getBilTemplate()`** — Baca template dengan caching 6 jam
- **`initBilMonth()`** — Auto-jana rekod bil untuk bulan baharu
- **`getBilRekod()`** — Baca rekod bil ikut bulan/tahun
- **`toggolBilStatus()`** — Tandai bil dibayar/belum
- **`kemaskiniBilAmount()`** — Ubah amaun bil (untuk bil tak tetap)
- **`tandaiSemuaBilLokasi()`** — Tandai semua bil dalam satu lokasi
- **`getBilSummary()`** — Summary dengan pecahan lokasi, jumlah dibayar/belum
- **`getBilYearlyData()`** — Data tahunan bil (untuk chart)

### Frontend (`index.html`)
- Tab ke-4 di nav bar — ikon checklist, warna purple
- **Progress Card** — Hero card dengan progress bar, jumlah dibayar vs belum
- **Kad Peringatan** — Amber warning card, senarai bil belum bayar ikut lokasi
- **Grid 2 Kolum** — Lokasi disusun dalam 2 kolum (mobile: 1)
- **Collapse/Expand** — Klik header lokasi untuk buka/tutup
- **Auto-collapse** — Kalau semua bil di lokasi dah dibayar
- **Auto-expand** — Kalau ada bil belum dibayar
- **Tandai Semua** — Butang di header lokasi untuk tick semua sekali
- **Ikon Lokasi** — Dari kolum IKON_LOKASI di template
- **Ikon Kategori** — Dari kolum IKON_KATEGORI di template
- **Default ke bulan semasa** — Bila buka tab Bil, auto ke bulan/tahun semasa

---

## Ringkasan — Bil Diasingkan

- Bil **tidak** termasuk dalam Jumlah Keseluruhan, Pie Chart, Bar Chart
- Bil dipapar sebagai **section berasingan** di bawah jadual bulanan
- Kad Bil tunjuk status "4/7 Dibayar" dengan progress bar

---

## Dark Mode

- Toggle 🌙/☀️ di pojok kanan atas
- Preference disimpan di `localStorage`
- Palet warna gelap: `#0b1120` background, `#111827` cards
- CSS overrides untuk semua background, text, border, input, select, shadow
- Card berwarna (emerald/blue/orange/indigo/purple) guna opacity tinted
- Nav bar dengan glass effect `backdrop-filter: blur`
- Active nav tab dengan glow ikut warna modul
- Hero gradient card dengan indigo glow shadow
- Butang gradient dengan hover glow shadow

---

## UI Polish

- **Gradient Buttons** — Semua butang utama guna gradient: emerald, slate, blue, orange
- **Card Shadows** — `shadow-card` 2-layer shadow dengan hover elevate
- **Accent Borders** — 3px gradient top border pada setiap summary card
- **Background** — Light mode: `#f1f5f9` (lebih cerah dan segar)

---

## Carian

- **Belanja** — Input carian sebaris di header. Cakupan: kategori, nota, amaun, bayaran
- **EV Cas** — Input carian sebaris di header. Cakupan: CPO, stesen, lokasi, nota, amaun
- Debounce 300ms, butang ✕ untuk clear
- Berfungsi bersama filter kategori, payment, tarikh yang sedia ada

---

## Eksport CSV

- Butang 📥 di kiri tajuk setiap header
- **Belanja** — Eksport tarikh, kategori, amaun, nota, bayaran
- **EV Cas** — Eksport tarikh, jenis, CPO/stesen, kWh/liter, RM, lokasi
- **Bil** — Eksport lokasi, nama, kategori, amaun, status, tarikh bayar
- BOM UTF-8 — terus buka di Excel tanpa masalah aksara Melayu
- Ikut filter + carian semasa

---

## Pagination

- Belanja & EV: 25 rekod per halaman
- Controls: Awal / ← / Hal X / → / Akhir
- Auto hidden kalau rekod ≤ 25
- Reset ke page 1 bila filter/sort berubah

---

## Client-side Validation

- **Belanja**: amaun > 0, kategori dipilih, tarikh tak boleh masa depan
- **EV Cas**: kWh > 0, harga/kWh > 0, CPO dipilih (untuk Luar)
- **Minyak**: liter > 0, stesen dipilih
- Instant feedback tanpa tunggu API call

---

## Bug Fixes

- Fix duplicate `</select>` tags di header Belanja & EV
- Fix `filteredTransactions` stale data selepas tukar bulan/tahun
- Fix `noSpendDays` — kini tunjuk kiraan hari tanpa belanja yang betul (per tahun)
- Fix bil filter month default ke bulan semasa
- Fix icon edit di EV Cas disamakan dengan Belanja
- Fix category hover background (tak putih lagi, guna opacity)
- Fix `toggolBilStatus` — tarikh bayar auto-set bila ditanda

---

## `code.gs` — Penambahbaikan Lain

- **CacheService** — Cache untuk kategori, CPO, data tahunan, template bil
- **`invalidateCache()`** — Fungsi untuk invalidate cache bila data berubah
- **`getBatchSummaryData()`** — Dioptimumkan untuk baca semua data dalam satu panggilan
- **Sanitize** — Semua input di-escape untuk elak XSS
- **Input validation** — Semua fungsi CRUD validate input sebelum simpan
