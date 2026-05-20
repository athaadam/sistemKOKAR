'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/menu';
import { Flash } from '@/components/ui/Flash';
import { Modal } from '@/components/crud/Modal';
import { ModalFooter } from '@/components/crud/ListPageChrome';

const TABS: [string, string][] = [
  ['param', '⚙️ Parameter'],
  ['user', '👥 Pengguna'],
  ['lokasi', '🏪 Lokasi'],
  ['master', '📋 Master Data'],
  ['backup', '💾 Backup'],
];

const PARAM_FIELDS = [
  ['nama_kop', 'Nama Koperasi', 'text'],
  ['telp', 'Telepon', 'text'],
  ['nama_toko1', 'Nama Toko 1', 'text'],
  ['nama_toko2', 'Nama Toko 2', 'text'],
  ['alamat', 'Alamat', 'text'],
  ['print_header1', 'Header Print Baris 1', 'text'],
  ['print_header2', 'Header Print Baris 2', 'text'],
  ['ppn_rate', 'PPN (%)', 'number'],
  ['pph21_rate', 'PPh 21 Dasar (%)', 'number'],
  ['pph23_rate', 'PPh 23 Jasa (%)', 'number'],
  ['bunga_regular', 'Bunga Regular (%/bln)', 'number'],
  ['bunga_darurat', 'Bunga Darurat (%/bln)', 'number'],
  ['limit_approval_pinjaman', 'Batas Otomatis Cairkan (Rp)', 'number'],
  ['max_loans', 'Max Pinjaman Aktif Default', 'number'],
] as const;

type UserRow = {
  id: string;
  username: string;
  name: string;
  nip?: string;
  role: string;
  lokasi_id?: string | null;
  custom_menus?: string;
  aktif?: number;
};

type LokasiRow = { id: string; kode: string; nama: string; jenis: string; aktif?: number };
type MasterGroup = { key: string; title: string; icon: string; rows: { id: string; value: string; label: string }[] };

export function SettingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'param';

  const [params, setParams] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<UserRow[]>([]);
  const [lokasiList, setLokasiList] = useState<LokasiRow[]>([]);
  const [masterGroups, setMasterGroups] = useState<MasterGroup[]>([]);
  const [allMenus, setAllMenus] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState<'success' | 'danger'>('success');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingParams, setSavingParams] = useState(false);

  const [showUser, setShowUser] = useState(false);
  const [userForm, setUserForm] = useState({
    id: '', username: '', name: '', nip: '', password: '', role: 'kasir', lokasi_id: '', aktif: true, custom_menus: [] as string[],
  });
  const [userTitle, setUserTitle] = useState('Tambah User');
  const [savingUser, setSavingUser] = useState(false);

  const [showLokasi, setShowLokasi] = useState(false);
  const [lokasiForm, setLokasiForm] = useState({ id: '', kode_id: '', kode: '', nama: '', jenis: 'toko', aktif: true });
  const [lokasiTitle, setLokasiTitle] = useState('Tambah Lokasi');
  const [savingLokasi, setSavingLokasi] = useState(false);

  const [masterEdits, setMasterEdits] = useState<Record<string, { id: string; value: string; label: string }>>({});

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api
      .get<{
        params: Record<string, string>;
        users: UserRow[];
        lokasi_list: LokasiRow[];
        master_groups: MasterGroup[];
        ALL_MENUS: string[];
      }>(`/setting?tab=${encodeURIComponent(tab)}`)
      .then((r) => {
        setParams(r.params || {});
        setUsers(r.users || []);
        setLokasiList(r.lokasi_list || []);
        setMasterGroups(r.master_groups || []);
        setAllMenus(r.ALL_MENUS || []);
        const lp = r.params?.logo_path;
        setLogoPreview(lp ? `/${lp.replace(/^\/+/, '')}` : null);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  function goTab(t: string) {
    router.push(`/setting?tab=${t}`);
  }

  async function saveParams(e: FormEvent) {
    e.preventDefault();
    setSavingParams(true);
    setFlash('');
    try {
      const fd = new FormData();
      for (const [key] of PARAM_FIELDS) fd.append(key, params[key] ?? '');
      if (logoFile) fd.append('logo_file', logoFile);
      const r = await api.postForm<{ message?: string }>('/setting/params/save', fd);
      setFlash(r.message || 'Parameter disimpan');
      setFlashType('success');
      setLogoFile(null);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
      setFlashType('danger');
    } finally {
      setSavingParams(false);
    }
  }

  function resetUser() {
    setUserTitle('Tambah User');
    setUserForm({ id: '', username: '', name: '', nip: '', password: '', role: 'kasir', lokasi_id: '', aktif: true, custom_menus: [] });
    setShowUser(true);
  }

  function editUser(u: UserRow) {
    setUserTitle(`Edit User: ${u.username}`);
    setUserForm({
      id: u.id,
      username: u.username,
      name: u.name,
      nip: u.nip || '',
      password: '',
      role: u.role,
      lokasi_id: u.lokasi_id || '',
      aktif: u.aktif !== 0,
      custom_menus: (u.custom_menus || '').split(',').filter(Boolean),
    });
    setShowUser(true);
  }

  async function saveUser(e: FormEvent) {
    e.preventDefault();
    setSavingUser(true);
    try {
      const r = await api.post<{ message?: string }>('/setting/user/save', {
        ...userForm,
        aktif: userForm.aktif ? 1 : 0,
        custom_menus: userForm.custom_menus,
      });
      setFlash(r.message || 'User tersimpan');
      setFlashType('success');
      setShowUser(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan user');
      setFlashType('danger');
    } finally {
      setSavingUser(false);
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('Hapus user ini?')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/setting/user/delete/${id}`);
      setFlash(r.message || 'User dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menghapus');
      setFlashType('danger');
    }
  }

  function resetLokasi() {
    setLokasiTitle('Tambah Lokasi');
    setLokasiForm({ id: '', kode_id: '', kode: '', nama: '', jenis: 'toko', aktif: true });
    setShowLokasi(true);
  }

  function editLokasi(l: LokasiRow) {
    setLokasiTitle(`Edit Lokasi: ${l.nama}`);
    setLokasiForm({ id: l.id, kode_id: l.id, kode: l.kode, nama: l.nama, jenis: l.jenis || 'toko', aktif: l.aktif !== 0 });
    setShowLokasi(true);
  }

  async function saveLokasi(e: FormEvent) {
    e.preventDefault();
    setSavingLokasi(true);
    try {
      const r = await api.post<{ message?: string }>('/lokasi/save', {
        ...lokasiForm,
        aktif: lokasiForm.aktif ? 1 : 0,
      });
      setFlash(r.message || 'Lokasi tersimpan');
      setFlashType('success');
      setShowLokasi(false);
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan lokasi');
      setFlashType('danger');
    } finally {
      setSavingLokasi(false);
    }
  }

  async function deleteLokasi(id: string) {
    if (!confirm('Hapus lokasi ini? Semua data stok terkait akan ikut terhapus.')) return;
    try {
      const r = await api.delete<{ message?: string }>(`/lokasi/${id}`);
      setFlash(r.message || 'Lokasi dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menghapus');
      setFlashType('danger');
    }
  }

  async function saveMaster(e: FormEvent, groupKey: string) {
    e.preventDefault();
    const m = masterEdits[groupKey] || { id: '', value: '', label: '' };
    if (!m.value || !m.label) return;
    try {
      const r = await api.post<{ message?: string }>('/ref_option/save', { ...m, group_key: groupKey });
      setFlash(r.message || 'Master data tersimpan');
      setFlashType('success');
      setMasterEdits((prev) => ({ ...prev, [groupKey]: { id: '', value: '', label: '' } }));
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menyimpan');
      setFlashType('danger');
    }
  }

  async function deleteMaster(id: string) {
    if (!confirm('Hapus pilihan ini?')) return;
    try {
      await api.delete(`/ref_option/${id}`);
      setFlash('Pilihan dihapus');
      setFlashType('success');
      load();
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Gagal menghapus');
      setFlashType('danger');
    }
  }

  async function backupNow() {
    try {
      const r = await api.get<{ message?: string; file?: string }>('/setting/backup_now');
      setFlash(r.message || 'Backup selesai');
      setFlashType('success');
    } catch (ex) {
      setFlash(ex instanceof Error ? ex.message : 'Backup gagal');
      setFlashType('danger');
    }
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;
  if (err) return <Flash message={err} type="danger" />;

  const h1Preview = params.print_header1 || params.nama_kop || 'Koperasi';
  const h2Preview = params.print_header2 || params.alamat || '';

  return (
    <>
      <Flash message={flash} type={flashType} onClose={() => setFlash('')} />
      <div className="pg-hdr">
        <div className="pg-hdr-left"><h2>⚙️ Pengaturan Sistem v1.5</h2></div>
      </div>

      <ul className="nav nav-tabs mb-0">
        {TABS.map(([id, label]) => (
          <li className="nav-item" key={id}>
            <button
              type="button"
              className={`nav-link ${tab === id ? 'active fw-semibold' : ''}`}
              style={{
                fontSize: 12.5,
                padding: '7px 14px',
                borderRadius: '6px 6px 0 0',
                border: 'none',
                background: tab === id ? '#fff' : 'transparent',
                color: tab === id ? '#0F2744' : '#64748B',
              }}
              onClick={() => goTab(id)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '0 8px 8px 8px', padding: 20 }}>
        {tab === 'param' && (
          <form onSubmit={saveParams}>
            <h6 className="text-muted text-uppercase border-bottom pb-1 mb-3" style={{ fontSize: 12, fontWeight: 700 }}>Identitas Koperasi</h6>
            <div className="row g-3">
              {PARAM_FIELDS.slice(0, 5).map(([key, label, type]) => (
                <div className={key === 'alamat' ? 'col-md-6' : 'col-md-3'} key={key}>
                  <label className="fl">{label}</label>
                  <input
                    type={type}
                    className="form-control form-control-sm"
                    value={params[key] || ''}
                    onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <h6 className="text-muted text-uppercase border-bottom pb-1 mb-3 mt-2" style={{ fontSize: 12, fontWeight: 700 }}>Custom Logo & Header Print</h6>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="fl">Logo Koperasi</label>
                <div className="p-3 rounded text-center" style={{ border: '2px dashed #CBD5E1', background: '#FAFAFA', minHeight: 100 }}>
                  {logoPreview && <img src={logoPreview} alt="logo" style={{ maxHeight: 70, maxWidth: 140, borderRadius: 6, marginBottom: 6 }} />}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.gif,.svg,.webp"
                    className="form-control form-control-sm mt-2"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setLogoFile(f || null);
                      if (f) setLogoPreview(URL.createObjectURL(f));
                    }}
                  />
                </div>
              </div>
              <div className="col-md-5">
                {PARAM_FIELDS.slice(5, 7).map(([key, label]) => (
                  <div className="mb-2" key={key}>
                    <label className="fl">{label}</label>
                    <input
                      className="form-control form-control-sm"
                      value={params[key] || ''}
                      placeholder={key === 'print_header1' ? params.nama_kop : params.alamat}
                      onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="col-md-3">
                <label className="fl">Preview Header Print</label>
                <div className="d-flex align-items-center gap-2 p-2 border rounded" style={{ borderColor: '#0F2744', borderWidth: 2, minHeight: 90 }}>
                  {logoPreview ? <img src={logoPreview} alt="" style={{ maxHeight: 48, maxWidth: 70 }} /> : <div style={{ width: 48, height: 48, background: '#0F2744', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏛️</div>}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: '#0F2744' }}>{h1Preview}</div>
                    <div style={{ fontSize: 10, color: '#555' }}>{h2Preview}</div>
                  </div>
                </div>
              </div>
            </div>

            <h6 className="text-muted text-uppercase border-bottom pb-1 mb-3 mt-2" style={{ fontSize: 12, fontWeight: 700 }}>Tarif Pajak & Parameter Pinjaman</h6>
            <div className="row g-3">
              {PARAM_FIELDS.slice(7).map(([key, label, type]) => (
                <div className="col-md-3" key={key}>
                  <label className="fl">{label}</label>
                  <input
                    type={type}
                    step={type === 'number' ? '0.1' : undefined}
                    className="form-control form-control-sm"
                    value={params[key] || ''}
                    onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="btn btn-navy mt-3" style={{ borderRadius: 6 }} disabled={savingParams}>
              <i className="bi bi-save me-1" /> {savingParams ? 'Menyimpan...' : 'Simpan Parameter'}
            </button>
          </form>
        )}

        {tab === 'user' && (
          <>
            <div className="d-flex justify-content-between mb-3">
              <h6 className="mb-0" style={{ fontSize: 14 }}>Daftar Pengguna ({users.length})</h6>
              <button type="button" className="btn btn-sm btn-navy" style={{ borderRadius: 6 }} onClick={resetUser}>
                <i className="bi bi-person-plus me-1" /> Tambah User
              </button>
            </div>
            <div className="tbl-wrap">
              <table className="table table-sm">
                <thead><tr><th>Username</th><th>Nama</th><th>NIP</th><th>Role</th><th>Lokasi</th><th>Aktif</th><th>Aksi</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td><span className="mono">{u.username}</span></td>
                      <td className="fw-semibold">{u.name}</td>
                      <td><span className="mono" style={{ fontSize: 11 }}>{u.nip || '—'}</span></td>
                      <td><span className={`bd ${u.role === 'admin' ? 'bd-red' : u.role === 'pengurus' ? 'bd-blue' : 'bd-gray'}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
                      <td style={{ fontSize: 11 }}>{u.lokasi_id || '—'}</td>
                      <td>{u.aktif ? <span className="bd bd-green">Ya</span> : <span className="bd bd-gray">Tidak</span>}</td>
                      <td>
                        <button type="button" className="btn btn-act btn-outline-primary me-1" onClick={() => editUser(u)}><i className="bi bi-pencil" /></button>
                        <button type="button" className="btn btn-act btn-outline-danger" onClick={() => deleteUser(u.id)}><i className="bi bi-trash" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'lokasi' && (
          <>
            <div className="d-flex justify-content-between mb-3">
              <h6 className="mb-0" style={{ fontSize: 14 }}>Daftar Lokasi / Toko ({lokasiList.length})</h6>
              <button type="button" className="btn btn-sm btn-navy" style={{ borderRadius: 6 }} onClick={resetLokasi}>
                <i className="bi bi-plus-lg me-1" /> Tambah Lokasi
              </button>
            </div>
            <div className="tbl-wrap">
              <table className="table table-sm">
                <thead><tr><th>ID</th><th>Kode</th><th>Nama Lokasi</th><th>Jenis</th><th>Aktif</th><th>Aksi</th></tr></thead>
                <tbody>
                  {lokasiList.map((l) => (
                    <tr key={l.id}>
                      <td><span className="mono">{l.id}</span></td>
                      <td><span className="mono fw-bold">{l.kode}</span></td>
                      <td className="fw-semibold">{l.nama}</td>
                      <td><span className={`bd ${l.jenis === 'toko' ? 'bd-blue' : 'bd-gray'}`}>{l.jenis}</span></td>
                      <td>{l.aktif ? <span className="bd bd-green">Ya</span> : <span className="bd bd-gray">Tidak</span>}</td>
                      <td>
                        <button type="button" className="btn btn-act btn-outline-primary me-1" onClick={() => editLokasi(l)}><i className="bi bi-pencil" /></button>
                        <button type="button" className="btn btn-act btn-outline-danger" onClick={() => deleteLokasi(l.id)}><i className="bi bi-trash" /></button>
                      </td>
                    </tr>
                  ))}
                  {!lokasiList.length && <tr><td colSpan={6} className="text-center text-muted py-3">Belum ada lokasi</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'master' && (
          <div className="row g-3">
            {masterGroups.map((grp) => {
              const m = masterEdits[grp.key] || { id: '', value: '', label: '' };
              return (
                <div className="col-md-6" key={grp.key}>
                  <div className="card" style={{ border: '1px solid #E2E8F0', borderRadius: 8 }}>
                    <div className="card-header d-flex justify-content-between align-items-center" style={{ background: '#F8FAFC' }}>
                      <h6 className="mb-0" style={{ fontSize: 13, fontWeight: 700 }}>{grp.icon} {grp.title}</h6>
                      <span className="bd bd-gray">{grp.rows.length} item</span>
                    </div>
                    <div className="card-body" style={{ padding: 12 }}>
                      <form className="row g-2 mb-2" onSubmit={(e) => saveMaster(e, grp.key)}>
                        <div className="col-md-5"><input className="form-control form-control-sm" placeholder="Kode" value={m.value} onChange={(e) => setMasterEdits((p) => ({ ...p, [grp.key]: { ...m, value: e.target.value } }))} required /></div>
                        <div className="col-md-5"><input className="form-control form-control-sm" placeholder="Label" value={m.label} onChange={(e) => setMasterEdits((p) => ({ ...p, [grp.key]: { ...m, label: e.target.value } }))} required /></div>
                        <div className="col-md-2"><button type="submit" className="btn btn-sm btn-navy w-100"><i className="bi bi-plus-lg" /></button></div>
                      </form>
                      <div className="table-responsive" style={{ maxHeight: 280 }}>
                        <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
                          <thead><tr><th>Kode</th><th>Label</th><th className="text-end">Aksi</th></tr></thead>
                          <tbody>
                            {grp.rows.map((o) => (
                              <tr key={o.id}>
                                <td className="mono">{o.value}</td>
                                <td>{o.label}</td>
                                <td className="text-end">
                                  <button type="button" className="btn btn-act btn-outline-primary me-1" onClick={() => setMasterEdits((p) => ({ ...p, [grp.key]: { id: o.id, value: o.value, label: o.label } }))}><i className="bi bi-pencil" /></button>
                                  <button type="button" className="btn btn-act btn-outline-danger" onClick={() => deleteMaster(o.id)}><i className="bi bi-trash" /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'backup' && (
          <div className="p-3" style={{ background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <h6>💾 Backup Database</h6>
            <p style={{ fontSize: 13, color: '#64748B' }}>Download dump MySQL atau simpan salinan ke folder backup server.</p>
            <div className="d-flex gap-2 flex-wrap">
              <a href={api.exportUrl('/setting/backup')} className="btn btn-navy" style={{ borderRadius: 6 }}>
                <i className="bi bi-download me-1" /> Download Backup DB
              </a>
              <button type="button" className="btn btn-outline-secondary" style={{ borderRadius: 6 }} onClick={backupNow}>
                Backup ke Server
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={showUser} title={userTitle} onClose={() => setShowUser(false)} size="lg">
        <form onSubmit={saveUser}>
          <div className="row g-2">
            <div className="col-md-5">
              <label className="fl">Username *</label>
              <input className="form-control form-control-sm" value={userForm.username} onChange={(e) => setUserForm((f) => ({ ...f, username: e.target.value }))} required disabled={!!userForm.id} />
            </div>
            <div className="col-md-7">
              <label className="fl">Nama Lengkap *</label>
              <input className="form-control form-control-sm" value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="col-md-6">
              <label className="fl">NIP</label>
              <input className="form-control form-control-sm" value={userForm.nip} onChange={(e) => setUserForm((f) => ({ ...f, nip: e.target.value }))} />
            </div>
            <div className="col-md-6">
              <label className="fl">Password {userForm.id && <span className="text-muted" style={{ fontSize: 10 }}>(kosong = tidak berubah)</span>}</label>
              <input type="password" className="form-control form-control-sm" value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="col-md-4">
              <label className="fl">Role</label>
              <select className="form-select form-select-sm" value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="fl">Lokasi</label>
              <select className="form-select form-select-sm" value={userForm.lokasi_id} onChange={(e) => setUserForm((f) => ({ ...f, lokasi_id: e.target.value }))}>
                <option value="">— Semua —</option>
                {lokasiList.map((l) => <option key={l.id} value={l.id}>{l.nama}</option>)}
              </select>
            </div>
            <div className="col-md-4 d-flex align-items-end pb-1">
              <div className="form-check">
                <input type="checkbox" className="form-check-input" checked={userForm.aktif} onChange={(e) => setUserForm((f) => ({ ...f, aktif: e.target.checked }))} id="u_aktif" />
                <label htmlFor="u_aktif" className="form-check-label" style={{ fontSize: 12 }}>Aktif</label>
              </div>
            </div>
            <div className="col-12">
              <label className="fl">Akses Menu Khusus (kosong = default role)</label>
              <div className="row g-1">
                {allMenus.map((m) => (
                  <div className="col-md-3 col-6" key={m}>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`cm_${m}`}
                        checked={userForm.custom_menus.includes(m)}
                        onChange={(e) => {
                          setUserForm((f) => ({
                            ...f,
                            custom_menus: e.target.checked
                              ? [...f.custom_menus, m]
                              : f.custom_menus.filter((x) => x !== m),
                          }));
                        }}
                      />
                      <label htmlFor={`cm_${m}`} className="form-check-label" style={{ fontSize: 11.5 }}>{m}</label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowUser(false)} saving={savingUser} />
        </form>
      </Modal>

      <Modal open={showLokasi} title={lokasiTitle} onClose={() => setShowLokasi(false)}>
        <form onSubmit={saveLokasi}>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="fl">ID Lokasi</label>
              <input className="form-control form-control-sm" value={lokasiForm.kode_id} onChange={(e) => setLokasiForm((f) => ({ ...f, kode_id: e.target.value }))} placeholder="mis: L4" disabled={!!lokasiForm.id} />
            </div>
            <div className="col-md-4">
              <label className="fl">Kode *</label>
              <input className="form-control form-control-sm" value={lokasiForm.kode} onChange={(e) => setLokasiForm((f) => ({ ...f, kode: e.target.value }))} required />
            </div>
            <div className="col-md-8">
              <label className="fl">Nama Lokasi *</label>
              <input className="form-control form-control-sm" value={lokasiForm.nama} onChange={(e) => setLokasiForm((f) => ({ ...f, nama: e.target.value }))} required />
            </div>
            <div className="col-md-4">
              <label className="fl">Jenis</label>
              <select className="form-select form-select-sm" value={lokasiForm.jenis} onChange={(e) => setLokasiForm((f) => ({ ...f, jenis: e.target.value }))}>
                <option value="toko">Toko</option>
                <option value="gudang">Gudang</option>
                <option value="kantor">Kantor</option>
              </select>
            </div>
            <div className="col-md-4 d-flex align-items-end pb-1">
              <div className="form-check">
                <input type="checkbox" className="form-check-input" checked={lokasiForm.aktif} onChange={(e) => setLokasiForm((f) => ({ ...f, aktif: e.target.checked }))} id="lok_aktif" />
                <label htmlFor="lok_aktif" className="form-check-label" style={{ fontSize: 12 }}>Aktif</label>
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowLokasi(false)} saving={savingLokasi} />
        </form>
      </Modal>
    </>
  );
}
