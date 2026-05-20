$pages = @(
  @{ path = "anggota"; title = "Anggota"; api = "/anggota"; rows = "rows" },
  @{ path = "barang"; title = "Barang & Stok"; api = "/barang"; rows = "rows" },
  @{ path = "supplier"; title = "Supplier"; api = "/supplier"; rows = "rows" },
  @{ path = "coa"; title = "Chart of Accounts"; api = "/coa"; rows = "rows" },
  @{ path = "pembelian"; title = "Pembelian"; api = "/pembelian"; rows = "rows" },
  @{ path = "simpanan"; title = "Simpanan"; api = "/simpanan"; rows = "anggota_list" },
  @{ path = "simpanan/trx"; title = "Transaksi Simpanan"; api = "/simpanan/trx"; rows = "rows" },
  @{ path = "simpanan/setor-massal"; title = "Setor Massal"; api = "/simpanan/setor_massal"; rows = "anggota_list" },
  @{ path = "simpanan/jasa"; title = "Jasa Simpanan"; api = "/simpanan/jasa"; rows = "history" },
  @{ path = "pinjaman"; title = "Pinjaman"; api = "/pinjaman"; rows = "rows" },
  @{ path = "pinjaman/kolektif"; title = "Kolektif Potong Gaji"; api = "/pinjaman/kolektif"; rows = "rows" },
  @{ path = "pinjaman/kolektif/ringkasan"; title = "Ringkasan Kolektif"; api = "/pinjaman/kolektif/ringkasan"; rows = "rows" },
  @{ path = "kredit"; title = "Kredit Barang"; api = "/kredit"; rows = "rows" },
  @{ path = "ppob"; title = "PPOB"; api = "/ppob"; rows = "rows" },
  @{ path = "rental"; title = "Rental"; api = "/rental"; rows = "rows" },
  @{ path = "rental/maintenance"; title = "Maintenance Rental"; api = "/rental/maintenance"; rows = "rows" },
  @{ path = "rental/dokumen"; title = "Dokumen Rental"; api = "/rental/dokumen"; rows = "rows" },
  @{ path = "rental/biaya"; title = "Biaya Rental"; api = "/rental/biaya"; rows = "rows" },
  @{ path = "labor"; title = "Labor Supply"; api = "/labor"; rows = "rows" },
  @{ path = "kwitansi"; title = "Kwitansi"; api = "/kwitansi"; rows = "rows" },
  @{ path = "usaha"; title = "Usaha Lain"; api = "/usaha"; rows = "rows" },
  @{ path = "promo"; title = "Promo"; api = "/promo"; rows = "rows" },
  @{ path = "laporan"; title = "Laporan"; api = "/laporan"; rows = "data" },
  @{ path = "laporan/summary-gaji"; title = "Summary Potongan Gaji"; api = "/laporan/summary_gaji"; rows = "rows" },
  @{ path = "laporan/limit-toko"; title = "Limit Kredit Toko"; api = "/laporan/limit_toko"; rows = "rows" },
  @{ path = "konsolidasi"; title = "Konsolidasi"; api = "/konsolidasi"; rows = "rows" },
  @{ path = "pembukuan"; title = "Pembukuan"; api = "/pembukuan"; rows = "jurnal_rows" },
  @{ path = "pembukuan/ledger"; title = "Buku Besar"; api = "/pembukuan/ledger"; rows = "rows" },
  @{ path = "pembukuan/trial-balance"; title = "Neraca Saldo"; api = "/pembukuan/trial_balance"; rows = "rows" },
  @{ path = "pembukuan/arus-kas"; title = "Arus Kas"; api = "/pembukuan/arus_kas"; rows = "op_in" },
  @{ path = "pembukuan/calk"; title = "CALK"; api = "/pembukuan/calk"; rows = "info" },
  @{ path = "pembukuan/close-period"; title = "Tutup Periode"; api = "/pembukuan/close_period"; rows = "rows" },
  @{ path = "aset"; title = "Aset Tetap"; api = "/aset"; rows = "rows" },
  @{ path = "setting"; title = "Pengaturan"; api = "/setting"; rows = "users" },
  @{ path = "audit"; title = "Audit Log"; api = "/audit"; rows = "rows" },
  @{ path = "toko/riwayat"; title = "Riwayat Penjualan"; api = "/toko/riwayat"; rows = "rows" },
  @{ path = "toko/shift"; title = "Shift Kasir"; api = "/toko/shift"; rows = "history" }
)

$base = "c:\Users\ekada\Downloads\SIKOKAR_DOCKER_v1_5\sikokar_New\fe-sikokar\src\app\(app)"

foreach ($p in $pages) {
  $dir = Join-Path $base $p.path
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $comp = ($p.path -replace '[^a-zA-Z0-9]','') + 'Page'
  $content = @"
'use client';

import { PageLoader } from '@/components/PageLoader';
import { DataTable } from '@/components/DataTable';

export default function ${comp}() {
  return (
    <PageLoader title="$($p.title)" endpoint="$($p.api)">
      {(data, reload) => (
        <DataTable
          rows={(data.$($p.rows) as Record<string, unknown>[]) || (data.rows as Record<string, unknown>[]) || []}
          exportPath="$($p.api)/export"
          onRefresh={reload}
        />
      )}
    </PageLoader>
  );
}
"@
  Set-Content -Path (Join-Path $dir "page.tsx") -Value $content -Encoding UTF8
}

Write-Host "Generated $($pages.Count) pages"
