import type { CVMetrics, TelemetryPoint } from '../hooks/useWebcamCV'

interface QuestionAnswer {
  question: string
  answer: string
}

interface Props {
  metrics: CVMetrics
  timeline: TelemetryPoint[]
  questions: string[]
  answers: QuestionAnswer[]
  domain: string
  interviewResult: { summary: string; strengths: string[]; improvements: string[]; overallScore: number } | null
}

export default function PDFReport({ metrics, timeline, questions, answers, domain, interviewResult }: Props) {

  // Group timeline by question
  const byQuestion: Record<number, TelemetryPoint[]> = {}
  for (const t of timeline) {
    if (!byQuestion[t.questionIndex]) byQuestion[t.questionIndex] = []
    byQuestion[t.questionIndex].push(t)
  }

  const questionMetrics = questions.map((_, qi) => {
    const pts = byQuestion[qi] || []
    if (!pts.length) return { avgStress: 0, avgEngagement: 0, dominantEmotion: 'N/A', avgPosture: 0 }
    return {
      avgStress: Math.round(pts.reduce((s, p) => s + p.stress, 0) / pts.length),
      avgEngagement: Math.round(pts.reduce((s, p) => s + p.engagement, 0) / pts.length),
      dominantEmotion: pts.map(p => p.emotion).sort((a, b) =>
        pts.filter(p => p.emotion === b).length - pts.filter(p => p.emotion === a).length
      )[0] || 'neutral',
      avgPosture: Math.round(pts.reduce((s, p) => s + p.posture, 0) / pts.length),
    }
  })

  const tips: string[] = []
  if (metrics.gaze.score < 60) tips.push('Practice maintaining eye contact with the camera lens, not the screen.')
  if (metrics.posture.score < 60) tips.push('Sit upright and keep your shoulders aligned. Consider adjusting your chair height.')
  if (metrics.blink.rate > 25) tips.push('High blink rate detected — try deep breathing exercises before answering to reduce anxiety.')
  if (metrics.stress.level > 50) tips.push('Use the STAR method (Situation, Task, Action, Result) to structure answers and reduce cognitive load.')
  if (metrics.background.label !== 'Clean') tips.push('Use a clean, uncluttered background or a virtual background for a more professional look.')
  if (metrics.lighting.label !== 'Good') tips.push('Position a light source in front of you (not behind) for optimal face illumination.')
  if (!metrics.headNod.detected) tips.push('Show active listening by nodding occasionally — it signals engagement to interviewers.')
  if (metrics.grooming.label !== 'Formal') tips.push('Wear professional attire — even for remote interviews, dressing formally boosts confidence.')
  if (tips.length === 0) tips.push('Great performance! Keep practicing to maintain consistency.')

  const handleDownload = () => {
    const w = window.open('', '_blank')
    if (!w) return
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>InterviewAI Report — ${domain}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0a0a1a;color:#e0e0e0;padding:40px;max-width:900px;margin:0 auto}
h1{font-size:28px;color:#a78bfa;margin-bottom:4px}
h2{font-size:18px;color:#00ffc8;margin:28px 0 12px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:6px}
h3{font-size:15px;color:#ccc;margin:16px 0 8px}
p,li{font-size:13px;line-height:1.7;color:#bbb}
.header{text-align:center;margin-bottom:32px}
.header p{color:#888;font-size:12px}
.scores{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}
.score-box{flex:1;min-width:120px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;text-align:center}
.score-box .val{font-size:32px;font-weight:700}
.score-box .lbl{font-size:11px;color:#888;margin-top:4px}
table{width:100%;border-collapse:collapse;margin:12px 0}
th,td{text-align:left;padding:8px 12px;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.06)}
th{color:#00ffc8;font-weight:600}
.tip{background:rgba(167,139,250,0.08);border-left:3px solid #a78bfa;padding:10px 14px;margin:8px 0;border-radius:0 8px 8px 0;font-size:13px}
.green{color:#00ffc8}.yellow{color:#ffaa00}.red{color:#ff4466}.purple{color:#a78bfa}
@media print{body{background:#fff;color:#111}h1{color:#6b21a8}h2{color:#059669;border-color:#ddd}
.score-box{border-color:#ddd}p,li,td{color:#333}th{color:#059669}.tip{background:#f3f0ff;border-color:#6b21a8}}
</style></head><body>
<div class="header">
  <h1>🎯 InterviewAI — Session Report</h1>
  <p>Domain: ${domain} · Date: ${new Date().toLocaleDateString()} · Powered by Computer Vision AI</p>
</div>

<h2>📊 Score Breakdown</h2>
<div class="scores">
  <div class="score-box"><div class="val green">${metrics.gaze.score}</div><div class="lbl">Eye Contact</div></div>
  <div class="score-box"><div class="val green">${metrics.posture.score}</div><div class="lbl">Posture</div></div>
  <div class="score-box"><div class="val ${metrics.stress.level > 50 ? 'red' : 'green'}">${100 - metrics.stress.level}</div><div class="lbl">Calm Score</div></div>
  <div class="score-box"><div class="val purple">${metrics.engagement}</div><div class="lbl">Engagement</div></div>
  <div class="score-box"><div class="val purple">${metrics.overallBodyLanguage}</div><div class="lbl">Body Language</div></div>
  ${interviewResult ? `<div class="score-box"><div class="val green">${interviewResult.overallScore}</div><div class="lbl">Answer Score</div></div>` : ''}
</div>

<h2>🧠 CV Metrics Detail</h2>
<table>
<tr><th>Metric</th><th>Value</th><th>Rating</th></tr>
<tr><td>Lighting</td><td>${metrics.lighting.label} (${metrics.lighting.level})</td><td>${metrics.lighting.label === 'Good' ? '✅' : '⚠️'}</td></tr>
<tr><td>Background</td><td>${metrics.background.label}</td><td>${metrics.background.label === 'Clean' ? '✅' : '⚠️'}</td></tr>
<tr><td>Blink Rate</td><td>${metrics.blink.rate}/min</td><td>${metrics.blink.rate > 25 ? '⚠️ Nervous' : '✅ Normal'}</td></tr>
<tr><td>Smile</td><td>${metrics.smile.detected ? (metrics.smile.authentic ? 'Genuine' : 'Polite') : 'None'}</td><td>${metrics.smile.authentic ? '✅' : '—'}</td></tr>
<tr><td>Head Nodding</td><td>${metrics.headNod.detected ? 'Active' : 'Inactive'}</td><td>${metrics.headNod.detected ? '✅' : '⚠️'}</td></tr>
<tr><td>Grooming</td><td>${metrics.grooming.label}</td><td>${metrics.grooming.label === 'Formal' ? '✅' : '⚠️'}</td></tr>
</table>

<h2>📋 Per-Question Analysis</h2>
<table>
<tr><th>#</th><th>Stress</th><th>Engagement</th><th>Emotion</th><th>Posture</th></tr>
${questionMetrics.map((q, i) => `<tr><td>Q${i + 1}</td><td class="${q.avgStress > 50 ? 'red' : 'green'}">${q.avgStress}%</td><td>${q.avgEngagement}%</td><td>${q.dominantEmotion}</td><td>${q.avgPosture}%</td></tr>`).join('')}
</table>

${interviewResult ? `
<h2>🎤 Interview Feedback</h2>
<p>${interviewResult.summary}</p>
<h3>Strengths</h3>
<ul>${interviewResult.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
<h3>Areas for Improvement</h3>
<ul>${interviewResult.improvements.map(s => `<li>${s}</li>`).join('')}</ul>
` : ''}

<h2>💡 Personalized Tips</h2>
${tips.map(t => `<div class="tip">${t}</div>`).join('')}

<div style="text-align:center;margin-top:40px;color:#555;font-size:11px">
  Generated by InterviewAI · Computer Vision Analysis Engine · ${new Date().toISOString()}
</div>
</body></html>`

    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  return (
    <div className="pdf-report-section">
      <h4 className="report-title">📄 Session Report</h4>
      <p className="report-subtitle">Download your detailed CV analysis report with per-question breakdowns and personalized tips.</p>

      <div className="report-preview">
        <div className="report-scores-row">
          <div className="report-score"><span className="rv">{metrics.gaze.score}</span><span className="rl">Eye Contact</span></div>
          <div className="report-score"><span className="rv">{metrics.posture.score}</span><span className="rl">Posture</span></div>
          <div className="report-score"><span className="rv">{100 - metrics.stress.level}</span><span className="rl">Calm</span></div>
          <div className="report-score"><span className="rv">{metrics.engagement}</span><span className="rl">Engagement</span></div>
          <div className="report-score"><span className="rv">{metrics.overallBodyLanguage}</span><span className="rl">Body Lang</span></div>
        </div>

        <div className="report-tips">
          <h5>💡 Top Tips</h5>
          {tips.slice(0, 3).map((t, i) => <p key={i} className="report-tip">• {t}</p>)}
        </div>
      </div>

      <button type="button" className="btn-primary report-download" onClick={handleDownload}>
        📥 Download PDF Report
      </button>
    </div>
  )
}
