/**
 * SIKOKAR initial schema — MySQL via Knex.
 * Source: schema.sql + migrate_db() extras (app.py).
 */

const id = (t, name = 'id') => t.string(name, 36).primary();
const money = (t, name, def = 0) => t.decimal(name, 15, 2).notNullable().defaultTo(def);
const flag = (t, name, def = 0) => t.tinyint(name).notNullable().defaultTo(def);
const ts = (knex, t, name) =>
  t.datetime(name).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable('lokasi', (t) => {
    id(t);
    t.string('kode', 50);
    t.string('nama', 255).notNullable();
    t.string('jenis', 50).notNullable().defaultTo('toko');
    flag(t, 'aktif', 1);
  });

  await knex.schema.createTable('users', (t) => {
    id(t);
    t.string('username', 100).notNullable().unique();
    t.string('password', 255).notNullable();
    t.string('name', 255).notNullable();
    t.string('role', 50).notNullable().defaultTo('kasir');
    t.string('nip', 50);
    t.string('lokasi_id', 36);
    t.text('custom_menus').defaultTo('');
    flag(t, 'aktif', 1);
    t.string('last_login', 50).defaultTo('');
    t.string('last_login_ip', 50).defaultTo('');
    t.string('password_changed_at', 50).defaultTo('');
    t.integer('failed_attempts').notNullable().defaultTo(0);
    t.integer('password_expiry_days').notNullable().defaultTo(90);
    flag(t, 'force_password_change', 0);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('anggota', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('nip', 50);
    t.string('nama', 255).notNullable();
    t.string('nik', 30);
    t.string('dept', 100);
    t.string('jabatan', 100);
    t.string('no_hp', 30);
    money(t, 'gaji', 0);
    money(t, 'limit_kredit', 3000000);
    money(t, 'limit_pinjaman', 20000000);
    money(t, 'limit_darurat', 5000000);
    t.integer('max_loans').notNullable().defaultTo(5);
    t.string('status', 30).notNullable().defaultTo('aktif');
    t.string('tgl_masuk', 20);
    t.string('no_rek', 50).defaultTo('');
    t.string('nama_bank', 100).defaultTo('');
    t.text('foto').defaultTo('');
    t.string('tgl_lahir', 20).defaultTo('');
    t.text('alamat').defaultTo('');
    t.string('kontak_darurat', 100).defaultTo('');
    t.string('telp_darurat', 30).defaultTo('');
    t.text('alamat_lengkap').defaultTo('');
    t.string('kontak_darurat_nama', 100).defaultTo('');
    t.string('status_detail', 30).defaultTo('aktif');
    t.string('tgl_keluar', 20).defaultTo('');
    t.text('alasan_keluar').defaultTo('');
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('supplier', (t) => {
    id(t);
    t.string('kode', 50).unique();
    t.string('nama', 255).notNullable();
    t.string('jenis', 50).notNullable().defaultTo('regular');
    flag(t, 'is_pkp', 0);
    t.string('npwp', 50);
    t.text('alamat');
    t.string('telp', 50);
    t.string('status', 30).notNullable().defaultTo('aktif');
    t.integer('termin_default').notNullable().defaultTo(30);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('coa', (t) => {
    id(t);
    t.string('kode', 50).notNullable().unique();
    t.string('nama', 255).notNullable();
    t.string('tipe', 50).notNullable();
    t.integer('level').notNullable().defaultTo(1);
    t.string('parent_id', 36);
    t.string('status', 30).notNullable().defaultTo('aktif');
  });

  await knex.schema.createTable('barang', (t) => {
    id(t);
    t.string('kode', 50).notNullable().unique();
    t.string('barcode', 50);
    t.string('nama', 255).notNullable();
    t.string('kategori', 100);
    t.string('satuan', 50).notNullable().defaultTo('pcs');
    money(t, 'harga_beli', 0);
    money(t, 'harga', 0);
    t.string('tipe', 50).notNullable().defaultTo('regular');
    t.string('supplier_id', 36)
      .references('id')
      .inTable('supplier')
      .onDelete('SET NULL');
    flag(t, 'is_taxable', 0);
    t.string('satuan_default', 50).notNullable().defaultTo('PCS');
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('stok', (t) => {
    id(t);
    t.string('barang_id', 36)
      .notNullable()
      .references('id')
      .inTable('barang')
      .onDelete('CASCADE');
    t.string('lokasi_id', 36)
      .notNullable()
      .references('id')
      .inTable('lokasi')
      .onDelete('CASCADE');
    money(t, 'jumlah', 0);
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    t.unique(['barang_id', 'lokasi_id']);
  });

  await knex.schema.createTable('pos_shift', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('user_id', 36);
    t.string('user_name', 255);
    t.string('lokasi_id', 36);
    t.string('lokasi_nama', 255);
    t.string('tgl_buka', 30);
    money(t, 'saldo_awal', 0);
    t.string('tgl_tutup', 30);
    money(t, 'saldo_akhir', 0);
    money(t, 'saldo_fisik', 0);
    money(t, 'selisih', 0);
    money(t, 'total_penjualan', 0);
    money(t, 'total_kredit', 0);
    money(t, 'total_tunai', 0);
    t.text('catatan');
    t.string('status', 20).notNullable().defaultTo('open');
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('promo', (t) => {
    id(t);
    t.string('nama', 255);
    t.string('tipe', 30);
    money(t, 'nilai', 0);
    t.string('barang_id', 36);
    t.string('kategori', 100);
    t.integer('min_qty').notNullable().defaultTo(1);
    money(t, 'min_total', 0);
    flag(t, 'member_only', 0);
    t.string('tgl_mulai', 20);
    t.string('tgl_akhir', 20);
    t.string('status', 30).notNullable().defaultTo('aktif');
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('penjualan', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('tgl', 20).notNullable();
    t.string('lokasi_id', 36)
      .references('id')
      .inTable('lokasi')
      .onDelete('SET NULL');
    t.string('jenis', 30).notNullable().defaultTo('cash');
    t.string('anggota_id', 36)
      .references('id')
      .inTable('anggota')
      .onDelete('SET NULL');
    money(t, 'subtotal', 0);
    money(t, 'diskon_total', 0);
    money(t, 'ppn_total', 0);
    money(t, 'total', 0);
    flag(t, 'pkp', 0);
    t.string('status', 30).notNullable().defaultTo('lunas');
    t.string('kasir_id', 36);
    t.string('shift_id', 36).defaultTo('');
    t.string('promo_id', 36).defaultTo('');
    money(t, 'diskon', 0);
    flag(t, 'void', 0);
    t.string('payment_channel', 30).notNullable().defaultTo('cash');
    flag(t, 'approval_over_limit', 0);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('penjualan_item', (t) => {
    id(t);
    t.string('penjualan_id', 36)
      .notNullable()
      .references('id')
      .inTable('penjualan')
      .onDelete('CASCADE');
    t.string('barang_id', 36)
      .references('id')
      .inTable('barang')
      .onDelete('SET NULL');
    t.string('nama', 255);
    money(t, 'qty', 1);
    money(t, 'harga', 0);
    money(t, 'diskon_pct', 0);
    money(t, 'diskon', 0);
    money(t, 'ppn', 0);
    money(t, 'subtotal', 0);
  });

  await knex.schema.createTable('piutang', (t) => {
    id(t);
    t.string('anggota_id', 36)
      .notNullable()
      .unique()
      .references('id')
      .inTable('anggota')
      .onDelete('CASCADE');
    money(t, 'saldo', 0);
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });

  await knex.schema.createTable('simpanan', (t) => {
    id(t);
    t.string('anggota_id', 36)
      .notNullable()
      .references('id')
      .inTable('anggota')
      .onDelete('CASCADE');
    t.string('jenis', 50).notNullable();
    money(t, 'saldo', 0);
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    t.unique(['anggota_id', 'jenis']);
  });

  await knex.schema.createTable('simpanan_trx', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('tgl', 20).notNullable();
    t.string('anggota_id', 36)
      .references('id')
      .inTable('anggota')
      .onDelete('SET NULL');
    t.string('jenis', 50);
    t.string('tipe', 50);
    money(t, 'nominal', 0);
    t.string('metode', 30).notNullable().defaultTo('tunai');
    t.text('ket');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('pinjaman', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('anggota_id', 36)
      .references('id')
      .inTable('anggota')
      .onDelete('SET NULL');
    t.string('jenis', 30).notNullable().defaultTo('regular');
    money(t, 'nominal', 0);
    money(t, 'disetujui', 0);
    t.integer('tenor').notNullable().defaultTo(12);
    money(t, 'bunga', 1.5);
    money(t, 'angsuran', 0);
    money(t, 'sisa_pokok', 0);
    t.string('status', 30).notNullable().defaultTo('aktif');
    t.string('tgl_pengajuan', 20);
    t.string('tgl_cair', 20);
    t.string('rule', 50).notNullable().defaultTo('custom_nominal');
    t.text('catatan');
    t.string('rate_type', 30).notNullable().defaultTo('flat');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('pinjaman_bayar', (t) => {
    id(t);
    t.string('pinjaman_id', 36)
      .notNullable()
      .references('id')
      .inTable('pinjaman')
      .onDelete('CASCADE');
    t.string('tgl', 20).notNullable();
    money(t, 'nominal', 0);
    money(t, 'pokok', 0);
    money(t, 'bunga', 0);
    t.string('metode', 30).notNullable().defaultTo('tunai');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('ppob_trx', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('tgl', 20).notNullable();
    t.string('layanan', 100);
    t.string('jenis', 50);
    t.string('pelanggan', 100);
    money(t, 'nominal', 0);
    money(t, 'fee', 0);
    money(t, 'total', 0);
    money(t, 'saldo_provider', 0);
    money(t, 'komisi_agen', 0);
    t.string('status', 30).notNullable().defaultTo('sukses');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('kendaraan', (t) => {
    id(t);
    t.string('kode', 50).unique();
    t.string('no_pol', 30);
    t.string('nama', 255).notNullable();
    t.string('jenis', 100);
    money(t, 'tarif_harian', 0);
    money(t, 'tarif_bulanan', 0);
    t.string('status', 30).notNullable().defaultTo('tersedia');
    money(t, 'km', 0);
    t.integer('kapasitas').notNullable().defaultTo(4);
    t.text('foto').defaultTo('');
    t.string('no_polisi', 30).defaultTo('');
    t.integer('tahun').notNullable().defaultTo(0);
    t.integer('km_terkini').notNullable().defaultTo(0);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('rental', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('tgl_buat', 20);
    t.string('tgl_mulai', 20);
    t.string('tgl_selesai', 20);
    t.string('kendaraan_id', 36)
      .references('id')
      .inTable('kendaraan')
      .onDelete('SET NULL');
    t.string('penyewa_tipe', 30).notNullable().defaultTo('umum');
    t.string('nama_penyewa', 255);
    t.string('nama_perusahaan', 255);
    t.string('npwp_penyewa', 50);
    t.string('no_hp', 30);
    t.text('keperluan');
    t.string('tipe_harga', 30).notNullable().defaultTo('harian');
    money(t, 'tarif', 0);
    t.integer('hari').notNullable().defaultTo(1);
    t.integer('bulan').notNullable().defaultTo(0);
    money(t, 'total', 0);
    money(t, 'dp', 0);
    money(t, 'km_awal', 0);
    money(t, 'km_kembali', 0);
    t.string('kondisi', 30).notNullable().defaultTo('baik');
    t.string('status', 30).notNullable().defaultTo('aktif');
    money(t, 'denda', 0);
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('pembelian', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('tgl', 20).notNullable();
    t.string('supplier_id', 36)
      .references('id')
      .inTable('supplier')
      .onDelete('SET NULL');
    t.string('lokasi_id', 36)
      .references('id')
      .inTable('lokasi')
      .onDelete('SET NULL');
    money(t, 'total', 0);
    t.string('status', 30).notNullable().defaultTo('lunas');
    t.text('catatan');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('pembelian_item', (t) => {
    id(t);
    t.string('pembelian_id', 36)
      .notNullable()
      .references('id')
      .inTable('pembelian')
      .onDelete('CASCADE');
    t.string('barang_id', 36)
      .references('id')
      .inTable('barang')
      .onDelete('SET NULL');
    t.string('nama', 255);
    money(t, 'qty', 1);
    money(t, 'harga_beli', 0);
    money(t, 'subtotal', 0);
  });

  await knex.schema.createTable('jurnal', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('tgl', 20).notNullable();
    t.string('modul', 50);
    t.string('ref', 100);
    t.text('ket');
    t.string('debit', 50);
    t.string('kredit', 50);
    money(t, 'nominal', 0);
    t.string('source_modul', 100).defaultTo('');
    t.string('source_id', 36).defaultTo('');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('approval', (t) => {
    id(t);
    t.string('modul', 50);
    t.string('ref', 100);
    t.string('anggota_id', 36);
    t.string('anggota_nama', 255);
    t.text('deskripsi');
    t.string('tgl', 20);
    t.string('status', 30).notNullable().defaultTo('pending');
    t.string('priority', 30).notNullable().defaultTo('normal');
    t.text('catatan');
    t.string('approver_id', 36);
    t.string('approver_nama', 255);
    t.string('tgl_approval', 20);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('setting', (t) => {
    t.string('key', 100).primary();
    t.text('value');
    t.string('label', 255);
  });

  await knex.schema.createTable('kredit_barang', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('anggota_id', 36)
      .references('id')
      .inTable('anggota')
      .onDelete('SET NULL');
    t.string('jenis', 50).notNullable().defaultTo('motor');
    t.string('nama_barang', 255);
    t.string('toko', 255);
    money(t, 'harga_beli', 0);
    money(t, 'dp', 0);
    money(t, 'pokok', 0);
    money(t, 'bunga_pct', 1.0);
    t.integer('tenor').notNullable().defaultTo(12);
    money(t, 'angsuran', 0);
    money(t, 'sisa_pokok', 0);
    t.integer('cicilan_ke').notNullable().defaultTo(0);
    t.string('status', 30).notNullable().defaultTo('aktif');
    t.string('tgl_mulai', 20);
    t.text('catatan');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('kredit_bayar', (t) => {
    id(t);
    t.string('kredit_id', 36)
      .notNullable()
      .references('id')
      .inTable('kredit_barang')
      .onDelete('CASCADE');
    t.string('tgl', 20).notNullable();
    money(t, 'nominal', 0);
    money(t, 'pokok', 0);
    money(t, 'bunga', 0);
    t.string('metode', 30).notNullable().defaultTo('potong-gaji');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('limit_kredit_toko', (t) => {
    id(t);
    t.string('anggota_id', 36)
      .notNullable()
      .references('id')
      .inTable('anggota')
      .onDelete('CASCADE');
    t.string('bulan', 10).notNullable();
    money(t, 'terpakai', 0);
    t.string('status', 30).notNullable().defaultTo('aktif');
    ts(knex, t, 'created_at');
    t.unique(['anggota_id', 'bulan']);
  });

  await knex.schema.createTable('labor_kontrak', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('tgl', 20).notNullable();
    t.string('klien', 255);
    t.string('pekerjaan', 255);
    t.string('lokasi', 255);
    t.string('tgl_mulai', 20);
    t.string('tgl_selesai', 20);
    money(t, 'nilai_kontrak', 0);
    t.string('status', 30).notNullable().defaultTo('aktif');
    t.text('catatan');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('labor_pekerja', (t) => {
    id(t);
    t.string('kontrak_id', 36)
      .notNullable()
      .references('id')
      .inTable('labor_kontrak')
      .onDelete('CASCADE');
    t.string('nama', 255).notNullable();
    t.string('jabatan', 100);
    t.string('nik', 30);
    t.string('bulan', 10).defaultTo('');
    t.integer('jumlah_orang').notNullable().defaultTo(1);
    money(t, 'biaya', 0);
    money(t, 'biaya_lembur', 0);
    money(t, 'biaya_tambahan', 0);
    money(t, 'total_biaya', 0);
    money(t, 'pph21', 0);
    money(t, 'bpjs_tk', 0);
    money(t, 'bpjs_kes', 0);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('kwitansi', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('tipe', 30).notNullable().defaultTo('kwitansi');
    t.string('tgl', 20).notNullable();
    t.string('penerima', 255);
    t.string('perusahaan', 255);
    t.text('items_json').defaultTo('[]');
    money(t, 'subtotal', 0);
    money(t, 'diskon', 0);
    money(t, 'ppn', 0);
    money(t, 'pph', 0);
    money(t, 'total', 0);
    t.text('terbilang');
    t.string('status', 30).notNullable().defaultTo('belum-lunas');
    t.text('catatan');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('audit_log', (t) => {
    id(t);
    t.string('user_id', 36);
    t.string('user_name', 255);
    t.string('modul', 50);
    t.string('aksi', 50);
    t.string('ref_table', 100);
    t.string('ref_id', 36);
    t.text('old_value');
    t.text('new_value');
    t.text('keterangan');
    t.string('ip_address', 50);
    t.datetime('tgl').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    t.index(['modul', 'tgl'], 'idx_audit_modul');
  });

  await knex.schema.createTable('pos_hold', (t) => {
    id(t);
    t.string('no', 50).unique();
    t.string('user_id', 36);
    t.string('lokasi_id', 36);
    t.string('anggota_id', 36);
    t.text('items_json').defaultTo('[]');
    money(t, 'total', 0);
    t.text('catatan');
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('pos_void', (t) => {
    id(t);
    t.string('penjualan_id', 36);
    t.string('no_penjualan', 50);
    t.text('alasan');
    t.string('user_id', 36);
    t.datetime('tgl').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  });

  await knex.schema.createTable('simpanan_jasa', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('periode', 20);
    t.string('anggota_id', 36);
    money(t, 'saldo_rata', 0);
    money(t, 'rate_pct', 0);
    money(t, 'jasa', 0);
    t.string('tgl', 20);
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('pinjaman_history', (t) => {
    id(t);
    t.string('pinjaman_id', 36);
    t.string('aksi', 50);
    t.string('tgl', 20);
    money(t, 'nominal_lama', 0);
    money(t, 'nominal_baru', 0);
    t.integer('tenor_lama');
    t.integer('tenor_baru');
    money(t, 'angsuran_lama', 0);
    money(t, 'angsuran_baru', 0);
    money(t, 'bunga_lama', 0);
    money(t, 'bunga_baru', 0);
    t.text('keterangan');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('rental_maintenance', (t) => {
    id(t);
    t.string('kendaraan_id', 36);
    t.string('tgl', 20);
    t.string('jenis', 50);
    t.text('deskripsi');
    money(t, 'biaya', 0);
    t.integer('km_saat_ini').notNullable().defaultTo(0);
    t.integer('next_service_km').notNullable().defaultTo(0);
    t.string('next_service_tgl', 20);
    t.string('bengkel', 255);
    t.string('bukti_file', 255);
    t.text('catatan');
    money(t, 'biaya_fuel', 0);
    money(t, 'biaya_tol', 0);
    money(t, 'biaya_konsumsi', 0);
    money(t, 'liter_fuel', 0);
    money(t, 'km_per_liter', 0);
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('rental_dokumen', (t) => {
    id(t);
    t.string('kendaraan_id', 36);
    t.string('rental_id', 36);
    t.string('jenis', 50);
    t.string('no_dokumen', 100);
    t.string('tgl_terbit', 20);
    t.string('tgl_expired', 20);
    t.string('file_path', 255);
    t.text('catatan');
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('rental_biaya_ops', (t) => {
    id(t);
    t.string('rental_id', 36);
    t.string('kendaraan_id', 36);
    t.string('tgl', 20);
    t.string('jenis', 50);
    t.text('deskripsi');
    money(t, 'nominal', 0);
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('labor_timesheet', (t) => {
    id(t);
    t.string('pekerja_id', 36);
    t.string('kontrak_id', 36);
    t.string('tgl', 20);
    t.string('jam_masuk', 10);
    t.string('jam_keluar', 10);
    money(t, 'jam_kerja', 0);
    money(t, 'jam_lembur', 0);
    t.string('status', 30).notNullable().defaultTo('hadir');
    t.text('keterangan');
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('labor_spk', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('kontrak_id', 36);
    t.string('tgl', 20);
    t.text('deskripsi');
    t.string('pic', 255);
    t.text('catatan');
    t.string('status', 30).notNullable().defaultTo('aktif');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('jurnal_reverse', (t) => {
    id(t);
    t.string('jurnal_id', 36);
    t.string('no_reverse', 50);
    t.text('alasan');
    t.string('user_id', 36);
    t.datetime('tgl').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  });

  await knex.schema.createTable('aset_tetap', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('nama', 255);
    t.string('kategori', 50);
    t.string('tgl_perolehan', 20);
    money(t, 'harga_beli', 0);
    t.integer('umur_ekonomis').notNullable().defaultTo(5);
    money(t, 'nilai_residu', 0);
    t.string('metode_susut', 50).notNullable().defaultTo('garis-lurus');
    money(t, 'akumulasi_penyusutan', 0);
    money(t, 'nilai_buku', 0);
    t.string('status', 30).notNullable().defaultTo('aktif');
    t.text('catatan');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('close_period', (t) => {
    id(t);
    t.string('periode', 10).notNullable().unique();
    t.string('tgl_tutup', 20);
    t.string('user_id', 36);
    t.string('user_name', 255);
    t.text('catatan');
    t.string('status', 30).notNullable().defaultTo('closed');
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('konsolidasi_snapshot', (t) => {
    id(t);
    t.string('periode', 10);
    t.string('anggota_id', 36);
    t.text('data_json');
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('barang_satuan', (t) => {
    id(t);
    t.string('barang_id', 36);
    t.string('satuan', 50);
    money(t, 'konversi', 1);
    money(t, 'harga_jual', 0);
    money(t, 'harga_beli', 0);
    t.string('barcode', 50);
    flag(t, 'is_default', 0);
    flag(t, 'aktif', 1);
  });

  await knex.schema.createTable('supplier_kontrak', (t) => {
    id(t);
    t.string('no', 50).notNullable().unique();
    t.string('supplier_id', 36);
    t.string('judul', 255);
    t.string('tgl_mulai', 20);
    t.string('tgl_selesai', 20);
    t.integer('termin').notNullable().defaultTo(30);
    money(t, 'nilai', 0);
    t.string('file_path', 255);
    t.string('status', 30).notNullable().defaultTo('aktif');
    t.text('catatan');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('ref_option', (t) => {
    id(t);
    t.string('group_key', 100).notNullable();
    t.string('value', 100).notNullable();
    t.string('label', 255).notNullable();
    flag(t, 'aktif', 1);
    ts(knex, t, 'created_at');
    t.unique(['group_key', 'value']);
  });

  await knex.schema.createTable('account_mapping', (t) => {
    id(t);
    t.string('modul', 100).notNullable().unique();
    t.string('debit', 50);
    t.string('kredit', 50);
    t.text('ket');
    flag(t, 'aktif', 1);
  });

  await knex.schema.createTable('usaha_lain', (t) => {
    id(t);
    t.string('tgl', 20).notNullable();
    t.string('jenis', 50).notNullable().defaultTo('catering');
    t.string('nama', 255);
    t.string('customer', 255);
    t.text('deskripsi');
    money(t, 'pendapatan', 0);
    money(t, 'biaya', 0);
    money(t, 'laba', 0);
    t.string('status', 30).notNullable().defaultTo('selesai');
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('penjualan_hold', (t) => {
    id(t);
    t.string('no', 50);
    t.string('tgl', 20);
    t.string('lokasi_id', 36);
    t.string('anggota_id', 36);
    t.text('items_json');
    money(t, 'total', 0);
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
  });
};

const TABLES = [
  'penjualan_hold',
  'usaha_lain',
  'account_mapping',
  'ref_option',
  'supplier_kontrak',
  'barang_satuan',
  'konsolidasi_snapshot',
  'close_period',
  'aset_tetap',
  'jurnal_reverse',
  'labor_spk',
  'labor_timesheet',
  'rental_biaya_ops',
  'rental_dokumen',
  'rental_maintenance',
  'pinjaman_history',
  'simpanan_jasa',
  'pos_void',
  'pos_hold',
  'audit_log',
  'kwitansi',
  'labor_pekerja',
  'labor_kontrak',
  'limit_kredit_toko',
  'kredit_bayar',
  'kredit_barang',
  'setting',
  'approval',
  'jurnal',
  'pembelian_item',
  'pembelian',
  'rental',
  'kendaraan',
  'ppob_trx',
  'pinjaman_bayar',
  'pinjaman',
  'simpanan_trx',
  'simpanan',
  'piutang',
  'penjualan_item',
  'penjualan',
  'promo',
  'pos_shift',
  'stok',
  'barang',
  'coa',
  'supplier',
  'anggota',
  'users',
  'lokasi',
];

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES) {
    await knex.schema.dropTableIfExists(table);
  }
  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
};
