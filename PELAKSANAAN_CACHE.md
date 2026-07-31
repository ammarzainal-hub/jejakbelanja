# Pelaksanaan Cache — Jejak Belanja

Status dikemas kini: Julai 2026

Dokumen ini menerangkan cache yang sedang digunakan oleh aplikasi. `code.gs` ialah sumber muktamad untuk implementasi sebenar.

## Ringkasan

Aplikasi menggunakan `CacheService.getScriptCache()` untuk mengurangkan bacaan Google Sheet berulang bagi data agregat dan senarai rujukan.

Cache bersifat sementara. Jika cache luput atau dikosongkan, data akan dibaca semula daripada Google Sheet dan cache akan dibina semula pada panggilan seterusnya.

## Julat Data

Cache tahunan dan invalidation disasarkan kepada tahun `2026` hingga `2031`.

## TTL

| Jenis Data | TTL |
|---|---:|
| Data agregat tahunan/trend | 2 jam |
| Senarai rujukan seperti kategori, CPO, template bil | 6 jam |
| Solar bulanan/tahunan | 2 jam |

## Kunci Cache Aktif

| Kunci Cache | Data Disimpan | Dikosongkan Bila |
|---|---|---|
| `yearly_data_YYYY` | Jumlah Belanja bulanan untuk setahun | Tambah, edit, atau padam Belanja |
| `trend_MM_YYYY` | Trend kategori 3 bulan berdasarkan bulan/tahun sebenar, termasuk fallback bulan semasa apabila filter kosong | Tambah, edit, atau padam Belanja |
| `categories` | Senarai kategori dan ikon | Refresh Belanja / Refresh Semua |
| `evyearly_data_YYYY` | Jumlah EV + Minyak bulanan untuk setahun | Tambah, edit, atau padam EV/Minyak |
| `cpo_types` | Senarai CPO/stesen cas | Refresh EV / Refresh Semua |
| `bil_template` | Template bil bulanan termasuk catatan tetap | Refresh Semua |
| `solar_data_YYYY_MM` | Rekod Solar untuk bulan tertentu | Tambah, edit, padam Solar / Refresh Solar |
| `solar_yearly_YYYY` | Data Solar tahunan untuk carta | Tambah, edit, padam Solar / Refresh Solar |

## Fungsi Cache Backend

| Fungsi | Tujuan |
|---|---|
| `cacheGet(key)` | Baca cache dengan fallback selamat jika CacheService gagal |
| `cacheSet(key, val, ttl)` | Simpan cache dengan TTL |
| `cacheDel(key)` | Buang satu kunci cache |
| `invalidateExpenseCache()` | Buang cache Belanja, kategori, dan trend 2026-2031 |
| `invalidateEVCache()` | Buang cache tahunan EV/Minyak 2026-2031 |
| `invalidateBilTemplateCache()` | Buang cache template bil |
| `invalidateSolarCache()` | Buang cache Solar bulanan dan tahunan 2026-2031 |
| `clearDashboardCache()` | Refresh Semua: buang cache Belanja, EV/Minyak, CPO, Bil, dan Solar |
| `refreshExpenseOnly()` | Refresh cache Belanja sahaja |
| `refreshEVOnly()` | Refresh cache EV/Minyak sahaja |

## Refresh Manual Di UI

| Tab | Butang | Fungsi Backend |
|---|---|---|
| Ringkasan | `🔄` | `clearDashboardCache()` |
| Belanja | `🔄` | `refreshExpenseOnly()` |
| EV Cas | `🔄` | `refreshEVOnly()` |
| Solar | `🔄` | `invalidateSolarCache()` |

## Nota Pelaksanaan

- `CacheService` bukan storan kekal. Data boleh hilang apabila TTL tamat atau Google reclaim memori.
- Data yang kosong juga boleh disimpan sebagai cache untuk mengurangkan bacaan sheet berulang.
- Jika data diedit terus dalam Google Sheet, UI mungkin memaparkan cache lama sehingga TTL tamat atau butang refresh ditekan.
- Template bil (`bil_template`) tidak mempunyai CRUD UI sendiri; jika template atau catatan bil diedit terus di Sheet, tekan Refresh Semua untuk paksa bacaan semula.
- Cache tidak mengubah struktur sheet. Ia hanya menyimpan hasil bacaan/agregat sementara.
