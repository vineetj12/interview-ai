import React from 'react';

interface Status {
  type: 'idle' | 'success' | 'error';
  message: string;
}

interface Props {
  mode: 'login' | 'register';
  setMode: (mode: 'login' | 'register') => void;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  status: Status;
  loading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  apiBase: string;
}

export default function AuthPanel({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  status,
  loading,
  onSubmit,
  apiBase
}: Props) {
  const title = mode === 'login' ? 'Welcome back' : 'Create account';
  const subtitle = mode === 'login' 
    ? 'Sign in to continue your interview prep.' 
    : 'Register once, keep your progress synced.';

  return (
    <div className="auth-panel" style={{ maxWidth: '440px', width: '100%' }}>
      {/* Tab Selectors */}
      <div className="tabs" role="tablist" aria-label="Auth modes" style={{ display: 'flex', gap: '4px' }}>
        <button 
          type="button" 
          className={mode === 'login' ? 'active' : ''} 
          onClick={() => setMode('login')} 
          role="tab" 
          aria-selected={mode === 'login'}
        >
          Login
        </button>
        <button 
          type="button" 
          className={mode === 'register' ? 'active' : ''} 
          onClick={() => setMode('register')} 
          role="tab" 
          aria-selected={mode === 'register'}
        >
          Register
        </button>
      </div>

      <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>{title}</h2>
          <p className="panel-subtitle" style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{subtitle}</p>
        </div>

        <form onSubmit={onSubmit} className="form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
            EMAIL ADDRESS
            <input 
              type="email" 
              name="email" 
              autoComplete="email" 
              placeholder="you@domain.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '12px 16px',
                color: 'var(--text)',
                outline: 'none',
                fontSize: '14px'
              }}
            />
          </label>
          
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
            PASSWORD
            <input 
              type="password" 
              name="password" 
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} 
              placeholder="At least 8 characters" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              minLength={8}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '12px 16px',
                color: 'var(--text)',
                outline: 'none',
                fontSize: '14px'
              }}
            />
          </label>

          <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {status.message && (
          <div className={`status ${status.type}`} role="status">
            {status.type === 'success' ? '✔' : '❌'} {status.message}
          </div>
        )}

        <div className="auth-footer" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', fontSize: '11px', color: 'var(--text-faint)' }}>
          <span>Secure API Endpoint</span>
          <strong>{apiBase}</strong>
        </div>
      </div>
    </div>
  );
}
