import React, { useState, useEffect, useRef, useMemo } from 'react';

const gridCols = '80px 130px 130px 1fr 150px 130px 45px';

export default function IssuesTab({ auditData, isLoading, externalFilters, onFilterChange }) {
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

    // Sort by issue count descending and take top 30
    return Object.values(fileMap)
      .sort((a,b) => b.count - a.count)
      .slice(0, 30);
  }, [auditData]);

  const violationRules = useMemo(() => {
    const ruleMap = {};
    auditData.issues.forEach(issue => {
      const rule = issue.category || 'unknown';
      if (!ruleMap[rule]) {
        ruleMap[rule] = { name: rule, count: 0, sev: issue.severity, desc: issue.message };
      }
      ruleMap[rule].count++;
    });
    return Object.values(ruleMap)
      .sort((a,b) => b.count - a.count)
      .slice(0, 6)
      .map((r, i) => ({ ...r, rank: i + 1, time: '~5 min each' }));
  }, [auditData]);

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        
        {/* Card 1: Quick Wins */}
        <div className="insight-card" style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-2)', letterSpacing: '0.1em', fontWeight: 600 }}>Quick Wins</div>
            <div style={{ color: 'var(--accent)', fontSize: '14px' }}>✦</div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', fontStyle: 'italic', marginBottom: '16px' }}>Fix in under 5 minutes — no logic changes needed</div>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '36px', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{quickWins.total}</div>
            <div style={{ fontSize: '14px', color: 'var(--text-2)' }}>fields missing metadata</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            <div style={{ background: '#F5F3FF', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: 'var(--text-1)', width: 'max-content' }}>· No Label — {quickWins.noLabel} fields</div>
            <div style={{ background: '#F5F3FF', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: 'var(--text-1)', width: 'max-content' }}>· No Description — {quickWins.noDesc} fields</div>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'var(--border)', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ height: '100%', width: `${quickWins.percentAffected}%`, background: 'var(--accent)' }} />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '16px' }}>{quickWins.percentAffected}% of all dimensions affected</div>
            <span style={{ display: 'inline-block', background: '#EEF2FF', color: 'var(--accent)', borderRadius: '20px', padding: '4px 14px', fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600 }}>{quickWins.total} quick fixes available →</span>
          </div>
        </div>

        {/* Card 2: Blast Radius */}
        <div className="insight-card" style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-2)', letterSpacing: '0.1em', fontWeight: 600 }}>Blast Radius</div>
            <div style={{ color: 'var(--warning)', fontSize: '14px' }}>⚠️</div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', fontStyle: 'italic', marginBottom: '16px' }}>Explores broken or degraded by current issues</div>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '36px', fontWeight: 700, color: 'var(--error)', lineHeight: 1 }}>{blastRadius.count}</div>
            <div style={{ fontSize: '14px', color: 'var(--text-2)' }}>explores at risk</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>
            {blastRadius.explores.slice(0, 3).map((e, i) => (
              <div key={e} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '32px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '13px', color: 'var(--text-1)' }}>· {e}</span>
                <span style={{ background: i === 0 && blastRadius.hasCritical ? '#FEF2F2' : '#FFFBEB', color: i === 0 && blastRadius.hasCritical ? 'var(--error)' : 'var(--warning)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, fontFamily: 'Sora, sans-serif' }}>
                  {i === 0 && blastRadius.hasCritical ? 'ERROR' : 'WARNING'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', background: blastRadius.hasCritical ? '#FEF2F2' : '#F0FDF4', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: blastRadius.hasCritical ? 'var(--error)' : 'var(--success)' }}>
            {blastRadius.hasCritical ? 'Critical references will cause explore load failure' : 'No critical references detected'}
          </div>
        </div>

        {/* Card 3: Dead Code */}
        <div className="insight-card" style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-2)', letterSpacing: '0.1em', fontWeight: 600 }}>Dead Code</div>
            <div style={{ color: 'var(--text-3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', fontStyle: 'italic', marginBottom: '16px' }}>Views defined but never referenced in any explore</div>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '36px', fontWeight: 700, color: 'var(--text-2)', lineHeight: 1 }}>{deadCode.count}</div>
            <div style={{ fontSize: '14px', color: 'var(--text-2)' }}>views safe to delete</div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '24px' }}>
            {deadCode.views.slice(0, 5).map(v => (
              <span key={v} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', fontFamily: "'Fira Code', monospace", fontSize: '12px', color: 'var(--text-2)' }}>
                {v}
              </span>
            ))}
            {deadCode.views.length > 5 && <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>+{deadCode.views.length - 5} more</span>}
          </div>

          <div style={{ marginTop: 'auto', background: '#F0FDF4', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--success)' }}>
            Removing dead code reduces parse time and confusion
          </div>
        </div>
      </div>

      {/* ── Section 2: Two Visualizations ── */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flexWrap: 'wrap' }}>
        
        {/* Left: Issue Density Heatmap by View (60%) */}
        <div className="card" style={{ flex: '1 1 600px', padding: '24px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>Issue Density Heatmap by View</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Click a file to filter the table below</div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>0 issues</span>
              <div style={{ width: '120px', height: '6px', borderRadius: '3px', background: 'linear-gradient(to right, #F0FDF4, #FEF9C3, #FED7AA, #FECACA, #FCA5A5)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>13+ issues</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
              {cleanFilesCnt} files fully clean · {attentionFilesCnt} files need attention
            </div>
          </div>
          
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', alignContent: 'start' }}>
            {heatmapFiles.map(f => (
              <HeatmapCell 
                key={f.name} 
                file={f} 
                selected={selectedFile === f.name}
                onClick={() => {
                  setSelectedFile(f.name);
                }} 
              />
            ))}
          </div>
        </div>

        {/* Right: Rule Firing Frequency (40%) */}
        <div className="card" style={{ flex: '1 1 400px', padding: '24px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '20px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>Top Violation Rules</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Most frequently triggered across all files</div>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {violationRules.map((rule, idx) => (
              <div key={rule.name} className="rule-row" style={{ display: 'flex', gap: '8px', padding: '12px 0', borderBottom: idx < violationRules.length - 1 ? '1px solid var(--border)' : 'none', transition: 'all 120ms ease' }}>
                <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', color: 'var(--text-3)', width: '28px', flexShrink: 0, marginTop: '2px' }}>#{rule.rank}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-1)' }}>{rule.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ 
                        background: rule.sev === 'error' ? '#FEF2F2' : '#FFFBEB', 
                        color: rule.sev === 'error' ? 'var(--error)' : 'var(--warning)', 
                        padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, fontFamily: 'Sora, sans-serif' 
                      }}>
                        {rule.count}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-3)', fontStyle: 'italic', width: '70px', textAlign: 'right' }}>{rule.time}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'Inter, sans-serif', marginBottom: '8px' }}>
                    {rule.desc}
                  </div>
                  <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(rule.count / maxRuleCount) * 100}%`, background: rule.sev === 'error' ? 'var(--error)' : 'var(--warning)', borderRadius: '3px' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '16px', background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)', border: '1px solid rgba(99,91,255,0.15)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-2)' }}>Estimated total fix time:</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>If fixed sequentially starting from #1</div>
            </div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '24px', fontWeight: 700, color: 'var(--accent)' }}>
              ~4.5 hours
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Redesigned Table Grouped by File ── */}
      <div>
        
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
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '10px 20px', fontSize: '11px', fontFamily: 'Sora, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', fontWeight: 600 }}>
            <div>Severity</div><div>Category</div><div>Object</div><div>Message</div><div>Suggestion</div><div>File</div><div>Line</div>
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
                        <IssueRow key={issue.id || `${filename}-${idx}`} issue={issue} isAlt={idx % 2 === 1} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

function IssueRow({ issue, isAlt }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isErr = issue.severity === 'error';
  const isWrn = issue.severity === 'warning';
  
  const badgeBg  = isErr ? '#FEF2F2' : isWrn ? '#FFFBEB' : '#EFF6FF';
  const badgeCol = isErr ? '#DC2626' : isWrn ? '#D97706' : '#2563EB';
  const badgeBdr = isErr ? '#FECACA' : isWrn ? '#FDE68A' : '#BFDBFE';

  const objName = getObjectName(issue);
  const fileName = (issue.source_file || '').split(/[/\\]/).pop() || 'unknown';

  return (
    <>
      <div 
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ 
          display: 'grid', gridTemplateColumns: gridCols, gap: '16px', 
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          background: hovered ? '#FAFBFF' : isAlt ? 'rgba(99,91,255,0.01)' : 'transparent',
          transition: 'background 120ms ease', cursor: 'pointer',
          alignItems: 'start'
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
        <div style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'Inter, sans-serif', fontStyle: 'italic', lineHeight: 1.4 }}>
          {issue.suggestion || 'No suggestion available.'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: "'Fira Code', monospace", wordBreak: 'break-all' }}>
          {fileName}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: "'Fira Code', monospace" }}>
          {issue.line_number || '-'}
        </div>
      </div>
      
      {expanded && (
        <div style={{ background: '#F8F7FF', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeSlideUp 200ms ease-out' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-1)', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
            <strong style={{ fontWeight: 600 }}>Message:</strong> {issue.message}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-2)', fontFamily: 'Inter, sans-serif', fontStyle: 'italic', lineHeight: 1.5 }}>
            <strong style={{ fontWeight: 600, fontStyle: 'normal' }}>Suggestion:</strong> {issue.suggestion || 'No suggestion available.'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontFamily: "'Fira Code', monospace", color: 'var(--text-1)', userSelect: 'all' }}>
              {issue.source_file}{issue.line_number ? `:${issue.line_number}` : ''}
            </div>
            <button style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontFamily: 'Sora, sans-serif', fontWeight: 600, cursor: 'pointer', transition: 'background 150ms ease' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}>
              Copy fix suggestion
            </button>
          </div>
        </div>
      )}
    </>
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
