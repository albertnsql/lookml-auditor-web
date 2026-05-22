import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../api';
import { severityBadgeClass } from '../../utils';
import FixPreviewModal from '../modals/FixPreviewModal';
import FileTree from '../common/FileTree';

export default function FileViewerTab({ result, initialFile, initialLine }) {
  const [files, setFiles]           = useState([]);
  const [selPath, setSelPath]       = useState('');
  const [content, setContent]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [search, setSearch]         = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [highlightLine, setHighlightLine] = useState(null);
  const [fixedIssues, setFixedIssues] = useState(new Set());
  const [previewIssue, setPreviewIssue] = useState(null);
  const [recentFixLines, setRecentFixLines] = useState([]);
  const lineRefs = useRef({});
  const codeBlockRef = useRef(null);

  const handleFixConfirm = (iss) => {
    setFixedIssues(prev => new Set(prev).add(iss));
    setPreviewIssue(null);
    
    // Calculate fixed lines to highlight
    const insertedLinesCount = iss.fix_payload?.insert_text ? iss.fix_payload.insert_text.split('\n').length : 0;
    const startLine = iss.fix_payload?.line_number;
    if (startLine && insertedLinesCount > 0) {
      const newFixedLines = Array.from({length: insertedLinesCount}, (_, i) => startLine + i);
      setRecentFixLines(newFixedLines);
      setHighlightLine(startLine);
    }
    
    api.getFileContent(selPath).then(d => {
      setContent(d.content || '');
    });
  };

  // Single files fetch — handles both normal open and navigation from Issues tab.
  // Runs once on mount; initialFile/initialLine are stable (set before tab switch).
  // Handle initial file navigation and prop changes
  useEffect(() => {
    const handleNavigation = (fileList) => {
      if (initialFile && fileList.length) {
        const norm = (p) => (p || '').replace(/\\/g, '/').toLowerCase();
        const target = norm(initialFile);
        
        const matched =
          fileList.find(f => norm(f.path) === target) ||
          fileList.find(f => norm(f.path).endsWith(target.split('/').slice(-2).join('/'))) ||
          fileList.find(f => norm(f.path).endsWith(target.split('/').pop()));

        if (matched) {
          setSelPath(matched.path);
        } else {
          setSelPath(fileList[0].path);
        }
        
        if (initialLine) {
          setHighlightLine(Number(initialLine));
        }
      } else if (fileList.length && !selPath) {
        setSelPath(fileList[0].path);
      }
    };

    if (files.length > 0) {
      handleNavigation(files);
    } else {
      setLoading(true);
      api.getFiles().then(d => {
        const fileList = d.files || [];
        setFiles(fileList);
        handleNavigation(fileList);
      }).catch(() => {})
      .finally(() => setLoading(false));
    }
  }, [initialFile, initialLine]); // Re-run when navigation props change

  // Load file content whenever the selected path changes
  useEffect(() => {
    if (!selPath) return;
    setLoading(true);
    setRecentFixLines([]); // clear fix highlights on file change
    lineRefs.current = {};
    api.getFileContent(selPath).then(d => {
      setContent(d.content || '');
      setLoading(false);
      // Scroll to top when changing file
      if (codeBlockRef.current) {
        codeBlockRef.current.scrollTop = 0;
      }
    }).catch(() => setContent('— could not load file —'))
    .finally(() => setLoading(false));
  }, [selPath]);

  // Scroll to the highlighted line after content renders
  useEffect(() => {
    if (!highlightLine || loading) return;
    const timer = setTimeout(() => {
      const el = lineRefs.current[highlightLine];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (codeBlockRef.current) {
        // Fallback: estimate position when ref not yet mounted
        codeBlockRef.current.scrollTop = Math.max(0, (highlightLine - 8)) * 20;
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [highlightLine, loading, content]);

  const fileIssues = useMemo(() => {
    if (!selPath) return [];
    const norm = p => (p || '').replace(/\\/g, '/').toLowerCase();
    return result.issues.filter(i => norm(i.source_file) === norm(selPath));
  }, [selPath, result.issues]);

  const lmap = useMemo(() => {
    const m = {};
    fileIssues.forEach(i => { const ln = i.line_number || 0; (m[ln] = m[ln] || []).push(i); });
    return m;
  }, [fileIssues]);

  const lines = content.split('\n');
  const ICONS = { error: '🔴', warning: '🟡', info: '🔵' };

  const displayLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hit = new Set();
      lines.forEach((l, i) => {
        if (l.toLowerCase().includes(q)) {
          for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 3); j++) hit.add(j);
        }
      });
      return lines.map((l, i) => ({ ln: i + 1, text: l, show: hit.has(i), hit: q && l.toLowerCase().includes(q) }));
    }
    if (issuesOnly) {
      const issueLines = new Set(Object.keys(lmap).map(Number));
      const ctx = new Set();
      issueLines.forEach(l => { for (let j = Math.max(1, l - 4); j <= l + 5; j++) ctx.add(j); });
      return lines.map((l, i) => ({ ln: i + 1, text: l, show: ctx.has(i + 1) }));
    }
    return lines.map((l, i) => ({ ln: i + 1, text: l, show: true }));
  }, [lines, issuesOnly, search, lmap]);

  const errCnt  = fileIssues.filter(i => i.severity === 'error').length;
  const warnCnt = fileIssues.filter(i => i.severity === 'warning').length;
  const infoCnt = fileIssues.filter(i => i.severity === 'info').length;

  return (
    <div style={{ display: 'flex', gap: '20px', height: '650px', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ── Sidebar: File Tree ── */}
      {isSidebarOpen && <FileTree files={files} selectedPath={selPath} onSelect={(path) => { setSelPath(path); setHighlightLine(null); }} />}

      {/* ── Main Content Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '13px', display: 'flex', alignItems: 'center' }}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title="Toggle Sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>
          <div 
            onClick={() => setIssuesOnly(!issuesOnly)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', 
              background: issuesOnly ? 'rgba(99,91,255,0.1)' : 'var(--surface)', 
              border: issuesOnly ? '1px solid var(--accent)' : '1px solid var(--border)',
              padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              color: issuesOnly ? 'var(--accent)' : 'var(--text-2)', transition: 'all 150ms ease'
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: issuesOnly ? 'var(--accent)' : 'var(--text-3)' }} />
            Issues Only
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input className="form-input" style={{ width: '100%', paddingLeft: '32px' }}
              placeholder="Search in file…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* File stats */}
        <div style={{ display: 'flex', gap: '10px', fontSize: '12px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-3)' }}>Lines: <strong>{lines.length}</strong></span>
          <span style={{ color: 'var(--error)' }}>Errors: <strong>{errCnt}</strong></span>
          <span style={{ color: 'var(--warning)' }}>Warnings: <strong>{warnCnt}</strong></span>
          <span style={{ color: 'var(--info)' }}>Info: <strong>{infoCnt}</strong></span>
          {highlightLine && (
            <span style={{ color: 'var(--accent)', fontWeight: 600, marginLeft: 'auto', fontSize: '12px' }}>
              ↓ Navigated to line {highlightLine}
            </span>
          )}
        </div>

        {/* Issues table for this file */}
        {fileIssues.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div className="section-header" style={{ marginTop: 0 }}>Issues in this file</div>
            <div className="table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Line</th><th>Severity</th><th>Category</th><th>Object</th><th>Message</th><th>Action</th></tr></thead>
                <tbody>
                  {[...fileIssues].sort((a, b) => (a.line_number || 0) - (b.line_number || 0)).map((iss, i) => (
                    <tr
                      key={i}
                      style={{ cursor: iss.line_number ? 'pointer' : 'default' }}
                      title={iss.line_number ? `Click to jump to line ${iss.line_number}` : ''}
                      onClick={() => {
                        if (iss.line_number) {
                          setHighlightLine(Number(iss.line_number));
                          setIssuesOnly(false);
                        }
                      }}
                    >
                      <td 
                        className="mono" 
                        style={{ color: iss.line_number ? 'var(--accent)' : 'var(--text-3)', cursor: iss.line_number ? 'pointer' : 'default', textDecoration: iss.line_number ? 'underline' : 'none' }}
                        onClick={(e) => {
                          if (iss.line_number) {
                            e.stopPropagation();
                            setHighlightLine(Number(iss.line_number));
                            setIssuesOnly(false);
                          }
                        }}
                      >
                        {iss.line_number || '—'}
                      </td>
                      <td><span className={severityBadgeClass(iss.severity)}>{iss.severity}</span></td>
                      <td className="mono">{iss.category}</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{iss.object_name}</td>
                      <td style={{ fontSize: '12px' }}>{iss.message}</td>
                      <td>
                        {iss.fix_payload ? (
                          fixedIssues.has(iss) ? (
                            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>✓ Fixed</span>
                          ) : (
                            <button
                              className="btn btn-primary"
                              style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewIssue(iss);
                              }}
                            >
                              Fix Now
                            </button>
                          )
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {fileIssues.length === 0 && selPath && (
          <div className="alert alert-success" style={{ marginBottom: '12px' }}>✓ No issues found in this file.</div>
        )}

        {/* Source code */}
        <div className="section-header" style={{ marginTop: 0 }}>Source &mdash; <span style={{ color: 'var(--text-2)', textTransform: 'none', fontWeight: 500 }}>{selPath?.split(/[/\\]/).pop()}</span></div>
        {loading ? (
          <div className="loading-overlay" style={{ minHeight: '200px' }}><div className="spinner spinner-lg" /></div>
        ) : (
          <div ref={codeBlockRef} className="code-block" style={{ maxHeight: '560px', overflowY: 'auto' }}>
            {displayLines.filter(l => l.show).map((l, idx, arr) => {
              const prev = idx > 0 ? arr[idx - 1].ln : null;
              const skip = prev !== null && l.ln > prev + 1;
              const isTarget = l.ln === highlightLine;
              return (
                <span key={l.ln} ref={el => { if (el) lineRefs.current[l.ln] = el; }}>
                  {skip && (
                    <span className="code-line" style={{ color: '#4A5568', fontStyle: 'italic' }}>
                      {'  '}··· {l.ln - (prev || 0) - 1} lines skipped ···
                    </span>
                  )}
                  <span
                    className={`code-line${lmap[l.ln] ? ' issue-line' : ''}`}
                    style={{
                      ...(l.hit ? { background: 'var(--indigo-glow)', borderLeft: '3px solid var(--indigo)', paddingLeft: '8px' } : {}),
                      ...(isTarget ? { background: 'rgba(99,91,255,0.15)', borderLeft: '3px solid #635BFF', paddingLeft: '8px', animation: 'highlightPulse 2s ease-out' } : {}),
                      ...(recentFixLines.includes(l.ln) ? { background: 'rgba(46, 160, 67, 0.15)', borderLeft: '3px solid #3fb950', paddingLeft: '8px' } : {}),
                    }}
                  >
                    <span className="code-linenum">{l.ln}</span>
                    {l.text}
                  </span>
                  {(lmap[l.ln] || []).map((iss, j) => (
                    <span key={j} className="code-line code-line issue-ann">
                      {'        '}# {ICONS[iss.severity] || '●'} [{iss.severity.toUpperCase()}] {iss.message}
                    </span>
                  ))}
                </span>
              );
            })}
          </div>
        )}
      </div>
      
      {previewIssue && (
        <FixPreviewModal 
          issue={previewIssue} 
          onClose={() => setPreviewIssue(null)} 
          onConfirm={() => handleFixConfirm(previewIssue)} 
        />
      )}
    </div>
  );
}
