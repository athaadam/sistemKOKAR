const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { Q, X } = require('../db');
const { uid, jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { sendExport } = require('../utils/export');

const upload = multer({ storage: multer.memoryStorage() });

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('coa'), asyncHandler(async (req, res) => {
  try {
    const { q = '', tipe = '' } = req.query;
    let sql = 'SELECT * FROM coa WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND (nama LIKE ? OR kode LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    if (tipe) {
      sql += ' AND tipe=?';
      params.push(tipe);
    }
    const rows = await Q(sql + ' ORDER BY kode', params);
    for (const r of rows) {
      const bal = await Q(
        `SELECT COALESCE(SUM(CASE WHEN debit=? THEN nominal ELSE 0 END)-SUM(CASE WHEN kredit=? THEN nominal ELSE 0 END),0) as t FROM jurnal`,
        [r.nama, r.nama],
        true,
      );
      r.balance = bal?.t ?? 0;
    }
    return jsonOk(res, { rows, q, tipe });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/save', accessRequired('coa'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const cid = String(f.id || '').trim();
    if (cid) {
      await X('UPDATE coa SET kode=?,nama=?,tipe=?,level=?,status=? WHERE id=?', [
        f.kode,
        f.nama,
        f.tipe,
        f.level || 1,
        f.status || 'aktif',
        cid,
      ]);
      return jsonOk(res, {}, 'COA diperbarui');
    }
    await X('INSERT INTO coa (id,kode,nama,tipe,level,status) VALUES (?,?,?,?,?,?)', [
      uid(),
      f.kode,
      f.nama,
      f.tipe,
      f.level || 1,
      f.status || 'aktif',
    ]);
    return jsonOk(res, {}, 'COA ditambahkan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/:cid', accessRequired('coa'), asyncHandler(async (req, res) => {
  try {
    await X('DELETE FROM coa WHERE id=?', [req.params.cid]);
    return jsonOk(res, {}, 'COA dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('coa'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'csv';
    const rows = await Q('SELECT kode,nama,tipe,level,status FROM coa ORDER BY kode');
    const cols = ['kode', 'nama', 'tipe', 'level', 'status'];
    return sendExport(fmt, rows, cols, 'Chart of Accounts', 'coa.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/import', accessRequired('coa'), upload.single('file'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) return jsonErr(res, 'Pilih file');
    const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const reader = parse(content, { columns: true, skip_empty_lines: true });
    let cnt = 0;
    for (const row of reader) {
      const kode = String(row.kode || '').trim();
      const nama = String(row.nama || '').trim();
      if (!kode || !nama) continue;
      await X('INSERT IGNORE INTO coa (id,kode,nama,tipe,level,status) VALUES (?,?,?,?,?,?)', [
        uid(),
        kode,
        nama,
        row.tipe || 'aset',
        Number(row.level) || 1,
        row.status || 'aktif',
      ]);
      cnt++;
    }
    return jsonOk(res, { count: cnt }, `${cnt} akun diimport`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
