# Plan: Modul Tetapan Tanpa Melambatkan Load Web App

## Matlamat
Tambah modul `Tetapan` sebagai pusat kemaskini data rujukan semua modul tanpa menambah beban besar semasa load awal web app.

## Keputusan Dikunci
- Akses Tetapan guna butang gear fixed top bersebelahan dark mode, bukan item keenam bottom nav.
- Bottom nav kekal 5 modul: Ringkasan, Belanja, EV Cas, Bil, Solar.
- `page-settings` ialah page penuh yang dibuka melalui gear; bukan modal kecil.
- Settings page penuh lazy-load, hanya dimuat bila pengguna buka Tetapan.
- Gear Settings mesti hormat pending changes Bil: panggil `confirmDiscardPendingBilChanges()` sebelum buka Settings.
- Butang kembali Settings kembali ke tab terakhir sebelum Settings.
- Settings ikut akses web app sedia ada; tiada role/password/admin email dalam fasa pertama.
- `getAppConfig()` akan bawa config kecil, `paymentMethods`, dan `petrolStations` kerana senarai kecil dan diperlukan untuk modal input.
- Migration/ensure sheet rujukan berjalan pada `getAppConfig()`, tetapi mesti idempotent dan hanya menulis jika sheet/header/default belum wujud.
- Semua data rujukan guna soft delete/aktif-tidak aktif, bukan hard delete.
- Duplicate nama dicegah merentas item aktif dan inactive; jika duplicate inactive wujud, user perlu aktifkan semula item lama.
- Emoji dibenarkan dalam kategori/payment/ikon kerana data sedia ada memang menggunakannya.
- `KATEGORI` dan `JENIS_CPO` ditambah kolum terus secara backward-compatible, bukan sheet metadata berasingan.
- `SUSUNAN` guna input nombor mudah, bukan drag/drop.
- Semua entry point rekod, termasuk rekod pukal Belanja dan rekod pukal EV/Minyak, mesti guna data rujukan Settings.
- Selepas save Settings, update state/dropdown sahaja; jangan `loadAllData()` automatik kecuali operasi sistem memang refresh cache.
- Save Settings tidak auto-backup; backup manual kekal di kad Sistem.
- Harga default hanya untuk rekod baharu; edit rekod lama mesti kekalkan harga asal rekod.
- `MAX_BULK_ROWS` dibaca dari config tetapi UI fasa pertama read-only sahaja.
- Editor penuh `BIL_TEMPLATE` ditangguh. Fasa pertama hanya paparkan placeholder Bil dalam Settings.

## Prestasi Load
- Risiko load bertambah hanya jika Settings penuh eager-load semasa `window.onload`.
- Load awal kekal: `getAppConfig()` -> `loadCategories()` -> `loadCPOTypes()` -> `loadAllData()` untuk tab aktif.
- Tambahan startup yang dibenarkan: settings kecil, payment methods aktif, petrol stations aktif melalui cache backend.
- `ensureReferenceSheets()` pada startup mesti cepat: semak sheet/header/default dan return tanpa write bila semua sudah lengkap.
- Data pengurusan penuh Settings dipanggil hanya melalui `openSettingsPage()`.
- Selepas save item rujukan, jangan refresh transaksi/chart/table kerana data rekod tidak berubah.

## Skop Fasa Pertama
Laksana:
- Edit harga default `DEFAULT_HOME_KWH_PRICE`.
- Edit harga default `DEFAULT_PETROL_PRICE`.
- Papar `MAX_BULK_ROWS` sebagai read-only.
- Urus kategori belanja dari `KATEGORI` dengan `AKTIF` dan `SUSUNAN`.
- Urus CPO dari `JENIS_CPO` dengan `AKTIF` dan `SUSUNAN`.
- Urus stesen minyak dari sheet baharu `STESEN_MINYAK`.
- Urus payment method dari sheet baharu `PAYMENT_METHOD`.
- Guna reference aktif yang sama untuk modal tambah/edit dan modal rekod pukal.
- Kad sistem untuk clear cache, backup sekarang, dan install trigger backup mingguan.
- Placeholder Bil Template `Akan datang` sahaja.

Tidak termasuk:
- Editor penuh `BIL_TEMPLATE`.
- Tetapan Solar lanjutan.
- Role/admin/password/email allowlist.
- Audit log settings.
- Import/export settings.
- Custom tema/layout.
- Edit `MAX_BULK_ROWS` melalui UI.
- Auto-backup setiap kali Settings disimpan.
- Search/filter dalam Settings list fasa pertama.

## Struktur Sheet
Tambah sheet `SETTINGS`:
- `KEY`
- `VALUE`
- `TYPE`
- `MODULE`
- `CATATAN`

Seed default `SETTINGS`:
- `DEFAULT_HOME_KWH_PRICE`, `0.4443`, `number`, `EV`, `Harga cas rumah RM/kWh`
- `DEFAULT_PETROL_PRICE`, `1.99`, `number`, `MINYAK`, `Harga petrol default RM/L`
- `MAX_BULK_ROWS`, `50`, `number`, `SYSTEM`, `Had rekod pukal`

Tambah sheet `STESEN_MINYAK`:
- `NAMA`
- `AKTIF`
- `SUSUNAN`

Seed default `STESEN_MINYAK`:
- `Petronas`, `Ya`, `1`
- `Shell`, `Ya`, `2`
- `BHP`, `Ya`, `3`
- `Caltex`, `Ya`, `4`
- `Petron`, `Ya`, `5`

Tambah sheet `PAYMENT_METHOD`:
- `NAMA`
- `AKTIF`
- `SUSUNAN`

Seed default `PAYMENT_METHOD`:
- `💳 CC`, `Ya`, `1`
- `𖣯 QR`, `Ya`, `2`
- `🏦 Transfer`, `Ya`, `3`
- `👛 E-Wallet`, `Ya`, `4`
- `💵 Cash`, `Ya`, `5`

Update sheet sedia ada:
- `KATEGORI`: kekal kolum 1 `NAMA`, kolum 2 `IKON`; tambah kolum `AKTIF`, `SUSUNAN` jika belum wujud.
- `JENIS_CPO`: kekal kolum 1 `NAMA`; tambah kolum `AKTIF`, `SUSUNAN` jika belum wujud.
- Jika `AKTIF` kosong/tiada, treat sebagai `Ya` untuk backward compatibility.
- Jika `SUSUNAN` kosong/tiada, sort fallback ikut row order.

## Sorting Rules
- Semua dropdown rujukan sort ikut `SUSUNAN` ascending.
- Jika `SUSUNAN` kosong atau bukan nombor, gunakan row order sebagai fallback.
- Jika dua item sama `SUSUNAN`, sort ikut row order, bukan alphabetical.
- Settings UI paparkan input nombor `SUSUNAN` untuk setiap item.
- Input `SUSUNAN` optional; kosong dibenarkan dan fallback row order.

## Backend Changes
Tambah constants:
- `SETTINGS_SHEET = 'SETTINGS'`
- `PETROL_STATION_SHEET = 'STESEN_MINYAK'`
- `PAYMENT_METHOD_SHEET = 'PAYMENT_METHOD'`

Tambah helper:
- `ensureReferenceSheets()` untuk create/seed sheet baharu dan tambah header optional jika perlu.
- `ensureSheetHeaders(sheetName, headers)` untuk header tambahan tanpa merosakkan data lama.
- `getHeaderMap(sheet)` untuk baca kolum dinamik.
- `readReferenceList(sheetName, config)` untuk reader generic aktif/susunan.
- `saveReferenceItem(sheetName, payload, config)` untuk create/update generic.
- `setReferenceItemActive(sheetName, rowId, active, config)` untuk soft delete generic.
- `getSettingsMap()` dengan cache `app_settings`.
- `getSettingValue(key, fallback, type)`.
- `updateSetting(key, value)`.

Reader API:
- `getPaymentMethods(includeInactive)`.
- `getPetrolStations(includeInactive)`.
- `getCategories()` kekal untuk dropdown aktif sahaja dan return `{ name, icon }`.
- `getCategoriesForSettings()` return inactive included dengan metadata row.
- `getCPOTypes()` kekal untuk dropdown aktif sahaja dan return array string.
- `getCPOTypesForSettings()` return inactive included dengan metadata row.
- `getSettingsData()` untuk page Settings; return semua list dengan inactive included.

Writer API:
- `saveCategory(payload)`.
- `setCategoryActive(rowId, active)`.
- `saveCPOType(payload)`.
- `setCPOTypeActive(rowId, active)`.
- `savePetrolStation(payload)`.
- `setPetrolStationActive(rowId, active)`.
- `savePaymentMethod(payload)`.
- `setPaymentMethodActive(rowId, active)`.

Expected `getSettingsData()` return:
- `settings`: `{ defaultHomeKwhPrice, defaultPetrolPrice, maxBulkRows }`
- `categories`: `[{ rowId, name, icon, aktif, susunan }]`
- `cpoTypes`: `[{ rowId, name, aktif, susunan }]`
- `petrolStations`: `[{ rowId, name, aktif, susunan }]`
- `paymentMethods`: `[{ rowId, name, aktif, susunan }]`

Expected save/toggle return:
- Always return `{ status: 'success', message, items }` with refreshed list for that reference type.
- Frontend replaces the corresponding `settingsData` list with `items`, then regenerates active global dropdown state for that type.

Validation backend:
- Semua operasi tulis guna `withWriteLock()`.
- Teks guna `sanitize()` untuk trim dan had panjang, tetapi jangan buang emoji.
- Had nama rujukan: 100 aksara untuk kategori/CPO/stesen/payment.
- Had ikon kategori: 20 aksara.
- Harga cas rumah: nombor > 0 dan <= `MAX_EV_PRICE_PER_KWH`.
- Harga petrol: nombor > 0 dan <= `MAX_PETROL_PRICE_PER_LITER`.
- `SUSUNAN` optional; jika diberi mesti nombor integer >= 0 dan <= 9999.
- `MAX_BULK_ROWS` dibaca dari settings tetapi tidak editable UI fasa pertama.
- Nama rujukan tidak boleh kosong.
- Duplicate dicegah case-insensitive merentas aktif dan inactive, kecuali update row sama.
- Jika duplicate inactive wujud, error mesej perlu cadangkan aktifkan semula item tersebut.
- `rowId` wajib melalui `parseRowId()` dan `assertExistingRow()`.
- `set...Active(false)` tolak jika item itu item aktif terakhir untuk jenis tersebut.
- `updateSetting()` hanya benarkan key allowlist: `DEFAULT_HOME_KWH_PRICE`, `DEFAULT_PETROL_PRICE`; `MAX_BULK_ROWS` read-only UI fasa pertama.

## Perubahan Existing Reader
`getCategories()`:
- Jangan lagi fixed baca 2 kolum sahaja jika header sudah berkembang.
- Return hanya aktif secara default untuk dropdown/trend.
- Return shape sedia ada `{ name, icon }` untuk tidak rosakkan frontend semasa.
- `getCategoriesForSettings()` return `{ rowId, name, icon, aktif, susunan }`.

`getCPOTypes()`:
- Jangan lagi fixed baca kolum 1 sahaja jika header sudah berkembang.
- Return array string aktif secara default untuk dropdown sedia ada.
- `getCPOTypesForSettings()` return `{ rowId, name, aktif, susunan }`.

`getCategoryTrend()`:
- Terus guna kategori aktif dari `getCategories()`.
- Transaksi lama dengan kategori inactive/missing masih perlu fallback seperti sekarang melalui `missingFromCategorySheet` supaya data lama tetap muncul dalam trend.

## Perubahan `getAppConfig()`
- Panggil `ensureReferenceSheets()` secara idempotent.
- Baca harga default dari `SETTINGS` dengan fallback constant.
- Return `defaultHomeKwhPrice`, `defaultPetrolPrice`, `maxBulkRows`, `paymentMethods`, `petrolStations`.
- Gunakan cache backend untuk settings/list kecil.
- Jika settings invalid, fallback constant dan jangan crash app.

## Frontend State Baru
Tambah state:
- `globalPaymentMethods = []`
- `globalPetrolStations = []`
- `settingsLoaded = false`
- `settingsDirty = true`
- `settingsData = null`
- `settingsOpen = false`
- `previousTabBeforeSettings = 'summary'`
- `editingPetrolPricePerLiter = null`

`applyAppConfig(config)`:
- Set `DEFAULT_HOME_KWH_PRICE`, `DEFAULT_PETROL_PRICE`, `MAX_BULK_ROWS`.
- Set `globalPaymentMethods` dengan fallback hardcoded jika config kosong.
- Set `globalPetrolStations` dengan fallback hardcoded jika config kosong.
- Render payment dropdown dan petrol station dropdown.

## Frontend Dropdown Helpers
Tambah helper supaya nilai inactive/legacy tidak hilang semasa edit:
- `renderPaymentDropdown(selectedValue)`.
- `renderPetrolStationDropdown(selectedValue)`.
- `renderCategoryDropdown(categories, selectedValue)`.
- `renderCPODropdown(selectedValue)`.
- `renderBulkPaymentOptions()`.
- `renderBulkCategoryOptions()`.
- `renderBulkCPOOptions()`.
- `renderBulkPetrolStationOptions()`.
- `ensureSelectHasOption(selectEl, value, label)`.

Rules helper:
- Untuk tambah rekod baru, render hanya item aktif.
- Untuk edit rekod lama, render item aktif dahulu, kemudian jika selected value tiada, tambah option sementara dengan label seperti `Nama (tidak aktif)`.
- Jangan tulis balik item sementara ke sheet rujukan.
- Semua option value/text guna DOM API bila set kepada existing select; untuk bulk option HTML string, wajib guna `escapeHtml()`.
- `addBulkRow()` mesti guna `renderBulkCategoryOptions()` dan `renderBulkPaymentOptions()`.
- `addEVBulkRow()` mesti guna `renderBulkCPOOptions()` dan `renderBulkPetrolStationOptions()`.

## Frontend UI Flow
Top buttons:
- Kekalkan `darkModeToggle`.
- Tambah `settingsToggle` fixed top, contoh `right-12`; dark mode kekal `right-2`.
- Gear button panggil `openSettingsPage()`.

Settings page:
- Tambah `page-settings` sebagai sibling page lain.
- Header `Tetapan Sistem`.
- Butang kembali panggil `closeSettingsPage()`.

Open/close behavior:
- `openSettingsPage()`:
  - Jika ada pending Bil, panggil `confirmDiscardPendingBilChanges()`; jika user cancel, jangan buka Settings.
  - Simpan `previousTabBeforeSettings = activeTab`.
  - Set `settingsOpen = true`.
  - Hide semua page modul dan show `page-settings`.
  - Clear visual active state bottom nav while Settings is open.
  - Panggil `loadSettingsData()` jika `!settingsLoaded || settingsDirty`.
- `closeSettingsPage()`:
  - Set `settingsOpen = false`.
  - Hide `page-settings`.
  - Restore page dan active nav class `previousTabBeforeSettings` tanpa memanggil `loadAllData()`.
- `switchTab(tab)`:
  - Jika `settingsOpen`, tutup Settings dulu.
  - Tetap panggil pending Bil confirm seperti sekarang untuk tab biasa.
  - Pastikan `page-settings` hidden bila tab biasa dibuka.

## Settings Cards
- `Harga Default`: input harga cas rumah dan harga petrol, button simpan.
- `Belanja`: kategori aktif/tidak aktif, tambah/edit nama, ikon, susunan.
- `EV Cas`: CPO aktif/tidak aktif, tambah/edit nama, susunan.
- `Minyak`: stesen aktif/tidak aktif, tambah/edit nama, susunan.
- `Kaedah Bayaran`: payment aktif/tidak aktif, tambah/edit nama, susunan.
- `Bil Template`: placeholder `Akan datang`; jelas fasa ini tidak mengubah `BIL_TEMPLATE`.
- `Sistem`: clear cache semua, backup sekarang, install trigger backup mingguan, papar `MAX_BULK_ROWS` read-only.

## Settings List UI
- Row tambah baru diletakkan di bahagian atas setiap kad list.
- Setiap row ada input nama, input ikon jika kategori, input susunan, toggle aktif, dan button simpan.
- Item inactive kekal kelihatan dalam Settings dengan gaya muted.
- List rujukan scroll jika panjang; search/filter Settings out of scope fasa pertama.
- Pada mobile, row stack vertically; pada desktop, row guna grid ringkas.

## Confirmation UX
Gunakan confirmation untuk operasi sensitif sahaja:
- Clear cache semua.
- Backup sekarang.
- Install weekly backup trigger.
- Nyahaktif item rujukan (`AKTIF = Tidak`).

Tidak perlu confirmation untuk:
- Save harga default.
- Save nama/ikon/susunan item.
- Aktifkan semula item inactive.

## Overlay Dan UX
Global loader `showLoader(true/false)` untuk:
- Load pertama page Settings.
- Save harga default.
- Save/toggle item rujukan jika operasi reload list dari server.
- Backup dan clear cache.

Button-level busy state untuk:
- Save row kecil.
- Toggle aktif/tidak aktif.
- Refresh Settings.

Failure behavior:
- Save gagal: kekalkan input user dan papar toast error.
- Load settings gagal: papar empty state dalam `page-settings` dengan button `Cuba Lagi`.
- Duplicate: papar `Nama sudah wujud. Aktifkan semula item sedia ada jika perlu.`
- Disable item terakhir aktif: papar mesej jelas.

Unsaved behavior:
- Harga default ada indicator `Belum disimpan` bila input berubah.
- List item save per-row, tiada pending batch.
- Tiada warning `beforeunload` untuk Settings fasa pertama kerana tiada batch state.

## Cache Strategy
Backend cache key baharu:
- `app_settings`
- `payment_methods`
- `petrol_stations`

Invalidate:
- `updateSetting(DEFAULT_HOME_KWH_PRICE)`: remove `app_settings`.
- `updateSetting(DEFAULT_PETROL_PRICE)`: remove `app_settings`.
- Kategori save/toggle: remove `categories`, invalidate expense cache/trend yang bergantung kategori, clear frontend `CATEGORY_CACHE_KEY` selepas success.
- CPO save/toggle: remove `cpo_types`.
- Stesen save/toggle: remove `petrol_stations`.
- Payment save/toggle: remove `payment_methods`.
- `clearDashboardCache()` tambah removal `app_settings`, `payment_methods`, `petrol_stations`.

Frontend cache:
- Kekalkan `CATEGORY_CACHE_KEY` dan TTL.
- Tidak perlu localStorage untuk payment/stesen fasa pertama jika dibawa oleh `getAppConfig()`.
- Selepas save Settings, update state/dropdown terus dan mark `settingsDirty = true` hanya jika perlu reload Settings page dari server.

## Rekod Lama Dan Harga Default
Peraturan:
- Harga default hanya untuk rekod baharu.
- Rekod EV/minyak lama menyimpan harga sendiri dalam sheet.
- Edit rekod lama mesti preserve harga asal, bukan overwrite dengan default terbaru.

Pembetulan frontend wajib:
- `openEditPetrolModal(id)` set `editingPetrolPricePerLiter = it.pricePerLiter`.
- `calcPetrolTotal()` guna `editingPetrolPricePerLiter || DEFAULT_PETROL_PRICE`.
- `handlePetrolSubmit()` hantar `pricePerLiter` dari `editingPetrolPricePerLiter` bila edit, dan `DEFAULT_PETROL_PRICE` bila tambah baru.
- `openAddPetrolModal()` reset `editingPetrolPricePerLiter = null`.
- Label edit minyak perlu tunjuk harga rekod, bukan semata-mata `Harga Tetap` default.
- EV edit sudah hantar `it.pricePerKwh`; pastikan `toggleEVFields(pub, true)` tidak overwrite harga edit.

## Inactive Reference Rules
- Item inactive tidak muncul dalam dropdown rekod baharu.
- Rekod lama masih dipaparkan seperti biasa.
- Bila edit rekod lama dengan value inactive, dropdown mesti tambah option sementara untuk nilai tersebut supaya form boleh disimpan tanpa kehilangan konteks.
- Kategori/CPO/stesen/payment inactive tidak boleh hard delete.
- Settings page mesti boleh toggle inactive kembali ke active.

## Migration Path
1. `ensureReferenceSheets()` create `SETTINGS`, `STESEN_MINYAK`, `PAYMENT_METHOD` jika tiada.
2. Seed default untuk sheet baharu jika sheet kosong.
3. Tambah header optional `AKTIF`, `SUSUNAN` ke `KATEGORI` dan `JENIS_CPO` jika belum wujud.
4. Isi default `AKTIF = Ya` untuk row lama yang kosong.
5. Jangan ubah sheet transaksi `DATA`, `EV_CHARGING`, `MINYAK`, `SOLAR`.
6. Jangan recalculate rekod EV/minyak lama selepas harga default berubah.
7. Jangan buat backup automatik; user boleh guna Backup Sekarang di kad Sistem.

## Implementation Steps
1. Tambah constants sheet baharu di `code.gs`.
2. Tambah helper ensure/migration sheet, header map, generic reference reader/writer, dan cache settings/list.
3. Ubah `getAppConfig()` untuk baca settings kecil, payment methods, petrol stations.
4. Ubah `getCategories()` dan `getCPOTypes()` supaya support `AKTIF/SUSUNAN` secara backward-compatible.
5. Tambah backend get/save/toggle untuk kategori, CPO, stesen, payment.
6. Tambah invalidation cache settings/list ke `clearDashboardCache()`.
7. Tambah state frontend baru untuk payment, petrol station, settings.
8. Tambah dropdown helpers untuk active list, bulk options, dan temporary inactive selected option.
9. Ubah dropdown payment, petrol station, kategori, CPO, dan semua bulk row supaya guna helper/state, bukan hardcoded/fixed string.
10. Tambah gear button top dan `page-settings` markup.
11. Tambah `openSettingsPage()`, `closeSettingsPage()`, `loadSettingsData()`, dan render Settings cards.
12. Tambah handlers save harga, save/toggle category, CPO, station, payment.
13. Tambah confirmation untuk operasi sensitif sahaja.
14. Tambah placeholder Bil Template dalam Settings.
15. Betulkan edit petrol supaya preserve `pricePerLiter` asal.
16. Pastikan semua `innerHTML` untuk settings guna `escapeHtml()` dan `escapeJsString()` bila perlu.
17. Manual test semua tab dan scenario Settings.

## Validation Manual
Startup:
- Load web app pada Ringkasan; pastikan Settings penuh tidak dipanggil.
- Pastikan `getAppConfig()` berjaya walaupun sheet settings belum wujud.
- Pastikan `ensureReferenceSheets()` tidak menulis berulang selepas setup lengkap.
- Pastikan bottom nav kekal 5 item dan gear/dark mode tidak bertindih di mobile.

Settings navigation:
- Buka Settings dari setiap tab, tekan kembali, kembali ke tab asal.
- Jika ada pending Bil, tekan gear Settings dan pastikan warning muncul.
- Jika cancel warning pending Bil, Settings tidak dibuka.
- Tutup Settings tidak memanggil `loadAllData()` tanpa sebab.

Settings access/confirmation:
- User yang boleh akses web app boleh buka Settings; tiada role/password prompt.
- Clear cache, backup, install trigger, dan nyahaktif item memaparkan confirmation.
- Save harga/nama/susunan tidak memaparkan confirmation.
- Save Settings tidak membuat backup automatik.

Belanja:
- Kategori aktif muncul dalam dropdown tambah dan pukal.
- Payment aktif muncul dalam dropdown tambah dan pukal.
- Tambah kategori/payment dari Settings, buka modal belanja dan rekod pukal, item muncul tanpa reload transaksi.
- Inactive kategori/payment tidak muncul untuk rekod baharu.
- Edit rekod lama kategori/payment inactive masih boleh papar/simpan melalui option sementara.
- Tambah kategori/payment dengan nama duplicate inactive ditolak dan user diminta aktifkan semula.

EV/CPO/Minyak:
- CPO aktif muncul untuk cas luar tunggal dan pukal.
- Stesen minyak aktif muncul untuk minyak tunggal dan pukal.
- Cas rumah auto-fill harga rumah.
- Cas luar tidak auto-fill harga rumah.
- Tambah CPO/stesen dari Settings, buka modal tunggal dan pukal, item muncul tanpa reload transaksi.
- Edit rekod cas luar/minyak dengan CPO/stesen inactive masih boleh papar/simpan melalui option sementara.

Minyak Harga:
- Tukar harga petrol default, tambah rekod minyak baru, harga baru digunakan.
- Edit rekod minyak lama selepas harga default berubah, harga asal rekod kekal.

Payment/Emoji:
- Payment methods datang dari sheet `PAYMENT_METHOD`.
- Payment/category dengan emoji masih dipaparkan dan disimpan dengan betul.

Settings/System:
- Save harga default update UI dan `getAppConfig()` berikutnya.
- `MAX_BULK_ROWS` dipaparkan read-only.
- Toggle aktif/tidak aktif update list dan dropdown berkaitan.
- Disable item aktif terakhir ditolak.
- `SUSUNAN` mengubah urutan dropdown selepas save.
- Clear cache semua turut clear settings/list cache.
- Backup sekarang dan install weekly trigger masih berjaya.

Regression:
- Ringkasan jumlah masih tidak termasuk Bil dan Solar dalam jumlah besar.
- Bil pending changes masih warning bila tukar tab biasa.
- Solar load dan CRUD tidak terjejas.
- CSV export masih escape formula dan quote.

## Risiko Dan Mitigasi
- Gear button boleh bertindih dengan dark mode: letak settings `right-12`, dark mode `right-2`.
- Tiada role/password bermaksud semua pengguna web app boleh ubah Settings: diterima fasa pertama dan dokumentasikan sebagai out of scope.
- Apps Script call bertambah: Settings page full lazy-load dan small list guna cache.
- `ensureReferenceSheets()` boleh melambat jika menulis setiap load: wajib idempotent dan write hanya bila perlu.
- Soft delete perlu schema tambahan: migration idempotent dan backward-compatible.
- Existing fixed-column readers boleh rosak jika header bertambah: guna header map dan fallback fixed positions.
- Bulk dropdowns mudah tertinggal kerana hardcoded sekarang: wajib ubah `addBulkRow()` dan `addEVBulkRow()`.
- Edit rekod lama dengan inactive value: tambah option sementara dalam dropdown edit.
- Emoji boleh jadi isu jika guna `innerHTML` raw: guna `escapeHtml()` atau DOM API.
- Cache stale selepas save: invalidate cache spesifik dan update frontend state.
- `BIL_TEMPLATE` risiko tinggi: placeholder sahaja fasa pertama.
