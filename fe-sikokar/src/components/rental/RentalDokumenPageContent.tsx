'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { today } from '@/lib/format';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';

type DokRow = {
  id: string;
  kendaraan_id: string;
  kendaraan_nama?: string;
  no_polisi?: string;
  jenis: string;
  no_dokumen?: string;
  tgl_terbit?: string;
  tgl_expired?: string;
  catatan?: string;
};

type KendaraanOpt = { id: string; nama: string; no_polisi?: string };

const JENIS_DOK = ['STNK', 'BPKB', 'SIM Driver', 'Kontrak Rental', 'Pajak Tahunan', 'KEUR', 'Asuransi', 'Lainnya'];

const btnStyle = { borderRadius: 6, fontSize: 12 };

const EMPTY = {
  id: '',
  kendaraan_id: '',
  jenis: 'STNK',
  no_dokumen: '',
  tgl_terbit: '',
  tgl_expired: '',
  catatan: '',
};

export function RentalDokumenPageContent() {
  const [rows, setRows] = useState<DokRow[]>([]);
  const [kendaraan, setKendaraan] = useState<KendaraanOpt[]>([]);
  const [expiring, setExpiring] = useState<DokRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState('success');
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{ rows: DokRow[]; kendaraan: KendaraanOpt[]; expiring: DokRow[] }>('/rental/dokumen')
      .then((r) => {
        setRows(r.rows || []);
        setKendaraan(r.kendaraan || []);
        setExpiring(r.expiring || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm({ ...EMPTY, kendaraan_id: kendaraan[0]?.id || '' });
  }

  function openAdd() {
    resetForm();
    setShowEdit(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post<{ message?: string }>('/rental/dokumen', form);
      setFlash(r.message || 'Dokumen disimpan');
      setFlashType('success');
      setShowEdit(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
      setFlashType('danger');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !rows.length && !err) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  return (
    <>
      {err && <Flash message={err} type="danger" />}
      {flash && <Flash message={flash} type={flashType} onClose={() => setFlash('')} />}

      <div className="pg-hdr">
        <div className="pg-hdr-left">
          <h2 style={{ display: 'flex', alignItems: 'center' }}>
            <IconRenderer icon={ICON_MAP.documentRental_custom} size={24} style={{ marginRight: 8 }} />
            Dokumen Rental
          </h2>
          <p>STNK, BPKB, kontrak, dan dokumen lainnya</p>
        </div>
        <div className="pg-hdr-right no-print">
          <button type="button" className="btn btn-sm btn-navy" style={btnStyle} onClick={openAdd}>
            Tambah
          </button>
        </div>
      </div>

      {expiring.length > 0 && (
        <div className="alert alert-danger" style={{ fontSize: 13 }}>
          <b>⚠️ Dokumen akan expired (60 hari):</b>{' '}
          {expiring.map((e) => (
            <span key={e.id} className="badge bg-danger me-1">
              {e.kendaraan_nama}: {e.jenis} → {e.tgl_expired}
            </span>
          ))}
        </div>
      )}

      <div className="tbl-wrap">
        <table className="table table-sm" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>Kendaraan</th>
              <th>Jenis</th>
              <th>No Dokumen</th>
              <th>Tgl Terbit</th>
              <th>Tgl Expired</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted py-3">
                  Belum ada dokumen
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">
                    {r.kendaraan_nama}{' '}
                    <span className="mono" style={{ fontSize: 9 }}>
                      {r.no_polisi}
                    </span>
                  </td>
                  <td>
                    <span className="bd bd-blue">{r.jenis}</span>
                  </td>
                  <td className="mono">{r.no_dokumen}</td>
                  <td style={{ fontSize: 10 }}>{r.tgl_terbit}</td>
                  <td
                    style={{
                      fontSize: 10,
                      color: r.tgl_expired && r.tgl_expired < today() ? '#DC2626' : undefined,
                      fontWeight: r.tgl_expired && r.tgl_expired < today() ? 700 : undefined,
                    }}
                  >
                    {r.tgl_expired}
                  </td>
                  <td style={{ fontSize: 10, color: '#64748B' }}>{r.catatan}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Dokumen Kendaraan" size="md">
        <form onSubmit={onSave}>
          <div className="modal-body">
            <div className="row g-2">
              <div className="col-12">
                <label className="fl">Kendaraan</label>
                <select
                  value={form.kendaraan_id}
                  onChange={(e) => setForm((f) => ({ ...f, kendaraan_id: e.target.value }))}
                  className="form-select form-select-sm"
                  required
                >
                  {kendaraan.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama} {k.no_polisi ? `(${k.no_polisi})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="fl">Jenis Dokumen</label>
                <select value={form.jenis} onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value }))} className="form-select form-select-sm">
                  {JENIS_DOK.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="fl">No Dokumen</label>
                <input value={form.no_dokumen} onChange={(e) => setForm((f) => ({ ...f, no_dokumen: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-6">
                <label className="fl">Tgl Terbit</label>
                <input type="date" value={form.tgl_terbit} onChange={(e) => setForm((f) => ({ ...f, tgl_terbit: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-md-6">
                <label className="fl">Tgl Expired</label>
                <input type="date" value={form.tgl_expired} onChange={(e) => setForm((f) => ({ ...f, tgl_expired: e.target.value }))} className="form-control form-control-sm" />
              </div>
              <div className="col-12">
                <label className="fl">Catatan</label>
                <input value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} className="form-control form-control-sm" />
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowEdit(false)} saving={saving} />
        </form>
      </Modal>
    </>
  );
}
