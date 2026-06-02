import GlassCard from './GlassCard';
import WebcamFeed from './WebcamFeed';
import TelemetryDashboard from './TelemetryDashboard';
import StressHeatmap from './StressHeatmap';
import PDFReport from './PDFReport';

interface Status {
  type: 'idle' | 'success' | 'error';
  message: string;
}

interface InterviewAnswer {
  question: string;
  answer: string;
}

interface InterviewResult {
  summary: string;
  strengths: string[];
  improvements: string[];
  overallScore: number;
  coachingTips?: {
    strengths: string[];
    improvements: string[];
    stress_management: string[];
    practice_plan: string[];
    confidence_tips: string[];
    pattern_label: string;
    next_focus: string;
  };
}

interface Props {
  view: 'interview-setup' | 'interview-question' | 'interview-results';
  onNavigate: (view: any) => void;
  // Setup state & triggers
  interviewDomain: string;
  setInterviewDomain: (domain: string) => void;
  interviewCount: number;
  setInterviewCount: (count: number) => void;
  interviewStatus: Status;
  isStartingInterview: boolean;
  onStartInterview: () => void;
  // Question Q&A state & triggers
  interviewQuestions: string[];
  interviewIndex: number;
  setInterviewIndex: React.Dispatch<React.SetStateAction<number>>;
  interviewAnswers: InterviewAnswer[];
  currentTranscript: string;
  setCurrentTranscript: (t: string) => void;
  onUpdateAnswer: (text: string) => void;
  isRecording: boolean;
  isTranscribing: boolean;
  isSpeaking: boolean;
  ttsStatus: Status;
  liveWebSocketStatus: 'disconnected' | 'connected';
  onPlayQuestion: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onFinishInterview: () => void;
  onResetInterview: () => void;
  // CV & Telemetry states
  cv: any; // client-side computer vision hook details
  interviewResult: InterviewResult | null;
}

export default function MockInterview({
  view,
  onNavigate,
  interviewDomain,
  setInterviewDomain,
  interviewCount,
  setInterviewCount,
  interviewStatus,
  isStartingInterview,
  onStartInterview,
  interviewQuestions,
  interviewIndex,
  setInterviewIndex,
  interviewAnswers,
  currentTranscript,
  setCurrentTranscript,
  onUpdateAnswer,
  isRecording,
  isTranscribing,
  isSpeaking,
  ttsStatus,
  liveWebSocketStatus,
  onPlayQuestion,
  onStartRecording,
  onStopRecording,
  onFinishInterview,
  onResetInterview,
  cv,
  interviewResult
}: Props) {
  
  // Render Step 1: Configuration & Setup
  if (view === 'interview-setup') {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <button 
          type="button" 
          className="ghost" 
          onClick={() => onNavigate('dashboard')} 
          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Back to Dashboard</span>
        </button>

        <GlassCard className="feature-panel" style={{ padding: '32px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary-dim)', margin: 0 }}>Launch Prep Session</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Select your target domain and question load size. Make sure your camera and microphone are connected.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
              CAREER DOMAIN
              <input 
                type="text" 
                value={interviewDomain} 
                onChange={e => setInterviewDomain(e.target.value)} 
                placeholder="e.g. Senior Software Engineer" 
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
              NUMBER OF QUESTIONS
              <input 
                type="number" 
                min={1} 
                max={10} 
                value={interviewCount} 
                onChange={e => setInterviewCount(Number(e.target.value))} 
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
            </label>

            <button 
              type="button" 
              className="btn-primary" 
              onClick={onStartInterview} 
              disabled={isStartingInterview}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px' }}
            >
              <span className="material-symbols-outlined">play_circle</span>
              <span>{isStartingInterview ? '⏳ Starting Mock session...' : 'Initialize Prep Session'}</span>
            </button>

            {interviewStatus.message && (
              <div className={`status ${interviewStatus.type === 'error' ? 'error' : 'success'}`} role="status">
                {interviewStatus.type === 'error' ? '❌' : '✔'} {interviewStatus.message}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    );
  }

  // Render Step 2: Live Mock Q&A
  if (view === 'interview-question') {
    const questionText = interviewQuestions[interviewIndex] || '';

    return (
      <div 
        className="interview-cv-layout-compact" 
        style={{ 
          display: 'flex', 
          gap: '24px', 
          position: 'relative',
          width: '100%',
          height: 'calc(100vh - 130px)',
          overflow: 'hidden',
          alignItems: 'start'
        }}
      >
        
        {/* Left Column: Webcam Video Viewport */}
        <div 
          className="interview-cv-video-col" 
          style={{ 
            flex: 1.3, 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center',
            maxHeight: '100%'
          }}
        >
          <WebcamFeed
            videoRef={cv.videoRef}
            canvasRef={cv.canvasRef}
            overlayRef={cv.overlayRef}
            metrics={cv.metrics}
            isActive={cv.isActive}
            onStart={cv.start}
            onStop={cv.stop}
          />
        </div>

        {/* Right Column: Question Card & Telemetry Dashboard */}
        <div 
          className="interview-cv-stats-col" 
          style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px',
            height: '100%',
            overflowY: 'auto',
            paddingRight: '6px'
          }}
        >
          {/* Question Card */}
          <GlassCard className="feature-panel" style={{ margin: 0, padding: '16px 20px' }}>
            
            {/* Question Header & Status Indicators */}
            <div className="question-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span className="question-counter" style={{ fontSize: '10px', background: 'rgba(108, 99, 255, 0.1)', color: 'var(--primary-dim)', border: '1px solid rgba(108, 99, 255, 0.2)', padding: '3px 8px', borderRadius: '20px', fontWeight: 'bold' }}>
                Question {interviewIndex + 1} of {interviewQuestions.length}
              </span>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span 
                  className="badge" 
                  style={{ 
                    backgroundColor: liveWebSocketStatus === 'connected' ? 'rgba(0, 255, 200, 0.1)' : 'rgba(255, 68, 102, 0.1)', 
                    color: liveWebSocketStatus === 'connected' ? '#00ffc8' : '#ff4466',
                    border: '1px solid currentColor',
                    padding: '2px 6px',
                    fontSize: '9px',
                    borderRadius: '6px',
                    fontWeight: 600
                  }}
                >
                  {liveWebSocketStatus === 'connected' ? '⚡ LIVE ML' : '📡 CONNECTING'}
                </span>
                
                <button 
                  type="button" 
                  className="ghost" 
                  onClick={onPlayQuestion} 
                  disabled={isSpeaking}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    {isSpeaking ? 'volume_up' : 'volume_mute'}
                  </span>
                  <span>{isSpeaking ? 'Speaking…' : 'Play'}</span>
                </button>
              </div>
            </div>

            <p className="question-text" style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.4, margin: '4px 0 16px', color: '#fff' }}>
              {questionText}
            </p>

            {/* Recording Controls */}
            <div className="recorder-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              {!isRecording ? (
                <button 
                  type="button" 
                  className="btn-record start" 
                  onClick={onStartRecording} 
                  disabled={isTranscribing}
                  style={{
                    border: 'none',
                    padding: '10px 16px',
                    background: 'rgba(255, 68, 102, 0.12)',
                    border: '1px solid rgba(255, 68, 102, 0.3)',
                    color: '#ff4466',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span className="record-dot" style={{ width: '6px', height: '6px', background: '#ff4466', borderRadius: '50%', display: 'inline-block' }} />
                  Start Recording
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn-record stop" 
                  onClick={onStopRecording}
                  style={{
                    border: 'none',
                    padding: '10px 16px',
                    background: '#ff4466',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 12px rgba(255,68,102,0.4)'
                  }}
                >
                  ⏹ Stop
                </button>
              )}
              
              <span className={`recorder-status ${isRecording ? 'recording' : isTranscribing ? 'transcribing' : ''}`} style={{ fontSize: '11px', color: isRecording ? '#ff4466' : isTranscribing ? '#c4c0ff' : 'var(--text-faint)', fontWeight: 600 }}>
                {isRecording ? '● Recording...' : isTranscribing ? '⏳ Transcribing...' : 'Ready'}
              </span>
            </div>

            {/* Live Text Response & Audio Transcript Editor */}
            <div className="transcript-box" style={{ marginTop: '12px' }}>
              <h4 style={{ fontSize: '10px', color: 'var(--primary-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                Your Response (Type or Record Speech)
              </h4>
              <textarea
                value={currentTranscript}
                onChange={e => onUpdateAnswer(e.target.value)}
                placeholder="Type your response here directly, or click 'Start Recording' above to dictate your response via microphone..."
                style={{
                  width: '100%',
                  height: '80px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--text)',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--primary)';
                  e.target.style.boxShadow = '0 0 0 2px rgba(108,99,255,0.15)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {interviewStatus.message && (
              <div className={`status ${interviewStatus.type === 'error' ? 'error' : 'success'}`} role="status" style={{ marginTop: '12px', padding: '8px 12px', fontSize: '12px' }}>
                {interviewStatus.message}
              </div>
            )}
            {ttsStatus.message && (
              <div className={`status ${ttsStatus.type === 'error' ? 'error' : 'success'}`} role="status" style={{ marginTop: '12px', padding: '8px 12px', fontSize: '12px' }}>
                {ttsStatus.message}
              </div>
            )}

            {/* Next / Finish Actions */}
            <div className="interview-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              {interviewIndex < interviewQuestions.length - 1 ? (
                <button 
                  type="button" 
                  className="ghost" 
                  onClick={() => { setInterviewIndex(i => i + 1); setCurrentTranscript('') }} 
                  disabled={!currentTranscript}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', fontSize: '12px' }}
                >
                  <span>Next Question</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                </button>
              ) : (
                <button 
                  type="button" 
                  className="primary" 
                  onClick={onFinishInterview} 
                  disabled={!currentTranscript || isStartingInterview}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '12px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                  <span>{isStartingInterview ? 'Evaluating...' : 'Finish Interview'}</span>
                </button>
              )}
            </div>

          </GlassCard>

          {/* Telemetry Dashboard - CV Diagnostics List */}
          <TelemetryDashboard metrics={cv.metrics} />
        </div>

      </div>
    );
  }

  // Render Step 3: Evaluations Summary report & stressTimeline
  if (view === 'interview-results') {
    return (
      <div className="cv-results-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Results Header */}
        <GlassCard style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '24px 32px' }}>
          <div>
            <h3 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Evaluation Analysis Completed!</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Your mock evaluation is processed. Review structured AI coaching, composure hotspots, and reports.
            </p>
          </div>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={onResetInterview}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_circle</span>
            <span>Launch New Prep</span>
          </button>
        </GlassCard>

        {/* Full Details layout */}
        <div className="interview-cv-layout" style={{ display: 'flex', gap: '24px', alignItems: 'start' }}>
          
          {/* Main Details column */}
          <div className="interview-cv-main" style={{ flex: 1.8, display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {interviewResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Score and summary split */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '16px' }}>
                  <GlassCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(108, 99, 255, 0.08)', borderColor: 'rgba(108, 99, 255, 0.25)' }}>
                    <h4 style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' }}>Cumulative score</h4>
                    <div style={{ fontSize: '56px', fontWeight: 900, background: 'linear-gradient(135deg, #c4c0ff, var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '4px 0' }}>
                      {interviewResult.overallScore}%
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>OVERALL AI SCORE</span>
                  </GlassCard>
                  
                  <GlassCard style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '10px' }}>AI Performance Critique</h4>
                    <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>{interviewResult.summary}</p>
                  </GlassCard>
                </div>

                {/* Secure Gemini AI Coaching Recommendation */}
                <GlassCard style={{ borderLeft: '4px solid #a78bfa', backgroundColor: 'rgba(167, 139, 250, 0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ color: '#a78bfa', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      🧠 Expert AI Coaching Recommendations
                    </h4>
                    {interviewResult.coachingTips?.pattern_label === "Analyzing..." && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#a78bfa' }}>
                        <div 
                          style={{ 
                            width: '8px', 
                            height: '8px', 
                            background: '#a78bfa', 
                            borderRadius: '50%', 
                            animation: 'pulse 1.5s infinite' 
                          }} 
                        />
                        Generating...
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <h5 style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', margin: '0 0 4px' }}>Behavioral Profile</h5>
                      <span className="badge" style={{ display: 'inline-block', backgroundColor: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa', border: '1px solid rgba(167, 139, 250, 0.2)', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}>
                        {interviewResult.coachingTips?.pattern_label === "Analyzing..." ? (
                          <span style={{ opacity: 0.6 }}>Analyzing behavior patterns...</span>
                        ) : (
                          interviewResult.coachingTips?.pattern_label || "Consistent Learner"
                        )}
                      </span>
                    </div>

                    <div>
                      <h5 style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', margin: '0 0 6px' }}>Stress Management Guidelines</h5>
                      {interviewResult.coachingTips?.pattern_label === "Analyzing..." ? (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Generating personalized stress management tips...</p>
                      ) : (
                        <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {(interviewResult.coachingTips?.stress_management || [
                            "Maintain a steady eye direction to express active composure.",
                            "Coordinate breathing pauses between core structural responses."
                          ]).map((tip, idx) => (
                            <li key={idx} style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{tip}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <h5 style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', margin: '0 0 6px' }}>5-Day Targeted Practice Plan</h5>
                      {interviewResult.coachingTips?.pattern_label === "Analyzing..." ? (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Generating practice recommendations...</p>
                      ) : (
                        <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {(interviewResult.coachingTips?.practice_plan || [
                            "Practice structural interview framework techniques like STAR formats.",
                            "Launch another 5-question mock session focusing entirely on the Software domain."
                          ]).map((plan, idx) => (
                            <li key={idx} style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{plan}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <h5 style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', margin: '0 0 6px' }}>Confidence Building Tips</h5>
                      {interviewResult.coachingTips?.pattern_label === "Analyzing..." ? (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Generating confidence tips...</p>
                      ) : (
                        <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {(interviewResult.coachingTips?.confidence_tips || [
                            "Express natural body language and sit upright to command attention.",
                            "Keep a solid eye contact score and pause before answering."
                          ]).map((tip, idx) => (
                            <li key={idx} style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{tip}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', marginTop: '4px' }}>
                      <h5 style={{ color: '#00ffc8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Immediate Recruiter Standout Focus</h5>
                      {interviewResult.coachingTips?.pattern_label === "Analyzing..." ? (
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Generating focused recommendations...</p>
                      ) : (
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          "{interviewResult.coachingTips?.next_focus || "Focus on stabilizing eye contact rates and solidifying postural composure."}"
                        </p>
                      )}
                    </div>

                  </div>
                </GlassCard>

                {/* Strengths & Improvements */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <GlassCard>
                    <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#10b981', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '12px' }}>Identified Strengths</h4>
                    <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {interviewResult.strengths?.map((s, idx) => (
                        <li key={idx} style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s}</li>
                      ))}
                    </ul>
                  </GlassCard>

                  <GlassCard>
                    <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#ff4466', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '12px' }}>Suggested Improvements</h4>
                    <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {interviewResult.improvements?.map((s, idx) => (
                        <li key={idx} style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s}</li>
                      ))}
                    </ul>
                  </GlassCard>
                </div>

              </div>
            ) : (
              <GlassCard>No evaluation details found.</GlassCard>
            )}

            {/* Stress Heatmap progress timeline */}
            <StressHeatmap timeline={cv.timeline} questionCount={interviewQuestions.length} />

          </div>

          {/* Sidebar Telemetry diagnostics */}
          <div className="interview-cv-sidebar" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <PDFReport
              metrics={cv.metrics}
              timeline={cv.timeline}
              questions={interviewQuestions}
              answers={interviewAnswers}
              domain={interviewDomain}
              interviewResult={interviewResult}
            />
            <TelemetryDashboard metrics={cv.metrics} />
          </div>

        </div>

      </div>
    );
  }

  return null;
}
