import type { CVMetrics } from '../hooks/useWebcamCV'

interface Props {
  metrics: CVMetrics
}

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <div className="score-ring-wrap">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 36 36)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        <text x="36" y="38" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">{value}</text>
      </svg>
      <span className="score-ring-label">{label}</span>
    </div>
  )
}

function MetricRow({ icon, label, value, detail, color }: { icon: string; label: string; value: string; detail?: string; color?: string }) {
  return (
    <div className="metric-row">
      <span className="metric-icon">{icon}</span>
      <div className="metric-text">
        <span className="metric-label">{label}</span>
        {detail && <span className="metric-detail">{detail}</span>}
      </div>
      <span className="metric-value" style={{ color: color || '#e0e0e0' }}>{value}</span>
    </div>
  )
}

export default function TelemetryDashboard({ metrics }: Props) {
  const gazeColor = metrics.gaze.score >= 70 ? '#00ffc8' : metrics.gaze.score >= 40 ? '#ffaa00' : '#ff4466'
  const postureColor = metrics.posture.score >= 70 ? '#00ffc8' : metrics.posture.score >= 40 ? '#ffaa00' : '#ff4466'
  const stressColor = metrics.stress.level <= 30 ? '#00ffc8' : metrics.stress.level <= 55 ? '#ffaa00' : '#ff4466'
  const engageColor = metrics.engagement >= 65 ? '#00ffc8' : metrics.engagement >= 40 ? '#ffaa00' : '#ff4466'

  return (
    <div className="telemetry-dashboard">
      <h4 className="telemetry-title">
        <span className="telemetry-dot" /> CV Diagnostics — Live
      </h4>

      {/* Score rings row */}
      <div className="score-rings">
        <ScoreRing value={metrics.gaze.score} label="Eye Contact" color={gazeColor} />
        <ScoreRing value={metrics.posture.score} label="Posture" color={postureColor} />
        <ScoreRing value={Math.max(0, 100 - metrics.stress.level)} label="Calm" color={stressColor} />
        <ScoreRing value={metrics.engagement} label="Engage" color={engageColor} />
        <ScoreRing value={metrics.overallBodyLanguage} label="Body Lang" color="#a78bfa" />
      </div>

      {/* Detailed metrics */}
      <div className="metrics-list" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
        <MetricRow icon="💡" label="Lighting" value={metrics.lighting.label}
          detail={`Lum: ${metrics.lighting.level}`}
          color={metrics.lighting.label === 'Good' ? '#00ffc8' : '#ffaa00'} />

        <MetricRow icon="👁" label="Gaze" value={metrics.gaze.direction.toUpperCase()}
          detail={`Score: ${metrics.gaze.score}%`} color={gazeColor} />

        <MetricRow icon="🧍" label="Posture" value={metrics.posture.label}
          detail={`Score: ${metrics.posture.score}`} color={postureColor} />

        <MetricRow icon="😊" label="Emotion" value={metrics.emotion.dominant}
          detail={`Conf: ${Math.round(metrics.emotion.confidence * 100)}%`} />

        <MetricRow icon="👀" label="Blink Rate" value={`${metrics.blink.rate}/min`}
          detail={metrics.blink.rate > 25 ? 'High — nervousness' : metrics.blink.rate < 8 ? 'Low — focused' : 'Normal'}
          color={metrics.blink.rate > 25 ? '#ff4466' : '#00ffc8'} />

        <MetricRow icon="😄" label="Smile" value={metrics.smile.detected ? (metrics.smile.authentic ? 'Genuine ✓' : 'Polite') : 'None'}
          detail={`Intensity: ${Math.round(metrics.smile.intensity)}%`}
          color={metrics.smile.authentic ? '#00ffc8' : '#e0e0e0'} />

        <MetricRow icon="🤝" label="Head Nod" value={metrics.headNod.detected ? 'Active ✓' : 'Inactive'}
          detail={`Freq: ${metrics.headNod.frequency.toFixed(1)}`}
          color={metrics.headNod.detected ? '#00ffc8' : '#ffaa00'} />

        <MetricRow icon="🔥" label="Stress" value={`${metrics.stress.level}%`}
          detail={metrics.stress.label} color={stressColor} />

        <MetricRow icon="🏠" label="Background" value={metrics.background.label}
          color={metrics.background.label === 'Clean' ? '#00ffc8' : '#ffaa00'} />

        <MetricRow icon="👔" label="Grooming" value={metrics.grooming.label}
          color={metrics.grooming.label === 'Formal' ? '#00ffc8' : '#e0e0e0'} />

        <MetricRow icon="🎯" label="Engagement" value={`${metrics.engagement}%`}
          color={engageColor} />

        <MetricRow icon="⚡" label="Motion" value={metrics.motion.isStill ? 'Still' : 'Moving'}
          detail={`Intensity: ${Math.round(metrics.motion.intensity)}`}
          color={metrics.motion.isStill ? '#00ffc8' : '#ffaa00'} />
      </div>
    </div>
  )
}
