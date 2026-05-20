const { Q, X } = require('../db');
const { uid, today, jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { getPrintHeader } = require('../utils/settings');
const { sendExport } = require('../utils/export');

async function buildKonsolidasi(tgl_from, tgl_to) {
  const anggota_rows = await Q("SELECT * FROM anggota WHERE status='aktif' ORDER BY no");
  const result = [];
  for (const a of anggota_rows) {
    const sm = await Q('SELECT COALESCE(SUM(saldo),0) as t FROM simpanan WHERE anggota_id=?', [a.id], true);
    const sm_p = await Q("SELECT COALESCE(saldo,0) as t FROM simpanan WHERE anggota_id=? AND jenis='pokok'", [a.id], true);
    const sm_w = await Q("SELECT COALESCE(saldo,0) as t FROM simpanan WHERE anggota_id=? AND jenis='wajib'", [a.id], true);
    const sm_s = await Q("SELECT COALESCE(saldo,0) as t FROM simpanan WHERE anggota_id=? AND jenis='sukarela'", [a.id], true);
    const pin = await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t,COALESCE(SUM(angsuran),0) as ang FROM pinjaman WHERE anggota_id=? AND status='aktif'", [a.id], true);
    let sql_bel = "SELECT COALESCE(SUM(total),0) as t FROM penjualan WHERE anggota_id=? AND jenis='kredit'";
    const p_bel = [a.id];
    if (tgl_from) { sql_bel += ' AND tgl>=?'; p_bel.push(tgl_from); }
    if (tgl_to) { sql_bel += ' AND tgl<=?'; p_bel.push(tgl_to); }
    const bel = await Q(sql_bel, p_bel, true);
    const piu = await Q('SELECT COALESCE(saldo,0) as t FROM piutang WHERE anggota_id=?', [a.id], true);
    const tung = await Q("SELECT COUNT(*) as c FROM pinjaman WHERE anggota_id=? AND status='aktif' AND sisa_pokok>0", [a.id], true);
    const kr_m = await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t,COALESCE(SUM(angsuran),0) as ang FROM kredit_barang WHERE anggota_id=? AND jenis='motor' AND status='aktif'", [a.id], true);
    const kr_e = await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t,COALESCE(SUM(angsuran),0) as ang FROM kredit_barang WHERE anggota_id=? AND jenis='elektronik' AND status='aktif'", [a.id], true);
    result.push({
      no: a.no, nip: a.nip, nama: a.nama, dept: a.dept,
      sm_pokok: sm_p?.t ?? 0, sm_wajib: sm_w?.t ?? 0, sm_sukarela: sm_s?.t ?? 0,
      total_simpanan: sm?.t ?? 0, pinjaman_aktif: pin?.t ?? 0, angsuran_bln: pin?.ang ?? 0,
      belanja_kredit: bel?.t ?? 0, piutang: piu?.t ?? 0, tunggakan: tung?.c ?? 0,
      kredit_motor: kr_m?.t ?? 0, angs_motor: kr_m?.ang ?? 0, kredit_elek: kr_e?.t ?? 0, angs_elek: kr_e?.ang ?? 0,
    });
  }
  const keys = ['sm_pokok', 'sm_wajib', 'sm_sukarela', 'total_simpanan', 'pinjaman_aktif', 'angsuran_bln', 'belanja_kredit', 'piutang', 'tunggakan', 'kredit_motor', 'angs_motor', 'kredit_elek', 'angs_elek'];
  const grand = Object.fromEntries(keys.map((k) => [k, result.reduce((s, r) => s + Number(r[k] || 0), 0)]));
  return { result, grand };
}

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('laporan'), asyncHandler(async (req, res) => {
  try {
    const tgl_from = req.query.tgl_from || '';
    const tgl_to = req.query.tgl_to || '';
    const { result, grand } = await buildKonsolidasi(tgl_from, tgl_to);
    const hdr = await getPrintHeader();
    return jsonOk(res, { rows: result, grand, tgl_from, tgl_to, hdr });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('laporan'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'xlsx';
    const tgl_from = req.query.tgl_from || '';
    const tgl_to = req.query.tgl_to || '';
    const { result } = await buildKonsolidasi(tgl_from, tgl_to);
    const cols = [
      'no', 'nip', 'nama', 'dept', 'sm_pokok', 'sm_wajib', 'sm_sukarela', 'total_simpanan',
      'pinjaman_aktif', 'angsuran_bln', 'kredit_motor', 'angs_motor', 'kredit_elek', 'angs_elek',
      'belanja_kredit', 'piutang', 'tunggakan',
    ];
    return sendExport(fmt, result, cols, 'Laporan Konsolidasi', 'konsolidasi.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/snapshot', accessRequired('laporan'), asyncHandler(async (req, res) => {
  try {
    const periode = req.body.periode || today().slice(0, 7);
    const anggota = await Q("SELECT * FROM anggota WHERE status='aktif'");
    let cnt = 0;
    for (const a of anggota) {
      const existing = await Q('SELECT id FROM konsolidasi_snapshot WHERE periode=? AND anggota_id=?', [periode, a.id], true);
      if (existing) continue;
      const simpanan = (await Q('SELECT COALESCE(SUM(saldo),0) as t FROM simpanan WHERE anggota_id=?', [a.id], true))?.t ?? 0;
      const pinjaman = (await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t FROM pinjaman WHERE anggota_id=? AND status='aktif'", [a.id], true))?.t ?? 0;
      const piu = await Q('SELECT COALESCE(saldo,0) as t FROM piutang WHERE anggota_id=?', [a.id], true);
      const data = { simpanan, pinjaman, piutang: piu?.t ?? 0 };
      await X('INSERT INTO konsolidasi_snapshot (id,periode,anggota_id,data_json) VALUES (?,?,?,?)', [uid(), periode, a.id, JSON.stringify(data)]);
      cnt++;
    }
    return jsonOk(res, { count: cnt }, `Snapshot ${periode} disimpan untuk ${cnt} anggota`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
