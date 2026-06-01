import React, { useRef } from 'react';
import GlassCard from './GlassCard';
import { resumeService } from '../services/api';

interface Status {
  type: 'idle' | 'success' | 'error';
  message: string;
}

interface Review {
  summary: string;
  strengths: string[];
  improvements: string[];
  keywordsToAdd: string[];
  overallScore: number;
}

interface Props {
  domain: string;
  setDomain: (d: string) => void;
  resumeStatus: Status;
  setResumeStatus: (s: Status) => void;
  review: Review | null;
  setReview: (r: Review | null) => void;
  isReviewing: boolean;
  setIsReviewing: (b: boolean) => void;
  selectedFile: File | null;
  setSelectedFile: (f: File | null) => void;
  onNavigate: (view: any) => void;
  extractResumeText: (file: File) => Promise<string>;
}

export default function ResumeReview({
  domain,
  setDomain,
  resumeStatus,
  setResumeStatus,
  review,
  setReview,
  isReviewing,
  setIsReviewing,
  selectedFile,
  setSelectedFile,
  onNavigate,
  extractResumeText
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    setReview(null);
    setResumeStatus({ type: 'idle', message: '' });
    setIsReviewing(true);

    try {
      setResumeStatus({ type: 'idle', message: 'Extracting text from resume file...' });
      const text = await extractResumeText(file);
      
      if (!text) {
        setResumeStatus({ type: 'error', message: 'Unable to extract text contents from file. Please ensure it is a text-based PDF or readable image.' });
        setIsReviewing(false);
        return;
      }

      setResumeStatus({ type: 'idle', message: 'Analyzing resume with Gemini AI...' });
      const results = await resumeService.review(text, domain);
      
      setReview(results);
      setResumeStatus({ type: 'success', message: 'Review completed successfully!' });
    } catch (err: any) {
      setResumeStatus({ type: 'error', message: err.message || 'Resume review analysis failed.' });
    } finally {
      setIsReviewing(false);
    }
  };

  const handleReset = () => {
    setReview(null);
    setSelectedFile(null);
    setResumeStatus({ type: 'idle', message: '' });
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Back to dashboard button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button 
          type="button" 
          className="ghost" 
          onClick={() => onNavigate('dashboard')} 
          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Main Review Form */}
      {!review ? (
        <GlassCard className="feature-panel" style={{ padding: '32px' }}>
          <div>
            <h3 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--primary-dim)' }}>AI Resume Evaluator</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Upload your resume document (PDF or readable Image) to evaluate it against your target job profile requirements.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
              TARGET ROLE DOMAIN
              <input 
                type="text" 
                value={domain} 
                onChange={e => setDomain(e.target.value)} 
                placeholder="e.g. Lead Software Engineer" 
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

            {/* Custom file dropzone component */}
            <div 
              onClick={() => fileInputRef.current && (fileInputRef.current.value = '', fileInputRef.current.click())}
              style={{
                border: '2px dashed rgba(108, 99, 255, 0.25)',
                borderRadius: '16px',
                padding: '40px 24px',
                textAlign: 'center',
                background: 'rgba(108, 99, 255, 0.02)',
                cursor: isReviewing ? 'wait' : 'pointer',
                transition: 'all 0.3s ease',
              }}
              className="dropzone-area"
            >
              <input 
                ref={fileInputRef} 
                className="file-input" 
                type="file" 
                accept=".pdf,.png,.jpg,.jpeg" 
                onChange={handleFileChange} 
                disabled={isReviewing}
                style={{ display: 'none' }}
              />
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--primary-dim)', opacity: 0.8 }}>
                upload_file
              </span>
              <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text)', margin: '12px 0 4px' }}>
                {isReviewing ? 'Processing Resume Document...' : 'Upload PDF or Image Resume'}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-faint)', margin: 0 }}>
                Supports standard Resume PDFs, PNG, or JPEG files up to 12MB.
              </p>
            </div>

            {selectedFile && (
              <div className="file-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(108, 99, 255, 0.08)', borderRadius: '10px', border: '1px solid rgba(108, 99, 255, 0.2)', fontSize: '13px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary-dim)' }}>description</span>
                <span>Active File: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
            )}

            {resumeStatus.message && (
              <div className={`status ${resumeStatus.type === 'error' ? 'error' : 'success'}`} role="status" style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '13px', background: resumeStatus.type === 'error' ? 'var(--error-bg)' : 'rgba(108, 99, 255, 0.05)', borderColor: resumeStatus.type === 'error' ? 'var(--error-border)' : 'rgba(108, 99, 255, 0.2)', borderStyle: 'solid', borderWidth: '1px' }}>
                {isReviewing ? '⏳' : resumeStatus.type === 'error' ? '❌' : '✔'} {resumeStatus.message}
              </div>
            )}
          </div>
        </GlassCard>
      ) : (
        /* Review Results */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <GlassCard style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '20px 32px' }}>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>AI Resume Audit Results</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Profile Domain: <strong>{domain}</strong></p>
            </div>
            <button 
              type="button" 
              className="ghost" 
              onClick={handleReset} 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
              <span>Review New Resume</span>
            </button>
          </GlassCard>

          <div className="review-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            
            <GlassCard className="review-card" style={{ gridColumn: 'span 2' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '12px' }}>Executive Summary</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-muted)' }}>{review.summary}</p>
            </GlassCard>

            <GlassCard className="review-card score" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(108, 99, 255, 0.08)', borderColor: 'rgba(108, 99, 255, 0.25)' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' }}>ATS Match Rating</h4>
              <div className="score-display" style={{ fontSize: '56px', fontWeight: 900, background: 'linear-gradient(135deg, #c4c0ff, var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '4px 0' }}>
                {review.overallScore}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>MATCH SCALE 0-100</span>
            </GlassCard>

            <GlassCard className="review-card">
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#10b981', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '12px' }}>Key Strengths</h4>
              <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {review.strengths?.map((s, idx) => (
                  <li key={idx} style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s}</li>
                ))}
              </ul>
            </GlassCard>

            <GlassCard className="review-card">
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#ffb785', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '12px' }}>Identified Gaps</h4>
              <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {review.improvements?.map((s, idx) => (
                  <li key={idx} style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s}</li>
                ))}
              </ul>
            </GlassCard>

            <GlassCard className="review-card">
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '12px' }}>Recommended Keywords</h4>
              <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {review.keywordsToAdd?.map((s, idx) => (
                  <li key={idx} style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s}</li>
                ))}
              </ul>
            </GlassCard>

          </div>

        </div>
      )}

    </div>
  );
}
