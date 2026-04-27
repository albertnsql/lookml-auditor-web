import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RULES } from '../../data/rules';

const gridCols = '84px 140px 140px 1fr 130px 48px';

export default function IssuesTab({ auditData, isLoading, externalFilters, onFilterChange, onOpenInFileViewer }) {
  const { issues } = auditData;

  const filters = externalFilters;
  const setFilters = onFilterChange;

  const [selectedFile, setSelectedFile] = useState(null);

  // Sync selectedFile with filters.file
  useEffect(() => {
    if (selectedFile !== filters.file) {
      setFilters(f => ({ ...f, file: selectedFile }));
    }
  }, [selectedFile, filters.file, setFilters]);

  // ── Insight Computations ──
  const quickWins = useMemo(() => {
    const noLabel = auditData.issues.filter(i =>
      i.category === 'Field Quality' &&
      i.message?.toLowerCase().includes('label')
    );
    const noDesc = auditData.issues.filter(i =>
      i.category === 'Field Quality' &&
      i.message?.toLowerCase().includes('description')
    );
    return {
      total: noLabel.length + noDesc.length,
      noLabel: noLabel.length,
      noDesc: noDesc.length,
      percentAffected: auditData.views.reduce((s,v) => s + v.n_fields, 0)
        ? ((noLabel.length + noDesc.length) / auditData.views.reduce((s,v) => s + v.n_fields, 0) * 100).toFixed(0)
        : 0
    };
  }, [auditData]);

  const blastRadius = useMemo(() => {
    const brokenRefs = auditData.issues.filter(i => i.category === 'Broken Reference');
    const joinIssues = auditData.issues.filter(i => i.category === 'Join Integrity');
    const affectedExplores = [...new Set([
      ...brokenRefs.map(i => i.explore || i.object_name),
      ...joinIssues.map(i => i.explore || i.object_name),
    ])].filter(Boolean);
    return {
      count: affectedExplores.length,
      explores: affectedExplores,
      hasCritical: brokenRefs.length > 0,
    };
  }, [auditData]);

  const deadCode = useMemo(() => {
    // Assuming summary logic here or derived from auditData
    const allRefs = new Set(auditData.explores.flatMap(e => [e.base_view, ...e.joins.map(j => j.resolved_view)]));
    const orphanViews = auditData.views.filter(v => !allRefs.has(v.name));
    return { count: orphanViews.length, views: orphanViews.map(v => v.name) };
  }, [auditData]);

  const heatmapFiles = useMemo(() => {
    const fileMap = {};
    auditData.issues.forEach(issue => {
      const file = (issue.source_file || '').split(/[/\\]/).pop() || 'unknown';
      if (!fileMap[file]) {
        fileMap[file] = {
          name: file, path: issue.source_file, count: 0,
          errs: 0, wrns: 0, infs: 0
        };
      }
      fileMap[file].count++;
      if (issue.severity === 'error')   fileMap[file].errs++;
      if (issue.severity === 'warning') fileMap[file].wrns++;
      if (issue.severity === 'info')    fileMap[file].infs++;
    });
    
    // Add views with 0 issues so they show up in heatmap (if space permits)
    auditData.views.forEach(v => {
      const file = (v.source_file || '').split(/[/\\]/).pop() || 'unknown';
      if (!fileMap[file]) {
        fileMap[file] = { name: file, path: v.source_file, count: 0, errs: 0, wrns: 0, infs: 0 };
      }
    });

      // Sort by issue count descending and take top 20
      return Object.values(fileMap)
        .sort((a,b) => b.count - a.count)
        .slice(0, 20);
  }, [auditData]);

  const violationRules = useMemo(() => {
    const ruleMap = {};
    auditData.issues.forEach(issue => {
      const rule = issue.category || 'unknown';
      if (!ruleMap[rule]) {
        ruleMap[rule] = { 
          name: rule, 
          category: rule,
          count: 0, 
          sev: issue.severity, 
          exampleMessage: issue.message 
        };
      }
      ruleMap[rule].count++;
    });
    return Object.values(ruleMap)
      .sort((a,b) => b.count - a.count)
      .slice(0, 5)
      .map((r, i) => ({ ...r, rank: i + 1, fixMinutes: 5 }));
  }, [auditData]);

  const totalFixHours = useMemo(() => {
    const totalMins = violationRules.reduce((sum, r) => sum + (r.count * r.fixMinutes), 0);
    return (totalMins / 60).toFixed(1);
  }, [violationRules]);

  const filteredIssues = useMemo(() => {
    let issues = auditData.issues ?? [];
    if (filters.severity?.length && !filters.severity.includes('all')) {
      issues = issues.filter(i => filters.severity.includes(i.severity));
    }
    if (filters.category && filters.category !== 'all') {
      issues = issues.filter(i => i.category === filters.category);
    }
    if (filters.file) {
      issues = issues.filter(i => {
        const iFile = (i.source_file || '').split(/[/\\]/).pop();
        return iFile === filters.file || i.source_file === filters.file;
      });
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      issues = issues.filter(i =>
        (i.object_name || '').toLowerCase().includes(q) ||
        (i.message || '').toLowerCase().includes(q) ||
        (i.source_file || '').toLowerCase().includes(q)
      );
    }
    return issues;
  }, [auditData, filters]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '400px', gap: '16px'
      }}>
        <div style={{
          width: '32px', height: '32px',
          border: '3px solid var(--border)',
          borderTop: '3px solid var(--accent)',
          borderRadius: '50%',
          animation: 'spin 700ms linear infinite'
        }} />
        <p style={{ font: '14px Sora', color: 'var(--text-2)' }}>
          Running audit...
        </p>
      </div>
    );
  }

  const cleanFilesCnt = heatmapFiles.filter(f => f.count === 0).length;
  const attentionFilesCnt = heatmapFiles.filter(f => f.count > 0).length;
  const maxRuleCount = Math.max(...violationRules.map(r => r.count), 1);

  const toggleSev = (type) => {
    setFilters(f => {
      const newSev = f.severity.includes(type)
        ? f.severity.filter(s => s !== type)
        : [...f.severity, type];
      return { ...f, severity: newSev };
    });
  };

  const filteredGroups = useMemo(() => groupBy(filteredIssues, i => (i.source_file || 'unknown').split(/[/\\]/).pop()), [filteredIssues]);
  const sortedFilesKeys = useMemo(() => Object.keys(filteredGroups).sort((a,b) => filteredGroups[b].length - filteredGroups[a].length), [filteredGroups]);

  const [collapsedGroups, setCollapsedGroups] = useState({});
  const toggleGroup = (file) => setCollapsedGroups(prev => ({ ...prev, [file]: !prev[file] }));

  const [expandedId, setExpandedId] = useState(null);

  const sortOrder = { error: 0, warning: 1, info: 2 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeSlideUp 400ms ease-out 200ms both', maxWidth: '100%', overflowX: 'hidden' }}>
      
      {/* ── Filter Banner ── */}
      {(filters.severity.length < 3 || filters.category !== 'all' || filters.search) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#EEF2FF', border: '1px solid rgba(99,91,255,0.2)',
          borderRadius: '8px', padding: '10px 16px', marginBottom: '0px'
        }}>
          <span style={{ font: '13px Sora', fontWeight: 600, color: '#635BFF' }}>
            Filtered by: {
              filters.severity.length < 3 ? `${filters.severity.join(', ')} severity` : 
              filters.category !== 'all' ? `category: ${filters.category}` :
              filters.search ? `search: "${filters.search}"` : 'active filters'
            }
          </span>
          <button
            onClick={() => setFilters({
              severity: ['error', 'warning', 'info'],
              category: 'all',
              file: null,
              search: ''
            })}
            style={{ background: 'none', border: 'none', color: '#635BFF', cursor: 'pointer', font: '12px Sora', fontWeight: 600 }}
          >
            Clear all filters ✕
          </button>
        </div>
      )}

      {/* ── Section 1: Three Actionable Insight Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Quick Wins */}
        <div style={{
          minHeight: '150px', background: '#FFFFFF', borderRadius: '12px', padding: '14px 18px',
          border: '1px solid #E2DFF5', borderLeft: '4px solid #635BFF',
          display: 'flex', flexDirection: 'column', transition: '150ms ease', position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#635BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Quick Wins
            </span>
            <span style={{ marginLeft: 'auto', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#9CA3AF' }}>
              Fix in &lt; 5 min
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '40px', fontWeight: 700, color: '#635BFF', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {quickWins.total}
            </span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', color: '#6B7280', marginLeft: '8px' }}>
              metadata gaps
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '8px', marginBottom: '10px' }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#6B7280' }}>· {quickWins.noLabel} missing labels</div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#6B7280' }}>· {quickWins.noDesc} missing descriptions</div>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <div style={{ height: '4px', background: '#E2DFF5', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${quickWins.percentAffected}%`, background: '#635BFF', borderRadius: '2px' }} />
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#9CA3AF', marginTop: '8px', marginBottom: '16px' }}>
              {quickWins.percentAffected}% of all dimensions affected
            </div>
            <button 
              onClick={() => document.getElementById('issues-table')?.scrollIntoView({ behavior: 'smooth' })}
              style={{
              background: 'rgba(99,91,255,0.08)', color: '#635BFF', border: '1px solid rgba(99,91,255,0.2)',
              borderRadius: '8px', padding: '8px 16px', fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', transition: '150ms ease'
            }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,91,255,0.14)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,91,255,0.08)'}>
              Show quick fixes available →
            </button>
          </div>
        </div>

        {/* Card 2: Blast Radius */}
        <div style={{
          minHeight: '150px', background: '#FFFFFF', borderRadius: '12px', padding: '14px 18px',
          border: '1px solid #E2DFF5', borderLeft: '4px solid #DC2626',
          display: 'flex', flexDirection: 'column', transition: '150ms ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>
            </svg>
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Blast Radius
            </span>
            <span style={{ marginLeft: 'auto', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#9CA3AF' }}>
              Affected Explores
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '40px', fontWeight: 700, color: '#DC2626', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {blastRadius.count}
            </span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', color: '#6B7280', marginLeft: '8px' }}>
              explores at risk
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px', marginBottom: '10px' }}>
            {blastRadius.explores.slice(0, 2).map((e, i) => (
              <div key={e} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(226,223,245,0.4)' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#1E1B4B', fontWeight: 500 }}>{e}</span>
                <span style={{
                  background: i === 0 && blastRadius.hasCritical ? '#FEF2F2' : '#FFFBEB',
                  color: i === 0 && blastRadius.hasCritical ? '#DC2626' : '#D97706',
                  border: `1px solid ${i === 0 && blastRadius.hasCritical ? '#FECACA' : '#FDE68A'}`,
                  padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, fontFamily: 'Sora, sans-serif'
                }}>
                  {i === 0 && blastRadius.hasCritical ? 'ERROR' : 'WARNING'}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 'auto', background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#DC2626' }}>
              {blastRadius.hasCritical ? 'Critical failures detected in explores' : 'Major degradation likely in core models'}
            </span>
          </div>
        </div>

        {/* Card 3: Dead Code */}
        <div style={{
          minHeight: '150px', background: '#FFFFFF', borderRadius: '12px', padding: '14px 18px',
          border: '1px solid #E2DFF5', borderLeft: '4px solid #09A55A',
          display: 'flex', flexDirection: 'column', transition: '150ms ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#09A55A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
            </svg>
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Dead Code
            </span>
            <span style={{ marginLeft: 'auto', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#9CA3AF' }}>
              Safe Deletions
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '40px', fontWeight: 700, color: '#09A55A', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {deadCode.count}
            </span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', color: '#6B7280', marginLeft: '8px' }}>
              views to prune
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', marginBottom: '10px' }}>
            {deadCode.views.slice(0, 3).map(v => (
              <span key={v} style={{
                fontFamily: 'Inter, sans-serif', fontSize: '12px', background: '#F3F4F6',
                border: '1px solid #E2DFF5', borderRadius: '6px', padding: '3px 8px', color: '#1E1B4B'
              }}>
                {v}
              </span>
            ))}
            {deadCode.views.length > 3 && (
              <span style={{
                fontFamily: 'Inter, sans-serif', fontSize: '12px', background: 'rgba(99,91,255,0.08)',
                color: '#635BFF', border: '1px solid rgba(99,91,255,0.2)', borderRadius: '6px', padding: '3px 8px'
              }}>
                +{deadCode.views.length - 3} more
              </span>
            )}
          </div>

          <div style={{
            marginTop: 'auto', background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#09A55A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#09A55A' }}>
              Removing these will reduce project parse time
            </span>
          </div>
        </div>
      </div>

      {/* ── Section 2: Two Visualizations ── */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flexWrap: 'wrap' }}>
        
        {/* Left: Issue Density Heatmap by View (60%) */}
        <div className="card" style={{ flex: '1 1 600px', padding: '24px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>Top 20 Issue Density Views</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Click a file to filter table</div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', background: 'var(--bg)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              {cleanFilesCnt} clean · {attentionFilesCnt} total files
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legend</span>
              <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>0</span>
              <div style={{ width: '120px', height: '4px', borderRadius: '2px', background: 'linear-gradient(to right, #F0FDF4, #FEF9C3, #FED7AA, #FECACA, #FCA5A5)' }} />
              <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>13+ issues</span>
            </div>
          </div>
          
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '10px', alignContent: 'start', width: '100%', overflow: 'hidden' }}>
            {heatmapFiles.map(f => (
              <HeatmapCell 
                key={f.name} 
                file={f} 
                selected={selectedFile === f.name}
                onClick={() => setSelectedFile(f.name)} 
              />
            ))}
          </div>
        </div>

        {/* Right: Top Violation Rules (40%) */}
        <TopViolationRules rules={violationRules} totalFixHours={totalFixHours} />
      </div>

      {/* ── Section 3: Redesigned Table Grouped by File ── */}
      <div id="issues-table">
        
        {/* Filter Toolbar */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <SevPill type="error"   active={filters.severity.includes('error')}   onClick={() => toggleSev('error')} />
            <SevPill type="warning" active={filters.severity.includes('warning')} onClick={() => toggleSev('warning')} />
            <SevPill type="info"    active={filters.severity.includes('info')}    onClick={() => toggleSev('info')} />
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

          <select 
            value={filters.category} 
            onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
            style={{ 
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', 
              padding: '6px 12px', paddingRight: '32px', font: '13px Sora, sans-serif', color: 'var(--text-1)', 
              appearance: 'none', 
              backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="%2364748B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>')`, 
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
              cursor: 'pointer', outline: 'none'
            }}
          >
            <option value="all">All Categories</option>
            <option value="Broken Reference">Broken Reference</option>
            <option value="Duplicate Definition">Duplicate Definition</option>
            <option value="Join Integrity">Join Integrity</option>
            <option value="Field Quality">Field Quality</option>
          </select>

          {selectedFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99,91,255,0.1)', color: 'var(--accent)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontFamily: 'Sora, sans-serif', fontWeight: 600 }}>
              Showing: {selectedFile}
              <button 
                onClick={() => setSelectedFile(null)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0', marginLeft: '4px', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>
          )}

          <div style={{ flex: 1, minWidth: '200px', maxWidth: '400px', position: 'relative', marginLeft: selectedFile ? '0' : 'auto' }}>
            <input 
              type="text" placeholder="Search objects, files, or messages..." 
              value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              style={{ 
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', 
                padding: '8px 12px', font: '13px Inter, sans-serif', color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box',
                transition: 'all 150ms ease'
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,91,255,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: selectedFile ? 'auto' : '0' }}>
            <span style={{ fontSize: '13px', fontFamily: 'Sora, sans-serif', color: 'var(--text-2)' }}>{filteredIssues.length} issues</span>
            <button 
              style={{ 
                background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 14px', 
                fontSize: '13px', fontFamily: 'Sora, sans-serif', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Card Table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflowX: 'auto' }}>
          <div style={{ minWidth: '850px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '10px 20px', fontSize: '11px', fontFamily: 'Sora, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', fontWeight: 600 }}>
              <div>Severity</div><div>Category</div><div>Object</div><div>Message</div><div>File</div><div>Line</div>
            </div>

          {filteredIssues.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: '14px', fontFamily: 'Sora, sans-serif' }}>
              No issues match the current filters.
            </div>
          ) : (
            <div>
              {sortedFilesKeys.map(filename => {
                const groupIssues = filteredGroups[filename] || [];
                if (groupIssues.length === 0) return null;
                const isCollapsed = collapsedGroups[filename];
                
                const sortedGroup = [...groupIssues].sort((a,b) => sortOrder[a.severity] - sortOrder[b.severity]);

                return (
                  <div key={filename}>
                    <div 
                      onClick={() => toggleGroup(filename)}
                      style={{ 
                        background: 'var(--bg)', padding: '10px 20px', borderTop: '2px solid var(--border)', borderBottom: '1px solid var(--border)', 
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '13px', color: 'var(--text-1)', fontWeight: 600 }}>{filename}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ background: '#F5F3FF', color: 'var(--accent)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, fontFamily: 'Sora, sans-serif' }}>{groupIssues.length} issues</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)', transition: 'transform 250ms ease', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}>
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </div>
                    </div>
                    
                      <div style={{ maxHeight: isCollapsed ? '0px' : '5000px', overflow: 'hidden', transition: 'max-height 250ms ease' }}>
                        {sortedGroup.map((issue, idx) => (
                          <IssueRow 
                            key={issue.id || `${filename}-${idx}`} 
                            issue={issue} 
                            isAlt={idx % 2 === 1}
                            isExpanded={expandedId === (issue.id || `${filename}-${idx}`)}
                            onToggle={() => setExpandedId(expandedId === (issue.id || `${filename}-${idx}`) ? null : (issue.id || `${filename}-${idx}`))}
                            onOpenInFileViewer={onOpenInFileViewer}
                          />
                        ))}
                      </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .insight-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          transition: all 150ms ease;
        }
        .insight-card:hover {
          border-color: rgba(99,91,255,0.3);
          box-shadow: 0 4px 16px rgba(99,91,255,0.08);
        }
        .rule-row:hover {
          background: #F8F7FF;
          border-radius: 8px;
          padding: 12px 8px !important;
          margin: 0 -8px;
          border-color: transparent !important;
        }
      `}} />
    </div>
  );
}

// ── Components ──────────────────────────────────────────────

function getHeatColor(count) {
  if (count === 0) return '#F0FDF4';
  if (count <= 3) return '#FEF9C3';
  if (count <= 7) return '#FED7AA';
  if (count <= 12) return '#FECACA';
  return '#FFD1D1';
}

function HeatmapCell({ file, selected, onClick }) {
  const [hovered, setHovered] = useState(false);
  
  const bgColor = getHeatColor(file.count);
  const textColor = file.count === 0 ? 'var(--success)' : file.errs > 0 ? 'var(--error)' : file.wrns > 0 ? 'var(--warning)' : 'var(--info)';
  
  const dots = [];
  for(let i=0; i<Math.min(file.errs, 5); i++) dots.push('var(--error)');
  for(let i=0; i<Math.min(file.wrns, 5); i++) dots.push('var(--warning)');
  for(let i=0; i<Math.min(file.infs, 5); i++) dots.push('var(--info)');

  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: bgColor,
        borderRadius: '10px',
        padding: '12px',
        border: selected ? '2px solid var(--accent)' : hovered ? '1px solid var(--accent)' : '1px solid var(--border)',
        boxShadow: hovered ? '0 4px 16px rgba(99,91,255,0.12)' : 'none',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 150ms ease',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: '8px',
        position: 'relative', minHeight: '80px'
      }}
    >
      <div style={{ fontFamily: "'Fira Code', monospace", fontSize: '11px', color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {file.name}
      </div>
      <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', fontWeight: 700, color: textColor }}>
        {file.count}
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: 'auto', flexWrap: 'wrap', height: '14px', overflow: 'hidden' }}>
        {dots.map((color, i) => (
          <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
        ))}
        {file.count > dots.length && <span style={{ fontSize: '9px', color: 'var(--text-3)', lineHeight: '6px', marginLeft: '2px' }}>+</span>}
      </div>

      {hovered && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
          background: '#1E1B4B', color: '#fff', padding: '8px 12px', borderRadius: '8px',
          fontSize: '11px', fontFamily: 'Inter, sans-serif', width: 'max-content', zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', pointerEvents: 'none'
        }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', fontFamily: "'Fira Code', monospace" }}>{file.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)' }}>{file.errs} errors · {file.wrns} warnings · {file.infs} info</div>
        </div>
      )}
    </div>
  );
}

function TopViolationRules({ rules, totalFixHours }) {
  const maxCount = Math.max(...rules.map(r => r.count), 1);

  return (
    <div style={{
      flex: '1 1 400px', background: '#FFFFFF', borderRadius: '12px', padding: '20px 24px',
      border: '1px solid #E2DFF5', display: 'flex', flexDirection: 'column', minWidth: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Top Violation Rules
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#9CA3AF' }}>
          Most frequently triggered
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {rules.map((rule, idx) => (
          <React.Fragment key={rule.name}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', color: '#9CA3AF', width: '20px', fontVariantNumeric: 'tabular-nums' }}>
                  #{rule.rank}
                </span>
                <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: 600, color: '#1E1B4B' }}>
                  {rule.name}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: getRuleColor(rule.category) }}>
                    {rule.count.toLocaleString()}
                  </span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#9CA3AF', marginLeft: '8px' }}>
                    ~{rule.fixMinutes} min each
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '6px', marginLeft: '28px' }}>
                <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '3px', width: '100%', position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: getRuleColor(rule.category), borderRadius: '3px',
                    width: `${(rule.count / maxCount) * 100}%`, transition: 'width 400ms ease'
                  }} />
                </div>
              </div>

              <div style={{ marginTop: '4px', marginLeft: '28px', position: 'relative' }}>
                <RuleDescription text={rule.exampleMessage} />
              </div>
            </div>
            {idx < rules.length - 1 && (
              <div style={{ borderBottom: '1px solid #F3F4F6', margin: '12px 0' }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #E2DFF5', paddingTop: '16px', marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '10px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Estimated Total Fix Time
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
              If fixed sequentially starting from #1
            </div>
          </div>
          <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '28px', fontWeight: 700, color: '#635BFF', fontVariantNumeric: 'tabular-nums' }}>
            ~{totalFixHours} hours
          </div>
        </div>
      </div>
    </div>
  );
}

function getRuleColor(cat) {
  const c = cat?.toLowerCase();
  if (c === 'field quality' || c === 'duplicate definition') return '#D97706';
  if (c === 'broken reference' || c === 'join integrity') return '#DC2626';
  if (c === 'orphan view') return '#2563EB';
  return '#6B7280';
}

function RuleDescription({ text }) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#9CA3AF',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: '100%', cursor: 'help'
      }}
    >
      {text}
      {hovered && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '0', marginBottom: '8px',
          background: '#1E1B4B', color: '#FFFFFF', padding: '8px 12px', borderRadius: '8px',
          fontSize: '12px', fontFamily: 'Inter, sans-serif', maxWidth: '280px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100,
          animation: 'fadeSlideUp 150ms ease-out', pointerEvents: 'none',
          whiteSpace: 'normal', wordBreak: 'break-word'
        }}>
          {text}
        </div>
      )}
    </div>
  );
}

function SevPill({ type, active, onClick }) {
  const isErr = type === 'error';
  const isWrn = type === 'warning';
  const bgCol  = isErr ? '#FEF2F2' : isWrn ? '#FFFBEB' : '#EFF6FF';
  const txtCol = isErr ? 'var(--error)' : isWrn ? 'var(--warning)' : 'var(--info)';
  
  return (
    <div 
      onClick={onClick}
      style={{
        border: `1px solid ${active ? txtCol : 'var(--border)'}`,
        background: active ? bgCol : 'transparent',
        color: active ? txtCol : 'var(--text-3)',
        borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontFamily: 'Sora, sans-serif', fontWeight: 600,
        cursor: 'pointer', transition: 'all 150ms ease', userSelect: 'none',
        textTransform: 'capitalize'
      }}
    >
      {type}
    </div>
  );
}

function IssueRow({ issue, isAlt, isExpanded, onToggle, onOpenInFileViewer }) {
  const [hovered, setHovered] = useState(false);

  const isErr = issue.severity === 'error';
  const isWrn = issue.severity === 'warning';
  
  const sevColor = isErr ? '#DC2626' : isWrn ? '#D97706' : '#2563EB';
  const badgeBg  = isErr ? '#FEF2F2' : isWrn ? '#FFFBEB' : '#EFF6FF';
  const badgeCol = sevColor;
  const badgeBdr = isErr ? '#FECACA' : isWrn ? '#FDE68A' : '#BFDBFE';

  const objName = getObjectName(issue);
  const fileName = (issue.source_file || '').split(/[/\\]/).pop() || 'unknown';
  const ruleMeta = getRuleMeta(issue);

  return (
    <>
      <div 
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ 
          display: 'grid', gridTemplateColumns: gridCols, gap: '16px', 
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          background: (isExpanded || hovered) ? '#F9F8FF' : isAlt ? 'rgba(99,91,255,0.01)' : 'transparent',
          borderLeft: isExpanded ? `4px solid ${sevColor}` : '4px solid transparent',
          transition: 'all 120ms ease', cursor: 'pointer',
          alignItems: 'start', position: 'relative'
        }}
      >
        <div>
          <span style={{ display: 'inline-block', background: badgeBg, color: badgeCol, border: `1px solid ${badgeBdr}`, borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontFamily: 'Sora, sans-serif', fontWeight: 600, borderLeft: `4px solid ${badgeCol}` }}>
            {issue.severity.toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-1)', fontFamily: 'Sora, sans-serif', fontWeight: 500 }}>
          {issue.category === 'Duplicate Def' ? 'Duplicate Definition' : issue.category}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--accent)', fontFamily: "'Fira Code', monospace", wordBreak: 'break-all' }}>
          {objName}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-1)', fontFamily: 'Inter, sans-serif', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {issue.message}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: "'Fira Code', monospace", wordBreak: 'break-all' }}>
          {fileName}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: "'Fira Code', monospace", display: 'flex', alignItems: 'center', gap: '4px' }}>
          {issue.line_number || '-'}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="{isExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"/></svg>
        </div>
      </div>
      
      {isExpanded && (
        <div style={{
          background: '#F9F8FF',
          borderLeft: `3px solid ${sevColor}`,
          borderBottom: '1px solid #E2DFF5',
          padding: '0 20px 20px 20px',
          animation: 'fadeSlideUp 150ms ease-out'
        }}>

          {/* Full message strip */}
          <div style={{
            padding: '12px 14px',
            background: badgeBg,
            border: `1px solid ${badgeBdr}`,
            borderRadius: '8px',
            margin: '12px 0 16px 0',
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'var(--text-1)'
          }}>
            <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, color: badgeCol, marginRight: '8px' }}>
              {issue.severity.toUpperCase()}
            </span>
            {issue.message}
          </div>

          {/* Two-column: suggestion (left) + metadata (right) */}
          <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>

            {/* Left: Suggestion text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {issue.suggestion ? (
                <>
                  <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '10px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', marginBottom: '8px' }}>SUGGESTION</div>
                  <div style={{
                    fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--text-1)',
                    lineHeight: 1.6, background: '#FFFFFF', border: '1px solid #E2DFF5',
                    borderRadius: '8px', padding: '12px 14px'
                  }}>
                    {issue.suggestion}
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic' }}>
                  No suggestion available for this issue.
                </div>
              )}
            </div>

            {/* Right: Rule, Line, Impact, File Viewer button */}
            <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Rule + Line badges */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'inline-flex', background: '#F3F4F6', border: '1px solid #E2DFF5', borderRadius: '6px', padding: '3px 10px', color: '#635BFF', fontFamily: "'Fira Code', monospace", fontSize: '11px', fontWeight: 600 }}>
                  {ruleMeta.id || issue.category?.toLowerCase().replace(/ /g, '_') || 'unknown_rule'}
                </div>
                {issue.line_number && (
                  <div style={{ background: 'rgba(99,91,255,0.08)', color: '#635BFF', border: '1px solid rgba(99,91,255,0.2)', borderRadius: '4px', padding: '3px 8px', fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 600 }}>
                    Line {issue.line_number}
                  </div>
                )}
              </div>

              {/* Impact */}
              <div>
                <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '10px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', marginBottom: '4px' }}>IMPACT</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: isErr ? '#DC2626' : isWrn ? '#D97706' : '#2563EB', lineHeight: 1.5, fontWeight: 500 }}>
                  {getImpactText(issue)}
                </div>
              </div>

              {/* Open in File Viewer button */}
              {onOpenInFileViewer && issue.source_file && (
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenInFileViewer(issue.source_file, issue.line_number); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    background: 'rgba(99,91,255,0.07)', border: '1px solid rgba(99,91,255,0.25)',
                    borderRadius: '8px', padding: '8px 14px',
                    fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600,
                    color: '#635BFF', cursor: 'pointer', transition: '150ms ease',
                    width: '100%', justifyContent: 'center'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,91,255,0.14)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,91,255,0.07)'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Open in File Viewer
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getRuleMeta(issue) {
  return RULES.find(r => r.category === issue.category && (issue.message?.includes(r.title) || issue.rule_id === r.id)) || 
         RULES.find(r => r.category === issue.category) || 
         {};
}

// Generates an issue-specific LookML fix snippet based on the issue's category and context
function getIssueFixSnippet(issue) {
  const obj = getObjectName(issue);
  const cat = (issue.category || '').toLowerCase();
  const file = (issue.source_file || '').split(/[/\\]/).pop().replace('.lkml', '') || 'my_view';

  // Use the rule's goodExample if it matches the specific issue context
  const ruleMeta = getRuleMeta(issue);
  if (ruleMeta.goodExample && ruleMeta.goodExample.trim() && !ruleMeta.goodExample.includes('customers.view')) {
    return ruleMeta.goodExample;
  }

  // Generate issue-specific snippets based on category
  if (cat.includes('duplicate')) {
    const field = issue.field || obj || 'my_field';
    return `# Remove or rename the duplicate definition\n# in ${file}.lkml\n\ndimension: ${field} {\n  # Keep only ONE definition of this field\n  # Remove the duplicate from the other view\n  sql: \${TABLE}.${field} ;;\n}`;
  }

  if (cat.includes('broken reference') || cat.includes('broken ref')) {
    const ref = issue.field || obj || 'missing_field';
    return `# Fix broken reference in ${file}.lkml\n\n# Option 1: Define the missing field\ndimension: ${ref} {\n  type: string\n  sql: \${TABLE}.${ref} ;;\n}\n\n# Option 2: Remove the reference that points to\n# this non-existent field`;
  }

  if (cat.includes('join integrity') || cat.includes('join')) {
    const explore = issue.explore || obj || 'my_explore';
    return `# Fix join integrity in ${explore}\n\nexplore: ${explore} {\n  join: ${obj} {\n    type: left_outer\n    sql_on: \${${explore}.id} = \${${obj}.${explore}_id} ;;\n    relationship: many_to_one\n  }\n}`;
  }

  if (cat.includes('field quality') || cat.includes('missing label')) {
    const dim = issue.field || obj || 'my_dimension';
    return `# Add metadata to ${dim} in ${file}.lkml\n\ndimension: ${dim} {\n  label: "${dim.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}"\n  description: "Describe what this field represents"\n  sql: \${TABLE}.${dim} ;;\n}`;
  }

  if (cat.includes('orphan')) {
    return `# View '${obj}' is not referenced by any explore.\n# Option 1: Reference it in an explore\nexplore: my_explore {\n  join: ${obj} {\n    type: left_outer\n    sql_on: ... ;;\n    relationship: many_to_one\n  }\n}\n\n# Option 2: Delete ${file}.lkml if unused`;
  }

  // Fallback: show the suggestion text as a comment
  const suggestion = issue.suggestion || issue.message || 'Review this issue.';
  return `# ${file}.lkml — Line ${issue.line_number || '?'}\n# Object: ${obj}\n\n# Suggestion:\n${suggestion.split('\n').map(l => '# ' + l).join('\n')}`;
}

function getImpactText(issue) {
  if (issue.impact) return issue.impact;
  const meta = getRuleMeta(issue);
  if (meta.description) return meta.description;
  return issue.severity === 'error' ? 'Critical: Will cause model validation failure.' : 'Warning: May lead to poor user experience or inconsistent results.';
}

function LookMLSnippet({ code }) {
  const highlightCode = (str) => {
    // Basic LookML highlighter
    const tokens = [
      { regex: /#.*/g, color: '#6B7280' }, // Comments
      { regex: /\b(view|explore|join|dimension|measure|dimension_group|parameter|filter|primary_key|type|sql|sql_on|relationship|label|description|view_label|group_label)\b/g, color: '#635BFF' }, // Keywords
      { regex: /"(?:[^"\\]|\\.)*"/g, color: '#09A55A' }, // Strings/Values
      { regex: /\b(yes|no)\b/g, color: '#09A55A' }, // Boolean values
      { regex: /\${[^}]+}/g, color: '#D97706' }, // References
    ];

    let parts = [{ text: str, color: '#D1D5DB' }];

    tokens.forEach(({ regex, color }) => {
      let newParts = [];
      parts.forEach(part => {
        if (part.color !== '#D1D5DB') {
          newParts.push(part);
          return;
        }
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(part.text)) !== null) {
          if (match.index > lastIndex) {
            newParts.push({ text: part.text.slice(lastIndex, match.index), color: '#D1D5DB' });
          }
          newParts.push({ text: match[0], color: color });
          lastIndex = regex.lastIndex;
        }
        if (lastIndex < part.text.length) {
          newParts.push({ text: part.text.slice(lastIndex), color: '#D1D5DB' });
        }
      });
      parts = newParts;
    });

    return parts.map((p, i) => <span key={i} style={{ color: p.color }}>{p.text}</span>);
  };

  return (
    <pre style={{ 
      margin: 0, padding: 0, fontFamily: "'Fira Code', monospace", fontSize: '12px', 
      lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' 
    }}>
      {highlightCode(code)}
    </pre>
  );
}

function CopyButton({ text, ghost }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button 
      onClick={handleCopy}
      style={{
        border: '1px solid #E2DFF5', 
        background: ghost ? 'rgba(255,255,255,0.05)' : '#FFFFFF', 
        color: copied ? '#09A55A' : ghost ? '#FFFFFF' : '#635BFF',
        borderRadius: '8px', padding: ghost ? '4px 10px' : '7px 14px', 
        fontFamily: 'Inter, sans-serif', fontSize: ghost ? '11px' : '13px', fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: '150ms ease',
        outline: 'none', backdropFilter: ghost ? 'blur(4px)' : 'none'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(99,91,255,0.5)';
        e.currentTarget.style.background = ghost ? 'rgba(255,255,255,0.1)' : '#FFFFFF';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#E2DFF5';
        e.currentTarget.style.background = ghost ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
      }}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      )}
      {copied ? 'Copied!' : 'Copy fix'}
    </button>
  );
}

function groupBy(arr, fn) {
  return arr.reduce((acc, x) => { const k = fn(x); (acc[k] = acc[k] || []).push(x); return acc; }, {});
}

function getObjectName(i) {
  if (i.field) return i.field;
  if (i.explore) return i.explore;
  if (i.view) return i.view;
  if (i.model) return i.model;
  if (i.object_name) return i.object_name;
  return 'project';
}
