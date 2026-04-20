import { useState } from 'react';
import { api } from '../../api';

export default function SettingsTab({ result, onReset }) {
  const { project, suppressed, category_scores, health_score } = result;
  const [cleaning, setCleaning] = useState(false);
  const [cleaned,  setCleaned]  = useState(false);

  async function handleCleanup() {
    setCleaning(true);
    try { await api.cleanup(); setCleaned(true); } catch(e) {}
    finally { setCleaning(false); }
  }

  const FORMULA = [
    ['Severity weights', [
      'errors   × 8   (max 70)',
      'warnings × 3   (max 15)',
      'info     × 0.1 (max 5)',
    ]],
    ['Category weights', [
      'Broken Reference  35%',
      'Duplicate Def     25%',
      'Join Integrity    25%',
      'Field Quality     15%',
    ]],
    ['Ratio denominators', [
      'Broken Reference : explores + joins',
      'Duplicate Def    : views + fields',
      'Join Integrity   : joins × 2',
      'Field Quality    : fields + views',
    ]],
  ];

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',alignItems:'start'}}>
      {/* Left column */}
      <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>

        {/* Suppression config */}
        <div className="card card-body">
          <div className="section-header" style={{marginTop:0}}>Suppression Rules</div>
          <p style={{fontSize:'12px',color:'var(--text-2)',marginBottom:'12px'}}>
            Create a <code style={{fontFamily:'JetBrains Mono,monospace',fontSize:'11px'}}>lookml_auditor.yaml</code> in your project root to suppress known false positives.
          </p>
          {suppressed > 0 && (
            <div className="alert alert-warning" style={{marginBottom:'12px'}}>
              ⚡ {suppressed} issues suppressed by rules in this run.
            </div>
          )}
          <pre className="code-block" style={{fontSize:'11px',lineHeight:'1.6'}}>
{`suppress:
  - check: duplicate_tables
    object: "customers_pii"
  - check: unused_views
    object: "staging_temp"`}
          </pre>
        </div>

        {/* Manifest constants */}
        <div className="card card-body">
          <div className="section-header" style={{marginTop:0}}>Manifest Constants</div>
          {Object.keys(project.manifest_constants).length === 0 ? (
            <div>
              <div className="alert alert-info" style={{marginBottom:'12px'}}>
                No manifest.lkml found, or no constants defined.
              </div>
              <pre className="code-block" style={{fontSize:'11px'}}>
{`constant: PROD_SCHEMA {
  value: "ANALYTICS_PROD"
  export: override_optional
}`}
              </pre>
            </div>
          ) : (
            <table className="data-table" style={{marginTop:'4px'}}>
              <thead><tr><th>Constant</th><th>Resolved Value</th></tr></thead>
              <tbody>
                {Object.entries(project.manifest_constants).sort().map(([k,v]) => (
                  <tr key={k}>
                    <td className="mono" style={{fontWeight:600}}>{k}</td>
                    <td className="mono">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right column */}
      <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>

        {/* Health score formula */}
        <div className="card card-body">
          <div className="section-header" style={{marginTop:0}}>Health Score Formula (v2)</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr',gap:'12px'}}>
            {FORMULA.map(([title, items]) => (
              <div key={title}>
                <div style={{fontWeight:600,fontSize:'12px',marginBottom:'6px'}}>{title}</div>
                {items.map(item => (
                  <div key={item} style={{fontFamily:'JetBrains Mono,monospace',fontSize:'11px',color:'var(--text-2)',padding:'2px 0'}}>{item}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Category scores */}
        <div className="card card-body">
          <div className="section-header" style={{marginTop:0}}>Category Scores</div>
          {[
            ['Broken Reference',  category_scores.broken_reference],
            ['Duplicate Def',     category_scores.duplicate_def],
            ['Join Integrity',    category_scores.join_integrity],
            ['Field Quality',     category_scores.field_quality],
          ].map(([name, score]) => (
            <div key={name} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:'13px'}}>
              <span>{name}</span>
              <span style={{fontFamily:'JetBrains Mono,monospace',fontWeight:700,color:score>=85?'var(--success)':score>=60?'var(--warning)':'var(--error)'}}>{score}/100</span>
            </div>
          ))}
        </div>

        {/* GitHub clone cleanup */}
        {result.tmp_dir && (
          <div className="card card-body">
            <div className="section-header" style={{marginTop:0}}>GitHub Clone</div>
            <p style={{fontSize:'12px',color:'var(--text-2)',marginBottom:'10px',fontFamily:'JetBrains Mono,monospace'}}>
              Temp clone at: {result.tmp_dir}
            </p>
            {cleaned ? (
              <div className="alert alert-success">✓ Cloned repo deleted from disk.</div>
            ) : (
              <button className="btn btn-danger btn-sm" onClick={handleCleanup} disabled={cleaning}>
                {cleaning ? <><span className="spinner" style={{marginRight:6}}/>Deleting…</> : '🗑 Delete cloned repo from disk'}
              </button>
            )}
          </div>
        )}

        {/* New audit */}
        <button className="btn btn-secondary btn-full" onClick={onReset}>
          ← Start New Audit
        </button>
      </div>
    </div>
  );
}
