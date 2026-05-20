'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { Flash } from '@/components/ui/Flash';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('danger');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      const r = await login(username, password);
      setMsg(r.message || 'Login berhasil');
      setMsgType('success');
      router.push('/dashboard');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Login gagal');
      setMsgType('danger');
    } finally {
      setLoading(false);
    }
  }

  return (
    <body style={{ fontFamily: 'Inter, system-ui, sans-serif', background: 'linear-gradient(135deg,#0F2744 0%,#1E3A5F 50%,#0F2744 100%)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
        <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 12px' }}>🏛️</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 2 }}>SIKOKAR</h1>
        <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginBottom: 24 }}>
          Sistem Informasi KOKARSI <span style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>v1.5</span>
        </p>
        <Flash message={msg} type={msgType} onClose={() => setMsg('')} />
        <form onSubmit={onSubmit}>
          <div className="mb-3">
            <label className="fl">Username</label>
            <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </div>
          <div className="mb-3">
            <label className="fl">Password</label>
            <div className="input-group">
              <input type={showPwd ? 'text' : 'password'} className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPwd((s) => !s)}>
                <i className={`bi bi-eye${showPwd ? '' : '-slash'}`} />
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-navy w-100 py-2 fw-bold" disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 11, color: '#CBD5E1' }}>Demo: admin / admin123</p>
      </div>
    </body>
  );
}
