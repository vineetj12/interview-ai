import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import { TrendingUp, Activity, Award, CheckCircle } from "lucide-react";

interface Pattern {
  pattern_type: string;
  count: number;
  avg_stress: number;
  avg_engagement: number;
  avg_score: number;
  recommendation: string;
}

interface AnalyticsData {
  totalSessions: number;
  averageScore: number;
  stressTrend: Array<{
    date: string;
    overallScore: number;
    stress: number;
    engagement: number;
    bodyLanguage: number;
  }>;
  behavioralPatterns: Pattern[];
}

interface Props {
  data: AnalyticsData | null;
  loading: boolean;
}

export default function AnalyticsDashboard({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="section-card loading-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div className="status transcribing">⏳ Syncing secure telemetry & analyzing behavioral patterns...</div>
      </div>
    );
  }

  if (!data || data.totalSessions === 0) {
    return (
      <div className="section-card" style={{ padding: '40px', textAlign: 'center' }}>
        <h3>No analytics data available yet</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '400px', margin: '8px auto 0' }}>
          Complete your first mock interview session to unlock advanced stress telemetry trends and behavioral pattern clustering!
        </p>
      </div>
    );
  }

  // Calculate radar data for overall averages
  const latestSession = data.stressTrend[data.stressTrend.length - 1] || {};
  const radarData = [
    { name: "Performance", value: latestSession.overallScore || 50 },
    { name: "Engagement", value: latestSession.engagement || 50 },
    { name: "Calmness", value: 100 - (latestSession.stress || 50) },
    { name: "Body Language", value: latestSession.bodyLanguage || 50 },
  ];

  return (
    <div className="analytics-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Overview Stats */}
      <div className="overview-stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="feature-card" style={{ margin: 0, padding: '20px', position: 'relative' }}>
          <div className="feature-card-icon" style={{ fontSize: '24px' }}>🎤</div>
          <h4 style={{ margin: '8px 0 4px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Prep Sessions</h4>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff' }}>{data.totalSessions}</div>
          <span style={{ fontSize: '11px', color: '#00ffc8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
            <CheckCircle size={12} /> Active Telemetry Enabled
          </span>
        </div>

        <div className="feature-card" style={{ margin: 0, padding: '20px', position: 'relative' }}>
          <div className="feature-card-icon" style={{ fontSize: '24px' }}>🏆</div>
          <h4 style={{ margin: '8px 0 4px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average AI Score</h4>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff' }}>{data.averageScore}%</div>
          <span style={{ fontSize: '11px', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
            <Award size={12} /> High Recruiter Standout
          </span>
        </div>

        <div className="feature-card" style={{ margin: 0, padding: '20px', position: 'relative' }}>
          <div className="feature-card-icon" style={{ fontSize: '24px' }}>⚡</div>
          <h4 style={{ margin: '8px 0 4px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peak Calmness</h4>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff' }}>
            {Math.round(100 - (data.stressTrend.reduce((acc, curr) => acc + curr.stress, 0) / data.stressTrend.length))}%
          </div>
          <span style={{ fontSize: '11px', color: '#00ffc8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
            <Activity size={12} /> Low-Stress Composure
          </span>
        </div>
      </div>

      {/* Main Charts Block */}
      <div className="charts-block-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        {/* Trend Line Chart */}
        <div className="section-card" style={{ margin: 0, padding: '20px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
            <TrendingUp size={18} color="#00ffc8" /> Telemetry Progress & Composure Trends
          </h3>
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer>
              <LineChart data={data.stressTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(20, 20, 28, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line name="AI Score" type="monotone" dataKey="overallScore" stroke="#00ffc8" strokeWidth={2.5} activeDot={{ r: 6 }} />
                <Line name="Stress level" type="monotone" dataKey="stress" stroke="#ff4466" strokeWidth={2} />
                <Line name="Engagement" type="monotone" dataKey="engagement" stroke="#a78bfa" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Bio Chart */}
        <div className="section-card" style={{ margin: 0, padding: '20px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
            <Activity size={18} color="#a78bfa" /> Latest Bio-metric Composition
          </h3>
          <div style={{ width: '100%', height: '240px', display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="name" stroke="rgba(255,255,255,0.6)" fontSize={10} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(255,255,255,0.2)" fontSize={8} />
                <Radar name="Composition" dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Behavioral Patterns Card */}
      <div className="section-card" style={{ margin: 0, padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#00ffc8' }}>
          🧠 Advanced AI Behavioral Pattern Mining
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
          Our custom backend ML pipelines analyzed your cumulative eye contact, posture stability, blink frequency, and micro-expression distributions to identify your natural interview archetype.
        </p>

        <div className="patterns-list" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          {data.behavioralPatterns.map((p, idx) => (
            <div
              key={`${p.pattern_type}-${idx}`}
              className="review-card"
              style={{
                margin: 0,
                borderLeft: '4px solid #00ffc8',
                backgroundColor: 'rgba(255,255,255,0.02)',
                padding: '20px',
                borderRadius: '0 12px 12px 0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>
                  {p.pattern_type}
                </h4>
                <span className="badge" style={{ backgroundColor: 'rgba(0, 255, 200, 0.1)', color: '#00ffc8', borderColor: 'rgba(0, 255, 200, 0.2)' }}>
                  Detected in {p.count} session(s)
                </span>
              </div>

              <div className="metrics-pill-row" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Avg Stress: <strong style={{ color: '#ff4466' }}>{Math.round(p.avg_stress)}%</strong>
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Avg Engagement: <strong style={{ color: '#00ffc8' }}>{Math.round(p.avg_engagement)}%</strong>
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Avg Performance Score: <strong style={{ color: '#a78bfa' }}>{Math.round(p.avg_score)}/100</strong>
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '13px', color: '#e0e0e0', lineHeight: '1.5' }}>
                💡 <strong>Expert Action Plan:</strong> {p.recommendation}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
