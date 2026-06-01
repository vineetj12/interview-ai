import type { TelemetryPoint } from '../hooks/useWebcamCV'

interface Props {
  timeline: TelemetryPoint[]
  questionCount: number
}

export default function StressHeatmap({ timeline, questionCount }: Props) {
  if (!timeline.length) {
    return (
      <div className="stress-heatmap empty">
        <p>Stress timeline will populate during the interview.</p>
      </div>
    )
  }

  const maxStress = Math.max(...timeline.map((t) => t.stress), 1)

  // Group by question
  const byQuestion: Record<number, TelemetryPoint[]> = {}
  for (const t of timeline) {
    if (!byQuestion[t.questionIndex]) byQuestion[t.questionIndex] = []
    byQuestion[t.questionIndex].push(t)
  }

  const questionAvgs = Array.from({ length: questionCount }, (_, qi) => {
    const pts = byQuestion[qi] || []
    if (!pts.length) return { avg: 0, max: 0, emotion: 'neutral', engagement: 0 }
    const avg = Math.round(pts.reduce((s, p) => s + p.stress, 0) / pts.length)
    const max = Math.max(...pts.map((p) => p.stress))
    const emotions = pts.map((p) => p.emotion)
    const dominant = emotions.sort((a, b) => emotions.filter((e) => e === b).length - emotions.filter((e) => e === a).length)[0]
    const engagement = Math.round(pts.reduce((s, p) => s + p.engagement, 0) / pts.length)
    return { avg, max, emotion: dominant, engagement }
  })

  const stressColor = (level: number) => {
    if (level <= 25) return '#00ffc8'
    if (level <= 50) return '#ffaa00'
    if (level <= 70) return '#ff8800'
    return '#ff4466'
  }

  return (
    <div className="stress-heatmap">
      <h4 className="heatmap-title">🔥 Stress Heatmap — Per Question</h4>

      {/* Bar chart */}
      <div className="heatmap-bars">
        {questionAvgs.map((q, i) => (
          <div key={i} className="heatmap-bar-col">
            <div className="heatmap-bar-track">
              <div
                className="heatmap-bar-fill"
                style={{
                  height: `${(q.avg / Math.max(maxStress, 1)) * 100}%`,
                  background: `linear-gradient(to top, ${stressColor(q.avg)}, ${stressColor(q.max)})`,
                }}
              />
            </div>
            <span className="heatmap-bar-label">Q{i + 1}</span>
            <span className="heatmap-bar-value">{q.avg}%</span>
          </div>
        ))}
      </div>

      {/* Timeline sparkline */}
      <div className="heatmap-sparkline">
        <svg viewBox={`0 0 ${timeline.length * 4} 60`} preserveAspectRatio="none" className="sparkline-svg">
          <defs>
            <linearGradient id="stressGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff4466" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ff4466" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Area fill */}
          <path
            d={
              `M0,60 ` +
              timeline.map((t, i) => `L${i * 4},${60 - (t.stress / 100) * 58}`).join(' ') +
              ` L${(timeline.length - 1) * 4},60 Z`
            }
            fill="url(#stressGrad)"
          />
          {/* Line */}
          <path
            d={timeline.map((t, i) => `${i === 0 ? 'M' : 'L'}${i * 4},${60 - (t.stress / 100) * 58}`).join(' ')}
            fill="none" stroke="#ff4466" strokeWidth="1.5"
          />
        </svg>
        <span className="sparkline-label">Stress over time →</span>
      </div>

      {/* Per-question detail cards */}
      <div className="heatmap-details">
        {questionAvgs.map((q, i) => (
          <div key={i} className="heatmap-detail-card" style={{ borderLeftColor: stressColor(q.avg) }}>
            <div className="heatmap-detail-q">Q{i + 1}</div>
            <div className="heatmap-detail-stats">
              <span>Stress: <strong style={{ color: stressColor(q.avg) }}>{q.avg}%</strong></span>
              <span>Peak: {q.max}%</span>
              <span>Mood: {q.emotion}</span>
              <span>Engage: {q.engagement}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
