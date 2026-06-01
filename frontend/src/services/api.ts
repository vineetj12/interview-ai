const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ReviewResponse {
  summary: string;
  strengths: string[];
  improvements: string[];
  keywordsToAdd: string[];
  overallScore: number;
}

export interface InterviewAnswer {
  question: string;
  answer: string;
}

export interface CoachingTips {
  strengths: string[];
  improvements: string[];
  stress_management: string[];
  practice_plan: string[];
  confidence_tips: string[];
  pattern_label: string;
  next_focus: string;
}

export interface InterviewResult {
  summary: string;
  strengths: string[];
  improvements: string[];
  overallScore: number;
  coachingTips?: CoachingTips;
}

// Token helper getters
export const getAccessToken = () => localStorage.getItem('interviewai_access');
export const getRefreshToken = () => localStorage.getItem('interviewai_refresh');
export const getUser = (): User | null => {
  const userStr = localStorage.getItem('interviewai_user');
  return userStr ? JSON.parse(userStr) : null;
};

// Set token credentials
export const setCredentials = (user: User, accessToken: string, refreshToken: string) => {
  localStorage.setItem('interviewai_user', JSON.stringify(user));
  localStorage.setItem('interviewai_access', accessToken);
  localStorage.setItem('interviewai_refresh', refreshToken);
};

// Clear token credentials
export const clearCredentials = () => {
  localStorage.removeItem('interviewai_user');
  localStorage.removeItem('interviewai_access');
  localStorage.removeItem('interviewai_refresh');
};

// Authenticated fetch wrapper with token rotation auto-retry
export const authenticatedFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  let accessToken = getAccessToken();
  const headers = new Headers(options.headers || {});
  
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  options.headers = headers;

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  let res = await fetch(url, options);

  // If unauthorized (access token expired), attempt rotation
  if (res.status === 401) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (refreshRes.ok) {
          const tokens = await refreshRes.json() as { accessToken: string; refreshToken: string };
          
          // Store new rotated pair
          localStorage.setItem('interviewai_access', tokens.accessToken);
          localStorage.setItem('interviewai_refresh', tokens.refreshToken);

          // Retry original request with new access token
          headers.set('Authorization', `Bearer ${tokens.accessToken}`);
          options.headers = headers;
          res = await fetch(url, options);
        } else {
          clearCredentials();
          window.location.reload();
        }
      } catch (err) {
        clearCredentials();
        window.location.reload();
      }
    }
  }
  return res;
};

// Authentication Services
export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Login failed.');
    return payload as AuthResponse;
  },

  register: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Registration failed.');
    return payload as AuthResponse;
  },

  logout: async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    clearCredentials();
  }
};

// Resume Review Services
export const resumeService = {
  review: async (text: string, domain: string): Promise<ReviewResponse> => {
    const res = await authenticatedFetch('/api/resume/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, domain })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Resume review failed.');
    return payload as ReviewResponse;
  }
};

// Mock Interview Services
export const interviewService = {
  start: async (domain: string, count: number): Promise<string[]> => {
    const res = await authenticatedFetch('/api/interview/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, count })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Failed to generate questions.');
    return payload.questions || [];
  },

  transcribe: async (audioBlob: Blob): Promise<string> => {
    const fd = new FormData();
    fd.append('audio', audioBlob, 'answer.webm');
    const res = await authenticatedFetch('/api/interview/transcribe', {
      method: 'POST',
      body: fd
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Transcription failed.');
    return payload.transcript || '';
  },

  tts: async (text: string): Promise<Blob> => {
    const res = await authenticatedFetch('/api/interview/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) {
      const payload = await res.json();
      throw new Error(payload.error || 'TTS generation failed.');
    }
    return res.blob();
  },

  evaluate: async (domain: string, answers: InterviewAnswer[]): Promise<InterviewResult> => {
    const res = await authenticatedFetch('/api/interview/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, answers })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Evaluation failed.');
    return payload as InterviewResult;
  },

  saveSession: async (sessionData: {
    domain: string;
    overallScore: number;
    gazeScore: number;
    postureScore: number;
    calmScore: number;
    engagementScore: number;
    bodyLanguageScore: number;
    stressTimeline: any[];
    metricsDetail: {
      lighting: number;
      background: number;
      blink: number;
      smile: number;
      headNod: number;
      grooming: number;
    };
    feedback: {
      summary: string;
      strengths: string[];
      improvements: string[];
    };
  }): Promise<any> => {
    const res = await authenticatedFetch('/api/interview/session/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Failed to save session.');
    return payload;
  },

  getSessions: async (): Promise<any[]> => {
    const res = await authenticatedFetch('/api/interview/sessions');
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Failed to fetch sessions.');
    return payload.sessions || [];
  }
};

// Analytics Services
export const analyticsService = {
  getSummary: async (): Promise<any> => {
    const res = await authenticatedFetch('/api/analytics/summary');
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Failed to fetch analytics.');
    return payload;
  }
};
