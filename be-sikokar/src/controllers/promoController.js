const { Q, X } = require('../db');
const { uid, jsonOk, jsonErr } = require('../utils/helpers');
const { sendExport } = require('../utils/export');
const { audit } = require('../utils/audit');

function promoAccess(req, res, next) {
  const { canAccess } = require('../constants/roleMenus');
  if (!req.session?.user) return jsonErr(res, 'Login required', 401);
  if (!canAccess(req.user, 'barang') && !canAccess(req.user, 'promo')) {
    return jsonErr(res, 'Akses ditolak', 403);
  }
  next();
}

function registerRoutes(router, deps) {
  const { asyncHandler } = deps;
  router.get('/', promoAccess, asyncHandler(async (req, res) => {
  try {
    const rows = await Q(
      'SELECT p.*, b.nama as barang_nama FROM promo p LEFT JOIN barang b ON p.barang_id=b.id ORDER BY p.tgl_mulai DESC',
    );
    return jsonOk(res, { rows });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/save', promoAccess, asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const pid = String(f.id || '').trim();
    const vals = [
      f.nama,
      f.tipe || 'persen',
      Number(f.nilai) || 0,
      f.barang_id || null,
      f.kategori || '',
      Number(f.min_qty) || 1,
      Number(f.min_total) || 0,
      f.member_only ? 1 : 0,
      f.tgl_mulai || '',
      f.tgl_akhir || '',
      f.status || 'aktif',
    ];
    if (pid) {
      await X(
        `UPDATE promo SET nama=?,tipe=?,nilai=?,barang_id=?,kategori=?,min_qty=?,min_total=?,
         member_only=?,tgl_mulai=?,tgl_akhir=?,status=? WHERE id=?`,
        [...vals, pid],
      );
      await audit('promo', 'update', 'promo', pid, null, f, 'Update promo');
    } else {
      const nid = uid();
      await X(
        `INSERT INTO promo (id,nama,tipe,nilai,barang_id,kategori,min_qty,min_total,
         member_only,tgl_mulai,tgl_akhir,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [nid, ...vals],
      );
      await audit('promo', 'create', 'promo', nid, null, f, 'Buat promo');
    }
    return jsonOk(res, {}, 'Promo disimpan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', promoAccess, asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'xlsx';
    const rows = await Q(
      'SELECT p.nama,p.tipe,p.nilai,b.nama as barang_nama,p.kategori,p.min_qty,p.min_total,p.member_only,p.tgl_mulai,p.tgl_akhir,p.status FROM promo p LEFT JOIN barang b ON p.barang_id=b.id ORDER BY p.tgl_mulai DESC',
    );
    const cols = ['nama', 'tipe', 'nilai', 'barang_nama', 'kategori', 'min_qty', 'min_total', 'member_only', 'tgl_mulai', 'tgl_akhir', 'status'];
    return sendExport(fmt, rows, cols, 'Promo & Diskon', 'promo.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/delete/:pid', promoAccess, asyncHandler(async (req, res) => {
  try {
    const pid = req.params.pid;
    await X('DELETE FROM promo WHERE id=?', [pid]);
    await audit('promo', 'delete', 'promo', pid, null, null, 'Hapus promo');
    return jsonOk(res, {}, 'Promo dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
