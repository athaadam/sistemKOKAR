const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { Q, X, db } = require('../db');
const { uid, today, jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { getPrintHeader } = require('../utils/settings');
const { sendExport } = require('../utils/export');
const { audit } = require('../utils/audit');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('anggota'), asyncHandler(async (req, res) => {
  try {
    const { q = '', status = '', dept = '' } = req.query;
    let sql = 'SELECT * FROM anggota WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND (nama LIKE ? OR no LIKE ? OR nip LIKE ? OR nik LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status) {
      if (['keluar', 'pensiun', 'meninggal'].includes(status)) {
        sql += ' AND status_detail=?';
        params.push(status);
      } else {
        sql += ' AND status=?';
        params.push(status);
      }
    }
    if (dept) {
      sql += ' AND dept=?';
      params.push(dept);
    }
    const rows = await Q(sql + ' ORDER BY no', params);
    for (const r of rows) {
      const p = await Q('SELECT saldo FROM piutang WHERE anggota_id=?', [r.id], true);
      r.piutang = p?.saldo ?? 0;
      const s = await Q(
        'SELECT COALESCE(SUM(saldo),0) as t FROM simpanan WHERE anggota_id=?',
        [r.id],
        true,
      );
      r.total_simpanan = s?.t ?? 0;
      const ln = await Q(
        "SELECT COUNT(*) as c FROM pinjaman WHERE anggota_id=? AND status='aktif'",
        [r.id],
        true,
      );
      r.pinjaman_aktif = ln?.c ?? 0;
    }
    const depts = await Q(
      'SELECT DISTINCT dept FROM anggota WHERE dept IS NOT NULL ORDER BY dept',
    );
    const master_jabatan = await Q(
      "SELECT * FROM ref_option WHERE group_key='jabatan' AND aktif=1 ORDER BY label",
    );
    const master_dept = await Q(
      "SELECT * FROM ref_option WHERE group_key='departemen' AND aktif=1 ORDER BY label",
    );
    return jsonOk(res, { rows, depts, master_jabatan, master_dept, q, status, dept });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/save', accessRequired('anggota'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const aid = String(f.id || '').trim();
    const nama = String(f.nama || '').trim();
    if (!nama) return jsonErr(res, 'Nama wajib diisi');

    const data = {
      no: String(f.no || f.no_existing || '').trim(),
      nip: f.nip || '',
      nama,
      nik: f.nik || '',
      dept: f.dept || '',
      jabatan: f.jabatan || '',
      no_hp: f.no_hp || '',
      gaji: Number(f.gaji) || 0,
      tgl_masuk: f.tgl_masuk || '',
      tgl_lahir: f.tgl_lahir || '',
      alamat: f.alamat || f.alamat_lengkap || '',
      kontak_darurat: '',
      telp_darurat: '',
      status: f.status || 'aktif',
      status_detail: f.status_detail || f.status || 'aktif',
      tgl_keluar: f.tgl_keluar || '',
      alasan_keluar: f.alasan_keluar || '',
      limit_kredit: Number(f.limit_kredit) || 3000000,
      limit_pinjaman: Number(f.limit_pinjaman) || 20000000,
      limit_darurat: Number(f.limit_darurat) || 5000000,
      max_loans: Number(f.max_loans) || 5,
      no_rek: f.no_rek || '',
      nama_bank: f.nama_bank || '',
    };

    if (['keluar', 'pensiun', 'meninggal'].includes(data.status_detail)) {
      data.status = 'non-aktif';
      if (!data.tgl_keluar) data.tgl_keluar = today();
    }

    if (aid) {
      const old = await Q('SELECT * FROM anggota WHERE id=?', [aid], true);
      await X(
        `UPDATE anggota SET no=?,nip=?,nama=?,nik=?,dept=?,jabatan=?,no_hp=?,gaji=?,
         tgl_masuk=?,tgl_lahir=?,alamat=?,kontak_darurat=?,telp_darurat=?,status=?,status_detail=?,
         tgl_keluar=?,alasan_keluar=?,limit_kredit=?,limit_pinjaman=?,limit_darurat=?,max_loans=?,
         no_rek=?,nama_bank=? WHERE id=?`,
        [
          data.no || old?.no || '',
          data.nip,
          data.nama,
          data.nik,
          data.dept,
          data.jabatan,
          data.no_hp,
          data.gaji,
          data.tgl_masuk,
          data.tgl_lahir,
          data.alamat,
          data.kontak_darurat,
          data.telp_darurat,
          data.status,
          data.status_detail,
          data.tgl_keluar,
          data.alasan_keluar,
          data.limit_kredit,
          data.limit_pinjaman,
          data.limit_darurat,
          data.max_loans,
          data.no_rek,
          data.nama_bank,
          aid,
        ],
      );
      await audit('anggota', 'update', 'anggota', aid, old, data, `Update anggota ${nama}`);
      return jsonOk(res, {}, `Data anggota ${nama} diperbarui`);
    }

    if (!data.no) {
      const cnt = await Q('SELECT COUNT(*) as c FROM anggota', [], true);
      data.no = `A-${String((cnt?.c || 0) + 1).padStart(4, '0')}`;
    }
    if (await Q('SELECT id FROM anggota WHERE no=?', [data.no], true)) {
      return jsonErr(res, `Nomor anggota ${data.no} sudah ada`);
    }
    const aidNew = uid();
    await X(
      `INSERT INTO anggota (id,no,nip,nama,nik,dept,jabatan,no_hp,gaji,tgl_masuk,tgl_lahir,alamat,
       kontak_darurat,telp_darurat,status,status_detail,tgl_keluar,alasan_keluar,limit_kredit,limit_pinjaman,
       limit_darurat,max_loans,no_rek,nama_bank) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        aidNew,
        data.no,
        data.nip,
        data.nama,
        data.nik,
        data.dept,
        data.jabatan,
        data.no_hp,
        data.gaji,
        data.tgl_masuk,
        data.tgl_lahir,
        data.alamat,
        data.kontak_darurat,
        data.telp_darurat,
        data.status,
        data.status_detail,
        data.tgl_keluar,
        data.alasan_keluar,
        data.limit_kredit,
        data.limit_pinjaman,
        data.limit_darurat,
        data.max_loans,
        data.no_rek,
        data.nama_bank,
      ],
    );
    await audit('anggota', 'create', 'anggota', aidNew, null, data, `Buat anggota ${nama}`);
    return jsonOk(res, { id: aidNew }, `Anggota ${nama} (${data.no}) ditambahkan`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/:aid', accessRequired('anggota'), asyncHandler(async (req, res) => {
  try {
    const aid = req.params.aid;
    await db.transaction(async (trx) => {
      const pinIds = (
        await trx.raw('SELECT id FROM pinjaman WHERE anggota_id=?', [aid])
      )[0];
      const pjIds = (
        await trx.raw('SELECT id FROM penjualan WHERE anggota_id=?', [aid])
      )[0];
      for (const row of pinIds) {
        await trx.raw('DELETE FROM pinjaman_bayar WHERE pinjaman_id=?', [row.id]);
      }
      await trx.raw('DELETE FROM pinjaman WHERE anggota_id=?', [aid]);
      await trx.raw('DELETE FROM simpanan_trx WHERE anggota_id=?', [aid]);
      await trx.raw('DELETE FROM simpanan WHERE anggota_id=?', [aid]);
      await trx.raw('DELETE FROM piutang WHERE anggota_id=?', [aid]);
      for (const row of pjIds) {
        await trx.raw('DELETE FROM penjualan_item WHERE penjualan_id=?', [row.id]);
      }
      await trx.raw('DELETE FROM penjualan WHERE anggota_id=?', [aid]);
      await trx.raw('DELETE FROM anggota WHERE id=?', [aid]);
    });
    return jsonOk(res, {}, 'Anggota dan seluruh data terkait dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('anggota'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'csv';
    const rows = await Q(
      'SELECT no,nip,nama,nik,dept,jabatan,no_hp,gaji,limit_kredit,limit_pinjaman,limit_darurat,max_loans,status,tgl_masuk FROM anggota ORDER BY no',
    );
    const cols = [
      'no', 'nip', 'nama', 'nik', 'dept', 'jabatan', 'no_hp', 'gaji', 'limit_kredit',
      'limit_pinjaman', 'limit_darurat', 'max_loans', 'status', 'tgl_masuk',
    ];
    return sendExport(fmt, rows, cols, 'Data Anggota', 'anggota.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/import', accessRequired('anggota'), upload.single('file'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) return jsonErr(res, 'Pilih file');
    const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const reader = parse(content, { columns: true, skip_empty_lines: true });
    let cnt = 0;
    for (const row of reader) {
      const nama = String(row.nama || '').trim();
      let no = String(row.no || '').trim();
      if (!nama) continue;
      if (!no) {
        const c = await Q('SELECT COUNT(*) as c FROM anggota', [], true);
        no = `A-${String((c?.c || 0) + 1).padStart(4, '0')}`;
      }
      await X(
        `INSERT IGNORE INTO anggota (id,no,nip,nama,nik,dept,jabatan,no_hp,gaji,status,
         limit_kredit,limit_pinjaman,limit_darurat,max_loans) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uid(),
          no,
          row.nip || '',
          nama,
          row.nik || '',
          row.dept || '',
          row.jabatan || '',
          row.no_hp || '',
          Number(row.gaji) || 0,
          row.status || 'aktif',
          Number(row.limit_kredit) || 3000000,
          Number(row.limit_pinjaman) || 20000000,
          Number(row.limit_darurat) || 5000000,
          Number(row.max_loans) || 5,
        ],
      );
      cnt++;
    }
    return jsonOk(res, { count: cnt }, `${cnt} anggota berhasil diimport`);
  } catch (e) {
    return jsonErr(res, `Error import: ${e.message}`, 500);
  }
}));

router.get('/print', accessRequired('anggota'), asyncHandler(async (req, res) => {
  try {
    const { q = '', status = '', dept = '' } = req.query;
    let sql = 'SELECT * FROM anggota WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND (nama LIKE ? OR no LIKE ? OR nip LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status) {
      sql += ' AND status=?';
      params.push(status);
    }
    if (dept) {
      sql += ' AND dept=?';
      params.push(dept);
    }
    const rows = await Q(sql + ' ORDER BY no', params);
    for (const r of rows) {
      const s = await Q(
        'SELECT COALESCE(SUM(saldo),0) as t FROM simpanan WHERE anggota_id=?',
        [r.id],
        true,
      );
      r.total_simpanan = s?.t ?? 0;
    }
    const hdr = await getPrintHeader();
    return jsonOk(res, { rows, hdr, dept, status });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
