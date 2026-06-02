import dotenv from "dotenv";
import { Worker, Job } from "bullmq";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "./prisma.js";
import { generateCoaching } from "./services/coachingService.js";
import { predictStress } from "./services/mlService.js";

dotenv.config();

const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
if (!redisUrl) {
  console.error("Missing REDIS_URL or REDIS_TLS_URL for worker.");
  process.exit(1);
}

const connection = { url: redisUrl };
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function generateResumeReview(text: string, domain?: string) {
  if (!geminiApiKey) {
    return {
      summary: "Resume review worker could not run: missing GEMINI_API_KEY.",
      strengths: [],
      improvements: ["Gemini API key not configured for worker."],
      keywordsToAdd: [],
      overallScore: 0,
    };
  }

  const prompt = `You are a resume reviewer. Analyze the resume text for the target domain: ${
    domain || "general software"
  }.
Return JSON only with the shape:
{\n  "summary": "string",\n  "strengths": ["string"],\n  "improvements": ["string"],\n  "keywordsToAdd": ["string"],\n  "overallScore": 0-100\n}

Resume text:\n${text}`;

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: geminiModel });
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const parsed = extractJson(responseText);
  if (!parsed) {
    return {
      summary: "Review completed.",
      strengths: [],
      improvements: ["Could not parse structured response from Gemini."],
      keywordsToAdd: [],
      overallScore: 0,
      raw: responseText,
    };
  }
  return parsed;
}

type ResumeReviewJob = {
  text: string;
  domain?: string;
  requestId?: string;
};

type SessionAnalyticsJob = {
  sessionId: string;
  userId: string;
  domain: string;
  overallScore?: number;
  stressTimeline?: any[];
  metricsDetail?: any;
  feedback?: any;
  calmScore?: number;
  engagementScore?: number;
};

type ReportGenerationJob = {
  userId?: string;
  title?: string;
  payload?: Record<string, unknown>;
};

new Worker<ResumeReviewJob>(
  "resume-review",
  async (job: Job<ResumeReviewJob>) => {
    const result = await generateResumeReview(job.data.text, job.data.domain);
    return {
      jobId: job.id,
      requestId: job.data.requestId,
      type: job.name,
      result,
      completedAt: new Date().toISOString(),
    };
  },
  { connection }
)
  .on("completed", (job) => {
    console.log(`✅ Resume review job completed: ${job.id}`);
  })
  .on("failed", (job, err) => {
    console.error(`❌ Resume review job failed: ${job?.id}`, err?.message || err);
  });

new Worker<SessionAnalyticsJob>(
  "session-analytics",
  async (job: Job<SessionAnalyticsJob>) => {
    const { sessionId, userId, domain, overallScore, stressTimeline, metricsDetail, feedback, calmScore, engagementScore } = job.data;

    try {
      // Calculate stress metrics from timeline
      let finalCalm = calmScore || 50;
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
          posture_score: metricsDetail?.postureScore || 80,
        });

        if (predicted) {
          finalCalm = Math.round(100 - predicted.stress_level);
        }
      }

      // Extract emotion summary
      const emotionDominant = stressTimeline && stressTimeline.length > 0
        ? stressTimeline[stressTimeline.length - 1].emotion || "neutral"
        : "neutral";

      // Generate coaching feedback via Gemini
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

      // Update session with coaching feedback
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          feedback: mergedFeedback,
          calmScore: finalCalm,
        },
      });

      return {
        jobId: job.id,
        sessionId,
        status: "coaching-generated",
        coachingUpdated: true,
        finalCalm,
      };
    } catch (error) {
      console.error(`❌ Analytics job ${job.id} processing error:`, error);
      throw error;
    }
  },
  { connection }
)
  .on("completed", (job) => {
    console.log(`✅ Analytics job completed: ${job.id}`);
  })
  .on("failed", (job, err) => {
    console.error(`❌ Analytics job failed: ${job?.id}`, err?.message || err);
  });

new Worker<ReportGenerationJob>(
  "report-generation",
  async (job: Job<ReportGenerationJob>) => {
    return {
      jobId: job.id,
      report: {
        title: job.data.title || "InterviewAI Report",
        userId: job.data.userId,
        url: `https://example.com/reports/${job.id}.pdf`,
        generatedAt: new Date().toISOString(),
      },
    };
  },
  { connection }
)
  .on("completed", (job) => {
    console.log(`✅ Report generation job completed: ${job.id}`);
  })
  .on("failed", (job, err) => {
    console.error(`❌ Report generation job failed: ${job?.id}`, err?.message || err);
  });

console.log("🎧 Worker process started for resume-review, session-analytics, and report-generation queues.");
