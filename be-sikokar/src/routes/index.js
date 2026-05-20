const express = require('express');

const router = express.Router();

/** Auth & ringkasan */
router.use('/auth', require('./auth'));
router.use('/dashboard', require('./dashboard'));

/** Master data */
router.use('/anggota', require('./anggota'));
router.use('/barang', require('./barang'));
router.use('/supplier', require('./supplier'));
router.use('/coa', require('./coa'));
router.use('/lokasi', require('./lokasi'));
router.use('/ref_option', require('./refOption'));

/** Operasional toko & layanan */
router.use('/toko', require('./toko'));
router.use('/pembelian', require('./pembelian'));
router.use('/ppob', require('./ppob'));
router.use('/promo', require('./promo'));

/** Keuangan anggota */
router.use('/simpanan', require('./simpanan'));
router.use('/pinjaman', require('./pinjaman'));
router.use('/kredit', require('./kredit'));
router.use('/rental', require('./rental'));
router.use('/labor', require('./labor'));
router.use('/kwitansi', require('./kwitansi'));
router.use('/usaha', require('./usaha'));

/** Pembukuan & aset */
router.use('/pembukuan', require('./pembukuan'));
router.use('/aset', require('./aset'));

/** Laporan & pengaturan */
router.use('/laporan', require('./laporan'));
router.use('/konsolidasi', require('./konsolidasi'));
router.use('/setting', require('./setting'));
router.use('/audit', require('./audit'));

module.exports = router;
