const multer = require('multer');
const ExcelJS = require('exceljs');
const { Q, X, upsertSetting } = require('../db');
const { uid, today, jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { getSetting } = require('../utils/settings');
const { sendExport } = require('../utils/export');
const { audit } = require('../utils/audit');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

const NERACA_DEFAULT = {
  kas: 0, bank: 0, piutang_anggota: 0, piutang_pin: 0, piutang_kredit: 0, persediaan: 0,
  total_aset_lancar: 0, aset_tetap: 0, total_aset: 0, simpanan_anggota: 0, hutang_supplier: 0,
  modal_koperasi: 0, shu_tahun: 0, total_pasiva: 0,
};

const LABA_RUGI_DEFAULT = {
  pend_bunga_pin: 0, pend_jasa_adm: 0, pend_toko: 0, hpp_toko: 0, laba_toko: 0, pend_ppob: 0,
  pend_rental: 0, pend_labor: 0, biaya_labor: 0, laba_labor: 0, pend_kwitansi: 0, pend_lain: 0,
  total_pendapatan: 0, beban_gaji: 0, beban_ops: 0, beban_lain: 0, total_beban: 0, shu_bruto: 0,
};

const SHU_KEYS = [
  ['cadangan', 'Dana Cadangan', 'shu_cadangan_pct', 8],
  ['simpanan_anggota', 'Dana Simpanan Anggota', 'shu_simpanan_anggota_pct', 25],
  ['bunga_pinjaman', 'Dana Kontribusi Bunga Pinjaman', 'shu_bunga_pinjaman_pct', 20],
  ['konsumsi', 'Dana Kontribusi Konsumsi', 'shu_konsumsi_pct', 15],
  ['parcel', 'Dana Parcel', 'shu_parcel_pct', 15],
  ['pengurus', 'Dana Pengurus', 'shu_pengurus_pct', 12],
  ['kesejahteraan', 'Dana Kesejahteraan', 'shu_kesejahteraan_pct', 1],
  ['pendidikan', 'Dana Pendidikan', 'shu_pendidikan_pct', 1],
  ['pembangunan', 'Dana Pembangunan Daerah Kerja', 'shu_pembangunan_pct', 1],
  ['sosial', 'Dana Sosial', 'shu_sosial_pct', 2],
];

async function spc(key, defaultVal) {
  return Number(await getSetting(key, String(defaultVal))) || defaultVal;
}

async function buildFinancials(tahun) {
  const tgl_akhir = `${tahun}-12-31`;

  const pend_bunga_pin = (await Q(
    "SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE kredit='Pendapatan Bunga Pinjaman' AND tgl<=?",
    [tgl_akhir], true,
  ))?.t ?? 0;
  const pend_jasa_adm = (await Q(
    "SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE kredit='Pendapatan Jasa Administrasi' AND tgl<=?",
    [tgl_akhir], true,
  ))?.t ?? 0;
  const pend_toko = (await Q(
    "SELECT COALESCE(SUM(total),0) as t FROM penjualan WHERE status='lunas' AND substr(tgl,1,4)=?",
    [tahun], true,
  ))?.t ?? 0;
  const hpp_toko = (await Q(
    'SELECT COALESCE(SUM(total),0) as t FROM pembelian WHERE substr(tgl,1,4)=?',
    [tahun], true,
  ))?.t ?? 0;
  const laba_toko = pend_toko - hpp_toko;
  const pend_ppob = (await Q(
    'SELECT COALESCE(SUM(fee),0) as t FROM ppob_trx WHERE substr(tgl,1,4)=?',
    [tahun], true,
  ))?.t ?? 0;
  const pend_rental = (await Q(
    "SELECT COALESCE(SUM(total),0) as t FROM rental WHERE status='selesai' AND substr(tgl_mulai,1,4)=?",
    [tahun], true,
  ))?.t ?? 0;
  const pend_labor = (await Q(
    "SELECT COALESCE(SUM(nilai_kontrak),0) as t FROM labor_kontrak WHERE status='selesai' AND substr(tgl,1,4)=?",
    [tahun], true,
  ))?.t ?? 0;
  const biaya_labor = (await Q(
    `SELECT COALESCE(SUM(lp.biaya),0) as t FROM labor_pekerja lp
     JOIN labor_kontrak lk ON lp.kontrak_id=lk.id WHERE lk.status='selesai' AND substr(lk.tgl,1,4)=?`,
    [tahun], true,
  ))?.t ?? 0;
  const laba_labor = pend_labor - biaya_labor;
  const pend_lain = (await Q(
    "SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE kredit='Pendapatan Lain-lain' AND tgl<=?",
    [tgl_akhir], true,
  ))?.t ?? 0;
  const total_pendapatan = pend_bunga_pin + pend_jasa_adm + laba_toko + pend_ppob + pend_rental + laba_labor + pend_lain;

  const beban_gaji = (await Q(
    "SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE debit='Beban Gaji' AND tgl<=?",
    [tgl_akhir], true,
  ))?.t ?? 0;
  const beban_ops = (await Q(
    "SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE debit='Beban Operasional' AND tgl<=?",
    [tgl_akhir], true,
  ))?.t ?? 0;
  const beban_lain = (await Q(
    "SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE debit LIKE 'Beban%' AND debit NOT IN ('Beban Gaji','Beban Operasional') AND tgl<=?",
    [tgl_akhir], true,
  ))?.t ?? 0;
  const total_beban = beban_gaji + beban_ops + beban_lain;
  const shu_bruto = total_pendapatan - total_beban;

  const kas = (await Q(
    "SELECT COALESCE(SUM(CASE WHEN debit='Kas' THEN nominal ELSE 0 END)-SUM(CASE WHEN kredit='Kas' THEN nominal ELSE 0 END),0) as t FROM jurnal WHERE tgl<=?",
    [tgl_akhir], true,
  ))?.t ?? 0;
  const bank = (await Q(
    "SELECT COALESCE(SUM(CASE WHEN debit IN ('Bank BRI','Bank BNI','Bank') THEN nominal ELSE 0 END)-SUM(CASE WHEN kredit IN ('Bank BRI','Bank BNI','Bank') THEN nominal ELSE 0 END),0) as t FROM jurnal WHERE tgl<=?",
    [tgl_akhir], true,
  ))?.t ?? 0;
  const piutang_anggota = (await Q('SELECT COALESCE(SUM(saldo),0) as t FROM piutang', [], true))?.t ?? 0;
  const piutang_pin = (await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t FROM pinjaman WHERE status='aktif'", [], true))?.t ?? 0;
  const piutang_kredit = (await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t FROM kredit_barang WHERE status='aktif'", [], true))?.t ?? 0;
  const persediaan = (await Q(
    'SELECT COALESCE(SUM(s.jumlah*b.harga_beli),0) as t FROM stok s JOIN barang b ON s.barang_id=b.id',
    [], true,
  ))?.t ?? 0;
  const total_aset_lancar = kas + bank + piutang_anggota + piutang_pin + piutang_kredit + persediaan;
  const aset_tetap = (await Q('SELECT COALESCE(SUM(tarif_bulanan*12),0) as t FROM kendaraan', [], true))?.t ?? 0;
  const total_aset = total_aset_lancar + aset_tetap;
  const simpanan_anggota = (await Q('SELECT COALESCE(SUM(saldo),0) as t FROM simpanan', [], true))?.t ?? 0;
  const hutang_supplier = (await Q("SELECT COALESCE(SUM(total),0) as t FROM pembelian WHERE status='hutang'", [], true))?.t ?? 0;
  const modal_koperasi = Math.max(0, total_aset - simpanan_anggota - hutang_supplier - shu_bruto);

  const neraca = {
    kas, bank, piutang_anggota, piutang_pin, piutang_kredit, persediaan, total_aset_lancar, aset_tetap, total_aset,
    simpanan_anggota, hutang_supplier, modal_koperasi, shu_tahun: shu_bruto,
    total_pasiva: simpanan_anggota + hutang_supplier + shu_bruto + modal_koperasi,
  };

  const laba_rugi = {
    pend_bunga_pin, pend_jasa_adm, pend_toko, hpp_toko, laba_toko, pend_ppob, pend_rental, pend_labor,
    biaya_labor, laba_labor, pend_kwitansi: 0, pend_lain, total_pendapatan, beban_gaji, beban_ops, beban_lain,
    total_beban, shu_bruto,
  };

  const shu = { bruto: shu_bruto, alokasi: [] };
  let total_pct = 0;
  let check = 0;
  for (const [code, label, key, defaultPct] of SHU_KEYS) {
    const pct = await spc(key, defaultPct);
    const jml = Math.round(shu_bruto * pct / 100);
    total_pct += pct;
    check += jml;
    shu[code] = jml;
    shu[`${code}_pct`] = pct;
    shu.alokasi.push({ code, label, key, pct, jumlah: jml });
  }
  shu.check = check;
  shu.total_pct = total_pct;

  const total_modal = (await Q('SELECT COALESCE(SUM(saldo),0) as t FROM simpanan', [], true))?.t ?? 0;
  const total_pin = (await Q(
    "SELECT COALESCE(SUM(COALESCE(disetujui,nominal)),0) as t FROM pinjaman WHERE substr(COALESCE(tgl_cair,tgl_pengajuan,''),1,4)=?",
    [tahun], true,
  ))?.t ?? 0;
  const total_konsumsi = (await Q(
    "SELECT COALESCE(SUM(total),0) as t FROM penjualan WHERE substr(tgl,1,4)=? AND (jenis IN ('kredit','potong_gaji') OR payment_channel IN ('kredit','potong_gaji'))",
    [tahun], true,
  ))?.t ?? 0;
  shu.kontribusi_total = { modal: total_modal, pinjaman: total_pin, konsumsi: total_konsumsi };
  shu.kontribusi = await Q(
    `SELECT a.no,a.nama,
      COALESCE((SELECT SUM(saldo) FROM simpanan s WHERE s.anggota_id=a.id),0) as modal,
      COALESCE((SELECT SUM(COALESCE(disetujui,nominal)) FROM pinjaman p WHERE p.anggota_id=a.id AND substr(COALESCE(p.tgl_cair,p.tgl_pengajuan,''),1,4)=?),0) as pinjaman,
      COALESCE((SELECT SUM(total) FROM penjualan pj WHERE pj.anggota_id=a.id AND substr(pj.tgl,1,4)=? AND (pj.jenis IN ('kredit','potong_gaji') OR pj.payment_channel IN ('kredit','potong_gaji'))),0) as konsumsi
      FROM anggota a WHERE a.status='aktif' ORDER BY a.nama`,
    [tahun, tahun],
  );
  for (const r of shu.kontribusi) {
    r.shu_modal = total_modal ? Math.round((r.modal / total_modal) * (shu.simpanan_anggota || 0)) : 0;
    r.shu_pinjaman = total_pin ? Math.round((r.pinjaman / total_pin) * (shu.bunga_pinjaman || 0)) : 0;
    r.shu_konsumsi = total_konsumsi ? Math.round((r.konsumsi / total_konsumsi) * (shu.konsumsi || 0)) : 0;
    r.shu_total = r.shu_modal + r.shu_pinjaman + r.shu_konsumsi;
  }

  return { neraca, laba_rugi, shu };
}

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const tab = req.query.tab || 'jurnal';
    const tgl_from = req.query.tgl_from || '';
    const tgl_to = req.query.tgl_to || '';
    const q = req.query.q || '';
    const tahun = req.query.tahun || today().slice(0, 4);

    let jurnal_rows = [];
    let neraca = { ...NERACA_DEFAULT };
    let laba_rugi = { ...LABA_RUGI_DEFAULT };
    let shu = { bruto: 0, alokasi: [], check: 0, total_pct: 0 };

    if (tab === 'jurnal') {
      let sql = 'SELECT * FROM jurnal WHERE 1=1';
      const params = [];
      if (tgl_from) { sql += ' AND tgl>=?'; params.push(tgl_from); }
      if (tgl_to) { sql += ' AND tgl<=?'; params.push(tgl_to); }
      if (q) {
        sql += ' AND (ket LIKE ? OR no LIKE ? OR modul LIKE ?)';
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      jurnal_rows = await Q(sql + ' ORDER BY tgl DESC,created_at DESC LIMIT 500', params);
    } else if (['neraca', 'laba_rugi', 'shu'].includes(tab)) {
      const fin = await buildFinancials(tahun);
      neraca = fin.neraca;
      laba_rugi = fin.laba_rugi;
      shu = fin.shu;
    }

    const total_kas = (await Q(
      "SELECT COALESCE(SUM(CASE WHEN debit='Kas' THEN nominal ELSE 0 END)-SUM(CASE WHEN kredit='Kas' THEN nominal ELSE 0 END),0) as t FROM jurnal",
      [], true,
    ))?.t ?? 0;
    const total_piutang = (await Q('SELECT COALESCE(SUM(saldo),0) as t FROM piutang', [], true))?.t ?? 0;
    const coa_list = await Q("SELECT * FROM coa WHERE status='aktif' ORDER BY kode");

    return jsonOk(res, {
      tab, jurnal_rows, tgl_from, tgl_to, q, tahun, total_kas, total_piutang, coa_list, neraca, laba_rugi, shu,
    });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/jurnal/save', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const jid = String(f.id || '').trim();
    const nominal = Number(f.nominal) || 0;
    if (jid) {
      await X(
        'UPDATE jurnal SET tgl=?,modul=?,ket=?,debit=?,kredit=?,nominal=? WHERE id=?',
        [f.tgl, f.modul, f.ket, f.debit, f.kredit, nominal, jid],
      );
      return jsonOk(res, {}, 'Jurnal diperbarui');
    }
    const no = `JRN-${today().replace(/-/g, '')}-${uid().slice(0, 4)}`;
    await X(
      'INSERT INTO jurnal (id,no,tgl,modul,ref,ket,debit,kredit,nominal,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uid(), no, f.tgl || today(), f.modul || 'Manual', no, f.ket, f.debit, f.kredit, nominal, req.session.user.id],
    );
    return jsonOk(res, { no }, 'Jurnal ditambahkan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/jurnal/delete/:jid', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    await X('DELETE FROM jurnal WHERE id=?', [req.params.jid]);
    return jsonOk(res, {}, 'Jurnal dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'csv';
    const rows = await Q('SELECT no,tgl,modul,ref,ket,debit,kredit,nominal FROM jurnal ORDER BY tgl DESC');
    const cols = ['no', 'tgl', 'modul', 'ref', 'ket', 'debit', 'kredit', 'nominal'];
    return sendExport(fmt, rows, cols, 'Jurnal Umum', 'jurnal.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export/jurnal', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'xlsx';
    const { tgl_from = '', tgl_to = '' } = req.query;
    let sql = 'SELECT no,tgl,modul,ref,ket,debit,kredit,nominal FROM jurnal WHERE 1=1';
    const params = [];
    if (tgl_from) { sql += ' AND tgl>=?'; params.push(tgl_from); }
    if (tgl_to) { sql += ' AND tgl<=?'; params.push(tgl_to); }
    const rows = await Q(sql + ' ORDER BY tgl,created_at', params);
    const cols = ['no', 'tgl', 'modul', 'ref', 'ket', 'debit', 'kredit', 'nominal'];
    return sendExport(fmt, rows, cols, 'Jurnal Umum', 'jurnal.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export/neraca', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const tahun = req.query.tahun || today().slice(0, 4);
    const tgl_akhir = `${tahun}-12-31`;
    const rows = [
      { pos: 'ASET LANCAR', akun: 'Kas', jumlah: (await Q("SELECT COALESCE(SUM(CASE WHEN debit='Kas' THEN nominal ELSE 0 END)-SUM(CASE WHEN kredit='Kas' THEN nominal ELSE 0 END),0) as t FROM jurnal WHERE tgl<=?", [tgl_akhir], true))?.t ?? 0 },
      { pos: 'ASET LANCAR', akun: 'Bank', jumlah: (await Q("SELECT COALESCE(SUM(CASE WHEN debit IN ('Bank BRI','Bank BNI','Bank') THEN nominal ELSE 0 END)-SUM(CASE WHEN kredit IN ('Bank BRI','Bank BNI','Bank') THEN nominal ELSE 0 END),0) as t FROM jurnal WHERE tgl<=?", [tgl_akhir], true))?.t ?? 0 },
      { pos: 'ASET LANCAR', akun: 'Piutang Toko Anggota', jumlah: (await Q('SELECT COALESCE(SUM(saldo),0) as t FROM piutang', [], true))?.t ?? 0 },
      { pos: 'ASET LANCAR', akun: 'Piutang Pinjaman', jumlah: (await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t FROM pinjaman WHERE status='aktif'", [], true))?.t ?? 0 },
      { pos: 'ASET LANCAR', akun: 'Persediaan', jumlah: (await Q('SELECT COALESCE(SUM(s.jumlah*b.harga_beli),0) as t FROM stok s JOIN barang b ON s.barang_id=b.id', [], true))?.t ?? 0 },
      { pos: 'KEWAJIBAN', akun: 'Simpanan Anggota', jumlah: (await Q('SELECT COALESCE(SUM(saldo),0) as t FROM simpanan', [], true))?.t ?? 0 },
      { pos: 'KEWAJIBAN', akun: 'Hutang Supplier', jumlah: (await Q("SELECT COALESCE(SUM(total),0) as t FROM pembelian WHERE status='hutang'", [], true))?.t ?? 0 },
    ];
    return sendExport('xlsx', rows, ['pos', 'akun', 'jumlah'], `Neraca ${tahun}`, `neraca_${tahun}.xlsx`, res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export/laba_rugi', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const tahun = req.query.tahun || today().slice(0, 4);
    const pend_toko = (await Q("SELECT COALESCE(SUM(total),0) as t FROM penjualan WHERE status='lunas' AND substr(tgl,1,4)=?", [tahun], true))?.t ?? 0;
    const hpp = (await Q('SELECT COALESCE(SUM(total),0) as t FROM pembelian WHERE substr(tgl,1,4)=?', [tahun], true))?.t ?? 0;
    const pend_bunga = (await Q("SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE kredit='Pendapatan Bunga Pinjaman' AND substr(tgl,1,4)=?", [tahun], true))?.t ?? 0;
    const pend_ppob = (await Q('SELECT COALESCE(SUM(fee),0) as t FROM ppob_trx WHERE substr(tgl,1,4)=?', [tahun], true))?.t ?? 0;
    const pend_rental = (await Q("SELECT COALESCE(SUM(total),0) as t FROM rental WHERE status='selesai' AND substr(tgl_mulai,1,4)=?", [tahun], true))?.t ?? 0;
    const pend_labor = (await Q("SELECT COALESCE(SUM(nilai_kontrak),0) as t FROM labor_kontrak WHERE status='selesai' AND substr(tgl,1,4)=?", [tahun], true))?.t ?? 0;
    const biaya_labor = (await Q(
      `SELECT COALESCE(SUM(lp.biaya+lp.biaya_lembur+lp.biaya_tambahan),0) as t FROM labor_pekerja lp
       JOIN labor_kontrak lk ON lp.kontrak_id=lk.id WHERE lk.status='selesai' AND substr(lk.tgl,1,4)=?`,
      [tahun], true,
    ))?.t ?? 0;
    const beban_gaji = (await Q("SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE debit='Beban Gaji' AND substr(tgl,1,4)=?", [tahun], true))?.t ?? 0;
    const beban_ops = (await Q("SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE debit='Beban Operasional' AND substr(tgl,1,4)=?", [tahun], true))?.t ?? 0;
    const rows = [
      { kategori: 'PENDAPATAN', uraian: 'Penjualan Toko', jumlah: pend_toko },
      { kategori: 'PENDAPATAN', uraian: 'HPP Toko', jumlah: -hpp },
      { kategori: 'PENDAPATAN', uraian: 'Laba Toko', jumlah: pend_toko - hpp },
      { kategori: 'PENDAPATAN', uraian: 'Bunga Pinjaman', jumlah: pend_bunga },
      { kategori: 'PENDAPATAN', uraian: 'Fee PPOB', jumlah: pend_ppob },
      { kategori: 'PENDAPATAN', uraian: 'Pendapatan Rental', jumlah: pend_rental },
      { kategori: 'PENDAPATAN', uraian: 'Labor Supply', jumlah: pend_labor - biaya_labor },
      { kategori: 'BEBAN', uraian: 'Beban Gaji', jumlah: beban_gaji },
      { kategori: 'BEBAN', uraian: 'Beban Operasional', jumlah: beban_ops },
      {
        kategori: 'SHU', uraian: 'Sisa Hasil Usaha',
        jumlah: pend_toko - hpp + pend_bunga + pend_ppob + pend_rental + (pend_labor - biaya_labor) - beban_gaji - beban_ops,
      },
    ];
    return sendExport('xlsx', rows, ['kategori', 'uraian', 'jumlah'], `Laba Rugi ${tahun}`, `laba_rugi_${tahun}.xlsx`, res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export/shu', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const tahun = req.query.tahun || today().slice(0, 4);
    const pend_toko = (await Q("SELECT COALESCE(SUM(total),0) as t FROM penjualan WHERE status='lunas' AND substr(tgl,1,4)=?", [tahun], true))?.t ?? 0;
    const hpp = (await Q('SELECT COALESCE(SUM(total),0) as t FROM pembelian WHERE substr(tgl,1,4)=?', [tahun], true))?.t ?? 0;
    const pend_lain = (await Q("SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE kredit LIKE 'Pendapatan%' AND substr(tgl,1,4)=?", [tahun], true))?.t ?? 0;
    const beban = (await Q("SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE debit LIKE 'Beban%' AND substr(tgl,1,4)=?", [tahun], true))?.t ?? 0;
    const bruto = pend_toko - hpp + pend_lain - beban;
    const rows = [];
    for (const [, label, key, defaultPct] of SHU_KEYS) {
      const pct = await spc(key, defaultPct);
      rows.push({ pos: label, pct, jumlah: Math.round(bruto * pct / 100) });
    }
    return sendExport('xlsx', rows, ['pos', 'pct', 'jumlah'], `SHU ${tahun}`, `shu_${tahun}.xlsx`, res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/import/jurnal', accessRequired('pembukuan'), upload.single('file'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) return jsonErr(res, 'Pilih file Excel');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];
    let imported = 0;
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const no = String(row.getCell(1).value || '');
      const tgl = String(row.getCell(2).value || '').slice(0, 10);
      const modul = String(row.getCell(3).value || '');
      const ref = String(row.getCell(4).value || '');
      const ket = String(row.getCell(5).value || '');
      const debit = String(row.getCell(6).value || '');
      const kredit = String(row.getCell(7).value || '');
      const nominal = Number(row.getCell(8).value) || 0;
      if (!tgl || !nominal) continue;
      const existing = await Q('SELECT id FROM jurnal WHERE no=?', [no], true);
      if (existing) continue;
      await X(
        'INSERT INTO jurnal (id,no,tgl,modul,ref,ket,debit,kredit,nominal,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [uid(), no || `JRN-IMP-${uid().slice(0, 6)}`, tgl, modul || 'Import', ref, ket, debit, kredit, nominal, req.session.user.id],
      );
      imported++;
    }
    return jsonOk(res, { count: imported }, `${imported} jurnal berhasil diimport`);
  } catch (e) {
    return jsonErr(res, `Error import: ${e.message}`, 500);
  }
}));

router.post('/shu/save', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const keys = SHU_KEYS.map(([, , k]) => k);
    let total = 0;
    for (const k of keys) {
      total += Number(req.body[k]) || 0;
    }
    if (Math.abs(total - 100) > 0.01) {
      return jsonErr(res, `Total persentase harus 100% (sekarang ${total.toFixed(1)}%)`);
    }
    for (const k of keys) {
      await upsertSetting(k, String(req.body[k] ?? '0'));
    }
    return jsonOk(res, {}, 'Pengaturan pembagian SHU disimpan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/ledger', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const akun = req.query.akun || '';
    const tgl_from = req.query.tgl_from || `${today().slice(0, 4)}-01-01`;
    const tgl_to = req.query.tgl_to || today();
    let rows = [];
    let saldo = 0;
    if (akun) {
      rows = await Q(
        `SELECT no,tgl,modul,ref,ket,
          CASE WHEN debit=? THEN nominal ELSE 0 END as debit_amt,
          CASE WHEN kredit=? THEN nominal ELSE 0 END as kredit_amt
          FROM jurnal WHERE (debit=? OR kredit=?) AND tgl>=? AND tgl<=?
          ORDER BY tgl, created_at`,
        [akun, akun, akun, akun, tgl_from, tgl_to],
      );
      for (const r of rows) {
        saldo += Number(r.debit_amt || 0) - Number(r.kredit_amt || 0);
        r.saldo = saldo;
      }
    }
    const akun_list = await Q(
      "SELECT DISTINCT debit as akun FROM jurnal WHERE debit!='' UNION SELECT DISTINCT kredit FROM jurnal WHERE kredit!='' ORDER BY akun",
    );
    const total_debit = rows.reduce((s, r) => s + Number(r.debit_amt || 0), 0);
    const total_kredit = rows.reduce((s, r) => s + Number(r.kredit_amt || 0), 0);
    return jsonOk(res, { rows, akun, akun_list, tgl_from, tgl_to, total_debit, total_kredit, saldo });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/trial_balance', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const tgl_to = req.query.tgl_to || today();
    const debits = Object.fromEntries(
      (await Q("SELECT debit as akun, SUM(nominal) as total FROM jurnal WHERE debit!='' AND tgl<=? GROUP BY debit", [tgl_to]))
        .map((r) => [r.akun, Number(r.total || 0)]),
    );
    const kredits = Object.fromEntries(
      (await Q("SELECT kredit as akun, SUM(nominal) as total FROM jurnal WHERE kredit!='' AND tgl<=? GROUP BY kredit", [tgl_to]))
        .map((r) => [r.akun, Number(r.total || 0)]),
    );
    const all_akun = [...new Set([...Object.keys(debits), ...Object.keys(kredits)])].sort();
    const rows = all_akun.map((akun) => {
      const d = debits[akun] || 0;
      const k = kredits[akun] || 0;
      const saldo = d - k;
      return { akun, debit: d, kredit: k, saldo, saldo_debit: Math.max(0, saldo), saldo_kredit: Math.max(0, -saldo) };
    });
    const total_d = rows.reduce((s, r) => s + r.saldo_debit, 0);
    const total_k = rows.reduce((s, r) => s + r.saldo_kredit, 0);
    return jsonOk(res, { rows, tgl_to, total_d, total_k });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/arus_kas', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const tahun = req.query.tahun || today().slice(0, 4);
    const tgl_from = `${tahun}-01-01`;
    const tgl_to = `${tahun}-12-31`;
    const op_in = await Q(
      `SELECT
        COALESCE(SUM(CASE WHEN debit='Kas' AND modul='Toko' THEN nominal ELSE 0 END),0) as toko,
        COALESCE(SUM(CASE WHEN debit='Kas' AND modul='Simpan Pinjam' AND ket LIKE '%angsuran%' THEN nominal ELSE 0 END),0) as cicilan,
        COALESCE(SUM(CASE WHEN debit='Kas' AND modul='Simpan Pinjam' AND ket LIKE '%setor%' THEN nominal ELSE 0 END),0) as simpanan,
        COALESCE(SUM(CASE WHEN debit='Kas' AND modul='PPOB' THEN nominal ELSE 0 END),0) as ppob,
        COALESCE(SUM(CASE WHEN debit='Kas' AND modul='Rental' THEN nominal ELSE 0 END),0) as rental,
        COALESCE(SUM(CASE WHEN debit='Kas' AND modul='Labor' THEN nominal ELSE 0 END),0) as labor
        FROM jurnal WHERE tgl>=? AND tgl<=?`,
      [tgl_from, tgl_to], true,
    );
    const op_out = await Q(
      `SELECT
        COALESCE(SUM(CASE WHEN kredit='Kas' AND modul='Toko' THEN nominal ELSE 0 END),0) as pembelian,
        COALESCE(SUM(CASE WHEN kredit='Kas' AND modul='Simpan Pinjam' AND ket LIKE '%cair%' THEN nominal ELSE 0 END),0) as pinjaman,
        COALESCE(SUM(CASE WHEN kredit='Kas' AND debit='Beban Gaji' THEN nominal ELSE 0 END),0) as gaji,
        COALESCE(SUM(CASE WHEN kredit='Kas' AND debit='Beban Operasional' THEN nominal ELSE 0 END),0) as ops,
        COALESCE(SUM(CASE WHEN kredit='Kas' AND debit LIKE 'Beban%' AND debit NOT IN ('Beban Gaji','Beban Operasional') THEN nominal ELSE 0 END),0) as lain
        FROM jurnal WHERE tgl>=? AND tgl<=?`,
      [tgl_from, tgl_to], true,
    );
    const saldo_awal = (await Q(
      "SELECT COALESCE(SUM(CASE WHEN debit='Kas' THEN nominal ELSE 0 END)-SUM(CASE WHEN kredit='Kas' THEN nominal ELSE 0 END),0) as t FROM jurnal WHERE tgl<?",
      [tgl_from], true,
    ))?.t ?? 0;
    const total_in = Object.values(op_in).reduce((s, v) => s + Number(v || 0), 0);
    const total_out = Object.values(op_out).reduce((s, v) => s + Number(v || 0), 0);
    const net = total_in - total_out;
    const saldo_akhir = saldo_awal + net;
    return jsonOk(res, { tahun, op_in, op_out, saldo_awal, total_in, total_out, net, saldo_akhir });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/calk', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const tahun = req.query.tahun || today().slice(0, 4);
    const info = {
      nama_koperasi: await getSetting('nama_kop', 'Koperasi KOKARSI'),
      alamat: await getSetting('alamat', ''),
      tahun,
      jml_anggota_aktif: (await Q("SELECT COUNT(*) as c FROM anggota WHERE status='aktif'", [], true))?.c ?? 0,
      jml_anggota_keluar: (await Q("SELECT COUNT(*) as c FROM anggota WHERE status_detail IN ('keluar','pensiun','meninggal')", [], true))?.c ?? 0,
      total_simpanan: (await Q('SELECT COALESCE(SUM(saldo),0) as t FROM simpanan', [], true))?.t ?? 0,
      total_pinjaman_aktif: (await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t FROM pinjaman WHERE status='aktif'", [], true))?.t ?? 0,
      persentase_shu: {
        cadangan: await getSetting('shu_cadangan_pct', '8'),
        simpanan_anggota: await getSetting('shu_simpanan_anggota_pct', '25'),
        bunga_pinjaman: await getSetting('shu_bunga_pinjaman_pct', '20'),
        konsumsi: await getSetting('shu_konsumsi_pct', '15'),
        parcel: await getSetting('shu_parcel_pct', '15'),
        pengurus: await getSetting('shu_pengurus_pct', '12'),
        kesejahteraan: await getSetting('shu_kesejahteraan_pct', '1'),
        pendidikan: await getSetting('shu_pendidikan_pct', '1'),
        pembangunan: await getSetting('shu_pembangunan_pct', '1'),
        sosial: await getSetting('shu_sosial_pct', '2'),
      },
      bunga_pinjaman_regular: await getSetting('bunga_regular', '1.5'),
      bunga_pinjaman_darurat: await getSetting('bunga_darurat', '1'),
      bunga_jasa_simpanan: await getSetting('bunga_jasa_simpanan_pct', '3'),
    };
    return jsonOk(res, { info });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/jurnal/reverse/:jid', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const jid = req.params.jid;
    const j = await Q('SELECT * FROM jurnal WHERE id=?', [jid], true);
    if (!j) return jsonErr(res, 'Jurnal tidak ditemukan', 404);
    const periode = j.tgl.slice(0, 7);
    const closed = await Q('SELECT id FROM close_period WHERE periode=?', [periode], true);
    if (closed) return jsonErr(res, `Periode ${periode} sudah ditutup — tidak bisa reverse`);
    const alasan = req.body.alasan || '';
    const no_rev = `REV-${j.no}-${uid().slice(0, 4)}`;
    await X(
      'INSERT INTO jurnal (id,no,tgl,modul,ref,ket,debit,kredit,nominal,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uid(), no_rev, today(), j.modul, j.ref, `REVERSE: ${j.ket} — ${alasan}`, j.kredit, j.debit, j.nominal, req.session.user.id],
    );
    await X('INSERT INTO jurnal_reverse (id,jurnal_id,no_reverse,alasan,user_id) VALUES (?,?,?,?,?)', [uid(), jid, no_rev, alasan, req.session.user.id]);
    await audit('pembukuan', 'reverse', 'jurnal', jid, j, null, `Reverse: ${alasan}`);
    return jsonOk(res, { no_reverse: no_rev }, `Jurnal di-reverse: ${no_rev}`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/close_period', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const rows = await Q('SELECT * FROM close_period ORDER BY periode DESC');
    return jsonOk(res, { rows });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/close_period', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const periode = req.body.periode || today().slice(0, 7);
    const existing = await Q('SELECT id FROM close_period WHERE periode=?', [periode], true);
    if (existing) return jsonErr(res, `Periode ${periode} sudah tertutup sebelumnya`, 400);
    await X(
      'INSERT INTO close_period (id,periode,tgl_tutup,user_id,user_name,catatan) VALUES (?,?,?,?,?,?)',
      [uid(), periode, today(), req.session.user.id, req.session.user.name || '-', req.body.catatan || ''],
    );
    await audit('pembukuan', 'close_period', 'close_period', periode, null, { periode }, `Tutup buku ${periode}`);
    return jsonOk(res, {}, `Periode ${periode} berhasil ditutup`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
