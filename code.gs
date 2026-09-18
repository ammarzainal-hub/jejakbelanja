/**
 * KONFIGURASI NAMA TAB SHEET
 */
const DATA_SHEET     = 'DATA';
const CATEGORY_SHEET = 'KATEGORI';
const EV_SHEET       = 'EV_CHARGING';
const CPO_SHEET      = 'JENIS_CPO';
const PETROL_SHEET   = 'MINYAK';
const SETTINGS_SHEET = 'SETTINGS';
const PETROL_STATION_SHEET = 'STESEN_MINYAK';
const PAYMENT_METHOD_SHEET = 'PAYMENT_METHOD';
const BIL_TEMPLATE_SHEET = 'BIL_TEMPLATE';
const BIL_REKOD_SHEET    = 'BIL_REKOD';
const SOLAR_SHEET        = 'SOLAR';
const DEFAULT_HOME_KWH_PRICE = 0.4443;
const DEFAULT_PETROL_PRICE = 1.99;
const MAX_BULK_ROWS = 50;
const MAX_EXPENSE_AMOUNT = 999999;
const MAX_BIL_AMOUNT = 999999;
const MAX_EV_KWH = 1000;
const MAX_EV_PRICE_PER_KWH = 50;
const MAX_PETROL_LITER = 999;
const MAX_PETROL_PRICE_PER_LITER = 20;
const MAX_SOLAR_KWH = 99999;
const BACKUP_FOLDER_ID = '1CUBYnUyAC9sIjxQCopmHwqB-fgopyQzB';

function getAppConfig() {
  ensureReferenceSheets();
  return {
    defaultHomeKwhPrice: getSettingValue('DEFAULT_HOME_KWH_PRICE', DEFAULT_HOME_KWH_PRICE, 'number'),
    defaultPetrolPrice: getSettingValue('DEFAULT_PETROL_PRICE', DEFAULT_PETROL_PRICE, 'number'),
    maxBulkRows: getSettingValue('MAX_BULK_ROWS', MAX_BULK_ROWS, 'number'),
    paymentMethods: getPaymentMethods(false),
    petrolStations: getPetrolStations(false)
  };
}

// ============================================================
//   CACHE SERVICE HELPERS
// ============================================================
const CACHE = CacheService.getScriptCache();
const TTL_SHORT = 7200;   // 2 jam — untuk yearly & trend
const TTL_LONG  = 21600;  // 6 jam — untuk kategori & CPO
var CACHE_YEARS = [2026, 2027, 2028, 2029, 2030, 2031];
var CACHE_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function cacheGet(key) {
  try { return CACHE.get(key); } catch (e) { return null; }
}
function cacheSet(key, val, ttl) {
  try { CACHE.put(key, val, ttl || TTL_SHORT); } catch (e) { /* penuh */ }
}
function cacheDel(key) {
  try { CACHE.remove(key); } catch (e) { /* abaikan */ }
}

function getOptionalSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function getRequiredSheet(name) {
  var sheet = getOptionalSheet(name);
  if (!sheet) throw new Error('Sheet "' + name + '" tidak wujud');
  return sheet;
}

function invalidateExpenseCache() {
  // Kosongkan semua cache berkaitan perbelanjaan (kunci bersuffix tahun/bulan)
  cacheDel('categories');
  CACHE_YEARS.forEach(function(y) {
    cacheDel('yearly_data_' + y);
    cacheDel('trend_' + '_' + y);
    CACHE_MONTHS.forEach(function(m) {
      cacheDel('trend_' + m + '_' + y);
    });
  });
}

function invalidateEVCache() {
  CACHE_YEARS.forEach(function(y) { cacheDel('evyearly_data_' + y); });
}

function clearDashboardCache() {
  invalidateExpenseCache();
  invalidateEVCache();
  clearReferenceCache();
  cacheDel('cpo_types');
  invalidateBilTemplateCache();
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

function clearReferenceCache() {
  cacheDel('app_settings');
  cacheDel('payment_methods');
  cacheDel('petrol_stations');
}

function getHeaderMap(sheet) {
  var map = {};
  if (!sheet || sheet.getLastColumn() < 1) return map;
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].forEach(function(h, i) {
    var key = normalizeHeaderName(h);
    if (key) map[key] = i;
  });
  return map;
}

function ensureSheetHeaders(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1 || !sheet.getRange(1, 1).getValue()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  var map = getHeaderMap(sheet);
  headers.forEach(function(header) {
    if (map[normalizeHeaderName(header)] === undefined) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
    }
  });
  return sheet;
}

function ensureDefaultRows(sheet, rows, keyColumn) {
  if (sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    return;
  }
  var existing = {};
  sheet.getRange(2, keyColumn, sheet.getLastRow() - 1, 1).getValues().forEach(function(row) {
    existing[sanitize(row[0], 100).toLowerCase()] = true;
  });
  var missing = rows.filter(function(row) { return !existing[sanitize(row[keyColumn - 1], 100).toLowerCase()]; });
  if (missing.length) sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, missing[0].length).setValues(missing);
}

function fillReferenceDefaults(sheetName, nameHeaders) {
  var sheet = ensureSheetHeaders(sheetName, nameHeaders);
  if (sheet.getLastRow() < 2) return sheet;
  var map = getHeaderMap(sheet);
  var activeCol = map.aktif;
  var orderCol = map.susunan;
  var width = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  var changed = false;
  values.forEach(function(row, i) {
    if (activeCol !== undefined && !row[activeCol]) { row[activeCol] = 'Ya'; changed = true; }
    if (orderCol !== undefined && (row[orderCol] === '' || row[orderCol] === null)) { row[orderCol] = i + 1; changed = true; }
  });
  if (changed) sheet.getRange(2, 1, values.length, width).setValues(values);
  return sheet;
}

function ensureReferenceSheets() {
  var settings = ensureSheetHeaders(SETTINGS_SHEET, ['KEY', 'VALUE', 'TYPE', 'MODULE', 'CATATAN']);
  ensureDefaultRows(settings, [
    ['DEFAULT_HOME_KWH_PRICE', DEFAULT_HOME_KWH_PRICE, 'number', 'EV', 'Harga cas rumah RM/kWh'],
    ['DEFAULT_PETROL_PRICE', DEFAULT_PETROL_PRICE, 'number', 'MINYAK', 'Harga petrol default RM/L'],
    ['MAX_BULK_ROWS', MAX_BULK_ROWS, 'number', 'SYSTEM', 'Had rekod pukal']
  ], 1);
  ensureDefaultRows(ensureSheetHeaders(PETROL_STATION_SHEET, ['NAMA', 'AKTIF', 'SUSUNAN']), [
    ['Petronas', 'Ya', 1], ['Shell', 'Ya', 2], ['BHP', 'Ya', 3], ['Caltex', 'Ya', 4], ['Petron', 'Ya', 5]
  ], 1);
  ensureDefaultRows(ensureSheetHeaders(PAYMENT_METHOD_SHEET, ['NAMA', 'AKTIF', 'SUSUNAN']), [
    ['💳 CC', 'Ya', 1], ['𖣯 QR', 'Ya', 2], ['🏦 Transfer', 'Ya', 3], ['👛 E-Wallet', 'Ya', 4], ['💵 Cash', 'Ya', 5]
  ], 1);
  fillReferenceDefaults(CATEGORY_SHEET, ['NAMA', 'IKON', 'AKTIF', 'SUSUNAN']);
  fillReferenceDefaults(CPO_SHEET, ['NAMA', 'AKTIF', 'SUSUNAN']);
}

function getSettingsMap() {
  var cached = cacheGet('app_settings');
  if (cached) return JSON.parse(cached);
  ensureReferenceSheets();
  var sheet = getRequiredSheet(SETTINGS_SHEET);
  var map = {};
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues().forEach(function(row) {
      var key = sanitize(row[0], 100);
      if (key) map[key] = { value: row[1], type: sanitize(row[2], 30) };
    });
  }
  cacheSet('app_settings', JSON.stringify(map), TTL_LONG);
  return map;
}

function getSettingValue(key, fallback, type) {
  try {
    var item = getSettingsMap()[key];
    if (!item) return fallback;
    if (type === 'number') {
      var n = Number(item.value);
      return isFinite(n) ? n : fallback;
    }
    return item.value;
  } catch (e) {
    return fallback;
  }
}

function parseOptionalOrder(value) {
  if (value === '' || value === null || value === undefined) return '';
  var n = Number(value);
  if (!isFinite(n) || Math.floor(n) !== n || n < 0 || n > 9999) throw new Error('Susunan mesti nombor integer 0 hingga 9999');
  return n;
}

function readReferenceList(sheetName, config, skipEnsure) {
  if (!skipEnsure) ensureReferenceSheets();
  var sheet = getOptionalSheet(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var map = getHeaderMap(sheet);
  var nameCol = map.nama !== undefined ? map.nama : 0;
  var iconCol = config.hasIcon ? (map.ikon !== undefined ? map.ikon : 1) : -1;
  var activeCol = map.aktif;
  var orderCol = map.susunan;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues().map(function(row, idx) {
    var aktif = activeCol === undefined || !row[activeCol] ? 'Ya' : sanitize(row[activeCol], 20);
    return {
      rowId: idx + 2,
      name: sanitize(row[nameCol], 100),
      icon: config.hasIcon ? (sanitize(row[iconCol], 20) || '🕵🏼') : undefined,
      aktif: aktif === 'Tidak' ? 'Tidak' : 'Ya',
      susunan: orderCol === undefined ? '' : row[orderCol],
      _order: orderCol === undefined || row[orderCol] === '' || row[orderCol] === null || isNaN(Number(row[orderCol])) ? idx + 1 : Number(row[orderCol]),
      _idx: idx
    };
  }).filter(function(item) { return item.name; });
  rows.sort(function(a, b) { return a._order === b._order ? a._idx - b._idx : a._order - b._order; });
  return rows.map(function(item) { delete item._order; delete item._idx; return item; });
}

function saveReferenceItem(sheetName, payload, config) {
  return withWriteLock(function() {
    ensureReferenceSheets();
    payload = payload || {};
    var sheet = getRequiredSheet(sheetName);
    var map = getHeaderMap(sheet);
    var name = sanitize(payload.name, 100);
    if (!name) throw new Error('Nama diperlukan');
    var rowId = payload.rowId ? assertExistingRow(sheet, payload.rowId, 'ID rujukan') : null;
    var rows = readReferenceList(sheetName, config, true);
    rows.forEach(function(item) {
      if (item.name.toLowerCase() === name.toLowerCase() && item.rowId !== rowId) {
        throw new Error('Nama sudah wujud. Aktifkan semula item sedia ada jika perlu.');
      }
    });
    var values = [];
    values[map.nama !== undefined ? map.nama : 0] = name;
    if (config.hasIcon) values[map.ikon !== undefined ? map.ikon : 1] = sanitize(payload.icon, 20) || '🕵🏼';
    if (map.aktif !== undefined) values[map.aktif] = payload.aktif === 'Tidak' ? 'Tidak' : 'Ya';
    if (map.susunan !== undefined) values[map.susunan] = parseOptionalOrder(payload.susunan);
    var width = sheet.getLastColumn();
    if (rowId) {
      var current = sheet.getRange(rowId, 1, 1, width).getValues()[0];
      for (var i = 0; i < width; i++) if (values[i] !== undefined) current[i] = values[i];
      sheet.getRange(rowId, 1, 1, width).setValues([current]);
    } else {
      var row = Array(width).fill('');
      for (var j = 0; j < width; j++) if (values[j] !== undefined) row[j] = values[j];
      sheet.appendRow(row);
    }
    if (sheetName === CATEGORY_SHEET) invalidateExpenseCache();
    else if (sheetName === CPO_SHEET) cacheDel('cpo_types');
    else if (sheetName === PETROL_STATION_SHEET) cacheDel('petrol_stations');
    else if (sheetName === PAYMENT_METHOD_SHEET) cacheDel('payment_methods');
    return { status: 'success', message: 'Rujukan berjaya disimpan', items: readReferenceList(sheetName, config, true) };
  });
}

function setReferenceItemActive(sheetName, rowId, active, config) {
  return withWriteLock(function() {
    ensureReferenceSheets();
    var sheet = getRequiredSheet(sheetName);
    var safeRowId = assertExistingRow(sheet, rowId, 'ID rujukan');
    var map = getHeaderMap(sheet);
    if (map.aktif === undefined) throw new Error('Kolum AKTIF tidak wujud');
    if (active === false) {
      var activeCount = readReferenceList(sheetName, config, true).filter(function(item) { return item.aktif !== 'Tidak'; }).length;
      if (activeCount <= 1) throw new Error('Tidak boleh nyahaktif item aktif terakhir.');
    }
    sheet.getRange(safeRowId, map.aktif + 1).setValue(active === false ? 'Tidak' : 'Ya');
    if (sheetName === CATEGORY_SHEET) invalidateExpenseCache();
    else if (sheetName === CPO_SHEET) cacheDel('cpo_types');
    else if (sheetName === PETROL_STATION_SHEET) cacheDel('petrol_stations');
    else if (sheetName === PAYMENT_METHOD_SHEET) cacheDel('payment_methods');
    return { status: 'success', message: 'Status rujukan dikemaskini', items: readReferenceList(sheetName, config, true) };
  });
}

function updateSetting(key, value) {
  return withWriteLock(function() {
    ensureReferenceSheets();
    if (key !== 'DEFAULT_HOME_KWH_PRICE' && key !== 'DEFAULT_PETROL_PRICE') throw new Error('Tetapan tidak boleh dikemaskini');
    var max = key === 'DEFAULT_HOME_KWH_PRICE' ? MAX_EV_PRICE_PER_KWH : MAX_PETROL_PRICE_PER_LITER;
    var safeValue = parseRequiredPositiveNumberMax(value, key, max);
    var sheet = getRequiredSheet(SETTINGS_SHEET);
    var rows = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (sanitize(rows[i][0], 100) === key) {
        sheet.getRange(i + 2, 2).setValue(safeValue);
        cacheDel('app_settings');
        return { status: 'success', message: 'Tetapan berjaya disimpan', settings: { defaultHomeKwhPrice: getSettingValue('DEFAULT_HOME_KWH_PRICE', DEFAULT_HOME_KWH_PRICE, 'number'), defaultPetrolPrice: getSettingValue('DEFAULT_PETROL_PRICE', DEFAULT_PETROL_PRICE, 'number'), maxBulkRows: getSettingValue('MAX_BULK_ROWS', MAX_BULK_ROWS, 'number') } };
      }
    }
    throw new Error('Tetapan tidak wujud');
  });
}

function updateDefaultPrices(homePrice, petrolPrice) {
  return withWriteLock(function() {
    ensureReferenceSheets();
    var safeHomePrice = parseRequiredPositiveNumberMax(homePrice, 'Harga cas rumah', MAX_EV_PRICE_PER_KWH);
    var safePetrolPrice = parseRequiredPositiveNumberMax(petrolPrice, 'Harga petrol', MAX_PETROL_PRICE_PER_LITER);
    var sheet = getRequiredSheet(SETTINGS_SHEET);
    var width = sheet.getLastColumn();
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
    var homeFound = false;
    var petrolFound = false;

    values.forEach(function(row) {
      var key = sanitize(row[0], 100);
      if (key === 'DEFAULT_HOME_KWH_PRICE') {
        row[1] = safeHomePrice;
        homeFound = true;
      } else if (key === 'DEFAULT_PETROL_PRICE') {
        row[1] = safePetrolPrice;
        petrolFound = true;
      }
    });

    if (!homeFound || !petrolFound) throw new Error('Tetapan harga default tidak lengkap');
    sheet.getRange(2, 1, values.length, width).setValues(values);
    cacheDel('app_settings');
    return {
      status: 'success',
      message: 'Harga default berjaya disimpan',
      settings: {
        defaultHomeKwhPrice: safeHomePrice,
        defaultPetrolPrice: safePetrolPrice,
        maxBulkRows: getSettingValue('MAX_BULK_ROWS', MAX_BULK_ROWS, 'number')
      }
    };
  });
}

function getCategoriesForSettings() { return readReferenceList(CATEGORY_SHEET, { hasIcon: true }); }
function getCPOTypesForSettings() { return readReferenceList(CPO_SHEET, { hasIcon: false }); }
function getPaymentMethods(includeInactive) {
  var cached = !includeInactive && cacheGet('payment_methods');
  if (cached) return JSON.parse(cached);
  var result = readReferenceList(PAYMENT_METHOD_SHEET, { hasIcon: false });
  if (!includeInactive) result = result.filter(function(item) { return item.aktif !== 'Tidak'; }).map(function(item) { return item.name; });
  if (!includeInactive) cacheSet('payment_methods', JSON.stringify(result), TTL_LONG);
  return result;
}
function getPetrolStations(includeInactive) {
  var cached = !includeInactive && cacheGet('petrol_stations');
  if (cached) return JSON.parse(cached);
  var result = readReferenceList(PETROL_STATION_SHEET, { hasIcon: false });
  if (!includeInactive) result = result.filter(function(item) { return item.aktif !== 'Tidak'; }).map(function(item) { return item.name; });
  if (!includeInactive) cacheSet('petrol_stations', JSON.stringify(result), TTL_LONG);
  return result;
}
function getSettingsData() {
  return {
    settings: { defaultHomeKwhPrice: getSettingValue('DEFAULT_HOME_KWH_PRICE', DEFAULT_HOME_KWH_PRICE, 'number'), defaultPetrolPrice: getSettingValue('DEFAULT_PETROL_PRICE', DEFAULT_PETROL_PRICE, 'number'), maxBulkRows: getSettingValue('MAX_BULK_ROWS', MAX_BULK_ROWS, 'number') },
    categories: getCategoriesForSettings(),
    cpoTypes: getCPOTypesForSettings(),
    petrolStations: getPetrolStations(true),
    paymentMethods: getPaymentMethods(true)
  };
}
function saveCategory(payload) { return saveReferenceItem(CATEGORY_SHEET, payload, { hasIcon: true }); }
function setCategoryActive(rowId, active) { return setReferenceItemActive(CATEGORY_SHEET, rowId, active, { hasIcon: true }); }
function saveCPOType(payload) { return saveReferenceItem(CPO_SHEET, payload, { hasIcon: false }); }
function setCPOTypeActive(rowId, active) { return setReferenceItemActive(CPO_SHEET, rowId, active, { hasIcon: false }); }
function savePetrolStation(payload) { return saveReferenceItem(PETROL_STATION_SHEET, payload, { hasIcon: false }); }
function setPetrolStationActive(rowId, active) { return setReferenceItemActive(PETROL_STATION_SHEET, rowId, active, { hasIcon: false }); }
function savePaymentMethod(payload) { return saveReferenceItem(PAYMENT_METHOD_SHEET, payload, { hasIcon: false }); }
function setPaymentMethodActive(rowId, active) { return setReferenceItemActive(PAYMENT_METHOD_SHEET, rowId, active, { hasIcon: false }); }

function getWeekBackupLabel(date) {
  var d = date || new Date();
  var day = d.getDay();
  var diffToMonday = day === 0 ? -6 : 1 - day;
  var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  var sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  var start = Utilities.formatDate(monday, 'GMT+8', 'dd');
  var end = Utilities.formatDate(sunday, 'GMT+8', 'dd-MM-yyyy');
  return start + '/' + end;
}

function backupSpreadsheetNow() {
  return withWriteLock(function() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
    var filename = 'Backup Jejak Belanja ' + getWeekBackupLabel(new Date());
    var file = DriveApp.getFileById(ss.getId()).makeCopy(filename, folder);
    return { status: 'success', message: 'Backup berjaya dibuat: ' + filename, fileId: file.getId(), fileName: filename, url: file.getUrl() };
  });
}

function installWeeklyBackupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'backupSpreadsheetNow') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('backupSpreadsheetNow')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(23)
    .create();
  return { status: 'success', message: 'Trigger backup mingguan dipasang: Ahad 11 malam.' };
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.toString())) return false;
  var parts = dateStr.toString().split('-');
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var d = parseInt(parts[2], 10);
  var parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
}

function toSheetDate(dateStr) {
  if (!isValidDate(dateStr)) throw new Error('Tarikh tidak sah');
  var parts = dateStr.toString().split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

function isFutureDateString(dateStr) {
  var d = toSheetDate(dateStr);
  var today = todaySheetDate();
  return d.getTime() > today.getTime();
}

function todaySheetDate() {
  var today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function parseRowId(rowId, label) {
  var safeRowId = parseInt(rowId, 10);
  if (isNaN(safeRowId) || safeRowId < 2) throw new Error((label || 'ID rekod') + ' tidak sah');
  return safeRowId;
}

function normalizeHeaderName(value) {
  return sanitize(value, 200).toLowerCase().replace(/[\s_\-]+/g, '');
}

function sheetHasLeadingRecordId(sheet) {
  if (!sheet) return false;
  var firstCell = sheet.getRange(1, 1).getValue();
  return normalizeHeaderName(firstCell) === 'recordid';
}

function getSheetRecordOffset(sheet) {
  return sheetHasLeadingRecordId(sheet) ? 1 : 0;
}

function generateRecordId(prefix) {
  var stamp = Utilities.formatDate(new Date(), 'GMT+8', 'yyyyMMddHHmmss');
  var rand = Math.floor(Math.random() * 1000000).toString(36);
  return sanitize(prefix || 'REC', 20) + '-' + stamp + '-' + rand;
}

function fillMissingRecordIds(sheetName, prefix, baseColumns) {
  var sheet = getOptionalSheet(sheetName);
  if (!sheet || !sheetHasLeadingRecordId(sheet) || sheet.getLastRow() < 2) {
    return { sheet: sheetName, updated: 0 };
  }

  var width = baseColumns + 1;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  var updated = 0;

  rows = rows.map(function(row) {
    if (!row[0]) {
      row[0] = generateRecordId(prefix);
      updated++;
    }
    return row;
  });

  if (updated > 0) {
    sheet.getRange(2, 1, rows.length, width).setValues(rows);
  }

  return { sheet: sheetName, updated: updated };
}

function migrateRecordIds() {
  return [
    fillMissingRecordIds(DATA_SHEET, 'EXP', 5),
    fillMissingRecordIds(EV_SHEET, 'EV', 7),
    fillMissingRecordIds(PETROL_SHEET, 'PET', 6),
    fillMissingRecordIds(SOLAR_SHEET, 'SOL', 8)
  ];
}

function assertExistingRow(sheet, rowId, label) {
  var safeRowId = parseRowId(rowId, label);
  if (safeRowId > sheet.getLastRow()) throw new Error((label || 'ID rekod') + ' tidak wujud');
  return safeRowId;
}

function withWriteLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Sistem sedang menyimpan data. Cuba semula sebentar lagi.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function assertRecordIdMatches(sheet, rowId, recordId, label) {
  if (!sheetHasLeadingRecordId(sheet)) return;
  var expected = sanitize(recordId, 100);
  if (!expected) throw new Error((label || 'ID rekod') + ' tidak lengkap. Sila refresh data dan cuba lagi.');
  var actual = sanitize(sheet.getRange(rowId, 1).getValue(), 100);
  if (actual !== expected) throw new Error((label || 'ID rekod') + ' tidak sepadan. Sila refresh data dan cuba lagi.');
}

function getBilRecordKey(lokasi, nama) {
  return sanitize(lokasi, 200).toLowerCase() + '|' + sanitize(nama, 200).toLowerCase();
}

function parseRequiredPositiveNumber(value, label) {
  if (value === '' || value === null || value === undefined) throw new Error(label + ' diperlukan');
  var parsed = Number(value);
  if (!isFinite(parsed) || parsed <= 0) throw new Error(label + ' mesti lebih dari 0');
  return parsed;
}

function parseRequiredNonNegativeNumber(value, label) {
  if (value === '' || value === null || value === undefined) throw new Error(label + ' diperlukan');
  var parsed = Number(value);
  if (!isFinite(parsed) || parsed < 0) throw new Error(label + ' mesti >= 0');
  return parsed;
}

function parseOptionalPositiveNumberOrDefault(value, fallback, label) {
  if (value === '' || value === null || value === undefined) return fallback;
  var parsed = Number(value);
  if (!isFinite(parsed) || parsed <= 0) throw new Error(label + ' mesti lebih dari 0');
  return parsed;
}

function assertMaxNumber(value, max, label) {
  if (value > max) throw new Error(label + ' terlalu besar. Maksimum ' + max);
  return value;
}

function parseRequiredPositiveNumberMax(value, label, max) {
  return assertMaxNumber(parseRequiredPositiveNumber(value, label), max, label);
}

function parseRequiredNonNegativeNumberMax(value, label, max) {
  return assertMaxNumber(parseRequiredNonNegativeNumber(value, label), max, label);
}

function parseOptionalPositiveNumberOrDefaultMax(value, fallback, label, max) {
  return assertMaxNumber(parseOptionalPositiveNumberOrDefault(value, fallback, label), max, label);
}

function parseSheetNumberOrZero(value, label) {
  if (value === '' || value === null || value === undefined) return 0;
  var parsed = Number(value);
  if (!isFinite(parsed)) throw new Error((label || 'Nilai') + ' dalam sheet tidak sah');
  return parsed;
}

function parseSolarMonthYear(month, year) {
  var bulan = parseInt(month, 10);
  var tahun = parseInt(year, 10);
  if (isNaN(bulan) || bulan < 1 || bulan > 12) throw new Error('Bulan solar tidak sah');
  if (CACHE_YEARS.indexOf(tahun) === -1) throw new Error('Tahun solar mesti antara 2026 hingga 2031');
  return { bulan: bulan, tahun: tahun };
}

function validateBilStatusValue(status) {
  if (status !== 'Belum' && status !== 'Dibayar') throw new Error('Status bil tidak sah');
  return status;
}

function validateBilDiterimaValue(value) {
  if (value !== 'Tidak' && value !== 'Ya') throw new Error('Status bil diterima tidak sah');
  return value;
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('💸 Hub Kewangan 💸')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}


// ============================================================
//   MODUL 1: BELANJA
// ============================================================

function getCategories() {
  var cached = cacheGet('categories');
  if (cached) return JSON.parse(cached);

  var result = getCategoriesForSettings().filter(function(cat) { return cat.aktif !== 'Tidak'; }).map(function(row) {
    return {
      name: row.name || 'Umum',
      icon: row.icon || '🕵🏼'
    };
  }).filter(function(cat) { return cat.name; });
  if (!result.length) result = [{ name: 'Umum', icon: '🕵🏼' }];

  cacheSet('categories', JSON.stringify(result), TTL_LONG);
  return result;
}

function getTransactions(month, year) {
  var sheet = getOptionalSheet(DATA_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var offset = getSheetRecordOffset(sheet);
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 5 + offset).getValues()
    .map(function(row, index) {
      return {
        rowId: index + 2,
        recordId: offset ? (row[0] || '') : '',
        date: row[offset ? 1 : 0],
        amount: row[offset ? 2 : 1],
        category: row[offset ? 3 : 2],
        note: row[offset ? 4 : 3],
        payment: row[offset ? 5 : 4]
      };
    })
    .filter(function(item) { var d = new Date(item.date); return (month ? (d.getMonth()+1) == month : true) && (d.getFullYear() == year); })
    .map(function(item) { return Object.assign({}, item, { date: item.date instanceof Date ? Utilities.formatDate(item.date,'GMT+8','yyyy-MM-dd') : item.date }); });
}

function getYearlyData(year) {
  var ck = 'yearly_data_' + year;
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);

  var sheet = getOptionalSheet(DATA_SHEET);
  var data  = Array(12).fill(0);
  if (!sheet || sheet.getLastRow() < 2) {
    cacheSet(ck, JSON.stringify(data));
    return data;
  }
  var offset = getSheetRecordOffset(sheet);
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2 + offset).getValues().forEach(function(row) {
    var d = new Date(row[offset ? 1 : 0]);
    if (d.getFullYear() == year) data[d.getMonth()] += parseSheetNumberOrZero(row[offset ? 2 : 1], 'Amaun belanja');
  });
  cacheSet(ck, JSON.stringify(data));
  return data;
}

/**
 * NEW FUNCTION: Get 3-month category trend
 */
function getCategoryTrend(month, year) {
    var today = new Date();
  var m = month ? parseInt(month) : (today.getMonth() + 1);
  var y = year  ? parseInt(year)  : today.getFullYear();
    var ck = 'trend_' + m + '_' + y;
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);
  var sheet = getOptionalSheet(DATA_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    cacheSet(ck, JSON.stringify({}));
    return {};
  }

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
  
  var offset = getSheetRecordOffset(sheet);
  var allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5 + offset).getValues();
  
  allData.forEach(function(row) {
    var d = new Date(row[offset ? 1 : 0]);
    var rowMonth = d.getMonth() + 1;
    var rowYear = d.getFullYear();
    var amount = parseSheetNumberOrZero(row[offset ? 2 : 1], 'Amaun belanja');
    var category = row[offset ? 3 : 2];
    
    if (!result[category]) {
      result[category] = {
        icon: '🕵🏼',
        months: [
          { month: getPreviousMonth(m, y, 2), total: 0, count: 0 },
          { month: getPreviousMonth(m, y, 1), total: 0, count: 0 },
          { month: { m: m, y: y }, total: 0, count: 0 }
        ],
        missingFromCategorySheet: true
      };
    }
    
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
  return withWriteLock(function() {
  if (!data) throw new Error('Data tidak diberikan');
  if (!isValidDate(data.date)) throw new Error('Tarikh tidak sah');
  if (isFutureDateString(data.date)) throw new Error('Tarikh tidak boleh pada masa hadapan');
  var safeAmount = parseRequiredPositiveNumberMax(data.amount, 'Amaun', MAX_EXPENSE_AMOUNT);
  if (!data.category) throw new Error('Kategori diperlukan');

  var safeCategory = sanitize(data.category, 100);
  var safeNote = sanitize(data.note, 500);
  var safePayment = sanitize(data.payment, 50) || '💵 Cash';
  
  var sheet = getRequiredSheet(DATA_SHEET);
  var row = [toSheetDate(data.date), safeAmount, safeCategory, safeNote, safePayment];
  if (sheetHasLeadingRecordId(sheet)) row.unshift(generateRecordId('EXP'));
  sheet.appendRow(row);
invalidateExpenseCache();
  return { status: 'success', message: 'Transaksi berjaya ditambah' };
  });
}

function updateTransaction(data) {
  return withWriteLock(function() {
  if (!data) throw new Error('Data tidak diberikan');
  if (!data.rowId) throw new Error('ID transaksi diperlukan');
  if (!isValidDate(data.date)) throw new Error('Tarikh tidak sah');
  if (isFutureDateString(data.date)) throw new Error('Tarikh tidak boleh pada masa hadapan');
  var safeAmount = parseRequiredPositiveNumberMax(data.amount, 'Amaun', MAX_EXPENSE_AMOUNT);
  if (!data.category) throw new Error('Kategori diperlukan');
  
  var sheet = getRequiredSheet(DATA_SHEET);
  var safeRowId = assertExistingRow(sheet, data.rowId, 'ID transaksi');
  var safeCategory = sanitize(data.category, 100);
  var safeNote = sanitize(data.note, 500);
  var safePayment = sanitize(data.payment, 50) || '💵 Cash';
  
  var offset = sheetHasLeadingRecordId(sheet) ? 1 : 0;
  assertRecordIdMatches(sheet, safeRowId, data.recordId, 'ID transaksi');
  var current = sheet.getRange(safeRowId, 1, 1, 5 + offset).getValues()[0];
  var row = [toSheetDate(data.date), safeAmount, safeCategory, safeNote, safePayment];
  if (offset) row.unshift(current[0] || sanitize(data.recordId || '', 100) || generateRecordId('EXP'));
  sheet
    .getRange(safeRowId, 1, 1, 5 + offset)
    .setValues([row]);
invalidateExpenseCache();
  return { status: 'success', message: 'Transaksi berjaya dikemaskini' };
  });
}

function deleteTransaction(payload) {
  return withWriteLock(function() {
  var rowId = payload && typeof payload === 'object' ? payload.rowId : payload;
  var recordId = payload && typeof payload === 'object' ? payload.recordId : '';
  if (!rowId) throw new Error('ID transaksi diperlukan');
  var sheet = getRequiredSheet(DATA_SHEET);
  var safeRowId = assertExistingRow(sheet, rowId, 'ID transaksi');
  assertRecordIdMatches(sheet, safeRowId, recordId, 'ID transaksi');
  sheet.deleteRow(safeRowId);
  invalidateExpenseCache();
  return { status: 'success', message: 'Transaksi berjaya dipadam' };
  });
}

function addBulkTransactions(rows) {
  return withWriteLock(function() {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    throw new Error('Tiada data untuk ditambah');
  }
  if (rows.length > MAX_BULK_ROWS) throw new Error('Maksimum ' + MAX_BULK_ROWS + ' rekod sekali simpan');
  
  var sheet = getRequiredSheet(DATA_SHEET);
  var dataToAppend = [];
  
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!isValidDate(r.date)) throw new Error('Baris ' + (i+1) + ': Tarikh tidak sah');
    if (isFutureDateString(r.date)) throw new Error('Baris ' + (i+1) + ': Tarikh tidak boleh pada masa hadapan');
    var amount = parseRequiredPositiveNumberMax(r.amount, 'Baris ' + (i+1) + ': Amaun', MAX_EXPENSE_AMOUNT);
    if (!r.category) throw new Error('Baris ' + (i+1) + ': Kategori diperlukan');
    
dataToAppend.push([
  toSheetDate(r.date),
  amount,
  sanitize(r.category, 100),
  sanitize(r.note, 500),
  sanitize(r.payment, 50) || '💵 Cash'
]);
  }
  
  var offset = sheetHasLeadingRecordId(sheet) ? 1 : 0;
  var rowsToAppend = dataToAppend.map(function(r) {
    return offset ? [generateRecordId('EXP')].concat(r) : r;
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, 5 + offset).setValues(rowsToAppend);
  invalidateExpenseCache();
  return { status: 'success', message: dataToAppend.length + ' transaksi berjaya ditambah' };
  });
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

  var result = getCPOTypesForSettings().filter(function(item) { return item.aktif !== 'Tidak'; }).map(function(item) { return item.name; }).filter(String);
  if (!result.length) result = ['Lain-lain'];

  cacheSet('cpo_types', JSON.stringify(result), TTL_LONG);
  return result;
}

function addEVCharging(data) {
  return withWriteLock(function() {
  if (!data) throw new Error('Data tidak diberikan');
  if (!isValidDate(data.date)) throw new Error('Tarikh tidak sah');
  if (isFutureDateString(data.date)) throw new Error('Tarikh tidak boleh pada masa hadapan');
  if (!data.type) throw new Error('Jenis cas diperlukan');
  var safeKwh = parseRequiredPositiveNumberMax(data.kwh, 'kWh', MAX_EV_KWH);
  var safePrice = parseRequiredPositiveNumberMax(data.pricePerKwh, 'Harga/kWh', MAX_EV_PRICE_PER_KWH);
  
  var safeType = sanitize(data.type, 50);
  var total = safeKwh * safePrice;
  
  var cpo = safeType === 'Rumah' ? 'Rumah' : sanitize(data.cpo, 100);
  if (safeType !== 'Rumah' && !cpo) throw new Error('CPO diperlukan untuk cas luar');
  var location = safeType === 'Rumah' ? 'Kediaman' : sanitize(data.location, 200);
  
  var sheet = getRequiredSheet(EV_SHEET);
  var row = [toSheetDate(data.date), safeType, cpo, safeKwh, safePrice, location, total];
  if (sheetHasLeadingRecordId(sheet)) row.unshift(generateRecordId('EV'));
  sheet.appendRow(row);
    invalidateEVCache();
  return { status: 'success', message: 'Rekod cas berjaya ditambah' };
  });
}

function updateEVCharging(data) {
  return withWriteLock(function() {
  if (!data) throw new Error('Data tidak diberikan');
  if (!data.rowId) throw new Error('ID rekod diperlukan');
  if (!isValidDate(data.date)) throw new Error('Tarikh tidak sah');
  if (isFutureDateString(data.date)) throw new Error('Tarikh tidak boleh pada masa hadapan');
  if (!data.type) throw new Error('Jenis cas diperlukan');
  var safeKwh = parseRequiredPositiveNumberMax(data.kwh, 'kWh', MAX_EV_KWH);
  var safePrice = parseRequiredPositiveNumberMax(data.pricePerKwh, 'Harga/kWh', MAX_EV_PRICE_PER_KWH);
  
  var sheet = getRequiredSheet(EV_SHEET);
  var safeRowId = assertExistingRow(sheet, data.rowId, 'ID rekod');
  var safeType = sanitize(data.type, 50);
  var total = safeKwh * safePrice;
  
  var cpo = safeType === 'Rumah' ? 'Rumah' : sanitize(data.cpo, 100);
  if (safeType !== 'Rumah' && !cpo) throw new Error('CPO diperlukan untuk cas luar');
  var location = safeType === 'Rumah' ? 'Kediaman' : sanitize(data.location, 200);
  
  var offset = sheetHasLeadingRecordId(sheet) ? 1 : 0;
  assertRecordIdMatches(sheet, safeRowId, data.recordId, 'ID rekod');
  var current = sheet.getRange(safeRowId, 1, 1, 7 + offset).getValues()[0];
  var row = [toSheetDate(data.date), safeType, cpo, safeKwh, safePrice, location, total];
  if (offset) row.unshift(current[0] || sanitize(data.recordId || '', 100) || generateRecordId('EV'));
  sheet
    .getRange(safeRowId, 1, 1, 7 + offset)
    .setValues([row]);
    invalidateEVCache();
  return { status: 'success', message: 'Rekod cas berjaya dikemaskini' };
  });
}

function getEVData(month, year) {
  var sheet = getOptionalSheet(EV_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var offset = getSheetRecordOffset(sheet);
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 7 + offset).getValues()
    .map(function(row, index) {
      return { rowId: index+2, recordId: offset ? (row[0] || '') : '', date: row[offset ? 1 : 0], type: row[offset ? 2 : 1], cpo: row[offset ? 3 : 2], kwh: row[offset ? 4 : 3], pricePerKwh: row[offset ? 5 : 4], location: row[offset ? 6 : 5], total: row[offset ? 7 : 6] };
    })
    .filter(function(item) { var d = new Date(item.date); return (month ? (d.getMonth()+1)==month : true) && (d.getFullYear()==year); })
    .map(function(item) { return Object.assign({}, item, { date: item.date instanceof Date ? Utilities.formatDate(item.date,'GMT+8','yyyy-MM-dd') : item.date }); })
    .reverse();
}

function deleteEVData(payload) {
  return withWriteLock(function() {
  var rowId = payload && typeof payload === 'object' ? payload.rowId : payload;
  var recordId = payload && typeof payload === 'object' ? payload.recordId : '';
  if (!rowId) throw new Error('ID rekod diperlukan');
  var sheet = getRequiredSheet(EV_SHEET);
  var safeRowId = assertExistingRow(sheet, rowId, 'ID rekod');
  assertRecordIdMatches(sheet, safeRowId, recordId, 'ID rekod');
  sheet.deleteRow(safeRowId);
  invalidateEVCache();
  return { status: 'success', message: 'Rekod cas berjaya dipadam' };
  });
}

function getEVYearlyData(year) {
  var ck = 'evyearly_data_' + year;
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);

  var data = Array(12).fill(0);
  var evSheet = getOptionalSheet(EV_SHEET);
  if (evSheet && evSheet.getLastRow() >= 2) {
    var evOffset = getSheetRecordOffset(evSheet);
    evSheet.getRange(2, 1, evSheet.getLastRow()-1, 7 + evOffset).getValues().forEach(function(row) {
      var d = new Date(row[evOffset ? 1 : 0]);
      if (d.getFullYear() == year) data[d.getMonth()] += parseSheetNumberOrZero(row[evOffset ? 7 : 6], 'Jumlah EV');
    });
  }
  var petrolSheet = getOptionalSheet(PETROL_SHEET);
  if (petrolSheet && petrolSheet.getLastRow() >= 2) {
    var petrolOffset = getSheetRecordOffset(petrolSheet);
    petrolSheet.getRange(2, 1, petrolSheet.getLastRow()-1, 5 + petrolOffset).getValues().forEach(function(row) {
      var d = new Date(row[petrolOffset ? 1 : 0]);
      if (d.getFullYear() == year) data[d.getMonth()] += parseSheetNumberOrZero(row[petrolOffset ? 5 : 4], 'Jumlah minyak');
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
  return withWriteLock(function() {
  if (!data) throw new Error('Data tidak diberikan');
  if (!isValidDate(data.date)) throw new Error('Tarikh tidak sah');
  if (isFutureDateString(data.date)) throw new Error('Tarikh tidak boleh pada masa hadapan');
  if (!data.station) throw new Error('Stesen diperlukan');
  var liter = parseRequiredPositiveNumberMax(data.liter, 'Liter', MAX_PETROL_LITER);
  
  var safeStation = sanitize(data.station, 100);
  var defaultPetrolPrice = getSettingValue('DEFAULT_PETROL_PRICE', DEFAULT_PETROL_PRICE, 'number');
  var price = parseOptionalPositiveNumberOrDefaultMax(data.pricePerLiter, defaultPetrolPrice, 'Harga/Liter', MAX_PETROL_PRICE_PER_LITER);
  var total = liter * price;
  var safeNote = sanitize(data.note, 500);

  var sheet = getRequiredSheet(PETROL_SHEET);
  var row = [toSheetDate(data.date), safeStation, liter, price, total, safeNote];
  if (sheetHasLeadingRecordId(sheet)) row.unshift(generateRecordId('PET'));
  sheet.appendRow(row);
  invalidateEVCache();
  return { status: 'success', message: 'Rekod minyak berjaya ditambah' };
  });
}

function updatePetrolRecord(data) {
  return withWriteLock(function() {
  if (!data) throw new Error('Data tidak diberikan');
  if (!data.rowId) throw new Error('ID rekod diperlukan');
  if (!isValidDate(data.date)) throw new Error('Tarikh tidak sah');
  if (isFutureDateString(data.date)) throw new Error('Tarikh tidak boleh pada masa hadapan');
  if (!data.station) throw new Error('Stesen diperlukan');
  var liter = parseRequiredPositiveNumberMax(data.liter, 'Liter', MAX_PETROL_LITER);
  
  var sheet = getRequiredSheet(PETROL_SHEET);
  var safeRowId = assertExistingRow(sheet, data.rowId, 'ID rekod');
  var safeStation = sanitize(data.station, 100);
  var offset = sheetHasLeadingRecordId(sheet) ? 1 : 0;
  assertRecordIdMatches(sheet, safeRowId, data.recordId, 'ID rekod');
  var current = sheet.getRange(safeRowId, 1, 1, 6 + offset).getValues()[0];
  var existingPrice = current[offset ? 4 : 3];
  var price = data.pricePerLiter === '' || data.pricePerLiter === null || data.pricePerLiter === undefined
    ? parseRequiredPositiveNumberMax(existingPrice, 'Harga/Liter asal', MAX_PETROL_PRICE_PER_LITER)
    : parseRequiredPositiveNumberMax(data.pricePerLiter, 'Harga/Liter', MAX_PETROL_PRICE_PER_LITER);
  var total = liter * price;
  var safeNote = sanitize(data.note, 500);

  var row = [toSheetDate(data.date), safeStation, liter, price, total, safeNote];
  if (offset) row.unshift(current[0] || sanitize(data.recordId || '', 100) || generateRecordId('PET'));
  sheet
    .getRange(safeRowId, 1, 1, 6 + offset)
    .setValues([row]);
  invalidateEVCache();
  return { status: 'success', message: 'Rekod minyak berjaya dikemaskini' };
  });
}

function getPetrolData(month, year) {
  var sheet = getOptionalSheet(PETROL_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var offset = getSheetRecordOffset(sheet);
  return sheet.getRange(2, 1, sheet.getLastRow()-1, 6 + offset).getValues()
    .map(function(row, index) { return { rowId: index+2, recordId: offset ? (row[0] || '') : '', date: row[offset ? 1 : 0], station: row[offset ? 2 : 1], liter: row[offset ? 3 : 2], pricePerLiter: row[offset ? 4 : 3], total: row[offset ? 5 : 4], note: row[offset ? 6 : 5] }; })
    .filter(function(item) { var d = new Date(item.date); return (month ? (d.getMonth()+1)==month : true) && (d.getFullYear()==year); })
    .map(function(item) { return Object.assign({}, item, { date: item.date instanceof Date ? Utilities.formatDate(item.date,'GMT+8','yyyy-MM-dd') : item.date }); })
    .reverse();
}

function deletePetrolRecord(payload) {
  return withWriteLock(function() {
  var rowId = payload && typeof payload === 'object' ? payload.rowId : payload;
  var recordId = payload && typeof payload === 'object' ? payload.recordId : '';
  if (!rowId) throw new Error('ID rekod diperlukan');
  var sheet = getRequiredSheet(PETROL_SHEET);
  var safeRowId = assertExistingRow(sheet, rowId, 'ID rekod');
  assertRecordIdMatches(sheet, safeRowId, recordId, 'ID rekod');
  sheet.deleteRow(safeRowId);
  invalidateEVCache();
  return { status: 'success', message: 'Rekod minyak berjaya dipadam' };
  });
}

function addBulkEVRecords(rows) {
  return withWriteLock(function() {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    throw new Error('Tiada data untuk ditambah');
  }
  if (rows.length > MAX_BULK_ROWS) throw new Error('Maksimum ' + MAX_BULK_ROWS + ' rekod sekali simpan');

  var evRows = [];
  var petrolRows = [];
  var needsEV = false;
  var needsPetrol = false;
  var evSheet = null;
  var petrolSheet = null;
  var defaultHomePrice = getSettingValue('DEFAULT_HOME_KWH_PRICE', DEFAULT_HOME_KWH_PRICE, 'number');
  var defaultPetrolPrice = getSettingValue('DEFAULT_PETROL_PRICE', DEFAULT_PETROL_PRICE, 'number');

  rows.forEach(function(row, index) {
    var label = 'Baris ' + (index + 1) + ': ';
    if (!row || !row.kind) throw new Error(label + 'Jenis rekod diperlukan');
    if (!isValidDate(row.date)) throw new Error(label + 'Tarikh tidak sah');
    if (isFutureDateString(row.date)) throw new Error(label + 'Tarikh tidak boleh pada masa hadapan');

    if (row.kind === 'home' || row.kind === 'public') {
      needsEV = true;
      var kwh = parseRequiredPositiveNumberMax(row.kwh, label + 'kWh', MAX_EV_KWH);
      var price = row.kind === 'home' ? defaultHomePrice : parseRequiredPositiveNumberMax(row.pricePerKwh, label + 'Harga/kWh', MAX_EV_PRICE_PER_KWH);
      var type = row.kind === 'home' ? 'Rumah' : 'Luar';
      var cpo = type === 'Rumah' ? 'Rumah' : sanitize(row.cpo, 100);
      if (type === 'Luar' && !cpo) throw new Error(label + 'CPO diperlukan untuk cas luar');
      var location = type === 'Rumah' ? 'Kediaman' : sanitize(row.location, 200);
      evRows.push([toSheetDate(row.date), type, cpo, kwh, price, location, kwh * price]);
    } else if (row.kind === 'petrol') {
      needsPetrol = true;
      var station = sanitize(row.station, 100);
      var liter = parseRequiredPositiveNumberMax(row.liter, label + 'Liter', MAX_PETROL_LITER);
      var petrolPrice = parseOptionalPositiveNumberOrDefaultMax(row.pricePerLiter, defaultPetrolPrice, label + 'Harga/Liter', MAX_PETROL_PRICE_PER_LITER);
      if (!station) throw new Error(label + 'Stesen diperlukan');
      petrolRows.push([toSheetDate(row.date), station, liter, petrolPrice, liter * petrolPrice, sanitize(row.note, 500)]);
    } else {
      throw new Error(label + 'Jenis rekod tidak sah');
    }
  });

  evSheet = needsEV ? getRequiredSheet(EV_SHEET) : null;
  petrolSheet = needsPetrol ? getRequiredSheet(PETROL_SHEET) : null;

  if (evSheet && sheetHasLeadingRecordId(evSheet)) {
    evRows = evRows.map(function(r) { return [generateRecordId('EV')].concat(r); });
  }
  if (petrolSheet && sheetHasLeadingRecordId(petrolSheet)) {
    petrolRows = petrolRows.map(function(r) { return [generateRecordId('PET')].concat(r); });
  }

  if (evRows.length > 0) {
    evSheet.getRange(evSheet.getLastRow() + 1, 1, evRows.length, evRows[0].length).setValues(evRows);
  }
  if (petrolRows.length > 0) {
    petrolSheet.getRange(petrolSheet.getLastRow() + 1, 1, petrolRows.length, petrolRows[0].length).setValues(petrolRows);
  }

  invalidateEVCache();
  return { status: 'success', message: (evRows.length + petrolRows.length) + ' rekod EV/Minyak berjaya ditambah', evCount: evRows.length, petrolCount: petrolRows.length };
  });
}


// ============================================================
//   MODUL 4: BIL BULANAN
// ============================================================

function getBilTemplate() {
  var sheet = getRequiredSheet(BIL_TEMPLATE_SHEET);
  var ck = 'bil_template';
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);

  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
  var result = data.map(function(row, idx) {
    var frekuensi = sanitize(row[8], 30) || 'Bulanan';
    return {
      rowId: idx + 2,
      nama: row[0] || '',
      kategori: row[1] || 'Lain-lain',
      anggaran: parseSheetNumberOrZero(row[2], 'Anggaran bil'),
      tetap: (row[3] || '').toString().toLowerCase() === 'ya',
      lokasi: row[4] || 'Lain-lain',
      ikonLokasi: row[5] || '',
      ikonKategori: row[6] || '',
      cycleHari: row[7] ? parseInt(row[7]) : '',
      frekuensi: frekuensi,
      bulanAktif: row[9] ? parseInt(row[9]) : '',
      catatan: sanitize(row[10], 500)
    };
  }).filter(function(b) { return b.nama; });

  cacheSet(ck, JSON.stringify(result), TTL_LONG);
  return result;
}

function initBilMonth(month, year) {
  return withWriteLock(function() {
  var m = Number(month);
  var y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error('Bulan bil tidak sah');
  if (!Number.isInteger(y) || CACHE_YEARS.indexOf(y) === -1) throw new Error('Tahun bil mesti antara 2026 hingga 2031');
  var sheet = getRequiredSheet(BIL_REKOD_SHEET);

  var lastRow = sheet.getLastRow();
  var existing = {};
  if (lastRow >= 2) {
    var all = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
    all.forEach(function(row) {
      if (parseInt(row[0]) === y && parseInt(row[1]) === m) {
        existing[getBilRecordKey(row[2], row[3])] = true;
      }
    });
  }

  var template = getBilTemplate();
  var newRows = [];

  template.forEach(function(t) {
    var freq = (t.frekuensi || 'Bulanan').toString().toLowerCase();
    var shouldCreate = freq !== 'tahunan' || parseInt(t.bulanAktif) === m;
    if (shouldCreate && !existing[getBilRecordKey(t.lokasi, t.nama)]) {
      newRows.push([y, m, t.lokasi, t.nama, t.kategori, t.anggaran, 'Belum', '', 'Tidak', '', t.catatan || '']);
    }
  });

  if (newRows.length > 0) {
    if (lastRow < 2) {
      sheet.getRange(2, 1, newRows.length, 11).setValues(newRows);
    } else {
      sheet.getRange(lastRow + 1, 1, newRows.length, 11).setValues(newRows);
    }
  }

  return { status: 'success', created: newRows.length, already: Object.keys(existing).length };
  });
}

function getBilRekod(month, year) {
  var sheet = getRequiredSheet(BIL_REKOD_SHEET);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues()
    .map(function(row, index) {
      return {
        rowId: index + 2,
        tahun: parseInt(row[0]),
        bulan: parseInt(row[1]),
        lokasi: row[2] || '',
        nama: row[3] || '',
        kategori: row[4] || '',
        amaun: parseSheetNumberOrZero(row[5], 'Amaun bil'),
        status: row[6] || 'Belum',
        tarikhBayar: row[7] instanceof Date ? Utilities.formatDate(row[7], 'GMT+8', 'yyyy-MM-dd') : (row[7] || ''),
        bilDiterima: row[8] || 'Tidak',
        tarikhBil: row[9] instanceof Date ? Utilities.formatDate(row[9], 'GMT+8', 'yyyy-MM-dd') : (row[9] || ''),
        catatan: row[10] || ''
      };
    })
    .filter(function(item) {
      return (month ? item.bulan == month : true) && (item.tahun == year);
    });
}

function toggolBilStatus(rowId) {
  throw new Error('Guna batchUpdateBil(): perubahan status bil mesti dipending dan disimpan mengikut lokasi.');
}

function toggolBilDiterima(rowId) {
  throw new Error('Guna batchUpdateBil(): perubahan status bil mesti dipending dan disimpan mengikut lokasi.');
}

function kemaskiniBilAmount(rowId, amaunBaru, month, year, lokasi, nama) {
  return withWriteLock(function() {
  if (!rowId) throw new Error('ID rekod diperlukan');
  var amt = parseRequiredPositiveNumberMax(amaunBaru, 'Amaun', MAX_BIL_AMOUNT);

  var sheet = getRequiredSheet(BIL_REKOD_SHEET);
  var safeRowId = assertExistingRow(sheet, rowId, 'ID rekod');
  var row = sheet.getRange(safeRowId, 1, 1, 11).getValues()[0];
  if (parseInt(row[1], 10) !== parseInt(month, 10)) throw new Error('Rekod bil tidak sepadan dengan bulan dipilih');
  if (parseInt(row[0], 10) !== parseInt(year, 10)) throw new Error('Rekod bil tidak sepadan dengan tahun dipilih');
  if (sanitize(row[2], 200) !== sanitize(lokasi, 200)) throw new Error('Rekod bil tidak sepadan dengan lokasi dipilih');
  if (sanitize(row[3], 200) !== sanitize(nama, 200)) throw new Error('Rekod bil tidak sepadan dengan nama bil dipilih');
  sheet.getRange(safeRowId, 6).setValue(amt);
  return { status: 'success', amaun: amt };
  });
}

function getBilSummary(month, year) {
  var rekod = getBilRekod(month, year);
  var dibayar = 0, belum = 0, diterimaBlmByr = 0;
  var byLokasi = {};

  rekod.forEach(function(r) {
    if (r.status === 'Dibayar') dibayar += r.amaun;
    else belum += r.amaun;

    if (r.bilDiterima === 'Ya' && r.status !== 'Dibayar') diterimaBlmByr += r.amaun;

    if (!byLokasi[r.lokasi]) byLokasi[r.lokasi] = { total: 0, dibayar: 0, count: 0, done: 0, diterima: 0 };
    byLokasi[r.lokasi].total += r.amaun;
    byLokasi[r.lokasi].count++;
    if (r.status === 'Dibayar') { byLokasi[r.lokasi].dibayar += r.amaun; byLokasi[r.lokasi].done++; }
    if (r.bilDiterima === 'Ya') byLokasi[r.lokasi].diterima++;
  });

  return {
    rekod: rekod,
    jumlahDibayar: dibayar,
    jumlahBelum: belum,
    jumlahDiterima: diterimaBlmByr,
    jumlahKeseluruhan: dibayar + belum,
    byLokasi: byLokasi
  };
}

function invalidateBilTemplateCache() {
  cacheDel('bil_template');
}

function batchUpdateBil(updates, month, year, lokasi) {
  return withWriteLock(function() {
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    throw new Error('Tiada data untuk dikemaskini');
  }
  var sheet = getRequiredSheet(BIL_REKOD_SHEET);
  var today = todaySheetDate();
  var prepared = [];
  var expectedMonth = Number(month);
  var expectedYear = Number(year);
  var expectedLokasi = sanitize(lokasi, 200);
  if (!Number.isInteger(expectedMonth) || expectedMonth < 1 || expectedMonth > 12) throw new Error('Bulan bil tidak sah');
  if (!Number.isInteger(expectedYear) || CACHE_YEARS.indexOf(expectedYear) === -1) throw new Error('Tahun bil mesti antara 2026 hingga 2031');
  if (!expectedLokasi) throw new Error('Lokasi bil diperlukan');

  updates.forEach(function(u) {
    if (!u || typeof u !== 'object') throw new Error('Data kemaskini bil tidak sah');
    var rowId = assertExistingRow(sheet, u.rowId, 'ID rekod');
    var row = sheet.getRange(rowId, 1, 1, 11).getValues()[0];
    if (parseInt(row[1], 10) !== expectedMonth) throw new Error('Rekod bil tidak sepadan dengan bulan dipilih');
    if (parseInt(row[0], 10) !== expectedYear) throw new Error('Rekod bil tidak sepadan dengan tahun dipilih');
    if (sanitize(row[2], 200) !== expectedLokasi) throw new Error('Rekod bil tidak sepadan dengan lokasi dipilih');
    var status = validateBilStatusValue(u.status !== undefined ? u.status : (row[6] || 'Belum'));
    var tarikhBayar = u.status === 'Dibayar' ? today : (u.status === 'Belum' ? '' : (row[7] || ''));
    var bilDiterima = validateBilDiterimaValue(u.bilDiterima !== undefined ? u.bilDiterima : (row[8] || 'Tidak'));
    if (status === 'Dibayar') bilDiterima = 'Ya';
    var tarikhBil = row[9] || '';
    if (bilDiterima === 'Tidak') {
      tarikhBil = '';
    } else if (!tarikhBil) {
      tarikhBil = today;
    }

    prepared.push({ rowId: rowId, values: [status, tarikhBayar, bilDiterima, tarikhBil] });
  });

  prepared.forEach(function(item) {
    sheet.getRange(item.rowId, 7, 1, 4).setValues([item.values]);
  });

  return { status: 'success', count: prepared.length };
  });
}

function tandaiSemuaBilLokasi(month, year, lokasi) {
  throw new Error('Guna batchUpdateBil(): tandai semua bil mesti dipending di client dan disimpan mengikut lokasi.');
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
  var sheet = getOptionalSheet(SOLAR_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    if (month && year) cacheSet(ck, JSON.stringify([]), TTL_SHORT);
    return [];
  }
  var offset = getSheetRecordOffset(sheet);
  var result = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8 + offset).getValues()
    .map(function(row, index) {
      return {
        rowId: index + 2,
        recordId: offset ? (row[0] || '') : '',
        tahun: parseInt(row[offset ? 1 : 0]),
        bulan: parseInt(row[offset ? 2 : 1]),
        janaTNB: parseSheetNumberOrZero(row[offset ? 3 : 2], 'Jana TNB'),
        gunaTNB: parseSheetNumberOrZero(row[offset ? 4 : 3], 'Guna TNB'),
        baki: parseSheetNumberOrZero(row[offset ? 5 : 4], 'Baki solar'),
        jumlahBaki: Math.max(0, parseSheetNumberOrZero(row[offset ? 6 : 5], 'Jumlah baki solar')),
        janaApps: parseSheetNumberOrZero(row[offset ? 7 : 6], 'Jana Apps'),
        luarGrid: parseSheetNumberOrZero(row[offset ? 8 : 7], 'Luar Grid')
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

function findSolarRecordRow(sheet, tahun, bulan, excludeRowId) {
  if (!sheet || sheet.getLastRow() < 2) return null;
  var offset = getSheetRecordOffset(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2 + offset).getValues();
  for (var i = 0; i < rows.length; i++) {
    var rowId = i + 2;
    if (excludeRowId && rowId === excludeRowId) continue;
    if (parseInt(rows[i][offset ? 1 : 0]) === parseInt(tahun) && parseInt(rows[i][offset ? 2 : 1]) === parseInt(bulan)) {
      return rowId;
    }
  }
  return null;
}

function addSolarRecord(data) {
  return withWriteLock(function() {
  if (!data) throw new Error('Data tidak diberikan');
  if (!data.bulan || !data.tahun) throw new Error('Bulan dan tahun diperlukan');

  var janaTNB = parseRequiredNonNegativeNumberMax(data.janaTNB, 'Jana TNB', MAX_SOLAR_KWH);
  var gunaTNB = parseRequiredNonNegativeNumberMax(data.gunaTNB, 'Guna TNB', MAX_SOLAR_KWH);
  var janaApps = data.janaApps === '' || data.janaApps === null || data.janaApps === undefined ? 0 : parseRequiredNonNegativeNumberMax(data.janaApps, 'Jana Apps', MAX_SOLAR_KWH);
  var solarPeriod = parseSolarMonthYear(data.bulan, data.tahun);
  var bulan = solarPeriod.bulan;
  var tahun = solarPeriod.tahun;

  var baki = janaTNB - gunaTNB;
  var luarGrid = janaApps - janaTNB;

  var sheet = getRequiredSheet(SOLAR_SHEET);
  if (findSolarRecordRow(sheet, tahun, bulan)) {
    throw new Error('Rekod solar untuk bulan/tahun ini sudah wujud. Sila edit rekod sedia ada.');
  }
  var row = [tahun, bulan, janaTNB, gunaTNB, baki, 0, janaApps, luarGrid];
  if (sheetHasLeadingRecordId(sheet)) row.unshift(generateRecordId('SOL'));
  sheet.appendRow(row);
  recalculateSolarRunningBalance();
  invalidateSolarCache();
  return { status: 'success', message: 'Rekod solar berjaya ditambah' };
  });
}

function updateSolarRecord(data) {
  return withWriteLock(function() {
  if (!data || !data.rowId) throw new Error('ID rekod diperlukan');

  var sheet = getRequiredSheet(SOLAR_SHEET);
  var safeRowId = assertExistingRow(sheet, data.rowId, 'ID rekod');
  assertRecordIdMatches(sheet, safeRowId, data.recordId, 'ID rekod');
  var janaTNB = parseRequiredNonNegativeNumberMax(data.janaTNB, 'Jana TNB', MAX_SOLAR_KWH);
  var gunaTNB = parseRequiredNonNegativeNumberMax(data.gunaTNB, 'Guna TNB', MAX_SOLAR_KWH);
  var janaApps = data.janaApps === '' || data.janaApps === null || data.janaApps === undefined ? 0 : parseRequiredNonNegativeNumberMax(data.janaApps, 'Jana Apps', MAX_SOLAR_KWH);
  var solarPeriod = parseSolarMonthYear(data.bulan, data.tahun);
  var bulan = solarPeriod.bulan;
  var tahun = solarPeriod.tahun;
  var baki = janaTNB - gunaTNB;
  var luarGrid = janaApps - janaTNB;

  if (findSolarRecordRow(sheet, tahun, bulan, safeRowId)) {
    throw new Error('Rekod solar untuk bulan/tahun ini sudah wujud. Sila pilih bulan lain atau edit rekod sedia ada.');
  }

  var offset = sheetHasLeadingRecordId(sheet) ? 1 : 0;
  var current = sheet.getRange(safeRowId, 1, 1, 8 + offset).getValues()[0];
  var row = [tahun, bulan, janaTNB, gunaTNB, baki, 0, janaApps, luarGrid];
  if (offset) row.unshift(current[0] || sanitize(data.recordId || '', 100) || generateRecordId('SOL'));
  sheet.getRange(safeRowId, 1, 1, 8 + offset).setValues([row]);
  recalculateSolarRunningBalance();
  invalidateSolarCache();
  return { status: 'success', message: 'Rekod solar berjaya dikemaskini' };
  });
}

function deleteSolarRecord(payload) {
  return withWriteLock(function() {
  var rowId = payload && typeof payload === 'object' ? payload.rowId : payload;
  var recordId = payload && typeof payload === 'object' ? payload.recordId : '';
  if (!rowId) throw new Error('ID rekod diperlukan');
  var sheet = getRequiredSheet(SOLAR_SHEET);
  var safeRowId = assertExistingRow(sheet, rowId, 'ID rekod');
  assertRecordIdMatches(sheet, safeRowId, recordId, 'ID rekod');
  sheet.deleteRow(safeRowId);
  recalculateSolarRunningBalance();
  invalidateSolarCache();
  return { status: 'success', message: 'Rekod solar berjaya dipadam' };
  });
}

function recalculateSolarRunningBalance() {
  var sheet = getRequiredSheet(SOLAR_SHEET);
  if (sheet.getLastRow() < 2) return;

  var offset = getSheetRecordOffset(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8 + offset).getValues().map(function(row, index) {
    return { rowId: index + 2, values: row };
  });

  rows.sort(function(a, b) {
    var aYear = parseInt(a.values[offset ? 1 : 0]);
    var bYear = parseInt(b.values[offset ? 1 : 0]);
    if (aYear !== bYear) return aYear - bYear;
    var aMonth = parseInt(a.values[offset ? 2 : 1]);
    var bMonth = parseInt(b.values[offset ? 2 : 1]);
    if (aMonth !== bMonth) return aMonth - bMonth;
    return a.rowId - b.rowId;
  });

  var running = 0;
  var currentYear = null;
  rows.forEach(function(item) {
    var row = item.values;
    var rowYear = parseInt(row[offset ? 1 : 0]);
    if (currentYear !== rowYear) {
      currentYear = rowYear;
      running = 0;
    }
    var janaTNB = parseSheetNumberOrZero(row[offset ? 3 : 2], 'Jana TNB');
    var gunaTNB = parseSheetNumberOrZero(row[offset ? 4 : 3], 'Guna TNB');
    var janaApps = parseSheetNumberOrZero(row[offset ? 7 : 6], 'Jana Apps');
    var baki = janaTNB - gunaTNB;
    var luarGrid = janaApps - janaTNB;
    running += baki;
    if (running < 0) running = 0;
    sheet.getRange(item.rowId, offset ? 6 : 5, 1, 4).setValues([[baki, running, janaApps, luarGrid]]);
  });
}

function getSolarYearlyData(year) {
  var ck = 'solar_yearly_' + year;
  var cached = cacheGet(ck);
  if (cached) return JSON.parse(cached);

  var data = { jana: Array(12).fill(0), guna: Array(12).fill(0), baki: Array(12).fill(0), kumulatif: Array(12).fill(0), luarGrid: Array(12).fill(0) };
  var sheet = getOptionalSheet(SOLAR_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    cacheSet(ck, JSON.stringify(data), TTL_SHORT);
    return data;
  }
  var offset = getSheetRecordOffset(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8 + offset).getValues();
  var running = 0;
  for (var i = 0; i < 12; i++) {
    var found = false;
    rows.forEach(function(r) {
      if (parseInt(r[offset ? 1 : 0]) == year && parseInt(r[offset ? 2 : 1]) === i + 1) {
        data.jana[i] = parseSheetNumberOrZero(r[offset ? 3 : 2], 'Jana TNB');
        data.guna[i] = parseSheetNumberOrZero(r[offset ? 4 : 3], 'Guna TNB');
        data.baki[i] = parseSheetNumberOrZero(r[offset ? 5 : 4], 'Baki solar');
        data.luarGrid[i] = parseSheetNumberOrZero(r[offset ? 8 : 7], 'Luar Grid');
        running += parseSheetNumberOrZero(r[offset ? 5 : 4], 'Baki solar');
        if (running < 0) running = 0;
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
  for (var i = 0; i < CACHE_YEARS.length; i++) {
    for (var j = 0; j < CACHE_MONTHS.length; j++) {
      cache.remove('solar_data_' + CACHE_YEARS[i] + '_' + CACHE_MONTHS[j]);
    }
    cache.remove('solar_yearly_' + CACHE_YEARS[i]);
  }
}


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
    bilData      : getBilSummary(month, year),
    prevExpData  : prevExpData,
    prevEvData   : prevMonth ? getEVData(prevMonth, prevYear) : [],
    prevPetData  : prevMonth ? getPetrolData(prevMonth, prevYear) : [],
    prevBilData  : prevMonth ? getBilSummary(prevMonth, prevYear) : { jumlahDibayar: 0, jumlahBelum: 0, jumlahKeseluruhan: 0 },
    prevMonth    : prevMonth,
    prevYear     : prevYear,
    expYearly    : getYearlyData(year),
    evYearly     : getEVYearlyData(year)
  };
}
