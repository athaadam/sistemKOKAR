const { db, Q } = require('../db');
const { uid, today } = require('../utils/helpers');
const { getSetting } = require('../utils/settings');

const SHU_ALOKASI = [
  { code: 'cadangan', label: 'Dana Cadangan', key: 'shu_cadangan_pct', defaultPct: 8 },
  { code: 'simpanan_anggota', label: 'Dana Simpanan Anggota', key: 'shu_simpanan_anggota_pct', defaultPct: 25 },
  { code: 'bunga_pinjaman', label: 'Dana Bunga Pinjaman', key: 'shu_bunga_pinjaman_pct', defaultPct: 20 },
  { code: 'konsumsi', label: 'Dana Konsumsi', key: 'shu_konsumsi_pct', defaultPct: 15 },
  { code: 'parcel', label: 'Dana Parcel', key: 'shu_parcel_pct', defaultPct: 15 },
  { code: 'pengurus', label: 'Dana Pengurus', key: 'shu_pengurus_pct', defaultPct: 12 },
  { code: 'kesejahteraan', label: 'Dana Kesejahteraan', key: 'shu_kesejahteraan_pct', defaultPct: 1 },
  { code: 'pendidikan', label: 'Dana Pendidikan', key: 'shu_pendidikan_pct', defaultPct: 1 },
  { code: 'pembangunan', label: 'Dana Pembangunan Daerah Kerja', key: 'shu_pembangunan_pct', defaultPct: 1 },
  { code: 'sosial', label: 'Dana Sosial', key: 'shu_sosial_pct', defaultPct: 2 },
];

function yearPeriod(value = today()) {
  return String(value || '').slice(0, 4);
}

function monthPeriod(value = today()) {
  return String(value || '').slice(0, 7);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function getShuPercentages() {
  const percentages = {};
  for (const item of SHU_ALOKASI) {
    percentages[item.code] = toNumber(await getSetting(item.key, String(item.defaultPct)), item.defaultPct);
  }
  return percentages;
}

async function getClosedPeriod(periode) {
  return Q('SELECT * FROM close_period WHERE periode=?', [periode], true);
}

async function isShuFinalized(periode) {
  return Q('SELECT * FROM shu_period WHERE periode=?', [periode], true);
}

async function assertPeriodOpen(periode) {
  const closed = await getClosedPeriod(periode);
  if (closed) {
    throw new Error(`Periode ${periode} sudah ditutup`);
  }
}

async function alokasiSHU(shuBruto, percentages = null) {
  const pctMap = percentages || (await getShuPercentages());
  let totalPct = 0;
  let check = 0;
  const alokasi = SHU_ALOKASI.map((item) => {
    const pct = toNumber(pctMap[item.code] ?? item.defaultPct, item.defaultPct);
    const jumlah = Math.round((toNumber(shuBruto) * pct) / 100);
    totalPct += pct;
    check += jumlah;
    return { code: item.code, label: item.label, key: item.key, pct, jumlah };
  });
  return { bruto: toNumber(shuBruto), alokasi, check, total_pct: totalPct };
}

async function hitungJasaSimpanan(periode = yearPeriod(), ratePct = null) {
  const rate = ratePct == null ? toNumber(await getSetting('bunga_jasa_simpanan_pct', '3'), 3) : toNumber(ratePct, 3);
  const anggotaList = await Q("SELECT id,no,nama FROM anggota WHERE status='aktif' ORDER BY no");
  const rows = [];

  for (const anggota of anggotaList) {
    const saldoRow = await Q(
      "SELECT COALESCE(SUM(saldo),0) as t FROM simpanan WHERE anggota_id=? AND jenis='sukarela'",
      [anggota.id],
      true,
    );
    const saldoDasar = toNumber(saldoRow?.t, 0);
    const jasa = Math.round((saldoDasar * rate) / 100);
    if (saldoDasar <= 0 || jasa <= 0) continue;
    rows.push({
      no: `JSS-${periode}-${anggota.no}`,
      periode,
      anggota_id: anggota.id,
      anggota_no: anggota.no,
      anggota_nama: anggota.nama,
      saldo_rata: saldoDasar,
      rate_pct: rate,
      jasa,
    });
  }

  return {
    periode,
    rate_pct: rate,
    rows,
    total_jasa: rows.reduce((sum, row) => sum + toNumber(row.jasa), 0),
  };
}

async function simpanDistribusiJasaSimpanan({ periode = yearPeriod(), ratePct = null, userId, tgl = today(), userName = '-' }) {
  if (String(periode).length === 7) {
    await assertPeriodOpen(periode);
  }
  if (String(periode).length === 4) {
    const finalized = await isShuFinalized(periode);
    if (finalized) {
      throw new Error(`SHU periode ${periode} sudah difinalisasi — jasa simpanan periode itu tidak bisa diproses ulang`);
    }
  }

  const hasil = await hitungJasaSimpanan(periode, ratePct);

  await db.transaction(async (trx) => {
    for (const row of hasil.rows) {
      const existing = await trx('simpanan_jasa')
        .where({ periode: row.periode, anggota_id: row.anggota_id })
        .first();
      if (existing) continue;

      await trx('simpanan_jasa').insert({
        id: uid(),
        no: row.no,
        periode: row.periode,
        anggota_id: row.anggota_id,
        saldo_rata: row.saldo_rata,
        rate_pct: row.rate_pct,
        jasa: row.jasa,
        tgl,
        user_id: userId,
      });

      await trx('simpanan')
        .where({ anggota_id: row.anggota_id, jenis: 'sukarela' })
        // Jasa simpanan tetap masuk saldo simpanan, tetapi pencatatannya jelas sebagai transaksi jasa.
        .update({
          saldo: trx.raw('saldo + ?', [row.jasa]),
          updated_at: trx.raw('NOW()'),
        });

      await trx('simpanan_trx').insert({
        id: uid(),
        no: `TRX-JSS-${row.periode}-${row.anggota_no}`,
        tgl,
        anggota_id: row.anggota_id,
        jenis: 'sukarela',
        tipe: 'setor',
        nominal: row.jasa,
        metode: 'jasa-simpanan',
        ket: `Hasil jasa simpanan periode ${row.periode}`,
        user_id: userId,
      });
    }
  });

  return { ...hasil, user_name: userName };
}

async function hitungSHU(tahun = yearPeriod()) {
  const finalized = await isShuFinalized(tahun);
  if (finalized) {
    const distribusi = await Q(
      `SELECT d.*, a.no as anggota_no, a.nama as anggota_nama
       FROM shu_distribusi d
       LEFT JOIN anggota a ON a.id=d.anggota_id
       WHERE d.periode=?
       ORDER BY a.nama, d.created_at`,
      [tahun],
    );
    const alokasi = JSON.parse(finalized.alokasi_json || '[]');
    return {
      periode: tahun,
      finalized: true,
      bruto: toNumber(finalized.bruto),
      alokasi,
      check: toNumber(finalized.check_total),
      total_pct: toNumber(finalized.total_pct),
      kontribusi: JSON.parse(finalized.kontribusi_json || '[]'),
      kontribusi_total: JSON.parse(finalized.kontribusi_total_json || '{}'),
      distribusi,
      closed_at: finalized.closed_at,
      catatan: finalized.catatan || '',
    };
  }

  const tgl_akhir = `${tahun}-12-31`;
  const pend_bunga_pin = (await Q(
    "SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE kredit='Pendapatan Bunga Pinjaman' AND tgl<=?",
    [tgl_akhir],
    true,
  ))?.t ?? 0;
  const pend_jasa_adm = (await Q(
    "SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE kredit='Pendapatan Jasa Administrasi' AND tgl<=?",
    [tgl_akhir],
    true,
  ))?.t ?? 0;
  const pend_toko = (await Q(
    "SELECT COALESCE(SUM(total),0) as t FROM penjualan WHERE status='lunas' AND substr(tgl,1,4)=?",
    [tahun],
    true,
  ))?.t ?? 0;
  const hpp_toko = (await Q('SELECT COALESCE(SUM(total),0) as t FROM pembelian WHERE substr(tgl,1,4)=?', [tahun], true))?.t ?? 0;
  const laba_toko = pend_toko - hpp_toko;
  const pend_ppob = (await Q('SELECT COALESCE(SUM(fee),0) as t FROM ppob_trx WHERE substr(tgl,1,4)=?', [tahun], true))?.t ?? 0;
  const pend_rental = (await Q("SELECT COALESCE(SUM(total),0) as t FROM rental WHERE status='selesai' AND substr(tgl_mulai,1,4)=?", [tahun], true))?.t ?? 0;
  const pend_labor = (await Q("SELECT COALESCE(SUM(nilai_kontrak),0) as t FROM labor_kontrak WHERE status='selesai' AND substr(tgl,1,4)=?", [tahun], true))?.t ?? 0;
  const biaya_labor = (await Q(
    `SELECT COALESCE(SUM(lp.biaya),0) as t FROM labor_pekerja lp
     JOIN labor_kontrak lk ON lp.kontrak_id=lk.id WHERE lk.status='selesai' AND substr(lk.tgl,1,4)=?`,
    [tahun],
    true,
  ))?.t ?? 0;
  const laba_labor = pend_labor - biaya_labor;
  const pend_lain = (await Q(
    "SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE kredit='Pendapatan Lain-lain' AND tgl<=?",
    [tgl_akhir],
    true,
  ))?.t ?? 0;
  const total_pendapatan = pend_bunga_pin + pend_jasa_adm + laba_toko + pend_ppob + pend_rental + laba_labor + pend_lain;

  const beban_gaji = (await Q("SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE debit='Beban Gaji' AND tgl<=?", [tgl_akhir], true))?.t ?? 0;
  const beban_ops = (await Q("SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE debit='Beban Operasional' AND tgl<=?", [tgl_akhir], true))?.t ?? 0;
  const beban_lain = (await Q(
    "SELECT COALESCE(SUM(nominal),0) as t FROM jurnal WHERE debit LIKE 'Beban%' AND debit NOT IN ('Beban Gaji','Beban Operasional') AND tgl<=?",
    [tgl_akhir],
    true,
  ))?.t ?? 0;
  const total_beban = beban_gaji + beban_ops + beban_lain;
  const bruto = total_pendapatan - total_beban;
  const alokasi = await alokasiSHU(bruto);

  const total_modal = (await Q('SELECT COALESCE(SUM(saldo),0) as t FROM simpanan', [], true))?.t ?? 0;
  const total_jasa_simpanan = (await Q('SELECT COALESCE(SUM(jasa),0) as t FROM simpanan_jasa WHERE periode=?', [tahun], true))?.t ?? 0;
  const total_pinjaman = (await Q(
    "SELECT COALESCE(SUM(COALESCE(disetujui,nominal)),0) as t FROM pinjaman WHERE substr(COALESCE(tgl_cair,tgl_pengajuan,''),1,4)=?",
    [tahun],
    true,
  ))?.t ?? 0;
  const total_konsumsi = (await Q(
    "SELECT COALESCE(SUM(total),0) as t FROM penjualan WHERE substr(tgl,1,4)=? AND (jenis IN ('kredit','potong_gaji') OR payment_channel IN ('kredit','potong_gaji'))",
    [tahun],
    true,
  ))?.t ?? 0;

  // Basis simpanan SHU dikurangi jasa periode sama agar tidak dobel hitung.
  const kontribusi = await Q(
    `SELECT a.id,a.no,a.nama,
      COALESCE((SELECT SUM(saldo) FROM simpanan s WHERE s.anggota_id=a.id),0) - COALESCE((SELECT SUM(jasa) FROM simpanan_jasa sj WHERE sj.anggota_id=a.id AND sj.periode=?),0) as modal,
      COALESCE((SELECT SUM(COALESCE(disetujui,nominal)) FROM pinjaman p WHERE p.anggota_id=a.id AND substr(COALESCE(p.tgl_cair,p.tgl_pengajuan,''),1,4)=?),0) as pinjaman,
      COALESCE((SELECT SUM(total) FROM penjualan pj WHERE pj.anggota_id=a.id AND substr(pj.tgl,1,4)=? AND (pj.jenis IN ('kredit','potong_gaji') OR pj.payment_channel IN ('kredit','potong_gaji'))),0) as konsumsi
      FROM anggota a WHERE a.status='aktif' ORDER BY a.nama`,
    [tahun, tahun, tahun],
  );

  for (const row of kontribusi) {
    row.modal = toNumber(row.modal) < 0 ? 0 : toNumber(row.modal);
    row.shu_modal = (total_modal - total_jasa_simpanan) > 0
      ? Math.round((row.modal / (total_modal - total_jasa_simpanan)) * (alokasi.simpanan_anggota || 0))
      : 0;
    row.shu_pinjaman = total_pinjaman ? Math.round((toNumber(row.pinjaman) / total_pinjaman) * (alokasi.bunga_pinjaman || 0)) : 0;
    row.shu_konsumsi = total_konsumsi ? Math.round((toNumber(row.konsumsi) / total_konsumsi) * (alokasi.konsumsi || 0)) : 0;
    row.shu_total = row.shu_modal + row.shu_pinjaman + row.shu_konsumsi;
  }

  return {
    periode: tahun,
    finalized: false,
    bruto,
    alokasi: alokasi.alokasi,
    check: alokasi.check,
    total_pct: alokasi.total_pct,
    kontribusi,
    kontribusi_total: { modal: Math.max(0, total_modal - total_jasa_simpanan), pinjaman: total_pinjaman, konsumsi: total_konsumsi },
    laba_rugi: {
      pend_bunga_pin,
      pend_jasa_adm,
      pend_toko,
      hpp_toko,
      laba_toko,
      pend_ppob,
      pend_rental,
      pend_labor,
      biaya_labor,
      laba_labor,
      pend_lain,
      total_pendapatan,
      beban_gaji,
      beban_ops,
      beban_lain,
      total_beban,
      shu_bruto: bruto,
    },
  };
}

async function closePeriod({ periode = yearPeriod(), userId, userName = '-', catatan = '' }) {
  const existing = await isShuFinalized(periode);
  if (existing) {
    return { final: true, periode, shu: await hitungSHU(periode), record: existing };
  }

  const shu = await hitungSHU(periode);
  const alokasiJson = JSON.stringify(shu.alokasi || []);
  const kontribusiJson = JSON.stringify(shu.kontribusi || []);
  const kontribusiTotalJson = JSON.stringify(shu.kontribusi_total || {});

  await db.transaction(async (trx) => {
    const shuPeriodId = uid();
    await trx('shu_period').insert({
      id: shuPeriodId,
      periode,
      bruto: shu.bruto,
      total_pct: shu.total_pct,
      check_total: shu.check,
      alokasi_json: alokasiJson,
      kontribusi_json: kontribusiJson,
      kontribusi_total_json: kontribusiTotalJson,
      status: 'final',
      closed_at: today(),
      user_id: userId,
      user_name: userName,
      catatan,
    });

    for (const row of shu.kontribusi || []) {
      await trx('shu_distribusi').insert({
        id: uid(),
        shu_period_id: shuPeriodId,
        periode,
        anggota_id: row.id,
        anggota_no: row.no,
        anggota_nama: row.nama,
        modal_basis: row.modal,
        pinjaman_basis: row.pinjaman,
        konsumsi_basis: row.konsumsi,
        shu_modal: row.shu_modal,
        shu_pinjaman: row.shu_pinjaman,
        shu_konsumsi: row.shu_konsumsi,
        jumlah: row.shu_total,
        user_id: userId,
      });
    }
  });

  return { final: true, periode, shu: await hitungSHU(periode) };
}

module.exports = {
  SHU_ALOKASI,
  yearPeriod,
  monthPeriod,
  getShuPercentages,
  getClosedPeriod,
  isShuFinalized,
  assertPeriodOpen,
  alokasiSHU,
  hitungJasaSimpanan,
  simpanDistribusiJasaSimpanan,
  hitungSHU,
  closePeriod,
};