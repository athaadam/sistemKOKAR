const { Q, X } = require('../db');
const { uid, today, fmtRp, jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { sendExport } = require('../utils/export');
const { getPrintHeader } = require('../utils/settings');
const { audit } = require('../utils/audit');

const PPOB_SERVICES = [
  { id: 'listrik', label: 'Token Listrik', icon: '💡', fee: 2500, jenis: 'listrik' },
  { id: 'listrik_pasca', label: 'Listrik Pascabayar', icon: '⚡', fee: 3000, jenis: 'listrik' },
  { id: 'pulsa_tsel', label: 'Pulsa Telkomsel', icon: '📱', fee: 1000, jenis: 'pulsa' },
  { id: 'pulsa_xl', label: 'Pulsa XL/Axis', icon: '📱', fee: 1000, jenis: 'pulsa' },
  { id: 'etoll', label: 'e-Toll', icon: '🛣️', fee: 1500, jenis: 'etoll' },
  { id: 'bpjs_kes', label: 'BPJS Kesehatan', icon: '🏥', fee: 2000, jenis: 'bpjs' },
  { id: 'bpjs_tk', label: 'BPJS Ketenagakerjaan', icon: '🏗️', fee: 2000, jenis: 'bpjs' },
  { id: 'pdam', label: 'PDAM / Air', icon: '💧', fee: 1500, jenis: 'pdam' },
  { id: 'internet', label: 'Internet/IndiHome', icon: '🌐', fee: 2500, jenis: 'internet' },
  { id: 'tvkabel', label: 'TV Kabel', icon: '📺', fee: 2000, jenis: 'tv' },
  { id: 'pbb', label: 'Pajak Bumi (PBB)', icon: '🏠', fee: 3000, jenis: 'pajak' },
  { id: 'samsat', label: 'STNK/SAMSAT', icon: '🚗', fee: 5000, jenis: 'pajak' },
];

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/services', accessRequired('ppob'), (_req, res) => jsonOk(res, { services: PPOB_SERVICES }));

router.get('/', accessRequired('ppob'), asyncHandler(async (req, res) => {
  try {
    const { tgl_from = '', tgl_to = '', q = '' } = req.query;
    let sql = 'SELECT * FROM ppob_trx WHERE 1=1';
    const params = [];
    if (tgl_from) {
      sql += ' AND tgl>=?';
      params.push(tgl_from);
    }
    if (tgl_to) {
      sql += ' AND tgl<=?';
      params.push(tgl_to);
    }
    if (q) {
      sql += ' AND (pelanggan LIKE ? OR no LIKE ? OR layanan LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const rows = await Q(sql + ' ORDER BY created_at DESC LIMIT 300', params);
    const rekap = await Q(
      'SELECT COALESCE(SUM(nominal),0) as vol,COALESCE(SUM(fee),0) as fee_total,COUNT(*) as cnt FROM ppob_trx',
      [],
      true,
    );
    return jsonOk(res, { rows, rekap, services: PPOB_SERVICES, tgl_from, tgl_to, q });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/bayar', accessRequired('ppob'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const svc = PPOB_SERVICES.find((s) => s.id === f.svc_id);
    const pln = f.pelanggan || '';
    const nominal = Number(f.nominal) || 0;
    if (!svc || !pln || !nominal) return jsonErr(res, 'Data tidak lengkap');

    const fee = Number(f.fee ?? svc.fee ?? 0);
    const komisi = Number(f.komisi_agen) || 0;
    const saldoProvider = Number(f.saldo_provider) || 0;
    const total = nominal + fee;
    const no = `PPB-${today().replace(/-/g, '')}-${uid().slice(0, 4)}`;
    const tid = uid();

    await X(
      `INSERT INTO ppob_trx (id,no,tgl,layanan,jenis,pelanggan,nominal,fee,total,status,user_id,saldo_provider,komisi_agen)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        tid,
        no,
        today(),
        svc.label,
        svc.jenis,
        pln,
        nominal,
        fee,
        total,
        'sukses',
        req.session.user.id,
        saldoProvider,
        komisi,
      ],
    );
    await X(
      'INSERT INTO jurnal (id,no,tgl,modul,ref,ket,debit,kredit,nominal,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [
        uid(),
        `JRN-${uid()}`,
        today(),
        'PPOB',
        no,
        `Fee PPOB ${svc.label}`,
        'Kas',
        'Pendapatan PPOB',
        fee,
        req.session.user.id,
      ],
    );
    await audit('ppob', 'bayar', 'ppob_trx', tid, null, { no, total, fee }, 'Pembayaran PPOB');
    return jsonOk(
      res,
      { tid, no, total },
      `Pembayaran ${svc.label} berhasil — ${fmtRp(total)}`,
    );
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/struk/:tid', accessRequired('ppob'), asyncHandler(async (req, res) => {
  try {
    const trx = await Q('SELECT * FROM ppob_trx WHERE id=?', [req.params.tid], true);
    if (!trx) return jsonErr(res, 'Transaksi PPOB tidak ditemukan', 404);
    const kasir = trx.user_id
      ? await Q('SELECT name FROM users WHERE id=?', [trx.user_id], true)
      : null;
    const hdr = await getPrintHeader();
    return jsonOk(res, { trx, kasir, hdr });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('ppob'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'csv';
    const rows = await Q(
      'SELECT no,tgl,layanan,pelanggan,nominal,fee,total,status FROM ppob_trx ORDER BY tgl DESC',
    );
    const cols = ['no', 'tgl', 'layanan', 'pelanggan', 'nominal', 'fee', 'total', 'status'];
    return sendExport(fmt, rows, cols, 'Data PPOB', 'ppob.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes, PPOB_SERVICES };
