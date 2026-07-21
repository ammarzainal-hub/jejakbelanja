# Project Instructions

## Business Rules

- Jumlah besar Ringkasan hanya merangkumi Belanja Harian, EV Cas, dan Minyak.
- Bil Bulanan dipaparkan sebagai modul/kad berasingan dan tidak dimasukkan dalam jumlah besar.
- Data/cache aplikasi disasarkan untuk tahun 2026 hingga 2031.
- Nilai solar `Jana TNB`, `Guna TNB`, dan `Jana Apps` boleh bernilai `0` jika bacaan bulan tersebut memang sifar.

## Implementation Notes

- Escape semua nilai daripada Google Sheet sebelum dimasukkan ke `innerHTML`.
- Selepas tambah, edit, atau padam rekod solar, kira semula `JUMLAH_BAKI` supaya baki kumulatif kekal tepat.
