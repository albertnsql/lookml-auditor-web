import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

// ── Components ──
export default function VisualizationsTab({ result }) {
  const { views, explores, issues } = result;
  const [filters, setFilters] = useState({
    folders: [],
    explore: null,
    fieldTypes: ['all'],
    search: '',
    folderSearch: ''
  });

  const [folderOpen, setFolderOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  
  // Arc Diagram Interaction State
  const [arcHoverExplore, setArcHoverExplore] = useState(null);
  const [arcClickExplore, setArcClickExplore] = useState(null);
  const [arcHoverView, setArcHoverView] = useState(null);
  
  const [tooltip, setTooltip] = useState(null);
  const dropdownRef = useRef(null);

  const [hoveredExplore, setHoveredExplore] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredBucket, setHoveredBucket] = useState(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setFolderOpen(false);
        setExploreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isFiltered = filters.folders.length > 0 || filters.explore || filters.search || !filters.fieldTypes.includes('all');

  const toggleFieldType = (type) => {
    if (type === 'all') {
      setFilters(prev => ({ ...prev, fieldTypes: ['all'] }));
    } else {
      setFilters(prev => {
        let newTypes = prev.fieldTypes.filter(t => t !== 'all');
        if (newTypes.includes(type)) newTypes = newTypes.filter(t => t !== type);
        else newTypes.push(type);
        if (newTypes.length === 0) newTypes = ['all'];
        return { ...prev, fieldTypes: newTypes };
      });
    }
  };

  const clearAllFilters = () => setFilters({ folders: [], explore: null, fieldTypes: ['all'], search: '', folderSearch: '' });

  const toggleFolder = (f) => {
    setFilters(p => {
      const active = p.folders.includes(f);
      return { ...p, folders: active ? p.folders.filter(x => x !== f) : [...p.folders, f] };
    });
  };

  // ── Compute Real Data ──
  const activeViews = useMemo(() => {
    if (filters.folders.length === 0) return views;
    return views.filter(v => {
      if (!v.source_file) return false;
      const parts = v.source_file.replace(/\\/g, '/').split('/');
      return parts.length > 1 && filters.folders.includes(parts[parts.length - 2]);
    });
  }, [views, filters.folders]);

  const activeExplores = useMemo(() => {
    let list = explores;
    if (filters.folders.length > 0) {
      list = list.filter(e => {
        if (!e.source_file) return false;
        const parts = e.source_file.replace(/\\/g, '/').split('/');
        return parts.length > 1 && filters.folders.includes(parts[parts.length - 2]);
      });
    }
    if (filters.explore) {
      list = list.filter(e => e.name === filters.explore);
    }
    return list;
  }, [explores, filters.folders, filters.explore]);

  const exploreComplexity = useMemo(() => {
    const explores = activeExplores;
    
    // Log raw names to check for duplicates in source data
    console.log('Raw explore names:', explores.map(e => e.name));

    // Deduplicate by name — keep the one with most joins if duplicates exist
    const seen = {};
    explores.forEach(e => {
      const name = e.name;
      const joinCount = e.joins?.length ?? 0;
      if (!seen[name] || joinCount > seen[name].totalJoins) {
        seen[name] = {
          name,
          totalJoins: joinCount,
          leftOuter:  e.joins?.filter(j => (j.type ?? '').toLowerCase().includes('left')).length ?? 0,
          fullOuter:  e.joins?.filter(j => (j.type ?? '').toLowerCase().includes('full')).length ?? 0,
          noSqlOn:    e.joins?.filter(j => !j.sql_on && !j.foreign_key).length ?? 0,
          tier: joinCount <= 10 ? 'Simple' : joinCount <= 30 ? 'Moderate' : 'Complex'
        };
      }
    });

    return Object.values(seen)
      .sort((a, b) => b.totalJoins - a.totalJoins)
      .slice(0, 10);
  }, [activeExplores]);

  const maxJoins = Math.max(...exploreComplexity.map(e => e.totalJoins), 1);

  const exploresList = useMemo(() => {
    return explores.map(e => ({ name: e.name, joins: e.joins ? e.joins.length : 0 })).sort((a,b) => b.joins - a.joins);
  }, [explores]);

  const ACT_FOLDERS = useMemo(() => {
    const fset = new Set();
    [...views, ...explores].forEach(x => {
      if (x.source_file) {
        const parts = x.source_file.replace(/\\/g, '/').split('/');
        if (parts.length > 1) fset.add(parts[parts.length - 2]);
      }
    });
    return Array.from(fset).sort();
  }, [views, explores]);

  const filteredFolders = ACT_FOLDERS.filter(f => f.toLowerCase().includes(filters.folderSearch.toLowerCase()));

  const expFolderMap = useMemo(() => {
    const m = {};
    explores.forEach(e => {
      if (e.source_file) {
        const parts = e.source_file.replace(/\\/g, '/').split('/');
        if (parts.length > 1) m[e.name] = parts[parts.length - 2];
      }
    });
    return m;
  }, [explores]);

  const checkMatch = (expName) => {
    if (filters.explore && filters.explore !== expName) return false;
    if (filters.folders.length > 0) {
      const folder = expFolderMap[expName];
      if (!folder || !filters.folders.includes(folder)) return false;
    }
    return true;
  };

  const fScale = 1;

  const viewBuckets = useMemo(() => {
    const buckets = { '1–10':0, '11–25':0, '26–50':0, '51–100':0, '101–200':0, '200+':0 };
    activeViews.forEach(v => {
      const s = v.n_fields || 0;
      if (s<=10) buckets['1–10']++;
      else if (s<=25) buckets['11–25']++;
      else if (s<=50) buckets['26–50']++;
      else if (s<=100) buckets['51–100']++;
      else if (s<=200) buckets['101–200']++;
      else buckets['200+']++;
    });
    return [
      { label: '1–10', count: buckets['1–10'], color: '#09A55A' },
      { label: '11–25', count: buckets['11–25'], color: '#34D399' },
      { label: '26–50', count: buckets['26–50'], color: '#FCD34D' },
      { label: '51–100', count: buckets['51–100'], color: '#F59E0B' },
      { label: '101–200', count: buckets['101–200'], color: '#EF4444' },
      { label: '200+', count: buckets['200+'], color: '#DC2626' }
    ];
  }, [activeViews]);

  const { fieldCounts, metadataCov, totalFields } = useMemo(() => {
    let tCount = 0;
    const typeCnt = { string:0, number:0, date:0, yesno:0, other:0 };
    const meta = { both:0, label:0, desc:0, none:0 };

    activeViews.forEach(v => {
      (v.fields || []).forEach(f => {
        tCount++;
        
        // ── Robust Field Type Classification ──
        const raw = (f.type ?? f.field_type ?? f.data_type ?? '').toLowerCase();
        let type = 'other';
        if (raw.includes('string') || raw.includes('text') || raw.includes('char')) type = 'string';
        else if (['number','sum','average','count','count_distinct','max','min','median','duration','int','float','decimal'].some(t => raw.includes(t))) type = 'number';
        else if (raw.includes('date') || raw.includes('time') || raw.includes('timestamp')) type = 'date';
        else if (raw.includes('yesno') || raw.includes('bool')) type = 'yesno';
        
        typeCnt[type] = (typeCnt[type] ?? 0) + 1;

        const hasL = !!f.label;
        const hasD = !!f.description;
        if (hasL && hasD) meta.both++;
        else if (hasL) meta.label++;
        else if (hasD) meta.desc++;
        else meta.none++;
      });
    });

    const safePct = (v) => tCount ? Math.round((v/tCount)*1000)/10 : 0;

    const mCov = {
      both: { count: meta.both, pct: safePct(meta.both), tip: "Fully documented — exemplary LookML practice" },
      label: { count: meta.label, pct: safePct(meta.label), tip: "Missing descriptions — analysts lack context" },
      desc: { count: meta.desc, pct: safePct(meta.desc), tip: "Missing human-readable labels" },
      none: { count: meta.none, pct: safePct(meta.none), tip: "Run: add label and description to all bare fields" }
    };
    return { fieldCounts: typeCnt, metadataCov: mCov, totalFields: tCount };
  }, [activeViews]);

  const viewUsageData = useMemo(() => {
    // Count how many explores reference each view
    const viewExploreCount = {};
    activeExplores.forEach(explore => {
      (explore.joins ?? []).forEach(join => {
        const viewName = join.from_view ?? join.name;
        if (viewName) viewExploreCount[viewName] = (viewExploreCount[viewName] ?? 0) + 1;
      });
    });

    const allViews = activeViews;
    const counts = allViews.map(v => viewExploreCount[v.name] ?? 0);

    // Build histogram buckets
    const buckets = [
      { label: '0\nOrphaned',  min: 0,  max: 0,   color: '#EF4444', textColor: '#DC2626' },
      { label: '1',            min: 1,  max: 1,   color: '#F59E0B', textColor: '#D97706' },
      { label: '2–4',          min: 2,  max: 4,   color: '#6366F1', textColor: '#4F46E5' },
      { label: '5–10',         min: 5,  max: 10,  color: '#3B82F6', textColor: '#2563EB' },
      { label: '11–30',        min: 11, max: 30,  color: '#06B6D4', textColor: '#0891B2' },
      { label: '30+\nShared',  min: 31, max: Infinity, color: '#09A55A', textColor: '#15803D' },
    ].map(bucket => ({
      ...bucket,
      count: counts.filter(c => c >= bucket.min && c <= bucket.max).length,
    }));

    const maxCount = Math.max(...buckets.map(b => b.count), 1);

    // Top 3 most shared views for callout
    const topViews = Object.entries(viewExploreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Orphan view names
    const orphanViews = allViews
      .filter(v => !viewExploreCount[v.name])
      .map(v => v.name)
      .slice(0, 5);

    return { buckets, maxCount, topViews, orphanViews, total: counts.length };
  }, [activeViews, activeExplores]);

  // Keep matrix dependencies for the Arc Diagram
  const { viewUsageCount, matrixViews } = useMemo(() => {
    const vc = {};
    activeExplores.forEach(e => {
      const vset = new Set([e.base_view, ...(e.joins||[]).map(j => j.resolved_view)]);
      vset.forEach(v => { vc[v] = (vc[v]||0)+1; });
    });
    const sortedViews = Object.entries(vc).sort((a,b) => b[1] - a[1]).map(x => x[0]);
    const mv = sortedViews.slice(0, 10);
    return { viewUsageCount: vc, matrixViews: mv };
  }, [activeExplores]);

  const { dtList, pdtCount, ndtCount, nativeCount } = useMemo(() => {
    const dts = activeViews.filter(v => v.is_derived_table);
    let p=0, n=0, nat=0;
    const mapped = dts.map(v => {
      const sql = v.derived_table_sql || '';
      const lines = sql.split('\\n').length;
      const ls = sql.toLowerCase();
      let type = 'PDT';
      if (ls.includes('explore_source')) { type = 'NDT'; nat++; n++; }
      else if (ls.includes('persist_for') || ls.includes('datagroup_trigger')) { p++; }
      else { n++; }
      return { name: v.name, type, lines };
    }).sort((a,b) => b.lines - a.lines);
    return { dtList: mapped.slice(0, 5), pdtCount: p, ndtCount: n, nativeCount: nat };
  }, [activeViews]);

  const matrixExplores = useMemo(() => exploresList.slice(0, 8).map(e => e.name), [exploresList]);

  const handleTooltip = (e, content) => {
    if (!content) {
      setTooltip(null);
      return;
    }
    let left = e.clientX + 12;
    let top = e.clientY - 40;
    
    // basic clamp
    if (left + 250 > window.innerWidth) left = window.innerWidth - 260;
    if (top < 10) top = 10;
    if (top + 150 > window.innerHeight) top = window.innerHeight - 160;

    setTooltip({ x: left, y: top, content });
  };

  return (
    <div style={{ animation: 'fadeSlideUp 400ms ease-out 200ms both' }}>
      
      {/* Absolute Tooltip Overlay via Portal */}
      {tooltip && createPortal(
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y,
          pointerEvents: 'none', zIndex: 9999, background: '#1E1B4B', color: 'white', padding: '10px 14px',
          borderRadius: '10px', fontSize: '13px', fontFamily: 'Inter, sans-serif', boxShadow: '0 8px 24px rgba(99,91,255,0.25)',
          border: '1px solid rgba(99,91,255,0.4)', animation: 'fadeSlideUpTooltip 150ms ease forwards',
          minWidth: '200px'
        }}>
          {tooltip.content}
        </div>,
        document.body
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeSlideUpTooltip {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '24px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '4px' }}>Project Intelligence</div>
          <div style={{ fontSize: '14px', color: 'var(--text-2)' }}>Structural analysis of looker-repo · 1,037 views · 710 explores</div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Last audited: just now</div>
      </div>

      {/* ── Persistent Filter Bar ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '0px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }} ref={dropdownRef}>
          
          {/* Folder Selector (Redesigned) */}
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-2)', letterSpacing: '0.08em', marginBottom: '6px' }}>Folder</div>
            <div 
              onClick={() => { setFolderOpen(!folderOpen); setExploreOpen(false); }}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', minWidth: '220px', font: '13px Sora, sans-serif', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              {filters.folders.length === 0 ? 'All Folders' : filters.folders.length === 1 ? filters.folders[0] : `${filters.folders.length} folders`}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: folderOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}><polyline points="6 9 12 15 18 9"/></svg>
            </div>

            {/* Selected Folder Chips */}
            {filters.folders.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px', maxWidth: '220px' }}>
                {filters.folders.slice(0, 3).map(f => (
                  <span key={f} style={{ background: 'var(--accent)', color: 'white', borderRadius: '20px', padding: '3px 8px 3px 12px', fontSize: '11px', fontFamily: 'Sora, sans-serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                    <span style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: 1 }} onClick={() => toggleFolder(f)}>×</span>
                  </span>
                ))}
                {filters.folders.length > 3 && (
                  <span style={{ color: 'var(--accent)', fontSize: '11px', fontFamily: 'Sora, sans-serif', fontWeight: 600, padding: '3px 4px' }}>
                    + {filters.folders.length - 3} more
                  </span>
                )}
              </div>
            )}
            
            {folderOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', width: '280px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                
                {/* Search */}
                <div>
                  <input 
                    type="text" placeholder="Search folders..." 
                    value={filters.folderSearch} onChange={e => setFilters(p => ({ ...p, folderSearch: e.target.value }))}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', font: '12px Inter, sans-serif', width: '100%', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                
                {/* Quick actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                  <span onClick={() => setFilters(p => ({ ...p, folders: ACT_FOLDERS }))} style={{ color: 'var(--accent)', fontSize: '11px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}>Select all</span>
                  <span onClick={() => setFilters(p => ({ ...p, folders: [] }))} style={{ color: 'var(--accent)', fontSize: '11px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}>Clear</span>
                </div>

                {/* List */}
                <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {filteredFolders.map(f => {
                    const checked = filters.folders.includes(f);
                    return (
                      <div 
                        key={f} onClick={() => toggleFolder(f)}
                        style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', background: checked ? '#EEF2FF' : 'transparent', transition: 'background 120ms ease' }}
                        onMouseEnter={e => { if(!checked) e.currentTarget.style.background = '#F5F3FF'; }}
                        onMouseLeave={e => { if(!checked) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ width: '16px', height: '16px', border: checked ? '1.5px solid var(--accent)' : '1.5px solid var(--border)', borderRadius: '4px', background: checked ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <span style={{ fontSize: '16px', filter: 'grayscale(100%) opacity(50%)' }}>📁</span>
                        <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', color: 'var(--text-1)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f}</span>
                        <span style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', color: 'var(--text-3)' }}>{Math.floor(Math.random()*40 + 5)}</span>
                      </div>
                    );
                  })}
                </div>

              </div>
            )}
          </div>

          {/* Explore Selector */}
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-2)', letterSpacing: '0.08em', marginBottom: '6px' }}>Explore</div>
            <div 
              onClick={() => { setExploreOpen(!exploreOpen); setFolderOpen(false); }}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', minWidth: '200px', font: '13px Sora, sans-serif', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              {filters.explore || 'All Explores'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: exploreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            
            {exploreOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: '260px', padding: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                <div onClick={() => { setFilters(p => ({ ...p, explore: null })); setExploreOpen(false); }} style={{ padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: !filters.explore ? 600 : 400, background: !filters.explore ? '#EEF2FF' : 'transparent', color: !filters.explore ? 'var(--accent)' : 'var(--text-1)' }}>
                  All Explores
                </div>
                <div style={{ margin: '4px 0', borderBottom: '1px solid var(--border)' }} />
                {exploresList.map(e => (
                  <div key={e.name} onClick={() => { setFilters(p => ({ ...p, explore: e.name })); setExploreOpen(false); }} style={{ padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: filters.explore === e.name ? '#EEF2FF' : 'transparent', color: filters.explore === e.name ? 'var(--accent)' : 'var(--text-1)' }}>
                    <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px' }}>{e.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>({e.joins} joins)</span>
                  </div>
                ))}
              </div>
            )}
            {filters.explore && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, display: 'flex', gap: '4px', zIndex: 10 }}>
                <span style={{ background: 'rgba(99,91,255,0.1)', color: 'var(--accent)', borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontFamily: 'Sora, sans-serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {filters.explore} <span style={{cursor:'pointer'}} onClick={()=>setFilters(p=>({...p, explore: null}))}>×</span>
                </span>
              </div>
            )}
          </div>

          {/* Field Type Pills */}
          <div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-2)', letterSpacing: '0.08em', marginBottom: '6px' }}>Field Type</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['all', 'dimension', 'measure', 'filter', 'parameter'].map(t => {
                const isActive = filters.fieldTypes.includes(t);
                return (
                  <div key={t} onClick={() => toggleFieldType(t)} style={{ border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontFamily: 'Sora, sans-serif', cursor: 'pointer', background: isActive ? 'var(--accent)' : 'var(--bg)', color: isActive ? 'white' : 'var(--text-2)', textTransform: 'capitalize', transition: 'all 150ms ease' }}>
                    {t}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Search */}
          <div style={{ flex: 1, minWidth: '200px', marginLeft: 'auto', alignSelf: 'flex-start', paddingTop: '19px' }}>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-3)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input 
                type="text" placeholder="Search views, explores, fields..." 
                value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px 8px 30px', font: '13px Inter, sans-serif', color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box', transition: 'all 150ms ease' }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,91,255,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Active Filters Summary Row (Outside card) */}
      <div style={{ 
        marginTop: isFiltered ? '12px' : '0', marginBottom: isFiltered ? '24px' : '0', height: isFiltered ? 'auto' : '0', opacity: isFiltered ? 1 : 0, overflow: 'hidden',
        transition: 'all 200ms ease', fontSize: '12px', color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: isFiltered ? '8px 16px' : '0 16px', background: 'var(--bg)', borderRadius: '8px', border: isFiltered ? '1px solid var(--border)' : 'none'
      }}>
        <div>
          Showing results for <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, color: 'var(--text-1)' }}>{filters.folders.length > 0 ? `${filters.folders.length} folders` : 'all folders'}</span> · <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, color: 'var(--text-1)' }}>{filters.explore || 'all explores'}</span> · <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, color: 'var(--text-1)' }}>{filters.fieldTypes.join(', ')}</span> — {Math.round(1037 * fScale)} views · {Math.round(710 * fScale)} explores matched
        </div>
        <div onClick={clearAllFilters} style={{ color: 'var(--accent)', cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: 600 }}>
          Clear all filters
        </div>
      </div>

      {/* ── Row 1 ── */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', alignItems: 'stretch', marginTop: isFiltered ? '0' : '32px' }}>
        
        {/* Explore Complexity (60%) */}
        <div className="card" style={{ flex: '6', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>Explore Complexity</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>Ranked by total joins · segment = join type</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', flex: 1 }}>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {[
                { label: 'Left Outer', color: '#6366F1' },
                { label: 'Full Outer', color: '#8B5CF6' },
                { label: 'Cross / Other', color: '#94A3B8' },
                { label: 'Missing sql_on', color: '#EF4444' },
              ].map(({ label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: color }} />
                  <span style={{ font: '11px Inter', color: 'var(--text-2)' }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Rows */}
            {exploreComplexity.map((explore, idx) => {
              const tierColor = explore.tier === 'Simple' ? '#09A55A'
                              : explore.tier === 'Moderate' ? '#D97706'
                              : '#DC2626';
              const barWidth = (explore.totalJoins / maxJoins * 100);
              
              // Segment widths as % of total bar
              const leftPct  = explore.totalJoins > 0 ? (explore.leftOuter / explore.totalJoins * barWidth) : 0;
              const fullPct  = explore.totalJoins > 0 ? (explore.fullOuter / explore.totalJoins * barWidth) : 0;
              const crossPct = explore.totalJoins > 0 ? ((explore.totalJoins - explore.leftOuter - explore.fullOuter) / explore.totalJoins * barWidth) : 0;

              return (
                <div key={explore.name} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '9px 0',
                  borderBottom: idx < exploreComplexity.length - 1 ? '1px solid var(--border)' : 'none',
                }}
                  onMouseEnter={(e) => {
                    setHoveredExplore(explore);
                    setTooltipPos({ x: e.clientX + 12, y: e.clientY - 10 });
                  }}
                  onMouseMove={(e) => {
                    setTooltipPos({ x: e.clientX + 12, y: e.clientY - 10 });
                  }}
                  onMouseLeave={() => setHoveredExplore(null)}
                >
                  {/* Rank */}
                  <span style={{ font: '11px Sora', color: 'var(--text-3)', width: '20px', flexShrink: 0 }}>
                    #{idx + 1}
                  </span>

                  {/* Explore name */}
                  <span style={{
                    font: '12px monospace', color: 'var(--text-1)',
                    width: '180px', flexShrink: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}
                    title={explore.name}
                  >
                    {explore.name}
                  </span>

                  {/* Segmented bar */}
                  <div style={{
                    flex: 1, height: '10px', borderRadius: '5px',
                    background: 'var(--border)', overflow: 'hidden',
                    display: 'flex'
                  }}>
                    <div style={{ width: `${leftPct}%`, background: '#6366F1', transition: 'width 600ms ease-out' }} />
                    <div style={{ width: `${fullPct}%`, background: '#8B5CF6', transition: 'width 600ms ease-out' }} />
                    <div style={{ width: `${crossPct}%`, background: '#94A3B8', transition: 'width 600ms ease-out' }} />
                  </div>

                  {/* Join count */}
                  <span style={{
                    font: '13px Sora', fontWeight: 700,
                    color: tierColor, width: '32px',
                    textAlign: 'right', flexShrink: 0
                  }}>
                    {explore.totalJoins}
                  </span>

                  {/* Tier badge */}
                  <span style={{
                    font: '10px Sora', fontWeight: 600,
                    color: tierColor,
                    background: tierColor + '18',
                    border: `1px solid ${tierColor}40`,
                    borderRadius: '20px', padding: '2px 8px',
                    width: '68px', textAlign: 'center', flexShrink: 0
                  }}>
                    {explore.tier}
                  </span>

                  {/* Warning if missing sql_on */}
                  {explore.noSqlOn > 0 && (
                    <span title={`${explore.noSqlOn} joins missing sql_on`} style={{
                      font: '10px Sora', color: '#DC2626',
                      background: '#FEF2F2', border: '1px solid #FECACA',
                      borderRadius: '20px', padding: '2px 8px', flexShrink: 0
                    }}>
                      ⚠ {explore.noSqlOn} joins
                    </span>
                  )}
                </div>
              );
            })}

            {/* Danger Callout Inside Card */}
            {exploreComplexity.filter(e => e.totalJoins > 30).length > 0 && (
              <div style={{ marginTop: '24px', background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '11px', color: 'var(--error)' }}>
                ⚠ {exploreComplexity.filter(e => e.totalJoins > 30).length} explores exceed 30 joins — review for query performance impact
              </div>
            )}

            {/* Summary footer */}
            <div style={{
              marginTop: '16px', paddingTop: '12px',
              borderTop: '1px solid var(--border)',
              display: 'flex', gap: '24px'
            }}>
              {[
                { label: 'Simple (≤10)', count: exploreComplexity.filter(e => e.tier === 'Simple').length, color: '#09A55A' },
                { label: 'Moderate (11–30)', count: exploreComplexity.filter(e => e.tier === 'Moderate').length, color: '#D97706' },
                { label: 'Complex (30+)', count: exploreComplexity.filter(e => e.tier === 'Complex').length, color: '#DC2626' },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ font: '18px Sora', fontWeight: 700, color }}>{count}</span>
                  <span style={{ font: '11px Inter', color: 'var(--text-2)' }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Tooltip JSX */}
            {hoveredExplore && (
              <div style={{
                position: 'fixed',
                left: tooltipPos.x,
                top: tooltipPos.y,
                zIndex: 100,
                background: '#1E1B4B',
                color: 'white',
                borderRadius: '10px',
                padding: '12px 16px',
                border: '1px solid rgba(99,91,255,0.4)',
                boxShadow: '0 8px 24px rgba(99,91,255,0.25)',
                font: '13px Inter',
                pointerEvents: 'none',
                minWidth: '220px'
              }}>
                {/* Explore name */}
                <div style={{ font: '13px Sora', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
                  {hoveredExplore.name}
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px' }} />

                {/* Join breakdown */}
                {[
                  { label: 'Total Joins',       value: hoveredExplore.totalJoins,  color: '#A5B4FC' },
                  { label: 'Left Outer',        value: hoveredExplore.leftOuter,   color: '#6366F1' },
                  { label: 'Full Outer',        value: hoveredExplore.fullOuter,   color: '#8B5CF6' },
                  { label: 'Cross / Other',     value: hoveredExplore.totalJoins - hoveredExplore.leftOuter - hoveredExplore.fullOuter, color: '#94A3B8' },
                  { label: 'Missing sql_on',    value: hoveredExplore.noSqlOn,     color: '#EF4444' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '3px 0'
                  }}>
                    <span style={{ font: '12px Inter', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                    <span style={{ font: '12px Sora', fontWeight: 700, color }}>{value}</span>
                  </div>
                ))}

                {/* Divider */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '8px 0' }} />

                {/* Tier + performance note */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    font: '11px Sora', fontWeight: 600,
                    color: hoveredExplore.tier === 'Simple' ? '#4ADE80'
                         : hoveredExplore.tier === 'Moderate' ? '#FCD34D'
                         : '#F87171',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '20px', padding: '2px 10px'
                  }}>
                    {hoveredExplore.tier}
                  </span>
                  {hoveredExplore.totalJoins > 30 && (
                    <span style={{ font: '11px Inter', color: '#F87171' }}>
                      ⚠ Review performance
                    </span>
                  )}
                  {hoveredExplore.noSqlOn > 0 && hoveredExplore.totalJoins <= 30 && (
                    <span style={{ font: '11px Inter', color: '#FCD34D' }}>
                      ⚠ Missing sql_on
                    </span>
                  )}
                  {hoveredExplore.totalJoins <= 10 && hoveredExplore.noSqlOn === 0 && (
                    <span style={{ font: '11px Inter', color: '#4ADE80' }}>
                      ✓ Well structured
                    </span>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* View Size Distribution (40%) */}
        <div className="card" style={{ flex: '4', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>View Size Distribution</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>Fields per view (dimensions + measures)</div>
            {filters.folders.length > 0 && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>Filtered: {filters.folders.length} folders — {Math.round(1037 * fScale)} views</div>}
          </div>
          
          <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
            <svg viewBox="0 0 400 240" width="100%" height="100%" style={{ overflow: 'visible' }}>
              {/* Y Axis max val logic */}
              {(() => {
                const maxVal = Math.max(...viewBuckets.map(b => Math.round(b.count * fScale)));
                const yMax = Math.max(10, maxVal * 1.15); // 15% headroom
                const ticks = [0, yMax*0.25, yMax*0.5, yMax*0.75, yMax].map(Math.round);

                return (
                  <>
                    {ticks.map((v) => {
                      const y = 210 - (v / yMax) * 160;
                      return (
                        <g key={v}>
                          <line x1="25" y1={y} x2="400" y2={y} stroke="rgba(99,91,255,0.06)" />
                          <text x="20" y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-3)">{v}</text>
                        </g>
                      );
                    })}

                    {/* Bars */}
                    {viewBuckets.map((b, idx) => {
                      const bw = 50;
                      const bx = 40 + idx * 60;
                      const bh = (b.count / Math.max(1, yMax)) * 160;
                      const by = 210 - bh;

                      return (
                        <g key={b.label} 
                           onMouseEnter={(e) => handleTooltip(e, (
                             <div>
                               <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, marginBottom: '4px' }}>{b.label} fields</div>
                               <div style={{ marginBottom: '8px' }}>{b.count} views in this range</div>
                               <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '4px 0 8px' }} />
                               <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Largest view: np_margin_header (288 fields)</div>
                               <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#A5B4FC', marginTop: '4px' }}>
                                 {b.label === '200+' ? 'Consider splitting into domain-specific views' : 'Well-scoped views — good modeling practice'}
                               </div>
                             </div>
                           ))}
                           onMouseLeave={() => handleTooltip(null, null)}
                        >
                          <HistogramBar x={bx} y={by} w={bw} h={bh} fill={b.color} delay={idx * 60} />
                          {/* Position value label completely above the bar */}
                          <text x={bx + bw/2} y={by - 6} textAnchor="middle" fontSize="11" fill="var(--text-1)" fontFamily="Sora, sans-serif">{b.count}</text>
                          <text x={bx + bw/2} y="230" textAnchor="middle" fontSize="10" fill="var(--text-2)">{b.label}</text>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>

          <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--warning)', fontStyle: 'italic' }}>
            {Math.round(22 * fScale)} views have 200+ fields — consider splitting into focused views
          </div>
        </div>
      </div>

      {/* ── Row 2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '40px' }}>
        
        {/* Field Type Breakdown Donut */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>Field Type Breakdown</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>Across all {Math.round(36836 * fScale).toLocaleString()} fields</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', flex: 1 }}>
            
            {/* Total fields headline */}
            <div style={{ marginBottom: '20px' }}>
              <span style={{ font: '32px Sora', fontWeight: 700, color: 'var(--text-1)' }}>
                {totalFields.toLocaleString()}
              </span>
              <span style={{ font: '13px Inter', color: 'var(--text-2)', marginLeft: '8px' }}>
                total fields
              </span>
            </div>

            {/* Stacked bar at top showing all types proportionally */}
            <div style={{
              display: 'flex', width: '100%', height: '10px',
              borderRadius: '5px', overflow: 'hidden',
              marginBottom: '24px'
            }}>
              {[
                { key: 'string', color: '#6366F1' },
                { key: 'number', color: '#3B82F6' },
                { key: 'date',   color: '#8B5CF6' },
                { key: 'yesno',  color: '#06B6D4' },
                { key: 'other',  color: '#94A3B8' },
              ].map(({ key, color }) => (
                <div key={key} style={{
                  width: totalFields > 0 ? `${(fieldCounts[key] / totalFields * 100).toFixed(1)}%` : '0%',
                  background: color,
                  transition: 'width 600ms ease-out'
                }} />
              ))}
            </div>

            {/* Ranked rows */}
            {[
              { key: 'string', label: 'String / Text', icon: 'Aa', color: '#6366F1', bg: '#EEF2FF' },
              { key: 'number', label: 'Number',        icon: 'Σ',  color: '#3B82F6', bg: '#EFF6FF' },
              { key: 'date',   label: 'Date / Time',   icon: '⏱',  color: '#8B5CF6', bg: '#F5F3FF' },
              { key: 'yesno',  label: 'Yes / No',      icon: '✓',  color: '#06B6D4', bg: '#ECFEFF' },
              { key: 'other',  label: 'Tier / Other',  icon: '◈',  color: '#94A3B8', bg: '#F8FAFC' },
            ]
              .sort((a, b) => (fieldCounts[b.key] ?? 0) - (fieldCounts[a.key] ?? 0))
              .map(({ key, label, icon, color, bg }, idx) => {
                const count = fieldCounts[key] ?? 0;
                const pct = totalFields > 0 ? (count / totalFields * 100).toFixed(1) : '0.0';
                return (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 0',
                    borderBottom: idx < 4 ? '1px solid var(--border)' : 'none'
                  }}>
                    {/* Rank */}
                    <span style={{ font: '11px Sora', color: 'var(--text-3)', width: '16px' }}>
                      #{idx + 1}
                    </span>
                    {/* Icon pill */}
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: bg, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', font: '13px', flexShrink: 0
                    }}>
                      {icon}
                    </div>
                    {/* Label + bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ font: '13px Sora', fontWeight: 500, color: 'var(--text-1)' }}>
                          {label}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ font: '11px Inter', color: 'var(--text-3)' }}>{pct}%</span>
                          <span style={{ font: '13px Sora', fontWeight: 700, color }}>
                            {count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {/* Bar */}
                      <div style={{
                        width: '100%', height: '5px', borderRadius: '3px',
                        background: 'var(--border)'
                      }}>
                        <div style={{
                          height: '100%', borderRadius: '3px',
                          background: color,
                          width: `${pct}%`,
                          transition: 'width 600ms ease-out'
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* View Usage Frequency Lollipop */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>View Popularity Distribution</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>How many explores reference each view</div>
          </div>
          
          {(() => {
            const cx = 110, cy = 110, r = 80, innerR = 48;
            const segments = viewUsageData.buckets.filter(b => b.count > 0);
            const total = segments.reduce((s, b) => s + b.count, 0);

            // Compute each segment's arc
            let cumulativeAngle = -90; // start from top
            const arcs = segments.map(bucket => {
              const angle = (bucket.count / total) * 360;
              const startAngle = cumulativeAngle;
              cumulativeAngle += angle;
              
              const toRad = deg => (deg * Math.PI) / 180;
              const x1 = cx + r * Math.cos(toRad(startAngle));
              const y1 = cy + r * Math.sin(toRad(startAngle));
              const x2 = cx + r * Math.cos(toRad(startAngle + angle));
              const y2 = cy + r * Math.sin(toRad(startAngle + angle));
              const xi1 = cx + innerR * Math.cos(toRad(startAngle));
              const yi1 = cy + innerR * Math.sin(toRad(startAngle));
              const xi2 = cx + innerR * Math.cos(toRad(startAngle + angle));
              const yi2 = cy + innerR * Math.sin(toRad(startAngle + angle));
              const largeArc = angle > 180 ? 1 : 0;

              // Label position — midpoint of arc
              const midAngle = startAngle + angle / 2;
              const labelR = r + 20;
              const lx = cx + labelR * Math.cos(toRad(midAngle));
              const ly = cy + labelR * Math.sin(toRad(midAngle));

              return {
                ...bucket,
                path: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi1} ${yi1} Z`,
                pct: ((bucket.count / total) * 100).toFixed(1),
                lx, ly, midAngle
              };
            });

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>

                  {/* Donut SVG */}
                  <svg width="220" height="220" viewBox="0 0 220 220" style={{ flexShrink: 0 }}>
                    {arcs.map((arc, idx) => (
                      <path
                        key={idx}
                        d={arc.path}
                        fill={arc.color}
                        stroke="white"
                        strokeWidth="2"
                        style={{
                          cursor: 'pointer',
                          transition: 'opacity 150ms, transform 150ms',
                          transformOrigin: `${cx}px ${cy}px`
                        }}
                        opacity={hoveredBucket?.label === arc.label ? 1 : 0.82}
                        transform={hoveredBucket?.label === arc.label ? 'scale(1.04)' : 'scale(1)'}
                        onMouseEnter={e => {
                          setHoveredBucket(arc);
                          setTooltipPos({ x: e.clientX + 12, y: e.clientY - 10 });
                        }}
                        onMouseMove={e => setTooltipPos({ x: e.clientX + 12, y: e.clientY - 10 })}
                        onMouseLeave={() => setHoveredBucket(null)}
                      />
                    ))}

                    {/* Center text */}
                    <text x={cx} y={cy - 8} textAnchor="middle"
                      style={{ font: 'bold 22px Sora', fill: 'var(--text-1)' }}>
                      {total}
                    </text>
                    <text x={cx} y={cy + 12} textAnchor="middle"
                      style={{ font: '11px Inter', fill: 'var(--text-2)' }}>
                      views
                    </text>
                  </svg>

                  {/* Legend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    {arcs.map((arc, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '6px 8px', borderRadius: '8px', cursor: 'pointer',
                          background: hoveredBucket?.label === arc.label ? '#F5F3FF' : 'transparent',
                          transition: '120ms'
                        }}
                        onMouseEnter={e => {
                          setHoveredBucket(arc);
                          setTooltipPos({ x: e.clientX + 12, y: e.clientY - 10 });
                        }}
                        onMouseLeave={() => setHoveredBucket(null)}
                      >
                        {/* Color dot */}
                        <div style={{
                          width: '10px', height: '10px', borderRadius: '3px',
                          background: arc.color, flexShrink: 0
                        }} />
                        {/* Label */}
                        <span style={{ font: '12px Sora', color: 'var(--text-1)', flex: 1,
                          fontWeight: hoveredBucket?.label === arc.label ? 600 : 400
                        }}>
                          {arc.label.replace('\n', ' ')}
                        </span>
                        {/* Count + pct */}
                        <span style={{ font: '12px Sora', fontWeight: 700, color: arc.textColor }}>
                          {arc.count}
                        </span>
                        <span style={{ font: '11px Inter', color: 'var(--text-3)', width: '36px', textAlign: 'right' }}>
                          {arc.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid var(--border)' }} />

                {/* Top shared views */}
                <div>
                  <div style={{ font: '10px Sora', fontWeight: 600, color: 'var(--text-2)',
                    letterSpacing: '0.08em', marginBottom: '8px' }}>
                    MOST SHARED VIEWS
                  </div>
                  {viewUsageData.topViews.map(([name, count], idx) => (
                    <div key={name} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '6px 0',
                      borderBottom: idx < 2 ? '1px solid var(--border)' : 'none'
                    }}>
                      <span style={{ font: '11px Sora', color: 'var(--text-3)', width: '16px' }}>
                        #{idx + 1}
                      </span>
                      <span style={{ font: '12px monospace', color: 'var(--text-1)', flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {name}
                      </span>
                      <span style={{
                        font: '11px Sora', fontWeight: 700, color: '#09A55A',
                        background: '#F0FDF4', border: '1px solid #BBF7D0',
                        borderRadius: '20px', padding: '2px 8px'
                      }}>
                        {count} explores
                      </span>
                    </div>
                  ))}
                </div>

                {/* Orphan callout */}
                {viewUsageData.buckets[0]?.count > 0 && (
                  <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    borderRadius: '8px', padding: '8px 12px',
                    font: '12px Inter', color: '#DC2626'
                  }}>
                    ⚠ {viewUsageData.buckets[0].count} orphaned views — never used in any explore
                  </div>
                )}

                {/* Tooltip */}
                {hoveredBucket && (
                  <div style={{
                    position: 'fixed', left: tooltipPos.x, top: tooltipPos.y,
                    zIndex: 100, background: '#1E1B4B', color: 'white',
                    borderRadius: '10px', padding: '10px 14px',
                    border: '1px solid rgba(99,91,255,0.4)',
                    boxShadow: '0 8px 24px rgba(99,91,255,0.25)',
                    pointerEvents: 'none', minWidth: '180px'
                  }}>
                    <div style={{ font: '13px Sora', fontWeight: 700, marginBottom: '6px' }}>
                      {hoveredBucket.label?.replace('\n', ' ')} explores
                    </div>
                    <div style={{ font: '12px Inter', color: 'rgba(255,255,255,0.7)' }}>
                      {hoveredBucket.count} views · {hoveredBucket.pct}% of total
                    </div>
                    {hoveredBucket.min === 0 && (
                      <div style={{ font: '11px Inter', color: '#F87171', marginTop: '6px' }}>
                        ⚠ Safe to remove — adds parse overhead
                      </div>
                    )}
                    {hoveredBucket.min >= 31 && (
                      <div style={{ font: '11px Inter', color: '#4ADE80', marginTop: '6px' }}>
                        ✓ Highly shared — treat as read-only
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })()}
        </div>

        {/* Metadata Coverage Grid */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>Metadata Coverage</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>Label and description completeness by field count</div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <CoverageBox data={metadataCov.both} label="Both label & description" bg="#F0FDF4" border="rgba(9,165,90,0.2)" color="var(--success)" check fScale={fScale} handleTooltip={handleTooltip} />
            <CoverageBox data={metadataCov.label} label="Label only" bg="#EFF6FF" border="rgba(37,99,235,0.2)" color="var(--info)" fScale={fScale} handleTooltip={handleTooltip} />
            <CoverageBox data={metadataCov.desc} label="Description only" bg="#FFFBEB" border="rgba(217,119,6,0.2)" color="var(--warning)" fScale={fScale} handleTooltip={handleTooltip} />
            <CoverageBox data={metadataCov.none} label="Neither (bare fields)" bg="#FEF2F2" border="rgba(220,38,38,0.2)" color="var(--error)" cross fScale={fScale} handleTooltip={handleTooltip} />
          </div>

          <div style={{ width: '100%', height: '8px', borderRadius: '4px', display: 'flex', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ width: `${metadataCov.both.pct}%`, background: 'var(--success)' }} />
            <div style={{ width: `${metadataCov.label.pct}%`, background: 'var(--info)' }} />
            <div style={{ width: `${metadataCov.desc.pct}%`, background: 'var(--warning)' }} />
            <div style={{ width: `${metadataCov.none.pct}%`, background: 'var(--error)' }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--warning)', fontStyle: 'italic' }}>
            Only {metadataCov.both.pct}% of fields are fully documented
          </div>
        </div>
      </div>

      {/* ── Row 3 ── */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
        
        {/* Derived Table Registry (50%) */}
        <div className="card" style={{ flex: '5', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>Derived Table Breakdown</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{pdtCount + ndtCount + nativeCount} derived tables detected</div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '28px', fontWeight: 700, color: 'var(--accent)', lineHeight: 1, marginBottom: '4px' }}>{pdtCount}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '2px' }}>PDT</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Persistent</div>
            </div>
            <div>
              <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '28px', fontWeight: 700, color: 'var(--warning)', lineHeight: 1, marginBottom: '4px' }}>{ndtCount}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '2px' }}>NDT</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Non-persistent</div>
            </div>
            <div>
              <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '28px', fontWeight: 700, color: 'var(--info)', lineHeight: 1, marginBottom: '4px' }}>{nativeCount}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '2px' }}>Native</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Native derived tables</div>
            </div>
          </div>

          <div style={{ width: '100%', height: '12px', borderRadius: '6px', display: 'flex', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ width: `${(pdtCount / Math.max(1, pdtCount+ndtCount+nativeCount)) * 100}%`, background: 'var(--accent)' }} />
            <div style={{ width: `${(ndtCount / Math.max(1, pdtCount+ndtCount+nativeCount)) * 100}%`, background: 'var(--warning)' }} />
            <div style={{ width: `${(nativeCount / Math.max(1, pdtCount+ndtCount+nativeCount)) * 100}%`, background: 'var(--info)' }} />
          </div>

          <div style={{ background: '#FFFBEB', border: '1px solid rgba(217,119,6,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--warning)', marginBottom: '16px' }}>
            {ndtCount} NDTs will rebuild on every query — consider converting high-traffic NDTs to PDTs
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '8px' }}>Top Complex Derived Tables</div>
            {dtList.map((dt, idx) => (
              <div key={dt.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < dtList.length -1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-3)' }}>·</span>
                  <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '12px', color: 'var(--text-1)' }}>{dt.name}</span>
                  <span style={{ background: dt.type === 'PDT' ? '#EEF2FF' : '#FFFBEB', color: dt.type === 'PDT' ? 'var(--accent)' : 'var(--warning)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, fontFamily: 'Sora, sans-serif' }}>{dt.type}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>~{dt.lines} lines SQL</div>
              </div>
            ))}
          </div>
        </div>

        {/* Explore → View Connections Arc Diagram (50%) */}
        <div className="card" style={{ flex: '5', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>Explore → View Connections</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>Line thickness = number of explores sharing that view</div>
          </div>
          
          <div style={{ flex: 1, position: 'relative' }}>
            <svg viewBox="0 0 600 500" width="100%" height="100%" style={{ overflow: 'visible' }}>
              {/* Arcs Layer */}
              <g>
                {matrixExplores.map((exp, expIndex) => {
                  return matrixViews.map((view, viewIndex) => {
                    const expObj = activeExplores.find(e => e.name === exp);
                    if (!expObj) return null;
                    const isJoined = expObj.base_view === view || (expObj.joins || []).some(j => j.resolved_view === view);
                    if (!isJoined) return null;

                    const isMatch = checkMatch(exp);
                    const startY = 40 + expIndex * 50;
                    const endY = 40 + viewIndex * 40;
                    const strokeWidth = Math.max(1, (viewUsageCount[view] || 1) / 20);
                    
                    const isExpHovered = arcHoverExplore === exp || arcClickExplore === exp;
                    const isViewHovered = arcHoverView === view;
                    const anyHoverActive = arcHoverExplore || arcClickExplore || arcHoverView;
                    
                    const isArcActive = isExpHovered || isViewHovered;
                    
                    // Arc color blending logic - default dim purple, highlight bright purple
                    let color = 'rgba(99,91,255,0.15)';
                    let opacity = anyHoverActive ? 0.05 : (isMatch ? 0.35 : 0.02);
                    let activeStrokeWidth = strokeWidth;

                    if (isArcActive) {
                      color = 'var(--accent)';
                      opacity = 1;
                      activeStrokeWidth += 2;
                    }

                    return (
                      <ArcPath 
                        key={`${exp}-${view}`} 
                        x1={145} y1={startY} x2={455} y2={endY} 
                        color={color} opacity={opacity} strokeWidth={activeStrokeWidth} 
                        delay={500 + (expIndex * 10 + viewIndex) * 30}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.stroke = 'var(--accent)';
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.strokeWidth = `${activeStrokeWidth + 2}`;
                          handleTooltip(e, (
                            <div>
                              <span style={{ fontFamily: "'Fira Code', monospace", color: '#A5B4FC' }}>{exp}</span> uses <span style={{ fontFamily: "'Fira Code', monospace", color: '#A5B4FC' }}>{view}</span>
                              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>Inner Join</div>
                            </div>
                          ));
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.stroke = color;
                          e.currentTarget.style.opacity = opacity;
                          e.currentTarget.style.strokeWidth = `${activeStrokeWidth}`;
                          handleTooltip(null, null);
                        }}
                      />
                    );
                  });
                })}
              </g>

              {/* Explores Column (Left) */}
              <g>
                {matrixExplores.map((exp, i) => {
                  const y = 40 + i * 50;
                  const isHovered = arcHoverExplore === exp || arcClickExplore === exp;
                  const isMatch = checkMatch(exp);
                  return (
                    <NodeRect 
                      key={exp} x={15} y={y - 14} w={130} h={28} rx={14}
                      label={exp} isHovered={isHovered} isLeft={true} isDimmed={!isMatch}
                      delay={300 + i*40}
                      onMouseEnter={(e) => {
                        setArcHoverExplore(exp);
                        handleTooltip(e, (
                          <div>
                            <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, marginBottom: '4px' }}>{exp}</div>
                            <div>Multiple views joined</div>
                          </div>
                        ));
                      }}
                      onMouseLeave={() => { setArcHoverExplore(null); handleTooltip(null, null); }}
                      onClick={() => setArcClickExplore(p => p === exp ? null : exp)}
                    />
                  );
                })}
              </g>

              {/* Views Column (Right) */}
              <g>
                {matrixViews.map((view, i) => {
                  const y = 40 + i * 40;
                  const isHovered = arcHoverView === view;
                  return (
                    <NodeRect 
                      key={view} x={455} y={y - 14} w={130} h={28} rx={14}
                      label={view} isHovered={isHovered} isLeft={false}
                      delay={400 + i*40}
                      onMouseEnter={(e) => {
                        setArcHoverView(view);
                        handleTooltip(e, (
                          <div>
                            <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, marginBottom: '4px' }}>{view}</div>
                            <div>Used in {viewUsageCount[view]} explores</div>
                            {viewUsageCount[view] > 50 && <div style={{ fontSize: '11px', color: 'var(--error)', marginTop: '4px' }}>High blast radius view</div>}
                          </div>
                        ));
                      }}
                      onMouseLeave={() => { setArcHoverView(null); handleTooltip(null, null); }}
                    />
                  );
                })}
              </g>
            </svg>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>Most connected view: <span style={{fontFamily: "'Fira Code', monospace", color: 'var(--text-1)'}}>np_date_dim</span> — appears in 169 explores</div>
            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>Most complex explore: <span style={{fontFamily: "'Fira Code', monospace", color: 'var(--text-1)'}}>np_margin_header</span> — joins 118 views</div>
          </div>
          
          <div style={{ background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)', border: '1px solid rgba(99,91,255,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--text-1)', fontFamily: 'Sora, sans-serif' }}>
            💡 <span style={{fontFamily: "'Fira Code', monospace", color: 'var(--accent)'}}>np_date_dim</span> is your most shared view — any changes to it will affect 169 explores. Treat it as read-only.
          </div>
        </div>
      </div>

    </div>
  );
}

// ── SVG Helpers ──

function ExploreBubble({ cx, cy, r, fill, stroke, name, joins, tier, match, delay, handleTooltip }) {
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setScale(1), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <circle 
      cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth="2" 
      style={{ transform: `scale(${scale})`, transformOrigin: `${cx}px ${cy}px`, transition: 'transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms, stroke-width 150ms', opacity: match ? 1 : 0.15, cursor: 'pointer' }}
      onMouseEnter={(e) => {
        e.target.style.strokeWidth = '4';
        handleTooltip(e, (
          <div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, marginBottom: '4px' }}>{name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: '20px' }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>{joins} joins</span>
              <span style={{ color: stroke, fontWeight: 600 }}>{tier}</span>
            </div>
            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '4px 0 8px' }} />
            {joins > 30 && <div style={{ color: '#FCA5A5', fontSize: '12px', marginBottom: '4px' }}>⚠ High join count may impact query performance</div>}
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Top joined views: np_date_dim, np_order_header</div>
          </div>
        ));
      }} 
      onMouseLeave={(e) => { e.target.style.strokeWidth = '2'; handleTooltip(null, null); }}
    />
  );
}

function HistogramBar({ x, y, w, h, fill, delay }) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setHeight(h), delay);
    return () => clearTimeout(t);
  }, [h, delay]);

  return (
    <rect x={x} y={210 - height} width={w} height={height} fill={fill} rx="3" style={{ transition: 'height 500ms ease-out, y 500ms ease-out' }} />
  );
}

function DonutSegment({ r, dash, offset, c, ft, fScale, delay, handleTooltip }) {
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(dash), delay);
    return () => clearTimeout(t);
  }, [dash, delay]);

  return (
    <circle 
      cx="80" cy="80" r={r} fill="none" stroke={ft.color} strokeWidth="20" strokeDasharray={`${drawn} ${c}`} strokeDashoffset={offset} 
      style={{ transition: 'stroke-dasharray 600ms ease-out, stroke-width 150ms', cursor: 'pointer' }} 
      onMouseEnter={(e) => {
        e.target.style.strokeWidth = '24';
        handleTooltip(e, (
          <div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, marginBottom: '4px' }}>{ft.name}</div>
            <div style={{ marginBottom: '8px' }}>{Math.round(ft.count * fScale).toLocaleString()} fields — {ft.pct}% of total</div>
            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '4px 0 8px' }} />
            <div style={{ fontSize: '11px', color: '#A5B4FC' }}>{ft.tip}</div>
          </div>
        ));
      }}
      onMouseLeave={(e) => {
        e.target.style.strokeWidth = '20';
        handleTooltip(null, null);
      }}
    />
  );
}

function Lollipop({ x, y, count, vu, dashed, delay, handleTooltip }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(x), delay);
    return () => clearTimeout(t);
  }, [x, delay]);

  return (
    <g 
      style={{ cursor: 'pointer' }}
      onMouseEnter={(e) => {
        handleTooltip(e, (
          <div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, marginBottom: '4px' }}>{vu.label}</div>
            <div style={{ marginBottom: '8px' }}>{count} views</div>
            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '4px 0 8px' }} />
            <div style={{ fontSize: '11px', color: '#A5B4FC' }}>{vu.tip}</div>
          </div>
        ));
      }}
      onMouseLeave={() => handleTooltip(null, null)}
    >
      <text x="0" y={y} dominantBaseline="middle" fontSize="13" fontFamily="Sora, sans-serif" fill="var(--text-1)">{vu.label}</text>
      <line x1="130" y1={y} x2={Math.max(130, w)} y2={y} stroke={vu.color} strokeWidth="2" strokeDasharray={dashed ? "4 4" : "none"} style={{ transition: 'x2 400ms ease-out' }} />
      <circle cx={Math.max(130, w)} cy={y} r="10" fill={vu.color} style={{ transition: 'cx 400ms ease-out' }} />
      <text x={Math.max(130, w)} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="700" fontFamily="Sora, sans-serif" fill="white" style={{ transition: 'x 400ms ease-out' }}>{count}</text>
    </g>
  );
}

function CoverageBox({ label, data, bg, border, color, check, cross, fScale, handleTooltip }) {
  const count = Math.round(data.count * fScale);
  return (
    <div 
      style={{ background: bg, border: `1px solid ${border}`, borderRadius: '8px', padding: '16px', cursor: 'pointer', transition: 'all 150ms ease' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
        handleTooltip(e, (
          <div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, marginBottom: '4px' }}>{label}</div>
            <div style={{ marginBottom: '8px' }}>{count.toLocaleString()} fields — {data.pct}%</div>
            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '4px 0 8px' }} />
            <div style={{ fontSize: '11px', color: '#A5B4FC' }}>{data.tip}</div>
          </div>
        ));
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = border;
        e.currentTarget.style.boxShadow = 'none';
        handleTooltip(null, null);
      }}
    >
      <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: 700, color, marginBottom: '2px' }}>
        {count.toLocaleString()} fields
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>
        {data.pct}% {check && '✓'} {cross && '✗'}
      </div>
    </div>
  );
}

// Arc Diagram Helpers

function ArcPath({ x1, y1, x2, y2, color, opacity, strokeWidth, delay, onMouseEnter, onMouseLeave }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const cx1 = 250;
  const cy1 = y1;
  const cx2 = 350;
  const cy2 = y2;
  const pathData = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

  // Use a long dash array to animate drawing
  const length = 500; 

  return (
    <path 
      d={pathData} fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeDasharray={length} strokeDashoffset={drawn ? 0 : length}
      style={{ opacity, transition: 'stroke-dashoffset 800ms cubic-bezier(0.4, 0, 0.2, 1), stroke 200ms, opacity 400ms ease, stroke-width 200ms', cursor: 'pointer' }}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
    />
  );
}

function NodeRect({ x, y, w, h, rx, label, isLeft, isHovered, isDimmed, delay, onMouseEnter, onMouseLeave, onClick }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const fill = isLeft ? 'rgba(99,91,255,0.1)' : 'rgba(9,165,90,0.08)';
  const stroke = isLeft ? 'var(--accent)' : 'var(--success)';
  const activeStrokeWidth = isHovered ? 2.5 : 1.5;
  const activeFill = isHovered ? (isLeft ? 'rgba(99,91,255,0.2)' : 'rgba(9,165,90,0.15)') : fill;
  const finalOpacity = show ? (isDimmed ? 0.1 : 1) : 0;

  return (
    <g 
      style={{ opacity: finalOpacity, transition: 'opacity 400ms ease', cursor: 'pointer' }} 
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}
    >
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={activeFill} stroke={stroke} strokeWidth={activeStrokeWidth} style={{ transition: 'all 200ms ease' }} />
      <text x={x + w/2} y={y + h/2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontFamily="Sora, sans-serif" fontWeight="600" fill={stroke}>
        {label}
      </text>
    </g>
  );
}
