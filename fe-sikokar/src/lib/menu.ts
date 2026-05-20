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

import type { IconConfig } from '@/components/ui/IconRenderer';
import { ICON_MAP } from '@/components/ui/IconRenderer';

export type MenuItem = { id: string; icon: IconConfig; label: string };

export const MENU_TREE: { section: string; items: MenuItem[] }[] = [
  { section: 'Utama', items: [{ id: 'dashboard', icon: ICON_MAP.dashboard, label: 'Dashboard' }] },
  {
    section: 'Master Data',
    items: [
      { id: 'anggota', icon: ICON_MAP.usersRound_custom, label: 'Anggota' },
      { id: 'barang', icon: ICON_MAP.package_custom, label: 'Barang & Stok' },
      { id: 'supplier', icon: ICON_MAP.supplier_custom, label: 'Supplier' },
      { id: 'coa', icon: ICON_MAP.chartofaccount_custom, label: 'Chart of Accounts' },
    ],
  },
  {
    section: 'Operasional',
    items: [
      { id: 'toko', icon: ICON_MAP.store_custom, label: 'Toko / POS' },
      { id: 'toko_riwayat', icon: ICON_MAP.history_custom, label: 'History Penjualan' },
      { id: 'pembelian', icon: ICON_MAP.pembelian_custom, label: 'Pembelian' },
    ],
  },
  {
    section: 'Keuangan',
    items: [
      { id: 'simpanan', icon: ICON_MAP.simpanan_custom, label: 'Simpanan' },
      { id: 'simpanan_massal', icon: ICON_MAP.setorMassal_custom, label: 'Setor Massal' },
      { id: 'simpanan_jasa', icon: ICON_MAP.jasaSimpanan_custom, label: 'Jasa Simpanan' },
      { id: 'pinjaman', icon: ICON_MAP.pinjaman_custom, label: 'Pinjaman' },
      { id: 'kredit', icon: ICON_MAP.pinjaman_custom, label: 'Kredit Motor & Elektronik' },
      { id: 'ppob', icon: ICON_MAP.ppob_custom, label: 'PPOB' },
      { id: 'usaha', icon: ICON_MAP.catering_custom, label: 'Catering/Usaha Lain' },
      { id: 'rental', icon: ICON_MAP.rental_custom, label: 'Rental Kendaraan' },
      { id: 'rental_maintenance', icon: ICON_MAP.maintenance_custom, label: 'Maintenance Rental' },
      { id: 'rental_dokumen', icon: ICON_MAP.documentRental_custom, label: 'Dokumen Rental' },
    ],
  },
  {
    section: 'Manajemen',
    items: [
      { id: 'pembukuan', icon: ICON_MAP.pembukuan_custom, label: 'Pembukuan' },
      { id: 'aset', icon: ICON_MAP.store_custom, label: 'Aset Tetap' },
      { id: 'pinjaman_kol', icon: ICON_MAP.setorMassal_custom, label: 'Kolektif Potong Gaji' },
      { id: 'labor', icon: ICON_MAP.setorMassal_custom, label: 'Labor Supply' },
      { id: 'kwitansi', icon: ICON_MAP.kwitansi_custom, label: 'Kwitansi & Invoice' },
      { id: 'promo', icon: ICON_MAP.tag, label: 'Promo & Diskon' },
      { id: 'laporan', icon: ICON_MAP.barChartLine, label: 'Laporan & Analisis' },
      { id: 'konsolidasi', icon: ICON_MAP.table, label: 'Laporan Konsolidasi' },
      { id: 'summary_gaji', icon: ICON_MAP.document, label: 'Summary Potongan Gaji' },
      { id: 'setting', icon: ICON_MAP.gear, label: 'Pengaturan' },
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
