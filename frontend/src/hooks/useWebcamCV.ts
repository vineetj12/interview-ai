import { useRef, useState, useCallback, useEffect } from 'react'

// ── Types ──────────────────────────────────────────────────────────────
export interface CVMetrics {
  lighting: { level: number; label: 'Poor' | 'Low' | 'Good' | 'Bright' | 'Overexposed' }
  face: { detected: boolean; x: number; y: number; w: number; h: number; skinRatio: number }
  gaze: { direction: 'screen' | 'left' | 'right' | 'up' | 'down' | 'away'; score: number }
  posture: { label: 'Upright' | 'Slouched' | 'Tilted'; score: number; shoulderAngle: number }
  blink: { rate: number; lastBlinkTs: number; isBlinking: boolean }
  emotion: { dominant: string; confidence: number; valence: number }
  smile: { detected: boolean; authentic: boolean; intensity: number }
  headNod: { detected: boolean; frequency: number; engagementScore: number }
  motion: { intensity: number; isStill: boolean }
  stress: { level: number; label: 'Low' | 'Moderate' | 'High' | 'Elevated' }
  background: { complexity: number; label: 'Clean' | 'Moderate' | 'Busy' }
  grooming: { formalScore: number; label: 'Formal' | 'Casual' | 'Unknown' }
  engagement: number
  overallBodyLanguage: number
  timestamp: number
}

export interface TelemetryPoint {
  timestamp: number
  stress: number
  emotion: string
  gaze: string
  blinks: number
  posture: number
  engagement: number
  questionIndex: number
}

export interface UseWebcamCVReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  overlayRef: React.RefObject<HTMLCanvasElement | null>
  metrics: CVMetrics
  timeline: TelemetryPoint[]
  isActive: boolean
  start: () => Promise<void>
  stop: () => void
  currentQuestionIndex: number
  setCurrentQuestionIndex: (i: number) => void
}

const DEFAULT_METRICS: CVMetrics = {
  lighting: { level: 0, label: 'Good' },
  face: { detected: false, x: 0, y: 0, w: 0, h: 0, skinRatio: 0 },
  gaze: { direction: 'screen', score: 100 },
  posture: { label: 'Upright', score: 85, shoulderAngle: 0 },
  blink: { rate: 0, lastBlinkTs: 0, isBlinking: false },
  emotion: { dominant: 'neutral', confidence: 0, valence: 0.5 },
  smile: { detected: false, authentic: false, intensity: 0 },
  headNod: { detected: false, frequency: 0, engagementScore: 0 },
  motion: { intensity: 0, isStill: true },
  stress: { level: 0, label: 'Low' },
  background: { complexity: 0, label: 'Clean' },
  grooming: { formalScore: 50, label: 'Unknown' },
  engagement: 50,
  overallBodyLanguage: 50,
  timestamp: Date.now(),
}

// ── Pixel helpers ──────────────────────────────────────────────────────
function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function isSkinPixel(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.169 * r - 0.331 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.419 * g - 0.081 * b
  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173
}

// ── Hook ───────────────────────────────────────────────────────────────
export function useWebcamCV(): UseWebcamCVReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)

  const [metrics, setMetrics] = useState<CVMetrics>(DEFAULT_METRICS)
  const [timeline, setTimeline] = useState<TelemetryPoint[]>([])
  const [isActive, setIsActive] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null)
  const blinkHistoryRef = useRef<number[]>([])
  const faceYHistoryRef = useRef<number[]>([])
  const gazeHistoryRef = useRef<string[]>([])
  const lastTelemetryRef = useRef(0)
  const eyeBrightnessHistRef = useRef<number[]>([])
  const smileWidthHistRef = useRef<number[]>([])

  // ── Start webcam ─────────────────────────────────────────────────
  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsActive(true)
      prevFrameRef.current = null
      blinkHistoryRef.current = []
      faceYHistoryRef.current = []
      gazeHistoryRef.current = []
      eyeBrightnessHistRef.current = []
      smileWidthHistRef.current = []
    } catch (err) {
      console.error('Webcam access denied:', err)
    }
  }, [])

  // ── Stop webcam ──────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setIsActive(false)
  }, [])

  // ── Main CV processing loop ──────────────────────────────────────
  useEffect(() => {
    if (!isActive) return

    const processFrame = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      const overlay = overlayRef.current
      if (!video || !canvas || !overlay || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(processFrame)
        return
      }

      const W = video.videoWidth || 640
      const H = video.videoHeight || 480
      canvas.width = W
      canvas.height = H
      overlay.width = W
      overlay.height = H

      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      const octx = overlay.getContext('2d')!
      ctx.drawImage(video, 0, 0, W, H)
      const imageData = ctx.getImageData(0, 0, W, H)
      const px = imageData.data

      // ── 1. Lighting ────────────────────────────────────────────
      let totalLum = 0
      const pixelCount = W * H
      for (let i = 0; i < px.length; i += 16) {
        totalLum += luminance(px[i], px[i + 1], px[i + 2])
      }
      const avgLum = totalLum / (pixelCount / 4)
      const lightLabel = avgLum < 40 ? 'Poor' : avgLum < 70 ? 'Low' : avgLum < 170 ? 'Good' : avgLum < 220 ? 'Bright' : 'Overexposed'

      // ── 2. Face Detection (skin segmentation) ──────────────────
      let skinCount = 0
      let skinSumX = 0
      let skinSumY = 0
      let skinMinX = W, skinMaxX = 0, skinMinY = H, skinMaxY = 0

      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4
          if (isSkinPixel(px[i], px[i + 1], px[i + 2])) {
            skinCount++
            skinSumX += x
            skinSumY += y
            if (x < skinMinX) skinMinX = x
            if (x > skinMaxX) skinMaxX = x
            if (y < skinMinY) skinMinY = y
            if (y > skinMaxY) skinMaxY = y
          }
        }
      }

      const skinRatio = skinCount / (pixelCount / 4)
      const faceDetected = skinRatio > 0.03 && skinRatio < 0.5
      const faceCX = faceDetected ? skinSumX / skinCount : W / 2
      const faceCY = faceDetected ? skinSumY / skinCount : H / 2
      const faceW = faceDetected ? skinMaxX - skinMinX : 0
      const faceH = faceDetected ? skinMaxY - skinMinY : 0

      // ── 3. Gaze estimation ─────────────────────────────────────
      const centerOffsetX = (faceCX - W / 2) / (W / 2)
      const centerOffsetY = (faceCY - H / 2) / (H / 2)
      let gazeDir: CVMetrics['gaze']['direction'] = 'screen'
      if (Math.abs(centerOffsetX) > 0.35) gazeDir = centerOffsetX > 0 ? 'right' : 'left'
      else if (centerOffsetY > 0.3) gazeDir = 'down'
      else if (centerOffsetY < -0.3) gazeDir = 'up'
      if (!faceDetected) gazeDir = 'away'

      gazeHistoryRef.current.push(gazeDir)
      if (gazeHistoryRef.current.length > 300) gazeHistoryRef.current.shift()
      const screenGazeCount = gazeHistoryRef.current.filter((g) => g === 'screen').length
      const gazeScore = Math.round((screenGazeCount / Math.max(gazeHistoryRef.current.length, 1)) * 100)

      // ── 4. Posture analysis ────────────────────────────────────
      const expectedCY = H * 0.35
      const postureDeviation = Math.abs(faceCY - expectedCY) / H
      const postureScore = Math.max(0, Math.round(100 - postureDeviation * 200))
      const postureLabel: CVMetrics['posture']['label'] = postureDeviation > 0.2 ? 'Slouched' : Math.abs(centerOffsetX) > 0.25 ? 'Tilted' : 'Upright'

      // ── 5. Blink detection (eye region brightness dips) ────────
      let eyeBrightness = 0
      if (faceDetected && faceH > 30) {
        const eyeY1 = Math.max(0, Math.floor(skinMinY + faceH * 0.15))
        const eyeY2 = Math.min(H, Math.floor(skinMinY + faceH * 0.4))
        const eyeX1 = Math.max(0, Math.floor(skinMinX + faceW * 0.15))
        const eyeX2 = Math.min(W, Math.floor(skinMaxX - faceW * 0.15))
        let eyeSum = 0, eyeCount = 0
        for (let y = eyeY1; y < eyeY2; y += 2) {
          for (let x = eyeX1; x < eyeX2; x += 2) {
            const i = (y * W + x) * 4
            eyeSum += luminance(px[i], px[i + 1], px[i + 2])
            eyeCount++
          }
        }
        eyeBrightness = eyeCount > 0 ? eyeSum / eyeCount : avgLum
      }

      eyeBrightnessHistRef.current.push(eyeBrightness)
      if (eyeBrightnessHistRef.current.length > 60) eyeBrightnessHistRef.current.shift()

      let isBlinking = false
      const ebh = eyeBrightnessHistRef.current
      if (ebh.length >= 3) {
        const recent = ebh[ebh.length - 1]
        const prev1 = ebh[ebh.length - 2]
        const prev2 = ebh[ebh.length - 3]
        if (recent < prev2 * 0.85 && prev1 < prev2 * 0.85) {
          isBlinking = true
          blinkHistoryRef.current.push(Date.now())
        }
      }

      const now = Date.now()
      const recentBlinks = blinkHistoryRef.current.filter((t) => now - t < 60000)
      blinkHistoryRef.current = recentBlinks
      const blinkRate = recentBlinks.length

      // ── 6. Head nodding ────────────────────────────────────────
      faceYHistoryRef.current.push(faceCY)
      if (faceYHistoryRef.current.length > 90) faceYHistoryRef.current.shift()

      let nodCount = 0
      const fYH = faceYHistoryRef.current
      if (fYH.length >= 10) {
        let direction = 0
        for (let i = 1; i < fYH.length; i++) {
          const diff = fYH[i] - fYH[i - 1]
          if (Math.abs(diff) > 1.5) {
            const newDir = diff > 0 ? 1 : -1
            if (newDir !== direction && direction !== 0) nodCount++
            direction = newDir
          }
        }
      }
      const nodFreq = Math.min(nodCount / 3, 5)
      const nodDetected = nodFreq > 0.5

      // ── 7. Smile detection ─────────────────────────────────────
      let smileIntensity = 0
      let smileDetected = false
      if (faceDetected && faceH > 30) {
        const mouthY1 = Math.floor(skinMinY + faceH * 0.6)
        const mouthY2 = Math.min(H, Math.floor(skinMaxY))
        const mouthX1 = Math.floor(skinMinX + faceW * 0.2)
        const mouthX2 = Math.floor(skinMaxX - faceW * 0.2)
        let mouthWidth = 0
        for (let y = mouthY1; y < mouthY2; y += 2) {
          let rowStart = -1, rowEnd = -1
          for (let x = mouthX1; x < mouthX2; x += 2) {
            const i = (y * W + x) * 4
            const r = px[i], g = px[i + 1], b = px[i + 2]
            if (r > g + 15 && r > b + 15) {
              if (rowStart === -1) rowStart = x
              rowEnd = x
            }
          }
          if (rowEnd > rowStart) mouthWidth = Math.max(mouthWidth, rowEnd - rowStart)
        }
        smileIntensity = Math.min(100, (mouthWidth / Math.max(faceW, 1)) * 200)
        smileDetected = smileIntensity > 30

        smileWidthHistRef.current.push(mouthWidth)
        if (smileWidthHistRef.current.length > 30) smileWidthHistRef.current.shift()
      }

      // Duchenne check: authentic smile involves eye crinkle (more texture in eye corners)
      const smileAuthentic = smileDetected && eyeBrightness < avgLum * 0.95

      // ── 8. Motion / frame differencing ─────────────────────────
      let motionIntensity = 0
      if (prevFrameRef.current && prevFrameRef.current.length === px.length) {
        let diffSum = 0
        for (let i = 0; i < px.length; i += 16) {
          diffSum += Math.abs(px[i] - prevFrameRef.current[i])
          diffSum += Math.abs(px[i + 1] - prevFrameRef.current[i + 1])
          diffSum += Math.abs(px[i + 2] - prevFrameRef.current[i + 2])
        }
        motionIntensity = Math.min(100, (diffSum / (pixelCount / 4)) / 3)
      }
      prevFrameRef.current = new Uint8ClampedArray(px)

      // ── 9. Background complexity ───────────────────────────────
      let bgVariance = 0
      const bgSamples: number[] = []
      for (let y = 0; y < H; y += 8) {
        for (let x = 0; x < W * 0.15; x += 8) {
          const i = (y * W + x) * 4
          bgSamples.push(luminance(px[i], px[i + 1], px[i + 2]))
        }
        for (let x = Math.floor(W * 0.85); x < W; x += 8) {
          const i = (y * W + x) * 4
          bgSamples.push(luminance(px[i], px[i + 1], px[i + 2]))
        }
      }
      if (bgSamples.length > 0) {
        const bgMean = bgSamples.reduce((a, b) => a + b, 0) / bgSamples.length
        bgVariance = Math.sqrt(bgSamples.reduce((s, v) => s + (v - bgMean) ** 2, 0) / bgSamples.length)
      }
      const bgLabel: CVMetrics['background']['label'] = bgVariance < 20 ? 'Clean' : bgVariance < 45 ? 'Moderate' : 'Busy'

      // ── 10. Grooming heuristic (color uniformity) ──────────────
      let darkPixels = 0
      if (faceDetected) {
        const bodyY1 = Math.min(H, Math.floor(skinMaxY))
        const bodyY2 = Math.min(H, bodyY1 + 80)
        let bodyTotal = 0
        for (let y = bodyY1; y < bodyY2; y += 2) {
          for (let x = Math.floor(W * 0.25); x < Math.floor(W * 0.75); x += 2) {
            const i = (y * W + x) * 4
            const lum = luminance(px[i], px[i + 1], px[i + 2])
            if (lum < 60) darkPixels++
            bodyTotal++
          }
        }
        if (bodyTotal > 0) {
          const darkRatio = darkPixels / bodyTotal
          // Dark clothing = more formal
          if (darkRatio > 0.5) { /* formal */ }
        }
      }
      const formalScore = darkPixels > 100 ? 75 : 40
      const groomLabel: CVMetrics['grooming']['label'] = formalScore > 60 ? 'Formal' : formalScore > 30 ? 'Casual' : 'Unknown'

      // ── 11. Emotion heuristic ──────────────────────────────────
      let emotionDominant = 'neutral'
      let emotionConfidence = 0.5
      let valence = 0.5
      if (smileDetected && smileIntensity > 50) {
        emotionDominant = 'happy'
        emotionConfidence = Math.min(0.95, smileIntensity / 100)
        valence = 0.8
      } else if (motionIntensity > 40 && blinkRate > 25) {
        emotionDominant = 'nervous'
        emotionConfidence = 0.6
        valence = 0.3
      } else if (postureLabel === 'Slouched') {
        emotionDominant = 'disengaged'
        emotionConfidence = 0.4
        valence = 0.35
      } else {
        emotionDominant = 'neutral'
        emotionConfidence = 0.5
        valence = 0.5
      }

      // ── 12. Stress composite ───────────────────────────────────
      const blinkStress = blinkRate > 25 ? 80 : blinkRate > 18 ? 50 : blinkRate > 10 ? 20 : 10
      const motionStress = Math.min(80, motionIntensity * 1.5)
      const gazeStress = Math.max(0, 100 - gazeScore)
      const stressLevel = Math.round(blinkStress * 0.3 + motionStress * 0.35 + gazeStress * 0.35)
      const stressLabel: CVMetrics['stress']['label'] = stressLevel > 70 ? 'Elevated' : stressLevel > 50 ? 'High' : stressLevel > 25 ? 'Moderate' : 'Low'

      // ── 13. Engagement & body language composites ───────────────
      const engagementScore = Math.round(gazeScore * 0.3 + (nodDetected ? 80 : 30) * 0.25 + (100 - stressLevel) * 0.2 + postureScore * 0.25)
      const bodyLanguageScore = Math.round(postureScore * 0.25 + gazeScore * 0.25 + (100 - stressLevel) * 0.25 + engagementScore * 0.25)

      // ── Build metrics object ───────────────────────────────────
      const newMetrics: CVMetrics = {
        lighting: { level: Math.round(avgLum), label: lightLabel },
        face: { detected: faceDetected, x: skinMinX, y: skinMinY, w: faceW, h: faceH, skinRatio },
        gaze: { direction: gazeDir, score: gazeScore },
        posture: { label: postureLabel, score: postureScore, shoulderAngle: centerOffsetX * 45 },
        blink: { rate: blinkRate, lastBlinkTs: recentBlinks[recentBlinks.length - 1] || 0, isBlinking },
        emotion: { dominant: emotionDominant, confidence: emotionConfidence, valence },
        smile: { detected: smileDetected, authentic: smileAuthentic, intensity: smileIntensity },
        headNod: { detected: nodDetected, frequency: nodFreq, engagementScore: nodDetected ? 80 : 30 },
        motion: { intensity: motionIntensity, isStill: motionIntensity < 8 },
        stress: { level: stressLevel, label: stressLabel },
        background: { complexity: bgVariance, label: bgLabel },
        grooming: { formalScore, label: groomLabel },
        engagement: engagementScore,
        overallBodyLanguage: bodyLanguageScore,
        timestamp: now,
      }

      setMetrics(newMetrics)

      // ── Record telemetry every 2s ──────────────────────────────
      if (now - lastTelemetryRef.current > 2000) {
        lastTelemetryRef.current = now
        setTimeline((prev) => [
          ...prev,
          {
            timestamp: now,
            stress: stressLevel,
            emotion: emotionDominant,
            gaze: gazeDir,
            blinks: blinkRate,
            posture: postureScore,
            engagement: engagementScore,
            questionIndex: currentQuestionIndex,
          },
        ])
      }

      // ── Draw scanning overlay ──────────────────────────────────
      octx.clearRect(0, 0, W, H)

      if (faceDetected) {
        // Face bounding box
        octx.strokeStyle = gazeDir === 'screen' ? '#00ffc8' : '#ff4466'
        octx.lineWidth = 2
        octx.setLineDash([6, 4])
        octx.strokeRect(skinMinX, skinMinY, faceW, faceH)
        octx.setLineDash([])

        // Scanning lines
        const scanY = (now % 2000) / 2000 * faceH + skinMinY
        octx.strokeStyle = 'rgba(0, 255, 200, 0.4)'
        octx.lineWidth = 1
        octx.beginPath()
        octx.moveTo(skinMinX, scanY)
        octx.lineTo(skinMaxX, scanY)
        octx.stroke()

        // Eye contact vector
        octx.strokeStyle = gazeDir === 'screen' ? 'rgba(0, 255, 200, 0.6)' : 'rgba(255, 68, 102, 0.6)'
        octx.lineWidth = 2
        octx.beginPath()
        octx.moveTo(faceCX, faceCY)
        octx.lineTo(W / 2, 0)
        octx.stroke()

        // Posture alignment line
        const shoulderY = skinMaxY + 10
        octx.strokeStyle = postureLabel === 'Upright' ? 'rgba(0, 255, 200, 0.5)' : 'rgba(255, 165, 0, 0.5)'
        octx.lineWidth = 2
        octx.beginPath()
        octx.moveTo(skinMinX - 20, shoulderY)
        octx.lineTo(skinMaxX + 20, shoulderY)
        octx.stroke()

        // Labels
        octx.font = '11px monospace'
        octx.fillStyle = '#00ffc8'
        octx.fillText(`GAZE: ${gazeDir.toUpperCase()}`, skinMinX, skinMinY - 8)
        octx.fillText(`STRESS: ${stressLevel}%`, skinMaxX + 8, skinMinY + 16)
        octx.fillText(`BLINKS: ${blinkRate}/min`, skinMaxX + 8, skinMinY + 32)
      }

      // Corner brackets
      const bSize = 20
      octx.strokeStyle = 'rgba(0, 255, 200, 0.3)'
      octx.lineWidth = 2
      // Top-left
      octx.beginPath(); octx.moveTo(8, 8 + bSize); octx.lineTo(8, 8); octx.lineTo(8 + bSize, 8); octx.stroke()
      // Top-right
      octx.beginPath(); octx.moveTo(W - 8 - bSize, 8); octx.lineTo(W - 8, 8); octx.lineTo(W - 8, 8 + bSize); octx.stroke()
      // Bottom-left
      octx.beginPath(); octx.moveTo(8, H - 8 - bSize); octx.lineTo(8, H - 8); octx.lineTo(8 + bSize, H - 8); octx.stroke()
      // Bottom-right
      octx.beginPath(); octx.moveTo(W - 8 - bSize, H - 8); octx.lineTo(W - 8, H - 8); octx.lineTo(W - 8, H - 8 - bSize); octx.stroke()

      rafRef.current = requestAnimationFrame(processFrame)
    }

    rafRef.current = requestAnimationFrame(processFrame)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isActive, currentQuestionIndex])

  return { videoRef, canvasRef, overlayRef, metrics, timeline, isActive, start, stop, currentQuestionIndex, setCurrentQuestionIndex }
}
