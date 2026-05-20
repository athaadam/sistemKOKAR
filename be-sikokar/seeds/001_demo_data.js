/**
 * Demo data ported from schema.sql (INSERT OR IGNORE → onConflict ignore).
 */

/** @param {import('knex').Knex} knex */
async function ignoreInsert(knex, table, rows, conflict = 'id') {
  if (!rows.length) return;
  await knex(table).insert(rows).onConflict(conflict).ignore();
}

/** @param {import('knex').Knex} knex */
exports.seed = async function seed(knex) {
  const now = knex.fn.now();
  const today = new Date().toISOString().slice(0, 10);

  await ignoreInsert(knex, 'lokasi', [
    { id: 'L1', kode: 'KM1', nama: 'KOPMART 1', jenis: 'toko', aktif: 1 },
    { id: 'L2', kode: 'KM2', nama: 'KOPMART 2', jenis: 'toko', aktif: 1 },
    { id: 'L3', kode: 'GDG', nama: 'Gudang', jenis: 'gudang', aktif: 1 },
  ]);

  await ignoreInsert(knex, 'users', [
    { id: 'U01', username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin', nip: 'KOP.2024.001', lokasi_id: null, custom_menus: '', aktif: 1, last_login: '', last_login_ip: '', password_changed_at: '', failed_attempts: 0, created_at: now },
    { id: 'U02', username: 'pengurus', password: 'pengurus123', name: 'H. Supriyadi', role: 'pengurus', nip: 'KOP.2024.002', lokasi_id: null, custom_menus: '', aktif: 1, last_login: '', last_login_ip: '', password_changed_at: '', failed_attempts: 0, created_at: now },
    { id: 'U03', username: 'kasir1', password: 'kasir123', name: 'Sari Dewi', role: 'kasir', nip: 'KOP.2024.003', lokasi_id: 'L1', custom_menus: '', aktif: 1, last_login: '', last_login_ip: '', password_changed_at: '', failed_attempts: 0, created_at: now },
    { id: 'U04', username: 'kasir2', password: 'kasir123', name: 'Adi Nugroho', role: 'kasir', nip: 'KOP.2024.004', lokasi_id: 'L2', custom_menus: '', aktif: 1, last_login: '', last_login_ip: '', password_changed_at: '', failed_attempts: 0, created_at: now },
    { id: 'U05', username: 'simpin', password: 'simpin123', name: 'Dian Pertiwi', role: 'simpin', nip: 'KOP.2024.005', lokasi_id: null, custom_menus: '', aktif: 1, last_login: '', last_login_ip: '', password_changed_at: '', failed_attempts: 0, created_at: now },
    { id: 'U06', username: 'accounting', password: 'acc123', name: 'Rina Wati', role: 'accounting', nip: 'KOP.2024.006', lokasi_id: null, custom_menus: '', aktif: 1, last_login: '', last_login_ip: '', password_changed_at: '', failed_attempts: 0, created_at: now },
  ]);

  await ignoreInsert(knex, 'supplier', [
    { id: 'S01', kode: 'SUP001', nama: 'CV Sumber Pangan', jenis: 'regular', is_pkp: 0, npwp: '', alamat: 'Jl. Pasar Baru No.5', telp: '022-1234567', status: 'aktif', termin_default: 30, created_at: now },
    { id: 'S02', kode: 'SUP002', nama: 'PT Distribusi Nusantara', jenis: 'regular', is_pkp: 1, npwp: '01.234.567.8-001.000', alamat: 'Jl. Industri No.12', telp: '022-7654321', status: 'aktif', termin_default: 30, created_at: now },
    { id: 'S03', kode: 'SUP003', nama: 'UD Maju Jaya', jenis: 'regular', is_pkp: 0, npwp: '', alamat: 'Jl. Perintis No.8', telp: '022-9876543', status: 'aktif', termin_default: 30, created_at: now },
    { id: 'S04', kode: 'SUP004', nama: 'PT Unilever Indonesia', jenis: 'konsinyasi', is_pkp: 1, npwp: '01.001.234.5-002.000', alamat: 'Jakarta Pusat', telp: '021-1234000', status: 'aktif', termin_default: 30, created_at: now },
  ]);

  await ignoreInsert(knex, 'coa', [
    { id: 'COA01', kode: '1-001', nama: 'Kas', tipe: 'aset', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA02', kode: '1-002', nama: 'Bank BRI', tipe: 'aset', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA03', kode: '1-101', nama: 'Piutang Anggota', tipe: 'aset', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA04', kode: '1-102', nama: 'Piutang Pinjaman', tipe: 'aset', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA05', kode: '1-201', nama: 'Persediaan Barang', tipe: 'aset', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA06', kode: '1-501', nama: 'Aset Tetap Kendaraan', tipe: 'aset', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA07', kode: '2-001', nama: 'Hutang Supplier', tipe: 'kewajiban', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA08', kode: '2-002', nama: 'Hutang Provider PPOB', tipe: 'kewajiban', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA09', kode: '3-001', nama: 'Simpanan Anggota', tipe: 'kewajiban', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA10', kode: '4-001', nama: 'Modal Koperasi', tipe: 'ekuitas', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA11', kode: '4-101', nama: 'Cadangan SHU', tipe: 'ekuitas', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA12', kode: '5-001', nama: 'Penjualan', tipe: 'pendapatan', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA13', kode: '5-002', nama: 'Pendapatan Bunga Pinjaman', tipe: 'pendapatan', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA14', kode: '5-003', nama: 'Pendapatan Fee PPOB', tipe: 'pendapatan', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA15', kode: '5-004', nama: 'Pendapatan Rental', tipe: 'pendapatan', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA16', kode: '6-001', nama: 'HPP Barang', tipe: 'beban', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA17', kode: '6-101', nama: 'Beban Gaji', tipe: 'beban', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA18', kode: '6-201', nama: 'Beban Operasional', tipe: 'beban', level: 1, parent_id: null, status: 'aktif' },
    { id: 'COA19', kode: '6-301', nama: 'Beban PPN', tipe: 'beban', level: 1, parent_id: null, status: 'aktif' },
  ]);

  const anggotaBase = { no_rek: '', nama_bank: '', created_at: now };
  await ignoreInsert(knex, 'anggota', [
    { ...anggotaBase, id: 'A001', no: 'A-0001', nip: 'PG.001.001', nama: 'Budi Santoso', nik: '3201129908010001', dept: 'Produksi', jabatan: 'Operator Senior', no_hp: '08112345001', gaji: 5500000, limit_kredit: 3500000, limit_pinjaman: 25000000, limit_darurat: 5000000, max_loans: 5, status: 'aktif', tgl_masuk: '2018-01-15' },
    { ...anggotaBase, id: 'A002', no: 'A-0002', nip: 'PG.001.002', nama: 'Siti Rahayu', nik: '3202120012050002', dept: 'Administrasi', jabatan: 'Staff Admin', no_hp: '08112345002', gaji: 4800000, limit_kredit: 3000000, limit_pinjaman: 20000000, limit_darurat: 4000000, max_loans: 5, status: 'aktif', tgl_masuk: '2019-03-01' },
    { ...anggotaBase, id: 'A003', no: 'A-0003', nip: 'PG.002.001', nama: 'Agus Pratama', nik: '3203138509150003', dept: 'Teknik', jabatan: 'Teknisi Listrik', no_hp: '08112345003', gaji: 6200000, limit_kredit: 4500000, limit_pinjaman: 30000000, limit_darurat: 6000000, max_loans: 5, status: 'aktif', tgl_masuk: '2017-07-01' },
    { ...anggotaBase, id: 'A004', no: 'A-0004', nip: 'PG.003.001', nama: 'Dewi Lestari', nik: '3204149202200004', dept: 'Keuangan', jabatan: 'Akuntan', no_hp: '08112345004', gaji: 7000000, limit_kredit: 5000000, limit_pinjaman: 35000000, limit_darurat: 7000000, max_loans: 5, status: 'aktif', tgl_masuk: '2016-01-01' },
    { ...anggotaBase, id: 'A005', no: 'A-0005', nip: 'PG.004.001', nama: 'Hendra Wijaya', nik: '3205157803030005', dept: 'Logistik', jabatan: 'Supervisor Gudang', no_hp: '08112345005', gaji: 8500000, limit_kredit: 6000000, limit_pinjaman: 40000000, limit_darurat: 8000000, max_loans: 5, status: 'aktif', tgl_masuk: '2015-06-01' },
    { ...anggotaBase, id: 'A006', no: 'A-0006', nip: 'PG.001.003', nama: 'Rina Kurniawati', nik: '3206169605180006', dept: 'Produksi', jabatan: 'Operator', no_hp: '08112345006', gaji: 5200000, limit_kredit: 3000000, limit_pinjaman: 22000000, limit_darurat: 4500000, max_loans: 5, status: 'aktif', tgl_masuk: '2020-02-01' },
    { ...anggotaBase, id: 'A007', no: 'A-0007', nip: 'PG.005.001', nama: 'Dani Firmansyah', nik: '3207178907070007', dept: 'Marketing', jabatan: 'Sales Executive', no_hp: '08112345007', gaji: 6500000, limit_kredit: 4000000, limit_pinjaman: 28000000, limit_darurat: 5500000, max_loans: 5, status: 'aktif', tgl_masuk: '2019-08-15' },
    { ...anggotaBase, id: 'A008', no: 'A-0008', nip: 'PG.001.004', nama: 'Yuli Susanti', nik: '3208188409140008', dept: 'SDM', jabatan: 'Staff SDM', no_hp: '08112345008', gaji: 5800000, limit_kredit: 3500000, limit_pinjaman: 24000000, limit_darurat: 5000000, max_loans: 5, status: 'non-aktif', tgl_masuk: '2020-05-01' },
    { ...anggotaBase, id: 'A009', no: 'A-0009', nip: 'PG.002.002', nama: 'Bambang Nugroho', nik: '3209197705120009', dept: 'Teknik', jabatan: 'Kepala Teknik', no_hp: '08112345009', gaji: 9500000, limit_kredit: 7000000, limit_pinjaman: 50000000, limit_darurat: 10000000, max_loans: 5, status: 'aktif', tgl_masuk: '2014-01-01' },
    { ...anggotaBase, id: 'A010', no: 'A-0010', nip: 'PG.006.001', nama: 'Maya Indrani', nik: '3210199401300010', dept: 'IT', jabatan: 'IT Support', no_hp: '08112345010', gaji: 7200000, limit_kredit: 5000000, limit_pinjaman: 32000000, limit_darurat: 6500000, max_loans: 5, status: 'aktif', tgl_masuk: '2021-03-15' },
  ]);

  await ignoreInsert(knex, 'barang', [
    { id: 'B01', kode: 'BRG001', barcode: '8990001001', nama: 'Beras Premium 5kg', kategori: 'Sembako', satuan: 'Karung', harga_beli: 65000, harga: 72000, tipe: 'regular', supplier_id: 'S01', is_taxable: 0, satuan_default: 'PCS', created_at: now },
    { id: 'B02', kode: 'BRG002', barcode: '8990001002', nama: 'Minyak Goreng 2L', kategori: 'Sembako', satuan: 'Botol', harga_beli: 32000, harga: 38000, tipe: 'regular', supplier_id: 'S01', is_taxable: 0, satuan_default: 'PCS', created_at: now },
    { id: 'B03', kode: 'BRG003', barcode: '8990001003', nama: 'Gula Pasir 1kg', kategori: 'Sembako', satuan: 'Kg', harga_beli: 13000, harga: 16000, tipe: 'regular', supplier_id: 'S01', is_taxable: 0, satuan_default: 'PCS', created_at: now },
    { id: 'B04', kode: 'BRG004', barcode: '8990002001', nama: 'Indomie Goreng (box)', kategori: 'Makanan', satuan: 'Box', harga_beli: 95000, harga: 115000, tipe: 'regular', supplier_id: 'S02', is_taxable: 0, satuan_default: 'PCS', created_at: now },
    { id: 'B05', kode: 'BRG005', barcode: '8990002002', nama: 'Air Mineral 6x1500ml', kategori: 'Minuman', satuan: 'Pack', harga_beli: 26000, harga: 32000, tipe: 'regular', supplier_id: 'S02', is_taxable: 0, satuan_default: 'PCS', created_at: now },
    { id: 'B06', kode: 'BRG006', barcode: '8990003001', nama: 'Sabun Mandi Lifebuoy', kategori: 'Perawatan', satuan: 'Pcs', harga_beli: 9000, harga: 12000, tipe: 'regular', supplier_id: 'S03', is_taxable: 0, satuan_default: 'PCS', created_at: now },
    { id: 'B07', kode: 'BRG007', barcode: '8990003002', nama: 'Deterjen Rinso 1kg', kategori: 'Kebersihan', satuan: 'Bungkus', harga_beli: 17000, harga: 22000, tipe: 'regular', supplier_id: 'S03', is_taxable: 0, satuan_default: 'PCS', created_at: now },
    { id: 'B08', kode: 'BRG008', barcode: '8990002003', nama: 'Susu UHT Full Cream 1L', kategori: 'Minuman', satuan: 'Liter', harga_beli: 14000, harga: 18500, tipe: 'regular', supplier_id: 'S02', is_taxable: 0, satuan_default: 'PCS', created_at: now },
    { id: 'B09', kode: 'BRG009', barcode: '8990001004', nama: 'Telur Ayam Negeri 1kg', kategori: 'Sembako', satuan: 'Kg', harga_beli: 23000, harga: 28000, tipe: 'regular', supplier_id: 'S01', is_taxable: 0, satuan_default: 'PCS', created_at: now },
    { id: 'B10', kode: 'BRG010', barcode: '8990003003', nama: 'Tissue Paseo 250 sheet', kategori: 'Kebersihan', satuan: 'Pack', harga_beli: 11000, harga: 15000, tipe: 'regular', supplier_id: 'S03', is_taxable: 0, satuan_default: 'PCS', created_at: now },
    { id: 'B11', kode: 'BRG011', barcode: '8990002004', nama: 'Kopi Kapal Api 200g', kategori: 'Minuman', satuan: 'Bungkus', harga_beli: 19000, harga: 24000, tipe: 'regular', supplier_id: 'S02', is_taxable: 0, satuan_default: 'PCS', created_at: now },
    { id: 'B12', kode: 'BRG012', barcode: '8990004001', nama: 'Shampoo Pantene 340ml', kategori: 'Perawatan', satuan: 'Botol', harga_beli: 28000, harga: 35000, tipe: 'konsinyasi', supplier_id: 'S04', is_taxable: 1, satuan_default: 'PCS', created_at: now },
    { id: 'B13', kode: 'BRG013', barcode: '8990003004', nama: 'Sabun Cuci Sunlight 800ml', kategori: 'Kebersihan', satuan: 'Botol', harga_beli: 16000, harga: 21000, tipe: 'regular', supplier_id: 'S03', is_taxable: 0, satuan_default: 'PCS', created_at: now },
    { id: 'B14', kode: 'BRG014', barcode: '8990001005', nama: 'Tepung Terigu 1kg', kategori: 'Sembako', satuan: 'Kg', harga_beli: 10000, harga: 13500, tipe: 'regular', supplier_id: 'S01', is_taxable: 0, satuan_default: 'PCS', created_at: now },
  ]);

  const stokRows = [];
  const stokData = [
    ['SK001', 'B01', 'L1', 85], ['SK002', 'B01', 'L2', 42], ['SK003', 'B02', 'L1', 60], ['SK004', 'B02', 'L2', 30],
    ['SK005', 'B03', 'L1', 120], ['SK006', 'B03', 'L2', 75], ['SK007', 'B04', 'L1', 45], ['SK008', 'B04', 'L2', 20],
    ['SK009', 'B05', 'L1', 90], ['SK010', 'B05', 'L2', 50], ['SK011', 'B06', 'L1', 150], ['SK012', 'B06', 'L2', 80],
    ['SK013', 'B07', 'L1', 70], ['SK014', 'B07', 'L2', 40], ['SK015', 'B08', 'L1', 110], ['SK016', 'B08', 'L2', 55],
    ['SK017', 'B09', 'L1', 65], ['SK018', 'B09', 'L2', 35], ['SK019', 'B10', 'L1', 95], ['SK020', 'B10', 'L2', 45],
    ['SK021', 'B11', 'L1', 80], ['SK022', 'B11', 'L2', 38], ['SK023', 'B12', 'L1', 55], ['SK024', 'B12', 'L2', 25],
    ['SK025', 'B13', 'L1', 60], ['SK026', 'B13', 'L2', 30], ['SK027', 'B14', 'L1', 100], ['SK028', 'B14', 'L2', 55],
  ];
  for (const [id, barang_id, lokasi_id, jumlah] of stokData) {
    stokRows.push({ id, barang_id, lokasi_id, jumlah, updated_at: now });
  }
  await ignoreInsert(knex, 'stok', stokRows);

  await ignoreInsert(knex, 'piutang', [
    { id: 'PI001', anggota_id: 'A001', saldo: 1800000, updated_at: now },
    { id: 'PI002', anggota_id: 'A003', saldo: 950000, updated_at: now },
  ]);

  await ignoreInsert(knex, 'simpanan', [
    { id: 'SM001', anggota_id: 'A001', jenis: 'pokok', saldo: 1000000, updated_at: now },
    { id: 'SM002', anggota_id: 'A001', jenis: 'wajib', saldo: 1500000, updated_at: now },
    { id: 'SM003', anggota_id: 'A001', jenis: 'sukarela', saldo: 2500000, updated_at: now },
    { id: 'SM004', anggota_id: 'A002', jenis: 'pokok', saldo: 1000000, updated_at: now },
    { id: 'SM005', anggota_id: 'A002', jenis: 'wajib', saldo: 1200000, updated_at: now },
    { id: 'SM006', anggota_id: 'A002', jenis: 'sukarela', saldo: 800000, updated_at: now },
    { id: 'SM007', anggota_id: 'A003', jenis: 'pokok', saldo: 1000000, updated_at: now },
    { id: 'SM008', anggota_id: 'A003', jenis: 'wajib', saldo: 1800000, updated_at: now },
    { id: 'SM009', anggota_id: 'A003', jenis: 'sukarela', saldo: 3200000, updated_at: now },
    { id: 'SM010', anggota_id: 'A004', jenis: 'pokok', saldo: 1000000, updated_at: now },
    { id: 'SM011', anggota_id: 'A004', jenis: 'wajib', saldo: 2100000, updated_at: now },
    { id: 'SM012', anggota_id: 'A004', jenis: 'sukarela', saldo: 5000000, updated_at: now },
    { id: 'SM013', anggota_id: 'A005', jenis: 'pokok', saldo: 1000000, updated_at: now },
    { id: 'SM014', anggota_id: 'A005', jenis: 'wajib', saldo: 2550000, updated_at: now },
    { id: 'SM015', anggota_id: 'A005', jenis: 'sukarela', saldo: 7500000, updated_at: now },
    { id: 'SM016', anggota_id: 'A006', jenis: 'pokok', saldo: 1000000, updated_at: now },
    { id: 'SM017', anggota_id: 'A006', jenis: 'wajib', saldo: 1560000, updated_at: now },
    { id: 'SM018', anggota_id: 'A006', jenis: 'sukarela', saldo: 1200000, updated_at: now },
    { id: 'SM019', anggota_id: 'A007', jenis: 'pokok', saldo: 1000000, updated_at: now },
    { id: 'SM020', anggota_id: 'A007', jenis: 'wajib', saldo: 1950000, updated_at: now },
    { id: 'SM021', anggota_id: 'A007', jenis: 'sukarela', saldo: 2800000, updated_at: now },
    { id: 'SM022', anggota_id: 'A008', jenis: 'pokok', saldo: 1000000, updated_at: now },
    { id: 'SM023', anggota_id: 'A008', jenis: 'wajib', saldo: 1740000, updated_at: now },
    { id: 'SM024', anggota_id: 'A009', jenis: 'pokok', saldo: 1000000, updated_at: now },
    { id: 'SM025', anggota_id: 'A009', jenis: 'wajib', saldo: 2850000, updated_at: now },
    { id: 'SM026', anggota_id: 'A009', jenis: 'sukarela', saldo: 12000000, updated_at: now },
    { id: 'SM027', anggota_id: 'A010', jenis: 'pokok', saldo: 1000000, updated_at: now },
    { id: 'SM028', anggota_id: 'A010', jenis: 'wajib', saldo: 2160000, updated_at: now },
    { id: 'SM029', anggota_id: 'A010', jenis: 'sukarela', saldo: 3500000, updated_at: now },
  ]);

  await ignoreInsert(knex, 'pinjaman', [
    { id: 'P001', no: 'PIN-20240115-001', anggota_id: 'A001', jenis: 'regular', nominal: 10000000, disetujui: 10000000, tenor: 12, bunga: 1.5, angsuran: 916667, sisa_pokok: 7500000, status: 'aktif', tgl_pengajuan: '2024-01-10', tgl_cair: '2024-01-15', rule: 'custom_nominal', catatan: null, user_id: 'U05', created_at: now },
    { id: 'P002', no: 'PIN-20240301-002', anggota_id: 'A003', jenis: 'regular', nominal: 15000000, disetujui: 15000000, tenor: 24, bunga: 1.5, angsuran: 729167, sisa_pokok: 13500000, status: 'aktif', tgl_pengajuan: '2024-02-28', tgl_cair: '2024-03-01', rule: 'custom_nominal', catatan: null, user_id: 'U05', created_at: now },
    { id: 'P003', no: 'PIN-20240410-003', anggota_id: 'A005', jenis: 'darurat', nominal: 5000000, disetujui: 5000000, tenor: 6, bunga: 1.0, angsuran: 858333, sisa_pokok: 4000000, status: 'aktif', tgl_pengajuan: '2024-04-09', tgl_cair: '2024-04-10', rule: 'custom_nominal', catatan: null, user_id: 'U05', created_at: now },
  ]);

  await ignoreInsert(knex, 'kendaraan', [
    { id: 'V01', kode: 'KND-001', no_pol: 'D 1234 AB', nama: 'Toyota Avanza 2021', jenis: 'Kendaraan Roda 4', tarif_harian: 350000, tarif_bulanan: 8500000, status: 'tersedia', km: 45230, kapasitas: 7, created_at: now },
    { id: 'V02', kode: 'KND-002', no_pol: 'D 5678 CD', nama: 'Honda Brio 2022', jenis: 'Kendaraan Roda 4', tarif_harian: 280000, tarif_bulanan: 6500000, status: 'tersedia', km: 28900, kapasitas: 4, created_at: now },
    { id: 'V03', kode: 'KND-003', no_pol: 'D 9012 EF', nama: 'Mitsubishi L300 2020', jenis: 'Pick-up', tarif_harian: 400000, tarif_bulanan: 9500000, status: 'tersedia', km: 62100, kapasitas: 3, created_at: now },
    { id: 'V04', kode: 'KND-004', no_pol: 'D 3456 GH', nama: 'Toyota HiAce 2023', jenis: 'Minibus', tarif_harian: 750000, tarif_bulanan: 18000000, status: 'tersedia', km: 31500, kapasitas: 15, created_at: now },
    { id: 'V05', kode: 'KND-005', no_pol: '', nama: 'Forklift Toyota 3T 2021', jenis: 'Forklift', tarif_harian: 450000, tarif_bulanan: 10000000, status: 'tersedia', km: 0, kapasitas: 1, created_at: now },
    { id: 'V06', kode: 'KND-006', no_pol: '', nama: 'Office Container 20ft', jenis: 'Office Container', tarif_harian: 200000, tarif_bulanan: 4500000, status: 'tersedia', km: 0, kapasitas: 1, created_at: now },
  ]);

  await ignoreInsert(knex, 'approval', [
    {
      id: 'AP001',
      modul: 'Pinjaman',
      ref: 'PIN-DRAFT-001',
      anggota_id: 'A006',
      anggota_nama: 'Rina Kurniawati (A-0006)',
      deskripsi: 'Pengajuan pinjaman regular Rp 8.000.000 tenor 12 bulan',
      tgl: today,
      status: 'pending',
      priority: 'normal',
      catatan: null,
      approver_id: null,
      approver_nama: null,
      tgl_approval: null,
      created_at: now,
    },
  ]);

  const settings = [
    ['nama_kop', 'Koperasi KOKARSI', 'Nama Koperasi'],
    ['alamat', 'Jl. Koperasi No.1', 'Alamat'],
    ['telp', '022-1234567', 'Telepon'],
    ['ppn_rate', '12', 'Tarif PPN (%)'],
    ['pph21_rate', '5', 'Tarif PPh 21 (%)'],
    ['pph23_rate', '2', 'Tarif PPh 23 (%)'],
    ['bunga_regular', '1.5', 'Bunga Pinjaman Regular (%/bln)'],
    ['bunga_darurat', '1.0', 'Bunga Pinjaman Darurat (%/bln)'],
    ['limit_approval_pinjaman', '20000000', 'Batas otomatis'],
    ['max_loans', '5', 'Max Pinjaman Aktif Default'],
    ['nama_toko1', 'KOPMART 1', 'Nama Toko 1'],
    ['nama_toko2', 'KOPMART 2', 'Nama Toko 2'],
    ['print_header1', '', 'Header Print 1'],
    ['print_header2', '', 'Header Print 2'],
    ['logo_path', '', 'Logo Path'],
    ['member_discount_pct', '0', 'Diskon Otomatis Member (%)'],
    ['limit_kredit_toko_bulanan', '3500000', 'Limit Kredit Toko per Anggota per Bulan (Rp)'],
    ['pinjaman_regular_max', '70000000', 'Maks Pinjaman Regular (Rp)'],
    ['pinjaman_darurat_max_total', '10000000', 'Maks Total Pinjaman Darurat (Rp)'],
    ['pinjaman_darurat_max_per_ajuan', '3500000', 'Maks per Pengajuan Darurat (Rp)'],
    ['pinjaman_darurat_max_aktif', '4', 'Maks Pinjaman Darurat Aktif'],
    ['pph23_rate', '2', 'Tarif PPh 23 (%)'],
    ['shu_cadangan_pct', '25', 'SHU: % Dana Cadangan'],
    ['shu_anggota_pct', '40', 'SHU: % Jasa Anggota'],
    ['shu_pengurus_pct', '5', 'SHU: % Jasa Pengurus'],
    ['shu_karyawan_pct', '10', 'SHU: % Dana Karyawan'],
    ['shu_sosial_pct', '10', 'SHU: % Dana Sosial'],
    ['shu_pendidikan_pct', '10', 'SHU: % Dana Pendidikan'],
    ['bunga_jasa_simpanan_pct', '3', 'Bunga Jasa Simpanan/tahun (%)'],
    ['toko_overlimit_approval', '1', 'Toleransi over-limit toko dengan approval (1=ya)'],
    ['toko_overlimit_max_pct', '20', 'Max over-limit (% dari limit normal)'],
    ['password_min_length', '8', 'Password minimal karakter'],
    ['password_require_complex', '1', 'Wajib campuran huruf+angka (1=ya)'],
    ['password_expiry_days', '90', 'Password kadaluarsa (hari, 0=tidak)'],
    ['session_timeout_minutes', '60', 'Session timeout (menit)'],
    ['ip_whitelist', '', 'IP whitelist (comma separated, kosong=semua)'],
    ['backup_auto_enabled', '0', 'Backup otomatis (1=aktif)'],
    ['backup_auto_path', 'backup/', 'Path backup otomatis'],
    ['backup_cloud_token', '', 'Token Cloud (Google Drive/Dropbox)'],
  ];
  await ignoreInsert(
    knex,
    'setting',
    settings.map(([key, value, label]) => ({ key, value, label })),
    'key',
  );

  await ignoreInsert(knex, 'ref_option', [
    { id: 'RO-PCS', group_key: 'satuan_barang', value: 'PCS', label: 'PCS', aktif: 1, created_at: now },
    { id: 'RO-BOX', group_key: 'satuan_barang', value: 'BOX', label: 'BOX', aktif: 1, created_at: now },
    { id: 'RO-KG', group_key: 'satuan_barang', value: 'KG', label: 'KG', aktif: 1, created_at: now },
    { id: 'RO-PACK', group_key: 'satuan_barang', value: 'PACK', label: 'PACK', aktif: 1, created_at: now },
    { id: 'RO-LITER', group_key: 'satuan_barang', value: 'LITER', label: 'LITER', aktif: 1, created_at: now },
    { id: 'RO-MTN-SERVICE', group_key: 'maintenance_jenis', value: 'service', label: 'Service Berkala', aktif: 1, created_at: now },
    { id: 'RO-MTN-OLI', group_key: 'maintenance_jenis', value: 'ganti-oli', label: 'Ganti Oli', aktif: 1, created_at: now },
    { id: 'RO-MTN-REPAIR', group_key: 'maintenance_jenis', value: 'repair', label: 'Repair/Perbaikan', aktif: 1, created_at: now },
    { id: 'RO-MTN-BENSIN', group_key: 'maintenance_jenis', value: 'bensin', label: 'Pembelian Bensin', aktif: 1, created_at: now },
    { id: 'RO-MTN-SOLAR', group_key: 'maintenance_jenis', value: 'solar', label: 'Pembelian Solar', aktif: 1, created_at: now },
    { id: 'RO-USAHA-CAT', group_key: 'usaha_jenis', value: 'catering', label: 'Catering', aktif: 1, created_at: now },
    { id: 'RO-USAHA-PARCEL', group_key: 'usaha_jenis', value: 'parcel', label: 'Parcel', aktif: 1, created_at: now },
    { id: 'RO-USAHA-AIR', group_key: 'usaha_jenis', value: 'air_mineral', label: 'Air Mineral', aktif: 1, created_at: now },
    { id: 'RO-USAHA-LAIN', group_key: 'usaha_jenis', value: 'lainnya', label: 'Lainnya', aktif: 1, created_at: now },
    { id: 'RO-KR-MOTOR', group_key: 'kredit_jenis', value: 'motor', label: '🏍️ Motor / Kendaraan', aktif: 1, created_at: now },
    { id: 'RO-KR-ELEK', group_key: 'kredit_jenis', value: 'elektronik', label: '📱 Elektronik', aktif: 1, created_at: now },
    { id: 'RO-KR-PERABOT', group_key: 'kredit_jenis', value: 'perabot', label: '🛋️ Perabot Rumah', aktif: 1, created_at: now },
    { id: 'RO-KR-LAIN', group_key: 'kredit_jenis', value: 'lainnya', label: '📦 Lainnya', aktif: 1, created_at: now },
    { id: 'RO-JAB-STAFF', group_key: 'jabatan', value: 'staff', label: 'Staff', aktif: 1, created_at: now },
    { id: 'RO-JAB-SUP', group_key: 'jabatan', value: 'supervisor', label: 'Supervisor', aktif: 1, created_at: now },
    { id: 'RO-JAB-MGR', group_key: 'jabatan', value: 'manager', label: 'Manager', aktif: 1, created_at: now },
    { id: 'RO-JAB-DIR', group_key: 'jabatan', value: 'direktur', label: 'Direktur', aktif: 1, created_at: now },
    { id: 'RO-JAB-OP', group_key: 'jabatan', value: 'operator', label: 'Operator', aktif: 1, created_at: now },
    { id: 'RO-DEPT-UMUM', group_key: 'departemen', value: 'umum', label: 'Umum', aktif: 1, created_at: now },
    { id: 'RO-DEPT-KEU', group_key: 'departemen', value: 'keuangan', label: 'Keuangan', aktif: 1, created_at: now },
    { id: 'RO-DEPT-OPS', group_key: 'departemen', value: 'operasional', label: 'Operasional', aktif: 1, created_at: now },
    { id: 'RO-DEPT-SDM', group_key: 'departemen', value: 'sdm', label: 'SDM/HRD', aktif: 1, created_at: now },
    { id: 'RO-DEPT-IT', group_key: 'departemen', value: 'it', label: 'IT', aktif: 1, created_at: now },
    { id: 'RO-DEPT-MKT', group_key: 'departemen', value: 'marketing', label: 'Marketing', aktif: 1, created_at: now },
  ]);
};
