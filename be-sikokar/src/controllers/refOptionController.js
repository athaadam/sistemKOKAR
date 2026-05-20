const { Q, X } = require('../db');
const { uid, jsonOk, jsonErr } = require('../utils/helpers');
const { loginRequired } = require('../middleware/auth');
const { audit } = require('../utils/audit');

function registerRoutes(router, deps) {
  const { asyncHandler, loginRequired } = deps;
  router.post('/save', loginRequired, asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const gid = String(f.group_key || '').trim();
    const value = String(f.value || f.label || '').trim();
    const label = String(f.label || value).trim();
    if (!gid || !value) return jsonErr(res, 'Group dan value wajib diisi');

    const oid = String(f.id || '').trim();
    if (oid) {
      await X('UPDATE ref_option SET value=?,label=?,aktif=? WHERE id=?', [
        value,
        label,
        f.aktif === '1' || f.aktif === 1 || f.aktif === true ? 1 : 0,
        oid,
      ]);
    } else {
      await X(
        'INSERT IGNORE INTO ref_option(id,group_key,value,label,aktif) VALUES(?,?,?,?,1)',
        [uid(), gid, value, label],
      );
    }
    return jsonOk(res, {}, 'Dropdown/master diperbarui');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/:oid', loginRequired, asyncHandler(async (req, res) => {
  try {
    await X('UPDATE ref_option SET aktif=0 WHERE id=?', [req.params.oid]);
    return jsonOk(res, {}, 'Pilihan dropdown dinonaktifkan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
