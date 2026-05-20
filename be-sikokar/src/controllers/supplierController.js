const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { Q, X, db } = require('../db');
const { uid, jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { sendExport } = require('../utils/export');

const upload = multer({ storage: multer.memoryStorage() });

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('supplier'), asyncHandler(async (req, res) => {
  try {
    const { q = '' } = req.query;
    let sql = 'SELECT * FROM supplier WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND (nama LIKE ? OR kode LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    const rows = await Q(sql + ' ORDER BY kode', params);
    return jsonOk(res, { rows, q });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/save', accessRequired('supplier'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const sid = String(f.id || '').trim();
    const isPkp = f.is_pkp === '1' || f.is_pkp === true || f.is_pkp === 1 ? 1 : 0;
    if (sid) {
      await X(
        'UPDATE supplier SET nama=?,jenis=?,is_pkp=?,npwp=?,alamat=?,telp=?,status=? WHERE id=?',
        [f.nama, f.jenis || 'regular', isPkp, f.npwp, f.alamat, f.telp, f.status || 'aktif', sid],
      );
      return jsonOk(res, {}, 'Supplier diperbarui');
    }
    const cnt = await Q('SELECT COUNT(*) as c FROM supplier', [], true);
    await X(
      'INSERT INTO supplier (id,kode,nama,jenis,is_pkp,npwp,alamat,telp,status) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        uid(),
        `SUP${String((cnt?.c || 0) + 1).padStart(3, '0')}`,
        f.nama,
        f.jenis || 'regular',
        isPkp,
        f.npwp,
        f.alamat,
        f.telp,
        f.status || 'aktif',
      ],
    );
    return jsonOk(res, {}, 'Supplier ditambahkan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/:sid', accessRequired('supplier'), asyncHandler(async (req, res) => {
  try {
    const sid = req.params.sid;
    await db.transaction(async (trx) => {
      await trx.raw('UPDATE barang SET supplier_id=NULL WHERE supplier_id=?', [sid]);
      await trx.raw('UPDATE pembelian SET supplier_id=NULL WHERE supplier_id=?', [sid]);
      await trx.raw('DELETE FROM supplier WHERE id=?', [sid]);
    });
    return jsonOk(res, {}, 'Supplier dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('supplier'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'csv';
    const rows = await Q(
      'SELECT kode,nama,jenis,is_pkp,npwp,alamat,telp,status FROM supplier ORDER BY kode',
    );
    const cols = ['kode', 'nama', 'jenis', 'is_pkp', 'npwp', 'alamat', 'telp', 'status'];
    return sendExport(fmt, rows, cols, 'Data Supplier', 'supplier.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/import', accessRequired('supplier'), upload.single('file'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) return jsonErr(res, 'Pilih file');
    const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const reader = parse(content, { columns: true, skip_empty_lines: true });
    let cnt = 0;
    for (const row of reader) {
      const nama = String(row.nama || '').trim();
      if (!nama) continue;
      const c = await Q('SELECT COUNT(*) as c FROM supplier', [], true);
      await X(
        'INSERT IGNORE INTO supplier (id,kode,nama,jenis,is_pkp,npwp,alamat,telp,status) VALUES (?,?,?,?,?,?,?,?,?)',
        [
          uid(),
          row.kode || `SUP${(c?.c || 0) + 1}`,
          nama,
          row.jenis || 'regular',
          Number(row.is_pkp) || 0,
          row.npwp || '',
          row.alamat || '',
          row.telp || '',
          row.status || 'aktif',
        ],
      );
      cnt++;
    }
    return jsonOk(res, { count: cnt }, `${cnt} supplier diimport`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
