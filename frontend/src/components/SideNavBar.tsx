import { User } from '../services/api';

interface Props {
  currentView: string;
  onChangeView: (view: any) => void;
  user: User | null;
  onLogout: () => void;
  onFetchAnalytics?: () => void;
}

export default function SideNavBar({ currentView, onChangeView, user, onLogout, onFetchAnalytics }: Props) {
  if (!user) return null;

  const userInitial = user.email ? user.email[0].toUpperCase() : '?';

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: 'dashboard' },
    { id: 'review', label: 'Resume Review', icon: 'description' },
    { id: 'interview-setup', label: 'Mock Interviews', icon: 'record_voice_over' },
    { id: 'analytics', label: 'Telemetry', icon: 'query_stats' }
  ];

  const handleNavClick = (id: string) => {
    if (id === 'analytics' && onFetchAnalytics) {
      onFetchAnalytics();
    }
    onChangeView(id);
  };

  return (
    <aside 
      className="sidenav"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '260px',
        backgroundColor: 'rgba(19, 19, 24, 0.4)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        padding: '24px',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 50,
        flexShrink: 0
      }}
    >
      {/* Brand Header */}
      <div 
        className="brand-header" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          padding: '8px 0', 
          marginBottom: '40px',
          cursor: 'pointer'
        }}
        onClick={() => onChangeView('dashboard')}
      >
        <div 
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(108, 99, 255, 0.3)'
          }}
        >
          <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '20px' }}>
            record_voice_over
          </span>
        </div>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--primary)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>
            InterviewAI
          </h1>
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', margin: '2px 0 0', fontWeight: 'bold', opacity: 0.6 }}>
            Precision Prep
          </p>
        </div>
      </div>

      {/* Main Navigation Links */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {navItems.map((item) => {
          const isActive = currentView === item.id || 
            (item.id === 'review' && currentView === 'results') ||
            (item.id === 'interview-setup' && (currentView === 'interview-question' || currentView === 'interview-results'));

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className="ghost"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                textAlign: 'left',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isActive ? 'rgba(108, 99, 255, 0.15)' : 'transparent',
                color: isActive ? 'var(--primary-dim)' : 'var(--text-muted)',
                borderColor: isActive ? 'rgba(108, 99, 255, 0.25)' : 'transparent',
                transition: 'all 0.3s ease',
                fontWeight: isActive ? 700 : 500
              }}
            >
              <span 
                className="material-symbols-outlined" 
                style={{ 
                  fontSize: '20px',
                  fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0"
                }}
              >
                {item.icon}
              </span>
              <span style={{ fontSize: '14px' }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User & Footer */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <button 
          className="btn-primary" 
          onClick={() => onChangeView('analytics')}
          style={{
            padding: '12px',
            fontSize: '14px',
            fontWeight: 700,
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(108, 99, 255, 0.2)'
          }}
        >
          Pro Diagnostics
        </button>
        
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px' }}>
            <div 
              style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '13px'
              }}
            >
              {userInitial}
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>Alex</div>
              <div style={{ fontSize: '10px', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
            </div>
          </div>

          <button 
            onClick={onLogout} 
            className="ghost"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              color: '#fca5a5'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
