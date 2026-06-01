"""
InterviewAI ML Service — FastAPI
Provides emotion prediction (CNN on FER2013) and stress prediction (XGBoost).
Falls back to heuristic predictions when trained models are not yet available.
"""

import os
import base64
import io
import logging
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

# ── App setup ───────────────────────────────────────────────────────────
app = FastAPI(title="InterviewAI ML Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("ml-service")
logging.basicConfig(level=logging.INFO)

EMOTIONS = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# ── Try loading trained models ──────────────────────────────────────────
emotion_model = None
stress_model = None

def load_models():
    global emotion_model, stress_model
    
    # Emotion CNN
    emotion_path = os.path.join(MODEL_DIR, "emotion_cnn.pth")
    if os.path.exists(emotion_path):
        try:
            import torch
            from model import EmotionCNN
            emotion_model = EmotionCNN(num_classes=7)
            emotion_model.load_state_dict(torch.load(emotion_path, map_location="cpu"))
            emotion_model.eval()
            logger.info("✅ Emotion CNN model loaded")
        except Exception as e:
            logger.warning(f"⚠️ Could not load emotion model: {e}")
    else:
        logger.info("ℹ️ No trained emotion model found — using heuristic fallback")

    # Stress XGBoost
    stress_path = os.path.join(MODEL_DIR, "stress_xgb.json")
    if os.path.exists(stress_path):
        try:
            import xgboost as xgb
            stress_model = xgb.XGBRegressor()
            stress_model.load_model(stress_path)
            logger.info("✅ Stress XGBoost model loaded")
        except Exception as e:
            logger.warning(f"⚠️ Could not load stress model: {e}")
    else:
        logger.info("ℹ️ No trained stress model found — using heuristic fallback")

load_models()

# ── Request/Response models ─────────────────────────────────────────────
class EmotionRequest(BaseModel):
    image_base64: str

class EmotionResponse(BaseModel):
    emotions: dict[str, float]
    dominant: str
    confidence: float

class StressRequest(BaseModel):
    blink_rate: float
    gaze_away_ratio: float
    motion_intensity: float
    face_luminance: float
    smile_intensity: float = 0.0
    nod_frequency: float = 0.0
    posture_score: float = 50.0

class StressResponse(BaseModel):
    stress_level: float
    label: str
    factors: dict[str, float]

# ── Endpoints ───────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "emotion_model": "loaded" if emotion_model else "heuristic",
        "stress_model": "loaded" if stress_model else "heuristic",
    }

@app.post("/predict-emotion", response_model=EmotionResponse)
async def predict_emotion(req: EmotionRequest):
    try:
        # Decode base64 image
        img_bytes = base64.b64decode(req.image_base64)
        img = Image.open(io.BytesIO(img_bytes)).convert("L").resize((48, 48))
        pixels = np.array(img, dtype=np.float32) / 255.0

        if emotion_model is not None:
            # Use trained CNN
            import torch
            tensor = torch.tensor(pixels).unsqueeze(0).unsqueeze(0)  # (1, 1, 48, 48)
            with torch.no_grad():
                logits = emotion_model(tensor)
                probs = torch.softmax(logits, dim=1).squeeze().numpy()
        else:
            # Heuristic fallback: analyze pixel statistics
            mean_val = float(np.mean(pixels))
            std_val = float(np.std(pixels))
            
            # Simple heuristic based on image brightness and contrast
            probs = np.array([0.05, 0.02, 0.08, 0.15, 0.10, 0.05, 0.55])  # neutral-heavy
            
            if mean_val > 0.55:  # bright face = likely happy/neutral
                probs[3] += 0.2  # happy
                probs[6] -= 0.1
            if std_val > 0.25:  # high contrast = more expressive
                probs[5] += 0.15  # surprise
                probs[6] -= 0.1
            if mean_val < 0.35:  # dark = could be sad/angry
                probs[4] += 0.15  # sad
                probs[0] += 0.1  # angry
                probs[6] -= 0.15
            
            probs = np.clip(probs, 0, 1)
            probs = probs / probs.sum()

        emotions_dict = {EMOTIONS[i]: round(float(probs[i]), 4) for i in range(7)}
        dominant_idx = int(np.argmax(probs))
        
        return EmotionResponse(
            emotions=emotions_dict,
            dominant=EMOTIONS[dominant_idx],
            confidence=round(float(probs[dominant_idx]), 4),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict-stress", response_model=StressResponse)
async def predict_stress(req: StressRequest):
    try:
        features = np.array([[
            req.blink_rate,
            req.gaze_away_ratio,
            req.motion_intensity,
            req.face_luminance,
            req.smile_intensity,
            req.nod_frequency,
            req.posture_score,
        ]])

        if stress_model is not None:
            stress = float(stress_model.predict(features)[0])
        else:
            # Heuristic stress formula
            blink_factor = min(1.0, max(0, (req.blink_rate - 10) / 30))
            gaze_factor = req.gaze_away_ratio
            motion_factor = min(1.0, req.motion_intensity / 60)
            calm_factors = (req.smile_intensity / 100) * 0.2 + (req.nod_frequency / 5) * 0.1 + (req.posture_score / 100) * 0.15
            
            stress = (blink_factor * 30 + gaze_factor * 35 + motion_factor * 25 - calm_factors * 20 + 10)
            stress = max(0, min(100, stress))

        label = "Low" if stress <= 25 else "Moderate" if stress <= 50 else "High" if stress <= 70 else "Elevated"

        factors = {
            "blink_contribution": round(min(1.0, max(0, (req.blink_rate - 10) / 30)) * 30, 2),
            "gaze_contribution": round(req.gaze_away_ratio * 35, 2),
            "motion_contribution": round(min(1.0, req.motion_intensity / 60) * 25, 2),
            "calm_offset": round((req.smile_intensity / 100 * 0.2 + req.nod_frequency / 5 * 0.1) * -20, 2),
        }

        return StressResponse(stress_level=round(stress, 2), label=label, factors=factors)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PatternAnalysisRequest(BaseModel):
    sessions: list

@app.post("/analyze-patterns")
async def analyze_patterns_endpoint(req: PatternAnalysisRequest):
    try:
        sessions = req.sessions
        if not sessions:
            return {"patterns": []}

        # Perform behavioral clustering & pattern analysis
        # Groups: Anxious Performer, High Performer, Consistent Learner, Disengaged
        patterns = []
        
        # We classify user sessions based on scores
        # We can extract features: overallScore, gazeScore, postureScore, calmScore, engagementScore
        total_sessions = len(sessions)
        
        high_perf_count = 0
        anxious_perf_count = 0
        consistent_learner_count = 0
        disengaged_count = 0
        
        total_stress = 0.0
        total_engagement = 0.0
        total_score = 0.0
        
        for s in sessions:
            overall = s.get("overallScore") or 0
            gaze = s.get("gazeScore") or 0
            posture = s.get("postureScore") or 0
            calm = s.get("calmScore") or 0
            engagement = s.get("engagementScore") or 0
            
            stress_level = 100 - calm
            total_stress += stress_level
            total_engagement += engagement
            total_score += overall
            
            # Simple rule-based clustering engine simulating KMeans/Heuristic clustering
            if overall >= 80 and calm >= 75:
                high_perf_count += 1
            elif overall >= 70 and calm < 60:
                anxious_perf_count += 1
            elif overall >= 60 and calm >= 60:
                consistent_learner_count += 1
            else:
                disengaged_count += 1

        avg_stress = total_stress / total_sessions
        avg_engagement = total_engagement / total_sessions
        avg_score = total_score / total_sessions
        
        if high_perf_count > 0:
            patterns.append({
                "pattern_type": "High Performer",
                "count": high_perf_count,
                "avg_stress": round(avg_stress, 2),
                "avg_engagement": round(avg_engagement, 2),
                "avg_score": round(avg_score, 2),
                "recommendation": "Maintain your calm focus and natural body language. You are doing fantastic!"
            })
        if anxious_perf_count > 0:
            patterns.append({
                "pattern_type": "Anxious Performer",
                "count": anxious_perf_count,
                "avg_stress": round(avg_stress, 2),
                "avg_engagement": round(avg_engagement, 2),
                "avg_score": round(avg_score, 2),
                "recommendation": "Work on deep breathing before sessions and slow down your speaking rate to lower stress indicators."
            })
        if consistent_learner_count > 0:
            patterns.append({
                "pattern_type": "Consistent Learner",
                "count": consistent_learner_count,
                "avg_stress": round(avg_stress, 2),
                "avg_engagement": round(avg_engagement, 2),
                "avg_score": round(avg_score, 2),
                "recommendation": "Focus on improving active gaze contact with the camera and straightening your posture."
            })
        if disengaged_count > 0 or not patterns:
            patterns.append({
                "pattern_type": "Disengaged / Underprepared",
                "count": max(1, disengaged_count),
                "avg_stress": round(avg_stress, 2),
                "avg_engagement": round(avg_engagement, 2),
                "avg_score": round(avg_score, 2),
                "recommendation": "Increase your active eye contact, smile more naturally, and sit upright to show confident engagement."
            })

        return {"patterns": patterns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Run ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("ML_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
