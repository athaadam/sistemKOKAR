'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtRp, today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';

type ItemRow = {
  ket: string;
  qty: string;
  harga: string;
};

function calcAll(
  rows: ItemRow[],
  diskon: number,
  applyPpn: boolean,
  applyPph: boolean,
  ppnPct: number,
  pphPct: number,
) {
  const items = rows.map((r) => {
    const qty = Number(r.qty) || 1;
    const harga = Number(r.harga) || 0;
    return { ket: r.ket, qty, harga, subtotal: qty * harga };
  });
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const afterDisc = Math.max(0, subtotal - diskon);
  const ppn = applyPpn ? Math.round(afterDisc * (ppnPct / 100)) : 0;
  const pph = applyPph ? Math.round(afterDisc * (pphPct / 100)) : 0;
  const total = afterDisc + ppn - pph;
  return { items, subtotal, ppn, pph, total };
}

export function KwitansiNewPageContent() {
  const router = useRouter();
  const [ppnPct, setPpnPct] = useState(12);
  const [pphPct, setPphPct] = useState(2);
  const [tipe, setTipe] = useState('kwitansi');
  const [tgl, setTgl] = useState(today());
  const [penerima, setPenerima] = useState('');
  const [perusahaan, setPerusahaan] = useState('');
  const [catatan, setCatatan] = useState('');
  const [diskon, setDiskon] = useState(0);
  const [applyPpn, setApplyPpn] = useState(false);
  const [applyPph, setApplyPph] = useState(false);
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ ket: '', qty: '1', harga: '' }]);
  const [totals, setTotals] = useState({ subtotal: 0, ppn: 0, pph: 0, total: 0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api
      .get<{ ppn_rate: number; pph23_rate: number }>('/kwitansi/new')
      .then((r) => {
        setPpnPct(Number(r.ppn_rate) || 12);
        setPphPct(Number(r.pph23_rate) || 2);
      })
      .catch((e) => setErr(e.message));
  }, []);

  function recalc(
    rows: ItemRow[],
    d: number,
    ppnOn: boolean,
    pphOn: boolean,
  ) {
    const t = calcAll(rows, d, ppnOn, pphOn, ppnPct, pphPct);
    setTotals({ subtotal: t.subtotal, ppn: t.ppn, pph: t.pph, total: t.total });
    return t;
  }

  function updateRow(idx: number, patch: Partial<ItemRow>) {
    const next = itemRows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setItemRows(next);
    recalc(next, diskon, applyPpn, applyPph);
  }

  function addItemRow() {
    const next = [...itemRows, { ket: '', qty: '1', harga: '' }];
    setItemRows(next);
  }

  function removeItemRow(idx: number) {
    if (itemRows.length <= 1) return;
    const next = itemRows.filter((_, i) => i !== idx);
    setItemRows(next);
    recalc(next, diskon, applyPpn, applyPph);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = calcAll(itemRows, diskon, applyPpn, applyPph, ppnPct, pphPct);
    if (!penerima.trim()) {
      setErr('Penerima harus diisi');
      return;
    }
    if (!t.items.some((i) => i.ket.trim() && i.harga > 0)) {
      setErr('Minimal satu item dengan harga');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const r = await api.post<{ message?: string; id?: string }>('/kwitansi/new', {
        tipe,
        tgl,
        penerima,
        perusahaan,
        items_json: JSON.stringify(t.items),
        subtotal: t.subtotal,
        diskon,
        ppn: t.ppn,
        pph: t.pph,
        catatan,
      });
      if (r.id) router.push(`/kwitansi/${r.id}`);
      else router.push('/kwitansi');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {err && <Flash message={err} type="danger" onClose={() => setErr('')} />}

      <form onSubmit={onSubmit} id="kwForm">
        <div className="row g-3">
          <div className="col-md-5">
            <div className="card" style={{ borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div className="card-body p-3">
                <h6 style={{ fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 12 }}>
                  Header Dokumen
                </h6>
                <div className="mb-2">
                  <label className="form-label fl">Jenis Dokumen</label>
                  <select
                    className="form-select form-select-sm"
                    value={tipe}
                    onChange={(e) => setTipe(e.target.value)}
                  >
                    <option value="kwitansi">Kwitansi</option>
                    <option value="invoice">Invoice</option>
                  </select>
                </div>
                <div className="mb-2">
                  <label className="form-label fl">Tanggal</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={tgl}
                    onChange={(e) => setTgl(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label fl">Penerima / Pembayar *</label>
                  <input
                    className="form-control form-control-sm"
                    value={penerima}
                    onChange={(e) => setPenerima(e.target.value)}
                    required
                    placeholder="Nama penerima / klien"
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label fl">Nama Perusahaan</label>
                  <input
                    className="form-control form-control-sm"
                    value={perusahaan}
                    onChange={(e) => setPerusahaan(e.target.value)}
                    placeholder="PT. / CV. (opsional)"
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label fl">Catatan</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={2}
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Keterangan tambahan"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-7">
            <div className="card" style={{ borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 style={{ fontSize: 13, fontWeight: 700, color: '#0F2744', margin: 0 }}>
                    Item / Rincian
                  </h6>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    style={{ borderRadius: 6, fontSize: 11 }}
                    onClick={addItemRow}
                  >
                    <i className="bi bi-plus-lg me-1" />
                    Tambah Item
                  </button>
                </div>

                {itemRows.map((row, idx) => {
                  const qty = Number(row.qty) || 1;
                  const harga = Number(row.harga) || 0;
                  const lineTotal = qty * harga;
                  return (
                    <div
                      key={idx}
                      className="d-flex gap-1 mb-1 align-items-start item-row"
                    >
                      <div style={{ flex: 3 }}>
                        <input
                          className="form-control form-control-sm"
                          placeholder="Uraian / keterangan"
                          value={row.ket}
                          onChange={(e) => updateRow(idx, { ket: e.target.value })}
                          required
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min={1}
                          value={row.qty}
                          onChange={(e) => updateRow(idx, { qty: e.target.value })}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min={0}
                          placeholder="Harga"
                          value={row.harga}
                          onChange={(e) => updateRow(idx, { harga: e.target.value })}
                        />
                      </div>
                      <div
                        className="item-total-disp text-end fw-semibold"
                        style={{
                          flex: 2,
                          minWidth: 80,
                          paddingTop: 6,
                          fontSize: 12,
                          color: '#0F2744',
                        }}
                      >
                        {Math.round(lineTotal).toLocaleString('id-ID')}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        style={{ padding: '4px 7px' }}
                        onClick={() => removeItemRow(idx)}
                      >
                        <i className="bi bi-x" />
                      </button>
                    </div>
                  );
                })}

                <hr style={{ margin: '10px 0' }} />

                <div className="row g-1">
                  <div className="col-6 text-end" style={{ fontSize: 12, paddingTop: 6 }}>
                    Subtotal:
                  </div>
                  <div className="col-6">
                    <input
                      type="number"
                      className="form-control form-control-sm text-end"
                      readOnly
                      value={totals.subtotal}
                      style={{ background: '#F8FAFC', fontWeight: 'bold' }}
                    />
                  </div>
                  <div className="col-6 text-end" style={{ fontSize: 12, paddingTop: 6 }}>
                    Diskon (Rp):
                  </div>
                  <div className="col-6">
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      min={0}
                      value={diskon}
                      onChange={(e) => {
                        const d = Number(e.target.value) || 0;
                        setDiskon(d);
                        recalc(itemRows, d, applyPpn, applyPph);
                      }}
                    />
                  </div>
                  <div className="col-6">
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        id="cb_ppn"
                        checked={applyPpn}
                        onChange={(e) => {
                          setApplyPpn(e.target.checked);
                          recalc(itemRows, diskon, e.target.checked, applyPph);
                        }}
                      />
                      <label htmlFor="cb_ppn" style={{ fontSize: 12, margin: 0 }}>
                        PPN {ppnPct}%
                      </label>
                    </div>
                  </div>
                  <div className="col-6">
                    <input
                      type="number"
                      className="form-control form-control-sm text-end"
                      readOnly
                      value={totals.ppn}
                      style={{ background: '#F8FAFC' }}
                    />
                  </div>
                  <div className="col-6">
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        id="cb_pph"
                        checked={applyPph}
                        onChange={(e) => {
                          setApplyPph(e.target.checked);
                          recalc(itemRows, diskon, applyPpn, e.target.checked);
                        }}
                      />
                      <label htmlFor="cb_pph" style={{ fontSize: 12, margin: 0 }}>
                        PPh 23 {pphPct}%
                      </label>
                    </div>
                  </div>
                  <div className="col-6">
                    <input
                      type="number"
                      className="form-control form-control-sm text-end"
                      readOnly
                      value={totals.pph}
                      style={{ background: '#F8FAFC' }}
                    />
                  </div>
                  <div
                    className="col-6 text-end fw-bold"
                    style={{ fontSize: 13, paddingTop: 8 }}
                  >
                    TOTAL:
                  </div>
                  <div className="col-6">
                    <div
                      className="p-2 rounded fw-bold text-center"
                      style={{ background: '#0F2744', color: '#fff', fontSize: 16 }}
                    >
                      Rp {fmtRp(totals.total)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex gap-2 mt-3">
          <button
            type="submit"
            className="btn btn-navy btn-sm"
            style={{ borderRadius: 6, padding: '8px 20px' }}
            disabled={saving}
          >
            <i className="bi bi-save me-1" />
            {saving ? 'Menyimpan...' : 'Simpan & Print'}
          </button>
          <Link href="/kwitansi" className="btn btn-outline-secondary btn-sm" style={{ borderRadius: 6 }}>
            Batal
          </Link>
        </div>
      </form>
    </>
  );
}
