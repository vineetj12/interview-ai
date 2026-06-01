const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

export interface StressPrediction {
  stress_level: number;
  label: string;
  factors: Record<string, number>;
}

export interface EmotionPrediction {
  emotions: Record<string, number>;
  dominant: string;
  confidence: number;
}

export interface PatternResult {
  pattern_type: string;
  count: number;
  avg_stress: number;
  avg_engagement: number;
  avg_score: number;
  recommendation: string;
}

export async function predictStress(telemetry: {
  blink_rate: number;
  gaze_away_ratio: number;
  motion_intensity: number;
  face_luminance: number;
  smile_intensity?: number;
  nod_frequency?: number;
  posture_score?: number;
}): Promise<StressPrediction | null> {
  try {
    const res = await fetch(`${ML_URL}/predict-stress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telemetry),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as StressPrediction;
  } catch {
    return null;
  }
}

export async function predictEmotionFromBase64(image_base64: string): Promise<EmotionPrediction | null> {
  try {
    const res = await fetch(`${ML_URL}/predict-emotion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64 }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as EmotionPrediction;
  } catch {
    return null;
  }
}

export async function analyzePatterns(sessions: unknown[]): Promise<PatternResult[]> {
  try {
    const res = await fetch(`${ML_URL}/analyze-patterns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessions }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { patterns?: PatternResult[] };
    return data.patterns || [];
  } catch {
    return [];
  }
}
