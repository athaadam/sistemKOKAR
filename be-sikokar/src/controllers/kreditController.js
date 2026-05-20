const { Q, X, Xfk } = require('../db');
const { uid, today, jsonOk, jsonErr, fmtRp } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { getBungaRegular } = require('../utils/settings');
const { sendExport } = require('../utils/export');

async function getKreditAnggota(anggota_id) {
  const motor = await Q(
    "SELECT COALESCE(SUM(angsuran),0) as t FROM kredit_barang WHERE anggota_id=? AND jenis='motor' AND status='aktif'",
    [anggota_id],
    true,
  );
  const elektronik = await Q(
    "SELECT COALESCE(SUM(angsuran),0) as t FROM kredit_barang WHERE anggota_id=? AND jenis='elektronik' AND status='aktif'",
    [anggota_id],
    true,
  );
  return {
    motor: motor?.t ?? 0,
    elektronik: elektronik?.t ?? 0,
    rows_motor: await Q(
      "SELECT * FROM kredit_barang WHERE anggota_id=? AND jenis='motor' AND status='aktif'",
      [anggota_id],
    ),
    rows_elektronik: await Q(
      "SELECT * FROM kredit_barang WHERE anggota_id=? AND jenis='elektronik' AND status='aktif'",
      [anggota_id],
    ),
  };
}

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/anggota/:anggota_id', accessRequired('kredit'), asyncHandler(async (req, res) => {
  try {
    const data = await getKreditAnggota(req.params.anggota_id);
    return jsonOk(res, data);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/', accessRequired('kredit'), asyncHandler(async (req, res) => {
  try {
    const { q = '', jenis = '', status = '' } = req.query;
    let sql = `SELECT k.*,a.nama as anggota_nama,a.nip,a.no as anggota_no FROM kredit_barang k
      LEFT JOIN anggota a ON k.anggota_id=a.id WHERE 1=1`;
    const params = [];
    if (q) {
      sql += ' AND (a.nama LIKE ? OR k.no LIKE ? OR k.nama_barang LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (jenis) { sql += ' AND k.jenis=?'; params.push(jenis); }
    if (status) { sql += ' AND k.status=?'; params.push(status); }
    const rows = await Q(sql + ' ORDER BY k.created_at DESC LIMIT 300', params);
    const anggota_list = await Q("SELECT id,no,nama FROM anggota WHERE status='aktif' ORDER BY nama");
    const bunga_reg = await getBungaRegular();
    const total_outstanding = (await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t FROM kredit_barang WHERE status='aktif'", [], true))?.t ?? 0;
    const total_angsuran = (await Q("SELECT COALESCE(SUM(angsuran),0) as t FROM kredit_barang WHERE status='aktif'", [], true))?.t ?? 0;
    const kredit_jenis_options = await Q(
      "SELECT * FROM ref_option WHERE group_key='kredit_jenis' AND aktif=1 ORDER BY label",
    );
    return jsonOk(res, {
      rows, q, jenis, status, anggota_list, bunga_reg, total_outstanding, total_angsuran, kredit_jenis_options,
    });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/save', accessRequired('kredit'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const kid = String(f.id || '').trim();
    const anggota_id = f.anggota_id;
    let jenis = f.jenis || 'motor';
    if (jenis) {
      const ex = await Q("SELECT id FROM ref_option WHERE group_key='kredit_jenis' AND value=?", [jenis], true);
      if (!ex) {
        await X('INSERT IGNORE INTO ref_option(id,group_key,value,label,aktif) VALUES(?,?,?,?,1)', [uid(), 'kredit_jenis', jenis, jenis]);
      }
    }
    const harga_beli = Number(f.harga_beli) || 0;
    const dp = Number(f.dp) || 0;
    const pokok = harga_beli - dp;
    const bunga_pct = Number(f.bunga_pct) || (await getBungaRegular());
    const tenor = Number(f.tenor) || 12;
    const tgl_mulai = f.tgl_mulai || today();
    const total_bunga = pokok * bunga_pct / 100 * tenor;
    const angsuran = Math.round((pokok + total_bunga) / tenor);

    if (kid) {
      await X(
        `UPDATE kredit_barang SET anggota_id=?,jenis=?,nama_barang=?,toko=?,harga_beli=?,dp=?,
         pokok=?,bunga_pct=?,tenor=?,angsuran=?,tgl_mulai=?,catatan=?,status=? WHERE id=?`,
        [anggota_id, jenis, f.nama_barang, f.toko, harga_beli, dp, pokok, bunga_pct, tenor, angsuran, tgl_mulai, f.catatan, f.status || 'aktif', kid],
      );
      return jsonOk(res, {}, 'Kredit diperbarui');
    }

    const no = `KRD-${tgl_mulai.replace(/-/g, '')}-${uid().slice(0, 4)}`;
    await X(
      `INSERT INTO kredit_barang (id,no,anggota_id,jenis,nama_barang,toko,harga_beli,dp,pokok,
       bunga_pct,tenor,angsuran,sisa_pokok,cicilan_ke,status,tgl_mulai,catatan,user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uid(), no, anggota_id, jenis, f.nama_barang, f.toko, harga_beli, dp, pokok, bunga_pct, tenor, angsuran, pokok, 0, 'aktif', tgl_mulai, f.catatan, req.session.user.id],
    );
    return jsonOk(res, {}, `Kredit ${jenis} berhasil ditambahkan — angsuran ${fmtRp(angsuran)}/bln`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/delete/:kid', accessRequired('kredit'), asyncHandler(async (req, res) => {
  try {
    const kid = req.params.kid;
    await Xfk([
      ['DELETE FROM kredit_bayar WHERE kredit_id=?', [kid]],
      ['DELETE FROM kredit_barang WHERE id=?', [kid]],
    ]);
    return jsonOk(res, {}, 'Kredit dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/bayar/:kid', accessRequired('kredit'), asyncHandler(async (req, res) => {
  try {
    const kid = req.params.kid;
    const kr = await Q('SELECT * FROM kredit_barang WHERE id=?', [kid], true);
    if (!kr) return jsonErr(res, 'Data tidak ditemukan');
    const tgl = req.body.tgl || today();
    const metode = req.body.metode || 'potong-gaji';
    const pokok_angs = Math.round(kr.pokok / kr.tenor);
    const bunga_angs = kr.angsuran - pokok_angs;
    const sisa_baru = Math.max(0, kr.sisa_pokok - pokok_angs);
    const status_baru = sisa_baru <= 0 ? 'lunas' : 'aktif';
    await X('UPDATE kredit_barang SET sisa_pokok=?,cicilan_ke=cicilan_ke+1,status=? WHERE id=?', [sisa_baru, status_baru, kid]);
    await X(
      'INSERT INTO kredit_bayar (id,kredit_id,tgl,nominal,pokok,bunga,metode,user_id) VALUES (?,?,?,?,?,?,?,?)',
      [uid(), kid, tgl, kr.angsuran, pokok_angs, bunga_angs, metode, req.session.user.id],
    );
    return jsonOk(res, {}, `Angsuran kredit ${fmtRp(kr.angsuran)} berhasil — sisa ${fmtRp(sisa_baru)}`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/lunas/:kid', accessRequired('kredit'), asyncHandler(async (req, res) => {
  try {
    await X("UPDATE kredit_barang SET sisa_pokok=0,status='lunas' WHERE id=?", [req.params.kid]);
    return jsonOk(res, {}, 'Kredit dilunasi');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('kredit'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'xlsx';
    const rows = await Q(
      `SELECT k.no,k.tgl_mulai,a.no as no_ang,a.nip,a.nama,k.jenis,k.nama_barang,k.toko,
        k.harga_beli,k.dp,k.pokok,k.bunga_pct,k.tenor,k.angsuran,k.sisa_pokok,k.cicilan_ke,k.status
        FROM kredit_barang k LEFT JOIN anggota a ON k.anggota_id=a.id ORDER BY k.created_at DESC`,
    );
    const cols = ['no', 'tgl_mulai', 'no_ang', 'nip', 'nama', 'jenis', 'nama_barang', 'toko', 'harga_beli', 'dp', 'pokok', 'bunga_pct', 'tenor', 'angsuran', 'sisa_pokok', 'cicilan_ke', 'status'];
    return sendExport(fmt, rows, cols, 'Data Kredit', 'kredit.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes, getKreditAnggota };
