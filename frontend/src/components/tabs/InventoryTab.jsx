import { useState } from 'react';
import { relFileName, severityBadgeClass } from '../../utils';

export default function InventoryTab({ result }) {
  const [sub, setSub] = useState('views');
  const [search, setSearch] = useState('');
  const { views, explores } = result;

  const allViewNames = new Set(views.map(v => v.name));
  const allRefs = new Set(
    explores.flatMap(e => [e.base_view, ...e.joins.map(j => j.resolved_view)])
  );

  const tableCnt = {};
  views.forEach(v => { if (v.sql_table_name && v.sql_table_name !== '—') { tableCnt[v.sql_table_name] = (tableCnt[v.sql_table_name]||0)+1; } });
  const sharedTables = new Set(Object.entries(tableCnt).filter(([,c])=>c>1).flatMap(([t])=>
    views.filter(v=>v.sql_table_name===t).map(v=>v.name)
  ));

  const tabs = ['views','derived_tables','explores','joins'];

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {tabs.map(t => (
            <button key={t} className={`btn btn-sm ${sub === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSub(t)} style={{ borderRadius: '8px', padding: '6px 16px', fontWeight: 600 }}>
              {t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
        
        <div style={{ position: 'relative', flex: '1', maxWidth: '300px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-3)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text"
            placeholder={`Search ${sub.replace('_', ' ')}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px 8px 32px', fontSize: '13px', color: 'var(--text-1)', outline: 'none' }}
          />
        </div>
      </div>

      {sub === 'views' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>View</th><th>Dimensions</th><th>Measures</th><th>Total Fields</th>
              <th>Primary Key</th><th>Derived</th><th>SQL Table</th>
              <th>Shared Table</th><th>Orphan</th><th>File</th>
            </tr></thead>
            <tbody>
              {views.filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || (v.sql_table_name || '').toLowerCase().includes(search.toLowerCase())).map(v => (
                <tr key={v.name}>
                  <td className="mono" style={{fontWeight:600}}>{v.name}</td>
                  <td className="mono">{v.n_dimensions}</td>
                  <td className="mono">{v.n_measures}</td>
                  <td className="mono">{v.n_fields}</td>
                  <td className="mono" style={{color:v.has_primary_key?'var(--success)':'var(--error)'}}>
                    {v.has_primary_key ? v.primary_key_field : '⚠ Missing'}
                  </td>
                  <td><span className={`badge ${v.is_derived_table?'badge-info':'badge-neutral'}`}>{v.is_derived_table?'Yes':'No'}</span></td>
                  <td className="mono" style={{fontSize:'11px'}}>{v.sql_table_name||'—'}</td>
                  <td>{sharedTables.has(v.name)?<span className="badge badge-warning">⚠ Yes</span>:''}</td>
                  <td>{!allRefs.has(v.name)?<span className="badge badge-warning">⚠ Orphan</span>:''}</td>
                  <td className="mono" style={{fontSize:'11px'}}>{relFileName(v.source_file)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sub === 'derived_tables' && (
        <div>
          {views.filter(v => v.is_derived_table && v.name.toLowerCase().includes(search.toLowerCase())).length === 0
            ? <div className="empty-state"><span className="empty-state-icon">📦</span><span>No derived tables found matching "{search}".</span></div>
            : views.filter(v => v.is_derived_table && v.name.toLowerCase().includes(search.toLowerCase())).map(v => (
              <Expander key={v.name} title={`▶  ${v.name}   (${v.n_fields} fields · PK: ${v.has_primary_key ? v.primary_key_field : '⚠ Missing'})`}>
                <pre className="code-block" style={{maxHeight:'320px',overflowY:'auto',fontSize:'11px'}}>{v.derived_table_sql||'— no SQL found —'}</pre>
              </Expander>
            ))
          }
        </div>
      )}

      {sub === 'explores' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Explore</th><th>Label</th><th>Base View</th><th>Joins</th><th>Zombie</th><th>File</th>
            </tr></thead>
            <tbody>
              {explores.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || (e.label || '').toLowerCase().includes(search.toLowerCase())).map(e => (
                <tr key={e.name}>
                  <td className="mono" style={{fontWeight:600}}>{e.name}</td>
                  <td>{e.label||'—'}</td>
                  <td className="mono">{e.base_view}</td>
                  <td className="mono">{e.joins.length}</td>
                  <td>{!allViewNames.has(e.base_view)?<span className="badge badge-error">🔴 Zombie</span>:''}</td>
                  <td className="mono" style={{fontSize:'11px'}}>{relFileName(e.source_file)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sub === 'joins' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Explore</th><th>Join</th><th>Resolved View</th>
              <th>Type</th><th>Relationship</th><th>Has sql_on</th><th>File</th>
            </tr></thead>
            <tbody>
              {explores.flatMap(e => e.joins.filter(j => j.name.toLowerCase().includes(search.toLowerCase()) || e.name.toLowerCase().includes(search.toLowerCase())).map((j, i) => (
                <tr key={`${e.name}-${j.name}-${i}`}>
                  <td className="mono" style={{color:'var(--indigo)'}}>{e.name}</td>
                  <td className="mono" style={{fontWeight:600}}>{j.name}</td>
                  <td className="mono">{j.resolved_view}</td>
                  <td className="mono">{(j.type||'left_outer').replace(/_/g,' ')}</td>
                  <td>
                    <span className={`badge ${!j.relationship?'badge-warning':'badge-neutral'}`}>
                      {j.relationship ? j.relationship.replace(/_/g,' ') : '⚠ Missing'}
                    </span>
                  </td>
                  <td>
                    {j.sql_on
                      ? <span className="badge badge-success">✓</span>
                      : j.sql_where
                        ? <span className="badge badge-warning">⚠ sql_where</span>
                        : <span className="badge badge-error">❌ Missing</span>
                    }
                  </td>
                  <td className="mono" style={{fontSize:'11px'}}>{relFileName(j.source_file)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Expander({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="expander">
      <div className="expander-header" onClick={() => setOpen(o=>!o)}>
        <span style={{fontSize:'13px',fontFamily:'JetBrains Mono,monospace'}}>{title}</span>
        <span className={`expander-chevron${open?' open':''}`}>▼</span>
      </div>
      {open && <div className="expander-body">{children}</div>}
    </div>
  );
}
