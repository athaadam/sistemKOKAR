'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtRp } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';

type Product = {
  id: string;
  kode: string;
  barcode?: string;
  nama: string;
  harga: number;
  stok: number;
  kategori?: string;
  is_taxable?: number;
  satuan?: string;
};

type CartItem = Product & { qty: number; diskon_pct: number; max: number };

type Promo = {
  id: string;
  nama: string;
  tipe: string;
  nilai: number;
  min_qty?: number;
  min_total?: number;
  member_only?: number;
  barang_id?: string;
  kategori?: string;
};

type HoldRow = { id: string; no: string; total: number };

type PiutangInfo = { limit: number; used: number; available: number };

const CHANNELS = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'qris', label: 'QRIS' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'kredit', label: 'Credit / Kredit Toko' },
  { value: 'potong_gaji', label: 'Credit / Potong Gaji' },
];

function rp(n: number) {
  return `Rp ${fmtRp(n)}`;
}

export default function TokoPage() {
  const [lokasiId, setLokasiId] = useState('L1');
  const [lokasiList, setLokasiList] = useState<{ id: string; nama: string }[]>([]);
  const [kats, setKats] = useState<{ kategori: string }[]>([]);
  const [kat, setKat] = useState('');
  const [q, setQ] = useState('');
  const [barcode, setBarcode] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pkp, setPkp] = useState(false);
  const [ppnRate, setPpnRate] = useState(0.11);
  const [diskonGlobal, setDiskonGlobal] = useState(0);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promoId, setPromoId] = useState('');
  const [promoDiskon, setPromoDiskon] = useState(0);
  const [holds, setHolds] = useState<HoldRow[]>([]);

  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [payOpen, setPayOpen] = useState(false);
  const [payErr, setPayErr] = useState('');
  const [channel, setChannel] = useState('cash');
  const [anggotaId, setAnggotaId] = useState('');
  const [anggotaList, setAnggotaList] = useState<{ id: string; no: string; nama: string; limit_kredit?: number }[]>([]);
  const [piutang, setPiutang] = useState<PiutangInfo | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const ppnPctLabel = Math.round(ppnRate * 100);

  useEffect(() => {
    api
      .get<{
        lokasi_id: string;
        lokasi_list: { id: string; nama: string }[];
        kats: { kategori: string }[];
        anggota_list: { id: string; no: string; nama: string; limit_kredit?: number }[];
        ppn_rate: number;
      }>('/toko')
      .then((r) => {
        setLokasiId(r.lokasi_id || 'L1');
        setLokasiList(r.lokasi_list || []);
        setKats(r.kats || []);
        setAnggotaList(r.anggota_list || []);
        setPpnRate(0.11);
      });
    api.get<{ rows: Promo[] }>('/toko/promo_active').then((r) => setPromos(r.rows || []));
    loadHolds();
  }, []);

  const loadProducts = useCallback(() => {
    const params = new URLSearchParams({ lokasi: lokasiId, q, kat });
    api.get<{ rows: Product[] }>(`/toko/products?${params}`).then((r) => setProducts(r.rows || []));
  }, [lokasiId, q, kat]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const loadHolds = useCallback(() => {
    api.get<{ rows: HoldRow[] }>('/toko/hold/list').then((r) => setHolds(r.rows || []));
  }, []);

  const calcPromoDiskon = useCallback(
    (items: CartItem[], selectedId: string, angId: string) => {
      if (!selectedId) return 0;
      const pr = promos.find((p) => p.id === selectedId);
      if (!pr) return 0;
      const subtotal = items.reduce((s, c) => s + c.harga * c.qty, 0);
      const totalQty = items.reduce((s, c) => s + c.qty, 0);
      if (pr.min_qty && totalQty < pr.min_qty) return 0;
      if (pr.min_total && subtotal < pr.min_total) return 0;
      if (pr.member_only && !angId) return 0;
      let basis = subtotal;
      if (pr.barang_id) {
        basis = items.filter((c) => c.id === pr.barang_id).reduce((s, c) => s + c.harga * c.qty, 0);
      } else if (pr.kategori) {
        basis = items.filter((c) => (c.kategori || '') === pr.kategori).reduce((s, c) => s + c.harga * c.qty, 0);
      }
      if (pr.tipe === 'persen') return Math.round((basis * pr.nilai) / 100);
      return Math.min(pr.nilai, basis);
    },
    [promos],
  );

  useEffect(() => {
    setPromoDiskon(calcPromoDiskon(cart, promoId, anggotaId));
  }, [cart, promoId, anggotaId, calcPromoDiskon]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let itemDisc = 0;
    let ppnTotal = 0;
    cart.forEach((c) => {
      const gross = c.harga * c.qty;
      const disc = gross * ((c.diskon_pct || 0) / 100);
      const net = gross - disc;
      const ppn = pkp && c.is_taxable ? net * ppnRate : 0;
      subtotal += gross;
      itemDisc += disc;
      ppnTotal += ppn;
    });
    const totalDisc = itemDisc + diskonGlobal + promoDiskon;
    const total = Math.max(0, subtotal - totalDisc + ppnTotal);
    return { subtotal, itemDisc, totalDisc, ppnTotal, total };
  }, [cart, diskonGlobal, promoDiskon, pkp, ppnRate]);

  const cartQty = cart.reduce((s, c) => s + c.qty, 0);
  const needsAnggota = channel === 'kredit' || channel === 'potong_gaji';

  function addToCart(p: Product) {
    if (p.stok <= 0) return;
    setCart((prev) => {
      const ex = prev.find((x) => x.id === p.id);
      if (ex) {
        if (ex.qty >= p.stok) {
          setMsg('Stok tidak cukup');
          setMsgType('danger');
          return prev;
        }
        return prev.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...prev, { ...p, qty: 1, diskon_pct: 0, max: p.stok }];
    });
  }

  function onBarcodeKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const bc = barcode.trim();
    if (!bc) return;
    const p = products.find((x) => x.barcode === bc || x.kode === bc);
    if (p) {
      addToCart(p);
      setMsg(`✓ ${p.nama}`);
      setMsgType('success');
    } else {
      setMsg(`Barcode "${bc}" tidak ditemukan`);
      setMsgType('danger');
    }
    setBarcode('');
  }

  function updQty(i: number, d: number) {
    setCart((c) => {
      const next = [...c];
      next[i] = { ...next[i], qty: next[i].qty + d };
      if (next[i].qty < 1) next.splice(i, 1);
      else if (next[i].qty > next[i].max) next[i].qty = next[i].max;
      return next;
    });
  }

  function setQty(i: number, v: number) {
    setCart((c) =>
      c.map((x, idx) =>
        idx === i ? { ...x, qty: Math.min(x.max, Math.max(1, v || 1)) } : x,
      ),
    );
  }

  function setDiskon(i: number, v: number) {
    setCart((c) =>
      c.map((x, idx) =>
        idx === i ? { ...x, diskon_pct: Math.min(100, Math.max(0, v || 0)) } : x,
      ),
    );
  }

  function removeItem(i: number) {
    setCart((c) => c.filter((_, idx) => idx !== i));
  }

  async function loadPiutang(aid: string) {
    if (!aid) {
      setPiutang(null);
      return;
    }
    try {
      const r = await api.get<PiutangInfo>(`/toko/piutang/${aid}`);
      setPiutang(r);
    } catch {
      setPiutang(null);
    }
  }

  function openPayModal() {
    setPayErr('');
    setChannel('cash');
    setAnggotaId('');
    setPiutang(null);
    setPayOpen(true);
  }

  useEffect(() => {
    if (payOpen && needsAnggota && anggotaId) loadPiutang(anggotaId);
    if (!needsAnggota) setPiutang(null);
  }, [payOpen, needsAnggota, anggotaId]);

  function onPromoChange(id: string) {
    const pr = promos.find((p) => p.id === id);
    if (pr?.member_only && !anggotaId) {
      setMsg(`Promo "${pr.nama}" hanya untuk anggota. Pilih anggota dahulu.`);
      setMsgType('warning');
      setPromoId('');
      return;
    }
    setPromoId(id);
  }

  async function holdCart() {
    if (!cart.length) return;
    try {
      const r = await api.post<{ ok?: boolean; no?: string; message?: string }>('/toko/hold', {
        items_json: JSON.stringify(cart),
        total: totals.total,
        lokasi_id: lokasiId,
        anggota_id: anggotaId || null,
      });
      if (r.ok === false) throw new Error(r.message || 'Gagal hold');
      setMsg(`Transaksi di-hold: ${r.no}`);
      setMsgType('success');
      setCart([]);
      loadHolds();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal hold');
      setMsgType('danger');
    }
  }

  async function loadHold(id: string) {
    try {
      const r = await api.get<{ ok?: boolean; items?: CartItem[]; anggota_id?: string }>(`/toko/hold/load/${id}`);
      if (r.items) {
        setCart(
          r.items.map((it) => ({
            ...it,
            max: it.max ?? it.stok ?? 999,
            diskon_pct: it.diskon_pct ?? 0,
          })),
        );
      }
      if (r.anggota_id) setAnggotaId(r.anggota_id);
      loadHolds();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal load hold');
      setMsgType('danger');
    }
  }

  async function checkout() {
    setPayErr('');
    if (needsAnggota && !anggotaId) {
      setPayErr('Pilih anggota untuk Credit/Potong Gaji');
      return;
    }
    setCheckingOut(true);
    try {
      const jenis = needsAnggota ? channel : 'cash';
      const r = await api.post<{ ok?: boolean; message?: string; pj_id?: string; no?: string; total?: number }>(
        '/toko/checkout',
        {
          lokasi_id: lokasiId,
          jenis,
          payment_channel: channel,
          anggota_id: needsAnggota ? anggotaId : null,
          pkp,
          diskon_global: diskonGlobal,
          promo_id: promoId,
          promo_diskon: promoDiskon,
          items: cart.map((it) => ({
            id: it.id,
            nama: it.nama,
            qty: it.qty,
            harga: it.harga,
            diskon_pct: it.diskon_pct,
            is_taxable: it.is_taxable,
            kategori: it.kategori,
          })),
        },
      );
      if (r.ok === false) throw new Error(r.message || 'Checkout gagal');
      setMsg(`✅ ${r.no} — ${rp(Number(r.total ?? totals.total))} berhasil!`);
      setMsgType('success');
      setCart([]);
      setPromoId('');
      setPayOpen(false);
      if (r.pj_id) window.open(`/toko/struk/${r.pj_id}`, '_blank', 'width=420,height=600');
      loadProducts();
      loadHolds();
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Checkout gagal';
      setPayErr(m);
    } finally {
      setCheckingOut(false);
    }
  }

  const limPct = piutang && piutang.limit > 0 ? Math.min((piutang.used / piutang.limit) * 100, 100) : 0;

  return (
    <>
      <Flash message={msg} type={msgType} onClose={() => setMsg('')} />

      <div
        className="d-flex gap-3"
        style={{ height: 'calc(100vh - 120px)', minHeight: 480 }}
      >
        {/* LEFT: products */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
            <div className="d-flex align-items-center gap-2">
              <IconRenderer icon={ICON_MAP.store_custom} size={16} />
              <select
                className="form-select form-select-sm"
                style={{ width: 180, borderRadius: 6 }}
                value={lokasiId}
                onChange={(e) => {
                  setLokasiId(e.target.value);
                  setCart([]);
                }}
              >
                {lokasiList.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nama}
                  </option>
                ))}
              </select>
            </div>
            <div
              className="d-flex align-items-center gap-2 flex-grow-1"
              style={{
                background: '#fff',
                border: '2px solid #0F2744',
                borderRadius: 6,
                padding: '5px 10px',
                maxWidth: 320,
              }}
            >
              <IconRenderer icon={ICON_MAP.scanBarcode_custom} size={16} />
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={onBarcodeKey}
                placeholder="Scan barcode / kode & Enter..."
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: 12.5, background: 'transparent' }}
              />
            </div>
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Cari produk..."
              style={{ width: 200, borderRadius: 6 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="d-flex gap-1 mb-3 flex-wrap">
            <button
              type="button"
              className={`btn btn-sm kat-btn ${kat === '' ? 'btn-navy' : 'btn-outline-secondary'}`}
              style={{ borderRadius: 6, fontSize: 12 }}
              onClick={() => setKat('')}
            >
              Semua
            </button>
            {kats.map((k) => (
              <button
                key={k.kategori}
                type="button"
                className={`btn btn-sm ${kat === k.kategori ? 'btn-navy' : 'btn-outline-secondary'}`}
                style={{ borderRadius: 6, fontSize: 12 }}
                onClick={() => setKat(k.kategori)}
              >
                {k.kategori}
              </button>
            ))}
          </div>

          <div className="row g-2">
            {products.length === 0 && (
              <div className="col-12 text-center text-muted py-4" style={{ fontSize: 12 }}>
                📦 Tidak ada produk tersedia
              </div>
            )}
            {products.map((p) => (
              <div key={p.id} className="col-12 col-md-6 col-xl-4">
                <button
                  type="button"
                  className="card h-100 w-100 text-start pos-prod-card"
                  style={{
                    borderRadius: 8,
                    cursor: p.stok > 0 ? 'pointer' : 'not-allowed',
                    border: '1.5px solid #E2E8F0',
                    position: 'relative',
                    opacity: p.stok > 0 ? 1 : 0.6,
                  }}
                  onClick={() => addToCart(p)}
                  disabled={p.stok <= 0}
                >
                  <div className="card-body p-2">
                    <div
                      style={{
                        fontSize: 9.5,
                        color: '#64748B',
                        position: 'absolute',
                        top: 6,
                        right: 8,
                        fontFamily: 'ui-monospace, monospace',
                      }}
                    >
                      {p.barcode || p.kode}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 3, lineHeight: 1.2 }}>{p.nama}</div>
                    <div className="mono" style={{ fontSize: 11.5, color: '#0F2744', fontWeight: 800 }}>
                      {rp(p.harga)}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                      Stok: {p.stok} {p.satuan || 'PCS'}
                    </div>
                    {p.is_taxable ? (
                      <span className="bd bd-amber" style={{ fontSize: 9, marginTop: 3, display: 'inline-block' }}>
                        PPN
                      </span>
                    ) : null}
                  </div>
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 p-3" style={{ background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <label className="d-flex align-items-center gap-2 mb-0" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pkp}
                onChange={(e) => setPkp(e.target.checked)}
                style={{ accentColor: '#0F2744', width: 15, height: 15 }}
              />
              <span className="fw-semibold" style={{ fontSize: 13 }}>
                Mode PKP — Hitung PPN {ppnPctLabel}% untuk item bertanda PPN
              </span>
            </label>
          </div>
        </div>

        {/* RIGHT: cart */}
        <div
          style={{
            width: 360,
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
            <span className="fw-bold" style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconRenderer icon={ICON_MAP.shoppingCart_custom} size={16} />
              Keranjang
            </span>
            <span className="bd bd-navy">{cartQty} item</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {cart.length === 0 ? (
              <div className="text-center text-muted py-4" style={{ fontSize: 12 }}>
                Scan barcode atau klik produk untuk mulai
              </div>
            ) : (
              cart.map((c, i) => {
                const gross = c.harga * c.qty;
                const disc = gross * ((c.diskon_pct || 0) / 100);
                const net = gross - disc;
                const linePpn = pkp && c.is_taxable ? net * ppnRate : 0;
                return (
                  <div key={c.id} style={{ padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3, lineHeight: 1.2 }}>{c.nama}</div>
                    <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'ui-monospace, monospace' }}>
                      {rp(c.harga)} × {c.qty} = {rp(gross)}
                    </div>
                    <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => updQty(i, -1)}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          border: '1px solid #CBD5E1',
                          background: '#F8FAFC',
                          fontSize: 13,
                          lineHeight: 1,
                        }}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={c.qty}
                        min={1}
                        max={c.max}
                        onChange={(e) => setQty(i, parseInt(e.target.value, 10) || 1)}
                        style={{
                          width: 44,
                          textAlign: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                          border: '1px solid #CBD5E1',
                          borderRadius: 4,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => updQty(i, 1)}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          border: '1px solid #CBD5E1',
                          background: '#F8FAFC',
                          fontSize: 13,
                        }}
                      >
                        +
                      </button>
                      <span style={{ fontSize: 10.5, color: '#64748B' }}>Disc%</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={c.diskon_pct || ''}
                        onChange={(e) => setDiskon(i, Number(e.target.value))}
                        placeholder="0"
                        style={{
                          width: 44,
                          border: '1px solid #CBD5E1',
                          borderRadius: 4,
                          fontSize: 11,
                        }}
                      />
                      {disc > 0 && <span style={{ fontSize: 10.5, color: '#DC2626' }}>-{rp(disc)}</span>}
                      {linePpn > 0 && <span style={{ fontSize: 10.5, color: '#D97706' }}>+{rp(linePpn)}</span>}
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#94A3B8', fontSize: 13 }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ padding: 12, borderTop: '1px solid #F1F5F9' }}>
            <div className="d-flex justify-content-between mb-1" style={{ fontSize: 12 }}>
              <span className="text-muted">Subtotal</span>
              <span className="mono">{rp(totals.subtotal)}</span>
            </div>
            {totals.totalDisc > 0 && (
              <div className="d-flex justify-content-between mb-1" style={{ fontSize: 12, color: '#DC2626' }}>
                <span>Total Diskon</span>
                <span className="mono">-{rp(totals.totalDisc)}</span>
              </div>
            )}
            {totals.ppnTotal > 0 && (
              <div className="d-flex justify-content-between mb-2" style={{ fontSize: 12, color: '#D97706' }}>
                <span>PPN ({ppnPctLabel}%)</span>
                <span className="mono">{rp(totals.ppnTotal)}</span>
              </div>
            )}

            <div className="d-flex align-items-center gap-2 mb-2">
              <label style={{ fontSize: 11.5, color: '#7C3AED', whiteSpace: 'nowrap', fontWeight: 600 }}>🏷️ Promo</label>
              <select
                className="form-select form-select-sm"
                style={{ borderRadius: 5, fontSize: 11.5 }}
                value={promoId}
                onChange={(e) => onPromoChange(e.target.value)}
              >
                <option value="">— Tanpa Promo —</option>
                {promos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} ({p.tipe === 'persen' ? `${p.nilai}%` : rp(p.nilai)})
                  </option>
                ))}
              </select>
            </div>
            {promoDiskon > 0 && (
              <div className="d-flex justify-content-between mb-1" style={{ fontSize: 12, color: '#7C3AED' }}>
                <span>Promo</span>
                <span className="mono">-{rp(promoDiskon)}</span>
              </div>
            )}
            <div className="d-flex align-items-center gap-2 mb-2">
              <label style={{ fontSize: 11.5, color: '#64748B', whiteSpace: 'nowrap' }}>Diskon Global (Rp)</label>
              <input
                type="number"
                className="form-control form-control-sm"
                min={0}
                value={diskonGlobal}
                onChange={(e) => setDiskonGlobal(Number(e.target.value) || 0)}
                style={{ borderRadius: 5 }}
              />
            </div>

            <div className="d-flex justify-content-between mb-3 fw-bold">
              <span>TOTAL BAYAR</span>
              <span className="mono" style={{ fontSize: 20, color: '#0F2744' }}>
                {rp(totals.total)}
              </span>
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary fw-bold"
                style={{ borderRadius: 8, fontSize: 12, width: '38%' }}
                disabled={!cart.length}
                onClick={holdCart}
              >
                Hold
              </button>
              <button
                type="button"
                className="btn btn-navy fw-bold"
                style={{ borderRadius: 8, fontSize: 14, width: '62%' }}
                disabled={!cart.length}
                onClick={openPayModal}
              >
                Proses Bayar →
              </button>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-info w-100 mt-2"
              style={{ borderRadius: 8 }}
              onClick={loadHolds}
            >
              Lihat Pending Bill
            </button>
            <div className="mt-2" style={{ fontSize: 11 }}>
              {holds.length === 0 ? (
                <div className="text-muted">Tidak ada pending bill</div>
              ) : (
                holds.map((h) => (
                  <div key={h.id} className="d-flex justify-content-between border rounded p-1 mb-1">
                    <span>
                      {h.no} — {rp(h.total)}
                    </span>
                    <button type="button" className="btn btn-sm btn-link p-0" onClick={() => loadHold(h.id)}>
                      Load
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Konfirmasi Pembayaran" size="md">
        <div className="modal-body pt-0">
          {payErr && (
            <div className="alert alert-danger py-2 mb-3" style={{ fontSize: 12.5, borderRadius: 8 }}>
              {payErr}
            </div>
          )}
          <div className="mb-3">
            <label className="fl">Channel Pembayaran</label>
            <select
              className="form-select form-select-sm"
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value);
                setPayErr('');
              }}
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
              Kredit toko dan potong gaji dipilih dari channel pembayaran, bukan tombol terpisah.
            </div>
          </div>

          {needsAnggota && (
            <div className="mb-2">
              <label className="fl">Anggota*</label>
              <select
                className="form-select form-select-sm mb-2"
                value={anggotaId}
                onChange={(e) => setAnggotaId(e.target.value)}
              >
                <option value="">-- Pilih Anggota --</option>
                {anggotaList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nama} ({a.no})
                  </option>
                ))}
              </select>
              {piutang && anggotaId && (
                <div className="p-3 mb-2" style={{ background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE', fontSize: 12.5 }}>
                  <div className="fw-bold mb-1" style={{ color: '#0F2744' }}>
                    Limit Kredit Global
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>
                      Terpakai: <b>{rp(piutang.used)}</b>
                    </span>
                    <span>
                      Limit: <b>{rp(piutang.limit)}</b>
                    </span>
                  </div>
                  <div className="prog mt-2">
                    <div
                      className={`prog-fill ${limPct > 85 ? 'pf-red' : 'pf-navy'}`}
                      style={{ width: `${limPct}%` }}
                    />
                  </div>
                  <div className="mt-1 fw-bold" style={{ color: '#0F2744' }}>
                    Sisa: {rp(piutang.available)}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-3" style={{ background: '#F8FAFC', borderRadius: 8, fontSize: 12.5 }}>
            {cart.map((c) => {
              const gross = c.harga * c.qty;
              const disc = gross * ((c.diskon_pct || 0) / 100);
              const linePpn = pkp && c.is_taxable ? (gross - disc) * ppnRate : 0;
              return (
                <div key={c.id}>
                  <div className="d-flex justify-content-between" style={{ padding: '3px 0' }}>
                    <span>
                      {c.nama} ×{c.qty}
                    </span>
                    <span className="mono">{rp(gross)}</span>
                  </div>
                  {disc > 0 && (
                    <div className="d-flex justify-content-between" style={{ paddingLeft: 12, fontSize: 11, color: '#DC2626' }}>
                      <span>Diskon {c.diskon_pct}%</span>
                      <span>-{rp(disc)}</span>
                    </div>
                  )}
                  {linePpn > 0 && (
                    <div className="d-flex justify-content-between" style={{ paddingLeft: 12, fontSize: 11, color: '#D97706' }}>
                      <span>PPN {ppnPctLabel}%</span>
                      <span>{rp(linePpn)}</span>
                    </div>
                  )}
                </div>
              );
            })}
            <hr style={{ borderColor: '#E2E8F0', margin: '6px 0' }} />
            {totals.totalDisc > 0 && (
              <div className="d-flex justify-content-between" style={{ fontSize: 12, color: '#DC2626' }}>
                <span>Total Diskon</span>
                <span>-{rp(totals.totalDisc)}</span>
              </div>
            )}
            <div className="d-flex justify-content-between fw-bold" style={{ fontSize: 15, marginTop: 4 }}>
              <span>TOTAL BAYAR</span>
              <span className="mono" style={{ color: '#0F2744' }}>
                {rp(totals.total)}
              </span>
            </div>
          </div>
        </div>
        <ModalFooter
          onCancel={() => setPayOpen(false)}
          onSubmit={checkout}
          saving={checkingOut}
          submitLabel="✅ Proses & Cetak Struk"
        />
      </Modal>
    </>
  );
}
