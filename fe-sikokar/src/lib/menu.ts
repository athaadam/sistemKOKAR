export const ROLE_MENUS: Record<string, string[]> = {
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
  accounting: ['dashboard', 'coa', 'pembukuan', 'aset', 'kwitansi', 'usaha', 'laporan', 'konsolidasi', 'summary_gaji', 'labor'],
};

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  pengurus: 'Pengurus',
  kasir: 'Kasir',
  simpin: 'Simpan Pinjam',
  accounting: 'Accounting',
};

export const MENU_URLS: Record<string, string> = {
  pinjaman_kol: '/pinjaman/kolektif',
  summary_gaji: '/laporan/summary-gaji',
  simpanan_massal: '/simpanan/setor-massal',
  simpanan_jasa: '/simpanan/jasa',
  labor: '/labor',
  kwitansi: '/kwitansi',
  aset: '/aset',
  promo: '/promo',
  toko_riwayat: '/toko/riwayat',
  rental_maintenance: '/rental/maintenance',
  rental_dokumen: '/rental/dokumen',
};

export type MenuItem = { id: string; icon: string; label: string };

export const MENU_TREE: { section: string; items: MenuItem[] }[] = [
  { section: 'Utama', items: [{ id: 'dashboard', icon: 'bi-speedometer2', label: 'Dashboard' }] },
  {
    section: 'Master Data',
    items: [
      { id: 'anggota', icon: 'bi-people-fill', label: 'Anggota' },
      { id: 'barang', icon: 'bi-box-seam', label: 'Barang & Stok' },
      { id: 'supplier', icon: 'bi-building', label: 'Supplier' },
      { id: 'coa', icon: 'bi-journal-bookmark', label: 'Chart of Accounts' },
    ],
  },
  {
    section: 'Operasional',
    items: [
      { id: 'toko', icon: 'bi-cart3', label: 'Toko / POS' },
      { id: 'toko_riwayat', icon: 'bi-clock-history', label: 'History Penjualan' },
      { id: 'pembelian', icon: 'bi-receipt', label: 'Pembelian' },
    ],
  },
  {
    section: 'Keuangan',
    items: [
      { id: 'simpanan', icon: 'bi-piggy-bank', label: 'Simpanan' },
      { id: 'simpanan_massal', icon: 'bi-people', label: 'Setor Massal' },
      { id: 'simpanan_jasa', icon: 'bi-percent', label: 'Jasa Simpanan' },
      { id: 'pinjaman', icon: 'bi-credit-card', label: 'Pinjaman' },
      { id: 'kredit', icon: 'bi-cart-check', label: 'Kredit Motor & Elektronik' },
      { id: 'ppob', icon: 'bi-lightning-charge', label: 'PPOB' },
      { id: 'usaha', icon: 'bi-shop', label: 'Catering/Usaha Lain' },
      { id: 'rental', icon: 'bi-car-front', label: 'Rental Kendaraan' },
      { id: 'rental_maintenance', icon: 'bi-tools', label: 'Maintenance Rental' },
      { id: 'rental_dokumen', icon: 'bi-file-earmark-text', label: 'Dokumen Rental' },
    ],
  },
  {
    section: 'Manajemen',
    items: [
      { id: 'pembukuan', icon: 'bi-clipboard-data', label: 'Pembukuan' },
      { id: 'aset', icon: 'bi-building', label: 'Aset Tetap' },
      { id: 'pinjaman_kol', icon: 'bi-people-fill', label: 'Kolektif Potong Gaji' },
      { id: 'labor', icon: 'bi-people-fill', label: 'Labor Supply' },
      { id: 'kwitansi', icon: 'bi-receipt', label: 'Kwitansi & Invoice' },
      { id: 'promo', icon: 'bi-tag', label: 'Promo & Diskon' },
      { id: 'laporan', icon: 'bi-bar-chart-line', label: 'Laporan & Analisis' },
      { id: 'konsolidasi', icon: 'bi-table', label: 'Laporan Konsolidasi' },
      { id: 'summary_gaji', icon: 'bi-file-earmark-text', label: 'Summary Potongan Gaji' },
      { id: 'setting', icon: 'bi-gear', label: 'Pengaturan' },
    ],
  },
];

export function menuHref(menuId: string): string {
  return MENU_URLS[menuId] || `/${menuId}`;
}

export function canAccess(user: { role?: string; custom_menus?: string } | null, menu: string): boolean {
  if (!user) return false;
  const custom = user.custom_menus?.trim();
  if (custom) return custom.split(',').includes(menu);
  return (ROLE_MENUS[user.role || ''] || []).includes(menu);
}
