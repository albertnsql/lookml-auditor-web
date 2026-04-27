import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';

// --- Icons ---
const IconLink = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const IconCopy = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconGitMerge = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
    <path d="M6 9v6M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const IconFileCheck = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <polyline points="9 15 11 17 15 13" />
  </svg>
);

const IconFolderX = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

const IconGithub = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
);

const IconShield = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const IconFolder = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconUpload = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

export default function LandingPage({ onAuditDone, useAuditProps }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const isProduction = window.location.hostname !== 'localhost';
  const { runGithub, runUpload, runLocal, loading } = useAuditProps;
  const [mode, setMode] = useState('github');
  const [ghUrl, setGhUrl] = useState('https://github.com/albertnsql/lookml-auditor');
  const [ghSub, setGhSub] = useState('mock_project');
  const [localPath, setLocalPath] = useState('C:\\Users\\AlbertNadar\\Desktop\\Project1\\looker_repo_auditor\\lookml-auditor\\mock_project');
  const [zipFile, setZipFile] = useState(null);
  const [error, setError] = useState(null);

  const [auditProgress, setAuditProgress] = useState({
    isRunning: false,
    stage: '',      // current stage label
    percent: 0,     // 0-100
    filesScanned: 0,
    totalFiles: 0,
    timeElapsed: 0  // seconds
  });

  const progressTimer = useRef(null);
  const statViewsRef = useRef(null);
  const statExploresRef = useRef(null);
  const statCategoriesRef = useRef(null);

  const simulateProgress = (estimatedSeconds = 15) => {
    const stages = [
      { at: 0, stage: 'Connecting to repository...' },
      { at: 0.05, stage: 'Cloning repository...' },
      { at: 0.15, stage: 'Discovering LookML files...' },
      { at: 0.25, stage: 'Parsing view files...' },
      { at: 0.38, stage: 'Parsing explore definitions...' },
      { at: 0.50, stage: 'Resolving field references...' },
      { at: 0.62, stage: 'Running audit checks...' },
      { at: 0.72, stage: 'Detecting duplicate definitions...' },
      { at: 0.80, stage: 'Checking join integrity...' },
      { at: 0.87, stage: 'Analyzing field quality...' },
      { at: 0.93, stage: 'Computing health score...' },
      { at: 0.97, stage: 'Finalizing results...' },
    ];

    // Clamp the estimated seconds so very fast previous runs don't cause instant 99%
    // Default to 20 seconds for a more realistic baseline
    const baseSeconds = Math.max(20, Math.min(estimatedSeconds, 60));
    
    // Time constant controls how fast the asymptotic curve grows
    // baseSeconds / 2 means it reaches ~86% at baseSeconds.
    const timeConstant = baseSeconds / 2;

    const startTime = Date.now();
    progressTimer.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      
      // Asymptotic approach to 0.99. Slows down as it approaches 99%.
      let progress = 1 - Math.exp(-elapsed / timeConstant);
      progress = Math.min(progress, 0.99); // Cap at 99%

      const currentStage = [...stages].reverse().find(s => progress >= s.at);
      
      setAuditProgress(p => ({
        ...p,
        percent: Math.floor(progress * 100),
        stage: currentStage?.stage ?? 'Initializing...',
        timeElapsed: Math.floor(elapsed)
      }));
    }, 300);
  };

  async function handleRun() {
    setError(null);
    const lastDuration = parseFloat(localStorage.getItem('lookml_auditor_last_duration') ?? '15');
    const auditStart = Date.now();

    setAuditProgress({ isRunning: true, stage: 'Scanning files...', percent: 5, filesScanned: 0, totalFiles: 0, timeElapsed: 0 });
    simulateProgress(lastDuration);

    try {
      if (mode === 'github') {
        if (!ghUrl.trim()) { setError('Please enter a GitHub repository URL.'); return; }
        await runGithub(ghUrl.trim(), ghSub.trim());
      } else if (mode === 'local') {
        if (!localPath.trim()) { setError('Please enter a local directory path.'); return; }
        if (typeof runLocal !== 'function') {
          setError('Local path mode is not available in the hosted version. Please use GitHub URL or Upload ZIP.');
          return;
        }
        await runLocal(localPath.trim());
      } else {
        if (!zipFile) { setError('Please select a ZIP file.'); return; }
        await runUpload(zipFile);
      }

      const actualDuration = (Date.now() - auditStart) / 1000;
      localStorage.setItem('lookml_auditor_last_duration', actualDuration.toString());

      if (progressTimer.current) clearInterval(progressTimer.current);
      setAuditProgress(p => ({ ...p, percent: 100, stage: 'Complete ✓' }));
      await new Promise(r => setTimeout(r, 400)); // Smoothly fill bar
      setAuditProgress(p => ({ ...p, isRunning: false }));
    } catch (e) {
      setError(e.message || 'An unexpected error occurred.');
      if (progressTimer.current) clearInterval(progressTimer.current);
      setAuditProgress(p => ({ ...p, isRunning: false, stage: 'Failed' }));
    }
  }

  React.useEffect(() => {
    if (isProduction && mode === 'local') setMode('github');
  }, [isProduction, mode]);

  React.useEffect(() => {
    const stripItems = document.querySelectorAll('.strip-step');
    stripItems.forEach((el, idx) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = `all 0.5s ease-out ${idx * 0.15}s`;
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    const header = document.getElementById('features-header');
    if (header) observer.observe(header);

    const cards = document.querySelectorAll('.feature-card-premium');
    cards.forEach(card => observer.observe(card));

    stripItems.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const blob1 = document.getElementById('blob-1');
      const blob2 = document.getElementById('blob-2');
      if (blob1) blob1.style.transform = `translateY(${scrollY * 0.15}px)`;
      if (blob2) blob2.style.transform = `translateY(${scrollY * -0.1}px)`;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    const animate = (el, end, suffix, duration = 1600) => {
      if (!el) return;
      const startTime = performance.now();
      const update = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * end).toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(update);
      };
      requestAnimationFrame(update);
    };

    const timer = setTimeout(() => {
      animate(statViewsRef.current, 1037, '+');
      animate(statExploresRef.current, 710, '+');
      animate(statCategoriesRef.current, 4, '');
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ background: '#f6f9fc', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* Top Nav */}
      <nav style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '24px 80px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#635BFF', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '16px Sora', fontWeight: 700 }}>L</div>
          <span style={{ font: '18px Sora', fontWeight: 700, color: '#1E1B4B' }}>LookML Auditor</span>
        </div>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <a href="/how-it-works" style={{ font: '14px Sora', fontWeight: 600, color: '#1E1B4B', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#635BFF'} onMouseLeave={e => e.target.style.color = '#1E1B4B'}>How it works</a>
          <a href="/rules" style={{ font: '14px Sora', fontWeight: 600, color: '#1E1B4B', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#635BFF'} onMouseLeave={e => e.target.style.color = '#1E1B4B'}>Rules</a>
          <a href="https://github.com/albertnsql/lookml-auditor-web" target="_blank" rel="noreferrer" style={{ font: '14px Sora', fontWeight: 600, color: '#1E1B4B', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#635BFF'} onMouseLeave={e => e.target.style.color = '#1E1B4B'}>GitHub</a>
        </div>

      </nav>

      {/* Hero Section */}
      <div className="stripe-landing-shell" style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'stretch',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div className="stripe-bg-slanted"></div>

        {/* Animated Background Blobs — outside max-width wrapper for full bleed */}
        <div id="blob-1" style={{ position: 'absolute', top: '-100px', right: '-150px', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(99,91,255,0.12) 0%, transparent 70%)', borderRadius: '50%', animation: 'float 8s ease-in-out infinite', pointerEvents: 'none', zIndex: 0 }} />
        <div id="blob-2" style={{ position: 'absolute', bottom: '-80px', left: '-120px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', borderRadius: '50%', animation: 'float 10s ease-in-out 2s infinite', pointerEvents: 'none', zIndex: 0 }} />

        {/* Floating cards wrapper */}
        <div style={{
          position: 'absolute',
          top: 0, right: 0,
          width: '260px',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 2,
        }}>
          {/* Code card — top zone */}
          <div className="hero-float-card-1" style={{
            position: 'absolute',
            top: '10%',
            right: '24px',
            width: '210px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(99,91,255,0.15)',
            borderRadius: '12px',
            padding: '14px 16px',
            boxShadow: '0 8px 32px rgba(99,91,255,0.1)',
            animation: 'floatCard1 6s ease-in-out infinite',
          }}>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
              {['#EF4444', '#F59E0B', '#22C55E'].map(c => (
                <div key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
              ))}
            </div>
            <div style={{ fontFamily: '"Fira Code", monospace', fontSize: '10px', lineHeight: '1.8', color: '#374151' }}>
              <span style={{ color: '#6366F1' }}>view</span>: orders {"{"}<br />
              &nbsp;&nbsp;<span style={{ color: '#6366F1' }}>dimension</span>: id {"{"}<br />
              &nbsp;&nbsp;&nbsp;&nbsp;primary_key: <span style={{ color: '#09A55A' }}>yes</span><br />
              &nbsp;&nbsp;{"}"}<br />
              {"}"}
            </div>
          </div>

          {/* Error badge — middle zone */}
          <div className="hero-float-card-3" style={{
            position: 'absolute',
            top: '45%',
            right: '24px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 4px 16px rgba(239,68,68,0.1)',
            animation: 'floatCard3 5s ease-in-out 2s infinite',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#EF4444',
              animation: 'pulse 1.5s ease-in-out infinite'
            }} />
            <span style={{ font: '12px Sora', fontWeight: 600, color: '#1E1B4B', whiteSpace: 'nowrap' }}>
              3 errors found
            </span>
          </div>

          {/* Health score card — bottom zone */}
          <div className="hero-float-card-2" style={{
            position: 'absolute',
            bottom: '12%',
            right: '24px',
            width: '175px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(9,165,90,0.2)',
            borderRadius: '12px',
            padding: '14px 16px',
            boxShadow: '0 8px 32px rgba(9,165,90,0.12)',
            animation: 'floatCard2 7s ease-in-out 1s infinite',
          }}>
            <div style={{ font: '10px Sora', fontWeight: 600, color: '#6B7280', letterSpacing: '0.08em', marginBottom: '8px' }}>
              HEALTH SCORE
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '10px' }}>
              <span style={{ font: '28px Sora', fontWeight: 800, color: '#09A55A' }}>96</span>
              <span style={{ font: '12px Inter', color: '#9CA3AF' }}>/100</span>
            </div>
            <div style={{ height: '4px', background: '#E2DFF5', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: '96%',
                background: 'linear-gradient(90deg, #09A55A, #34D399)',
                borderRadius: '2px',
                animation: 'growBar 2s ease-out 1.5s both'
              }} />
            </div>
            <div style={{ font: '10px Sora', color: '#09A55A', fontWeight: 600, marginTop: '6px' }}>
              ✓ Healthy
            </div>
          </div>
        </div>

        {/* Wrap container in a flex-grow div for vertical centering */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          padding: '80px 0',
          position: 'relative',
          zIndex: 1
        }}>

          <div className="stripe-landing-container" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '1100px', display: 'flex', alignItems: 'center' }}>
            <div className="stripe-hero-content" style={{ flex: 1 }}>
              <div className="stripe-pill" style={{ animation: 'fadeInUp 0.6s ease-out both' }}>
                <span className="stripe-pill-badge">New</span>
                <span>Static analysis for Looker</span>
              </div>

              <h1 className="stripe-hero-title" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {"Code infrastructure for your analytics.".split(' ').map((word, idx) => (
                  <span key={idx} style={{
                    display: 'inline-block',
                    opacity: 0,
                    animation: `fadeInUp 0.5s ease-out ${0.2 + idx * 0.08}s forwards`
                  }}>
                    {word}
                  </span>
                ))}
              </h1>

              <p className="stripe-hero-subtitle" style={{ opacity: 0, animation: 'fadeInUp 0.6s ease-out 0.8s forwards' }}>
                LookML Auditor instantly analyzes your entire Looker project. Detect broken references,
                join integrity issues, and duplicate definitions before they hit production.
              </p>

              {/* Stats Bar */}
              <div style={{
                display: 'flex', flexDirection: 'row',
                gap: '40px', marginTop: '32px',
                opacity: 0, animation: 'fadeInUp 0.6s ease-out 1s forwards'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div ref={statViewsRef} style={{ font: '28px Sora', fontWeight: 800, color: '#1E1B4B', lineHeight: 1 }}>0+</div>
                  <div style={{ font: '12px Inter', color: '#6B7280' }}>Views analyzed</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div ref={statExploresRef} style={{ font: '28px Sora', fontWeight: 800, color: '#1E1B4B', lineHeight: 1 }}>0+</div>
                  <div style={{ font: '12px Inter', color: '#6B7280' }}>Explores mapped</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div ref={statCategoriesRef} style={{ font: '28px Sora', fontWeight: 800, color: '#1E1B4B', lineHeight: 1 }}>0</div>
                  <div style={{ font: '12px Inter', color: '#6B7280' }}>Issue categories</div>
                </div>
              </div>

              <div className="landing-pills" style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: '8px',
                justifyContent: 'flex-start',
                alignItems: 'center',
                marginBottom: '40px',
                marginTop: '40px',
                opacity: 0,
                animation: 'fadeInUp 0.6s ease-out 1.2s forwards'
              }}>
                {[
                  { icon: IconLink, label: 'Broken References' },
                  { icon: IconCopy, label: 'Duplicates' },
                  { icon: IconGitMerge, label: 'Join Integrity' },
                  { icon: IconFileCheck, label: 'Field Quality' },
                  { icon: IconFolderX, label: 'Orphan Views' },
                  { icon: IconGithub, label: 'GitHub Support' }
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="feature-pill">
                    <Icon size={14} /> {label}
                  </span>
                ))}
              </div>

              <div className="privacy-banner" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', padding: 0, opacity: 0, animation: 'fadeInUp 0.6s ease-out 1.4s forwards' }}>
                <IconShield size={16} />
                <span style={{ color: 'var(--text-2)' }}><strong>100% Local.</strong> Your LookML never leaves your machine.</span>
              </div>
            </div>

            <div className="stripe-hero-card-wrapper" style={{ opacity: 0, animation: 'fadeInUp 0.8s ease-out 0.4s forwards' }}>
              <div className="landing-card" style={{
                boxShadow: '0 20px 60px rgba(99,91,255,0.15), 0 4px 16px rgba(0,0,0,0.08)',
                borderTop: '3px solid #635BFF',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--dark-navy)', marginBottom: '6px' }}>
                    Start your audit
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                    Provide your LookML source to begin the static analysis.
                  </p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <div className="radio-tabs">
                    <button className={`radio-tab${mode === 'github' ? ' active' : ''}`} onClick={() => setMode('github')} style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                      <IconGithub size={16} /> GitHub URL
                    </button>
                    {!isProduction && (
                      <button className={`radio-tab${mode === 'local' ? ' active' : ''}`} onClick={() => setMode('local')} style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                        <IconFolder size={16} /> Local Path
                      </button>
                    )}
                    <button className={`radio-tab${mode === 'zip' ? ' active' : ''}`} onClick={() => setMode('zip')} style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                      <IconUpload size={16} /> Upload ZIP
                    </button>
                  </div>
                </div>

                {mode === 'github' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Repository URL</label>
                      <input className="form-input" value={ghUrl} onChange={e => setGhUrl(e.target.value)}
                        placeholder="https://github.com/org/repo" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Subfolder (optional)</label>
                      <input className="form-input" value={ghSub} onChange={e => setGhSub(e.target.value)}
                        placeholder="e.g. lookml/" />
                    </div>
                  </>
                )}
                {mode === 'local' && (
                  <div className="form-group">
                    <label className="form-label">Local Directory Path</label>
                    <input className="form-input" value={localPath} onChange={e => setLocalPath(e.target.value)}
                      placeholder="C:\path\to\lookml\project" />
                  </div>
                )}
                {mode === 'zip' && (
                  <div className="form-group">
                    <label className="form-label">ZIP File</label>
                    <input type="file" accept=".zip" className="form-input" style={{ paddingTop: '8px' }}
                      onChange={e => setZipFile(e.target.files?.[0] || null)} />
                  </div>
                )}

                {error && (
                  <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                    <span className="alert-body">{error}</span>
                  </div>
                )}

                {auditProgress.isRunning ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>

                    {/* Stage label + elapsed time */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ font: '13px Sora', fontWeight: 600, color: '#1E1B4B' }}>
                        {auditProgress.stage}
                      </span>
                      <span style={{ font: '12px Inter', color: '#6B7280' }}>
                        {auditProgress.timeElapsed}s elapsed
                      </span>
                    </div>

                    {/* Progress bar track */}
                    <div style={{
                      width: '100%', height: '8px',
                      background: '#E2DFF5', borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      {/* Animated fill */}
                      <div style={{
                        height: '100%',
                        width: `${auditProgress.percent}%`,
                        background: 'linear-gradient(90deg, #635BFF, #818CF8)',
                        borderRadius: '4px',
                        transition: 'width 500ms ease-out',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        {/* Shimmer effect */}
                        <div style={{
                          position: 'absolute', top: 0, left: 0,
                          width: '100%', height: '100%',
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                          animation: 'shimmer 1.5s infinite'
                        }} />
                      </div>
                    </div>

                    {/* Percent + file count */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ font: '12px Inter', color: '#6B7280' }}>
                        {auditProgress.filesScanned > 0 && auditProgress.totalFiles > 0
                          ? `${auditProgress.filesScanned} / ${auditProgress.totalFiles} files`
                          : 'Analyzing...'}
                      </span>
                      <span style={{ font: '12px Sora', fontWeight: 700, color: '#635BFF' }}>
                        {auditProgress.percent}%
                      </span>
                    </div>

                    {/* Pulsing dots */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', paddingTop: '4px' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{
                          width: '6px', height: '6px',
                          borderRadius: '50%',
                          background: '#635BFF',
                          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`
                        }} />
                      ))}
                    </div>

                  </div>
                ) : (
                  <button
                    onClick={handleRun}
                    className="btn btn-primary btn-full"
                    disabled={loading}
                    style={{
                      width: '100%', padding: '14px',
                      background: '#635BFF', color: 'white',
                      border: 'none', borderRadius: '8px',
                      font: '15px Sora', fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(99,91,255,0.35)',
                      transition: 'all 150ms ease',
                      marginTop: '8px'
                    }}
                  >
                    Start Analysis →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10,
          opacity: 0,
          animation: 'fadeInUp 0.6s ease-out 2s forwards',
          cursor: 'pointer'
        }}
          onClick={() => {
            document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          {/* Label */}
          <span style={{
            font: '11px Sora',
            fontWeight: 600,
            color: '#9CA3AF',
            letterSpacing: '0.1em',
            textTransform: 'uppercase'
          }}>
            Scroll to explore
          </span>

          {/* Animated mouse */}
          <div style={{
            width: '24px',
            height: '38px',
            border: '2px solid rgba(99,91,255,0.35)',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'center',
            paddingTop: '6px',
            background: 'rgba(255,255,255,0.5)',
            backdropFilter: 'blur(8px)'
          }}>
            <div style={{
              width: '3px',
              height: '8px',
              background: '#635BFF',
              borderRadius: '2px',
              animation: 'scrollDot 1.8s ease-in-out infinite'
            }} />
          </div>

          {/* Chevron below mouse */}
          <svg
            width="16" height="10"
            viewBox="0 0 16 10"
            fill="none"
            style={{ animation: 'chevronBounce 1.8s ease-in-out infinite' }}
          >
            <path d="M1 1L8 8L15 1" stroke="rgba(99,91,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* 3-Step Process Strip */}
      <div id="how-it-works" style={{
        background: '#F8F7FF',
        borderTop: '1px solid #E2DFF5',
        borderBottom: '1px solid #E2DFF5',
        padding: '48px 80px',
        position: 'relative',
        overflow: 'hidden',
        zIndex: 2,
      }}>
        {/* Background accent circle */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(99,91,255,0.05) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none'
        }} />

        {/* Section label */}
        <div style={{
          textAlign: 'center', marginBottom: '32px',
          font: '11px Sora', fontWeight: 700,
          color: '#635BFF', letterSpacing: '0.12em',
          textTransform: 'uppercase'
        }}>
          How it works
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'center', gap: '0',
          maxWidth: '900px', margin: '0 auto',
          position: 'relative'
        }}>

          {/* Connecting line behind steps */}
          <div style={{
            position: 'absolute', top: '28px', left: '15%', right: '15%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, #635BFF40, #635BFF40, transparent)',
            zIndex: 0
          }} />

          {[
            {
              step: '01',
              title: 'Point to your repo',
              desc: 'GitHub URL, local path, or ZIP upload',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
              ),
              color: '#6366F1'
            },
            {
              step: '02',
              title: 'Instant analysis',
              desc: 'Parser scans every .lkml file in seconds',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              ),
              color: '#8B5CF6'
            },
            {
              step: '03',
              title: 'Fix with confidence',
              desc: 'Actionable issues with file + line numbers',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              ),
              color: '#09A55A'
            },
          ].map(({ step, title, desc, icon, color }, idx) => (
            <React.Fragment key={step}>
              <div className="strip-step" style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', textAlign: 'center',
                padding: '0 32px', position: 'relative', zIndex: 1
              }}>
                {/* Icon circle */}
                <div style={{
                  width: '56px', height: '56px', borderRadius: '16px',
                  background: '#FFFFFF',
                  border: `1.5px solid ${color}30`,
                  boxShadow: `0 4px 20px ${color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: color, marginBottom: '20px',
                  transition: 'all 0.3s ease'
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = `0 12px 32px ${color}30`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = `0 4px 20px ${color}18`;
                  }}
                >
                  {icon}
                </div>

                {/* Step number */}
                <div style={{
                  font: '10px Sora', fontWeight: 700,
                  color: color, letterSpacing: '0.1em',
                  marginBottom: '8px', opacity: 0.7
                }}>
                  STEP {step}
                </div>

                {/* Title */}
                <div style={{
                  font: '16px Sora', fontWeight: 700,
                  color: '#1E1B4B', marginBottom: '8px', lineHeight: '1.3'
                }}>
                  {title}
                </div>

                {/* Desc */}
                <div style={{
                  font: '13px Inter', color: '#6B7280',
                  lineHeight: '1.5', maxWidth: '180px'
                }}>
                  {desc}
                </div>
              </div>

              {/* Arrow connector */}
              {idx < 2 && (
                <div style={{
                  flexShrink: 0, paddingTop: '16px',
                  color: '#C4BFEE', fontSize: '18px', fontWeight: 300
                }}>
                  →
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes scrollDot {
          0%   { transform: translateY(0);   opacity: 1; }
          50%  { transform: translateY(8px); opacity: 0.3; }
          100% { transform: translateY(0);   opacity: 1; }
        }

        @keyframes chevronBounce {
          0%, 100% { transform: translateY(0);   opacity: 0.5; }
          50%       { transform: translateY(4px); opacity: 1;   }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-20px) scale(1.02); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatCard1 {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-12px) rotate(0deg); }
        }
        @keyframes floatCard2 {
          0%, 100% { transform: translateY(0px) rotate(1deg); }
          50% { transform: translateY(-10px) rotate(0deg); }
        }
        @keyframes floatCard3 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes growBar {
          from { width: 0%; }
          to { width: 96%; }
        }
        .btn-primary:hover {
          box-shadow: 0 4px 20px rgba(99,91,255,0.4) !important;
          transform: translateY(-1px);
        }
        .radio-tabs {
          display: flex;
          flex-wrap: nowrap;
          gap: 4px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 4px;
        }
        .feature-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(99,91,255,0.08);
          border: 1px solid rgba(99,91,255,0.15);
          border-radius: 20px;
          padding: 5px 12px;
          font: 12px Sora;
          font-weight: 500;
          color: #1E1B4B;
          white-space: nowrap;
        }
        .stripe-landing-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 80px;
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 48px;
          box-sizing: border-box;
        }
        .stripe-hero-content {
          flex: 1;
          max-width: 780px;
        }
        .stripe-hero-title {
          font-size: clamp(38px, 4vw, 56px);
          line-height: 1.08;
          letter-spacing: -1.5px;
        }
        .stripe-hero-subtitle {
          max-width: none;
          font-size: clamp(14px, 1.3vw, 16px);
        }
        .stripe-hero-card-wrapper {
          width: 440px;
          flex-shrink: 0;
        }
        @media (min-width: 1400px) {
          .hero-float-card-1,
          .hero-float-card-2,
          .hero-float-card-3 {
            display: flex !important;
          }
        }
        @media (max-width: 1399px) {
          .hero-float-card-1,
          .hero-float-card-2,
          .hero-float-card-3 {
            display: none !important;
          }
        }
        @media (max-width: 900px) {
          .stripe-hero-card-wrapper {
            width: 100%;
          }
          .stripe-landing-container {
            flex-direction: column;
            padding: 40px 24px;
          }
        }
      `}} />

      {/* Product Features Section */}
      <div className="stripe-features-section" style={{
        background: '#F8F7FF',
        borderTop: '1px solid #E2DFF5',
        padding: '100px 0',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ textAlign: 'center', marginBottom: '84px', opacity: 0, transform: 'translateY(30px)', transition: 'all 0.8s ease-out' }} id="features-header">
          <h2 style={{ fontSize: '42px', fontWeight: 800, color: '#1E1B4B', letterSpacing: '-1.5px', marginBottom: '20px' }}>
            A complete toolkit for your data platform.
          </h2>
          <p style={{ fontSize: '18px', color: '#6B7280', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
            Stop relying on manual reviews. Automatically catch critical LookML issues before they break downstream dashboards.
          </p>
        </div>

        <div className="features-grid">

          {[
            {
              title: "Broken References",
              icon: IconLink,
              desc: "Instantly detect missing views, fields, and invalid parameter references before they break downstream user dashboards.",
              code: (
                <React.Fragment>
                  <span style={{ color: '#6366F1' }}>explore</span>: users {"{"} <br />
                  &nbsp;&nbsp;<span style={{ color: '#6366F1' }}>join</span>: orders {"{"} <br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ background: '#fdf2f5', borderBottom: '2px solid #EF4444' }}>sql_on: {"$"}{"{"}users.id{"}"} = <span style={{ color: '#EF4444' }}>{"$"}{"{"}orders.usr_id{"}"}</span> ;;</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#EF4444' }}>// Error: 'usr_id' not found in view 'orders'</span><br />
                  &nbsp;&nbsp;{"}"}<br />
                  {"}"}
                </React.Fragment>
              ),
              bg: 'linear-gradient(135deg, #fff1f2, #ffe4e6)'
            },
            {
              title: "Duplicates",
              icon: IconCopy,
              desc: "Find and eliminate duplicate explore or view definitions that are silently cluttering your project structure.",
              code: (
                <React.Fragment>
                  <span style={{ color: '#6366F1' }}>view</span>: customer_base {"{"} <br />
                  &nbsp;&nbsp;<span style={{ color: '#09A55A' }}>// defined in base.view.lkml</span><br />
                  {"}"}<br /><br />
                  <span style={{ color: '#6366F1' }}>view</span>: <span style={{ background: '#fffcf0', borderBottom: '2px solid #F59E0B' }}>customer_base</span> {"{"} <br />
                  &nbsp;&nbsp;<span style={{ color: '#F59E0B' }}>// Warning: Duplicate view definition</span><br />
                  {"}"}
                </React.Fragment>
              ),
              bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)'
            },
            {
              title: "Join Integrity",
              icon: IconGitMerge,
              desc: "Automatically detect symmetric aggregate issues, missing many-to-one declarations, and cross-join fanouts.",
              code: (
                <React.Fragment>
                  <span style={{ color: '#6366F1' }}>explore</span>: order_items {"{"} <br />
                  &nbsp;&nbsp;<span style={{ color: '#6366F1' }}>join</span>: users {"{"} <br />
                  &nbsp;&nbsp;&nbsp;&nbsp;type: left_outer<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ background: '#fdf2f5', borderBottom: '2px solid #EF4444' }}>sql_on: {"$"}{"{"}order_items.id{"}"} = {"$"}{"{"}users.id{"}"} ;;</span><br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#EF4444' }}>// Error: potential fanout without many_to_one</span><br />
                  &nbsp;&nbsp;{"}"}<br />
                  {"}"}
                </React.Fragment>
              ),
              bg: 'linear-gradient(135deg, #eef2ff, #e0e7ff)'
            },
            {
              title: "Field Quality",
              icon: IconFileCheck,
              desc: "Ensure all your dimensions and measures have proper descriptions, correct types, and valid SQL definitions.",
              code: (
                <React.Fragment>
                  <span style={{ color: '#6366F1' }}>measure</span>: total_revenue {"{"} <br />
                  &nbsp;&nbsp;type: sum<br />
                  &nbsp;&nbsp;sql: <span style={{ color: '#09A55A' }}>{"$"}{"{"}TABLE{"}"}.revenue</span> ;;<br />
                  &nbsp;&nbsp;<span style={{ background: '#fffcf0', borderBottom: '2px solid #F59E0B' }}><span style={{ color: '#F59E0B' }}>// Warning: Missing description</span></span><br />
                  {"}"}
                </React.Fragment>
              ),
              bg: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)'
            },
            {
              title: "Orphan Views",
              icon: IconFolderX,
              desc: "Map your entire dependency graph to identify unused views and zombie explores that can be safely deleted.",
              viz: (
                <svg viewBox="0 0 200 120" style={{ width: '100%', height: '100%' }}>
                  <circle cx="50" cy="60" r="16" fill="#10B981" />
                  <circle cx="150" cy="30" r="16" fill="#10B981" />
                  <circle cx="150" cy="90" r="16" fill="#10B981" />
                  <path d="M 66 60 L 134 30 M 66 60 L 134 90" stroke="#10B981" strokeWidth="3" strokeDasharray="6,6" opacity="0.5" />
                  <circle cx="100" cy="110" r="12" fill="#EF4444" opacity="0.8" />
                </svg>
              ),
              bg: 'linear-gradient(135deg, #f0fdf8, #d1fae5)'
            },
            {
              title: "GitHub Support",
              icon: IconGithub,
              desc: "Connect directly to your GitHub repository to audit your LookML in seconds without any manual file downloads.",
              code: (
                <React.Fragment>
                  <span style={{ color: '#10B981' }}>&gt;</span> audit https://github.com/org/repo<br />
                  <br />
                  <span style={{ color: '#8a9cb0' }}>Cloning repository...</span><br />
                  <span style={{ color: '#8a9cb0' }}>Parsing 142 files...</span><br />
                  <br />
                  <span style={{ color: '#EF4444' }}>Found 3 errors</span> and <span style={{ color: '#F59E0B' }}>12 warnings</span>.<br />
                </React.Fragment>
              ),
              bg: '#0a2540',
              isDark: true
            }
          ].map((feature, i) => (
            <div key={i} className="feature-card-premium" style={{ opacity: 0, transform: 'translateY(30px)', transition: 'all 0.6s ease-out', transitionDelay: `${i * 100}ms` }}>
              <div className="feature-viz-header" style={{ background: feature.bg, height: '180px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }}></div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }}></div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E' }}></div>
                </div>
                <div style={{ padding: '16px 20px', fontFamily: '"Fira Code", monospace', fontSize: '12px', lineHeight: '1.6', color: feature.isDark ? '#f8fafc' : '#1E1B4B' }}>
                  {feature.viz || feature.code}
                </div>
              </div>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <feature.icon size={20} />
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1E1B4B', fontFamily: 'Sora, sans-serif' }}>{feature.title}</h3>
                </div>
                <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.6', fontFamily: 'Inter, sans-serif', marginBottom: '0' }}>
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .feature-card-premium {
          background: #FFFFFF;
          border: 1px solid #E2DFF5;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(99,91,255,0.06);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .feature-card-premium:hover {
          transform: translateY(-6px);
          box-shadow: 0 0 0 2px #635BFF, 0 20px 40px rgba(99,91,255,0.12);
          border-color: transparent;
        }
        .feature-card-premium:hover .arrow-hover {
          transform: translateX(4px);
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 32px;
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
        }
        @media (max-width: 768px) {
          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      `}} />

      {/* CTA Section — add this between the features grid closing div and the footer */}
      <div style={{
        background: 'linear-gradient(135deg, #635BFF 0%, #8B5CF6 100%)',
        padding: '80px 64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '40px',
        flexWrap: 'wrap',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background decoration */}
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px',
          width: '300px', height: '300px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '50%', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: '-40px', left: '30%',
          width: '200px', height: '200px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '50%', pointerEvents: 'none'
        }} />

        {/* Left — text */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '20px',
            padding: '4px 14px',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '6px', height: '6px',
              borderRadius: '50%',
              background: '#4ADE80',
              animation: 'pulse 2s ease-in-out infinite'
            }} />
            <span style={{
              font: '11px Sora', fontWeight: 700,
              color: 'rgba(255,255,255,0.9)',
              letterSpacing: '0.06em'
            }}>
              Ready to audit
            </span>
          </div>
          <h2 style={{
            font: 'clamp(24px, 3vw, 36px) Sora',
            fontWeight: 800, color: 'white',
            letterSpacing: '-0.5px', lineHeight: 1.15,
            marginBottom: '12px', maxWidth: '480px'
          }}>
            Find issues in your LookML before they reach production.
          </h2>
          <p style={{
            font: '15px Inter', color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.6, maxWidth: '420px'
          }}>
            Point to your GitHub repo or upload a ZIP — results in seconds.
          </p>
        </div>

        {/* Right — button */}
        <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              background: 'white',
              color: '#635BFF',
              border: 'none',
              borderRadius: '10px',
              padding: '16px 36px',
              font: '16px Sora',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              transition: 'all 200ms ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.15)';
            }}
          >
            Start your audit
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>

          {/* Trust signal below button */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            marginTop: '12px', justifyContent: 'center'
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <span style={{ font: '12px Inter', color: 'rgba(255,255,255,0.6)' }}>
              100% local · your LookML never leaves your machine
            </span>
          </div>
        </div>
      </div>

      <footer style={{
        background: '#1E1B4B', padding: '32px 80px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '28px', height: '28px', background: '#635BFF',
            borderRadius: '6px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', font: '14px Sora', fontWeight: 700, color: 'white'
          }}>L</div>
          <span style={{ font: '14px Sora', fontWeight: 600, color: 'white' }}>LookML Auditor</span>
        </div>
        <div style={{ font: '12px Inter', color: 'rgba(255,255,255,0.4)' }}>
          Static analysis for Looker · 100% local · Open source
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <a href="/rules" style={{ font: '13px Sora', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Rules Reference</a>
          <a href="https://github.com/albertnsql/lookml-auditor-web"
            style={{ font: '13px Sora', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}
            target="_blank" rel="noreferrer">
            GitHub →
          </a>
        </div>
      </footer>
    </div>
  );
}