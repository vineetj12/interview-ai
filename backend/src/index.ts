import express, { Request, Response } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "./prisma.js";
import {
  generateTokens,
  authMiddleware,
  verifyRefreshToken,
  AuthRequest,
} from "./middleware/auth.js";
import {
  predictStress,
  predictEmotionFromBase64,
  analyzePatterns,
} from "./services/mlService.js";
import { generateCoaching } from "./services/coachingService.js";

dotenv.config();

type AuthBody = {
  email?: string;
  password?: string;
};

type ReviewBody = {
  text?: string;
  domain?: string;
};

type InterviewStartBody = {
  domain?: string;
  count?: number;
};

type InterviewEvaluateBody = {
  domain?: string;
  answers?: Array<{ question?: string; answer?: string }>;
};

type InterviewTtsBody = {
  text?: string;
  targetLanguageCode?: string;
  speaker?: string;
  model?: string;
};

type InterviewSaveBody = {
  domain?: string;
  overallScore?: number;
  gazeScore?: number;
  postureScore?: number;
  calmScore?: number;
  engagementScore?: number;
  bodyLanguageScore?: number;
  stressTimeline?: any[];
  metricsDetail?: any;
  feedback?: any;
};

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT ?? 3001);
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const sarvamApiKey = process.env.SARVAM_API_KEY;
const sarvamModel = process.env.SARVAM_MODEL || "saaras:v3";
const sarvamMode = process.env.SARVAM_MODE || "transcribe";
const sarvamSpeechUrl = process.env.SARVAM_SPEECH_URL || "https://api.sarvam.ai/speech-to-text";
const sarvamTtsUrl = process.env.SARVAM_TTS_URL || "https://api.sarvam.ai/text-to-speech";
const sarvamTtsModel = process.env.SARVAM_TTS_MODEL || "bulbul:v3";
const sarvamTtsSpeaker = process.env.SARVAM_TTS_SPEAKER || "shubh";
const sarvamTtsLang = process.env.SARVAM_TTS_LANG || "hi-IN";

// ── Socket.io Setup for Real-time Telemetry ───────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: frontendOrigin,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on("session:start", (data) => {
    console.log(`🚀 Real-time session started for user ${data.userId} on domain ${data.domain}`);
    socket.join(data.userId);
  });

  socket.on("telemetry:send", async (data) => {
    // Process real-time telemetry from frontend
    // Can hook into ML FastAPI in real time if a camera frame base64 is sent
    const { userId, metrics } = data;
    if (!userId || !metrics) return;

    // Call ML service in the background for real-time stress verification if needed
    const predicted = await predictStress({
      blink_rate: metrics.blink?.rate || 0,
      gaze_away_ratio: metrics.gaze?.direction !== "screen" ? 1.0 : 0.0,
      motion_intensity: metrics.motion?.intensity || 0,
      face_luminance: metrics.lighting?.level || 50,
      smile_intensity: metrics.smile?.intensity || 0,
      nod_frequency: metrics.headNod?.frequency || 0,
      posture_score: metrics.posture?.score || 80,
    });

    const liveStress = predicted ? predicted.stress_level : metrics.stress?.level || 0;

    // Send back calculated premium stats to client
    socket.emit("telemetry:processed", {
      timestamp: Date.now(),
      liveStress,
      predictedLabel: predicted?.label || metrics.stress?.label || "Low",
      predictedFactors: predicted?.factors || {},
      engagement: metrics.engagement || 50,
    });
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }
});

app.use(cors({ origin: frontendOrigin }));
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, socketActive: true });
});

// ── JWT Auth & Token Rotation Endpoints ──────────────────────────────
app.post("/api/auth/register", async (req: Request<{}, {}, AuthBody>, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash
      },
      select: { id: true, email: true, createdAt: true }
    });

    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    // Save refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return res.status(201).json({
      user,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to register." });
  }
});

app.post("/api/auth/login", async (req: Request<{}, {}, AuthBody>, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    // Store new refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to login." });
  }
});

app.post("/api/auth/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required." });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired refresh token." });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: "Refresh token has expired or is revoked." });
    }

    // Rotate refresh token: delete old, create new
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const tokens = generateTokens(storedToken.user.id, storedToken.user.email);

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: storedToken.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to refresh token." });
  }
});

app.post("/api/auth/logout", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to logout." });
  }
});

// Helpers
const extractJson = (text: string): Record<string, unknown> | null => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return null;
  }
};

const extractSarvamTranscript = (payload: {
  text?: string;
  transcript?: string;
  results?: Array<{ text?: string }>;
}) => {
  if (payload.text) return payload.text;
  if (payload.transcript) return payload.transcript;
  if (payload.results?.length) {
    return payload.results.map((item) => item.text).filter(Boolean).join(" ");
  }
  return "";
};

// ── Resume Review ─────────────────────────────────────────────────────
app.post("/api/resume/review", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!geminiApiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY." });
    }

    const { text, domain } = req.body || {};
    if (!text || text.length < 50) {
      return res.status(400).json({ error: "Resume text is too short." });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    const prompt = `You are a resume reviewer. Analyze the resume text for the target domain: ${
      domain || "general software"
    }.
\nReturn JSON only with the shape:
{\n  "summary": "string",\n  "strengths": ["string"],\n  "improvements": ["string"],\n  "keywordsToAdd": ["string"],\n  "overallScore": 0-100\n}

Resume text:\n${text}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = extractJson(responseText);

    if (!parsed) {
      return res.status(200).json({
        summary: "Review completed.",
        strengths: [],
        improvements: ["Could not parse structured response."],
        keywordsToAdd: [],
        overallScore: 0,
        raw: responseText
      });
    }

    return res.json(parsed);
  } catch (error) {
    return res.status(500).json({ error: "Failed to review resume." });
  }
});

// ── Mock Interview Routes ─────────────────────────────────────────────
app.post("/api/interview/start", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!geminiApiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY." });
    }

    const { domain, count } = req.body || {};
    if (!domain) {
      return res.status(400).json({ error: "Domain is required." });
    }

    const questionCount = Math.min(Math.max(count ?? 5, 1), 10);
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    const prompt = `Generate ${questionCount} interview questions for the role/domain: ${domain}.
Return JSON only with the shape:
{\n  "questions": ["string"]\n}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = extractJson(responseText) as { questions?: string[] } | null;

    if (!parsed?.questions?.length) {
      const fallback = responseText
        .split("\n")
        .map((line) => line.replace(/^\d+\.?\s*/, "").trim())
        .filter(Boolean)
        .slice(0, questionCount);
      return res.json({ questions: fallback });
    }

    return res.json({ questions: parsed.questions.slice(0, questionCount) });
  } catch (error) {
    return res.status(500).json({ error: "Failed to generate questions." });
  }
});

app.post(
  "/api/interview/transcribe",
  authMiddleware,
  upload.single("audio"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!sarvamApiKey) {
        return res.status(500).json({ error: "Missing SARVAM_API_KEY." });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Audio file is required." });
      }

      const formData = new FormData();
      const mimeType = req.file.mimetype || "audio/wav";
      const audioBlob = new Blob([new Uint8Array(req.file.buffer)], { type: mimeType });
      formData.append("model", sarvamModel);
      formData.append("mode", sarvamMode);
      formData.append("file", audioBlob, req.file.originalname || "audio.wav");

      const response = await fetch(sarvamSpeechUrl, {
        method: "POST",
        headers: {
          "api-subscription-key": sarvamApiKey
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(500).json({ error: "Sarvam transcription failed.", detail: errorText });
      }

      const payload = (await response.json()) as {
        text?: string;
        transcript?: string;
        results?: Array<{ text?: string }>;
      };

      const text = extractSarvamTranscript(payload);
      if (!text) {
        return res.status(500).json({ error: "No transcript returned." });
      }

      return res.json({ transcript: text });
    } catch (error) {
      return res.status(500).json({ error: "Failed to transcribe audio." });
    }
  }
);

app.post("/api/interview/tts", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!sarvamApiKey) {
      return res.status(500).json({ error: "Missing SARVAM_API_KEY." });
    }

    const { text, targetLanguageCode, speaker, model } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: "Text is required." });
    }

    const payload = {
      model: model || sarvamTtsModel,
      text,
      target_language_code: targetLanguageCode || sarvamTtsLang,
      speaker: speaker || sarvamTtsSpeaker
    };

    const response = await fetch(sarvamTtsUrl, {
      method: "POST",
      headers: {
        "api-subscription-key": sarvamApiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: "Sarvam TTS failed.", detail: errorText });
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.startsWith("audio/")) {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("content-type", contentType);
      return res.status(200).send(buffer);
    }

    if (contentType.includes("application/json")) {
      const jsonPayload = (await response.json()) as {
        audios?: string[];
        audio_url?: string;
        audio?: string;
        audio_base64?: string;
        data?: string;
      };

      const base64 =
        jsonPayload.audios?.[0] ||
        jsonPayload.audio_base64 ||
        jsonPayload.audio ||
        jsonPayload.data;

      if (base64) {
        const cleaned = base64.includes(",") ? base64.split(",")[1] : base64;
        const buffer = Buffer.from(cleaned, "base64");
        res.setHeader("content-type", "audio/wav");
        return res.status(200).send(buffer);
      }

      if (jsonPayload.audio_url) {
        const audioResponse = await fetch(jsonPayload.audio_url);
        if (!audioResponse.ok) {
          return res.status(502).json({
            error: "Sarvam TTS audio URL failed.",
            detail: await audioResponse.text()
          });
        }
        const audioType = audioResponse.headers.get("content-type") || "audio/wav";
        const buffer = Buffer.from(await audioResponse.arrayBuffer());
        res.setHeader("content-type", audioType);
        return res.status(200).send(buffer);
      }

      return res.status(502).json({
        error: "Sarvam TTS returned JSON without audio.",
        detail: JSON.stringify(jsonPayload)
      });
    }

    const errorText = await response.text();
    return res.status(502).json({
      error: "Sarvam TTS returned non-audio content.",
      detail: errorText
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to convert text to speech." });
  }
});

app.post("/api/interview/evaluate", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!geminiApiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY." });
    }

    const { domain, answers } = req.body || {};
    if (!domain || !answers?.length) {
      return res.status(400).json({ error: "Domain and answers are required." });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    const formatted = answers
      .map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`)
      .join("\n\n");

    const prompt = `You are an interview coach. Review the answers for the domain: ${domain}.
Return JSON only with the shape:
{\n  "summary": "string",\n  "strengths": ["string"],\n  "improvements": ["string"],\n  "overallScore": 0-100\n}

Interview transcript:\n${formatted}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = extractJson(responseText);

    if (!parsed) {
      return res.status(200).json({
        summary: "Evaluation completed.",
        strengths: [],
        improvements: ["Could not parse structured response."],
        overallScore: 0,
        raw: responseText
      });
    }

    return res.json(parsed);
  } catch (error) {
    return res.status(500).json({ error: "Failed to evaluate interview." });
  }
});

// ── Save Interview Session with ML Stress & AI Coaching Integration ────
app.post(
  "/api/interview/session/save",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        domain,
        overallScore,
        gazeScore,
        postureScore,
        calmScore,
        engagementScore,
        bodyLanguageScore,
        stressTimeline,
        metricsDetail,
        feedback,
      } = req.body || {};

      if (!domain) {
        return res.status(400).json({ error: "domain is required." });
      }
      const userId = req.userId!;

      // 1. Incorporate ML predictions
      let finalCalm = calmScore;
      if (stressTimeline && stressTimeline.length > 0) {
        const avgBlink = stressTimeline.reduce((sum: number, pt: any) => sum + (pt.blinks || 0), 0) / stressTimeline.length;
        const avgGazeAway = stressTimeline.filter((pt: any) => pt.gaze !== "screen").length / stressTimeline.length;
        const avgMotion = stressTimeline.reduce((sum: number, pt: any) => sum + (pt.stress || 0), 0) / stressTimeline.length;

        const predicted = await predictStress({
          blink_rate: avgBlink,
          gaze_away_ratio: avgGazeAway,
          motion_intensity: avgMotion,
          face_luminance: metricsDetail?.lighting || 50,
          smile_intensity: metricsDetail?.smile || 0,
          nod_frequency: metricsDetail?.headNod || 0,
          posture_score: postureScore || 80,
        });

        if (predicted) {
          finalCalm = Math.round(100 - predicted.stress_level);
        }
      }

      // 2. Generate customized coaching feedback
      const emotionDominant = stressTimeline && stressTimeline.length > 0
        ? stressTimeline[stressTimeline.length - 1].emotion || "neutral"
        : "neutral";

      const coachFeedback = await generateCoaching({
        domain,
        overallScore: overallScore || 50,
        avgStress: 100 - (finalCalm || 50),
        engagementScore: engagementScore || 50,
        emotionSummary: emotionDominant,
        strengths: feedback?.strengths || [],
        improvements: feedback?.improvements || [],
      });

      const mergedFeedback = {
        ...(feedback || {}),
        coachingTips: coachFeedback || {
          strengths: feedback?.strengths || [],
          improvements: feedback?.improvements || [],
          stress_management: ["Ensure proper lighting and clear gaze direction."],
          practice_plan: ["Complete another 5-question mock session on this domain."],
          confidence_tips: ["Keep a steady eye level and pause between key points."],
          pattern_label: "Consistent Learner",
          next_focus: "Work on posture alignment and maintaining eye contact."
        }
      };

      const session = await prisma.interviewSession.create({
        data: {
          userId,
          domain,
          overallScore: overallScore ? Math.round(overallScore) : null,
          gazeScore: gazeScore ? Math.round(gazeScore) : null,
          postureScore: postureScore ? Math.round(postureScore) : null,
          calmScore: finalCalm ? Math.round(finalCalm) : null,
          engagementScore: engagementScore ? Math.round(engagementScore) : null,
          bodyLanguageScore: bodyLanguageScore ? Math.round(bodyLanguageScore) : null,
          stressTimeline: stressTimeline ? JSON.parse(JSON.stringify(stressTimeline)) : null,
          metricsDetail: metricsDetail ? JSON.parse(JSON.stringify(metricsDetail)) : null,
          feedback: JSON.parse(JSON.stringify(mergedFeedback)),
        },
      });

      return res.status(201).json({ session });
    } catch (error) {
      console.error("Prisma save session error:", error);
      return res.status(500).json({ error: "Failed to save interview session." });
    }
  }
);

// ── GET sessions list ─────────────────────────────────────────────────
app.get("/api/interview/sessions", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sessions = await prisma.interviewSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ sessions });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load past interview sessions." });
  }
});

// ── GET Advanced Custom Analytics & Pattern Mining Endpoints ───────────
app.get("/api/analytics/summary", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sessions = await prisma.interviewSession.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    if (sessions.length === 0) {
      return res.json({
        totalSessions: 0,
        averageScore: 0,
        stressTrend: [],
        behavioralPatterns: [],
        recentImprovements: [],
      });
    }

    const totalSessions = sessions.length;
    const averageScore = Math.round(
      sessions.reduce((sum, s) => sum + (s.overallScore || 0), 0) / totalSessions
    );

    const stressTrend = sessions.map((s) => ({
      date: new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      overallScore: s.overallScore || 0,
      stress: 100 - (s.calmScore || 50),
      engagement: s.engagementScore || 50,
      bodyLanguage: s.bodyLanguageScore || 50,
    }));

    // Trigger behavioral pattern mining on Python microservice
    const patterns = await analyzePatterns(sessions);

    return res.json({
      totalSessions,
      averageScore,
      stressTrend,
      behavioralPatterns: patterns.length > 0 ? patterns : [
        {
          pattern_type: "Consistent Learner",
          count: totalSessions,
          avg_stress: 35.5,
          avg_engagement: 78.4,
          avg_score: averageScore,
          recommendation: "Increase active gaze contact with the camera and sit upright to elevate visual engagement."
        }
      ],
    });
  } catch (error) {
    console.error("Analytics failure:", error);
    return res.status(500).json({ error: "Failed to calculate analytics." });
  }
});

httpServer.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
