const { Q } = require('../db');
const { today, jsonOk } = require('../utils/helpers');
const { loginRequired } = require('../middleware/auth');

function registerRoutes(router, deps) {
  const { asyncHandler, loginRequired } = deps;
  router.get('/', loginRequired, asyncHandler(async (req, res) => {
  try {
    const t = today();
    const salesToday = await Q(
      'SELECT COALESCE(SUM(total),0) as t, COUNT(*) as c FROM penjualan WHERE tgl=? AND void=0',
      [t],
      true,
    );
    const totalOmzet = await Q(
      'SELECT COALESCE(SUM(total),0) as t FROM penjualan WHERE void=0',
      [],
      true,
    );
    const totalPromoDiskon = await Q(
      'SELECT COALESCE(SUM(diskon_total),0) as t FROM penjualan WHERE void=0',
      [],
      true,
    );
    const bulan = t.slice(0, 7);
    const grossToday = await Q(
      `SELECT COALESCE(SUM(pi.harga * pi.qty),0) as t
       FROM penjualan p
       JOIN penjualan_item pi ON pi.penjualan_id = p.id
       WHERE p.tgl = ? AND p.void = 0`,
      [t],
      true,
    );
    const cogsToday = await Q(
      `SELECT COALESCE(SUM(COALESCE(b.harga_beli,0) * pi.qty),0) as t
       FROM penjualan p
       JOIN penjualan_item pi ON pi.penjualan_id = p.id
       LEFT JOIN barang b ON pi.barang_id = b.id
       WHERE p.tgl = ? AND p.void = 0`,
      [t],
      true,
    );
    const discountToday = await Q(
      'SELECT COALESCE(SUM(diskon_total),0) as t FROM penjualan WHERE tgl=? AND void=0',
      [t],
      true,
    );
    const grossMonth = await Q(
      `SELECT COALESCE(SUM(pi.harga * pi.qty),0) as t
       FROM penjualan p
       JOIN penjualan_item pi ON pi.penjualan_id = p.id
       WHERE substr(p.tgl,1,7) = ? AND p.void = 0`,
      [bulan],
      true,
    );
    const cogsMonth = await Q(
      `SELECT COALESCE(SUM(COALESCE(b.harga_beli,0) * pi.qty),0) as t
       FROM penjualan p
       JOIN penjualan_item pi ON pi.penjualan_id = p.id
       LEFT JOIN barang b ON pi.barang_id = b.id
       WHERE substr(p.tgl,1,7) = ? AND p.void = 0`,
      [bulan],
      true,
    );
    const discountMonth = await Q(
      'SELECT COALESCE(SUM(diskon_total),0) as t FROM penjualan WHERE substr(tgl,1,7)=? AND void=0',
      [bulan],
      true,
    );
    const profitGrossToday = Number(grossToday?.t ?? 0) - Number(cogsToday?.t ?? 0);
    const profitToday = Number(grossToday?.t ?? 0) - Number(discountToday?.t ?? 0) - Number(cogsToday?.t ?? 0);
    const profitGrossMonth = Number(grossMonth?.t ?? 0) - Number(cogsMonth?.t ?? 0);
    const profitMonth = Number(grossMonth?.t ?? 0) - Number(discountMonth?.t ?? 0) - Number(cogsMonth?.t ?? 0);
    const totalPiutangToko = await Q("SELECT COALESCE(SUM(total),0) as t FROM pembelian WHERE status='hutang'", [], true);
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
        total_omzet: totalOmzet,
        total_promo_diskon: totalPromoDiskon,
        profit_gross_today: { t: profitGrossToday },
        profit_today: { t: profitToday },
        profit_gross_month: { t: profitGrossMonth },
        profit_month: { t: profitMonth },
        total_piutang_toko: totalPiutangToko,
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
