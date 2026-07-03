/**
 * KONFIGURASI NAMA TAB SHEET
 */
const DATA_SHEET     = 'DATA';
const CATEGORY_SHEET = 'KATEGORI';
const EV_SHEET       = 'EV_CHARGING';
const CPO_SHEET      = 'JENIS_CPO';
const PETROL_SHEET   = 'MINYAK';
const BIL_TEMPLATE_SHEET = 'BIL_TEMPLATE';
const BIL_REKOD_SHEET    = 'BIL_REKOD';
const SOLAR_SHEET        = 'SOLAR';

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
  // Kosongkan semua cache berkaitan perbelanjaan
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

/**
 * HELPER: Sanitize input untuk elakkan XSS
 */
function sanitize(str, maxLength) {
  maxLength = maxLength || 500;
  if (!str) return '';
  return str.toString().trim().substring(0, maxLength);
}

/**
 * HELPER: Validate date format
 */
function isValidDate(dateStr) {
  if (!dateStr) return false;
  var d = new Date(dateStr);
  return d instanceof Date && !isNaN(d);
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('🔒 Main Finance Hub 🔒')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}


// ============================================================
//   MODUL 1: BELANJA
// ============================================================

function getCategories() {
  var cached = cacheGet('categories');
  if (cached) return JSON.parse(cached);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CATEGORY_SHEET);
  if (!sheet) return [{ name: 'Umum', icon: '🕵🏼' }];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [{ name: 'Umum', icon: '🕵🏼' }];
  
  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var result = data.map(function(row) {
    return {
      name: row[0] || 'Umum',
      icon: row[1] || '🕵🏼'
    };
  }).filter(function(cat) { return cat.name; });

  cacheSet('categories', JSON.stringify(result), TTL_LONG);
  return result;
}

function getTransactions(month, year) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues()
.map(function(row, index) { return { rowId: index + 2, date: row[0], amount: row[1], category: row[2], note: row[3], payment: row[4] }; })
    .filter(function(item) { var d = new Date(item.date); return (month ? (d.getMonth()+1) == month : true) && (d.getFullYear() == year); })
    .map(function(item) { return Object.assign({}, item, { date: item.date instanceof Date ? Utilities.formatDate(item.date,'GMT+8','yyyy-MM-dd') : item.date }); });
}

function getYearlyData(year) {
  var ck = 'yearly_data_' + year;
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
  var data  = Array(12).fill(0);
  if (!sheet || sheet.getLastRow() < 2) {
    cacheSet(ck, JSON.stringify(data));
    return data;
  }
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function(row) {
    var d = new Date(row[0]);
    if (d.getFullYear() == year) data[d.getMonth()] += parseFloat(row[1] || 0);
  });
  cacheSet(ck, JSON.stringify(data));
  return data;
}

/**
 * NEW FUNCTION: Get 3-month category trend
 */
function getCategoryTrend(month, year) {
    var ck = 'trend_' + month + '_' + year;
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return {};
    var today = new Date();
  var m = month ? parseInt(month) : (today.getMonth() + 1);
  var y = year  ? parseInt(year)  : today.getFullYear();
  
  var categories = getCategories();
  var result = {};
  
  categories.forEach(function(cat) {
    result[cat.name] = {
      icon: cat.icon,
      months: [
        { month: getPreviousMonth(m, y, 2), total: 0, count: 0 },
        { month: getPreviousMonth(m, y, 1), total: 0, count: 0 },
        { month: { m: m, y: y }, total: 0, count: 0 }
      ]
    };
  });
  
  var allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  
  allData.forEach(function(row) {
    var d = new Date(row[0]);
    var rowMonth = d.getMonth() + 1;
    var rowYear = d.getFullYear();
    var amount = parseFloat(row[1] || 0);
    var category = row[2];
    
    if (!result[category]) return;
    
    result[category].months.forEach(function(monthData) {
      if (monthData.month.m == rowMonth && monthData.month.y == rowYear) {
        monthData.total += amount;
        monthData.count += 1;
      }
    });
  });
    cacheSet(ck, JSON.stringify(result));
  return result;
}

function getPreviousMonth(month, year, offset) {
  var m = parseInt(month);
  var y = parseInt(year);
  
  for (var i = 0; i < offset; i++) {
    m--;
    if (m < 1) {
      m = 12;
      y--;
    }
  }
  
  return { m: m, y: y };
}

function addTransaction(data) {
  if (!data) throw new Error('Data tidak diberikan');
  if (!isValidDate(data.date)) throw new Error('Tarikh tidak sah');
  if (!data.amount || parseFloat(data.amount) <= 0) throw new Error('Amaun mesti lebih dari 0');
  if (!data.category) throw new Error('Kategori diperlukan');
  
  var safeAmount = parseFloat(data.amount);
  var safeCategory = sanitize(data.category, 100);
  var safeNote = sanitize(data.note, 500);
  var safePayment = sanitize(data.payment, 50) || '💵 Cash';
  
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET)
.appendRow([new Date(data.date), safeAmount, safeCategory, safeNote, safePayment]);
invalidateExpenseCache();
  return { status: 'success', message: 'Transaksi berjaya ditambah' };
}

function updateTransaction(data) {
  if (!data) throw new Error('Data tidak diberikan');
  if (!data.rowId) throw new Error('ID transaksi diperlukan');
  if (!isValidDate(data.date)) throw new Error('Tarikh tidak sah');
  if (!data.amount || parseFloat(data.amount) <= 0) throw new Error('Amaun mesti lebih dari 0');
  if (!data.category) throw new Error('Kategori diperlukan');
  
  var safeRowId = parseInt(data.rowId);
  var safeAmount = parseFloat(data.amount);
  var safeCategory = sanitize(data.category, 100);
  var safeNote = sanitize(data.note, 500);
  var safePayment = sanitize(data.payment, 50) || '💵 Cash';
  
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET)
    .getRange(safeRowId, 1, 1, 5)
.setValues([[new Date(data.date), safeAmount, safeCategory, safeNote, safePayment]]);
invalidateExpenseCache();
  return { status: 'success', message: 'Transaksi berjaya dikemaskini' };
}

function deleteTransaction(rowId) {
  if (!rowId) throw new Error('ID transaksi diperlukan');
  var safeRowId = parseInt(rowId);
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET).deleteRow(safeRowId);
  invalidateExpenseCache();
  return { status: 'success', message: 'Transaksi berjaya dipadam' };
}

function addBulkTransactions(rows) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    throw new Error('Tiada data untuk ditambah');
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
  var dataToAppend = [];
  
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!isValidDate(r.date)) throw new Error('Baris ' + (i+1) + ': Tarikh tidak sah');
    if (!r.amount || parseFloat(r.amount) <= 0) throw new Error('Baris ' + (i+1) + ': Amaun mesti lebih dari 0');
    if (!r.category) throw new Error('Baris ' + (i+1) + ': Kategori diperlukan');
    
dataToAppend.push([
  new Date(r.date),
  parseFloat(r.amount),
  sanitize(r.category, 100),
  sanitize(r.note, 500),
  sanitize(r.payment, 50) || '💵 Cash'
]);
  }
  
  sheet.getRange(sheet.getLastRow() + 1, 1, dataToAppend.length, 5).setValues(dataToAppend);
  invalidateExpenseCache();
  return { status: 'success', message: dataToAppend.length + ' transaksi berjaya ditambah' };
}

function getBatchExpenseData(month, year) {
  var trend = {};
  try {
    trend = getCategoryTrend(month, year);
  } catch(e) {
    // Silent fail - category trend is optional
  }
  
  return {
    transactions  : getTransactions(month, year),
    yearlyData    : getYearlyData(year),
    categoryTrend : trend
  };
}


// ============================================================
//   MODUL 2: EV TRACKER
// ============================================================

function getCPOTypes() {
  var cached = cacheGet('cpo_types');
  if (cached) return JSON.parse(cached);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CPO_SHEET);
  if (!sheet) return ['Lain-lain'];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return ['Lain-lain'];
  var result = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().filter(String);

  cacheSet('cpo_types', JSON.stringify(result), TTL_LONG);
  return result;
}

function addEVCharging(data) {
  if (!data) throw new Error('Data tidak diberikan');
  if (!isValidDate(data.date)) throw new Error('Tarikh tidak sah');
  if (!data.type) throw new Error('Jenis cas diperlukan');
  if (!data.kwh || parseFloat(data.kwh) <= 0) throw new Error('kWh mesti lebih dari 0');
  if (!data.pricePerKwh || parseFloat(data.pricePerKwh) <= 0) throw new Error('Harga/kWh mesti lebih dari 0');
  
  var safeType = sanitize(data.type, 50);
  var safeKwh = parseFloat(data.kwh);
  var safePrice = parseFloat(data.pricePerKwh);
  var total = safeKwh * safePrice;
  
  var cpo = safeType === 'Rumah' ? 'Rumah' : sanitize(data.cpo, 100);
  var location = safeType === 'Rumah' ? 'Kediaman' : sanitize(data.location, 200);
  
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EV_SHEET)
    .appendRow([new Date(data.date), safeType, cpo, safeKwh, safePrice, location, total]);
    invalidateEVCache();
  return { status: 'success', message: 'Rekod cas berjaya ditambah' };
}

function updateEVCharging(data) {
  if (!data) throw new Error('Data tidak diberikan');
  if (!data.rowId) throw new Error('ID rekod diperlukan');
  if (!isValidDate(data.date)) throw new Error('Tarikh tidak sah');
  if (!data.type) throw new Error('Jenis cas diperlukan');
  if (!data.kwh || parseFloat(data.kwh) <= 0) throw new Error('kWh mesti lebih dari 0');
  if (!data.pricePerKwh || parseFloat(data.pricePerKwh) <= 0) throw new Error('Harga/kWh mesti lebih dari 0');
  
  var safeRowId = parseInt(data.rowId);
  var safeType = sanitize(data.type, 50);
  var safeKwh = parseFloat(data.kwh);
  var safePrice = parseFloat(data.pricePerKwh);
  var total = safeKwh * safePrice;
  
  var cpo = safeType === 'Rumah' ? 'Rumah' : sanitize(data.cpo, 100);
  var location = safeType === 'Rumah' ? 'Kediaman' : sanitize(data.location, 200);
  
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EV_SHEET)
    .getRange(safeRowId, 1, 1, 7)
    .setValues([[new Date(data.date), safeType, cpo, safeKwh, safePrice, location, total]]);
    invalidateEVCache();
  return { status: 'success', message: 'Rekod cas berjaya dikemaskini' };
}

function getEVData(month, year) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EV_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues()
    .map(function(row, index) { return { rowId: index+2, date: row[0], type: row[1], cpo: row[2], kwh: row[3], pricePerKwh: row[4], location: row[5], total: row[6] }; })
    .filter(function(item) { var d = new Date(item.date); return (month ? (d.getMonth()+1)==month : true) && (d.getFullYear()==year); })
    .map(function(item) { return Object.assign({}, item, { date: item.date instanceof Date ? Utilities.formatDate(item.date,'GMT+8','yyyy-MM-dd') : item.date }); })
    .reverse();
}

function deleteEVData(rowId) {
  if (!rowId) throw new Error('ID rekod diperlukan');
  var safeRowId = parseInt(rowId);
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EV_SHEET).deleteRow(safeRowId);
  invalidateEVCache();
  return { status: 'success', message: 'Rekod cas berjaya dipadam' };
}

function getEVYearlyData(year) {
  var ck = 'evyearly_data_' + year;
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);

  var data = Array(12).fill(0);
  var evSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EV_SHEET);
  if (evSheet && evSheet.getLastRow() >= 2) {
    evSheet.getRange(2, 1, evSheet.getLastRow()-1, 7).getValues().forEach(function(row) {
      var d = new Date(row[0]);
      if (d.getFullYear() == year) data[d.getMonth()] += parseFloat(row[6] || 0);
    });
  }
  var petrolSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PETROL_SHEET);
  if (petrolSheet && petrolSheet.getLastRow() >= 2) {
    petrolSheet.getRange(2, 1, petrolSheet.getLastRow()-1, 5).getValues().forEach(function(row) {
      var d = new Date(row[0]);
      if (d.getFullYear() == year) data[d.getMonth()] += parseFloat(row[4] || 0);
    });
  }
  cacheSet(ck, JSON.stringify(data));
  return data;
}

function getBatchEVData(month, year) {
  return {
    evData      : getEVData(month, year),
    petrolData  : getPetrolData(month, year),
    yearlyData  : getEVYearlyData(year)
  };
}


// ============================================================
//   MODUL 3: MINYAK
// ============================================================

function addPetrolRecord(data) {
  if (!data) throw new Error('Data tidak diberikan');
  if (!isValidDate(data.date)) throw new Error('Tarikh tidak sah');
  if (!data.station) throw new Error('Stesen diperlukan');
  if (!data.liter || parseFloat(data.liter) <= 0) throw new Error('Liter mesti lebih dari 0');
  
  var safeStation = sanitize(data.station, 100);
  var liter = parseFloat(data.liter);
  var price = parseFloat(data.pricePerLiter) || 1.99;
  var total = liter * price;
  var safeNote = sanitize(data.note, 500);
  
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PETROL_SHEET)
    .appendRow([new Date(data.date), safeStation, liter, price, total, safeNote]);
    invalidateEVCache();
  return { status: 'success', message: 'Rekod minyak berjaya ditambah' };
}

function updatePetrolRecord(data) {
  if (!data) throw new Error('Data tidak diberikan');
  if (!data.rowId) throw new Error('ID rekod diperlukan');
  if (!isValidDate(data.date)) throw new Error('Tarikh tidak sah');
  if (!data.station) throw new Error('Stesen diperlukan');
  if (!data.liter || parseFloat(data.liter) <= 0) throw new Error('Liter mesti lebih dari 0');
  
  var safeRowId = parseInt(data.rowId);
  var safeStation = sanitize(data.station, 100);
  var liter = parseFloat(data.liter);
  var price = parseFloat(data.pricePerLiter) || 1.99;
  var total = liter * price;
  var safeNote = sanitize(data.note, 500);
  
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PETROL_SHEET)
    .getRange(safeRowId, 1, 1, 6)
    .setValues([[new Date(data.date), safeStation, liter, price, total, safeNote]]);
    invalidateEVCache();
  return { status: 'success', message: 'Rekod minyak berjaya dikemaskini' };
}

function getPetrolData(month, year) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PETROL_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow()-1, 6).getValues()
    .map(function(row, index) { return { rowId: index+2, date: row[0], station: row[1], liter: row[2], pricePerLiter: row[3], total: row[4], note: row[5] }; })
    .filter(function(item) { var d = new Date(item.date); return (month ? (d.getMonth()+1)==month : true) && (d.getFullYear()==year); })
    .map(function(item) { return Object.assign({}, item, { date: item.date instanceof Date ? Utilities.formatDate(item.date,'GMT+8','yyyy-MM-dd') : item.date }); })
    .reverse();
}

function deletePetrolRecord(rowId) {
  if (!rowId) throw new Error('ID rekod diperlukan');
  var safeRowId = parseInt(rowId);
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PETROL_SHEET).deleteRow(safeRowId);
  invalidateEVCache();
  return { status: 'success', message: 'Rekod minyak berjaya dipadam' };
}


// ============================================================
//   MODUL 4: BIL BULANAN
// ============================================================

function getBilTemplate() {
  var ck = 'bil_template';
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BIL_TEMPLATE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  var result = data.map(function(row, idx) {
    return {
      rowId: idx + 2,
      nama: row[0] || '',
      kategori: row[1] || 'Lain-lain',
      anggaran: parseFloat(row[2]) || 0,
      tetap: (row[3] || '').toString().toLowerCase() === 'ya',
      lokasi: row[4] || 'Lain-lain',
      ikonLokasi: row[5] || '',
      ikonKategori: row[6] || ''
    };
  }).filter(function(b) { return b.nama; });

  cacheSet(ck, JSON.stringify(result), TTL_LONG);
  return result;
}

function initBilMonth(month, year) {
  var m = parseInt(month);
  var y = parseInt(year);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BIL_REKOD_SHEET);
  if (!sheet) return { status: 'error', message: 'Sheet BIL_REKOD tidak wujud' };

  var lastRow = sheet.getLastRow();
  var existing = {};
  if (lastRow >= 2) {
    var all = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    all.forEach(function(row) {
      if (parseInt(row[0]) === y && parseInt(row[1]) === m) {
        existing[row[3]] = true;
      }
    });
  }

  var template = getBilTemplate();
  var newRows = [];

  template.forEach(function(t) {
    if (!existing[t.nama]) {
      newRows.push([y, m, t.lokasi, t.nama, t.kategori, t.anggaran, 'Belum', '']);
    }
  });

  if (newRows.length > 0) {
    if (lastRow < 2) {
      sheet.getRange(2, 1, newRows.length, 8).setValues(newRows);
    } else {
      sheet.getRange(lastRow + 1, 1, newRows.length, 8).setValues(newRows);
    }
  }

  invalidateBilCache();
  return { status: 'success', created: newRows.length, already: Object.keys(existing).length };
}

function getBilRekod(month, year) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BIL_REKOD_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues()
    .map(function(row, index) {
      return {
        rowId: index + 2,
        tahun: parseInt(row[0]),
        bulan: parseInt(row[1]),
        lokasi: row[2] || '',
        nama: row[3] || '',
        kategori: row[4] || '',
        amaun: parseFloat(row[5]) || 0,
        status: row[6] || 'Belum',
        tarikhBayar: row[7] instanceof Date ? Utilities.formatDate(row[7], 'GMT+8', 'yyyy-MM-dd') : (row[7] || '')
      };
    })
    .filter(function(item) {
      return (month ? item.bulan == month : true) && (item.tahun == year);
    });
}

function toggolBilStatus(rowId) {
  if (!rowId) throw new Error('ID rekod diperlukan');
  var safeRowId = parseInt(rowId);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BIL_REKOD_SHEET);
  var row = sheet.getRange(safeRowId, 1, 1, 8).getValues()[0];
  var currentStatus = row[6] || 'Belum';
  var newStatus = currentStatus === 'Dibayar' ? 'Belum' : 'Dibayar';
  var bayarDate = newStatus === 'Dibayar' ? new Date() : '';

  sheet.getRange(safeRowId, 7, 1, 2).setValues([[newStatus, bayarDate]]);
  invalidateBilCache();
  return { status: 'success', bilStatus: newStatus, tarikhBayar: bayarDate instanceof Date ? Utilities.formatDate(bayarDate, 'GMT+8', 'yyyy-MM-dd') : '' };
}

function kemaskiniBilAmount(rowId, amaunBaru) {
  if (!rowId) throw new Error('ID rekod diperlukan');
  var amt = parseFloat(amaunBaru);
  if (isNaN(amt) || amt <= 0) throw new Error('Amaun mesti lebih dari 0');

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BIL_REKOD_SHEET);
  sheet.getRange(parseInt(rowId), 6).setValue(amt);
  invalidateBilCache();
  return { status: 'success', amaun: amt };
}

function getBilSummary(month, year) {
  var rekod = getBilRekod(month, year);
  var dibayar = 0, belum = 0;
  var byLokasi = {};

  rekod.forEach(function(r) {
    if (r.status === 'Dibayar') dibayar += r.amaun;
    else belum += r.amaun;

    if (!byLokasi[r.lokasi]) byLokasi[r.lokasi] = { total: 0, dibayar: 0, count: 0, done: 0 };
    byLokasi[r.lokasi].total += r.amaun;
    byLokasi[r.lokasi].count++;
    if (r.status === 'Dibayar') { byLokasi[r.lokasi].dibayar += r.amaun; byLokasi[r.lokasi].done++; }
  });

  return {
    rekod: rekod,
    jumlahDibayar: dibayar,
    jumlahBelum: belum,
    jumlahKeseluruhan: dibayar,
    byLokasi: byLokasi
  };
}

function getBilYearlyData(year) {
  var data = Array(12).fill(0);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BIL_REKOD_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return data;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues().forEach(function(row) {
    if (parseInt(row[0]) == year && row[6] === 'Dibayar') {
      data[parseInt(row[1]) - 1] += parseFloat(row[5] || 0);
    }
  });
  return data;
}

function invalidateBilCache() {
  cacheDel('bil_template');
}

function tandaiSemuaBilLokasi(month, year, lokasi) {
  var m = parseInt(month);
  var y = parseInt(year);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BIL_REKOD_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return { status: 'success', count: 0 };

  var lastRow = sheet.getLastRow();
  var allData = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var today = new Date();
  var count = 0;
  var updates = [];

  for (var i = 0; i < allData.length; i++) {
    var row = allData[i];
    if (parseInt(row[0]) === y && parseInt(row[1]) === m && row[2] === lokasi && (row[6] !== 'Dibayar')) {
      updates.push({ range: sheet.getRange(i + 2, 7, 1, 2), values: [['Dibayar', today]] });
      count++;
    }
  }

  if (count > 0) {
    for (var j = 0; j < updates.length; j++) {
      updates[j].range.setValues(updates[j].values);
    }
  }

  invalidateBilCache();
  return { status: 'success', count: count };
}


// ============================================================
//   MODUL 5: SOLAR
// ============================================================

function getSolarData(month, year) {
  var ck = 'solar_data_' + (year || 'all') + '_' + (month || 'all');
  if (month && year) {
    var cached = cacheGet(ck);
    if (cached) return JSON.parse(cached);
  }
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SOLAR_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var result = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues()
    .map(function(row, index) {
      return {
        rowId: index + 2,
        tahun: parseInt(row[0]),
        bulan: parseInt(row[1]),
        janaTNB: parseFloat(row[2]) || 0,
        gunaTNB: parseFloat(row[3]) || 0,
        baki: parseFloat(row[4]) || 0,
        jumlahBaki: parseFloat(row[5]) || 0,
        janaApps: parseFloat(row[6]) || 0,
        luarGrid: parseFloat(row[7]) || 0
      };
    })
    .filter(function(item) {
      return (!month || item.bulan == month) && (!year || item.tahun == year);
    })
    .sort(function(a, b) {
      if (a.tahun !== b.tahun) return a.tahun - b.tahun;
      return a.bulan - b.bulan;
    });
  if (month && year) cacheSet(ck, JSON.stringify(result), TTL_SHORT);
  return result;
}

function addSolarRecord(data) {
  if (!data) throw new Error('Data tidak diberikan');
  if (!data.bulan || !data.tahun) throw new Error('Bulan dan tahun diperlukan');
  if (!data.janaTNB || parseFloat(data.janaTNB) < 0) throw new Error('Jana TNB mesti >= 0');
  if (!data.gunaTNB || parseFloat(data.gunaTNB) < 0) throw new Error('Guna TNB mesti >= 0');

  var janaTNB = parseFloat(data.janaTNB);
  var gunaTNB = parseFloat(data.gunaTNB);
  var janaApps = parseFloat(data.janaApps) || 0;
  var bulan = parseInt(data.bulan);
  var tahun = parseInt(data.tahun);

  var baki = janaTNB - gunaTNB;
  var luarGrid = janaApps - janaTNB;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SOLAR_SHEET);
  var lastRow = sheet.getLastRow();
  var jumlahBaki = 0;

  if (lastRow >= 2) {
    var allRows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    allRows.forEach(function(r) {
      var rBulan = parseInt(r[1]); var rTahun = parseInt(r[0]);
      if (rTahun < tahun || (rTahun === tahun && rBulan <= bulan)) {
        if (rTahun === tahun && rBulan === bulan) return;
        jumlahBaki += parseFloat(r[4] || 0);
      }
    });
  }
  jumlahBaki += baki;

  sheet.appendRow([tahun, bulan, janaTNB, gunaTNB, baki, jumlahBaki, janaApps, luarGrid]);
  invalidateSolarCache();
  return { status: 'success', message: 'Rekod solar berjaya ditambah' };
}

function updateSolarRecord(data) {
  if (!data || !data.rowId) throw new Error('ID rekod diperlukan');
  if (!data.janaTNB || parseFloat(data.janaTNB) < 0) throw new Error('Jana TNB mesti >= 0');
  if (!data.gunaTNB || parseFloat(data.gunaTNB) < 0) throw new Error('Guna TNB mesti >= 0');

  var safeRowId = parseInt(data.rowId);
  var janaTNB = parseFloat(data.janaTNB);
  var gunaTNB = parseFloat(data.gunaTNB);
  var janaApps = parseFloat(data.janaApps) || 0;
  var baki = janaTNB - gunaTNB;
  var luarGrid = janaApps - janaTNB;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SOLAR_SHEET);
  var row = sheet.getRange(safeRowId, 1, 1, 8).getValues()[0];
  var bulan = row[1];
  var tahun = row[0];

  var lastRow = sheet.getLastRow();
  var jumlahBaki = 0;
  if (lastRow >= 2) {
    var allRows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    allRows.forEach(function(r, idx) {
      var rBulan = parseInt(r[1]); var rTahun = parseInt(r[0]);
      if (idx + 2 === safeRowId) return;
      if (rTahun < tahun || (rTahun === tahun && rBulan <= bulan)) {
        jumlahBaki += parseFloat(r[4] || 0);
      }
    });
  }
  jumlahBaki += baki;

  sheet.getRange(safeRowId, 1, 1, 8).setValues([[tahun, bulan, janaTNB, gunaTNB, baki, jumlahBaki, janaApps, luarGrid]]);
  invalidateSolarCache();
  return { status: 'success', message: 'Rekod solar berjaya dikemaskini' };
}

function deleteSolarRecord(rowId) {
  if (!rowId) throw new Error('ID rekod diperlukan');
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SOLAR_SHEET).deleteRow(parseInt(rowId));
  invalidateSolarCache();
  return { status: 'success', message: 'Rekod solar berjaya dipadam' };
}

function getSolarYearlyData(year) {
  var ck = 'solar_yearly_' + year;
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);

  var data = { jana: Array(12).fill(0), guna: Array(12).fill(0), baki: Array(12).fill(0), kumulatif: Array(12).fill(0), luarGrid: Array(12).fill(0) };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SOLAR_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return data;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  var running = 0;
  for (var i = 0; i < 12; i++) {
    var found = false;
    rows.forEach(function(r) {
      if (parseInt(r[0]) == year && parseInt(r[1]) === i + 1) {
        data.jana[i] = parseFloat(r[2] || 0);
        data.guna[i] = parseFloat(r[3] || 0);
        data.baki[i] = parseFloat(r[4] || 0);
        data.luarGrid[i] = parseFloat(r[7] || 0);
        running += parseFloat(r[4] || 0);
        found = true;
      }
    });
    if (found) data.kumulatif[i] = running;
  }
  cacheSet(ck, JSON.stringify(data), TTL_SHORT);
  return data;
}

function getSolarBatch(month, year) {
  return {
    records: getSolarData(month, year),
    yearly: getSolarYearlyData(year)
  };
}

function invalidateSolarCache() {
  var cache = CacheService.getScriptCache();
  // Remove all solar data cache keys
  var years = [2025, 2026, 2027, 2028, 2029, 2030, 2031];
  var months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (var i = 0; i < years.length; i++) {
    for (var j = 0; j < months.length; j++) {
      cache.remove('solar_data_' + years[i] + '_' + months[j]);
    }
    cache.remove('solar_yearly_' + years[i]);
  }
}


function getBatchSummaryData(month, year) {
  var prevMonth = month ? (parseInt(month) === 1 ? 12        : parseInt(month) - 1) : '';
  var prevYear  = month ? (parseInt(month) === 1 ? parseInt(year) - 1 : year)       : year;

  // Baca transaksi semua bulan dari satu bacaan sheet
  var allExp = getTransactions('', year);  // kosong = semua bulan
  
  var expData     = month ? allExp.filter(function(t) { var d = new Date(t.date); return (d.getMonth()+1) == month; }) : allExp;
  var prevExpData = month ? allExp.filter(function(t) { var d = new Date(t.date); return (d.getMonth()+1) == prevMonth; }) : [];

  return {
    expData      : expData,
    evData       : getEVData(month, year),
    petrolData   : getPetrolData(month, year),
    bilData      : getBilSummary(month, year),
    prevExpData  : prevExpData,
    prevEvData   : prevMonth ? getEVData(prevMonth, prevYear) : [],
    prevPetData  : prevMonth ? getPetrolData(prevMonth, prevYear) : [],
    prevBilData  : prevMonth ? getBilSummary(prevMonth, prevYear) : { jumlahKeseluruhan: 0 },
    expYearly    : getYearlyData(year),
    evYearly     : getEVYearlyData(year),
    bilYearly    : getBilYearlyData(year)
  };
}