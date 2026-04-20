import React, { useState, useRef } from 'react';
import { api } from '../api';

export default function LandingPage({ onAuditDone, useAuditProps }) {
  const { runGithub, runUpload, runLocal, loading } = useAuditProps;
  const [mode, setMode]       = useState('github');
  const [ghUrl, setGhUrl]     = useState('https://github.com/albertnsql/lookml-auditor');
  const [ghSub, setGhSub]     = useState('mock_project');
  const [localPath, setLocalPath] = useState('C:\\Users\\AlbertNadar\\Desktop\\Project1\\looker_repo_auditor\\lookml-auditor\\mock_project');
  const [zipFile, setZipFile] = useState(null);
  const [error, setError]     = useState(null);

  const [auditProgress, setAuditProgress] = useState({
    isRunning: false,
    stage: '',      // current stage label
    percent: 0,     // 0-100
    filesScanned: 0,
    totalFiles: 0,
    timeElapsed: 0  // seconds
  });

  const progressTimer = useRef(null);

  const simulateProgress = (estimatedSeconds = 15) => {
    const stages = [
      { at: 0,   percent: 5,  stage: 'Scanning repository...' },
      { at: 0.1, percent: 20, stage: 'Discovering LookML files...' },
      { at: 0.3, percent: 45, stage: 'Parsing views and explores...' },
      { at: 0.55, percent: 68, stage: 'Running audit checks...' },
      { at: 0.75, percent: 82, stage: 'Detecting issues...' },
      { at: 0.88, percent: 92, stage: 'Computing health score...' },
      { at: 0.95, percent: 97, stage: 'Finalizing results...' },
    ];

    const startTime = Date.now();
    progressTimer.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / estimatedSeconds, 0.95);
      const currentStage = [...stages].reverse().find(s => progress >= s.at);
      setAuditProgress(p => ({
        ...p,
        percent: currentStage.percent,
        stage: currentStage.stage,
        timeElapsed: Math.floor(elapsed)
      }));
    }, 500);
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

  return (
    <div style={{ background: '#f6f9fc', minHeight: '100vh', overflowX: 'hidden' }}>
      
      {/* Hero Section */}
      <div className="stripe-landing-shell" style={{ minHeight: '90vh' }}>
        <div className="stripe-bg-slanted"></div>

        <div className="stripe-landing-container">
          <div className="stripe-hero-content">
            <div className="stripe-pill">
              <span className="stripe-pill-badge">New</span>
              <span>Static analysis for Looker</span>
            </div>
            
            <h1 className="stripe-hero-title">
              Code infrastructure for your analytics.
            </h1>
            
            <p className="stripe-hero-subtitle">
              LookML Auditor instantly analyzes your entire Looker project. Detect broken references, 
              join integrity issues, and duplicate definitions before they hit production.
            </p>

            <div className="landing-pills" style={{ justifyContent: 'flex-start', marginBottom: '40px' }}>
              {['🔗 Broken References','♊ Duplicates','🔗 Join Integrity','📄 Field Quality', '🗂 Orphan Views', '🐙 GitHub Support'].map(p => (
                <span key={p} className="feature-pill">{p}</span>
              ))}
            </div>

            <div className="privacy-banner" style={{ display: 'inline-flex', background: 'transparent', border: 'none', padding: 0 }}>
              <span>🔒</span>
              <span style={{color:'var(--text-2)'}}><strong>100% Local.</strong> Your LookML never leaves your machine.</span>
            </div>
          </div>

          <div className="stripe-hero-card-wrapper">
            <div className="landing-card">
              <div style={{marginBottom:'24px'}}>
                <h2 style={{fontSize:'18px', fontWeight:700, color:'var(--dark-navy)', marginBottom:'6px'}}>
                  Start your audit
                </h2>
                <p style={{fontSize:'13px', color:'var(--text-2)'}}>
                  Provide your LookML source to begin the static analysis.
                </p>
              </div>

              <div style={{marginBottom:'20px'}}>
                <div className="radio-tabs">
                  <button className={`radio-tab${mode==='github'?' active':''}`} onClick={()=>setMode('github')}>🐙 GitHub URL</button>
                  <button className={`radio-tab${mode==='local'?' active':''}`}  onClick={()=>setMode('local')}>📁 Local Path</button>
                  <button className={`radio-tab${mode==='zip'?' active':''}`}    onClick={()=>setMode('zip')}>🤐 Upload ZIP</button>
                </div>
              </div>

              {mode === 'github' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Repository URL</label>
                    <input className="form-input" value={ghUrl} onChange={e=>setGhUrl(e.target.value)}
                      placeholder="https://github.com/org/repo" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subfolder (optional)</label>
                    <input className="form-input" value={ghSub} onChange={e=>setGhSub(e.target.value)}
                      placeholder="e.g. lookml/" />
                  </div>
                </>
              )}
              {mode === 'local' && (
                <div className="form-group">
                  <label className="form-label">Local Directory Path</label>
                  <input className="form-input" value={localPath} onChange={e=>setLocalPath(e.target.value)}
                    placeholder="C:\path\to\lookml\project" />
                </div>
              )}
              {mode === 'zip' && (
                <div className="form-group">
                  <label className="form-label">ZIP File</label>
                  <input type="file" accept=".zip" className="form-input" style={{paddingTop:'8px'}}
                    onChange={e=>setZipFile(e.target.files?.[0]||null)} />
                </div>
              )}

              {error && (
                <div className="alert alert-error" style={{marginBottom:'16px'}}>
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

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}} />

      {/* Product Features Section */}
      <div className="stripe-features-section">
        <div style={{textAlign:'center', marginBottom:'64px'}}>
          <h2 style={{fontSize:'36px', fontWeight:800, color:'var(--dark-navy)', letterSpacing:'-1px'}}>
            A complete toolkit for your data platform.
          </h2>
          <p style={{fontSize:'18px', color:'var(--text-2)', marginTop:'16px', maxWidth:'600px', margin:'16px auto 0'}}>
            Stop relying on manual reviews. Automatically catch critical LookML issues before they break downstream dashboards.
          </p>
        </div>

        <div className="features-grid">
          
          {/* Feature 1: Broken References */}
          <div className="feature-block card">
            <div className="feature-viz" style={{background:'linear-gradient(135deg, #fff1f2, #ffe4e6)'}}>
              <div className="mock-code-window">
                <div className="window-header">
                  <span className="dot" style={{background:'#EF4444'}}></span>
                  <span className="dot" style={{background:'#F59E0B'}}></span>
                  <span className="dot" style={{background:'#10B981'}}></span>
                </div>
                <div className="window-body">
                  <code>
                    <span style={{color:'#635bff'}}>explore</span>: users {"{"} <br/>
                    &nbsp;&nbsp;<span style={{color:'#635bff'}}>join</span>: orders {"{"} <br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;<span style={{background:'#fdf2f5', borderBottom:'2px solid #EF4444'}}>sql_on: {"$"}{"{"}users.id{"}"} = <span style={{color:'#EF4444'}}>{"$"}{"{"}orders.usr_id{"}"}</span> ;;</span><br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#EF4444'}}>// Error: 'usr_id' not found in view 'orders'</span><br/>
                    &nbsp;&nbsp;{"}"}<br/>
                    {"}"}
                  </code>
                </div>
              </div>
            </div>
            <div className="feature-text">
              <h3>🔗 Broken References</h3>
              <p>Instantly detect missing views, fields, and invalid parameter references before they break downstream user dashboards.</p>
            </div>
          </div>

          {/* Feature 2: Duplicates */}
          <div className="feature-block card">
            <div className="feature-viz" style={{background:'linear-gradient(135deg, #fffbeb, #fef3c7)'}}>
              <div className="mock-code-window">
                <div className="window-header">
                  <span className="dot" style={{background:'#EF4444'}}></span>
                  <span className="dot" style={{background:'#F59E0B'}}></span>
                  <span className="dot" style={{background:'#10B981'}}></span>
                </div>
                <div className="window-body">
                  <code>
                    <span style={{color:'#635bff'}}>view</span>: customer_base {"{"} <br/>
                    &nbsp;&nbsp;<span style={{color:'#10B981'}}>// defined in base.view.lkml</span><br/>
                    {"}"}<br/><br/>
                    <span style={{color:'#635bff'}}>view</span>: <span style={{background:'#fffcf0', borderBottom:'2px solid #F59E0B'}}>customer_base</span> {"{"} <br/>
                    &nbsp;&nbsp;<span style={{color:'#F59E0B'}}>// Warning: Duplicate view definition</span><br/>
                    {"}"}
                  </code>
                </div>
              </div>
            </div>
            <div className="feature-text">
              <h3>♊ Duplicates</h3>
              <p>Find and eliminate duplicate explore or view definitions that are silently cluttering your project structure.</p>
            </div>
          </div>

          {/* Feature 3: Join Integrity */}
          <div className="feature-block card">
            <div className="feature-viz" style={{background:'linear-gradient(135deg, #eef2ff, #e0e7ff)'}}>
              <div className="mock-code-window">
                <div className="window-header">
                  <span className="dot" style={{background:'#EF4444'}}></span>
                  <span className="dot" style={{background:'#F59E0B'}}></span>
                  <span className="dot" style={{background:'#10B981'}}></span>
                </div>
                <div className="window-body">
                  <code>
                    <span style={{color:'#635bff'}}>explore</span>: order_items {"{"} <br/>
                    &nbsp;&nbsp;<span style={{color:'#635bff'}}>join</span>: users {"{"} <br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;type: left_outer<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;<span style={{background:'#fdf2f5', borderBottom:'2px solid #EF4444'}}>sql_on: {"$"}{"{"}order_items.id{"}"} = {"$"}{"{"}users.id{"}"} ;;</span><br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#EF4444'}}>// Error: potential fanout without many_to_one</span><br/>
                    &nbsp;&nbsp;{"}"}<br/>
                    {"}"}
                  </code>
                </div>
              </div>
            </div>
            <div className="feature-text">
              <h3>🔗 Join Integrity</h3>
              <p>Automatically detect symmetric aggregate issues, missing many-to-one declarations, and cross-join fanouts.</p>
            </div>
          </div>

          {/* Feature 4: Field Quality */}
          <div className="feature-block card">
            <div className="feature-viz" style={{background:'linear-gradient(135deg, #f3f4f6, #e5e7eb)'}}>
              <div className="mock-code-window">
                <div className="window-header">
                  <span className="dot" style={{background:'#EF4444'}}></span>
                  <span className="dot" style={{background:'#F59E0B'}}></span>
                  <span className="dot" style={{background:'#10B981'}}></span>
                </div>
                <div className="window-body">
                  <code>
                    <span style={{color:'#635bff'}}>measure</span>: total_revenue {"{"} <br/>
                    &nbsp;&nbsp;type: sum<br/>
                    &nbsp;&nbsp;sql: <span style={{color:'#10B981'}}>{"$"}{"{"}TABLE{"}"}.revenue</span> ;;<br/>
                    &nbsp;&nbsp;<span style={{background:'#fffcf0', borderBottom:'2px solid #F59E0B'}}><span style={{color:'#F59E0B'}}>// Warning: Missing description</span></span><br/>
                    {"}"}
                  </code>
                </div>
              </div>
            </div>
            <div className="feature-text">
              <h3>📄 Field Quality</h3>
              <p>Ensure all your dimensions and measures have proper descriptions, correct types, and valid SQL definitions.</p>
            </div>
          </div>

          {/* Feature 5: Orphan Views */}
          <div className="feature-block card">
            <div className="feature-viz" style={{background:'linear-gradient(135deg, #f0fdf8, #d1fae5)', display:'flex', alignItems:'center', justifyContent:'center'}}>
               <svg viewBox="0 0 200 120" style={{width:'80%', height:'80%'}}>
                 <circle cx="50" cy="60" r="16" fill="#10B981" />
                 <circle cx="150" cy="30" r="16" fill="#10B981" />
                 <circle cx="150" cy="90" r="16" fill="#10B981" />
                 <path d="M 66 60 L 134 30 M 66 60 L 134 90" stroke="#10B981" strokeWidth="3" strokeDasharray="6,6" opacity="0.5"/>
                 <circle cx="100" cy="110" r="12" fill="#EF4444" opacity="0.8" />
               </svg>
            </div>
            <div className="feature-text">
              <h3>🗂 Orphan Views</h3>
              <p>Map your entire dependency graph to identify unused views and zombie explores that can be safely deleted.</p>
            </div>
          </div>

          {/* Feature 6: GitHub Support */}
          <div className="feature-block card">
            <div className="feature-viz" style={{background:'linear-gradient(135deg, #f8fafc, #f1f5f9)'}}>
              <div className="mock-code-window" style={{background:'#0a2540'}}>
                <div className="window-header" style={{background:'#1a365d', borderBottom:'none'}}>
                  <span className="dot" style={{background:'#EF4444'}}></span>
                  <span className="dot" style={{background:'#F59E0B'}}></span>
                  <span className="dot" style={{background:'#10B981'}}></span>
                </div>
                <div className="window-body" style={{color:'#f8fafc'}}>
                  <code>
                    <span style={{color:'#10B981'}}>&gt;</span> audit https://github.com/org/repo<br/>
                    <br/>
                    <span style={{color:'#8a9cb0'}}>Cloning repository...</span><br/>
                    <span style={{color:'#8a9cb0'}}>Parsing 142 files...</span><br/>
                    <br/>
                    <span style={{color:'#EF4444'}}>Found 3 errors</span> and <span style={{color:'#F59E0B'}}>12 warnings</span>.<br/>
                  </code>
                </div>
              </div>
            </div>
            <div className="feature-text">
              <h3>🐙 GitHub Support</h3>
              <p>Connect directly to your GitHub repository to audit your LookML in seconds without any manual file downloads.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
