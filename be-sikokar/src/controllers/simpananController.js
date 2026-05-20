const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { Q, X } = require('../db');
const { uid, today, jsonOk, jsonErr, fmtRp } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { getSetting } = require('../utils/settings');
const { sendExport } = require('../utils/export');
const { audit } = require('../utils/audit');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('simpanan'), asyncHandler(async (req, res) => {
  try {
    const { q = '' } = req.query;
    let sql = 'SELECT * FROM anggota WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND (nama LIKE ? OR no LIKE ? OR nip LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const anggota_list = await Q(sql + ' ORDER BY no', params);
    for (const a of anggota_list) {
      const saldos = await Q('SELECT jenis,saldo FROM simpanan WHERE anggota_id=?', [a.id]);
      a.saldo = Object.fromEntries(saldos.map((s) => [s.jenis, s.saldo]));
      a.total_simpanan = saldos.reduce((s, x) => s + Number(x.saldo || 0), 0);
    }
    const total_all = (await Q('SELECT COALESCE(SUM(saldo),0) as t FROM simpanan', [], true))?.t ?? 0;
    const total_by_jenis = await Q('SELECT jenis,COALESCE(SUM(saldo),0) as t FROM simpanan GROUP BY jenis');
    return jsonOk(res, { anggota_list, q, total_all, total_by_jenis });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/trx', accessRequired('simpanan'), asyncHandler(async (req, res) => {
  try {
    const { tgl_from = '', tgl_to = '', tipe = '' } = req.query;
    let sql = `SELECT t.*,a.nama as anggota_nama,a.nip FROM simpanan_trx t
      LEFT JOIN anggota a ON t.anggota_id=a.id WHERE 1=1`;
    const params = [];
    if (tgl_from) { sql += ' AND t.tgl>=?'; params.push(tgl_from); }
    if (tgl_to) { sql += ' AND t.tgl<=?'; params.push(tgl_to); }
    if (tipe) { sql += ' AND t.tipe=?'; params.push(tipe); }
    const rows = await Q(sql + ' ORDER BY t.created_at DESC LIMIT 500', params);
    const anggota_list = await Q("SELECT id,no,nama FROM anggota WHERE status='aktif' ORDER BY nama");
    return jsonOk(res, { rows, tgl_from, tgl_to, tipe, anggota_list });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/save', accessRequired('simpanan'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const anggota_id = f.anggota_id;
    const jenis = f.jenis || 'sukarela';
    const tipe = f.tipe || 'setor';
    const nominal = Number(f.nominal) || 0;
    const tgl = f.tgl || today();
    const metode = f.metode || 'tunai';
    let ket = f.ket || '';

    if (!anggota_id || !nominal) return jsonErr(res, 'Isi semua field');

    if (tipe === 'tarik') {
      const cur = await Q('SELECT saldo FROM simpanan WHERE anggota_id=? AND jenis=?', [anggota_id, jenis], true);
      if (!cur || cur.saldo < nominal) return jsonErr(res, `Saldo ${jenis} tidak cukup`);
    }

    if (tipe === 'setor') {
      const existing = await Q('SELECT id FROM simpanan WHERE anggota_id=? AND jenis=?', [anggota_id, jenis], true);
      if (existing) {
        await X(
          "UPDATE simpanan SET saldo=saldo+?,updated_at=datetime('now','localtime') WHERE anggota_id=? AND jenis=?",
          [nominal, anggota_id, jenis],
        );
      } else {
        await X('INSERT INTO simpanan (id,anggota_id,jenis,saldo) VALUES (?,?,?,?)', [uid(), anggota_id, jenis, nominal]);
      }
    } else {
      await X(
        "UPDATE simpanan SET saldo=saldo-?,updated_at=datetime('now','localtime') WHERE anggota_id=? AND jenis=?",
        [nominal, anggota_id, jenis],
      );
    }

    const ang = await Q('SELECT nama FROM anggota WHERE id=?', [anggota_id], true);
    const no = `SMP-${tgl.replace(/-/g, '')}-${uid().slice(0, 4)}`;
    if (!ket) ket = `${tipe === 'setor' ? 'Setoran' : 'Penarikan'} ${jenis} ${ang?.nama || ''}`;
    await X(
      'INSERT INTO simpanan_trx (id,no,tgl,anggota_id,jenis,tipe,nominal,metode,ket,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uid(), no, tgl, anggota_id, jenis, tipe, nominal, metode, ket, req.session.user.id],
    );
    return jsonOk(res, {}, `${tipe === 'setor' ? 'Setoran' : 'Penarikan'} ${fmtRp(nominal)} berhasil`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('simpanan'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'csv';
    const rows = await Q(
      `SELECT a.no,a.nip,a.nama,a.dept,
        COALESCE((SELECT saldo FROM simpanan WHERE anggota_id=a.id AND jenis='pokok'),0) as pokok,
        COALESCE((SELECT saldo FROM simpanan WHERE anggota_id=a.id AND jenis='wajib'),0) as wajib,
        COALESCE((SELECT saldo FROM simpanan WHERE anggota_id=a.id AND jenis='sukarela'),0) as sukarela
        FROM anggota a ORDER BY a.no`,
    );
    for (const r of rows) r.total = Number(r.pokok) + Number(r.wajib) + Number(r.sukarela);
    const cols = ['no', 'nip', 'nama', 'dept', 'pokok', 'wajib', 'sukarela', 'total'];
    return sendExport(fmt, rows, cols, 'Data Simpanan', 'simpanan.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/import', accessRequired('simpanan'), upload.single('file'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) return jsonErr(res, 'Pilih file');
    const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const reader = parse(content, { columns: true, skip_empty_lines: true });
    let cnt = 0;
    for (const row of reader) {
      const a = await Q('SELECT id FROM anggota WHERE no=? OR nip=?', [row.no || '', row.nip || ''], true);
      if (!a) continue;
      for (const jenis of ['pokok', 'wajib', 'sukarela']) {
        const saldo = Number(row[jenis]) || 0;
        if (saldo > 0) {
          const existing = await Q('SELECT id FROM simpanan WHERE anggota_id=? AND jenis=?', [a.id, jenis], true);
          if (existing) {
            await X('UPDATE simpanan SET saldo=? WHERE anggota_id=? AND jenis=?', [saldo, a.id, jenis]);
          } else {
            await X('INSERT INTO simpanan (id,anggota_id,jenis,saldo) VALUES (?,?,?,?)', [uid(), a.id, jenis, saldo]);
          }
        }
      }
      cnt++;
    }
    return jsonOk(res, { count: cnt }, `${cnt} data simpanan diimport`);
  } catch (e) {
    return jsonErr(res, `Error: ${e.message}`, 500);
  }
}));

router.get('/setor_massal', accessRequired('simpanan'), asyncHandler(async (req, res) => {
  try {
    const bulan = req.query.bulan || today().slice(0, 7);
    const anggota_list = await Q("SELECT id,no,nip,nama,dept FROM anggota WHERE status='aktif' ORDER BY no");
    for (const a of anggota_list) {
      const saldos = await Q('SELECT jenis,saldo FROM simpanan WHERE anggota_id=?', [a.id]);
      a.saldo = Object.fromEntries(saldos.map((s) => [s.jenis, s.saldo]));
    }
    return jsonOk(res, { anggota_list, bulan });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/setor_massal/proses', accessRequired('simpanan'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const bulan = f.bulan || today().slice(0, 7);
    const tgl = f.tgl || today();
    const metode = f.metode || 'potong-gaji';
    const anggota_ids = [].concat(f['anggota_id[]'] || f.anggota_id || []);
    const pokoks = [].concat(f['pokok[]'] || f.pokok || []);
    const wajibs = [].concat(f['wajib[]'] || f.wajib || []);
    const sukarelaes = [].concat(f['sukarela[]'] || f.sukarela || []);

    let ok = 0;
    for (let i = 0; i < anggota_ids.length; i++) {
      const aid = anggota_ids[i];
      if (!aid) continue;
      const pokok = Number(pokoks[i]) || 0;
      const wajib = Number(wajibs[i]) || 0;
      const sukarela = Number(sukarelaes[i]) || 0;
      const ang = await Q('SELECT nama FROM anggota WHERE id=?', [aid], true);
      const nama = ang?.nama || '';

      for (const [jenis, nominal] of [['pokok', pokok], ['wajib', wajib], ['sukarela', sukarela]]) {
        if (nominal <= 0) continue;
        const existing = await Q('SELECT id FROM simpanan WHERE anggota_id=? AND jenis=?', [aid, jenis], true);
        if (existing) {
          await X(
            "UPDATE simpanan SET saldo=saldo+?,updated_at=datetime('now','localtime') WHERE anggota_id=? AND jenis=?",
            [nominal, aid, jenis],
          );
        } else {
          await X('INSERT INTO simpanan (id,anggota_id,jenis,saldo) VALUES (?,?,?,?)', [uid(), aid, jenis, nominal]);
        }
        const no = `SMP-${tgl.replace(/-/g, '')}-${uid().slice(0, 4)}`;
        await X(
          'INSERT INTO simpanan_trx (id,no,tgl,anggota_id,jenis,tipe,nominal,metode,ket,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [uid(), no, tgl, aid, jenis, 'setor', nominal, metode, `Setoran massal ${jenis} ${nama} bln ${bulan}`, req.session.user.id],
        );
      }
      ok++;
    }
    return jsonOk(res, { count: ok }, `Setor massal berhasil: ${ok} anggota diproses`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/jasa', accessRequired('simpanan'), asyncHandler(async (req, res) => {
  try {
    const rate = Number(await getSetting('bunga_jasa_simpanan_pct', '3'));
    const history = await Q(
      `SELECT j.*, a.nama as anggota_nama, a.no as anggota_no
       FROM simpanan_jasa j LEFT JOIN anggota a ON j.anggota_id=a.id
       ORDER BY j.periode DESC, j.created_at DESC LIMIT 200`,
    );
    return jsonOk(res, { history, rate });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/jasa', accessRequired('simpanan'), asyncHandler(async (req, res) => {
  try {
    const periode = req.body.periode || today().slice(0, 4);
    let rate = Number(req.body.rate_pct) || Number(await getSetting('bunga_jasa_simpanan_pct', '3'));
    const anggota_list = await Q("SELECT id,no,nama FROM anggota WHERE status='aktif'");
    let ok = 0;
    for (const a of anggota_list) {
      const saldoRow = await Q(
        "SELECT COALESCE(SUM(saldo),0) as t FROM simpanan WHERE anggota_id=? AND jenis='sukarela'",
        [a.id],
        true,
      );
      const saldo = saldoRow?.t ?? 0;
      if (saldo <= 0) continue;
      const jasa = Math.round(saldo * rate / 100);
      const no = `JSS-${periode}-${a.no}`;
      const existing = await Q('SELECT id FROM simpanan_jasa WHERE no=?', [no], true);
      if (existing) continue;
      await X(
        'INSERT INTO simpanan_jasa (id,no,periode,anggota_id,saldo_rata,rate_pct,jasa,tgl,user_id) VALUES (?,?,?,?,?,?,?,?,?)',
        [uid(), no, periode, a.id, saldo, rate, jasa, today(), req.session.user.id],
      );
      await X("UPDATE simpanan SET saldo=saldo+? WHERE anggota_id=? AND jenis='sukarela'", [jasa, a.id]);
      await X(
        'INSERT INTO simpanan_trx (id,no,tgl,anggota_id,jenis,tipe,nominal,metode,ket,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [uid(), no, today(), a.id, 'sukarela', 'setor', jasa, 'jasa-simpanan', `Bunga jasa simpanan ${periode} (${rate}%)`, req.session.user.id],
      );
      ok++;
    }
    await audit('simpanan', 'jasa_distribute', 'simpanan_jasa', '', null, { periode, rate, count: ok }, `Distribusi jasa ${periode}`);
    return jsonOk(res, { count: ok }, `Berhasil distribusi jasa simpanan ke ${ok} anggota`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
