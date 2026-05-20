/**
 * Controllers hold route handlers + domain helpers (registerRoutes pattern).
 * Thin route files in ../routes wire HTTP paths, middleware, and asyncHandler.
 */
module.exports = {
  auth: require('./authController'),
  dashboard: require('./dashboardController'),
  anggota: require('./anggotaController'),
  barang: require('./barangController'),
  supplier: require('./supplierController'),
  coa: require('./coaController'),
  lokasi: require('./lokasiController'),
  refOption: require('./refOptionController'),
  toko: require('./tokoController'),
  pembelian: require('./pembelianController'),
  ppob: require('./ppobController'),
  promo: require('./promoController'),
  simpanan: require('./simpananController'),
  pinjaman: require('./pinjamanController'),
  kredit: require('./kreditController'),
  rental: require('./rentalController'),
  labor: require('./laborController'),
  kwitansi: require('./kwitansiController'),
  usaha: require('./usahaController'),
  pembukuan: require('./pembukuanController'),
  aset: require('./asetController'),
  laporan: require('./laporanController'),
  konsolidasi: require('./konsolidasiController'),
  setting: require('./settingController'),
  audit: require('./auditController'),
};
