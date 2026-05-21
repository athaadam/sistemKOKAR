'use client';

import React from 'react';
import {
  Landmark,
  UsersRound,
  Package,
  Building2,
  BarChart3,
  ShoppingCart,
  Store,
  type LucideIcon,
} from 'lucide-react';

export type IconConfig =
  | { type: 'bootstrap'; icon: string }
  | { type: 'lucide'; icon: LucideIcon }
  | { type: 'custom'; path: string };

interface IconRendererProps {
  icon: IconConfig;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function IconRenderer({ icon, size = 20, className = '', style }: IconRendererProps) {
  if (icon.type === 'bootstrap') {
    return <i className={`bi ${icon.icon} ${className}`} style={{ fontSize: size, ...style }} />;
  }

  if (icon.type === 'lucide') {
    const Component = icon.icon;
    return <Component size={size} className={className} style={style} />;
  }

  if (icon.type === 'custom') {
    return (
      <img
        src={icon.path}
        alt="icon"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
      />
    );
  }

  return null;
}

// Icon mapping for easy reference
export const ICON_MAP = {
  // Lucide icons
  landmark: { type: 'lucide' as const, icon: Landmark },
  usersRound: { type: 'lucide' as const, icon: UsersRound },
  package: { type: 'lucide' as const, icon: Package },
  building2: { type: 'lucide' as const, icon: Building2 },
  barChart3: { type: 'lucide' as const, icon: BarChart3 },
  shoppingCart: { type: 'lucide' as const, icon: ShoppingCart },
  store: { type: 'lucide' as const, icon: Store },

  // Bootstrap icons
  dashboard: { type: 'bootstrap' as const, icon: 'bi-speedometer2' },
  history: { type: 'bootstrap' as const, icon: 'bi-clock-history' },
  receipt: { type: 'bootstrap' as const, icon: 'bi-receipt' },
  piggyBank: { type: 'bootstrap' as const, icon: 'bi-piggy-bank' },
  people: { type: 'bootstrap' as const, icon: 'bi-people' },
  percent: { type: 'bootstrap' as const, icon: 'bi-percent' },
  creditCard: { type: 'bootstrap' as const, icon: 'bi-credit-card' },
  lightning: { type: 'bootstrap' as const, icon: 'bi-lightning-charge' },
  shop: { type: 'bootstrap' as const, icon: 'bi-shop' },
  car: { type: 'bootstrap' as const, icon: 'bi-car-front' },
  tools: { type: 'bootstrap' as const, icon: 'bi-tools' },
  document: { type: 'bootstrap' as const, icon: 'bi-file-earmark-text' },
  clipboardData: { type: 'bootstrap' as const, icon: 'bi-clipboard-data' },
  kolektif: { type: 'bootstrap' as const, icon: 'bi-people-fill' },
  tag: { type: 'bootstrap' as const, icon: 'bi-tag' },
  barChartLine: { type: 'bootstrap' as const, icon: 'bi-bar-chart-line' },
  table: { type: 'bootstrap' as const, icon: 'bi-table' },
  gear: { type: 'bootstrap' as const, icon: 'bi-gear' },
  logout: { type: 'bootstrap' as const, icon: 'bi-box-arrow-left' },

  // Custom SVG icons from public/static/icons/
  landmark_custom: { type: 'custom' as const, path: '/static/icons/landmark.svg' },
  usersRound_custom: { type: 'custom' as const, path: '/static/icons/users-round.svg' },
  package_custom: { type: 'custom' as const, path: '/static/icons/package.svg' },
  supplier_custom: { type: 'custom' as const, path: '/static/icons/supplier.svg' },
  chartofaccount_custom: { type: 'custom' as const, path: '/static/icons/chartofaccount.svg' },
  shoppingCart_custom: { type: 'custom' as const, path: '/static/icons/shopping-cart.svg' },
  store_custom: { type: 'custom' as const, path: '/static/icons/store.svg' },
  history_custom: { type: 'custom' as const, path: '/static/icons/HistoryPenjualan.svg' },
  pembelian_custom: { type: 'custom' as const, path: '/static/icons/Pembelian.svg' },
  simpanan_custom: { type: 'custom' as const, path: '/static/icons/simpanan.svg' },
  setorMassal_custom: { type: 'custom' as const, path: '/static/icons/SetorMassal.svg' },
  jasaSimpanan_custom: { type: 'custom' as const, path: '/static/icons/JasaSimpanan.svg' },
  pinjaman_custom: { type: 'custom' as const, path: '/static/icons/Pinjaman.svg' },
  catering_custom: { type: 'custom' as const, path: '/static/icons/Catering.svg' },
  rental_custom: { type: 'custom' as const, path: '/static/icons/Rental.svg' },
  maintenance_custom: { type: 'custom' as const, path: '/static/icons/Maintenance.svg' },
  documentRental_custom: { type: 'custom' as const, path: '/static/icons/DocumentRental.svg' },
  ppob_custom: { type: 'custom' as const, path: '/static/icons/PPOB.svg' },
  pembukuan_custom: { type: 'custom' as const, path: '/static/icons/Pembukuan.svg' },
  neraca_custom: { type: 'custom' as const, path: '/static/icons/scale.svg' },
  labaRugi_custom: { type: 'custom' as const, path: '/static/icons/labarugi.svg' },
  shu_custom: { type: 'custom' as const, path: '/static/icons/SHU.svg' },
  kwitansi_custom: { type: 'custom' as const, path: '/static/icons/kwitansi.svg' },
  laporan_custom: { type: 'custom' as const, path: '/static/icons/Laporan & analisis.svg' },
  voucher_custom: { type: 'custom' as const, path: '/static/icons/voucher.svg' },
  scanBarcode_custom: { type: 'custom' as const, path: '/static/icons/scan-barcode.svg' },
  loginBg: { type: 'custom' as const, path: '/static/images/login-bg.png' },
};
