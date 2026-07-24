# Panduan Pelaksanaan CacheService — Jejak Belanja

Tarikh asal: Jun 2025
Status dikemas kini: Julai 2026

> Pelaksanaan cache dalam dokumen ini sudah diterapkan. Contoh kod di bahagian pelaksanaan dikekalkan sebagai rujukan sejarah; `code.gs` ialah sumber muktamad jika terdapat perbezaan kecil. Julat cache aktif aplikasi ialah 2026 hingga 2031.

---

## 1. Ringkasan

Sistem cache 2 lapisan menggunakan `CacheService` (bina dalam Google Apps Script, percuma) untuk mengurangkan bacaan Google Sheet berulang.

| | Sebelum | Selepas |
|---|---|---|
| Bacaan sheet per `getBatchSummaryData()` | 8 kali | 3 kali |
| Bacaan sheet per `getBatchExpenseData()` | 3 kali | 1 kali |
| Bacaan sheet per `getBatchEVData()` | 3 kali | 1 kali |
| **Penjimatan** | — | **~62%** |

---

## 2. Seni Bina Cache

| Kunci Cache | Data Disimpan | TTL | Dikosongkan Bila |
|---|---|---|---|
| `yearly_data_YYYY` | 12 angka jumlah belanja bulanan (Array) | 2 jam | Tambah/ubah/padam transaksi |
| `evyearly_data_YYYY` | 12 angka jumlah EV+minyak bulanan (Array) | 2 jam | Tambah/ubah/padam EV/petrol |
| `trend_MM_YYYY` | Category trend 3 bulan (Object) | 2 jam | Tambah/ubah/padam transaksi |
| `categories` | Senarai kategori + icon (Array) | 6 jam | Tekan butang Refresh |
| `cpo_types` | Senarai CPO (Array) | 6 jam | Tekan butang Refresh EV |
| `bil_template` | Template bil bulanan (Array) | 6 jam | Perubahan berkaitan bil / refresh template |
| `solar_data_YYYY_MM` | Rekod Solar ikut bulan (Array) | 2 jam | Tambah/ubah/padam Solar atau Refresh Solar |
| `solar_yearly_YYYY` | Data Solar tahunan untuk carta (Object) | 2 jam | Tambah/ubah/padam Solar atau Refresh Solar |

**CacheService** — storan dalam RAM server Google.
- BUKAN Google Drive
- BUKAN Google Sheet
- Percuma, tiada had kuota
- Max 100KB per entry
- TTL maksimum 6 jam (21,600 saat)

---

## 3. Mekanisme

### 3.1 Cache-Aside Pattern

```
Fungsi baca data:
  1. Cek cache → ada? → pulangkan data dari cache ⚡
  2. Takde?     → baca sheet → simpan ke cache → pulangkan data
```

### 3.2 Invalidate On Write

```
Fungsi CRUD (tambah/ubah/padam):
  1. Tulis ke sheet ✅
  2. Kosongkan cache berkaitan 🗑️
  3. Return success
```

Cache akan dibina semula secara automatik pada bacaan seterusnya.

### 3.3 TTL Sebagai Safety Net

TTL bertindak sebagai perlindungan sekiranya:
- User edit sheet **direct** (buka Google Sheets, bukan guna web app)
- Script error semasa invalidate
- Cache terkorup

Selepas TTL tamat, cache luput sendiri → bacaan seterusnya akan baca sheet semula.

### 3.4 Butang Refresh Manual

Empat laluan refresh digunakan untuk kosongkan cache secara manual:

| Tab | Butang | Fungsi Backend | Cache Dikosongkan |
|---|---|---|---|
| Ringkasan | ⟳ Refresh | `clearDashboardCache()` | Belanja, EV/Minyak, kategori, dan CPO |
| Belanja | ⟳ Refresh | `refreshExpenseOnly()` | yearly + trend + categories |
| EV Cas | ⟳ Refresh | `refreshEVOnly()` | evyearly + cpo_types |
| Solar | ⟳ Refresh | `invalidateSolarCache()` | solar_data + solar_yearly untuk 2026-2031 |

---

## 4. Rujukan Pelaksanaan

### 4.1 FAIL: `code.gs`

#### A. Tambah Cache Helpers — selepas `const PETROL_SHEET = 'MINYAK';`

**Lokasi:** Selepas baris 8 (selepas `const PETROL_SHEET   = 'MINYAK';`)

**Tambah kod berikut:**

```javascript
// ============================================================
//   CACHE SERVICE HELPERS
// ============================================================
const CACHE = CacheService.getScriptCache();
const TTL_SHORT = 7200;   // 2 jam — untuk yearly & trend
const TTL_LONG  = 21600;  // 6 jam — untuk kategori & CPO

function cacheGet(key) {
  try { return CACHE.get(key); } catch (e) { return null; }
}
function cacheSet(key, val, ttl) {
  try { CACHE.put(key, val, ttl || TTL_SHORT); } catch (e) { /* penuh */ }
}
function cacheDel(key) {
  try { CACHE.remove(key); } catch (e) { /* abaikan */ }
}

function invalidateExpenseCache() {
  var keys = ['yearly_data', 'trend', 'categories'];
  keys.forEach(function(k) { cacheDel(k); });
}

function invalidateEVCache() {
  cacheDel('evyearly_data');
}

function clearDashboardCache() {
  invalidateExpenseCache();
  invalidateEVCache();
  cacheDel('cpo_types');
  invalidateBilCache();
  invalidateSolarCache();
  return { status: 'success', message: '✅ Cache dikosongkan. Data segar akan dimuatkan.' };
}

function refreshExpenseOnly() {
  invalidateExpenseCache();
  return { status: 'success', message: '✅ Cache belanja dikosongkan.' };
}

function refreshEVOnly() {
  invalidateEVCache();
  cacheDel('cpo_types');
  return { status: 'success', message: '✅ Cache EV/Minyak dikosongkan.' };
}
```

---

#### B. Ubah `getCategories()` — tambah cache

**Cari:**
```javascript
function getCategories() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CATEGORY_SHEET);
```

**Ganti dengan:**
```javascript
function getCategories() {
  var cached = cacheGet('categories');
  if (cached) return JSON.parse(cached);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CATEGORY_SHEET);
```

**Di hujung fungsi, sebelum `return result;`, tambah:**
```javascript
  cacheSet('categories', JSON.stringify(result), TTL_LONG);
```

---

#### C. Ubah `getYearlyData(year)` — tambah cache

**Cari:**
```javascript
function getYearlyData(year) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
```

**Ganti dengan:**
```javascript
function getYearlyData(year) {
  var ck = 'yearly_data_' + year;
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
```

**Ubah `if (!sheet || sheet.getLastRow() < 2) return data;` kepada:**
```javascript
  if (!sheet || sheet.getLastRow() < 2) {
    cacheSet(ck, JSON.stringify(data));
    return data;
  }
```

**Di hujung fungsi, sebelum `return data;`, tambah:**
```javascript
  cacheSet(ck, JSON.stringify(data));
```

---

#### D. Ubah `getCategoryTrend(month, year)` — tambah cache

**Cari:**
```javascript
function getCategoryTrend(month, year) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
```

**Ganti dengan:**
```javascript
function getCategoryTrend(month, year) {
  var ck = 'trend_' + month + '_' + year;
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
```

**Di hujung fungsi, sebelum `return result;`, tambah:**
```javascript
  cacheSet(ck, JSON.stringify(result));
```

---

#### E. Ubah `getCPOTypes()` — tambah cache

**Cari:**
```javascript
function getCPOTypes() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CPO_SHEET);
```

**Ganti dengan:**
```javascript
function getCPOTypes() {
  var cached = cacheGet('cpo_types');
  if (cached) return JSON.parse(cached);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CPO_SHEET);
```

**Di hujung fungsi, sebelum `return result;`, tambah:**
```javascript
  cacheSet('cpo_types', JSON.stringify(result), TTL_LONG);
```

---

#### F. Ubah `getEVYearlyData(year)` — tambah cache

**Cari:**
```javascript
function getEVYearlyData(year) {
  var data = Array(12).fill(0);
```

**Ganti dengan:**
```javascript
function getEVYearlyData(year) {
  var ck = 'evyearly_data_' + year;
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);

  var data = Array(12).fill(0);
```

**Di hujung fungsi, sebelum `return data;`, tambah:**
```javascript
  cacheSet(ck, JSON.stringify(data));
```

---

#### G. Tambah `invalidateExpenseCache()` pada 4 fungsi CRUD perbelanjaan

**Sebelum setiap `return` di bawah, tambah `invalidateExpenseCache();`:**

| Fungsi | Cari `return` line ini |
|---|---|
| `addTransaction()` | `return { status: 'success', message: 'Transaksi berjaya ditambah' };` |
| `updateTransaction()` | `return { status: 'success', message: 'Transaksi berjaya dikemaskini' };` |
| `deleteTransaction()` | `return { status: 'success', message: 'Transaksi berjaya dipadam' };` |
| `addBulkTransactions()` | `return { status: 'success', message: dataToAppend.length + ' transaksi berjaya ditambah' };` |

Contoh:
```javascript
  invalidateExpenseCache();
  return { status: 'success', message: 'Transaksi berjaya ditambah' };
```

---

#### H. Tambah `invalidateEVCache()` pada 6 fungsi CRUD EV/Minyak

**Sebelum setiap `return` di bawah, tambah `invalidateEVCache();`:**

| Fungsi | Cari `return` line ini |
|---|---|
| `addEVCharging()` | `return { status: 'success', message: 'Rekod cas berjaya ditambah' };` |
| `updateEVCharging()` | `return { status: 'success', message: 'Rekod cas berjaya dikemaskini' };` |
| `deleteEVData()` | `return { status: 'success', message: 'Rekod cas berjaya dipadam' };` |
| `addPetrolRecord()` | `return { status: 'success', message: 'Rekod minyak berjaya ditambah' };` |
| `updatePetrolRecord()` | `return { status: 'success', message: 'Rekod minyak berjaya dikemaskini' };` |
| `deletePetrolRecord()` | `return { status: 'success', message: 'Rekod minyak berjaya dipadam' };` |

Contoh:
```javascript
  invalidateEVCache();
  return { status: 'success', message: 'Rekod cas berjaya ditambah' };
```

---

#### I. Ubah `getBatchSummaryData()` — gabung bacaan bulan semasa & lepas

**Cari fungsi `getBatchSummaryData` dan ganti dengan:**

```javascript
function getBatchSummaryData(month, year) {
  var prevMonth = month ? (parseInt(month) === 1 ? 12        : parseInt(month) - 1) : '';
  var prevYear  = month ? (parseInt(month) === 1 ? parseInt(year) - 1 : year)       : year;

  // Baca transaksi semua bulan dari satu bacaan sheet (tahun semasa sahaja)
  var allExp = getTransactions('', year);
  
  var expData     = month ? allExp.filter(function(t) { var d = new Date(t.date); return (d.getMonth()+1) == month; }) : allExp;
  // prevExpData: untuk Januari, prevYear berbeza — guna getTransactions(prevMonth, prevYear) supaya perbandingan tepat
  var prevExpData = month ? getTransactions(prevMonth, prevYear) : [];

  return {
    expData      : expData,
    evData       : getEVData(month, year),
    petrolData   : getPetrolData(month, year),
    prevExpData  : prevExpData,
    prevEvData   : prevMonth ? getEVData(prevMonth, prevYear) : [],
    prevPetData  : prevMonth ? getPetrolData(prevMonth, prevYear) : [],
    prevMonth    : prevMonth,
    prevYear     : prevYear,
    expYearly    : getYearlyData(year),
    evYearly     : getEVYearlyData(year)
  };
}
```

---

### 4.2 FAIL: `index.html`

#### J. Tambah butang Refresh di tab Ringkasan

**Lokasi:** Dalam header tab Ringkasan, selepas `<select id="sumFilterYear" ...>` block.

**Cari:**
```html
          </select>
        </div>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 py-6 space-y-6 text-left">
      <div class="bg-gradient-to-br from-indigo-600
```

**Ganti dengan:**
```html
          </select>
          <button onclick="forceRefreshAll()" title="Refresh & Kosongkan Cache" class="rounded-xl border border-indigo-200 text-[10px] font-bold px-4 py-2 bg-white text-indigo-600 hover:bg-indigo-50 active:scale-95 transition-all uppercase tracking-widest">
            ⟳ Refresh Semua
          </button>
        </div>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 py-6 space-y-6 text-left">
      <div class="bg-gradient-to-br from-indigo-600
```

---

#### K. Tambah butang Refresh di tab Belanja

**Lokasi:** Dalam header tab Belanja, selepas `<select id="filterYear" ...>` block.

**Cari:**
```html
          </select>
        </div>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 py-8 space-y-6 text-left">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4
```

**Ganti dengan:**
```html
          </select>
          <button onclick="forceRefreshExpense()" title="Refresh Cache Belanja" class="rounded-xl border border-emerald-200 text-[10px] font-bold px-4 py-2 bg-white text-emerald-600 hover:bg-emerald-50 active:scale-95 transition-all uppercase tracking-widest">
            ⟳ Refresh
          </button>
        </div>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 py-8 space-y-6 text-left">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4
```

---

#### L. Tambah butang Refresh di tab EV Cas

**Lokasi:** Dalam header tab EV, selepas `<select id="evFilterYear" ...>` block.

**Cari:**
```html
          </select>
        </div>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 py-6 space-y-6 text-left">
      <div class="grid grid-cols-2 md:grid-cols-4
```

**Ganti dengan:**
```html
          </select>
          <button onclick="forceRefreshEV()" title="Refresh Cache EV/Minyak" class="rounded-xl border border-blue-200 text-[10px] font-bold px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 active:scale-95 transition-all uppercase tracking-widest">
            ⟳ Refresh
          </button>
        </div>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 py-6 space-y-6 text-left">
      <div class="grid grid-cols-2 md:grid-cols-4
```

---

#### M. Tambah fungsi refresh JavaScript

**Lokasi:** Selepas fungsi `debouncedLoadAllData()` (cari `function debouncedLoadAllData()`, tambah selepas penutup `}` fungsi tersebut).

**Tambah kod berikut:**

```javascript
    function forceRefreshAll() {
      showLoader(true);
      google.script.run
        .withSuccessHandler(function(r) {
          showToast(r.message, 'info');
          loadAllData();
        })
        .withFailureHandler(function(e) {
          showLoader(false);
          showToast('Error: ' + e.message, 'error');
        })
        .clearDashboardCache();
    }

    function forceRefreshExpense() {
      showLoader(true);
      google.script.run
        .withSuccessHandler(function(r) {
          showToast(r.message, 'info');
          loadAllData();
        })
        .withFailureHandler(function(e) {
          showLoader(false);
          showToast('Error: ' + e.message, 'error');
        })
        .refreshExpenseOnly();
    }

    function forceRefreshEV() {
      showLoader(true);
      google.script.run
        .withSuccessHandler(function(r) {
          showToast(r.message, 'info');
          loadAllData();
        })
        .withFailureHandler(function(e) {
          showLoader(false);
          showToast('Error: ' + e.message, 'error');
        })
        .refreshEVOnly();
    }
```

---

## 5. Senarai Semak Pelaksanaan

### Bahagian A: `code.gs`

- [x] **Tambah** CacheService helpers
- [x] **Ubah** `getCategories()` — cache kategori
- [x] **Ubah** `getYearlyData()` — cache data tahunan Belanja
- [x] **Ubah** `getCategoryTrend()` — cache trend kategori
- [x] **Ubah** `getCPOTypes()` — cache CPO
- [x] **Ubah** `getEVYearlyData()` — cache tahunan EV/Minyak
- [x] **Tambah invalidation** pada CRUD Belanja
- [x] **Tambah invalidation** pada CRUD EV/Minyak
- [x] **Tambah cache dan invalidation** pada modul Solar
- [x] **Selaraskan tahun cache** kepada 2026-2031
- [x] **Optimumkan** `getBatchSummaryData()`

### Bahagian B: `index.html`

- [x] **Tambah** butang Refresh di tab Ringkasan
- [x] **Tambah** butang Refresh di tab Belanja
- [x] **Tambah** butang Refresh di tab EV Cas
- [x] **Tambah** butang Refresh di tab Solar
- [x] **Tambah** fungsi `forceRefresh*()` berkaitan

---

## 6. Cara Uji

Selepas semua perubahan dibuat dan di-deploy semula:

| Ujian | Langkah | Hasil Dijangka |
|---|---|---|
| **First load** | Buka dashboard pertama kali | Lambat sikit (baca sheet + bina cache). Selepas tu laju. |
| **Tukar tab** | Switch antara Ringkasan → Belanja → EV | Lebih laju dari sebelum (agregat dari cache) |
| **Tambah transaksi** | Tambah belanja baru, dashboard auto-refresh | Data tunjuk jumlah BARU (cache invalidated + rebuilt) |
| **Butang Refresh** | Tekan ⟳ Refresh pada tab berkaitan | Toast cache dikosongkan + data reload segar |
| **Edit sheet direct** | Buka Google Sheets, ubah data direct | Dashboard tunjuk data lama SEHINGGA TTL tamat (~2 jam) ATAU tekan butang Refresh |

---

## 7. Nota Penting

1. **CacheService** adalah storan sementara dalam RAM. Data hilang bila TTL tamat atau server Google reclaim memori. Ini adalah normal.
2. **TTL 2 jam** untuk data agregat — cukup untuk safety net tanpa data basi terlalu lama.
3. **Invalidate on write** adalah mekanisme utama. TTL hanya backup.
4. Struktur sheet boleh berubah mengikut modul aplikasi; cache tidak mengubah format data yang disimpan.
5. **Tidak perlu trigger automatik** — cache dibina secara "lazy" (bila diperlukan sahaja).
6. Semua cache bersuffix tahun disasarkan kepada 2026-2031.
