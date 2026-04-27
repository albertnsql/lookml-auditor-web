import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../api';
import { severityBadgeClass } from '../../utils';

export default function FileViewerTab({ result, initialFile, initialLine }) {
  const [files, setFiles]           = useState([]);
  const [selPath, setSelPath]       = useState('');
  const [content, setContent]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [search, setSearch]         = useState('');
  const [highlightLine, setHighlightLine] = useState(null);
  const lineRefs = useRef({});
  const codeBlockRef = useRef(null);

  // Single files fetch — handles both normal open and navigation from Issues tab.
  // Runs once on mount; initialFile/initialLine are stable (set before tab switch).
  useEffect(() => {
    api.getFiles().then(d => {
      const fileList = d.files || [];
      setFiles(fileList);

      if (initialFile && fileList.length) {
        const norm = (p) => (p || '').replace(/\\/g, '/').toLowerCase();
        const target = norm(initialFile);
        // Match: exact path → last 2 segments → filename only
        const matched =
          fileList.find(f => norm(f.path) === target) ||
          fileList.find(f => norm(f.path).endsWith(target.split('/').slice(-2).join('/'))) ||
          fileList.find(f => norm(f.path).endsWith(target.split('/').pop()));

        setSelPath(matched ? matched.path : (fileList[0]?.path || ''));
        if (initialLine) setHighlightLine(Number(initialLine));
      } else if (fileList.length) {
        setSelPath(fileList[0].path);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load file content whenever the selected path changes
  useEffect(() => {
    if (!selPath) return;
    setLoading(true);
    lineRefs.current = {};
    api.getFileContent(selPath).then(d => {
      setContent(d.content || '');
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
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-select" style={{ flex: 2, minWidth: '200px' }} value={selPath} onChange={e => setSelPath(e.target.value)}>
          {files.map(f => <option key={f.path} value={f.path}>{f.relative}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={issuesOnly} onChange={e => setIssuesOnly(e.target.checked)} />
          Issues only
        </label>
        <input className="form-input" style={{ flex: 1, minWidth: '160px' }}
          placeholder="🔍 Search in file…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* File stats */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', fontSize: '12px', alignItems: 'center' }}>
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
              <thead><tr><th>Line</th><th>Severity</th><th>Category</th><th>Object</th><th>Message</th></tr></thead>
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
                    <td className="mono" style={{ color: 'var(--text-3)' }}>{iss.line_number || '—'}</td>
                    <td><span className={severityBadgeClass(iss.severity)}>{iss.severity}</span></td>
                    <td className="mono">{iss.category}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{iss.object_name}</td>
                    <td style={{ fontSize: '12px' }}>{iss.message}</td>
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
      <div className="section-header" style={{ marginTop: 0 }}>Source</div>
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
  );
}
