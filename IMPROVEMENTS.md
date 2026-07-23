# PENAMBAHBAIKAN JULAI 2026

Ringkasan semua penambahbaikan yang dibuat ke atas `code.gs` dan `index.html`.

---

## Modul Baharu: Bil Bulanan (Tab 4)

### Backend (`code.gs`)
- **`BIL_TEMPLATE`** — Sheet template untuk senarai bil tetap (NAMA, KATEGORI, ANGGARAN, TETAP, LOKASI, IKON_LOKASI, IKON_KATEGORI, CYCLE_HARI, FREKUENSI, BULAN_AKTIF)
- **`BIL_REKOD`** — Sheet rekod bil 11 kolum: status bayaran, bil diterima, tarikh bayar, tarikh bil, dan catatan
- **`getBilTemplate()`** — Baca template dengan caching 6 jam
- **`initBilMonth()`** — Auto-jana rekod bil untuk bulan baharu
- **`getBilRekod()`** — Baca rekod bil ikut bulan/tahun
- **`toggolBilStatus()`** — Tandai bil dibayar/belum; bil dibayar turut dianggap telah diterima
- **`toggolBilDiterima()`** — Tandai bil sudah diterima atau belum diterima
- **`batchUpdateBil()`** — Simpan perubahan status secara pukal mengikut lokasi
- **`kemaskiniBilAmount()`** — Ubah amaun bil (untuk bil tak tetap)
- **`tandaiSemuaBilLokasi()`** — Tandai semua bil dalam satu lokasi
- **`getBilSummary()`** — Summary dengan pecahan lokasi, jumlah dibayar, diterima belum bayar, dan belum dibayar
- **`getBilYearlyData()`** — Data tahunan bil (untuk chart)

### Backend/Frontend Energy Pukal
- **`addBulkEVRecords()`** — Tambah rekod campuran Cas Rumah, Cas Luar, dan Minyak dalam satu batch
- **Modal EV Pukal** — Tarikh setiap baris berasingan dengan validasi ikut jenis rekod
- **EV/Minyak** kini boleh direkod secara campur dalam satu operasi simpan

### Frontend (`index.html`)
- Tab ke-4 di nav bar — ikon checklist, warna purple
- **Progress Card** — Hero card dengan progress bar serta amaun Dibayar, Diterima, dan Belum
- **Kad Peringatan** — Bezakan Bil Diterima Belum Bayar dan Belum Terima Bil
- **Grid 2 Kolum** — Lokasi disusun dalam 2 kolum (mobile: 1)
- **Collapse/Expand** — Klik header lokasi untuk buka/tutup
- **Auto-collapse** — Kalau semua bil di lokasi dah dibayar
- **Auto-expand** — Kalau ada bil belum dibayar
- **Bil Ada** — Toggle berasingan untuk tanda bil sudah diterima tanpa menandakan bayaran
- **Pending Changes** — Toggle Bil Ada, bayaran, dan Tandai Semua tidak terus menulis ke Sheet
- **Simpan per Lokasi** — Butang Simpan menghantar semua pending changes lokasi dalam satu batch
- **Batal per Lokasi** — Batalkan pending changes sebelum disimpan
- **Tandai Semua** — Queue semua bil lokasi sebagai dibayar, kemudian simpan secara batch
- **Visual Pending** — Border/baris amber menunjukkan perubahan belum disimpan
- **Ikon Lokasi** — Dari kolum IKON_LOKASI di template
- **Ikon Kategori** — Dari kolum IKON_KATEGORI di template
- **Default ke bulan semasa** — Bila buka tab Bil, auto ke bulan/tahun semasa

---

## Modul Baharu: Solar Tracker (Tab 5)

### Backend (`code.gs`)
- **`SOLAR`** — Sheet rekod penjanaan solar bulanan
- **`getSolarData()`** — Baca rekod solar ikut bulan/tahun dengan caching TTL 2 jam
- **`addSolarRecord()`** — Tambah rekod + auto-kira Baki, Jumlah Baki, Luar Grid
- **`updateSolarRecord()`** — Kemaskini + auto-kira semula
- **`deleteSolarRecord()`** — Padam rekod
- **`getSolarYearlyData()`** — Data 12 bulan untuk chart (jana, guna, baki, kumulatif, luar grid) dengan caching
- **`getSolarBatch()`** — Gabungan data + yearly
- **`invalidateSolarCache()`** — Hapus semua cache Solar (dipanggil bila CRUD)

### Frontend (`index.html`)
- Tab ke-5 di nav bar — ikon matahari, warna amber
- **Grid Stats 4×2** — Jana TNB, Guna TNB, Jana Apps, Luar Grid | Baki, Jml Baki, +Rekod Baru
- **2 Carta** — Bar stacked (Jana vs Guna vs Luar Grid) + Line (Baki kumulatif)
- **Jadual Bulanan** — 12 baris dengan edit/delete per bulan
- **Form Modal** — Input 3 medan (Jana TNB, Guna TNB, Jana Apps) + auto-kira Baki & Luar Grid (read-only)
- **Edit instant** — Data disimpan client-side, cari terus tanpa API call
- **Default bulan semasa** — Bila buka tab Solar, auto ke bulan/tahun semasa
- **Kad Ringkasan** — 3 line (⚡ Jana / 🏠 Guna / 📊 Baki) dalam kad gradient amber di Ringkasan

---

## Ringkasan — Bil Diasingkan

- Bil **tidak** termasuk dalam Jumlah Keseluruhan, Pie Chart, Bar Chart
- Bil dipapar sebagai **section berasingan** di bawah jadual bulanan
- Kad Bil Ringkasan diseragamkan dengan modul Bil: progress bar dan amaun Dibayar, Diterima, Belum
- Solar dipapar sebagai kad ke-4 dalam grid Ringkasan (berasingan dari 3 kad utama)

---

## Kard Gradient Ringkasan

- 4 kad utama di Ringkasan kini guna **gradient background** ikut tema: emerald (Belanja), blue (EV), orange (Minyak), amber (Solar)
- Kad Bil di bawah jadual juga guna gradient purple
- Teks putih, icon `bg-white/20`, progress bar `bg-white/20`
- Accent-border-top dibuang — tak relevan pada kad gradient
- Dark mode: gradient kekal menyerlah

---

## Dark Mode

- Toggle 🌙/☀️ di pojok kanan atas (kecil: `top-2 right-2 p-1.5`)
- Preference disimpan di `localStorage`
- Palet warna gelap: `#0b1120` background, `#111827` cards
- CSS overrides untuk semua background, text, border, input, select, shadow
- Card berwarna guna opacity tinted
- Nav bar dengan glass effect `backdrop-filter: blur`
- Active nav tab dengan glow ikut warna modul
- Hero gradient card dengan indigo glow shadow
- Butang gradient dengan hover glow shadow

---

## Nav Hover Effects

- 5 butang nav — setiap satu ada `:hover` state ikut warna tema
- Light mode: background pastel + teks ikut tema
- Dark mode: background `rgba(theme, 0.12)` + teks glow
- Tidak ganggu `nav-active` state sedia ada

---

## UI Polish

- **Gradient Buttons** — Semua butang utama guna gradient: emerald, slate, blue, orange, amber
- **Card Shadows** — `shadow-card` 2-layer shadow dengan hover elevate
- **Background** — Light mode: `#f1f5f9` (lebih cerah dan segar)
- **Loader** — Spinner + teks "Memuat sistem"
- **Toggle Dark Mode** — Lebih kecil & tinggi, tak bertindih content

---

## Carian

- **Belanja** — Input carian sebaris di header. Cakupan: kategori, nota, amaun, bayaran
- **EV Cas** — Input carian sebaris di header. Cakupan: CPO, stesen, lokasi, nota, amaun
- Debounce 300ms, butang ✕ untuk clear
- Berfungsi bersama filter kategori, payment, tarikh yang sedia ada

---

## Eksport CSV

- Butang 📥 di kiri tajuk setiap header (5 modul)
- **Belanja** — Eksport tarikh, kategori, amaun, nota, bayaran
- **EV Cas** — Eksport tarikh, jenis, CPO/stesen, kWh/liter, RM, lokasi
- **Bil** — Eksport lokasi, nama, kategori, amaun, status, bil diterima, tarikh bayar, dan tarikh bil
- **Solar** — Eksport tahun, bulan, jana TNB, guna TNB, jana apps, luar grid, baki, jumlah baki
- BOM UTF-8 — terus buka di Excel tanpa masalah aksara Melayu
- Ikut filter + carian semasa. Solar guna async fetch.

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
- **Solar**: Jana TNB ≥ 0, Guna TNB ≥ 0, Jana Apps ≥ 0; nilai sifar dibenarkan
- Instant feedback tanpa tunggu API call

---

## Bug Fixes

- Fix duplicate `</select>` tags di header Belanja & EV
- Fix `filteredTransactions` stale data selepas tukar bulan/tahun
- Fix `noSpendDays` — kini tunjuk kiraan hari tanpa belanja yang betul (per tahun)
- Fix bil filter month default ke bulan semasa
- Fix solar filter month default ke bulan semasa
- Fix icon edit di EV Cas disamakan dengan Belanja
- Fix category hover background (tak putih lagi, guna opacity)
- Fix `toggolBilStatus` — tarikh bayar auto-set bila ditanda
- Fix `openSolarModal` — cari client-side, elak 1-2 saat sela
- Fix `getSolarData` filter — handle null month/year dengan betul
- Fix `initCategoryFilter` — sentiasa aktifkan semua kategori, elak jadual kosong
- Fix exportCSV Solar — tambah loader + error handler
- Fix kad Solar di Ringkasan — tambah error handler
- Fix `jumlahKeseluruhan` bil — kini benar-benar jumlah dibayar + belum
- Fix validasi Solar — nilai `0` tidak lagi dianggap input kosong
- Fix `JUMLAH_BAKI` Solar — dikira semula untuk semua rekod selepas tambah, edit, atau padam
- Fix output dinamik — kategori, ikon, payment, filter EV, dan lokasi bil di-escape sebelum masuk `innerHTML`

---

## `code.gs` — Penambahbaikan Lain

- **CacheService** — Cache untuk semua modul: kategori, CPO, data tahunan, template bil, solar data, solar yearly
- **Cache 2026-2031** — Invalidation cache tahunan diselaraskan kepada julat data aplikasi
- **Invalidation cache** — Setiap modul mempunyai fungsi invalidation sendiri
- **`getBatchSummaryData()`** — Dioptimumkan untuk baca semua data dalam satu panggilan
- **Sanitize** — Semua input di-trim & dihadkan panjang di server; dan di-escape (`escapeHtml`) di client sebelum dipapar ke DOM untuk elak XSS
- **Input validation** — Semua fungsi CRUD validate input sebelum simpan
- **Sheet helpers** — `getRequiredSheet()` memberi mesej jelas jika sheet wajib tidak wujud; `getOptionalSheet()` digunakan untuk bacaan yang boleh pulangkan data kosong
