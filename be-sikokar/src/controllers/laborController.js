const { Q, X, Xfk } = require('../db');
const { uid, today, jsonOk, jsonErr, fmtRp, terbilang } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { getSetting, getPpnRate, getPrintHeader } = require('../utils/settings');
const { sendExport } = require('../utils/export');
const { audit } = require('../utils/audit');

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('labor'), asyncHandler(async (req, res) => {
  try {
    const { q = '', status = '' } = req.query;
    let sql = `SELECT k.*,(SELECT COUNT(*) FROM labor_pekerja WHERE kontrak_id=k.id) as jml_pekerja,
      (SELECT COALESCE(SUM(biaya),0) FROM labor_pekerja WHERE kontrak_id=k.id) as total_biaya FROM labor_kontrak k WHERE 1=1`;
    const params = [];
    if (q) { sql += ' AND (k.klien LIKE ? OR k.no LIKE ? OR k.pekerjaan LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (status) { sql += ' AND k.status=?'; params.push(status); }
    const rows = await Q(sql + ' ORDER BY k.tgl DESC LIMIT 200', params);
    const pph23_rate = Number(await getSetting('pph23_rate', '2')) / 100;
    const pph21_rate = Number(await getSetting('pph21_rate', '5')) / 100;
    for (const r of rows) {
      r.laba_kotor = r.nilai_kontrak - r.total_biaya;
      r.pph21_total = Math.round(r.total_biaya * pph21_rate);
      r.pph23 = r.laba_kotor > 0 ? Math.round(r.laba_kotor * pph23_rate) : 0;
      r.laba_bersih = r.laba_kotor - r.pph21_total - r.pph23;
    }
    const total_kontrak = rows.reduce((s, r) => s + Number(r.nilai_kontrak || 0), 0);
    const total_laba = rows.reduce((s, r) => s + Number(r.laba_bersih || 0), 0);
    return jsonOk(res, { rows, q, status, total_kontrak, total_laba });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/save', accessRequired('labor'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const kid = String(f.id || '').trim();
    if (kid) {
      await X(
        'UPDATE labor_kontrak SET klien=?,pekerjaan=?,lokasi=?,tgl=?,tgl_mulai=?,tgl_selesai=?,nilai_kontrak=?,status=?,catatan=? WHERE id=?',
        [f.klien, f.pekerjaan, f.lokasi, f.tgl || today(), f.tgl_mulai, f.tgl_selesai, Number(f.nilai_kontrak) || 0, f.status || 'aktif', f.catatan, kid],
      );
      return jsonOk(res, {}, 'Kontrak diperbarui');
    }
    const no = `LBR-${today().replace(/-/g, '')}-${uid().slice(0, 4)}`;
    await X(
      'INSERT INTO labor_kontrak (id,no,klien,pekerjaan,lokasi,tgl,tgl_mulai,tgl_selesai,nilai_kontrak,status,catatan,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [uid(), no, f.klien, f.pekerjaan, f.lokasi, f.tgl || today(), f.tgl_mulai, f.tgl_selesai, Number(f.nilai_kontrak) || 0, f.status || 'aktif', f.catatan || '', req.session.user.id],
    );
    return jsonOk(res, { no }, `${no} — Kontrak labor berhasil disimpan`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/delete/:kid', accessRequired('labor'), asyncHandler(async (req, res) => {
  try {
    const kid = req.params.kid;
    await Xfk([
      ['DELETE FROM labor_pekerja WHERE kontrak_id=?', [kid]],
      ['DELETE FROM labor_kontrak WHERE id=?', [kid]],
    ]);
    return jsonOk(res, {}, 'Kontrak dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/pekerja/save', accessRequired('labor'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const kontrak_id = f.kontrak_id;
    const pid = String(f.id || '').trim();
    const pph21_rate = Number(await getSetting('pph21_rate', '5')) / 100;
    const jumlah_orang = Number(f.jumlah_orang) || 1;
    const biaya = Number(f.biaya) || 0;
    const biaya_lembur = Number(f.biaya_lembur) || 0;
    const biaya_tambahan = Number(f.biaya_tambahan) || 0;
    const total_biaya = (biaya + biaya_lembur + biaya_tambahan) * jumlah_orang;
    const pph21 = Math.round(total_biaya * pph21_rate);
    const bulan = f.bulan || today().slice(0, 7);
    if (pid) {
      await X(
        `UPDATE labor_pekerja SET nama=?,jabatan=?,nik=?,bulan=?,jumlah_orang=?,
         biaya=?,biaya_lembur=?,biaya_tambahan=?,total_biaya=?,pph21=? WHERE id=?`,
        [f.nama, f.jabatan, f.nik, bulan, jumlah_orang, biaya, biaya_lembur, biaya_tambahan, total_biaya, pph21, pid],
      );
    } else {
      await X(
        `INSERT INTO labor_pekerja (id,kontrak_id,nama,jabatan,nik,bulan,jumlah_orang,
         biaya,biaya_lembur,biaya_tambahan,total_biaya,pph21) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [uid(), kontrak_id, f.nama, f.jabatan, f.nik, bulan, jumlah_orang, biaya, biaya_lembur, biaya_tambahan, total_biaya, pph21],
      );
    }
    return jsonOk(res, {}, `Data pekerja disimpan — Total: Rp ${fmtRp(total_biaya)}/bln`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/pekerja/:kid', accessRequired('labor'), asyncHandler(async (req, res) => {
  try {
    const kid = req.params.kid;
    const kontrak = await Q('SELECT * FROM labor_kontrak WHERE id=?', [kid], true);
    const pekerja = await Q(
      `SELECT *, (biaya+biaya_lembur+biaya_tambahan)*jumlah_orang as total_per_bulan
       FROM labor_pekerja WHERE kontrak_id=? ORDER BY bulan,nama`,
      [kid],
    );
    const summary = {
      manpower: pekerja.reduce((s, p) => s + (Number(p.biaya) || 0) * (p.jumlah_orang || 1), 0),
      lembur: pekerja.reduce((s, p) => s + (Number(p.biaya_lembur) || 0) * (p.jumlah_orang || 1), 0),
      tambahan: pekerja.reduce((s, p) => s + (Number(p.biaya_tambahan) || 0) * (p.jumlah_orang || 1), 0),
    };
    summary.total = summary.manpower + summary.lembur + summary.tambahan;
    return jsonOk(res, { kontrak: kontrak || {}, pekerja, summary });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('labor'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'xlsx';
    const rows = await Q(
      `SELECT k.no,k.tgl,k.klien,k.pekerjaan,k.lokasi,k.tgl_mulai,k.tgl_selesai,
        k.nilai_kontrak,k.status,COALESCE(SUM(p.biaya),0) as total_biaya
        FROM labor_kontrak k LEFT JOIN labor_pekerja p ON k.id=p.kontrak_id
        GROUP BY k.id ORDER BY k.tgl DESC`,
    );
    const cols = ['no', 'tgl', 'klien', 'pekerjaan', 'lokasi', 'tgl_mulai', 'tgl_selesai', 'nilai_kontrak', 'total_biaya', 'status'];
    return sendExport(fmt, rows, cols, 'Labor Supply', 'labor.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/timesheet/:pekerja_id', accessRequired('labor'), asyncHandler(async (req, res) => {
  try {
    const pekerja_id = req.params.pekerja_id;
    const pekerja = await Q('SELECT * FROM labor_pekerja WHERE id=?', [pekerja_id], true);
    if (!pekerja) return jsonErr(res, 'Pekerja tidak ditemukan');
    const rows = await Q('SELECT * FROM labor_timesheet WHERE pekerja_id=? ORDER BY tgl DESC LIMIT 60', [pekerja_id]);
    const summary = await Q(
      `SELECT COUNT(*) as total_hari,
        SUM(CASE WHEN status='hadir' THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN status='izin' THEN 1 ELSE 0 END) as izin,
        SUM(CASE WHEN status='sakit' THEN 1 ELSE 0 END) as sakit,
        SUM(CASE WHEN status='alpha' THEN 1 ELSE 0 END) as alpha,
        COALESCE(SUM(jam_kerja),0) as total_jam,
        COALESCE(SUM(jam_lembur),0) as total_lembur
        FROM labor_timesheet WHERE pekerja_id=? AND substr(tgl,1,7)=?`,
      [pekerja_id, today().slice(0, 7)],
      true,
    );
    return jsonOk(res, { pekerja, rows, summary: summary || {} });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/timesheet/:pekerja_id', accessRequired('labor'), asyncHandler(async (req, res) => {
  try {
    const pekerja_id = req.params.pekerja_id;
    const pekerja = await Q('SELECT * FROM labor_pekerja WHERE id=?', [pekerja_id], true);
    if (!pekerja) return jsonErr(res, 'Pekerja tidak ditemukan');
    const f = req.body;
    await X(
      `INSERT INTO labor_timesheet (id,pekerja_id,kontrak_id,tgl,jam_masuk,jam_keluar,
       jam_kerja,jam_lembur,status,keterangan) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        uid(), pekerja_id, pekerja.kontrak_id, f.tgl || today(), f.jam_masuk, f.jam_keluar,
        Number(f.jam_kerja) || 0, Number(f.jam_lembur) || 0, f.status || 'hadir', f.keterangan || '',
      ],
    );
    return jsonOk(res, {}, 'Timesheet disimpan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/spk', accessRequired('labor'), async (_req, res) => {
  return jsonOk(res, {}, 'Menu SPK Labor sudah dihapus sesuai revisi aplikasi. Gunakan modul Labor Supply / Kwitansi bila diperlukan.');
});

router.get('/spk/print/:sid', accessRequired('labor'), async (_req, res) => {
  return jsonOk(res, {}, 'Menu SPK Labor sudah dihapus sesuai revisi aplikasi.');
});

router.get('/slip_gaji/:pekerja_id', accessRequired('labor'), asyncHandler(async (req, res) => {
  try {
    const pekerja_id = req.params.pekerja_id;
    const bulan = req.query.bulan || today().slice(0, 7);
    const p = await Q(
      `SELECT lp.*, lk.klien, lk.pekerjaan FROM labor_pekerja lp
       LEFT JOIN labor_kontrak lk ON lp.kontrak_id=lk.id WHERE lp.id=?`,
      [pekerja_id],
      true,
    );
    if (!p) return jsonErr(res, 'Tidak ditemukan');
    const ts = await Q(
      `SELECT COUNT(*) as hari, COALESCE(SUM(jam_kerja),0) as jam,
        COALESCE(SUM(jam_lembur),0) as lembur,
        SUM(CASE WHEN status='hadir' THEN 1 ELSE 0 END) as hadir
        FROM labor_timesheet WHERE pekerja_id=? AND substr(tgl,1,7)=?`,
      [pekerja_id, bulan],
      true,
    );
    const hdr = await getPrintHeader();
    return jsonOk(res, { p, bulan, ts: ts || {}, hdr });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/invoice/:kid', accessRequired('labor'), asyncHandler(async (req, res) => {
  try {
    const kid = req.params.kid;
    const k = await Q('SELECT * FROM labor_kontrak WHERE id=?', [kid], true);
    if (!k) return jsonErr(res, 'Kontrak tidak ditemukan');
    const items = [{ ket: `${k.pekerjaan} - ${k.lokasi}`, qty: 1, harga: k.nilai_kontrak, subtotal: k.nilai_kontrak }];
    const ppn_rate = (await getPpnRate());
    const pph23_rate = Number(await getSetting('pph23_rate', '2')) / 100;
    const subtotal = k.nilai_kontrak;
    const ppn = Math.round(subtotal * ppn_rate);
    const pph = Math.round(subtotal * pph23_rate);
    const total = subtotal + ppn - pph;
    const cnt = (await Q("SELECT COUNT(*) as c FROM kwitansi WHERE tipe='invoice'", [], true))?.c ?? 0;
    const no = `INV-LBR-${today().replace(/-/g, '')}-${String(cnt + 1).padStart(3, '0')}`;
    const inv_id = uid();
    await X(
      `INSERT INTO kwitansi (id,no,tipe,tgl,penerima,perusahaan,items_json,subtotal,
       diskon,ppn,pph,total,terbilang,status,catatan,user_id)
       VALUES (?,?,'invoice',?,?,?,?,?,0,?,?,?,?,'belum-lunas',?,?)`,
      [inv_id, no, today(), k.klien, k.klien, JSON.stringify(items), subtotal, ppn, pph, total, terbilang(total), `Invoice atas kontrak labor: ${k.no}`, req.session.user.id],
    );
    await audit('labor', 'generate_invoice', 'kwitansi', inv_id, null, { no, total }, `Invoice dari kontrak ${k.no}`);
    return jsonOk(res, { id: inv_id, no }, `Invoice ${no} dibuat untuk kontrak ${k.no}`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
