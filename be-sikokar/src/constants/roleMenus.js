const ROLE_MENUS = {
  admin: [
    'dashboard', 'anggota', 'barang', 'supplier', 'coa', 'toko', 'toko_riwayat', 'pembelian',
    'simpanan', 'simpanan_massal', 'simpanan_jasa', 'pinjaman', 'pinjaman_kol', 'kredit', 'ppob',
    'rental', 'rental_maintenance', 'rental_dokumen', 'labor', 'kwitansi', 'promo', 'usaha',
    'pembukuan', 'aset', 'laporan', 'konsolidasi', 'summary_gaji', 'setting',
  ],
  pengurus: [
    'dashboard', 'anggota', 'barang', 'supplier', 'coa', 'toko', 'toko_riwayat', 'pembelian',
    'simpanan', 'simpanan_massal', 'pinjaman', 'pinjaman_kol', 'ppob', 'usaha', 'rental',
    'pembukuan', 'laporan', 'konsolidasi', 'summary_gaji', 'setting',
  ],
  kasir: ['dashboard', 'toko', 'toko_riwayat', 'pembelian', 'ppob'],
  simpin: ['dashboard', 'anggota', 'simpanan', 'simpanan_massal', 'pinjaman', 'pinjaman_kol', 'kredit'],
  accounting: [
    'dashboard', 'coa', 'pembukuan', 'aset', 'kwitansi', 'usaha', 'laporan', 'konsolidasi', 'summary_gaji', 'labor',
  ],
};

const ROLE_LABELS = {
  admin: 'Administrator',
  pengurus: 'Pengurus',
  kasir: 'Kasir',
  simpin: 'Simpan Pinjam',
  accounting: 'Accounting',
};

function canAccess(user, menu) {
  if (!user) return false;
  const custom = user.custom_menus || '';
  if (custom) return custom.split(',').includes(menu);
  return (ROLE_MENUS[user.role] || []).includes(menu);
}

module.exports = { ROLE_MENUS, ROLE_LABELS, canAccess };
