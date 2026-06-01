import GlassCard from './GlassCard';
import { User } from '../services/api';

interface Props {
  user: User;
  onNavigate: (view: any) => void;
  pastSessions: any[];
  scoreHistory: number[];
  showScores: boolean;
  onToggleScores: () => void;
  onFetchAnalytics: () => void;
}

export default function Dashboard({
  user,
  onNavigate,
  pastSessions,
  scoreHistory,
  showScores,
  onToggleScores,
  onFetchAnalytics
}: Props) {
  const userGreeting = user.email ? user.email.split('@')[0] : 'User';
  
  // Format today's date
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="dashboard-layout" style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header Greeting */}
      <div className="dashboard-greeting" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="dashboard-greeting-label" style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            ⚡ Active Biometric Session Sync
          </span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
            Hi, {userGreeting} 👋
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0' }}>
            Today is {today} • Start a new mock evaluation session or review secure analytical trends.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="ai-pulse" title="AI active processing" style={{ width: '8px', height: '8px', background: '#c4c0ff', borderRadius: '50%', boxShadow: '0 0 10px #c4c0ff' }}></div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>System Active</span>
        </div>
      </div>

      {/* Feature Bento Grid */}
      <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        <GlassCard onClick={() => onNavigate('review')} className="feature-card" hoverGlow>
          <div className="feature-card-icon" style={{ fontSize: '24px', width: '44px', height: '44px', background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.25)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📄</div>
          <div className="feature-tag" style={{ width: 'fit-content', padding: '4px 8px', borderRadius: '999px', background: 'rgba(108,99,255,0.1)', color: 'var(--primary-dim)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>New</div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '8px 0 4px' }}>Resume Review</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px', flex: 1 }}>
            Upload a PDF resume and get immediate AI feedback on formatting, keyword optimizations, and target role alignments.
          </p>
          <button type="button" className="primary" style={{ cursor: 'pointer', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold' }}>
            Start review
          </button>
        </GlassCard>

        <GlassCard onClick={() => onNavigate('interview-setup')} className="feature-card" hoverGlow>
          <div className="feature-card-icon" style={{ fontSize: '24px', width: '44px', height: '44px', background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.25)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎤</div>
          <div className="feature-tag" style={{ width: 'fit-content', padding: '4px 8px', borderRadius: '999px', background: 'rgba(79,70,229,0.1)', color: '#a5b4fc', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Coach</div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '8px 0 4px' }}>Mock Interview</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px', flex: 1 }}>
            Practice standard domain prompts with real-time video face expression scanner telemetry and structural vocal evaluations.
          </p>
          <button type="button" className="ghost" style={{ cursor: 'pointer', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold' }}>
            Launch session
          </button>
        </GlassCard>

        <GlassCard 
          onClick={() => {
            onFetchAnalytics();
            onNavigate('analytics');
          }} 
          className="feature-card" 
          hoverGlow
        >
          <div className="feature-card-icon" style={{ fontSize: '24px', width: '44px', height: '44px', background: 'rgba(0,255,200,0.12)', border: '1px solid rgba(0,255,200,0.25)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📊</div>
          <div className="feature-tag" style={{ width: 'fit-content', padding: '4px 8px', borderRadius: '999px', background: 'rgba(0,255,200,0.1)', color: '#00ffc8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Secure</div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '8px 0 4px' }}>Telemetry Diagnostics</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px', flex: 1 }}>
            Deep dive into cumulative stress levels, engagement index timelines, vocal fluency scores, and historical improvement logs.
          </p>
          <button type="button" className="ghost" style={{ cursor: 'pointer', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold' }}>
            View analytics
          </button>
        </GlassCard>

      </div>

      {/* Main split-screen details block */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Score History card */}
        <GlassCard className="section-card" style={{ flex: 2 }}>
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div className="section-title" style={{ fontSize: '18px', fontWeight: 700 }}>Performance Timeline</div>
              <div className="section-subtitle" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Track your overall AI score trends across cumulative prep evaluations.
              </div>
            </div>
            <button type="button" className="ghost" onClick={onToggleScores} style={{ padding: '6px 12px', fontSize: '12px' }}>
              {showScores ? 'Collapse graph' : 'Expand graph'}
            </button>
          </div>

          {showScores ? (
            <div className="scores-graph" role="img" aria-label="Interview score history">
              {(pastSessions.length ? [...pastSessions].reverse().map(s => s.overallScore || 0) : scoreHistory).map((score, i) => (
                <div key={`${score}-${i}`} className="score-bar">
                  <div style={{ height: `${score}%` }} />
                  <span>{score}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-faint)' }}>Score trend graph is collapsed. Press Expand Graph above to view.</p>
            </div>
          )}
        </GlassCard>

        {/* Recent Session Logs */}
        <GlassCard className="section-card" style={{ flex: 1.2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Recent Evaluations</h3>
            <button type="button" className="ghost" onClick={() => onNavigate('analytics')} style={{ padding: '6px 12px', fontSize: '12px' }}>See All</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pastSessions.slice(0, 3).map((session, index) => {
              const dateStr = new Date(session.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });
              
              return (
                <div 
                  key={session.id || index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.04)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', background: 'rgba(108, 99, 255, 0.1)', color: 'var(--primary-dim)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                      <span style={{ fontSize: '8px', opacity: 0.7 }}>SEC</span>
                      <span>#{pastSessions.length - index}</span>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: 'bold', margin: 0 }}>{session.domain}</h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-faint)', margin: '2px 0 0' }}>{dateStr} • Telemetry</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#00ffc8' }}>{session.overallScore || 'N/A'}%</span>
                  </div>
                </div>
              );
            })}
            
            {!pastSessions.length && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)', textAlign: 'center', padding: '16px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-faint)' }}>No past sessions found. Start your first mock interview above!</p>
              </div>
            )}
          </div>
        </GlassCard>

      </div>

    </div>
  );
}
