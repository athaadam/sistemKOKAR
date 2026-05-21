const { Q } = require('../db');

async function getPototongGajiTransactions(anggota_id, tgl_from, tgl_to) {
  const transactions = {
    penjualan: [],
    pinjaman_bayar: [],
    total: 0,
  };

  const params = [anggota_id];
  let penjualanSql = `
    SELECT
      p.id, p.no, p.tgl, 'penjualan' as jenis,
      p.total as nominal, p.payment_channel as metode,
      l.nama as lokasi_nama
    FROM penjualan p
    LEFT JOIN lokasi l ON p.lokasi_id = l.id
    WHERE p.anggota_id = ? AND p.payment_channel = 'potong_gaji'
  `;

  if (tgl_from && tgl_to) {
    penjualanSql += ' AND p.tgl >= ? AND p.tgl <= ?';
    params.push(tgl_from, tgl_to);
  }

  penjualanSql += ' ORDER BY p.tgl DESC';

  transactions.penjualan = await Q(penjualanSql, params);

  const pinjamanParams = [anggota_id];
  let pinjamanSql = `
    SELECT
      pb.id, pb.pinjaman_id, pb.tgl, 'pinjaman_bayar' as jenis,
      pb.nominal, pb.metode,
      p.no as pinjaman_no
    FROM pinjaman_bayar pb
    LEFT JOIN pinjaman p ON pb.pinjaman_id = p.id
    WHERE p.anggota_id = ? AND (pb.metode = 'potong_gaji' OR pb.metode = 'potong-gaji')
  `;

  if (tgl_from && tgl_to) {
    pinjamanSql += ' AND pb.tgl >= ? AND pb.tgl <= ?';
    pinjamanParams.push(tgl_from, tgl_to);
  }

  pinjamanSql += ' ORDER BY pb.tgl DESC';

  transactions.pinjaman_bayar = await Q(pinjamanSql, pinjamanParams);

  const penjualanTotal = transactions.penjualan.reduce((s, r) => s + Number(r.nominal || 0), 0);
  const pinjamanTotal = transactions.pinjaman_bayar.reduce((s, r) => s + Number(r.nominal || 0), 0);

  transactions.total = penjualanTotal + pinjamanTotal;

  return transactions;
}

async function getAllPototongGajiTransactions(tgl_from, tgl_to) {
  let sql = `
    (SELECT
      'penjualan' as jenis_transaksi,
      p.id, p.no, p.tgl, p.total as nominal,
      a.id as anggota_id, a.no as anggota_no, a.nama as anggota_nama,
      p.payment_channel as metode, l.nama as lokasi_nama, NULL as pinjaman_no
    FROM penjualan p
    LEFT JOIN anggota a ON p.anggota_id = a.id
    LEFT JOIN lokasi l ON p.lokasi_id = l.id
    WHERE p.payment_channel = 'potong_gaji')
    UNION ALL
    (SELECT
      'pinjaman_bayar' as jenis_transaksi,
      pb.id, pb.id as no, pb.tgl, pb.nominal,
      p.anggota_id, a.no as anggota_no, a.nama as anggota_nama,
      pb.metode, NULL as lokasi_nama, p.no as pinjaman_no
    FROM pinjaman_bayar pb
    LEFT JOIN pinjaman p ON pb.pinjaman_id = p.id
    LEFT JOIN anggota a ON p.anggota_id = a.id
    WHERE (pb.metode = 'potong_gaji' OR pb.metode = 'potong-gaji'))
  `;

  const params = [];
  let where = ' WHERE 1=1';

  if (tgl_from && tgl_to) {
    where += ' AND tgl >= ? AND tgl <= ?';
    params.push(tgl_from, tgl_to);
  }

  const fullSql = `SELECT * FROM (${sql}) as combined_transactions ${where} ORDER BY tgl DESC`;

  return await Q(fullSql, params);
}

module.exports = {
  getPototongGajiTransactions,
  getAllPototongGajiTransactions,
};
