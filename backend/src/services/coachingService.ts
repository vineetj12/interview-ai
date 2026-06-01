import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey = process.env.GEMINI_API_KEY || "";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export interface CoachingFeedback {
  strengths: string[];
  improvements: string[];
  stress_management: string[];
  practice_plan: string[];
  confidence_tips: string[];
  pattern_label: string;
  next_focus: string;
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

export async function generateCoaching(session: {
  domain: string;
  overallScore: number | null;
  avgStress: number;
  engagementScore: number | null;
  emotionSummary: string;
  strengths: string[];
  improvements: string[];
}): Promise<CoachingFeedback | null> {
  if (!geminiApiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    const prompt = `You are an expert interview coach. Analyse this interview session and provide actionable coaching.

Domain: ${session.domain}
Overall Score: ${session.overallScore ?? "N/A"}/100
Average Stress Level: ${session.avgStress.toFixed(1)}/100
Engagement Score: ${session.engagementScore ?? "N/A"}/100
Emotional State: ${session.emotionSummary}
AI Strengths Noted: ${session.strengths.join(", ") || "None"}
AI Improvements Noted: ${session.improvements.join(", ") || "None"}

Return ONLY valid JSON with this exact shape (no markdown, no extra text):
{
  "strengths": ["string"],
  "improvements": ["string"],
  "stress_management": ["string"],
  "practice_plan": ["string"],
  "confidence_tips": ["string"],
  "pattern_label": "string (e.g. Anxious Performer, High Performer, Consistent Learner, Disengaged)",
  "next_focus": "string (one clear sentence on what to focus on next)"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = extractJson(text);
    if (!parsed) return null;
    return parsed as unknown as CoachingFeedback;
  } catch (e) {
    console.error("Coaching generation error:", e);
    return null;
  }
}
