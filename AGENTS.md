# Project Instructions

## Business Rules

- Header Ringkasan boleh menyebut semua modul sistem, tetapi jumlah besar Ringkasan hanya merangkumi Belanja Harian, EV Cas, dan Minyak.
- Bil Bulanan dan Solar dipaparkan sebagai modul/kad berasingan dan tidak dimasukkan dalam jumlah besar.
- Data/cache aplikasi disasarkan untuk tahun 2026 hingga 2031.
- Nilai solar `Jana TNB`, `Guna TNB`, dan `Jana Apps` boleh bernilai `0` jika bacaan bulan tersebut memang sifar.
- `JUMLAH_BAKI` solar reset semula pada permulaan tahun baharu; kumulatif solar dikira dalam sempadan tahun yang sama.
- Rekod Solar boleh dipindah bulan/tahun semasa edit, tetapi gabungan `TAHUN + BULAN` mesti kekal unik.
- Status bil diterima adalah berasingan daripada status bayaran: bil boleh diterima tetapi belum dibayar.
- Menandakan bil sebagai dibayar mesti turut menetapkan `BIL_DITERIMA` kepada `Ya`.
- Perubahan status bil (`Bil Ada`, dibayar, dan tandai semua) dipending di client dan disimpan secara batch mengikut lokasi.
- `Batal` membuang pending changes lokasi sebelum simpan. Selepas simpan, pembetulan dibuat dengan ubah semula status dan simpan sekali lagi.
- Perubahan amaun bil disimpan terus apabila input berubah; ia bukan sebahagian daripada batch status.
- Selepas perubahan amaun bil berjaya disimpan, paparan ringkasan bil perlu dikira semula.
- Bil tahunan dalam `BIL_TEMPLATE` hanya dijana pada `BULAN_AKTIF`.
- `CATATAN` dalam `BIL_TEMPLATE` ialah rujukan tetap untuk `LOKASI + NAMA` dan dipaparkan setiap bulan pada item bil.
- `batchUpdateBil()` mesti sahkan row wujud, bulan, tahun, lokasi, `STATUS`, dan `BIL_DITERIMA` sebelum sebarang tulis ke sheet supaya batch tidak tersimpan separuh atau melangkau konteks lokasi.

## Implementation Notes

- Escape semua nilai daripada Google Sheet sebelum dimasukkan ke `innerHTML`.
- CSV export mesti escape tanda petik dan lindungi nilai yang bermula dengan `=`, `+`, `-`, atau `@` supaya tidak ditafsir sebagai formula spreadsheet.
- Selepas tambah, edit, atau padam rekod solar, kira semula `JUMLAH_BAKI` supaya baki kumulatif kekal tepat.
- `parseRowId()` dan semakan row wujud wajib digunakan untuk semua operasi edit/padam; `rowId < 2` mesti ditolak supaya header sheet tidak boleh terpadam.
- Validasi tarikh wajib ketat pada format `yyyy-mm-dd` dan menolak tarikh tidak wujud.
- Rekod bertarikh harian tidak boleh menggunakan tarikh masa hadapan, termasuk rekod pukal.
- Rekod pukal Belanja dan EV/Minyak dihadkan kepada maksimum 50 rekod sekali simpan.
- Auto-jana bil mesti guna key gabungan `LOKASI + NAMA` untuk elak bil lokasi berbeza terlangkau.
- Rekod pukal EV/Minyak mesti buat preflight pada semua sheet wajib sebelum sebarang tulis.
- Solar hanya boleh ada satu rekod bagi setiap gabungan `TAHUN + BULAN`.
- Struktur `BIL_REKOD` ialah 11 kolum: `TAHUN`, `BULAN`, `LOKASI`, `NAMA`, `KATEGORI`, `AMAUN`, `STATUS`, `TARIKH_BAYAR`, `BIL_DITERIMA`, `TARIKH_BIL`, `CATATAN`.
- `CATATAN` dalam `BIL_REKOD` disalin daripada `BIL_TEMPLATE` semasa auto-jana bil baharu; rekod lama boleh fallback kepada catatan template semasa paparan.
- Struktur `BIL_TEMPLATE` ialah 11 kolum: `NAMA`, `KATEGORI`, `ANGGARAN`, `TETAP`, `LOKASI`, `IKON_LOKASI`, `IKON_KATEGORI`, `CYCLE_HARI`, `FREKUENSI`, `BULAN_AKTIF`, `CATATAN`.
- Rekod pukal EV/Minyak mesti menyokong campuran `Cas Rumah`, `Cas Luar`, dan `Minyak` dengan tarikh berasingan setiap baris.
- Harga default Cas Rumah dan Minyak mesti dikemas kini di constant frontend `index.html` dan constant backend `code.gs`.
- Cas Luar tiada harga default tetap; frontend tidak boleh memenuhkan harga Cas Rumah apabila pengguna memilih Cas Luar.
- Harga minyak yang dihantar ke backend mesti lebih daripada `0`; nilai kosong boleh fallback kepada `DEFAULT_PETROL_PRICE`.
- Parser nombor backend mesti menolak nilai bukan nombor dan membezakan medan wajib positif, wajib bukan negatif, dan optional fallback.
- Operasi tulis mesti menggunakan helper sheet wajib supaya sheet yang hilang menghasilkan mesej ralat yang jelas.
- `BIL_TEMPLATE` mesti dibaca melalui helper sheet wajib supaya sheet template yang hilang tidak disenyapkan sebagai senarai kosong.
- Fungsi baca agregat yang kembali kosong juga boleh cache hasil kosong untuk kurangkan bacaan sheet berulang.
