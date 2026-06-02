import express, { Request, Response } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient, RedisClientType } from "redis";
import prisma from "./prisma.js";
import {
  resumeReviewQueue,
  sessionAnalyticsQueue,
  reportGenerationQueue,
} from "./queue.js";
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

const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
const cacheTtlSeconds = Number(process.env.CACHE_TTL_SECONDS ?? 86400);
const redisClient: RedisClientType | null = redisUrl ? createClient({ url: redisUrl }) : null;
const cacheEnabled = Boolean(redisClient);

if (redisClient) {
  redisClient.on("error", (err) => console.error("Redis error:", err));
  redisClient.connect().catch((err) => console.error("Redis connect failed:", err));
}

function makeCacheKey(prefix: string, payload: string) {
  return `${prefix}:${crypto.createHash("sha256").update(payload).digest("hex")}`;
}

async function getCached<T>(key: string): Promise<T | null> {
  if (!redisClient) return null;
  const cached = await redisClient.get(key);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

async function setCached(key: string, value: unknown, ttl = cacheTtlSeconds) {
  if (!redisClient) return;
  await redisClient.set(key, JSON.stringify(value), { EX: ttl });
}

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
    // Process batched telemetry from frontend (aggregated every 5 seconds)
    const { userId, aggregated, metrics, batchSize } = data;
    if (!userId) return;

    // Support both aggregated format (new) and raw metrics (legacy)
    let stressInput = {
      blink_rate: 0,
      gaze_away_ratio: 0,
      motion_intensity: 0,
      face_luminance: 50,
      smile_intensity: 0,
      nod_frequency: 0,
      posture_score: 80,
    };

    if (aggregated) {
      // New aggregated format (5-second batch)
      stressInput = {
        blink_rate: aggregated.blink?.avg || 0,
        gaze_away_ratio: 1 - (aggregated.gaze?.screenPercent || 100) / 100,
        motion_intensity: aggregated.motion?.avg || 0,
        face_luminance: aggregated.lighting?.avg || 50,
        smile_intensity: 0,
        nod_frequency: 0,
        posture_score: 80,
      };
    } else if (metrics) {
      // Legacy raw metrics format (for backwards compatibility)
      stressInput = {
        blink_rate: metrics.blink?.rate || 0,
        gaze_away_ratio: metrics.gaze?.direction !== "screen" ? 1.0 : 0.0,
        motion_intensity: metrics.motion?.intensity || 0,
        face_luminance: metrics.lighting?.level || 50,
        smile_intensity: metrics.smile?.intensity || 0,
        nod_frequency: metrics.headNod?.frequency || 0,
        posture_score: metrics.posture?.score || 80,
      };
    }

    const predicted = await predictStress(stressInput);
    const liveStress = predicted ? predicted.stress_level : 50;

    // Send back calculated premium stats to client
    socket.emit("telemetry:processed", {
      timestamp: Date.now(),
      liveStress,
      predictedLabel: predicted?.label || "Moderate",
      predictedFactors: predicted?.factors || {},
      engagement: aggregated?.motion?.avg || 50,
      batchSize: batchSize || 1,
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

    const cacheKey = makeCacheKey("resume-review", `${domain || "general software"}:${text}`);
    if (cacheEnabled) {
      const cached = await getCached<unknown>(cacheKey);
      if (cached) return res.json(cached);
    }

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
      const fallbackResponse = {
        summary: "Review completed.",
        strengths: [],
        improvements: ["Could not parse structured response."],
        keywordsToAdd: [],
        overallScore: 0,
        raw: responseText,
      };
      if (cacheEnabled) await setCached(cacheKey, fallbackResponse);
      return res.status(200).json(fallbackResponse);
    }

    if (cacheEnabled) await setCached(cacheKey, parsed);
    return res.json(parsed);
  } catch (error) {
    return res.status(500).json({ error: "Failed to review resume." });
  }
});

app.post("/api/queue/resume-review", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { text, domain } = req.body || {};
    if (!text || text.length < 50) {
      return res.status(400).json({ error: "Resume text is too short." });
    }

    const job = await resumeReviewQueue.add(
      "resume-review",
      { text, domain },
      {
        removeOnComplete: 3600,
        removeOnFail: 86400,
      }
    );

    return res.json({ jobId: job.id, queue: "resume-review" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to enqueue resume review job." });
  }
});

app.post("/api/queue/session-analytics", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, payload } = req.body || {};
    if (!sessionId || !payload) {
      return res.status(400).json({ error: "Session ID and payload are required." });
    }

    const job = await sessionAnalyticsQueue.add(
      "session-analytics",
      { sessionId, payload },
      {
        removeOnComplete: 3600,
        removeOnFail: 86400,
      }
    );

    return res.json({ jobId: job.id, queue: "session-analytics" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to enqueue session analytics job." });
  }
});

app.post("/api/queue/report-generation", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, title, payload } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: "User ID is required for report generation." });
    }

    const job = await reportGenerationQueue.add(
      "report-generation",
      { userId, title, payload },
      {
        removeOnComplete: 3600,
        removeOnFail: 86400,
      }
    );

    return res.json({ jobId: job.id, queue: "report-generation" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to enqueue report generation job." });
  }
});

app.get("/api/queue/status/:jobId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.jobId;
    const queues = [resumeReviewQueue, sessionAnalyticsQueue, reportGenerationQueue];

    for (const queue of queues) {
      const job = await queue.getJob(jobId);
      if (job) {
        return res.json({
          id: job.id,
          name: job.name,
          state: await job.getState(),
          data: job.data,
          failedReason: job.failedReason,
        });
      }
    }

    return res.status(404).json({ error: "Job not found." });
  } catch (error) {
    return res.status(500).json({ error: "Failed to read job status." });
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

    const cacheKey = makeCacheKey("interview-questions", `${domain}:${questionCount}`);
    if (cacheEnabled) {
      const cached = await getCached<{ questions: string[] }>(cacheKey);
      if (cached) return res.json(cached);
    }

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
      const responsePayload = { questions: fallback };
      if (cacheEnabled) await setCached(cacheKey, responsePayload);
      return res.json(responsePayload);
    }

    const responsePayload = { questions: parsed.questions.slice(0, questionCount) };
    if (cacheEnabled) await setCached(cacheKey, responsePayload);
    return res.json(responsePayload);
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
      .map((item: { question?: string; answer?: string }, index: number) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`)
      .join("\n\n");

    const cacheKey = makeCacheKey("interview-eval", `${domain}:${JSON.stringify(answers)}`);
    if (cacheEnabled) {
      const cached = await getCached<unknown>(cacheKey);
      if (cached) return res.json(cached);
    }

    const prompt = `You are an interview coach. Review the answers for the domain: ${domain}.
Return JSON only with the shape:
{\n  "summary": "string",\n  "strengths": ["string"],\n  "improvements": ["string"],\n  "overallScore": 0-100\n}

Interview transcript:\n${formatted}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = extractJson(responseText);

    if (!parsed) {
      const fallbackResponse = {
        summary: "Evaluation completed.",
        strengths: [],
        improvements: ["Could not parse structured response."],
        overallScore: 0,
        raw: responseText,
      };
      if (cacheEnabled) await setCached(cacheKey, fallbackResponse);
      return res.status(200).json(fallbackResponse);
    }

    if (cacheEnabled) await setCached(cacheKey, parsed);
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

      // Create session immediately with placeholder coaching
      const session = await prisma.interviewSession.create({
        data: {
          userId,
          domain,
          overallScore: overallScore ? Math.round(overallScore) : null,
          gazeScore: gazeScore ? Math.round(gazeScore) : null,
          postureScore: postureScore ? Math.round(postureScore) : null,
          calmScore: calmScore ? Math.round(calmScore) : null,
          engagementScore: engagementScore ? Math.round(engagementScore) : null,
          bodyLanguageScore: bodyLanguageScore ? Math.round(bodyLanguageScore) : null,
          stressTimeline: stressTimeline ? JSON.parse(JSON.stringify(stressTimeline)) : null,
          metricsDetail: metricsDetail ? JSON.parse(JSON.stringify(metricsDetail)) : null,
          feedback: {
            summary: feedback?.summary || "",
            strengths: feedback?.strengths || [],
            improvements: feedback?.improvements || [],
            coachingTips: {
              strengths: feedback?.strengths || [],
              improvements: feedback?.improvements || [],
              stress_management: [],
              practice_plan: [],
              confidence_tips: [],
              pattern_label: "Analyzing...",
              next_focus: "Generating personalized coaching feedback..."
            }
          },
        },
      });

      // Enqueue coaching generation and analytics to worker
      await sessionAnalyticsQueue.add(
        "session-analytics",
        {
          sessionId: session.id,
          userId,
          domain,
          overallScore,
          stressTimeline,
          metricsDetail,
          feedback,
          calmScore,
          engagementScore,
        },
        {
          removeOnComplete: 86400,
          removeOnFail: 604800,
        }
      );

      // Return immediately with the session
      return res.status(201).json({
        session,
        coachingStatus: "processing",
        message: "Session saved. Coaching feedback is being generated in background."
      });
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
