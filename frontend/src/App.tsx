import { useMemo, useRef, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import './cv-components.css';

// Custom biometric computer vision engine hook
import { useWebcamCV } from './hooks/useWebcamCV';

// Reusable premium glassmorphic sub-components
import SideNavBar from './components/SideNavBar';
import AuthPanel from './components/AuthPanel';
import Dashboard from './components/Dashboard';
import ResumeReview from './components/ResumeReview';
import MockInterview from './components/MockInterview';
import AnalyticsDashboard from './components/AnalyticsDashboard';

// API Network Services
import { 
  User, 
  ReviewResponse, 
  InterviewAnswer, 
  InterviewResult, 
  authService, 
  resumeService, 
  interviewService, 
  analyticsService,
  setCredentials,
  clearCredentials
} from './services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PDF_WORKER_SRC = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs';

type StatusType = 'idle' | 'success' | 'error';
type Status = { type: StatusType; message: string };

function App() {
  // Auth state
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>({ type: 'idle', message: '' });
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Router views
  const [view, setView] = useState<'dashboard' | 'review' | 'results' | 'interview-setup' | 'interview-question' | 'interview-results' | 'analytics'>('dashboard');
  
  // Resume state
  const [domain, setDomain] = useState('Software Engineer');
  const [resumeStatus, setResumeStatus] = useState<Status>({ type: 'idle', message: '' });
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Mock Interview state
  const [showScores, setShowScores] = useState(false);
  const [interviewDomain, setInterviewDomain] = useState('Software Engineer');
  const [interviewCount, setInterviewCount] = useState(5);
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>([]);
  const [interviewIndex, setInterviewIndex] = useState(0);
  const [interviewAnswers, setInterviewAnswers] = useState<InterviewAnswer[]>([]);
  const [interviewResult, setInterviewResult] = useState<InterviewResult | null>(null);
  const [interviewStatus, setInterviewStatus] = useState<Status>({ type: 'idle', message: '' });
  const [isStartingInterview, setIsStartingInterview] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<Status>({ type: 'idle', message: '' });

  // History & Analytics logs
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Coaching generation polling
  const [coachingIsProcessing, setCoachingIsProcessing] = useState(false);
  const coachingRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Constants
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scoreHistory = useMemo(() => [62, 70, 68, 76, 81, 79, 86], []);

  // WebSockets telemetry
  const socketRef = useRef<Socket | null>(null);
  const [liveWebSocketStatus, setLiveWebSocketStatus] = useState<'disconnected' | 'connected'>('disconnected');

  // CV biometric computer vision diagnostics
  const cv = useWebcamCV();

  // Telemetry batching aggregator (5-second window)
  const telemetryBatchRef = useRef<any[]>([]);
  const telemetrySendTimeRef = useRef<number>(0);

  // Load Auth State from LocalStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('interviewai_user');
    const savedAccess = localStorage.getItem('interviewai_access');
    const savedRefresh = localStorage.getItem('interviewai_refresh');
    if (savedUser && savedAccess && savedRefresh) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Teardown WS socket and coaching polling on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (coachingRefreshRef.current) {
        clearInterval(coachingRefreshRef.current);
        coachingRefreshRef.current = null;
      }
    };
  }, []);

  // Auto load history and analytics summary when logged in
  useEffect(() => {
    if (user) {
      fetchPastSessions();
      fetchAnalytics();
    }
  }, [user]);

  // Sync active question index with CV tracker hook
  useEffect(() => {
    cv.setCurrentQuestionIndex(interviewIndex);
  }, [interviewIndex]);

  // Aggregate telemetry metrics locally every 5 seconds
  function aggregateTelemetry(samples: any[]) {
    if (samples.length === 0) return null;

    const aggregated = {
      sampleCount: samples.length,
      stress: {
        avg: samples.reduce((s, m) => s + m.stress.level, 0) / samples.length,
        min: Math.min(...samples.map(m => m.stress.level)),
        max: Math.max(...samples.map(m => m.stress.level))
      },
      blink: {
        total: samples.reduce((s, m) => s + (m.blink?.rate || 0), 0),
        avg: samples.reduce((s, m) => s + (m.blink?.rate || 0), 0) / samples.length
      },
      gaze: {
        screenCount: samples.filter(m => m.gaze.direction === 'screen').length,
        screenPercent: (samples.filter(m => m.gaze.direction === 'screen').length / samples.length) * 100
      },
      motion: {
        avg: samples.reduce((s, m) => s + m.motion.intensity, 0) / samples.length
      },
      emotion: {
        dominant: samples[samples.length - 1].emotion.dominant
      },
      lighting: {
        avg: samples.reduce((s, m) => s + (m.lighting?.level || 50), 0) / samples.length
      }
    };
    return aggregated;
  }

  // Batch telemetry updates and send every 5 seconds
  useEffect(() => {
    if (!cv.isActive || !user || !socketRef.current) return;

    telemetryBatchRef.current.push(cv.metrics);

    const now = Date.now();
    const timeSinceLastSend = now - telemetrySendTimeRef.current;

    if (timeSinceLastSend >= 5000) {
      const aggregated = aggregateTelemetry(telemetryBatchRef.current);
      if (aggregated) {
        socketRef.current.emit('telemetry:send', {
          userId: user.id,
          aggregated,
          batchSize: telemetryBatchRef.current.length
        });
      }
      telemetryBatchRef.current = [];
      telemetrySendTimeRef.current = now;
    }
  }, [cv.metrics, cv.isActive, user]);

  const fetchPastSessions = async () => {
    try {
      const sessions = await interviewService.getSessions();
      setPastSessions(sessions);
    } catch (err) {
      console.error("Failed to load historical sessions:", err);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const summary = await analyticsService.getSummary();
      setAnalyticsData(summary);
    } catch (err) {
      console.error("Failed to load advanced analytics trends:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Login / Register Submit
  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus({ type: 'idle', message: '' });
    setLoading(true);
    try {
      const payload = mode === 'login' 
        ? await authService.login(email, password)
        : await authService.register(email, password);

      setCredentials(payload.user, payload.accessToken, payload.refreshToken);
      setUser(payload.user);
      setStatus({ type: 'success', message: `Welcome back, ${payload.user.email}!` });
      setView('dashboard');
      setPassword('');
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Authentication connection failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {}
    
    setUser(null);
    clearCredentials();
    setStatus({ type: 'idle', message: '' });
    setPassword('');
    setView('dashboard');
    setReview(null);
    setSelectedFile(null);
    setResumeStatus({ type: 'idle', message: '' });
    resetInterviewState();
    setPastSessions([]);
    setAnalyticsData(null);
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setLiveWebSocketStatus('disconnected');
    }
  };

  const resetInterviewState = () => {
    setInterviewQuestions([]);
    setInterviewIndex(0);
    setInterviewAnswers([]);
    setInterviewResult(null);
    setInterviewStatus({ type: 'idle', message: '' });
    setIsStartingInterview(false);
    setIsRecording(false);
    setIsTranscribing(false);
    setCurrentTranscript('');
    cv.stop();

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setLiveWebSocketStatus('disconnected');
    }
  };

  // Client side PDF text extractor using pdfjs-dist
  const extractPdfText = async (file: File) => {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
    const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str || '').join(' ') + '\n';
    }
    return text.trim();
  };

  // Client side OCR text extractor using tesseract.js
  const extractResumeText = async (file: File) => {
    if (file.type === 'application/pdf') return extractPdfText(file);
    if (file.type.startsWith('image/')) {
      const { default: Tesseract } = await import('tesseract.js');
      const response = await Tesseract.recognize(file, 'eng');
      return response?.data?.text?.trim() || '';
    }
    return '';
  };

  // Initialize Mock Q&A evaluation session
  const handleStartInterview = async () => {
    setInterviewStatus({ type: 'idle', message: '' });
    setIsStartingInterview(true);
    try {
      const questions = await interviewService.start(interviewDomain, interviewCount);
      if (!questions.length) {
        setInterviewStatus({ type: 'error', message: 'No questions generated. Please verify domain name or try again.' });
        return;
      }

      setInterviewQuestions(questions);
      setInterviewIndex(0);
      setInterviewAnswers([]);
      setCurrentTranscript('');
      setView('interview-question');

      // Establish real-time secure WebSocket telemetry link
      const socket = io(API_BASE);
      socketRef.current = socket;

      socket.on('connect', () => {
        setLiveWebSocketStatus('connected');
        if (user) {
          socket.emit('session:start', { userId: user.id, domain: interviewDomain });
        }
      });

      socket.on('telemetry:processed', (processedData) => {
        console.log("WebSocket telemetry processed live by ML:", processedData);
      });

      socket.on('disconnect', () => {
        setLiveWebSocketStatus('disconnected');
      });

      // Auto start CV engine webcam HUD overlays
      await cv.start();
    } catch (err: any) {
      setInterviewStatus({ type: 'error', message: err.message || 'Failed to initialize session.' });
    } finally {
      setIsStartingInterview(false);
    }
  };

  const handleStartRecording = async () => {
    setInterviewStatus({ type: 'idle', message: '' });
    setCurrentTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        try {
          const transcript = await interviewService.transcribe(blob);
          
          setCurrentTranscript(prev => {
            const nextText = prev ? `${prev} ${transcript}` : transcript;
            
            const question = interviewQuestions[interviewIndex] || '';
            if (question) {
              setInterviewAnswers(answersPrev => {
                const u = [...answersPrev];
                u[interviewIndex] = { question, answer: nextText };
                return u;
              });
            }
            return nextText;
          });
        } catch (err: any) {
          setInterviewStatus({ type: 'error', message: err.message || 'Transcription capture failed.' });
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setInterviewStatus({ type: 'error', message: 'Unable to access your microphone. Please enable audio permissions.' });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleUpdateAnswer = (text: string) => {
    setCurrentTranscript(text);
    const question = interviewQuestions[interviewIndex] || '';
    if (question) {
      setInterviewAnswers(prev => {
        const u = [...prev];
        u[interviewIndex] = { question, answer: text };
        return u;
      });
    }
  };

  // Text-To-Speech Play Question Audio
  const handlePlayQuestion = async () => {
    const question = interviewQuestions[interviewIndex];
    if (!question) return;
    setTtsStatus({ type: 'idle', message: '' });
    setIsSpeaking(true);
    try {
      const blob = await interviewService.tts(question);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      await audio.play();
    } catch (err: any) {
      setTtsStatus({ type: 'error', message: err.message || 'TTS generation failed.' });
      setIsSpeaking(false);
    }
  };

  // Complete interview Q&A and fetch overall diagnostics summaries
  const handleFinishInterview = async () => {
    setInterviewStatus({ type: 'idle', message: '' });
    setIsStartingInterview(true);
    cv.stop(); // turn off webcam
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setLiveWebSocketStatus('disconnected');
    }

    try {
      const results = await interviewService.evaluate(interviewDomain, interviewAnswers);
      setInterviewResult(results);
      setView('interview-results');

      // Persist completed evaluation stats along with CV biometric logs
      if (user) {
        try {
          const saveResponse = await interviewService.saveSession({
            domain: interviewDomain,
            overallScore: results.overallScore,
            gazeScore: cv.metrics.gaze.score,
            postureScore: cv.metrics.posture.score,
            calmScore: 100 - cv.metrics.stress.level,
            engagementScore: cv.metrics.engagement,
            bodyLanguageScore: cv.metrics.overallBodyLanguage,
            stressTimeline: cv.timeline,
            metricsDetail: {
              lighting: cv.metrics.lighting.level,
              background: cv.metrics.background.complexity,
              blink: cv.metrics.blink.rate,
              smile: cv.metrics.smile.intensity,
              headNod: cv.metrics.headNod.frequency,
              grooming: cv.metrics.grooming.formalScore,
            },
            feedback: {
              summary: results.summary,
              strengths: results.strengths,
              improvements: results.improvements,
            }
          });

          // If coaching is being generated asynchronously, start polling
          if (saveResponse.coachingStatus === 'processing') {
            setCoachingIsProcessing(true);
            
            // Poll for coaching completion every 2 seconds
            coachingRefreshRef.current = setInterval(async () => {
              try {
                const sessions = await interviewService.getSessions();
                const latestSession = sessions?.[0];
                
                // Check if coaching has been updated (no longer "Analyzing...")
                if (latestSession?.feedback?.coachingTips?.pattern_label && 
                    latestSession.feedback.coachingTips.pattern_label !== "Analyzing...") {
                  // Coaching has been generated, update results
                  setInterviewResult({
                    summary: results.summary,
                    strengths: results.strengths,
                    improvements: results.improvements,
                    overallScore: results.overallScore,
                    coachingTips: latestSession.feedback.coachingTips
                  });
                  setCoachingIsProcessing(false);
                  
                  // Clear the polling interval
                  if (coachingRefreshRef.current) {
                    clearInterval(coachingRefreshRef.current);
                    coachingRefreshRef.current = null;
                  }
                }
              } catch (pollErr) {
                console.error("Error polling for coaching update:", pollErr);
              }
            }, 2000);
          }

          // Reload sessions logs
          await fetchPastSessions();
          await fetchAnalytics();
        } catch (saveErr) {
          console.error("Failed to persist session to database:", saveErr);
        }
      }
    } catch (err: any) {
      setInterviewStatus({ type: 'error', message: err.message || 'Evaluation scoring failed.' });
    } finally {
      setIsStartingInterview(false);
    }
  };

  return (
    <div className="page" style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)', color: 'var(--text)' }}>
      
      {/* Animated background orbs */}
      <div className="bg-orbs" aria-hidden="true">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      {/* Side Navigation bar */}
      <SideNavBar 
        currentView={view} 
        onChangeView={setView} 
        user={user} 
        onLogout={handleLogout}
        onFetchAnalytics={fetchAnalytics}
      />

      {/* Main Container Canvas */}
      <div 
        className="main-container-wrapper" 
        style={{ 
          flex: 1, 
          paddingLeft: user ? '260px' : '0px', 
          transition: 'padding-left 0.3s ease',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        
        {/* Top Navbar */}
        <nav 
          className="topnav" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '16px 40px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(19, 19, 24, 0.6)',
            backdropFilter: 'blur(20px)',
            position: 'sticky',
            top: 0,
            zIndex: 40,
            height: '65px'
          }}
        >
          <div className="topnav-logo" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => user && setView('dashboard')}>
            <span className="topnav-logo-dot" />
            <span>InterviewAI Workspace</span>
          </div>
          
          {user && (
            <div className="topnav-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                type="button"
                className={`ghost ${view === 'analytics' ? 'active' : ''}`}
                style={{ color: '#00ffc8', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  fetchAnalytics();
                  setView('analytics');
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>analytics</span>
                <span>Active Telemetry Analytics</span>
              </button>
            </div>
          )}
        </nav>

        {/* Content Layout Canvas */}
        <main style={{ flex: 1, padding: '40px', zIndex: 10, position: 'relative' }}>
          
          {/* Auth Forms screen */}
          {!user && (
            <div className="auth-layout" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 150px)' }}>
              <AuthPanel 
                mode={mode}
                setMode={setMode}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                status={status}
                loading={loading}
                onSubmit={handleAuthSubmit}
                apiBase={API_BASE}
              />
            </div>
          )}

          {/* Interactive Router screens */}
          {user && (
            <>
              {view === 'dashboard' && (
                <Dashboard 
                  user={user}
                  onNavigate={setView}
                  pastSessions={pastSessions}
                  scoreHistory={scoreHistory}
                  showScores={showScores}
                  onToggleScores={() => setShowScores(!showScores)}
                  onFetchAnalytics={fetchAnalytics}
                />
              )}

              {view === 'analytics' && (
                <AnalyticsDashboard 
                  data={analyticsData} 
                  loading={loadingAnalytics} 
                />
              )}

              {(view === 'review' || view === 'results') && (
                <ResumeReview 
                  domain={domain}
                  setDomain={setDomain}
                  resumeStatus={resumeStatus}
                  setResumeStatus={setResumeStatus}
                  review={review}
                  setReview={setReview}
                  isReviewing={isReviewing}
                  setIsReviewing={setIsReviewing}
                  selectedFile={selectedFile}
                  setSelectedFile={setSelectedFile}
                  onNavigate={setView}
                  extractResumeText={extractResumeText}
                />
              )}

              {(view === 'interview-setup' || view === 'interview-question' || view === 'interview-results') && (
                <MockInterview 
                  view={view}
                  onNavigate={setView}
                  interviewDomain={interviewDomain}
                  setInterviewDomain={setInterviewDomain}
                  interviewCount={interviewCount}
                  setInterviewCount={setInterviewCount}
                  interviewStatus={interviewStatus}
                  isStartingInterview={isStartingInterview}
                  onStartInterview={handleStartInterview}
                  interviewQuestions={interviewQuestions}
                  interviewIndex={interviewIndex}
                  setInterviewIndex={setInterviewIndex}
                  interviewAnswers={interviewAnswers}
                  currentTranscript={currentTranscript}
                  setCurrentTranscript={setCurrentTranscript}
                  onUpdateAnswer={handleUpdateAnswer}
                  isRecording={isRecording}
                  isTranscribing={isTranscribing}
                  isSpeaking={isSpeaking}
                  ttsStatus={ttsStatus}
                  liveWebSocketStatus={liveWebSocketStatus}
                  onPlayQuestion={handlePlayQuestion}
                  onStartRecording={handleStartRecording}
                  onStopRecording={handleStopRecording}
                  onFinishInterview={handleFinishInterview}
                  onResetInterview={resetInterviewState}
                  cv={cv}
                  interviewResult={interviewResult}
                />
              )}
            </>
          )}

        </main>

      </div>
    </div>
  );
}

export default App;
