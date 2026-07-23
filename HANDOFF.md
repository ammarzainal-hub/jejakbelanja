# Handoff Jejak Belanja

Tarikh: 2026-07-23

## Tujuan Sesi

- Kemas kini modul Bil untuk menyokong `CYCLE_HARI`, `FREKUENSI`, dan `BULAN_AKTIF` dalam Google Sheet `BIL_TEMPLATE`.
- Tambah rekod pukal EV/Minyak supaya boleh campur `Cas Rumah`, `Cas Luar`, dan `Minyak` dalam satu simpan.
- Pastikan flow simpan konsisten: validasi, loader, disable button, toast, reload data, dan cache invalidation.

## Perubahan Dibuat

### Bil

- `BIL_TEMPLATE` kini dibaca sebagai 10 kolum:
  `NAMA`, `KATEGORI`, `ANGGARAN`, `TETAP`, `LOKASI`, `IKON_LOKASI`, `IKON_KATEGORI`, `CYCLE_HARI`, `FREKUENSI`, `BULAN_AKTIF`.
- `initBilMonth(month, year)` kini hanya menjana bil tahunan apabila bulan semasa sama dengan `BULAN_AKTIF`.
- `FREKUENSI` default kepada `Bulanan` jika kosong.
- `CYCLE_HARI` sudah dibaca dari Sheet, tetapi belum digunakan untuk warning/UI khusus.

### EV/Minyak Pukal

- Backend baru: `addBulkEVRecords(rows)` dalam `code.gs`.
- Fungsi ini menyokong campuran:
  `home` = Cas Rumah, `public` = Cas Luar, `petrol` = Minyak.
- Data EV ditulis ke `EV_CHARGING`.
- Data minyak ditulis ke `MINYAK`.
- `invalidateEVCache()` dipanggil sekali sahaja selepas batch selesai.
- Frontend baru: modal `evBulkModal` dalam `index.html`.
- Butang baru pada page Energy: `Rekod Pukal`.
- Setiap baris ada tarikh sendiri.
- Validasi client-side dibuat sebelum hantar ke Apps Script.

### Repo Hygiene

- `.DS_Store` dibuang dari tracking git.
- `.gitignore` tambah `.DS_Store`.

### Dokumentasi

- `AGENTS.md` dikemas kini dengan business rules dan struktur baru.
- `README.md` dikemas kini untuk `BIL_TEMPLATE` 10 kolum dan rekod pukal EV/Minyak.
- `IMPROVEMENTS.md` dikemas kini untuk perubahan Bil dan Energy pukal.

## Validasi Yang Sudah Lulus

```bash
node -e "const fs=require('fs'); const html=fs.readFileSync('index.html','utf8'); const scripts=[...html.matchAll(/<script(?![^>]*src=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(m=>m[1]).join('\\n'); new Function(scripts); new Function(fs.readFileSync('code.gs','utf8')); console.log('JS syntax OK');"
git diff --check
```

Keputusan:

- `JS syntax OK`
- `git diff --check` lulus tanpa output.

## Status Git Semasa

Fail berubah:

- `.DS_Store` dibuang
- `.gitignore` ditambah
- `AGENTS.md`
- `IMPROVEMENTS.md`
- `README.md`
- `code.gs`
- `index.html`
- `HANDOFF.md`

Belum commit setakat nota ini dibuat.

## Perkara Belum Siap / Seterusnya

- Gunakan `CYCLE_HARI` dalam UI Bil untuk warning, contoh bil sepatutnya sudah diterima selepas hari cycle tetapi `BIL_DITERIMA = Tidak`.
- Uji manual dalam Apps Script Web App:
  - Bil bulanan masih dijana setiap bulan.
  - Bil tahunan hanya muncul pada `BULAN_AKTIF`.
  - Rekod pukal EV/Minyak berjaya simpan campuran jenis dalam satu batch.
  - Button/loader/toast pukal EV behave konsisten dengan form lain.
- Jika mahu sambung di komputer lain, commit dan push perubahan ini dahulu.
