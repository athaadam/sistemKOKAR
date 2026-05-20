const { Q } = require('../db');
const { today, jsonOk } = require('../utils/helpers');
const { loginRequired } = require('../middleware/auth');

function registerRoutes(router, deps) {
  const { asyncHandler, loginRequired } = deps;
  router.get('/', loginRequired, asyncHandler(async (req, res) => {
  try {
    const t = today();
    const salesToday = await Q(
      'SELECT COALESCE(SUM(total),0) as t, COUNT(*) as c FROM penjualan WHERE tgl=?',
      [t],
      true,
    );
    const totalPiutang = await Q('SELECT COALESCE(SUM(saldo),0) as t FROM piutang', [], true);
    const totalPinjaman = await Q(
      "SELECT COALESCE(SUM(sisa_pokok),0) as t FROM pinjaman WHERE status='aktif'",
      [],
      true,
    );
    const totalSimpanan = await Q('SELECT COALESCE(SUM(saldo),0) as t FROM simpanan', [], true);
    const anggotaAktif = await Q(
      "SELECT COUNT(*) as c FROM anggota WHERE status='aktif'",
      [],
      true,
    );
    const kendaraanTersedia = await Q(
      "SELECT COUNT(*) as c FROM kendaraan WHERE status='tersedia'",
      [],
      true,
    );
    const feePpob = await Q('SELECT COALESCE(SUM(fee),0) as t FROM ppob_trx', [], true);
    const recentSales = await Q(
      `SELECT p.no,p.tgl,p.jenis,p.total,a.nama as anggota_nama,l.nama as lokasi_nama
       FROM penjualan p LEFT JOIN anggota a ON p.anggota_id=a.id LEFT JOIN lokasi l ON p.lokasi_id=l.id
       ORDER BY p.created_at DESC LIMIT 8`,
    );
    const simpananSum = await Q(
      'SELECT jenis,COALESCE(SUM(saldo),0) as total FROM simpanan GROUP BY jenis',
    );
    const simpananDict = Object.fromEntries(simpananSum.map((r) => [r.jenis, r.total]));
    const lokasiList = await Q(
      `SELECT l.*,(SELECT COUNT(*) FROM penjualan WHERE lokasi_id=l.id AND tgl=?) as trx_today
       FROM lokasi l WHERE l.aktif=1`,
      [t],
    );

    return jsonOk(res, {
      data: {
        sales_today: salesToday,
        total_piutang: totalPiutang,
        total_pinjaman: totalPinjaman,
        total_simpanan: totalSimpanan,
        anggota_aktif: anggotaAktif,
        kendaraan_tersedia: kendaraanTersedia,
        fee_ppob: feePpob,
        pending_approval: { c: 0 },
        recent_sales: recentSales,
        approvals_pending: [],
        simpanan_dict: simpananDict,
        lokasi_list: lokasiList,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}));
}

module.exports = { registerRoutes };
