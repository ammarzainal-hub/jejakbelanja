# Penambahbaikan Julai 2026

Ringkasan perubahan semasa yang masih relevan untuk `code.gs` dan `index.html`.

## Keselamatan & Data Safety

- `parseRowId()` digunakan untuk operasi edit/padam supaya `rowId < 2` ditolak dan header sheet tidak boleh terpadam.
- Validasi tarikh backend hanya menerima format `yyyy-mm-dd` yang sah dan menolak tarikh tidak wujud.
- Rekod harian Belanja, EV, Minyak, Belanja pukal, dan EV/Minyak pukal menolak tarikh masa hadapan di frontend dan backend.
- `doGet()` tidak lagi menggunakan `XFrameOptionsMode.ALLOWALL`, jadi aplikasi tidak dibenarkan embed bebas dalam iframe luar.
- CSV export escape tanda petik berganda dan melindungi nilai bermula `=`, `+`, `-`, atau `@` supaya tidak ditafsir sebagai formula spreadsheet.
- Output dinamik daripada Google Sheet di-escape sebelum dimasukkan ke `innerHTML`.

## Belanja Harian

- Tarikh default dan tarikh simpanan menggunakan tarikh lokal, bukan offset UTC.
- Carta kategori menyokong expand dan trend 3 bulan.
- Carta bayaran boleh ditapis dengan klik carta.
- Carian meliputi kategori, nota, amaun, dan bayaran.
- Pagination ditetapkan kepada 25 rekod per halaman.
- Kategori, trend, dan data tahunan menggunakan cache.

## EV Cas & Minyak

- Rekod EV menyokong Cas Rumah dan Cas Luar.
- Rekod Minyak menggunakan harga default petrol yang dipusatkan.
- EV/Minyak pukal menyokong campuran Cas Rumah, Cas Luar, dan Minyak dengan tarikh berasingan setiap baris.
- `addBulkEVRecords()` membuat preflight sheet wajib sebelum sebarang tulis supaya batch tidak masuk separuh.
- CPO dan data tahunan EV/Minyak menggunakan cache.
- Harga default frontend dipusatkan melalui `DEFAULT_HOME_KWH_PRICE` dan `DEFAULT_PETROL_PRICE` di `index.html`.

## Bil Bulanan

- `BIL_TEMPLATE` menggunakan 10 kolum: `NAMA`, `KATEGORI`, `ANGGARAN`, `TETAP`, `LOKASI`, `IKON_LOKASI`, `IKON_KATEGORI`, `CYCLE_HARI`, `FREKUENSI`, `BULAN_AKTIF`.
- `BIL_REKOD` menggunakan 11 kolum termasuk `BIL_DITERIMA`, `TARIKH_BIL`, dan `CATATAN`.
- `CATATAN` ialah medan manual/rujukan; UI bil semasa tidak menulis catatan.
- Bil auto-jana menggunakan key gabungan `LOKASI + NAMA` supaya bil nama sama di lokasi berbeza tidak dianggap duplicate.
- Bil tahunan hanya dijana pada `BULAN_AKTIF`.
- Status bil diterima berasingan daripada status bayaran.
- Menanda bil sebagai dibayar turut menetapkan `BIL_DITERIMA` kepada `Ya`.
- Perubahan `Bil Ada`, checkbox bayaran, dan `Semua` dipending di client dan disimpan secara batch mengikut lokasi.
- `batchUpdateBil()` mengesahkan nilai `STATUS` dan `BIL_DITERIMA` sebelum menulis ke sheet.
- Fungsi bil lama `toggolBilStatus()`, `toggolBilDiterima()`, dan `tandaiSemuaBilLokasi()` dinyahaktifkan dan hanya memberi error jika dipanggil.
- Selepas amaun bil tak tetap disimpan, ringkasan bil dimuat semula supaya jumlah tepat.

## Solar Tracker

- Solar hanya membenarkan satu rekod untuk setiap gabungan `TAHUN + BULAN`.
- Rekod Solar boleh dipindah bulan/tahun semasa edit, dengan duplicate guard kekal aktif.
- Input tahun Solar di frontend dihadkan kepada 2026-2031.
- Nilai `Jana TNB`, `Guna TNB`, dan `Jana Apps` boleh bernilai `0`.
- `BAKI`, `JUMLAH_BAKI`, dan `GUNA_LUAR_GRID` dikira secara automatik.
- Selepas tambah, edit, atau padam rekod Solar, `JUMLAH_BAKI` dikira semula.
- `JUMLAH_BAKI` reset pada permulaan tahun baharu; kumulatif Solar dikira dalam sempadan tahun yang sama.
- Data Solar bulanan dan tahunan menggunakan cache.

## Ringkasan

- Header Ringkasan boleh menyebut semua modul: Belanja, EV Cas, Minyak, Bil, dan Solar.
- Jumlah besar Ringkasan hanya mengira Belanja Harian, EV Cas, dan Minyak.
- Bil Bulanan dan Solar dipaparkan sebagai kad/section berasingan dan tidak masuk jumlah besar.
- Perbandingan bulan menyokong roll-over Januari ke Disember tahun sebelumnya.
- Label perbandingan menggunakan nama bulan sebenar, bukan label generik.
- Carta trend Ringkasan memaparkan Belanja dan EV+Minyak.

## UI & UX

- Dark mode menggunakan `localStorage`.
- Nav hover dan active state menggunakan tema warna modul.
- Kad utama menggunakan gradient mengikut modul.
- Belanja dan EV/Minyak mempunyai carian dan pagination.
- Eksport CSV tersedia untuk Belanja, EV/Minyak, Bil, dan Solar.

## Cache

- Cache aktif untuk kategori, CPO, data tahunan Belanja, trend kategori, data tahunan EV/Minyak, template bil, Solar bulanan, dan Solar tahunan.
- Invalidation cache disasarkan kepada tahun 2026-2031.
- Hasil kosong untuk trend dan Solar boleh disimpan sebagai cache ringan.
- Butang refresh menggunakan ikon `🔄` dan memanggil fungsi refresh backend yang berkaitan.
