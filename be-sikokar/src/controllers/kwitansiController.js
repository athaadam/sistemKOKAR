const { Q, X } = require('../db');
const { uid, today, jsonOk, jsonErr, terbilang } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { getPpnRate, getSetting, getPrintHeader } = require('../utils/settings');
const { sendExport } = require('../utils/export');

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('kwitansi'), asyncHandler(async (req, res) => {
  try {
    const { tipe = '', q = '' } = req.query;
    let sql = 'SELECT * FROM kwitansi WHERE 1=1';
    const params = [];
    if (tipe) { sql += ' AND tipe=?'; params.push(tipe); }
    if (q) {
      sql += ' AND (penerima LIKE ? OR no LIKE ? OR perusahaan LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const rows = await Q(sql + ' ORDER BY tgl DESC,created_at DESC LIMIT 300', params);
    const tot_bln = (await Q('SELECT COALESCE(SUM(total),0) as t FROM kwitansi WHERE substr(tgl,1,7)=?', [today().slice(0, 7)], true))?.t ?? 0;
    const ppn_rate = (await getPpnRate()) * 100;
    const pph23_rate = Number(await getSetting('pph23_rate', '2'));
    return jsonOk(res, { rows, tipe, q, tot_bln, ppn_rate, pph23_rate });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/new', accessRequired('kwitansi'), async (_req, res) => {
  try {
    const ppn_rate = (await getPpnRate()) * 100;
    const pph23_rate = Number(await getSetting('pph23_rate', '2'));
    return jsonOk(res, { ppn_rate, pph23_rate });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
});

router.post('/new', accessRequired('kwitansi'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const tipe = f.tipe || 'kwitansi';
    let items = [];
    try {
      items = typeof f.items_json === 'string' ? JSON.parse(f.items_json || '[]') : (f.items_json || f.items || []);
    } catch {
      items = [];
    }
    const subtotal = Number(f.subtotal) || 0;
    const diskon = Number(f.diskon) || 0;
    const ppn = Number(f.ppn) || 0;
    const pph = Number(f.pph) || 0;
    const total = subtotal - diskon + ppn - pph;
    const prefix = { kwitansi: 'KWT', invoice: 'INV', faktur: 'FKT' }[tipe] || 'KWT';
    const cnt = (await Q('SELECT COUNT(*) as c FROM kwitansi WHERE tipe=? AND substr(no,1,3)=?', [tipe, prefix], true))?.c ?? 0;
    const no = `${prefix}-${today().replace(/-/g, '')}-${String(cnt + 1).padStart(3, '0')}`;
    const kid = uid();
    await X(
      `INSERT INTO kwitansi (id,no,tipe,tgl,penerima,perusahaan,items_json,subtotal,diskon,ppn,pph,total,terbilang,status,catatan,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [kid, no, tipe, f.tgl || today(), f.penerima, f.perusahaan, JSON.stringify(items), subtotal, diskon, ppn, pph, total, terbilang(total), 'belum-lunas', f.catatan || '', req.user.id],
    );
    return jsonOk(res, { id: kid, no }, `${no} berhasil dibuat`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('kwitansi'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'xlsx';
    const rows = await Q('SELECT no,tipe,tgl,penerima,perusahaan,subtotal,diskon,ppn,pph,total,terbilang,status FROM kwitansi ORDER BY tgl DESC');
    const cols = ['no', 'tipe', 'tgl', 'penerima', 'perusahaan', 'subtotal', 'diskon', 'ppn', 'pph', 'total', 'terbilang', 'status'];
    return sendExport(fmt, rows, cols, 'Kwitansi & Invoice', 'kwitansi.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/delete/:kid', accessRequired('kwitansi'), asyncHandler(async (req, res) => {
  try {
    await X('DELETE FROM kwitansi WHERE id=?', [req.params.kid]);
    return jsonOk(res, {}, 'Kwitansi dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/lunas/:kid', accessRequired('kwitansi'), asyncHandler(async (req, res) => {
  try {
    await X("UPDATE kwitansi SET status='lunas' WHERE id=?", [req.params.kid]);
    return jsonOk(res, {}, 'Ditandai lunas');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/:kid', accessRequired('kwitansi'), asyncHandler(async (req, res) => {
  try {
    const k = await Q('SELECT * FROM kwitansi WHERE id=?', [req.params.kid], true);
    if (!k) return jsonErr(res, 'Tidak ditemukan', 404);
    let items = [];
    try {
      items = JSON.parse(k.items_json || '[]');
    } catch {
      items = [];
    }
    const hdr = await getPrintHeader();
    return jsonOk(res, { k, items, hdr });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
