import { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { severityBadgeClass, relFileName } from '../../utils';

export default function FileViewerTab({ result }) {
  const [files, setFiles]       = useState([]);
  const [selPath, setSelPath]   = useState('');
  const [content, setContent]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    api.getFiles().then(d => {
      setFiles(d.files || []);
      if (d.files?.length) setSelPath(d.files[0].path);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selPath) return;
    setLoading(true);
    api.getFileContent(selPath).then(d => {
      setContent(d.content || '');
    }).catch(() => setContent('— could not load file —'))
    .finally(() => setLoading(false));
  }, [selPath]);

  const fileIssues = useMemo(() => {
    if (!selPath) return [];
    const norm = p => (p||'').replace(/\\/g,'/').toLowerCase();
    const selNorm = norm(selPath);
    return result.issues.filter(i => norm(i.source_file) === selNorm);
  }, [selPath, result.issues]);

  const lmap = useMemo(() => {
    const m = {};
    fileIssues.forEach(i => { const ln = i.line_number||0; (m[ln]=m[ln]||[]).push(i); });
    return m;
  }, [fileIssues]);

  const lines = content.split('\n');
  const ICONS = { error:'🔴', warning:'🟡', info:'🔵' };

  const displayLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      const matched = new Set();
      lines.forEach((l,i) => { if (l.toLowerCase().includes(q)) { for(let j=Math.max(0,i-2);j<=Math.min(lines.length-1,i+3);j++) matched.add(j); } });
      return lines.map((l,i) => ({ ln:i+1, text:l, show: matched.has(i), hit: q&&l.toLowerCase().includes(q) }));
    }
    if (issuesOnly) {
      const issueLines = new Set(Object.keys(lmap).map(Number));
      const ctx = new Set();
      issueLines.forEach(l => { for(let j=Math.max(1,l-4);j<=l+5;j++) ctx.add(j); });
      return lines.map((l,i) => ({ ln:i+1, text:l, show: ctx.has(i+1) }));
    }
    return lines.map((l,i) => ({ ln:i+1, text:l, show:true }));
  }, [lines, issuesOnly, search, lmap]);

  const errCnt  = fileIssues.filter(i=>i.severity==='error').length;
  const warnCnt = fileIssues.filter(i=>i.severity==='warning').length;
  const infoCnt = fileIssues.filter(i=>i.severity==='info').length;

  return (
    <div>
      <div style={{display:'flex',gap:'10px',marginBottom:'14px',alignItems:'center',flexWrap:'wrap'}}>
        <select className="form-select" style={{flex:2,minWidth:'200px'}} value={selPath} onChange={e=>setSelPath(e.target.value)}>
          {files.map(f => <option key={f.path} value={f.path}>{f.relative}</option>)}
        </select>
        <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',cursor:'pointer',whiteSpace:'nowrap'}}>
          <input type="checkbox" checked={issuesOnly} onChange={e=>setIssuesOnly(e.target.checked)} />
          Issues only
        </label>
        <input className="form-input" style={{flex:1,minWidth:'160px'}}
          placeholder="🔍 Search in file…" value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      {/* File stats */}
      <div style={{display:'flex',gap:'10px',marginBottom:'12px',fontSize:'12px'}}>
        <span style={{color:'var(--text-3)'}}>Lines: <strong>{lines.length}</strong></span>
        <span style={{color:'var(--error)'}}>Errors: <strong>{errCnt}</strong></span>
        <span style={{color:'var(--warning)'}}>Warnings: <strong>{warnCnt}</strong></span>
        <span style={{color:'var(--info)'}}>Info: <strong>{infoCnt}</strong></span>
      </div>

      {/* Issues table for this file */}
      {fileIssues.length > 0 && (
        <div style={{marginBottom:'14px'}}>
          <div className="section-header" style={{marginTop:0}}>Issues in this file</div>
          <div className="table-wrap" style={{maxHeight:'180px',overflowY:'auto'}}>
            <table className="data-table">
              <thead><tr><th>Line</th><th>Severity</th><th>Category</th><th>Object</th><th>Message</th></tr></thead>
              <tbody>
                {fileIssues.sort((a,b)=>(a.line_number||0)-(b.line_number||0)).map((iss,i)=>(
                  <tr key={i}>
                    <td className="mono" style={{color:'var(--text-3)'}}>{iss.line_number||'—'}</td>
                    <td><span className={severityBadgeClass(iss.severity)}>{iss.severity}</span></td>
                    <td className="mono">{iss.category}</td>
                    <td className="mono" style={{fontWeight:600}}>{iss.object_name}</td>
                    <td style={{fontSize:'12px'}}>{iss.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {fileIssues.length === 0 && selPath && (
        <div className="alert alert-success" style={{marginBottom:'12px'}}>✓ No issues found in this file.</div>
      )}

      {/* Source code */}
      <div className="section-header" style={{marginTop:0}}>Source</div>
      {loading ? (
        <div className="loading-overlay" style={{minHeight:'200px'}}><div className="spinner spinner-lg"/></div>
      ) : (
        <div className="code-block" style={{maxHeight:'560px',overflowY:'auto'}}>
          {displayLines.filter(l=>l.show).map((l, idx, arr) => {
            const prev = idx > 0 ? arr[idx-1].ln : null;
            const skip = prev !== null && l.ln > prev+1;
            return (
              <span key={l.ln}>
                {skip && <span className="code-line" style={{color:'#4A5568',fontStyle:'italic'}}>  ··· {l.ln - (prev||0) - 1} lines skipped ···</span>}
                <span className={`code-line${lmap[l.ln]?'issue-line':''}`} style={l.hit?{background:'var(--indigo-glow)',borderLeft:'3px solid var(--indigo)',paddingLeft:'8px'}:{}}>
                  <span className="code-linenum">{l.ln}</span>
                  {l.text}
                </span>
                {(lmap[l.ln]||[]).map((iss,j)=>(
                  <span key={j} className="code-line code-line issue-ann">
                    {' '.repeat(8)}# {ICONS[iss.severity]||'●'} [{iss.severity.toUpperCase()}] {iss.message}
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
