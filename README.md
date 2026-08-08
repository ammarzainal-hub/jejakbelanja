# Jejak Belanja

Aplikasi web untuk menguruskan perbelanjaan harian, menjejaki kos kenderaan elektrik (EV), mengurus bil bulanan, dan memantau prestasi solar. Dibina menggunakan Google Apps Script dengan Google Sheets sebagai pangkalan data.

## Ciri-ciri

- **Ringkasan Bulanan** — Pandangan sistem kewangan yang memaparkan modul Belanja, EV Cas, Minyak, Bil, dan Solar. Jumlah besar hanya mengira Belanja Harian, EV Cas, dan Minyak; Bil Bulanan dan Solar dipaparkan sebagai maklumat berasingan.
- **Belanja Harian** — Rekod perbelanjaan dengan kategori, carta kategori interaktif (expand + trend 3 bulan), carta pembayaran (boleh tapis), trend tahunan, dan carian
- **EV Cas Tracker** — Rekod cas EV (rumah/luar) dan isi minyak dengan pecahan CPO/stesen, 3 carta interaktif (tapis data guna klik carta), dan carian
- **Bil Bulanan** — Senarai bil auto-jana dengan status Belum Terima, Bil Diterima, dan Dibayar; perubahan status disimpan secara pukal mengikut lokasi; template sokong `CYCLE_HARI`, `FREKUENSI`, `BULAN_AKTIF`, dan `CATATAN` tetap
- **Solar Tracker** — Rekod penjanaan solar bulanan (Jana TNB, Guna TNB, Jana Apps), auto-kira baki & luar grid, bar chart stacked + line chart kumulatif, edit bulan/tahun rekod sedia ada, ringkasan di Ringkasan
- **Rekod Pukal** — Tambah multiple entries sekaligus di modul Belanja dan EV/Minyak, maksimum 50 rekod sekali simpan
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
RECORD_ID | Tarikh | Amaun | Kategori | Nota | Bayaran
```
> `RECORD_ID` dijana automatik oleh Apps Script. Jangan isi manual untuk rekod baharu.

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
RECORD_ID | Tarikh | Jenis | CPO | kWh | Harga/kWh | Lokasi | Jumlah
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
RECORD_ID | Tarikh | Stesen | Liter | Harga/Liter | Jumlah | Nota
```

**Tab BIL_TEMPLATE** — Header di baris pertama, kemudian isi senarai bil:
```
NAMA | KATEGORI | ANGGARAN | TETAP | LOKASI | IKON_LOKASI | IKON_KATEGORI | CYCLE_HARI | FREKUENSI | BULAN_AKTIF | CATATAN
-----|----------|----------|-------|--------|-------------|--------------|------------|-----------|-------------|--------
Bil TNB | Kos Elektrik | 150.00 | Tidak | Muar | 🏠 | ⚡ | 0 | Bulanan | | No Akaun: 123456
Bil Air | Kos Rumah | 25.00 | Tidak | Muar | | 💧 | 0 | Bulanan | | No Akaun Air: A9988
Bil Internet | Komunikasi & Topup | 118.90 | Ya | TTI | 🏢 | 🌐 | 0 | Tahunan | 7 | Akaun: TTI-8899
Astro | Hiburan | 109.16 | Ya | Muar | | 📺 | 0 | Tahunan | 1 | No Akaun: 776655
```
> `TETAP` = "Ya" jika amaun sentiasa sama setiap bulan. `IKON_LOKASI` cukup isi pada baris pertama setiap lokasi.
> `FREKUENSI` boleh guna `Bulanan` atau `Tahunan`. `BULAN_AKTIF` hanya diisi untuk bil tahunan.
> `CATATAN` ialah rujukan tetap bagi gabungan `LOKASI + NAMA`, contohnya nombor akaun bil. Catatan dipaparkan setiap bulan dan disalin ke rekod baharu semasa auto-jana bil.

**Tab BIL_REKOD** — Header di baris pertama (baris kosong, akan auto-dijana):
```
TAHUN | BULAN | LOKASI | NAMA | KATEGORI | AMAUN | STATUS | TARIKH_BAYAR | BIL_DITERIMA | TARIKH_BIL | CATATAN
```

> `STATUS` menyimpan `Belum` atau `Dibayar`. `BIL_DITERIMA` menyimpan `Tidak` atau `Ya`. Apabila bil ditanda dibayar, sistem turut menandakan bil sebagai diterima. `TARIKH_BAYAR` dan `TARIKH_BIL` diisi secara automatik. `CATATAN` disalin daripada `BIL_TEMPLATE` semasa rekod baharu dijana.

**Tab SOLAR** — Header di baris pertama:
```
RECORD_ID | TAHUN | BULAN | JANA_TNB | GUNA_TNB | BAKI | JUMLAH_BAKI | JANA_APPS | GUNA_LUAR_GRID
```
> `BAKI`, `JUMLAH_BAKI`, dan `GUNA_LUAR_GRID` dikira secara automatik. Kamu cuma isi `TAHUN`, `BULAN`, `JANA_TNB`, `GUNA_TNB`, dan `JANA_APPS`.

### Langkah 4: Tambah Apps Script

1. Dalam spreadsheet, pergi ke **Extensions → Apps Script**
2. Padam semua kod default dalam `Code.gs`
3. Copy keseluruhan kandungan `code.gs` dari repo ini dan paste
4. Klik **File → New → HTML** dan namakan `index`
5. Copy keseluruhan kandungan `index.html` dari repo ini dan paste
6. Klik **Save** (ikon disket)

### Langkah 4A: Migrasi RECORD_ID

Jika sheet sudah mempunyai kolum `RECORD_ID`, jalankan fungsi `migrateRecordIds()` sekali dalam Apps Script selepas deploy atau selepas menambah kolum tersebut. Fungsi ini mengisi ID untuk rekod lama dalam `DATA`, `EV_CHARGING`, `MINYAK`, dan `SOLAR`.

`BIL_REKOD` tidak menggunakan `RECORD_ID`; kekalkan struktur 11 kolum asal.

### Langkah 5: Deploy sebagai Web App

1. Klik **Deploy → New deployment**
2. Klik ikon gear dan pilih **Web app**
3. Isi maklumat:
   - **Description**: Jejak Belanja
   - **Execute as**: Me
   - **Who has access**: Pilih akses mengikut keperluan. Untuk data kewangan peribadi, akses terhad kepada akaun sendiri/organisasi lebih selamat berbanding `Anyone`.
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
└── PELAKSANAAN_CACHE.md # Rujukan pelaksanaan cache
```

## Teknologi

- **Frontend**: HTML, Tailwind CSS, Chart.js
- **Backend**: Google Apps Script
- **Database**: Google Sheets
- **Caching**: Google Apps Script CacheService untuk semua modul + localStorage

## Harga Default

- Cas EV Rumah: RM 0.4443/kWh
- Minyak: RM 1.99/liter
- Cas EV Luar: tiada harga default tetap; harga/kWh diisi mengikut rekod.

Harga Cas Rumah dan Minyak digunakan di frontend dan backend, termasuk rekod pukal. Jika kadar berubah, kemas kini constant `DEFAULT_HOME_KWH_PRICE` dan `DEFAULT_PETROL_PRICE` dalam `code.gs` sahaja; frontend memuatkan nilai melalui `getAppConfig()`. Untuk Cas Luar, medan harga dikosongkan supaya kadar sebenar perlu diisi dan tidak tersimpan menggunakan harga Cas Rumah secara tidak sengaja.

## Business Rules

- Header Ringkasan boleh menyebut semua modul sistem, tetapi jumlah besar Ringkasan hanya merangkumi Belanja Harian, EV Cas, dan Minyak.
- Bil Bulanan dan Solar dipaparkan sebagai modul/kad berasingan dan tidak dimasukkan dalam jumlah besar.
- Data/cache aplikasi disasarkan untuk tahun 2026 hingga 2031.
- Nilai solar `Jana TNB`, `Guna TNB`, dan `Jana Apps` boleh bernilai `0` jika bacaan bulan tersebut memang sifar.
- Status bil diterima adalah berasingan daripada status bayaran. Bil boleh diterima tetapi masih belum dibayar.
- Menandakan bil sebagai dibayar turut menandakan `BIL_DITERIMA` sebagai `Ya`.
- Catatan bil tetap disimpan di `BIL_TEMPLATE.CATATAN` mengikut `LOKASI + NAMA` dan dipaparkan pada item bil setiap bulan.
- `JUMLAH_BAKI` solar reset semula pada permulaan tahun baharu; kumulatif solar dikira dalam sempadan tahun yang sama.
- Rekod Solar boleh dipindah bulan/tahun semasa edit, tetapi gabungan `TAHUN + BULAN` masih mesti unik.

## Aliran Bil Bulanan

1. Tekan `Bil Ada` apabila bil sudah diterima tetapi belum dibayar.
2. Tick checkbox bayaran apabila bil sudah dibayar. Bil tersebut turut dianggap sudah diterima.
3. Perubahan `Bil Ada`, checkbox bayaran, dan `Semua` hanya menjadi pending pada browser.
4. Kad lokasi yang mempunyai pending changes ditanda amber dan memaparkan butang `Simpan` serta `Batal`.
5. Tekan `Simpan` untuk menyimpan semua pending changes bagi lokasi tersebut sekali gus.
6. Tekan `Batal` sebelum simpan untuk membuang semua pending changes bagi lokasi tersebut.
7. Jika kesilapan hanya disedari selepas simpan, ubah semula status yang salah dan tekan `Simpan` sekali lagi.

Perubahan amaun bil tidak menggunakan pending batch. Amaun disimpan terus apabila nilai input diubah; jika tersalah, masukkan amaun yang betul semula.

Catatan bil dipaparkan di bawah nama bil. Untuk rekod lama yang belum menyimpan `BIL_REKOD.CATATAN`, paparan akan fallback kepada catatan daripada `BIL_TEMPLATE` berdasarkan `LOKASI + NAMA`.

## Customization

### Tukar Kategori Belanja

Edit senarai dalam tab `KATEGORI` di Google Sheet (Nama + Ikon). Perubahan akan automatik reflect dalam dropdown.

### Tukar Senarai CPO

Edit senarai dalam tab `JENIS_CPO` di Google Sheet.

### Tukar Senarai Bil

Edit senarai dalam tab `BIL_TEMPLATE` di Google Sheet. Setiap bulan baru, app akan auto-jana checklist dari template dan menyalin `CATATAN` ke `BIL_REKOD`. Jika tab `BIL_TEMPLATE` atau `BIL_REKOD` tiada, app akan paparkan ralat jelas.

### Tukar Harga Default

Dalam `code.gs`, kemas kini constant backend yang digunakan oleh server dan dimuatkan ke frontend melalui `getAppConfig()`:
- `DEFAULT_HOME_KWH_PRICE` untuk harga cas rumah
- `DEFAULT_PETROL_PRICE` untuk harga minyak

### Backup Mingguan

Fungsi `backupSpreadsheetNow()` menyalin keseluruhan spreadsheet ke folder Google Drive backup. Nama fail menggunakan minggu backup dalam format `Backup Jejak Belanja dd/dd-mm-yyyy`, contohnya `Backup Jejak Belanja 10/16-08-2026`.

Jalankan `installWeeklyBackupTrigger()` sekali dalam Apps Script untuk memasang trigger backup mingguan pada Ahad jam 11 malam. Folder sasaran ditetapkan melalui constant `BACKUP_FOLDER_ID` dalam `code.gs`.

## Limitasi

- Memerlukan sambungan internet
- Tailwind CSS, Chart.js, dan Google Fonts masih dimuatkan melalui CDN; paparan atau carta boleh terjejas jika CDN disekat oleh rangkaian/telco
- Data disimpan dalam Google Sheet akaun sendiri
- Rekod pukal Belanja dan EV/Minyak dihadkan kepada 50 rekod sekali simpan untuk elak timeout Apps Script
- Tidak boleh deploy sebagai GitHub Pages (kerana bergantung kepada Google Apps Script)
- Maksimum 50MB data (limitasi Google Apps Script)

## Way Forward

- **Audit log** — Tambah sheet `AUDIT_LOG` untuk merekod aksi penting seperti tambah, edit, padam, batch bil, perubahan amaun bil, dan perubahan solar. Ini memudahkan semakan jika data tersalah ubah/padam.
- **Optimasi Solar** — `recalculateSolarRunningBalance()` boleh dioptimumkan kemudian dengan batch write jika data solar semakin besar. Buat hanya jika perlu kerana data sasaran 2026-2031 masih kecil.
- **Load flow frontend** — Kekalkan flow `google.script.run` berasingan untuk modul yang kompleks supaya kegagalan satu bahagian tidak menjatuhkan semua data halaman. Gabungan batch load hanya dibuat jika ada isu prestasi jelas.

## Lisensi

MIT License — Bebas diguna dan diubahsuai.

## Penulis

Dibuat untuk kegunaan peribadi tracking perbelanjaan, kos kenderaan EV, bil bulanan, dan prestasi solar.
