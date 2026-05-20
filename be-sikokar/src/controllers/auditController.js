const { Q } = require('../db');
const { jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { sendExport } = require('../utils/export');

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('setting'), asyncHandler(async (req, res) => {
  try {
    const { modul = '', aksi = '', tgl_from = '', tgl_to = '', q = '' } = req.query;
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];
    if (modul) { sql += ' AND modul=?'; params.push(modul); }
    if (aksi) { sql += ' AND aksi=?'; params.push(aksi); }
    if (tgl_from) { sql += ' AND tgl>=?'; params.push(tgl_from); }
    if (tgl_to) { sql += ' AND tgl<=?'; params.push(`${tgl_to} 23:59:59`); }
    if (q) {
      sql += ' AND (user_name LIKE ? OR keterangan LIKE ? OR ref_id LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const rows = await Q(sql + ' ORDER BY tgl DESC LIMIT 500', params);
    const moduls = await Q("SELECT DISTINCT modul FROM audit_log WHERE modul!=''");
    return jsonOk(res, { rows, moduls, modul, aksi, tgl_from, tgl_to, q });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('setting'), asyncHandler(async (req, res) => {
  try {
    const rows = await Q(
      'SELECT tgl,user_name,modul,aksi,ref_table,ref_id,keterangan,ip_address FROM audit_log ORDER BY tgl DESC LIMIT 5000',
    );
    const cols = ['tgl', 'user_name', 'modul', 'aksi', 'ref_table', 'ref_id', 'keterangan', 'ip_address'];
    return sendExport('xlsx', rows, cols, 'Audit Log', 'audit_log.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
