const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { Q, X, Xfk } = require('../db');
const { uid, today, jsonOk, jsonErr, fmtRp } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const {
  getBungaRegular, getBungaDarurat, getRegMax, getDarMax, getDarPerAjuan, getDarMaxAktif, getPrintHeader,
} = require('../utils/settings');
const { sendExport } = require('../utils/export');
const { audit } = require('../utils/audit');
const { getKreditAnggota } = require('./kreditController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

async function buildSlipData(a, bulan) {
  const tgl_from = `${bulan}-01`;
  const tgl_to = `${bulan}-31`;
  const aid = a.id;
  const toko_rows = await Q(
    `SELECT l.nama as lokasi_nama, COALESCE(SUM(p.total),0) as jumlah
     FROM penjualan p LEFT JOIN lokasi l ON p.lokasi_id=l.id
     WHERE p.anggota_id=? AND p.jenis='kredit' AND p.tgl>=? AND p.tgl<=?
     GROUP BY p.lokasi_id`,
    [aid, tgl_from, tgl_to],
  );
  const total_toko = toko_rows.reduce((s, r) => s + Number(r.jumlah || 0), 0);
  const sm_p = await Q("SELECT COALESCE(saldo,0) as t FROM simpanan WHERE anggota_id=? AND jenis='pokok'", [aid], true);
  const sm_w = await Q("SELECT COALESCE(saldo,0) as t FROM simpanan WHERE anggota_id=? AND jenis='wajib'", [aid], true);
  const sm_s = await Q("SELECT COALESCE(saldo,0) as t FROM simpanan WHERE anggota_id=? AND jenis='sukarela'", [aid], true);
  const sm_pokok = sm_p?.t ?? 0;
  const sm_wajib = sm_w?.t ?? 0;
  const sm_sukarela = sm_s?.t ?? 0;
  const simpanan_rows = [
    { label: 'SIMPANAN POKOK', jumlah: sm_pokok },
    { label: 'SIMPANAN WAJIB', jumlah: sm_wajib },
    { label: 'SIMPANAN SUKARELA', jumlah: sm_sukarela },
  ];
  const total_simpanan = sm_pokok + sm_wajib + sm_sukarela;
  const pinjaman_rows = await Q(
    `SELECT p.*,(SELECT COUNT(*) FROM pinjaman_bayar WHERE pinjaman_id=p.id) as cicilan_ke
     FROM pinjaman p WHERE p.anggota_id=? AND p.status='aktif' ORDER BY p.tgl_cair`,
    [aid],
  );
  const total_angsuran = pinjaman_rows.reduce((s, r) => s + Number(r.angsuran || 0), 0);
  const piutang = await Q('SELECT COALESCE(saldo,0) as t FROM piutang WHERE anggota_id=?', [aid], true);
  const tung_pin = await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t FROM pinjaman WHERE anggota_id=? AND status='macet'", [aid], true);
  const tunggakan_toko = piutang?.t ?? 0;
  const tunggakan_pin = tung_pin?.t ?? 0;
  const kredit = await getKreditAnggota(aid);
  const pinjaman_regular = await Q(
    `SELECT *,(SELECT COUNT(*) FROM pinjaman_bayar WHERE pinjaman_id=pinjaman.id) as cicilan_ke
     FROM pinjaman WHERE anggota_id=? AND jenis='regular' AND status='aktif' ORDER BY tgl_cair`,
    [aid],
  );
  const pinjaman_darurat = await Q(
    `SELECT *,(SELECT COUNT(*) FROM pinjaman_bayar WHERE pinjaman_id=pinjaman.id) as cicilan_ke
     FROM pinjaman WHERE anggota_id=? AND jenis='darurat' AND status='aktif' ORDER BY tgl_cair`,
    [aid],
  );
  const total_potongan = total_toko + total_simpanan + total_angsuran + tunggakan_pin + tunggakan_toko;
  return {
    a, bulan, toko_rows, total_toko, simpanan_rows, total_simpanan, pinjaman_rows, total_angsuran,
    pinjaman_regular, pinjaman_darurat, kredit, tunggakan_pin, tunggakan_toko, total_potongan,
  };
}

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const { status = '', q = '' } = req.query;
    let sql = `SELECT p.*,a.nama as anggota_nama,a.nip,a.no as anggota_no FROM pinjaman p
      LEFT JOIN anggota a ON p.anggota_id=a.id WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND p.status=?'; params.push(status); }
    if (q) {
      sql += ' AND (p.no LIKE ? OR a.nama LIKE ? OR a.nip LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const rows = await Q(sql + ' ORDER BY p.tgl_pengajuan DESC LIMIT 300', params);
    const anggota_list = await Q(
      "SELECT id,no,nama,limit_pinjaman,limit_darurat,max_loans FROM anggota WHERE status='aktif' ORDER BY nama",
    );
    const total_outstanding = (await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t FROM pinjaman WHERE status='aktif'", [], true))?.t ?? 0;
    const total_angsuran_bln = (await Q("SELECT COALESCE(SUM(angsuran),0) as t FROM pinjaman WHERE status='aktif'", [], true))?.t ?? 0;
    const bunga_reg = await getBungaRegular();
    const bunga_dar = await getBungaDarurat();
    return jsonOk(res, {
      rows, status, q, anggota_list, total_outstanding, total_angsuran_bln, bunga_reg, bunga_dar,
    });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/ajukan', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const anggota_id = f.anggota_id;
    const jenis = f.jenis || 'regular';
    const nominal = Number(f.nominal) || 0;
    const tenor = Number(f.tenor) || 12;
    const tgl_pengajuan = f.tgl_pengajuan || today();
    const tgl_cair = f.tgl_cair || today();
    const rate_type = f.rate_type || 'flat';

    const ang = await Q('SELECT * FROM anggota WHERE id=?', [anggota_id], true);
    if (!ang) return jsonErr(res, 'Anggota tidak ditemukan');

    if (jenis === 'regular') {
      const aktif_reg = (await Q(
        "SELECT COUNT(*) as c FROM pinjaman WHERE anggota_id=? AND jenis='regular' AND status='aktif'",
        [anggota_id],
        true,
      ))?.c ?? 0;
      if (aktif_reg > 0) return jsonErr(res, 'Pinjaman regular masih aktif — harus lunas/pelunasan dahulu sebelum mengajukan kembali');
      const regMax = await getRegMax();
      if (nominal > regMax) return jsonErr(res, `Melebihi batas pinjaman regular (${fmtRp(regMax)})`);
    } else if (jenis === 'darurat') {
      const aktif_dar = await Q(
        "SELECT COUNT(*) as c, COALESCE(SUM(sisa_pokok),0) as total FROM pinjaman WHERE anggota_id=? AND jenis='darurat' AND status='aktif'",
        [anggota_id],
        true,
      );
      const darMaxAktif = await getDarMaxAktif();
      if ((aktif_dar?.c ?? 0) >= darMaxAktif) {
        return jsonErr(res, `Pinjaman darurat aktif sudah maksimal (${darMaxAktif}x) — harus lunas dahulu`);
      }
      const darPer = await getDarPerAjuan();
      if (nominal > darPer) return jsonErr(res, `Maks pinjaman darurat per pengajuan adalah ${fmtRp(darPer)}`);
      const darMax = await getDarMax();
      if ((aktif_dar?.total ?? 0) + nominal > darMax) {
        const sisa_bisa = Math.max(0, darMax - (aktif_dar?.total ?? 0));
        return jsonErr(res, `Total pinjaman darurat akan melebihi ${fmtRp(darMax)}. Maksimal bisa diajukan: ${fmtRp(sisa_bisa)}`);
      }
    }

    const bunga = jenis === 'darurat' ? await getBungaDarurat() : await getBungaRegular();
    let angsuran;
    if (rate_type === 'sliding') {
      angsuran = Math.round(nominal / tenor + nominal * bunga / 100);
    } else {
      angsuran = Math.round(nominal * (1 + bunga / 100 * tenor) / tenor);
    }
    const no = `PIN-${tgl_pengajuan.replace(/-/g, '')}-${uid().slice(0, 3)}`;
    await X(
      `INSERT INTO pinjaman (id,no,anggota_id,jenis,nominal,disetujui,tenor,bunga,angsuran,sisa_pokok,status,tgl_pengajuan,tgl_cair,user_id,rate_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uid(), no, anggota_id, jenis, nominal, nominal, tenor, bunga, angsuran, nominal, 'aktif', tgl_pengajuan, tgl_cair, req.session.user.id, rate_type],
    );
    await X(
      'INSERT INTO jurnal (id,no,tgl,modul,ref,ket,debit,kredit,nominal,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uid(), `JRN-${uid()}`, tgl_cair, 'Simpan Pinjam', no, `Pencairan ${jenis} ${ang.nama}`, 'Piutang Pinjaman', 'Kas', nominal, req.session.user.id],
    );
    await audit('pinjaman', 'create', 'pinjaman', '', null, { no, nominal, rate_type }, 'Pengajuan pinjaman');
    return jsonOk(res, { no }, `${no} — ${fmtRp(nominal)} berhasil dicairkan (bunga ${bunga}%/bln, ${rate_type}, angsuran awal ${fmtRp(angsuran)}/bln)`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/bayar/:pin_id', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const pin_id = req.params.pin_id;
    const pin = await Q('SELECT * FROM pinjaman WHERE id=?', [pin_id], true);
    if (!pin) return jsonErr(res, 'Pinjaman tidak ditemukan');
    const tgl = req.body.tgl || today();
    const metode = req.body.metode || 'tunai';
    const sisa_baru = Math.max(0, pin.sisa_pokok - pin.angsuran);
    const status_baru = sisa_baru <= 0 ? 'lunas' : 'aktif';
    await X('UPDATE pinjaman SET sisa_pokok=?,status=? WHERE id=?', [sisa_baru, status_baru, pin_id]);
    await X(
      'INSERT INTO pinjaman_bayar (id,pinjaman_id,tgl,nominal,metode,user_id) VALUES (?,?,?,?,?,?)',
      [uid(), pin_id, tgl, pin.angsuran, metode, req.session.user.id],
    );
    return jsonOk(res, {}, `Angsuran ${fmtRp(pin.angsuran)} berhasil — sisa ${fmtRp(sisa_baru)}`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/lunas/:pin_id', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    await X("UPDATE pinjaman SET sisa_pokok=0,status='lunas' WHERE id=?", [req.params.pin_id]);
    return jsonOk(res, {}, 'Pinjaman dilunasi');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/delete/:pin_id', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const pin_id = req.params.pin_id;
    await Xfk([
      ['DELETE FROM pinjaman_bayar WHERE pinjaman_id=?', [pin_id]],
      ['DELETE FROM pinjaman WHERE id=?', [pin_id]],
    ]);
    return jsonOk(res, {}, 'Pinjaman dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'csv';
    const rows = await Q(
      `SELECT p.no,p.tgl_pengajuan,p.tgl_cair,a.nama,a.nip,p.jenis,p.nominal,p.tenor,p.bunga,p.angsuran,p.sisa_pokok,p.status
       FROM pinjaman p LEFT JOIN anggota a ON p.anggota_id=a.id ORDER BY p.tgl_pengajuan DESC`,
    );
    const cols = ['no', 'tgl_pengajuan', 'tgl_cair', 'nama', 'nip', 'jenis', 'nominal', 'tenor', 'bunga', 'angsuran', 'sisa_pokok', 'status'];
    return sendExport(fmt, rows, cols, 'Data Pinjaman', 'pinjaman.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/import', accessRequired('pinjaman'), upload.single('file'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) return jsonErr(res, 'Pilih file');
    const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const reader = parse(content, { columns: true, skip_empty_lines: true });
    let cnt = 0;
    for (const row of reader) {
      const a = await Q('SELECT id FROM anggota WHERE nip=?', [row.nip || ''], true);
      if (!a) continue;
      await X(
        `INSERT IGNORE INTO pinjaman (id,no,anggota_id,jenis,nominal,disetujui,tenor,bunga,angsuran,sisa_pokok,status,tgl_pengajuan,tgl_cair) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uid(), row.no || `PIN-${uid().slice(0, 8)}`, a.id, row.jenis || 'regular',
          Number(row.nominal) || 0, Number(row.nominal) || 0, Number(row.tenor) || 12,
          Number(row.bunga) || 1.5, Number(row.angsuran) || 0, Number(row.sisa_pokok) || 0,
          row.status || 'aktif', row.tgl_pengajuan || today(), row.tgl_cair || today(),
        ],
      );
      cnt++;
    }
    return jsonOk(res, { count: cnt }, `${cnt} pinjaman diimport`);
  } catch (e) {
    return jsonErr(res, `Error: ${e.message}`, 500);
  }
}));

router.post('/topup/:pid', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const pid = req.params.pid;
    const p = await Q('SELECT * FROM pinjaman WHERE id=?', [pid], true);
    if (!p || p.status !== 'aktif') return jsonErr(res, 'Pinjaman tidak aktif');
    const f = req.body;
    const tambahan = Number(f.tambahan) || 0;
    const tenor_baru = Number(f.tenor_baru) || p.tenor;
    const bunga = p.bunga;
    const nominal_baru = p.sisa_pokok + tambahan;
    if (p.jenis === 'regular' && nominal_baru > (await getRegMax())) {
      return jsonErr(res, `Total melebihi batas pinjaman regular (${fmtRp(await getRegMax())})`);
    }
    const angsuran_baru = Math.round(nominal_baru * (1 + bunga / 100 * tenor_baru) / tenor_baru);
    await X(
      `INSERT INTO pinjaman_history (id,pinjaman_id,aksi,tgl,nominal_lama,nominal_baru,
       tenor_lama,tenor_baru,angsuran_lama,angsuran_baru,bunga_lama,bunga_baru,keterangan,user_id)
       VALUES (?,?,'topup',?,?,?,?,?,?,?,?,?,?,?)`,
      [uid(), pid, today(), p.sisa_pokok, nominal_baru, p.tenor, tenor_baru, p.angsuran, angsuran_baru, bunga, bunga, f.keterangan || '', req.session.user.id],
    );
    await X('UPDATE pinjaman SET sisa_pokok=?,nominal=nominal+?,tenor=?,angsuran=? WHERE id=?', [nominal_baru, tambahan, tenor_baru, angsuran_baru, pid]);
    await X(
      'INSERT INTO jurnal (id,no,tgl,modul,ref,ket,debit,kredit,nominal,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uid(), `JRN-${uid().slice(0, 8)}`, today(), 'Simpan Pinjam', p.no, `Top-up pinjaman ${p.no}`, 'Piutang Pinjaman', 'Kas', tambahan, req.session.user.id],
    );
    await audit('pinjaman', 'topup', 'pinjaman', pid, { sisa: p.sisa_pokok, tenor: p.tenor }, { sisa: nominal_baru, tenor: tenor_baru }, 'Top-up pinjaman');
    return jsonOk(res, {}, `Top-up berhasil — Sisa pokok: ${fmtRp(nominal_baru)}, Angsuran: ${fmtRp(angsuran_baru)}/bln`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/restrukturisasi/:pid', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const pid = req.params.pid;
    const p = await Q('SELECT * FROM pinjaman WHERE id=?', [pid], true);
    if (!p || p.status !== 'aktif') return jsonErr(res, 'Pinjaman tidak aktif');
    const f = req.body;
    const tenor_baru = Number(f.tenor_baru) || p.tenor;
    const bunga_baru = Number(f.bunga_baru) || p.bunga;
    const angsuran_baru = Math.round(p.sisa_pokok * (1 + bunga_baru / 100 * tenor_baru) / tenor_baru);
    await X(
      `INSERT INTO pinjaman_history (id,pinjaman_id,aksi,tgl,nominal_lama,nominal_baru,
       tenor_lama,tenor_baru,angsuran_lama,angsuran_baru,bunga_lama,bunga_baru,keterangan,user_id)
       VALUES (?,?,'restrukturisasi',?,?,?,?,?,?,?,?,?,?,?)`,
      [uid(), pid, today(), p.sisa_pokok, p.sisa_pokok, p.tenor, tenor_baru, p.angsuran, angsuran_baru, p.bunga, bunga_baru, f.keterangan || '', req.session.user.id],
    );
    await X('UPDATE pinjaman SET tenor=?,bunga=?,angsuran=? WHERE id=?', [tenor_baru, bunga_baru, angsuran_baru, pid]);
    await audit('pinjaman', 'restrukturisasi', 'pinjaman', pid, { tenor: p.tenor, bunga: p.bunga }, { tenor: tenor_baru, bunga: bunga_baru }, 'Restrukturisasi');
    return jsonOk(res, {}, `Restrukturisasi berhasil — Angsuran baru: ${fmtRp(angsuran_baru)}/bln, Tenor: ${tenor_baru} bln, Bunga: ${bunga_baru}%`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/:pid/slip_timeline', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const pid = req.params.pid;
    const p = await Q(
      'SELECT p.*, a.nama as anggota_nama, a.no as anggota_no FROM pinjaman p LEFT JOIN anggota a ON p.anggota_id=a.id WHERE p.id=?',
      [pid],
      true,
    );
    if (!p) return jsonErr(res, 'Tidak ditemukan', 404);
    const schedule = [];
    let sisa = p.nominal;
    const sliding = (p.rate_type || 'flat') === 'sliding';
    if (sliding) {
      const pokok_per_bln = Math.round(p.nominal / p.tenor);
      for (let i = 1; i <= p.tenor; i++) {
        const bunga = Math.round(sisa * p.bunga / 100);
        const angs = pokok_per_bln + bunga;
        schedule.push({ ke: i, pokok: pokok_per_bln, bunga, angsuran: angs, sisa: Math.max(0, sisa - pokok_per_bln) });
        sisa -= pokok_per_bln;
      }
    } else {
      const bunga_total = p.nominal * p.bunga / 100 * p.tenor;
      const pokok_per_bln = Math.round(p.nominal / p.tenor);
      const bunga_per_bln = Math.round(bunga_total / p.tenor);
      for (let i = 1; i <= p.tenor; i++) {
        schedule.push({ ke: i, pokok: pokok_per_bln, bunga: bunga_per_bln, angsuran: pokok_per_bln + bunga_per_bln, sisa: Math.max(0, sisa - pokok_per_bln) });
        sisa -= pokok_per_bln;
      }
    }
    const hdr = await getPrintHeader();
    const history = await Q('SELECT * FROM pinjaman_history WHERE pinjaman_id=? ORDER BY created_at DESC', [pid]);
    const bayar = await Q('SELECT * FROM pinjaman_bayar WHERE pinjaman_id=? ORDER BY tgl', [pid]);
    return jsonOk(res, { p, schedule, hdr, history, bayar });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

// ── Kolektif routes ──
router.get('/kolektif', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const bulan = req.query.bulan || today().slice(0, 7);
    const tgl_from = `${bulan}-01`;
    const tgl_to = `${bulan}-31`;
    const anggota_list = await Q("SELECT * FROM anggota WHERE status='aktif' ORDER BY no");
    const result = [];
    for (const a of anggota_list) {
      const aid = a.id;
      const pins = await Q("SELECT * FROM pinjaman WHERE anggota_id=? AND status='aktif' ORDER BY jenis,tgl_cair", [aid]);
      const total_angsuran = pins.reduce((s, p) => s + Number(p.angsuran || 0), 0);
      const sm = await Q(
        "SELECT jenis,COALESCE(SUM(nominal),0) as jml FROM simpanan_trx WHERE anggota_id=? AND tipe='setor' AND substr(tgl,1,7)=? GROUP BY jenis",
        [aid, bulan],
      );
      const sm_map = Object.fromEntries(sm.map((r) => [r.jenis, r.jml]));
      const total_simpanan = Object.values(sm_map).reduce((s, v) => s + Number(v || 0), 0);
      const bel = await Q(
        "SELECT COALESCE(SUM(total),0) as t FROM penjualan WHERE anggota_id=? AND jenis='kredit' AND tgl>=? AND tgl<=?",
        [aid, tgl_from, tgl_to],
        true,
      );
      const total_toko = bel?.t ?? 0;
      const piu = await Q('SELECT COALESCE(saldo,0) as t FROM piutang WHERE anggota_id=?', [aid], true);
      const tunggakan = piu?.t ?? 0;
      const kr = await Q("SELECT COALESCE(SUM(angsuran),0) as t FROM kredit_barang WHERE anggota_id=? AND status='aktif'", [aid], true);
      const total_kredit = kr?.t ?? 0;
      const total_potong = total_angsuran + total_simpanan + total_toko + tunggakan + total_kredit;
      if (total_potong > 0 || pins.length) {
        result.push({
          anggota_id: aid, no: a.no, nip: a.nip, nama: a.nama, dept: a.dept, gaji: a.gaji || 0,
          no_rek: a.no_rek || '', nama_bank: a.nama_bank || '', pinjaman: pins, total_angsuran,
          sm_pokok: sm_map.pokok || 0, sm_wajib: sm_map.wajib || 0, sm_sukarela: sm_map.sukarela || 0,
          total_simpanan, total_toko, tunggakan, total_kredit, total_potong,
        });
      }
    }
    const keys = ['total_angsuran', 'total_simpanan', 'total_toko', 'tunggakan', 'total_kredit', 'total_potong'];
    const grand = Object.fromEntries(keys.map((k) => [k, result.reduce((s, r) => s + Number(r[k] || 0), 0)]));
    const hdr = await getPrintHeader();
    return jsonOk(res, { rows: result, bulan, grand, hdr });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/kolektif/proses', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const tgl = f.tgl || today();
    const bulan = f.bulan || today().slice(0, 7);
    const metode = f.metode || 'potong-gaji';
    const pin_ids = [].concat(f['pin_id[]'] || f.pin_id || []);
    let ok_pin = 0;
    for (const pin_id of pin_ids) {
      const pin = await Q('SELECT * FROM pinjaman WHERE id=?', [pin_id], true);
      if (!pin || pin.status !== 'aktif') continue;
      const sisa_baru = Math.max(0, pin.sisa_pokok - pin.angsuran);
      const status_baru = sisa_baru <= 0 ? 'lunas' : 'aktif';
      await X('UPDATE pinjaman SET sisa_pokok=?,status=? WHERE id=?', [sisa_baru, status_baru, pin_id]);
      await X(
        'INSERT INTO pinjaman_bayar (id,pinjaman_id,tgl,nominal,metode,user_id) VALUES (?,?,?,?,?,?)',
        [uid(), pin_id, tgl, pin.angsuran, metode, req.session.user.id],
      );
      ok_pin++;
    }
    const sm_anggota_ids = [].concat(f['sm_anggota_id[]'] || f.sm_anggota_id || []);
    const sm_pokoks = [].concat(f['sm_pokok[]'] || f.sm_pokok || []);
    const sm_wajibs = [].concat(f['sm_wajib[]'] || f.sm_wajib || []);
    const sm_sukarelaes = [].concat(f['sm_sukarela[]'] || f.sm_sukarela || []);
    let ok_sim = 0;
    for (let i = 0; i < sm_anggota_ids.length; i++) {
      const aid = sm_anggota_ids[i];
      if (!aid) continue;
      for (const [jenis, nominal] of [['pokok', Number(sm_pokoks[i]) || 0], ['wajib', Number(sm_wajibs[i]) || 0], ['sukarela', Number(sm_sukarelaes[i]) || 0]]) {
        if (nominal <= 0) continue;
        const existing = await Q('SELECT id FROM simpanan WHERE anggota_id=? AND jenis=?', [aid, jenis], true);
        if (existing) {
          await X("UPDATE simpanan SET saldo=saldo+?,updated_at=datetime('now','localtime') WHERE anggota_id=? AND jenis=?", [nominal, aid, jenis]);
        } else {
          await X('INSERT INTO simpanan (id,anggota_id,jenis,saldo) VALUES (?,?,?,?)', [uid(), aid, jenis, nominal]);
        }
        const no = `SMP-${tgl.replace(/-/g, '')}-${uid().slice(0, 4)}`;
        await X(
          'INSERT INTO simpanan_trx (id,no,tgl,anggota_id,jenis,tipe,nominal,metode,ket,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [uid(), no, tgl, aid, jenis, 'setor', nominal, metode, `Setor massal ${jenis} bln ${bulan}`, req.session.user.id],
        );
      }
      ok_sim++;
    }
    const msgs = [];
    if (ok_pin) msgs.push(`${ok_pin} angsuran pinjaman`);
    if (ok_sim) msgs.push(`${ok_sim} setoran simpanan`);
    return jsonOk(res, { ok_pin, ok_sim }, `Berhasil diproses via potong gaji: ${msgs.join(', ')}`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/kolektif/export', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'xlsx';
    const rows = await Q(
      `SELECT a.no,a.nip,a.nama,a.dept,p.no as no_pin,p.jenis,p.angsuran,p.sisa_pokok,p.bunga
       FROM pinjaman p LEFT JOIN anggota a ON p.anggota_id=a.id WHERE p.status='aktif' ORDER BY a.no`,
    );
    const cols = ['no', 'nip', 'nama', 'dept', 'no_pin', 'jenis', 'angsuran', 'sisa_pokok', 'bunga'];
    return sendExport(fmt, rows, cols, 'Kolektif Potong Gaji', 'kolektif_gaji.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/kolektif/slip/:anggota_id', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const a = await Q('SELECT * FROM anggota WHERE id=?', [req.params.anggota_id], true);
    if (!a) return jsonErr(res, 'Anggota tidak ditemukan');
    const bulan = req.query.bulan || today().slice(0, 7);
    const data = await buildSlipData(a, bulan);
    const hdr = await getPrintHeader();
    return jsonOk(res, { ...data, hdr });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/kolektif/print_all', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const bulan = req.query.bulan || today().slice(0, 7);
    const tgl_from = `${bulan}-01`;
    const tgl_to = `${bulan}-31`;
    let anggota_rows;
    if (req.query.ids) {
      const id_list = String(req.query.ids).split(',').map((x) => x.trim()).filter(Boolean);
      if (!id_list.length) return jsonErr(res, 'IDs kosong');
      const placeholders = id_list.map(() => '?').join(',');
      anggota_rows = await Q(`SELECT * FROM anggota WHERE id IN (${placeholders}) ORDER BY no`, id_list);
    } else {
      anggota_rows = await Q(
        `SELECT DISTINCT a.* FROM anggota a JOIN pinjaman p ON p.anggota_id=a.id WHERE p.status='aktif' AND a.status='aktif' ORDER BY a.no`,
      );
    }
    const slips = [];
    for (const a of anggota_rows) {
      const toko_rows = await Q(
        `SELECT l.nama as lokasi_nama, COALESCE(SUM(p.total),0) as jumlah
         FROM penjualan p LEFT JOIN lokasi l ON p.lokasi_id=l.id
         WHERE p.anggota_id=? AND p.jenis='kredit' AND p.tgl>=? AND p.tgl<=?
         GROUP BY p.lokasi_id`,
        [a.id, tgl_from, tgl_to],
      );
      const total_toko = toko_rows.reduce((s, r) => s + Number(r.jumlah || 0), 0);
      const sm_p = await Q("SELECT COALESCE(saldo,0) as t FROM simpanan WHERE anggota_id=? AND jenis='pokok'", [a.id], true);
      const sm_w = await Q("SELECT COALESCE(saldo,0) as t FROM simpanan WHERE anggota_id=? AND jenis='wajib'", [a.id], true);
      const sm_s = await Q("SELECT COALESCE(saldo,0) as t FROM simpanan WHERE anggota_id=? AND jenis='sukarela'", [a.id], true);
      const sm_pokok = sm_p?.t ?? 0;
      const sm_wajib = sm_w?.t ?? 0;
      const sm_sukarela = sm_s?.t ?? 0;
      const total_simpanan = sm_pokok + sm_wajib + sm_sukarela;
      const pinjaman_rows = await Q(
        `SELECT p.*,(SELECT COUNT(*) FROM pinjaman_bayar WHERE pinjaman_id=p.id) as cicilan_ke
         FROM pinjaman p WHERE p.anggota_id=? AND p.status='aktif' ORDER BY p.tgl_cair`,
        [a.id],
      );
      const total_angsuran = pinjaman_rows.reduce((s, r) => s + Number(r.angsuran || 0), 0);
      const piu = await Q('SELECT COALESCE(saldo,0) as t FROM piutang WHERE anggota_id=?', [a.id], true);
      const tung_pin = await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t FROM pinjaman WHERE anggota_id=? AND status='macet'", [a.id], true);
      const tunggakan_toko = piu?.t ?? 0;
      const tunggakan_pin = tung_pin?.t ?? 0;
      const total_potongan = total_toko + total_simpanan + total_angsuran + tunggakan_pin + tunggakan_toko;
      slips.push({
        a, toko_rows, total_toko, sm_pokok, sm_wajib, sm_sukarela, total_simpanan,
        pinjaman_rows, total_angsuran, tunggakan_pin, tunggakan_toko, total_potongan,
      });
    }
    const hdr = await getPrintHeader();
    return jsonOk(res, { slips, bulan, hdr });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/kolektif/slip_batch', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const bulan = req.query.bulan || today().slice(0, 7);
    const tgl_from = `${bulan}-01`;
    const tgl_to = `${bulan}-31`;
    let anggota_ids;
    if (req.query.ids) {
      anggota_ids = String(req.query.ids).split(',').filter(Boolean);
    } else {
      const rows = await Q("SELECT DISTINCT anggota_id FROM pinjaman WHERE status='aktif'");
      anggota_ids = rows.map((r) => r.anggota_id).filter(Boolean);
    }
    const slips = [];
    for (const aid of anggota_ids) {
      const a = await Q('SELECT * FROM anggota WHERE id=?', [aid], true);
      if (!a) continue;
      const toko_rows = await Q(
        `SELECT l.nama as lokasi_nama,COALESCE(SUM(p.total),0) as jumlah
         FROM penjualan p LEFT JOIN lokasi l ON p.lokasi_id=l.id
         WHERE p.anggota_id=? AND p.jenis='kredit' AND p.tgl>=? AND p.tgl<=? GROUP BY p.lokasi_id`,
        [aid, tgl_from, tgl_to],
      );
      const sm_p = await Q("SELECT COALESCE(saldo,0) as t FROM simpanan WHERE anggota_id=? AND jenis='pokok'", [aid], true);
      const sm_w = await Q("SELECT COALESCE(saldo,0) as t FROM simpanan WHERE anggota_id=? AND jenis='wajib'", [aid], true);
      const sm_s = await Q("SELECT COALESCE(saldo,0) as t FROM simpanan WHERE anggota_id=? AND jenis='sukarela'", [aid], true);
      const simpanan_rows = [
        { label: 'SIM POKOK', jumlah: sm_p?.t ?? 0 },
        { label: 'SIM WAJIB', jumlah: sm_w?.t ?? 0 },
        { label: 'SIM SUKARELA', jumlah: sm_s?.t ?? 0 },
      ];
      const pinjaman_regular = await Q(
        `SELECT *,(SELECT COUNT(*) FROM pinjaman_bayar WHERE pinjaman_id=pinjaman.id) as cicilan_ke
         FROM pinjaman WHERE anggota_id=? AND jenis='regular' AND status='aktif' ORDER BY tgl_cair`,
        [aid],
      );
      const pinjaman_darurat = await Q(
        `SELECT *,(SELECT COUNT(*) FROM pinjaman_bayar WHERE pinjaman_id=pinjaman.id) as cicilan_ke
         FROM pinjaman WHERE anggota_id=? AND jenis='darurat' AND status='aktif' ORDER BY tgl_cair`,
        [aid],
      );
      const kredit = await getKreditAnggota(aid);
      const piu = await Q('SELECT COALESCE(saldo,0) as t FROM piutang WHERE anggota_id=?', [aid], true);
      const tung_pin = await Q("SELECT COALESCE(SUM(sisa_pokok),0) as t FROM pinjaman WHERE anggota_id=? AND status='macet'", [aid], true);
      const total_toko = toko_rows.reduce((s, r) => s + Number(r.jumlah || 0), 0) + kredit.motor + kredit.elektronik;
      const total_sim = simpanan_rows.reduce((s, r) => s + Number(r.jumlah || 0), 0);
      const total_reg = pinjaman_regular.reduce((s, r) => s + Number(r.angsuran || 0), 0);
      const total_dar = pinjaman_darurat.reduce((s, r) => s + Number(r.angsuran || 0), 0);
      const tung_toko = piu?.t ?? 0;
      const tung_pin_amt = tung_pin?.t ?? 0;
      slips.push({
        a, bulan, toko_rows, kredit, simpanan_rows, total_sim, pinjaman_regular, pinjaman_darurat,
        total_reg, total_dar, tung_toko, tung_pin: tung_pin_amt, total_toko, total_potongan: total_toko + total_sim + total_reg + total_dar + tung_toko + tung_pin_amt,
      });
    }
    const hdr = await getPrintHeader();
    return jsonOk(res, { slips, bulan, hdr });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

async function buildRingkasan(bulan) {
  const tgl_from = `${bulan}-01`;
  const tgl_to = `${bulan}-31`;
  const anggota_rows = await Q("SELECT * FROM anggota WHERE status='aktif' ORDER BY no");
  const result = [];
  for (let i = 0; i < anggota_rows.length; i++) {
    const a = anggota_rows[i];
    const bel = await Q(
      "SELECT COALESCE(SUM(total),0) as t FROM penjualan WHERE anggota_id=? AND jenis='kredit' AND tgl>=? AND tgl<=?",
      [a.id, tgl_from, tgl_to],
      true,
    );
    const toko = bel?.t ?? 0;
    const sim_bln = a.gaji ? a.gaji * 0.02 : 0;
    const pinjaman = await Q("SELECT COALESCE(SUM(angsuran),0) as ang FROM pinjaman WHERE anggota_id=? AND status='aktif'", [a.id], true);
    const cicilan = pinjaman?.ang ?? 0;
    const piu = await Q('SELECT COALESCE(saldo,0) as t FROM piutang WHERE anggota_id=?', [a.id], true);
    const tung = piu?.t ?? 0;
    const total = toko + sim_bln + cicilan + tung;
    if (total > 0 || [toko, sim_bln, cicilan, tung].some((x) => x > 0)) {
      result.push({
        urut: i + 1, no: a.no, nip: a.nip, nama: a.nama, dept: a.dept, jabatan: a.jabatan,
        toko, simpanan: sim_bln, cicilan, tunggakan: tung, total,
      });
    }
  }
  const grand = ['toko', 'simpanan', 'cicilan', 'tunggakan', 'total'].reduce(
    (g, k) => ({ ...g, [k]: result.reduce((s, r) => s + Number(r[k] || 0), 0) }),
    {},
  );
  return { result, grand };
}

router.get('/kolektif/ringkasan', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const bulan = req.query.bulan || today().slice(0, 7);
    const { result, grand } = await buildRingkasan(bulan);
    const hdr = await getPrintHeader();
    return jsonOk(res, { rows: result, grand, bulan, hdr });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/kolektif/ringkasan/export', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const bulan = req.query.bulan || today().slice(0, 7);
    const fmt = req.query.fmt || 'xlsx';
    const { result } = await buildRingkasan(bulan);
    const exportRows = result.map((r, i) => ({
      no: i + 1, no_ang: r.no, nip: r.nip, nama: r.nama, dept: r.dept,
      toko: r.toko, simpanan: r.simpanan, cicilan_bunga: r.cicilan, tunggakan: r.tunggakan, total: r.total,
    }));
    const cols = ['no', 'no_ang', 'nip', 'nama', 'dept', 'toko', 'simpanan', 'cicilan_bunga', 'tunggakan', 'total'];
    return sendExport(fmt, exportRows, cols, `Ringkasan Potongan ${bulan}`, `ringkasan_${bulan}.xlsx`, res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/kolektif/histori/:aid', accessRequired('pinjaman'), asyncHandler(async (req, res) => {
  try {
    const aid = req.params.aid;
    const a = await Q('SELECT * FROM anggota WHERE id=?', [aid], true);
    if (!a) return jsonErr(res, 'Anggota tidak ditemukan');
    const bulans = await Q(
      `SELECT DISTINCT substr(tgl,1,7) as bulan FROM (
        SELECT tgl FROM pinjaman_bayar WHERE pinjaman_id IN (SELECT id FROM pinjaman WHERE anggota_id=?)
        UNION SELECT tgl FROM simpanan_trx WHERE anggota_id=?
        UNION SELECT tgl FROM penjualan WHERE anggota_id=? AND jenis='kredit'
      ) t ORDER BY bulan DESC LIMIT 24`,
      [aid, aid, aid],
    );
    const history = [];
    for (const b of bulans) {
      const bulan = b.bulan;
      const ang = (await Q(
        'SELECT COALESCE(SUM(nominal),0) as t FROM pinjaman_bayar WHERE pinjaman_id IN (SELECT id FROM pinjaman WHERE anggota_id=?) AND substr(tgl,1,7)=?',
        [aid, bulan],
        true,
      ))?.t ?? 0;
      const sm = (await Q(
        "SELECT COALESCE(SUM(nominal),0) as t FROM simpanan_trx WHERE anggota_id=? AND tipe='setor' AND substr(tgl,1,7)=?",
        [aid, bulan],
        true,
      ))?.t ?? 0;
      const toko = (await Q(
        "SELECT COALESCE(SUM(total),0) as t FROM penjualan WHERE anggota_id=? AND jenis='kredit' AND substr(tgl,1,7)=?",
        [aid, bulan],
        true,
      ))?.t ?? 0;
      history.push({ bulan, angsuran: ang, simpanan: sm, toko, total: ang + sm + toko });
    }
    return jsonOk(res, { a, history });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
