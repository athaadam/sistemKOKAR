const { Q } = require('../db');

async function getSetting(key, defaultVal = '') {
  const row = await Q('SELECT value FROM setting WHERE `key`=?', [key], true);
  return row?.value ?? defaultVal;
}

async function getPpnRate() {
  return Number(await getSetting('ppn_rate', '12')) / 100;
}

async function getBungaRegular() {
  return Number(await getSetting('bunga_regular', '1.5'));
}

async function getBungaDarurat() {
  return Number(await getSetting('bunga_darurat', '1.0'));
}

async function getLimitApproval() {
  return Number(await getSetting('limit_approval_pinjaman', '20000000'));
}

async function getRegMax() {
  return Number(await getSetting('pinjaman_regular_max', '70000000'));
}

async function getDarMax() {
  return Number(await getSetting('pinjaman_darurat_max_total', '10000000'));
}

async function getDarPerAjuan() {
  return Number(await getSetting('pinjaman_darurat_max_per_ajuan', '3500000'));
}

async function getDarMaxAktif() {
  return Number(await getSetting('pinjaman_darurat_max_aktif', '4'));
}

async function getLimitKreditToko() {
  return Number(await getSetting('limit_kredit_toko_bulanan', '3500000'));
}

async function getOrCreateLimitToko(anggotaId, bulan) {
  let rec = await Q(
    'SELECT * FROM limit_kredit_toko WHERE anggota_id=? AND bulan=?',
    [anggotaId, bulan],
    true,
  );
  if (rec) return rec;

  const prevMonths = await Q(
    `SELECT l.* FROM limit_kredit_toko l
     WHERE l.anggota_id=? AND l.bulan < ? AND l.terpakai > 0
     ORDER BY l.bulan DESC LIMIT 1`,
    [anggotaId, bulan],
  );
  let status = 'aktif';
  if (prevMonths.length) {
    const piu = await Q('SELECT saldo FROM piutang WHERE anggota_id=?', [anggotaId], true);
    status = piu && piu.saldo > 0 ? 'suspend' : 'aktif';
  }

  const { uid } = require('./helpers');
  await require('../db').X(
    'INSERT IGNORE INTO limit_kredit_toko (id,anggota_id,bulan,terpakai,status) VALUES (?,?,?,?,?)',
    [uid(), anggotaId, bulan, 0, status],
  );
  rec = await Q(
    'SELECT * FROM limit_kredit_toko WHERE anggota_id=? AND bulan=?',
    [anggotaId, bulan],
    true,
  );
  return rec;
}

async function getPrintHeader() {
  return {
    nama_kop: await getSetting('nama_kop', 'Koperasi KOKARSI'),
    alamat: await getSetting('alamat', ''),
    telp: await getSetting('telp', ''),
    logo: await getSetting('logo_path', ''),
    header1: await getSetting('print_header1', ''),
    header2: await getSetting('print_header2', ''),
  };
}

module.exports = {
  getSetting,
  getPpnRate,
  getBungaRegular,
  getBungaDarurat,
  getLimitApproval,
  getRegMax,
  getDarMax,
  getDarPerAjuan,
  getDarMaxAktif,
  getLimitKreditToko,
  getOrCreateLimitToko,
  getPrintHeader,
};
