import type { CVMetrics } from '../hooks/useWebcamCV'
import React from 'react'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  overlayRef: React.RefObject<HTMLCanvasElement | null>
  metrics: CVMetrics
  isActive: boolean
  onStart: () => void
  onStop: () => void
}

export default function WebcamFeed({ videoRef, canvasRef, overlayRef, metrics, isActive, onStart, onStop }: Props) {
  const gazeColor = metrics.gaze.direction === 'screen' ? '#00ffc8' : '#ff4466'
  const stressColor = metrics.stress.level > 50 ? '#ff4466' : metrics.stress.level > 25 ? '#ffaa00' : '#00ffc8'

  return (
    <div className="webcam-feed">
      <div className="webcam-viewport">
        <video ref={videoRef} playsInline muted className="webcam-video" />
        <canvas ref={canvasRef} className="webcam-canvas-hidden" />
        <canvas ref={overlayRef} className="webcam-overlay" />

        {!isActive && (
          <div className="webcam-placeholder">
            <div className="webcam-placeholder-icon">📹</div>
            <p>Camera feed will appear here</p>
            <button type="button" className="btn-cv start" onClick={onStart}>
              <span className="pulse-dot" /> Enable Camera
            </button>
          </div>
        )}

        {isActive && (
          <>
            {/* Top-left status badge */}
            <div className="webcam-badge top-left">
              <span className="rec-dot" /> ANALYZING
            </div>

            {/* Top-right metrics strip */}
            <div className="webcam-badge top-right">
              <span style={{ color: gazeColor }}>👁 {metrics.gaze.direction.toUpperCase()}</span>
            </div>

            {/* Bottom HUD bar */}
            <div className="webcam-hud">
              <div className="hud-item">
                <span className="hud-label">Lighting</span>
                <span className={`hud-value ${metrics.lighting.label === 'Good' ? 'good' : 'warn'}`}>
                  {metrics.lighting.label}
                </span>
              </div>
              <div className="hud-item">
                <span className="hud-label">Posture</span>
                <span className={`hud-value ${metrics.posture.label === 'Upright' ? 'good' : 'warn'}`}>
                  {metrics.posture.label}
                </span>
              </div>
              <div className="hud-item">
                <span className="hud-label">Stress</span>
                <span className="hud-value" style={{ color: stressColor }}>
                  {metrics.stress.level}%
                </span>
              </div>
              <div className="hud-item">
                <span className="hud-label">Blinks</span>
                <span className="hud-value">{metrics.blink.rate}/min</span>
              </div>
              <div className="hud-item">
                <span className="hud-label">Emotion</span>
                <span className="hud-value">{metrics.emotion.dominant}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {isActive && (
        <button type="button" className="btn-cv stop" onClick={onStop}>
          ⏹ Stop Camera
        </button>
      )}
    </div>
  )
}
