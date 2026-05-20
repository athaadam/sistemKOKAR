const { Q, X } = require('../db');
const { uid, today, jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { sendExport } = require('../utils/export');

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('usaha'), asyncHandler(async (req, res) => {
  try {
    const rows = await Q('SELECT * FROM usaha_lain ORDER BY tgl DESC, created_at DESC LIMIT 300');
    const jenis_options = await Q(
      "SELECT * FROM ref_option WHERE group_key='usaha_jenis' AND aktif=1 ORDER BY label",
    );
    return jsonOk(res, { rows, jenis_options });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/', accessRequired('usaha'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    let eid = String(f.id || '').trim();
    const pend = Number(f.pendapatan) || 0;
    const biaya = Number(f.biaya) || 0;
    const laba = pend - biaya;
    const jenis_val = String(f.jenis || '').trim();
    if (jenis_val) {
      const ex = await Q("SELECT id FROM ref_option WHERE group_key='usaha_jenis' AND value=?", [jenis_val], true);
      if (!ex) {
        await X('INSERT IGNORE INTO ref_option(id,group_key,value,label,aktif) VALUES(?,?,?,?,1)', [uid(), 'usaha_jenis', jenis_val, jenis_val]);
      }
    }
    const tgl = f.tgl || today();
    const status = f.status || 'selesai';

    if (eid) {
      await X(
        'UPDATE usaha_lain SET tgl=?,jenis=?,nama=?,customer=?,deskripsi=?,pendapatan=?,biaya=?,laba=?,status=? WHERE id=?',
        [tgl, f.jenis || 'catering', f.nama || '', f.customer || '', f.deskripsi || '', pend, biaya, laba, status, eid],
      );
    } else {
      eid = uid();
      await X(
        'INSERT INTO usaha_lain(id,tgl,jenis,nama,customer,deskripsi,pendapatan,biaya,laba,status,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [eid, tgl, f.jenis || 'catering', f.nama || '', f.customer || '', f.deskripsi || '', pend, biaya, laba, status, req.session.user.id],
      );
    }

    if (status === 'selesai' && pend > 0) {
      const jrnExists = await Q("SELECT id FROM jurnal WHERE source_modul='usaha_lain' AND source_id=?", [eid], true);
      if (!jrnExists) {
        await X(
          'INSERT INTO jurnal(id,no,tgl,modul,ref,ket,debit,kredit,nominal,user_id,source_modul,source_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
          [uid(), `JRN-${uid()}`, tgl, 'Usaha Lain', eid, `Pendapatan ${f.jenis || 'usaha'}`, 'Kas', 'Pendapatan Lain-lain', pend, req.session.user.id, 'usaha_lain', eid],
        );
      }
    }
    return jsonOk(res, { id: eid }, eid && f.id ? 'Usaha diperbarui' : 'Usaha ditambahkan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/delete/:eid', accessRequired('usaha'), asyncHandler(async (req, res) => {
  try {
    const eid = req.params.eid;
    await X('DELETE FROM usaha_lain WHERE id=?', [eid]);
    await X("DELETE FROM jurnal WHERE source_modul='usaha_lain' AND source_id=?", [eid]);
    return jsonOk(res, {}, 'Usaha dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('usaha'), asyncHandler(async (req, res) => {
  try {
    const rows = await Q(
      'SELECT tgl,jenis,nama,customer,deskripsi,pendapatan,biaya,laba,status FROM usaha_lain ORDER BY tgl DESC',
    );
    const cols = ['tgl', 'jenis', 'nama', 'customer', 'deskripsi', 'pendapatan', 'biaya', 'laba', 'status'];
    return sendExport('xlsx', rows, cols, 'Usaha Lain', 'usaha_lain.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
