# Jejak Belanja

Aplikasi web untuk menguruskan perbelanjaan harian dan menjejaki kos kenderaan elektrik (EV). Dibina menggunakan Google Apps Script dengan Google Sheets sebagai pangkalan data.

## Ciri-ciri

- **Ringkasan Bulanan** — Pandangan keseluruhan gabungan belanja, EV cas, dan minyak dengan perbandingan bulan lepas
- **Belanja Harian** — Rekod perbelanjaan dengan kategori, carta pai, dan trend tahunan
- **EV Cas Tracker** — Rekod cas EV (rumah/luar) dan isi minyak dengan pecahan CPO/stesen
- **Rekod Pukal** — Tambah multiple entries sekaligus
- **Carta Interaktif** — Klik carta untuk menapis data
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

Buat 5 sheet tabs dengan nama berikut (case-sensitive):

| Nama Tab | Kegunaan |
|----------|----------|
| `DATA` | Rekod belanja harian |
| `KATEGORI` | Senarai kategori belanja |
| `EV_CHARGING` | Rekod cas EV |
| `JENIS_CPO` | Senarai CPO/stesen cas |
| `MINYAK` | Rekod isi minyak |

### Langkah 3: Tambah Header & Data Awal

**Tab DATA** — Header di baris pertama:
```
Tarikh | Amaun | Kategori | Nota
```

**Tab KATEGORI** — Header di baris pertama, kemudian isi kategori:
```
Nama
---
Makanan
Minuman
Pengangkutan
Hiburan
Utiliti
Lain-lain
```

**Tab EV_CHARGING** — Header di baris pertama:
```
Tarikh | Jenis | CPO | kWh | Harga/kWh | Lokasi | Jumlah
```

**Tab JENIS_CPO** — Header di baris pertama, kemudian isi senarai CPO:
```
Nama
---
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
├── code.gs       # Server-side logic (Google Apps Script)
├── index.html    # Frontend UI + client-side JavaScript
└── README.md     # Dokumentasi
```

## Teknologi

- **Frontend**: HTML, Tailwind CSS, Chart.js
- **Backend**: Google Apps Script
- **Database**: Google Sheets

## Harga Default

- Cas EV Rumah: RM 0.4443/kWh
- Minyak: RM 1.99/liter

Harga ini boleh diubah dalam kod mengikut kadar semasa.

## Customization

### Tukar Kategori Belanja

Edit senarai dalam tab `KATEGORI` di Google Sheet. Perubahan akan automatik reflect dalam dropdown.

### Tukar Senarai CPO

Edit senarai dalam tab `JENIS_CPO` di Google Sheet.

### Tukar Harga Default

Dalam `index.html`, cari dan ubah nilai:
- `value="0.4443"` untuk harga cas rumah
- `value="1.99"` untuk harga minyak

## Limitasi

- Memerlukan sambungan internet
- Data disimpan dalam Google Sheet akaun sendiri
- Tidak boleh deploy sebagai GitHub Pages (kerana bergantung kepada Google Apps Script)

## Lisensi

MIT License — Bebas diguna dan diubahsuai.

## Penulis

Dibuat untuk kegunaan peribadi tracking perbelanjaan dan kos kenderaan EV.
