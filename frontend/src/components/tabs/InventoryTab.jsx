import { useState, useMemo } from 'react';
import { relFileName, severityBadgeClass } from '../../utils';

export default function InventoryTab({ result }) {
  const [sub, setSub] = useState('views');
  const [search, setSearch] = useState('');
  const { views, explores } = result;

  const allViewNames = useMemo(() => new Set(views.map(v => v.name)), [views]);
  const allRefs = useMemo(() => new Set(
    explores.flatMap(e => [e.base_view, ...e.joins.map(j => j.resolved_view)])
  ), [explores]);

  const sharedTables = useMemo(() => {
    const tableCnt = {};
    views.forEach(v => { if (v.sql_table_name && v.sql_table_name !== '—') { tableCnt[v.sql_table_name] = (tableCnt[v.sql_table_name]||0)+1; } });
    return new Set(Object.entries(tableCnt).filter(([,c])=>c>1).flatMap(([t])=>
      views.filter(v=>v.sql_table_name===t).map(v=>v.name)
    ));
  }, [views]);

  const tabs = ['views','derived_tables','explores','joins'];

  // KPIs
  const kpis = useMemo(() => {
    const dtViews = views.filter(v => v.is_derived_table);
    const allJoins = explores.flatMap(e => e.joins);
    
    return {
      views: [
        { label: 'Total Views', value: views.length },
        { label: 'Avg Fields / View', value: views.length ? (views.reduce((s, v) => s + v.n_fields, 0) / views.length).toFixed(1) : 0 },
        { label: 'Missing PKs', value: views.filter(v => !v.has_primary_key).length, isWarning: true },
        { label: 'Orphaned Views', value: views.filter(v => !allRefs.has(v.name)).length, isWarning: true },
      ],
      derived_tables: [
        { label: 'Total Derived Tables', value: dtViews.length },
        { label: 'Missing PKs', value: dtViews.filter(v => !v.has_primary_key).length, isWarning: true },
        { label: 'Avg Fields / DT', value: dtViews.length ? (dtViews.reduce((s, v) => s + v.n_fields, 0) / dtViews.length).toFixed(1) : 0 }
      ],
      explores: [
        { label: 'Total Explores', value: explores.length },
        { label: 'Avg Joins / Explore', value: explores.length ? (explores.reduce((s, e) => s + e.joins.length, 0) / explores.length).toFixed(1) : 0 },
        { label: 'Zombie Explores', value: explores.filter(e => !allViewNames.has(e.base_view)).length, isWarning: true },
      ],
      joins: [
        { label: 'Total Joins', value: allJoins.length },
        { label: 'Missing Relationships', value: allJoins.filter(j => !j.relationship).length, isWarning: true },
        { label: 'Missing sql_on / where', value: allJoins.filter(j => !j.sql_on && !j.sql_where).length, isWarning: true },
      ]
    };
  }, [views, explores, allRefs, allViewNames]);

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Traditional Tabs */}
        <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', flex: '1', minWidth: '300px' }}>
          {tabs.map(t => (
            <button 
              key={t} 
              onClick={() => setSub(t)}
              style={{ 
                background: 'none', border: 'none', padding: '12px 4px', cursor: 'pointer',
                fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: 600,
                color: sub === t ? 'var(--accent)' : 'var(--text-2)',
                borderBottom: sub === t ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 150ms', whiteSpace: 'nowrap',
                marginBottom: '-1px'
              }}
            >
              {t === 'derived_tables' ? 'Derived Tables' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-3)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text"
            placeholder={`Search ${sub.replace('_', ' ')}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px 9px 36px', fontSize: '13px', color: 'var(--text-1)', outline: 'none', transition: 'border-color 150ms' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {kpis[sub].map(kpi => (
          <div key={kpi.label} className={`kpi-card ${kpi.isWarning && kpi.value > 0 ? 'accent-top' : ''}`} style={{ padding: '16px 20px', borderTopColor: kpi.isWarning && kpi.value > 0 ? 'var(--warning)' : 'transparent' }}>
            <div className="kpi-label">{kpi.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: kpi.isWarning && kpi.value > 0 ? 'var(--warning)' : 'var(--text-1)', fontFamily: 'Sora, sans-serif' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {sub === 'views' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>View</th><th>Fields (Dim/Meas)</th><th>Primary Key</th>
              <th>SQL Table</th><th>Status</th><th>File</th>
            </tr></thead>
            <tbody>
              {views.filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || (v.sql_table_name || '').toLowerCase().includes(search.toLowerCase())).map(v => (
                <tr key={v.name}>
                  <td className="mono" style={{fontWeight:600}} title={v.name}>
                    <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
                      {v.is_derived_table && <span className="badge badge-info" style={{zoom: 0.8, marginLeft: '8px', flexShrink: 0}}>DT</span>}
                    </div>
                  </td>
                  <td className="mono">
                    {v.n_fields} <span style={{color: 'var(--text-3)', fontSize: '11px'}}>({v.n_dimensions} / {v.n_measures})</span>
                  </td>
                  <td>
                    {v.has_primary_key 
                      ? <span className="mono" style={{ color: 'var(--success)' }}>{v.primary_key_field}</span>
                      : <span className="badge badge-error"><span className="status-dot"></span> Missing</span>
                    }
                  </td>
                  <td className="mono" style={{fontSize:'11px', color: 'var(--text-2)'}} title={v.sql_table_name}>
                    <div style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.sql_table_name||'—'}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {sharedTables.has(v.name) && <span className="badge badge-warning">⚠ Shared</span>}
                      {!allRefs.has(v.name) && <span className="badge badge-warning">⚠ Orphan</span>}
                    </div>
                  </td>
                  <td className="mono" style={{fontSize:'11px', color: 'var(--text-3)'}}>{relFileName(v.source_file)}</td>
                </tr>
              ))}
              {views.filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || (v.sql_table_name || '').toLowerCase().includes(search.toLowerCase())).length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state" style={{ padding: '32px' }}>
                      <span className="empty-state-icon">🔍</span>
                      <span className="empty-state-text">No views found matching "{search}".</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {sub === 'derived_tables' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Derived Table View</th><th>Fields</th><th>Primary Key</th>
              <th>Status</th><th>File</th>
            </tr></thead>
            <tbody>
              {views.filter(v => v.is_derived_table && v.name.toLowerCase().includes(search.toLowerCase())).map(v => (
                <DtRow key={v.name} v={v} allRefs={allRefs} />
              ))}
              {views.filter(v => v.is_derived_table && v.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                <tr>
                  <td colSpan="5">
                    <div className="empty-state" style={{ padding: '32px' }}>
                      <span className="empty-state-icon">📦</span>
                      <span className="empty-state-text">No derived tables found matching "{search}".</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {sub === 'explores' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Explore</th><th>Label</th><th>Base View</th><th>Joins</th><th>Status</th><th>File</th>
            </tr></thead>
            <tbody>
              {explores.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || (e.label || '').toLowerCase().includes(search.toLowerCase())).map(e => (
                <tr key={e.name}>
                  <td className="mono" style={{fontWeight:600}} title={e.name}>
                    <div style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                  </td>
                  <td title={e.label}>
                    <div style={{maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                      {e.label||<span style={{color:'var(--text-3)'}}>—</span>}
                    </div>
                  </td>
                  <td className="mono">{e.base_view}</td>
                  <td className="mono">{e.joins.length}</td>
                  <td>{!allViewNames.has(e.base_view)?<span className="badge badge-error"><span className="status-dot"></span> Zombie</span>:''}</td>
                  <td className="mono" style={{fontSize:'11px', color: 'var(--text-3)'}}>{relFileName(e.source_file)}</td>
                </tr>
              ))}
              {explores.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || (e.label || '').toLowerCase().includes(search.toLowerCase())).length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state" style={{ padding: '32px' }}>
                      <span className="empty-state-icon">🔍</span>
                      <span className="empty-state-text">No explores found matching "{search}".</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {sub === 'joins' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Explore</th><th>Join</th><th>Resolved View</th>
              <th>Type</th><th>Relationship</th><th>Condition</th><th>File</th>
            </tr></thead>
            <tbody>
              {explores.flatMap(e => e.joins.filter(j => j.name.toLowerCase().includes(search.toLowerCase()) || e.name.toLowerCase().includes(search.toLowerCase())).map((j, i) => (
                <tr key={`${e.name}-${j.name}-${i}`}>
                  <td className="mono" style={{color:'var(--accent)', fontWeight:600}} title={e.name}>
                    <div style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                  </td>
                  <td className="mono" style={{fontWeight:600}} title={j.name}>
                    <div style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</div>
                  </td>
                  <td className="mono">{j.resolved_view}</td>
                  <td><span className="badge badge-neutral">{(j.type||'left outer').replace(/_/g,' ')}</span></td>
                  <td>
                    {j.relationship 
                      ? <span className="mono">{j.relationship.replace(/_/g,' ')}</span>
                      : <span className="badge badge-warning"><span className="status-dot"></span> Missing</span>
                    }
                  </td>
                  <td>
                    {j.sql_on
                      ? <span className="badge badge-success">sql_on</span>
                      : j.sql_where
                        ? <span className="badge badge-warning">sql_where</span>
                        : <span className="badge badge-error"><span className="status-dot"></span> Missing</span>
                    }
                  </td>
                  <td className="mono" style={{fontSize:'11px', color:'var(--text-3)'}}>{relFileName(j.source_file)}</td>
                </tr>
              )))}
              {explores.flatMap(e => e.joins.filter(j => j.name.toLowerCase().includes(search.toLowerCase()) || e.name.toLowerCase().includes(search.toLowerCase()))).length === 0 && (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state" style={{ padding: '32px' }}>
                      <span className="empty-state-icon">🔍</span>
                      <span className="empty-state-text">No joins found matching "{search}".</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DtRow({ v, allRefs }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr onClick={() => setOpen(!open)} style={{ cursor: 'pointer', background: open ? 'var(--surface-2)' : 'transparent' }}>
        <td className="mono" style={{fontWeight:600, color: 'var(--accent)'}} title={v.name}>
          <div style={{ display: 'flex', alignItems: 'center', maxWidth: '200px' }}>
            <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', marginRight: '8px', fontSize: '10px', flexShrink: 0 }}>▶</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
          </div>
        </td>
        <td className="mono">
          {v.n_fields} <span style={{color: 'var(--text-3)', fontSize: '11px'}}>({v.n_dimensions} / {v.n_measures})</span>
        </td>
        <td>
          {v.has_primary_key 
            ? <span className="mono" style={{ color: 'var(--success)' }}>{v.primary_key_field}</span>
            : <span className="badge badge-error"><span className="status-dot"></span> Missing</span>
          }
        </td>
        <td>{!allRefs.has(v.name)?<span className="badge badge-warning">⚠ Orphan</span>:''}</td>
        <td className="mono" style={{fontSize:'11px', color: 'var(--text-3)'}}>{relFileName(v.source_file)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan="5" style={{ padding: 0, borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '16px 24px', background: 'var(--surface-2)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Derived Table SQL</div>
              <pre className="code-block" style={{maxHeight:'320px',overflowY:'auto',fontSize:'11px', margin: 0, background: 'var(--surface)', border: '1px solid var(--border-2)'}}>{v.derived_table_sql||'— no SQL found —'}</pre>
            </div>
          </td>
        </tr>
      )}
    </>
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
