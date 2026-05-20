'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { Flash } from '@/components/ui/Flash';
import { IconRenderer, ICON_MAP } from '@/components/ui/IconRenderer';

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
    <div
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        background: `url('/static/icons/Login Latar.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
      }}
    >
      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Card */}
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '40px 32px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35), 0 0 60px rgba(135, 206, 250, 0.1)',
          position: 'relative',
          zIndex: 10,
          border: '1px solid rgba(135, 206, 250, 0.1)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 64,
            height: 64,
            background: 'linear-gradient(135deg, #87CEFA 0%, #5DADE2 100%)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(135, 206, 250, 0.3)',
          }}
        >
          <IconRenderer icon={ICON_MAP.landmark_custom} size={36} />
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 800,
            textAlign: 'center',
            marginBottom: '4px',
            color: '#0F2744',
            letterSpacing: '-0.5px',
          }}
        >
          SIKOKAR
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '13px',
            color: '#64748B',
            textAlign: 'center',
            marginBottom: '28px',
            fontWeight: 500,
          }}
        >
          Sistem Informasi KOKARSI
        </p>

        {/* Flash Message */}
        <Flash message={msg} type={msgType} onClose={() => setMsg('')} />

        {/* Form */}
        <form onSubmit={onSubmit}>
          <div className="mb-3">
            <label className="fl">Username</label>
            <input
              className="form-control"
              placeholder="Masukkan username Anda"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              style={{
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                padding: '10px 12px',
                fontSize: '14px',
                transition: 'all 0.2s ease',
              }}
            />
          </div>

          <div className="mb-4">
            <label className="fl">Password</label>
            <div className="input-group">
              <input
                type={showPwd ? 'text' : 'password'}
                className="form-control"
                placeholder="Masukkan password Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  borderRadius: '8px 0 0 8px',
                  border: '1px solid #E2E8F0',
                  padding: '10px 12px',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                }}
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setShowPwd((s) => !s)}
                style={{
                  borderRadius: '0 8px 8px 0',
                  border: '1px solid #E2E8F0',
                  borderLeft: 'none',
                  color: '#64748B',
                }}
              >
                <i className={`bi bi-eye${showPwd ? '' : '-slash'}`} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn w-100 py-2 fw-bold"
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #87CEFA 0%, #5DADE2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(135, 206, 250, 0.3)',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            onMouseOver={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(135, 206, 250, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(135, 206, 250, 0.3)';
            }}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  style={{ width: '14px', height: '14px' }}
                />{' '}
                Memproses...
              </>
            ) : (
              'Masuk'
            )}
          </button>
        </form>

        {/* Footer */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #E2E8F0',
          }}
        >
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
            Hubungi administrator untuk akses
          </p>
        </div>
      </div>
    </div>
  );
}
