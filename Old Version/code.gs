/**
 * KONFIGURASI NAMA TAB SHEET
 */
const DATA_SHEET     = 'DATA';
const CATEGORY_SHEET = 'KATEGORI';
const EV_SHEET       = 'EV_CHARGING';
const CPO_SHEET      = 'JENIS_CPO';
const PETROL_SHEET   = 'MINYAK';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('ExpensePro & EV Tracker')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}


// ============================================================
//   MODUL 1: BELANJA
// ============================================================

function getCategories() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CATEGORY_SHEET);
  if (!sheet) return ['Umum'];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return ['Umum'];
  return sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().filter(String);
}

function getTransactions(month, year) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues()
    .map((row, index) => ({ rowId: index + 2, date: row[0], amount: row[1], category: row[2], note: row[3] }))
    .filter(item => { const d = new Date(item.date); return (month ? (d.getMonth()+1) == month : true) && (d.getFullYear() == year); })
    .map(item => ({ ...item, date: item.date instanceof Date ? Utilities.formatDate(item.date,'GMT+8','yyyy-MM-dd') : item.date }));
}

function getYearlyData(year) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
  const data  = Array(12).fill(0);
  if (!sheet || sheet.getLastRow() < 2) return data;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(row => {
    const d = new Date(row[0]);
    if (d.getFullYear() == year) data[d.getMonth()] += parseFloat(row[1] || 0);
  });
  return data;
}

function addTransaction(data) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET)
    .appendRow([new Date(data.date), parseFloat(data.amount), data.category, data.note || '']);
  return { status: 'success' };
}

function updateTransaction(data) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET)
    .getRange(parseInt(data.rowId), 1, 1, 4)
    .setValues([[new Date(data.date), parseFloat(data.amount), data.category, data.note || '']]);
  return { status: 'success' };
}

function deleteTransaction(rowId) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET).deleteRow(rowId);
  return { status: 'success' };
}

function addBulkTransactions(rows) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET);
  const dataToAppend = rows.map(r => [new Date(r.date), parseFloat(r.amount), r.category, r.note || '']);
  sheet.getRange(sheet.getLastRow() + 1, 1, dataToAppend.length, 4).setValues(dataToAppend);
  return { status: 'success' };
}

/**
 * BATCH #1 — Tab Belanja
 * Menggantikan 2 panggilan (getTransactions + getYearlyData) → 1 panggilan
 */
function getBatchExpenseData(month, year) {
  return {
    transactions : getTransactions(month, year),
    yearlyData   : getYearlyData(year)
  };
}


// ============================================================
//   MODUL 2: EV TRACKER
// ============================================================

function getCPOTypes() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CPO_SHEET);
  if (!sheet) return ['Lain-lain'];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return ['Lain-lain'];
  return sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().filter(String);
}

function addEVCharging(data) {
  const total = parseFloat(data.kwh) * parseFloat(data.pricePerKwh);
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EV_SHEET)
    .appendRow([new Date(data.date), data.type, data.type==='Rumah'?'Rumah':data.cpo, parseFloat(data.kwh), parseFloat(data.pricePerKwh), data.type==='Rumah'?'Kediaman':data.location, total]);
  return { status: 'success' };
}

function updateEVCharging(data) {
  const total = parseFloat(data.kwh) * parseFloat(data.pricePerKwh);
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EV_SHEET)
    .getRange(parseInt(data.rowId), 1, 1, 7)
    .setValues([[new Date(data.date), data.type, data.type==='Rumah'?'Rumah':data.cpo, parseFloat(data.kwh), parseFloat(data.pricePerKwh), data.type==='Rumah'?'Kediaman':data.location, total]]);
  return { status: 'success' };
}

function getEVData(month, year) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EV_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues()
    .map((row, index) => ({ rowId: index+2, date: row[0], type: row[1], cpo: row[2], kwh: row[3], pricePerKwh: row[4], location: row[5], total: row[6] }))
    .filter(item => { const d = new Date(item.date); return (month ? (d.getMonth()+1)==month : true) && (d.getFullYear()==year); })
    .map(item => ({ ...item, date: item.date instanceof Date ? Utilities.formatDate(item.date,'GMT+8','yyyy-MM-dd') : item.date }))
    .reverse();
}

function deleteEVData(rowId) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EV_SHEET).deleteRow(rowId);
  return { status: 'success' };
}

function getEVYearlyData(year) {
  const data = Array(12).fill(0);
  const evSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EV_SHEET);
  if (evSheet && evSheet.getLastRow() >= 2) {
    evSheet.getRange(2, 1, evSheet.getLastRow()-1, 7).getValues().forEach(row => {
      const d = new Date(row[0]);
      if (d.getFullYear() == year) data[d.getMonth()] += parseFloat(row[6] || 0);
    });
  }
  const petrolSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PETROL_SHEET);
  if (petrolSheet && petrolSheet.getLastRow() >= 2) {
    petrolSheet.getRange(2, 1, petrolSheet.getLastRow()-1, 5).getValues().forEach(row => {
      const d = new Date(row[0]);
      if (d.getFullYear() == year) data[d.getMonth()] += parseFloat(row[4] || 0);
    });
  }
  return data;
}

/**
 * BATCH #2 — Tab EV Cas
 * Menggantikan 3 panggilan (getEVData + getPetrolData + getEVYearlyData) → 1 panggilan
 */
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
  const liter = parseFloat(data.liter), price = parseFloat(data.pricePerLiter) || 1.99;
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PETROL_SHEET)
    .appendRow([new Date(data.date), data.station, liter, price, liter * price, data.note || '']);
  return { status: 'success' };
}

function updatePetrolRecord(data) {
  const liter = parseFloat(data.liter), price = parseFloat(data.pricePerLiter) || 1.99;
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PETROL_SHEET)
    .getRange(parseInt(data.rowId), 1, 1, 6)
    .setValues([[new Date(data.date), data.station, liter, price, liter * price, data.note || '']]);
  return { status: 'success' };
}

function getPetrolData(month, year) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PETROL_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow()-1, 6).getValues()
    .map((row, index) => ({ rowId: index+2, date: row[0], station: row[1], liter: row[2], pricePerLiter: row[3], total: row[4], note: row[5] }))
    .filter(item => { const d = new Date(item.date); return (month ? (d.getMonth()+1)==month : true) && (d.getFullYear()==year); })
    .map(item => ({ ...item, date: item.date instanceof Date ? Utilities.formatDate(item.date,'GMT+8','yyyy-MM-dd') : item.date }))
    .reverse();
}

function deletePetrolRecord(rowId) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PETROL_SHEET).deleteRow(rowId);
  return { status: 'success' };
}

/**
 * BATCH #3 — Tab Ringkasan (PALING BESAR KESANNYA)
 * Menggantikan 8 panggilan bersiri → 1 panggilan sahaja
 *
 * Mengira bulan lepas di server-side supaya tiada round-trip tambahan
 */
function getBatchSummaryData(month, year) {
  // Kira bulan & tahun lepas
  const prevMonth = month ? (parseInt(month) === 1 ? 12        : parseInt(month) - 1) : '';
  const prevYear  = month ? (parseInt(month) === 1 ? parseInt(year) - 1 : year)       : year;

  return {
    // Bulan semasa
    expData      : getTransactions(month, year),
    evData       : getEVData(month, year),
    petrolData   : getPetrolData(month, year),
    // Bulan lepas (untuk perbandingan)
    prevExpData  : getTransactions(prevMonth, prevYear),
    prevEvData   : getEVData(prevMonth, prevYear),
    prevPetData  : getPetrolData(prevMonth, prevYear),
    // Carta trend tahunan
    expYearly    : getYearlyData(year),
    evYearly     : getEVYearlyData(year)
  };
}
