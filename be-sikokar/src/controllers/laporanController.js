const { Q } = require('../db');
const { today, jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { getLimitKreditToko, getPrintHeader } = require('../utils/settings');
const { sendExport } = require('../utils/export');
const { getPototongGajiTransactions, getAllPototongGajiTransactions } = require('../utils/transactionUtils');

async function loadTabData(tab, tgl_from, tgl_to) {
  const data = {};
  if (tab === 'toko') {
    let sql = `SELECT p.*,a.nama as anggota_nama,l.nama as lokasi_nama FROM penjualan p
      LEFT JOIN anggota a ON p.anggota_id=a.id LEFT JOIN lokasi l ON p.lokasi_id=l.id WHERE 1=1`;
    const params = [];
    if (tgl_from) { sql += ' AND p.tgl>=?'; params.push(tgl_from); }
    if (tgl_to) { sql += ' AND p.tgl<=?'; params.push(tgl_to); }
    sql += ' AND COALESCE(p.void,0)=0';
    data.rows = await Q(sql + ' ORDER BY p.created_at DESC LIMIT 500', params);
    data.total = data.rows.reduce((s, r) => s + Number(r.total || 0), 0);
    data.total_subtotal = data.rows.reduce((s, r) => s + Number(r.subtotal || 0), 0);
    data.total_diskon = data.rows.reduce((s, r) => s + Number(r.diskon_total || 0), 0);
    const cogsRows = await Q(
      `SELECT COALESCE(SUM(COALESCE(b.harga_beli,0) * pi.qty),0) as t
       FROM penjualan p
       JOIN penjualan_item pi ON pi.penjualan_id=p.id
       LEFT JOIN barang b ON pi.barang_id=b.id
       WHERE 1=1${tgl_from ? ' AND p.tgl>=?' : ''}${tgl_to ? ' AND p.tgl<=?' : ''} AND COALESCE(p.void,0)=0`,
      params,
      true,
    );
    const cogs = Number(cogsRows?.t ?? 0);
    data.profit_gross = data.total_subtotal - cogs;
    data.profit_net = data.total_subtotal - data.total_diskon - cogs;
    data.omzet_by_lokasi = await Q(
      `SELECT p.lokasi_id, COALESCE(l.nama,'Lokasi Tidak Diketahui') as lokasi_nama, COALESCE(SUM(p.total),0) as total
       FROM penjualan p LEFT JOIN lokasi l ON p.lokasi_id=l.id
       WHERE 1=1${tgl_from ? ' AND p.tgl>=?' : ''}${tgl_to ? ' AND p.tgl<=?' : ''} AND COALESCE(p.void,0)=0
       GROUP BY p.lokasi_id, l.nama
       ORDER BY total DESC`,
      params,
    );
  } else if (tab === 'pembelian') {
    let sql = `SELECT pb.*,s.nama as supplier_nama,l.nama as lokasi_nama FROM pembelian pb
      LEFT JOIN supplier s ON pb.supplier_id=s.id LEFT JOIN lokasi l ON pb.lokasi_id=l.id WHERE 1=1`;
    const params = [];
    if (tgl_from) { sql += ' AND pb.tgl>=?'; params.push(tgl_from); }
    if (tgl_to) { sql += ' AND pb.tgl<=?'; params.push(tgl_to); }
    data.rows = await Q(sql + ' ORDER BY pb.tgl DESC LIMIT 500', params);
    data.total = data.rows.reduce((s, r) => s + Number(r.total || 0), 0);
  } else if (tab === 'stok') {
    data.rows = await Q(
      `SELECT b.kode,b.nama,b.kategori,b.satuan,b.harga,b.harga_beli,
        COALESCE((SELECT jumlah FROM stok WHERE barang_id=b.id AND lokasi_id='L1'),0) as stok_l1,
        COALESCE((SELECT jumlah FROM stok WHERE barang_id=b.id AND lokasi_id='L2'),0) as stok_l2
        FROM barang b ORDER BY b.kode`,
    );
    for (const r of data.rows) {
      r.total_stok = Number(r.stok_l1) + Number(r.stok_l2);
      r.nilai_stok = Number(r.harga) * r.total_stok;
    }
    data.total_nilai = data.rows.reduce((s, r) => s + r.nilai_stok, 0);
  } else if (tab === 'pinjaman') {
    data.rows = await Q('SELECT p.*,a.nama,a.nip FROM pinjaman p LEFT JOIN anggota a ON p.anggota_id=a.id ORDER BY p.tgl_pengajuan DESC');
    data.outstanding = data.rows.filter((r) => r.status === 'aktif').reduce((s, r) => s + Number(r.sisa_pokok || 0), 0);
    data.angsuran_bln = data.rows.filter((r) => r.status === 'aktif').reduce((s, r) => s + Number(r.angsuran || 0), 0);
  } else if (tab === 'simpanan') {
    data.rows = await Q(
      `SELECT a.no,a.nip,a.nama,a.dept,
        COALESCE((SELECT saldo FROM simpanan WHERE anggota_id=a.id AND jenis='pokok'),0) as pokok,
        COALESCE((SELECT saldo FROM simpanan WHERE anggota_id=a.id AND jenis='wajib'),0) as wajib,
        COALESCE((SELECT saldo FROM simpanan WHERE anggota_id=a.id AND jenis='sukarela'),0) as sukarela
        FROM anggota a ORDER BY a.no`,
    );
    for (const r of data.rows) r.total = Number(r.pokok) + Number(r.wajib) + Number(r.sukarela);
    data.total_all = data.rows.reduce((s, r) => s + r.total, 0);
  } else if (tab === 'ppob') {
    let sql = 'SELECT * FROM ppob_trx WHERE 1=1';
    const params = [];
    if (tgl_from) { sql += ' AND tgl>=?'; params.push(tgl_from); }
    if (tgl_to) { sql += ' AND tgl<=?'; params.push(tgl_to); }
    data.rows = await Q(sql + ' ORDER BY tgl DESC LIMIT 500', params);
    data.total_fee = data.rows.reduce((s, r) => s + Number(r.fee || 0), 0);
    data.total_vol = data.rows.reduce((s, r) => s + Number(r.nominal || 0), 0);
  } else if (tab === 'kredit') {
    let sql = `SELECT k.*,a.nama as anggota_nama,a.nip FROM kredit_barang k
      LEFT JOIN anggota a ON k.anggota_id=a.id WHERE 1=1`;
    const params = [];
    if (tgl_from) { sql += ' AND k.tgl_mulai>=?'; params.push(tgl_from); }
    if (tgl_to) { sql += ' AND k.tgl_mulai<=?'; params.push(tgl_to); }
    data.rows = await Q(sql + ' ORDER BY k.created_at DESC', params);
    const aktif = (j) => data.rows.filter((r) => r.jenis === j && r.status === 'aktif');
    data.motor_outstanding = aktif('motor').reduce((s, r) => s + Number(r.sisa_pokok || 0), 0);
    data.elek_outstanding = aktif('elektronik').reduce((s, r) => s + Number(r.sisa_pokok || 0), 0);
    data.motor_angs = aktif('motor').reduce((s, r) => s + Number(r.angsuran || 0), 0);
    data.elek_angs = aktif('elektronik').reduce((s, r) => s + Number(r.angsuran || 0), 0);
  } else if (tab === 'usaha') {
    let sql = 'SELECT * FROM usaha_lain WHERE 1=1';
    const params = [];
    if (tgl_from) { sql += ' AND tgl>=?'; params.push(tgl_from); }
    if (tgl_to) { sql += ' AND tgl<=?'; params.push(tgl_to); }
    data.rows = await Q(sql + ' ORDER BY tgl DESC LIMIT 500', params);
    data.total_pendapatan = data.rows.reduce((s, r) => s + Number(r.pendapatan || 0), 0);
    data.total_biaya = data.rows.reduce((s, r) => s + Number(r.biaya || 0), 0);
    data.total_laba = data.rows.reduce((s, r) => s + Number(r.laba || 0), 0);
  } else if (tab === 'stok_opname') {
    data.rows = await Q(
      `SELECT b.kode,b.nama,b.kategori,b.satuan,l.nama as lokasi,COALESCE(s.jumlah,0) as stok_sistem,
        COALESCE(s.jumlah,0) as stok_fisik,0 as selisih,
        CASE WHEN COALESCE(s.jumlah,0)<0 THEN 'Stok minus: cek transaksi/void dan lakukan adjustment plus.'
             WHEN COALESCE(s.jumlah,0)=0 THEN 'Stok nol: cek kebutuhan reorder atau opname ulang.'
             WHEN COALESCE(s.jumlah,0)<5 THEN 'Stok rendah: pertimbangkan pembelian ulang.'
             ELSE 'Stok normal: tetap lakukan sampling opname berkala.' END as rekomendasi
        FROM stok s JOIN barang b ON b.id=s.barang_id JOIN lokasi l ON l.id=s.lokasi_id
        ORDER BY l.nama,b.nama`,
    );
  }
  return data;
}

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('laporan'), asyncHandler(async (req, res) => {
  try {
    const tab = req.query.tab || 'toko';
    const tgl_from = req.query.tgl_from || '';
    const tgl_to = req.query.tgl_to || '';
    const data = await loadTabData(tab, tgl_from, tgl_to);
    return jsonOk(res, { tab, tgl_from, tgl_to, data });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('laporan'), asyncHandler(async (req, res) => {
  try {
    const tab = req.query.tab || 'toko';
    const fmt = req.query.fmt || 'csv';
    const tgl_from = req.query.tgl_from || '';
    const tgl_to = req.query.tgl_to || '';
    let rows = [];
    let cols = [];

    if (tab === 'toko') {
      let sql = `SELECT p.no,p.tgl,l.nama as toko,p.jenis,a.nama as anggota,p.subtotal,p.diskon_total,p.ppn_total,p.total
        FROM penjualan p LEFT JOIN anggota a ON p.anggota_id=a.id LEFT JOIN lokasi l ON p.lokasi_id=l.id WHERE 1=1`;
      const params = [];
      if (tgl_from) { sql += ' AND p.tgl>=?'; params.push(tgl_from); }
      if (tgl_to) { sql += ' AND p.tgl<=?'; params.push(tgl_to); }
      sql += ' AND COALESCE(p.void,0)=0';
      rows = await Q(sql + ' ORDER BY p.created_at DESC', params);
      cols = ['no', 'tgl', 'toko', 'jenis', 'anggota', 'subtotal', 'diskon_total', 'ppn_total', 'total'];
    } else if (tab === 'pembelian') {
      let sql = `SELECT pb.no,pb.tgl,s.nama as supplier,l.nama as toko,pb.total,pb.status
        FROM pembelian pb LEFT JOIN supplier s ON pb.supplier_id=s.id LEFT JOIN lokasi l ON pb.lokasi_id=l.id WHERE 1=1`;
      const params = [];
      if (tgl_from) { sql += ' AND pb.tgl>=?'; params.push(tgl_from); }
      if (tgl_to) { sql += ' AND pb.tgl<=?'; params.push(tgl_to); }
      rows = await Q(sql + ' ORDER BY pb.tgl DESC', params);
      cols = ['no', 'tgl', 'supplier', 'toko', 'total', 'status'];
    } else if (tab === 'stok') {
      rows = await Q(
        `SELECT b.kode,b.nama,b.kategori,b.harga,
          COALESCE((SELECT jumlah FROM stok WHERE barang_id=b.id AND lokasi_id='L1'),0) as stok_km1,
          COALESCE((SELECT jumlah FROM stok WHERE barang_id=b.id AND lokasi_id='L2'),0) as stok_km2 FROM barang b`,
      );
      cols = ['kode', 'nama', 'kategori', 'harga', 'stok_km1', 'stok_km2'];
    } else if (tab === 'pinjaman') {
      rows = await Q(
        'SELECT p.no,p.tgl_pengajuan,p.tgl_cair,a.nama,p.jenis,p.nominal,p.angsuran,p.sisa_pokok,p.status FROM pinjaman p LEFT JOIN anggota a ON p.anggota_id=a.id',
      );
      cols = ['no', 'tgl_pengajuan', 'tgl_cair', 'nama', 'jenis', 'nominal', 'angsuran', 'sisa_pokok', 'status'];
    } else if (tab === 'simpanan') {
      rows = await Q(
        `SELECT a.no,a.nip,a.nama,a.dept,
          COALESCE((SELECT saldo FROM simpanan WHERE anggota_id=a.id AND jenis='pokok'),0) as pokok,
          COALESCE((SELECT saldo FROM simpanan WHERE anggota_id=a.id AND jenis='wajib'),0) as wajib,
          COALESCE((SELECT saldo FROM simpanan WHERE anggota_id=a.id AND jenis='sukarela'),0) as sukarela FROM anggota a`,
      );
      cols = ['no', 'nip', 'nama', 'dept', 'pokok', 'wajib', 'sukarela'];
    } else if (tab === 'kredit') {
      rows = await Q(
        `SELECT k.no,k.tgl_mulai,a.no as no_ang,a.nip,a.nama,k.jenis,k.nama_barang,k.toko,
          k.harga_beli,k.dp,k.pokok,k.bunga_pct,k.tenor,k.angsuran,k.sisa_pokok,k.cicilan_ke,k.status
          FROM kredit_barang k LEFT JOIN anggota a ON k.anggota_id=a.id ORDER BY k.jenis,k.created_at DESC`,
      );
      cols = ['no', 'tgl_mulai', 'no_ang', 'nip', 'nama', 'jenis', 'nama_barang', 'toko', 'harga_beli', 'dp', 'pokok', 'bunga_pct', 'tenor', 'angsuran', 'sisa_pokok', 'cicilan_ke', 'status'];
    } else if (tab === 'usaha') {
      rows = await Q('SELECT tgl,jenis,nama,customer,deskripsi,pendapatan,biaya,laba,status FROM usaha_lain ORDER BY tgl DESC');
      cols = ['tgl', 'jenis', 'nama', 'customer', 'deskripsi', 'pendapatan', 'biaya', 'laba', 'status'];
    } else if (tab === 'stok_opname') {
      rows = await Q(
        `SELECT b.kode,b.nama,b.kategori,b.satuan,l.nama as lokasi,COALESCE(s.jumlah,0) as stok_sistem,
          COALESCE(s.jumlah,0) as stok_fisik,0 as selisih,
          CASE WHEN COALESCE(s.jumlah,0)<0 THEN 'Stok minus: cek transaksi/void dan lakukan adjustment plus.'
               WHEN COALESCE(s.jumlah,0)=0 THEN 'Stok nol: cek kebutuhan reorder atau opname ulang.'
               WHEN COALESCE(s.jumlah,0)<5 THEN 'Stok rendah: pertimbangkan pembelian ulang.'
               ELSE 'Stok normal: tetap lakukan sampling opname berkala.' END as rekomendasi
          FROM stok s JOIN barang b ON b.id=s.barang_id JOIN lokasi l ON l.id=s.lokasi_id ORDER BY l.nama,b.nama`,
      );
      cols = ['kode', 'nama', 'kategori', 'satuan', 'lokasi', 'stok_sistem', 'stok_fisik', 'selisih', 'rekomendasi'];
    } else {
      let sql = 'SELECT no,tgl,layanan,pelanggan,nominal,fee,total,status FROM ppob_trx WHERE 1=1';
      const params = [];
      if (tgl_from) { sql += ' AND tgl>=?'; params.push(tgl_from); }
      if (tgl_to) { sql += ' AND tgl<=?'; params.push(tgl_to); }
      rows = await Q(sql + ' ORDER BY tgl DESC', params);
      cols = ['no', 'tgl', 'layanan', 'pelanggan', 'nominal', 'fee', 'total', 'status'];
    }
    return sendExport(fmt, rows, cols, `Laporan ${tab.charAt(0).toUpperCase() + tab.slice(1)}`, `laporan_${tab}.xlsx`, res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

async function buildSummaryGaji(bulan, tgl_from, tgl_to) {
  const rows = await Q("SELECT * FROM anggota WHERE status='aktif' ORDER BY no");
  const result = [];
  for (const a of rows) {
    let belSql = "SELECT COALESCE(SUM(total),0) as t FROM penjualan WHERE anggota_id=? AND jenis='kredit'";
    const belParams = [a.id];
    if (tgl_from && tgl_to) {
      belSql += " AND tgl>=? AND tgl<=?";
      belParams.push(tgl_from, tgl_to);
    } else if (bulan) {
      belSql += " AND tgl>=? AND tgl<=?";
      belParams.push(`${bulan}-01`, `${bulan}-31`);
    }
    const bel = await Q(belSql, belParams, true);

    let pinSql = "SELECT COALESCE(SUM(angsuran),0) as ang FROM pinjaman WHERE anggota_id=? AND status='aktif'";
    const pinParams = [a.id];
    if (tgl_from && tgl_to) {
      pinSql += " AND tgl_cair>=? AND tgl_cair<=?";
      pinParams.push(tgl_from, tgl_to);
    }
    const pin = await Q(pinSql, pinParams, true);

    const piu = await Q('SELECT COALESCE(saldo,0) as t FROM piutang WHERE anggota_id=?', [a.id], true);
    const toko = bel?.t ?? 0;
    const simpanan = a.gaji ? a.gaji * 0.02 : 0;
    const cicilan = pin?.ang ?? 0;
    const tunggakan = piu?.t ?? 0;
    const total_potongan = toko + simpanan + cicilan + tunggakan;
    if (total_potongan > 0) {
      result.push({
        anggota_id: a.id,
        no: a.no, nip: a.nip, nama: a.nama, dept: a.dept,
        belanja_toko: toko, simpanan_wajib: simpanan, cicilan_pinjaman: cicilan,
        tunggakan, total_potongan, gaji: a.gaji,
      });
    }
  }
  const grand_total = result.reduce((s, r) => s + r.total_potongan, 0);
  return { result, grand_total };
}

router.get('/summary_gaji', accessRequired('laporan'), asyncHandler(async (req, res) => {
  try {
    const bulan = req.query.bulan || today().slice(0, 7);
    const tgl_from = req.query.tgl_from || '';
    const tgl_to = req.query.tgl_to || '';
    const { result, grand_total } = await buildSummaryGaji(bulan, tgl_from, tgl_to);
    const hdr = await getPrintHeader();
    return jsonOk(res, { rows: result, bulan, tgl_from, tgl_to, grand_total, hdr });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/summary_gaji/export', accessRequired('laporan'), asyncHandler(async (req, res) => {
  try {
    const bulan = req.query.bulan || today().slice(0, 7);
    const tgl_from = req.query.tgl_from || '';
    const tgl_to = req.query.tgl_to || '';
    const fmt = req.query.fmt || 'xlsx';
    const { result } = await buildSummaryGaji(bulan, tgl_from, tgl_to);
    const exportRows = result.map((r, i) => ({
      urut: i + 1, no: r.no, nip: r.nip, nama: r.nama, dept: r.dept,
      belanja_toko: r.belanja_toko, simpanan_wajib: r.simpanan_wajib, cicilan_pinjaman: r.cicilan_pinjaman,
      tunggakan: r.tunggakan, total_potongan: r.total_potongan,
    }));
    const cols = ['urut', 'no', 'nip', 'nama', 'dept', 'belanja_toko', 'simpanan_wajib', 'cicilan_pinjaman', 'tunggakan', 'total_potongan'];
    const filename = tgl_from && tgl_to ? `summary_gaji_${tgl_from}_to_${tgl_to}.xlsx` : `summary_gaji_${bulan}.xlsx`;
    const title = tgl_from && tgl_to ? `Summary Potongan Gaji ${tgl_from} s/d ${tgl_to}` : `Summary Potongan Gaji ${bulan}`;
    return sendExport(fmt, exportRows, cols, title, filename, res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/limit_toko', accessRequired('laporan'), asyncHandler(async (req, res) => {
  try {
    const bulan = req.query.bulan || today().slice(0, 7);
    const rows = await Q(
      `SELECT l.*, a.nama as anggota_nama, a.no as anggota_no, a.nip,
        (SELECT COALESCE(SUM(saldo),0) FROM piutang WHERE anggota_id=l.anggota_id) as piutang_now
        FROM limit_kredit_toko l LEFT JOIN anggota a ON l.anggota_id=a.id
        WHERE l.bulan=? ORDER BY l.terpakai DESC`,
      [bulan],
    );
    const limit_global = await getLimitKreditToko();
    for (const r of rows) {
      r.sisa = limit_global - r.terpakai;
      r.pct = limit_global ? (r.terpakai / limit_global) * 100 : 0;
    }
    return jsonOk(res, { rows, bulan, limit_global });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/pototong_gaji/all', accessRequired('laporan'), asyncHandler(async (req, res) => {
  try {
    const tgl_from = req.query.tgl_from || '';
    const tgl_to = req.query.tgl_to || '';
    const rows = await getAllPototongGajiTransactions(tgl_from, tgl_to);
    const total = rows.reduce((s, r) => s + Number(r.nominal || 0), 0);
    return jsonOk(res, { rows, tgl_from, tgl_to, total });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/pototong_gaji/:anggota_id', accessRequired('laporan'), asyncHandler(async (req, res) => {
  try {
    const anggota_id = req.params.anggota_id;
    const tgl_from = req.query.tgl_from || '';
    const tgl_to = req.query.tgl_to || '';
    const transactions = await getPototongGajiTransactions(anggota_id, tgl_from, tgl_to);
    return jsonOk(res, { ...transactions, anggota_id, tgl_from, tgl_to });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
