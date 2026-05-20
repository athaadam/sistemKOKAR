const { Q, X } = require('../db');
const { uid, today, jsonOk, jsonErr, fmtRp } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { sendExport } = require('../utils/export');

function daysBetween(tgl_mulai, tgl_selesai) {
  const d1 = new Date(tgl_mulai);
  const d2 = new Date(tgl_selesai);
  const diff = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('rental'), asyncHandler(async (req, res) => {
  try {
    const { tgl = '', q = '', kategori = '' } = req.query;
    let sql = `SELECT r.*,k.nama as aset_nama,k.kode as aset_kode FROM rental r
      LEFT JOIN kendaraan k ON r.kendaraan_id=k.id WHERE 1=1`;
    const params = [];
    if (tgl) { sql += ' AND r.tgl_mulai=?'; params.push(tgl); }
    if (q) { sql += ' AND (r.no LIKE ? OR r.nama_penyewa LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    if (kategori) { sql += ' AND k.jenis=?'; params.push(kategori); }
    const rows = await Q(sql + ' ORDER BY r.created_at DESC LIMIT 200', params);
    const aset_list = await Q('SELECT * FROM kendaraan ORDER BY jenis,kode');
    const jenis_list = await Q('SELECT DISTINCT jenis FROM kendaraan ORDER BY jenis');
    return jsonOk(res, { rows, tgl, q, kategori, aset_list, jenis_list });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/booking', accessRequired('rental'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const kend_id = f.kendaraan_id;
    const tgl_mulai = f.tgl_mulai || today();
    const tgl_selesai = f.tgl_selesai || today();
    const kend = await Q('SELECT * FROM kendaraan WHERE id=?', [kend_id], true);
    if (!kend) return jsonErr(res, 'Aset tidak ditemukan');
    const hari = daysBetween(tgl_mulai, tgl_selesai);
    const bulan = Math.max(1, Math.round(hari / 30));
    const tipe_harga = f.tipe_harga || 'harian';
    const tarif_custom = Number(f.tarif_custom) || 0;
    let tarif;
    let total;
    if (tipe_harga === 'custom' && tarif_custom) {
      tarif = tarif_custom;
      total = tarif;
    } else if (tipe_harga === 'bulanan') {
      tarif = kend.tarif_bulanan;
      total = tarif * bulan;
    } else {
      tarif = kend.tarif_harian;
      total = tarif * hari;
    }
    const no = `RNT-${today().replace(/-/g, '')}-${uid().slice(0, 4)}`;
    await X(
      `INSERT INTO rental (id,no,tgl_buat,tgl_mulai,tgl_selesai,kendaraan_id,penyewa_tipe,nama_penyewa,
       nama_perusahaan,npwp_penyewa,no_hp,keperluan,tipe_harga,tarif,hari,bulan,total,dp,km_awal,status,denda,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uid(), no, today(), tgl_mulai, tgl_selesai, kend_id, f.penyewa_tipe || 'umum', f.nama_penyewa || '',
        f.nama_perusahaan || '', f.npwp_penyewa || '', f.no_hp || '', f.keperluan || '',
        tipe_harga, tarif, hari, bulan, total, 0, kend.km || 0, 'aktif', 0, req.user.id,
      ],
    );
    await X("UPDATE kendaraan SET status='disewa' WHERE id=?", [kend_id]);
    return jsonOk(res, { no }, `${no} booking berhasil — ${fmtRp(total)}`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/kembali/:r_id', accessRequired('rental'), asyncHandler(async (req, res) => {
  try {
    const r_id = req.params.r_id;
    const r = await Q('SELECT * FROM rental WHERE id=?', [r_id], true);
    if (!r) return jsonErr(res, 'Data tidak ditemukan');
    const km_kembali = Number(req.body.km_kembali) || (r.km_awal || 0) + 50;
    const kondisi = req.body.kondisi || 'baik';
    const denda = Number(req.body.denda) || 0;
    const total_baru = r.total + denda;
    await X('UPDATE rental SET status=?,km_kembali=?,kondisi=?,denda=?,total=? WHERE id=?', ['selesai', km_kembali, kondisi, denda, total_baru, r_id]);
    await X("UPDATE kendaraan SET status='tersedia',km=? WHERE id=?", [km_kembali, r.kendaraan_id]);
    return jsonOk(res, {}, `Aset kembali — ${fmtRp(total_baru)}`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/aset/save', accessRequired('rental'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const kid = String(f.id || '').trim();
    if (kid) {
      await X(
        'UPDATE kendaraan SET kode=?,no_pol=?,nama=?,jenis=?,tarif_harian=?,tarif_bulanan=?,status=?,kapasitas=? WHERE id=?',
        [f.kode, f.no_pol, f.nama, f.jenis, Number(f.tarif_harian) || 0, Number(f.tarif_bulanan) || 0, f.status || 'tersedia', Number(f.kapasitas) || 1, kid],
      );
      return jsonOk(res, {}, 'Aset diperbarui');
    }
    const cnt = (await Q('SELECT COUNT(*) as c FROM kendaraan', [], true))?.c ?? 0;
    await X(
      'INSERT INTO kendaraan (id,kode,no_pol,nama,jenis,tarif_harian,tarif_bulanan,status,km,kapasitas) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uid(), f.kode || `AST-${String(cnt + 1).padStart(3, '0')}`, f.no_pol || '', f.nama, f.jenis, Number(f.tarif_harian) || 0, Number(f.tarif_bulanan) || 0, 'tersedia', 0, Number(f.kapasitas) || 1],
    );
    return jsonOk(res, {}, 'Aset ditambahkan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/aset/delete/:kid', accessRequired('rental'), asyncHandler(async (req, res) => {
  try {
    const kid = req.params.kid;
    await X('UPDATE rental SET kendaraan_id=NULL WHERE kendaraan_id=?', [kid]);
    await X('DELETE FROM kendaraan WHERE id=?', [kid]);
    return jsonOk(res, {}, 'Aset dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('rental'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'csv';
    const rows = await Q(
      `SELECT r.no,r.tgl_mulai,r.tgl_selesai,k.nama as aset,k.jenis as tipe_aset,r.penyewa_tipe,
        r.nama_penyewa,r.nama_perusahaan,r.tipe_harga,r.tarif,r.hari,r.total,r.denda,r.status
        FROM rental r LEFT JOIN kendaraan k ON r.kendaraan_id=k.id ORDER BY r.tgl_buat DESC`,
    );
    const cols = ['no', 'tgl_mulai', 'tgl_selesai', 'aset', 'tipe_aset', 'penyewa_tipe', 'nama_penyewa', 'nama_perusahaan', 'tipe_harga', 'tarif', 'hari', 'total', 'denda', 'status'];
    return sendExport(fmt, rows, cols, 'Data Rental', 'rental.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/maintenance', accessRequired('rental'), asyncHandler(async (req, res) => {
  try {
    const rows = await Q(
      `SELECT m.*, k.nama as kendaraan_nama, COALESCE(NULLIF(k.no_polisi,''), k.no_pol) as no_polisi
       FROM rental_maintenance m LEFT JOIN kendaraan k ON m.kendaraan_id=k.id
       ORDER BY m.tgl DESC LIMIT 200`,
    );
    const kendaraan = await Q(
      "SELECT id,nama,COALESCE(NULLIF(no_polisi,''), no_pol) as no_polisi FROM kendaraan ORDER BY nama",
    );
    const upcoming = await Q(
      `SELECT m.*, k.nama as kendaraan_nama FROM rental_maintenance m
       LEFT JOIN kendaraan k ON m.kendaraan_id=k.id
       WHERE m.next_service_tgl IS NOT NULL AND m.next_service_tgl != ''
         AND m.next_service_tgl <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       ORDER BY m.next_service_tgl LIMIT 20`,
    );
    const jenis_options = await Q("SELECT * FROM ref_option WHERE group_key='maintenance_jenis' AND aktif=1 ORDER BY label");
    return jsonOk(res, { rows, kendaraan, upcoming, jenis_options });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/maintenance', accessRequired('rental'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const mid = String(f.id || '').trim();

    // Parse semua nilai biaya dari frontend
    const biaya_servis = Number(f.biaya_servis) || 0;
    const biaya_total = Number(f.biaya) || 0;
    const biaya_fuel = Number(f.biaya_fuel) || 0;
    const biaya_tol = Number(f.biaya_tol) || 0;
    const biaya_konsumsi = Number(f.biaya_konsumsi) || 0;

    const jenis_val = String(f.jenis || '').trim();
    if (jenis_val) {
      const ex = await Q("SELECT id FROM ref_option WHERE group_key='maintenance_jenis' AND value=?", [jenis_val], true);
      if (!ex) {
        await X('INSERT IGNORE INTO ref_option(id,group_key,value,label,aktif) VALUES(?,?,?,?,1)', [uid(), 'maintenance_jenis', jenis_val, jenis_val]);
      }
    }

    const vals = [
      f.tgl || today(), f.jenis, f.deskripsi, biaya_servis, biaya_total, Number(f.km_saat_ini) || 0, Number(f.next_service_km) || 0,
      f.next_service_tgl || '', f.bengkel || '', f.catatan || '', biaya_fuel, biaya_tol,
      biaya_konsumsi, Number(f.liter_fuel) || 0, Number(f.km_per_liter) || 0,
    ];

    if (mid) {
      await X(
        `UPDATE rental_maintenance SET tgl=?,jenis=?,deskripsi=?,biaya_servis=?,biaya=?,km_saat_ini=?,
         next_service_km=?,next_service_tgl=?,bengkel=?,catatan=?,biaya_fuel=?,biaya_tol=?,biaya_konsumsi=?,liter_fuel=?,km_per_liter=? WHERE id=?`,
        [...vals, mid],
      );
    } else {
      await X(
        `INSERT INTO rental_maintenance (id,kendaraan_id,tgl,jenis,deskripsi,biaya_servis,biaya,
         km_saat_ini,next_service_km,next_service_tgl,bengkel,catatan,user_id,biaya_fuel,biaya_tol,biaya_konsumsi,liter_fuel,km_per_liter)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [uid(), f.kendaraan_id, ...vals, req.user.id],
      );
    }
    return jsonOk(res, {}, 'Data maintenance disimpan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/maintenance/delete/:mid', accessRequired('rental_maintenance'), asyncHandler(async (req, res) => {
  try {
    await X('DELETE FROM rental_maintenance WHERE id=?', [req.params.mid]);
    return jsonOk(res, {}, 'Data maintenance dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/dokumen', accessRequired('rental'), asyncHandler(async (req, res) => {
  try {
    const rows = await Q(
      `SELECT d.*, k.nama as kendaraan_nama, COALESCE(NULLIF(k.no_polisi,''), k.no_pol) as no_polisi
       FROM rental_dokumen d LEFT JOIN kendaraan k ON d.kendaraan_id=k.id ORDER BY d.tgl_expired`,
    );
    const expiring = await Q(
      `SELECT d.*, k.nama as kendaraan_nama FROM rental_dokumen d
       LEFT JOIN kendaraan k ON d.kendaraan_id=k.id
       WHERE d.tgl_expired IS NOT NULL AND d.tgl_expired != ''
         AND d.tgl_expired <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
       ORDER BY d.tgl_expired LIMIT 20`,
    );
    const kendaraan = await Q(
      "SELECT id,nama,COALESCE(NULLIF(no_polisi,''), no_pol) as no_polisi FROM kendaraan ORDER BY nama",
    );
    return jsonOk(res, { rows, expiring, kendaraan });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/dokumen', accessRequired('rental'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const did = String(f.id || '').trim();
    if (did) {
      await X(
        'UPDATE rental_dokumen SET kendaraan_id=?,jenis=?,no_dokumen=?,tgl_terbit=?,tgl_expired=?,catatan=? WHERE id=?',
        [f.kendaraan_id, f.jenis, f.no_dokumen, f.tgl_terbit, f.tgl_expired, f.catatan, did],
      );
    } else {
      await X(
        'INSERT INTO rental_dokumen (id,kendaraan_id,jenis,no_dokumen,tgl_terbit,tgl_expired,catatan) VALUES (?,?,?,?,?,?,?)',
        [uid(), f.kendaraan_id, f.jenis, f.no_dokumen, f.tgl_terbit, f.tgl_expired, f.catatan || ''],
      );
    }
    return jsonOk(res, {}, 'Dokumen disimpan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/biaya', accessRequired('rental'), asyncHandler(async (req, res) => {
  try {
    const rows = await Q(
      `SELECT b.*, k.nama as kendaraan_nama FROM rental_biaya_ops b
       LEFT JOIN kendaraan k ON b.kendaraan_id=k.id ORDER BY b.tgl DESC LIMIT 200`,
    );
    const kendaraan = await Q(
      "SELECT id,nama,COALESCE(NULLIF(no_polisi,''), no_pol) as no_polisi FROM kendaraan ORDER BY nama",
    );
    const summary = await Q(
      'SELECT jenis, COALESCE(SUM(nominal),0) as total FROM rental_biaya_ops WHERE substr(tgl,1,7)=? GROUP BY jenis',
      [today().slice(0, 7)],
    );
    return jsonOk(res, { rows, kendaraan, summary });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/biaya', accessRequired('rental'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    await X(
      'INSERT INTO rental_biaya_ops (id,rental_id,kendaraan_id,tgl,jenis,deskripsi,nominal,user_id) VALUES (?,?,?,?,?,?,?,?)',
      [uid(), f.rental_id || null, f.kendaraan_id, f.tgl || today(), f.jenis, f.deskripsi || '', Number(f.nominal) || 0, req.user.id],
    );
    return jsonOk(res, {}, 'Biaya operasional disimpan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
