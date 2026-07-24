# Project Instructions

## Business Rules

- Header Ringkasan boleh menyebut semua modul sistem, tetapi jumlah besar Ringkasan hanya merangkumi Belanja Harian, EV Cas, dan Minyak.
- Bil Bulanan dan Solar dipaparkan sebagai modul/kad berasingan dan tidak dimasukkan dalam jumlah besar.
- Data/cache aplikasi disasarkan untuk tahun 2026 hingga 2031.
- Nilai solar `Jana TNB`, `Guna TNB`, dan `Jana Apps` boleh bernilai `0` jika bacaan bulan tersebut memang sifar.
- Status bil diterima adalah berasingan daripada status bayaran: bil boleh diterima tetapi belum dibayar.
- Menandakan bil sebagai dibayar mesti turut menetapkan `BIL_DITERIMA` kepada `Ya`.
- Perubahan status bil (`Bil Ada`, dibayar, dan tandai semua) dipending di client dan disimpan secara batch mengikut lokasi.
- `Batal` membuang pending changes lokasi sebelum simpan. Selepas simpan, pembetulan dibuat dengan ubah semula status dan simpan sekali lagi.
- Perubahan amaun bil disimpan terus apabila input berubah; ia bukan sebahagian daripada batch status.
- Bil tahunan dalam `BIL_TEMPLATE` hanya dijana pada `BULAN_AKTIF`.

## Implementation Notes

- Escape semua nilai daripada Google Sheet sebelum dimasukkan ke `innerHTML`.
- Selepas tambah, edit, atau padam rekod solar, kira semula `JUMLAH_BAKI` supaya baki kumulatif kekal tepat.
- `parseRowId()` wajib digunakan untuk semua operasi edit/padam; `rowId < 2` mesti ditolak supaya header sheet tidak boleh terpadam.
- Validasi tarikh wajib ketat pada format `yyyy-mm-dd` dan menolak tarikh tidak wujud.
- Auto-jana bil mesti guna key gabungan `LOKASI + NAMA` untuk elak bil lokasi berbeza terlangkau.
- Rekod pukal EV/Minyak mesti buat preflight pada semua sheet wajib sebelum sebarang tulis.
- Solar hanya boleh ada satu rekod bagi setiap gabungan `TAHUN + BULAN`.
- Struktur `BIL_REKOD` ialah 11 kolum: `TAHUN`, `BULAN`, `LOKASI`, `NAMA`, `KATEGORI`, `AMAUN`, `STATUS`, `TARIKH_BAYAR`, `BIL_DITERIMA`, `TARIKH_BIL`, `CATATAN`.
- Struktur `BIL_TEMPLATE` ialah 10 kolum: `NAMA`, `KATEGORI`, `ANGGARAN`, `TETAP`, `LOKASI`, `IKON_LOKASI`, `IKON_KATEGORI`, `CYCLE_HARI`, `FREKUENSI`, `BULAN_AKTIF`.
- Rekod pukal EV/Minyak mesti menyokong campuran `Cas Rumah`, `Cas Luar`, dan `Minyak` dengan tarikh berasingan setiap baris.
- Operasi tulis mesti menggunakan helper sheet wajib supaya sheet yang hilang menghasilkan mesej ralat yang jelas.
