# Jejak Belanja

Aplikasi web untuk menguruskan perbelanjaan harian, menjejaki kos kenderaan elektrik (EV), mengurus bil bulanan, dan memantau prestasi solar. Dibina menggunakan Google Apps Script dengan Google Sheets sebagai pangkalan data.

## Ciri-ciri

- **Ringkasan Bulanan** — Pandangan keseluruhan belanja, EV cas, dan minyak dengan perbandingan bulan lepas, pie chart, bar chart, dan jadual bulanan. Kad gradient ikut tema modul.
- **Belanja Harian** — Rekod perbelanjaan dengan kategori, carta kategori interaktif (expand + trend 3 bulan), carta pembayaran (boleh tapis), trend tahunan, dan carian
- **EV Cas Tracker** — Rekod cas EV (rumah/luar) dan isi minyak dengan pecahan CPO/stesen, 3 carta interaktif (tapis data guna klik carta), dan carian
- **Bil Bulanan** — Senarai bil auto-jana dengan status Belum Terima, Bil Diterima, dan Dibayar; perubahan status disimpan secara pukal mengikut lokasi
- **Solar Tracker** — Rekod penjanaan solar bulanan (Jana TNB, Guna TNB, Jana Apps), auto-kira baki & luar grid, bar chart stacked + line chart kumulatif, ringkasan di Ringkasan
- **Rekod Pukal** — Tambah multiple entries sekaligus di modul Belanja
- **Carta Interaktif** — Klik carta untuk menapis data
- **Eksport CSV** — Eksport data dari setiap modul (Belanja / EV+Minyak / Bil / Solar)
- **Carian** — Cari transaksi merentasi kategori, nota, amaun di Belanja & EV
- **Pagination** — 25 rekod per halaman di Belanja & EV
- **Dark Mode** — Toggle light/dark dengan localStorage. Kad gradient, nav hover, dan semua elemen disesuaikan untuk kedua-dua mod.
- **Nav Hover** — Butang nav bertukar warna ikut tema modul bila mouse hover
- **Responsif** — Sesuai untuk desktop dan mobile

## Prasyarat

- Akaun Google
- Google Drive

## Cara Install

### Langkah 1: Buat Google Sheet Baru

1. Pergi ke [Google Sheets](https://sheets.google.com)
2. Klik **Blank** untuk buat spreadsheet baru
3. Namakan spreadsheet (contoh: "Jejak Belanja Data")

### Langkah 2: Buat Tab Sheets

Buat 8 sheet tabs dengan nama berikut (case-sensitive):

| Nama Tab | Kegunaan |
|----------|----------|
| `DATA` | Rekod belanja harian |
| `KATEGORI` | Senarai kategori belanja |
| `EV_CHARGING` | Rekod cas EV |
| `JENIS_CPO` | Senarai CPO/stesen cas |
| `MINYAK` | Rekod isi minyak |
| `BIL_TEMPLATE` | Senarai bil tetap (template) |
| `BIL_REKOD` | Rekod bil diterima, status bayaran, tarikh, amaun, dan catatan |
| `SOLAR` | Rekod penjanaan solar bulanan |

### Langkah 3: Tambah Header & Data Awal

**Tab DATA** — Header di baris pertama:
```
Tarikh | Amaun | Kategori | Nota | Bayaran
```

**Tab KATEGORI** — Header di baris pertama, kemudian isi kategori:
```
Nama | Ikon
-----|-----
Makanan | 🍽️
Minuman | 🥤
Pengangkutan | 🚗
Hiburan | 🎮
Utiliti | 💡
Lain-lain | 📦
```

**Tab EV_CHARGING** — Header di baris pertama:
```
Tarikh | Jenis | CPO | kWh | Harga/kWh | Lokasi | Jumlah
```

**Tab JENIS_CPO** — Header di baris pertama, kemudian isi senarai CPO:
```
Nama
-----
TNB
Gentari
ChargEV
Shell Recharge
Petronas
JomCas
```

**Tab MINYAK** — Header di baris pertama:
```
Tarikh | Stesen | Liter | Harga/Liter | Jumlah | Nota
```

**Tab BIL_TEMPLATE** — Header di baris pertama, kemudian isi senarai bil:
```
NAMA | KATEGORI | ANGGARAN | TETAP | LOKASI | IKON_LOKASI | IKON_KATEGORI
-----|----------|----------|-------|--------|-------------|--------------
Bil TNB | Kos Elektrik | 150.00 | Tidak | Muar | 🏠 | ⚡
Bil Air | Kos Rumah | 25.00 | Tidak | Muar | | 💧
Bil Internet | Komunikasi & Topup | 118.90 | Ya | TTI | 🏢 | 🌐
Astro | Hiburan | 109.16 | Ya | Muar | | 📺
```
> `TETAP` = "Ya" jika amaun sentiasa sama setiap bulan. `IKON_LOKASI` cukup isi pada baris pertama setiap lokasi.

**Tab BIL_REKOD** — Header di baris pertama (baris kosong, akan auto-dijana):
```
TAHUN | BULAN | LOKASI | NAMA | KATEGORI | AMAUN | STATUS | TARIKH_BAYAR | BIL_DITERIMA | TARIKH_BIL | CATATAN
```

> `STATUS` menyimpan `Belum` atau `Dibayar`. `BIL_DITERIMA` menyimpan `Tidak` atau `Ya`. Apabila bil ditanda dibayar, sistem turut menandakan bil sebagai diterima. `TARIKH_BAYAR` dan `TARIKH_BIL` diisi secara automatik.

**Tab SOLAR** — Header di baris pertama:
```
TAHUN | BULAN | JANA_TNB | GUNA_TNB | BAKI | JUMLAH_BAKI | JANA_APPS | GUNA_LUAR_GRID
```
> `BAKI`, `JUMLAH_BAKI`, dan `GUNA_LUAR_GRID` dikira secara automatik. Kamu cuma isi `TAHUN`, `BULAN`, `JANA_TNB`, `GUNA_TNB`, dan `JANA_APPS`.

### Langkah 4: Tambah Apps Script

1. Dalam spreadsheet, pergi ke **Extensions → Apps Script**
2. Padam semua kod default dalam `Code.gs`
3. Copy keseluruhan kandungan `code.gs` dari repo ini dan paste
4. Klik **File → New → HTML** dan namakan `index`
5. Copy keseluruhan kandungan `index.html` dari repo ini dan paste
6. Klik **Save** (ikon disket)

### Langkah 5: Deploy sebagai Web App

1. Klik **Deploy → New deployment**
2. Klik ikon gear dan pilih **Web app**
3. Isi maklumat:
   - **Description**: Jejak Belanja
   - **Execute as**: Me
   - **Who has access**: Anyone (atau pilih sesuai keperluan)
4. Klik **Deploy**
5. Klik **Authorize access** dan ikut proses authorization
6. Copy URL yang diberikan

### Langkah 6: Akses Aplikasi

Buka URL yang dicopy di browser. Aplikasi sedia diguna.

## Struktur Fail

```
jejak-belanja/
├── code.gs         # Server-side logic (Google Apps Script)
├── index.html      # Frontend UI + client-side JavaScript
├── AGENTS.md       # Business rules dan arahan pelaksanaan
├── README.md       # Dokumentasi
├── IMPROVEMENTS.md # Changelog penambahbaikan
├── PELAKSANAAN_CACHE.md # Rujukan pelaksanaan cache
└── Old Version/    # Versi lama (arkib)
```

## Teknologi

- **Frontend**: HTML, Tailwind CSS, Chart.js
- **Backend**: Google Apps Script
- **Database**: Google Sheets
- **Caching**: Google Apps Script CacheService untuk semua modul + localStorage

## Harga Default

- Cas EV Rumah: RM 0.4443/kWh
- Minyak: RM 1.99/liter

Harga ini boleh diubah dalam kod mengikut kadar semasa.

## Business Rules

- Jumlah besar Ringkasan hanya merangkumi Belanja Harian, EV Cas, dan Minyak.
- Bil Bulanan dipaparkan sebagai modul/kad berasingan dan tidak dimasukkan dalam jumlah besar.
- Data/cache aplikasi disasarkan untuk tahun 2026 hingga 2031.
- Nilai solar `Jana TNB`, `Guna TNB`, dan `Jana Apps` boleh bernilai `0` jika bacaan bulan tersebut memang sifar.
- Status bil diterima adalah berasingan daripada status bayaran. Bil boleh diterima tetapi masih belum dibayar.
- Menandakan bil sebagai dibayar turut menandakan `BIL_DITERIMA` sebagai `Ya`.

## Aliran Bil Bulanan

1. Tekan `Bil Ada` apabila bil sudah diterima tetapi belum dibayar.
2. Tick checkbox bayaran apabila bil sudah dibayar. Bil tersebut turut dianggap sudah diterima.
3. Perubahan `Bil Ada`, checkbox bayaran, dan `Semua` hanya menjadi pending pada browser.
4. Kad lokasi yang mempunyai pending changes ditanda amber dan memaparkan butang `Simpan` serta `Batal`.
5. Tekan `Simpan` untuk menyimpan semua pending changes bagi lokasi tersebut sekali gus.
6. Tekan `Batal` sebelum simpan untuk membuang semua pending changes bagi lokasi tersebut.
7. Jika kesilapan hanya disedari selepas simpan, ubah semula status yang salah dan tekan `Simpan` sekali lagi.

Perubahan amaun bil tidak menggunakan pending batch. Amaun disimpan terus apabila nilai input diubah; jika tersalah, masukkan amaun yang betul semula.

## Customization

### Tukar Kategori Belanja

Edit senarai dalam tab `KATEGORI` di Google Sheet (Nama + Ikon). Perubahan akan automatik reflect dalam dropdown.

### Tukar Senarai CPO

Edit senarai dalam tab `JENIS_CPO` di Google Sheet.

### Tukar Senarai Bil

Edit senarai dalam tab `BIL_TEMPLATE` di Google Sheet. Setiap bulan baru, app akan auto-jana checklist dari template.

### Tukar Harga Default

Dalam `index.html`, cari dan ubah nilai:
- `value="0.4443"` untuk harga cas rumah
- `value="1.99"` untuk harga minyak

## Limitasi

- Memerlukan sambungan internet
- Tailwind CSS, Chart.js, dan Google Fonts masih dimuatkan melalui CDN; paparan atau carta boleh terjejas jika CDN disekat oleh rangkaian/telco
- Data disimpan dalam Google Sheet akaun sendiri
- Tidak boleh deploy sebagai GitHub Pages (kerana bergantung kepada Google Apps Script)
- Maksimum 50MB data (limitasi Google Apps Script)

## Lisensi

MIT License — Bebas diguna dan diubahsuai.

## Penulis

Dibuat untuk kegunaan peribadi tracking perbelanjaan, kos kenderaan EV, bil bulanan, dan prestasi solar.
