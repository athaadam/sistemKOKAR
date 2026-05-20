const { Q, X } = require('../db');
const { uid, today, jsonOk, jsonErr, fmtRp } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');

function calcDepreciation(r) {
  let tahun_lalu = 0;
  let penyusutan_th = 0;
  try {
    const ages = (Date.now() - new Date(r.tgl_perolehan).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    penyusutan_th = r.umur_ekonomis ? (r.harga_beli - r.nilai_residu) / r.umur_ekonomis : 0;
    tahun_lalu = Math.min(r.umur_ekonomis, Math.floor(ages));
  } catch {
    tahun_lalu = 0;
  }
  const akum_calc = penyusutan_th * tahun_lalu;
  const nilai_buku_calc = Math.max(r.nilai_residu, r.harga_beli - akum_calc);
  return { akum_calc, nilai_buku_calc, penyusutan_th };
}

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const rows = await Q('SELECT * FROM aset_tetap ORDER BY tgl_perolehan DESC');
    for (const r of rows) {
      const { akum_calc, nilai_buku_calc } = calcDepreciation(r);
      r.akum_calc = akum_calc;
      r.nilai_buku_calc = nilai_buku_calc;
    }
    const total_harga = rows.reduce((s, r) => s + Number(r.harga_beli || 0), 0);
    const total_akum = rows.reduce((s, r) => s + Number(r.akum_calc || 0), 0);
    const total_buku = rows.reduce((s, r) => s + Number(r.nilai_buku_calc || 0), 0);
    return jsonOk(res, { rows, total_harga, total_akum, total_buku });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const aid = String(f.id || '').trim();
    const harga = Number(f.harga_beli) || 0;
    const residu = Number(f.nilai_residu) || 0;
    const umur = Number(f.umur_ekonomis) || 5;
    if (aid) {
      await X(
        `UPDATE aset_tetap SET nama=?,kategori=?,tgl_perolehan=?,harga_beli=?,
         umur_ekonomis=?,nilai_residu=?,metode_susut=?,catatan=? WHERE id=?`,
        [f.nama, f.kategori, f.tgl_perolehan, harga, umur, residu, f.metode_susut || 'garis-lurus', f.catatan, aid],
      );
    } else {
      const no = `AST-${today().replace(/-/g, '')}-${uid().slice(0, 4)}`;
      await X(
        `INSERT INTO aset_tetap (id,no,nama,kategori,tgl_perolehan,harga_beli,
         umur_ekonomis,nilai_residu,metode_susut,nilai_buku,catatan,user_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [uid(), no, f.nama, f.kategori, f.tgl_perolehan, harga, umur, residu, f.metode_susut || 'garis-lurus', harga, f.catatan || '', req.session.user.id],
      );
    }
    return jsonOk(res, {}, 'Aset tetap disimpan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/depresiasi/:aid', accessRequired('pembukuan'), asyncHandler(async (req, res) => {
  try {
    const aid = req.params.aid;
    const a = await Q('SELECT * FROM aset_tetap WHERE id=?', [aid], true);
    if (!a) return jsonErr(res, 'Aset tidak ditemukan', 404);
    const penyusutan_bln = (a.harga_beli - a.nilai_residu) / (a.umur_ekonomis * 12);
    await X(
      'INSERT INTO jurnal (id,no,tgl,modul,ref,ket,debit,kredit,nominal,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uid(), `JRN-DEP-${uid().slice(0, 6)}`, today(), 'Aset Tetap', a.no, `Penyusutan aset: ${a.nama}`, 'Beban Penyusutan', 'Akumulasi Penyusutan', penyusutan_bln, req.session.user.id],
    );
    await X('UPDATE aset_tetap SET akumulasi_penyusutan=akumulasi_penyusutan+?, nilai_buku=nilai_buku-? WHERE id=?', [penyusutan_bln, penyusutan_bln, aid]);
    return jsonOk(res, {}, `Penyusutan bulanan ${fmtRp(penyusutan_bln)} diposting`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
