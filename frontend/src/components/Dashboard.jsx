import React, { useState } from 'react';
import TopBar            from './TopBar';
import KpiGrid           from './KpiGrid';
import OverviewTab       from './tabs/OverviewTab';
import IssuesTab         from './tabs/IssuesTab';
import AuditRulesTab     from './tabs/AuditRulesTab';
import { RULES }         from '../data/rules';
import VisualizationsTab from './tabs/VisualizationsTab';
import InventoryTab      from './tabs/InventoryTab';
import FileViewerTab     from './tabs/FileViewerTab';
import SettingsTab       from './tabs/SettingsTab';

const NAV_ITEMS = [
  { id: 'overview',   icon: <IconOverview />,   label: 'Overview' },
  { id: 'issues',     icon: <IconIssues />,     label: 'Issues' },
  { id: 'visuals',    icon: <IconVisuals />,    label: 'Visualizations' },
  { id: 'inventory',  icon: <IconInventory />,  label: 'Inventory' },
  { id: 'fileviewer', icon: <IconFile />,       label: 'File Viewer' },
  { id: 'settings',   icon: <IconSettings />,   label: 'Settings' },
];

export default function Dashboard({ auditData, isLoading, onReset }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [issueFilters, setIssueFilters] = useState({
    severity: ['error', 'warning', 'info'],
    category: 'all',
    file: null,
    search: ''
  });

  const handleKpiClick = (filterType) => {
    setActiveTab('issues');
    
    switch(filterType) {
      case 'errors':
        setIssueFilters(f => ({ ...f, severity: ['error'], category: 'all', search: '' }));
        break;
      case 'warnings':
        setIssueFilters(f => ({ ...f, severity: ['warning'], category: 'all', search: '' }));
        break;
      case 'total':
        setIssueFilters(f => ({ ...f, severity: ['error', 'warning', 'info'], category: 'all', search: '' }));
        break;
      case 'orphan_views':
        setIssueFilters(f => ({ ...f, severity: ['error', 'warning', 'info'], category: 'Field Quality', search: 'orphan' }));
        break;
      case 'missing_pk':
        setIssueFilters(f => ({ ...f, severity: ['error', 'warning', 'info'], category: 'all', search: 'primary_key' }));
        break;
      case 'no_label':
        setIssueFilters(f => ({ ...f, severity: ['error', 'warning', 'info'], category: 'all', search: 'label' }));
        break;
      case 'no_description':
        setIssueFilters(f => ({ ...f, severity: ['error', 'warning', 'info'], category: 'all', search: 'description' }));
        break;
      default:
        break;
    }
  };

  const filters = { folders: [], exploreNames: [] };

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        
        {/* Workspace switcher row */}
        <div style={{ padding: '24px 16px 0px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            color: 'white', fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: 700
          }}>
            L
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {auditData.project?.name || 'Untitled Project'}
            </div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', color: 'var(--text-3)' }}>LookML Project</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0 0 0' }} />

        {/* Navigation */}
        <div className="sidebar-body" style={{ padding: '8px' }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {NAV_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', height: '40px', padding: '0 16px', borderRadius: '8px',
                    background: isActive ? 'linear-gradient(135deg, #EEF2FF, #F5F3FF)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-2)',
                    border: isActive ? '1px solid rgba(99,91,255,0.15)' : '1px solid transparent',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'Sora, sans-serif',
                    fontSize: '13px', fontWeight: isActive ? 600 : 500,
                    transition: 'all 120ms ease',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#F0EEFF'; e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.querySelector('.nav-icon').style.color = 'var(--accent)'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.querySelector('.nav-icon').style.color = 'var(--text-3)'; } }}
                >
                  <span className="nav-icon" style={{ color: isActive ? 'var(--accent)' : 'var(--text-3)', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 120ms ease' }}>
                    {item.icon}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.id === 'issues' && auditData.issues.length > 0 && (
                    <span className="nav-issues-badge" style={{
                      background: 'var(--accent)', color: '#fff',
                      borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                      padding: '2px 8px', fontFamily: 'Sora, sans-serif',
                      fontVariantNumeric: 'tabular-nums',
                      animation: 'pulseGlow 2.5s ease infinite',
                    }}>
                      {auditData.issues.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom CTA */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <button 
            onClick={onReset}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, var(--accent), #818CF8)', color: 'white',
              borderRadius: '8px', padding: '10px',
              fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: 600,
              border: 'none', cursor: 'pointer', textAlign: 'center',
              boxShadow: '0 2px 12px rgba(99,91,255,0.3)',
              transition: 'all 150ms ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,91,255,0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(99,91,255,0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            New Audit
          </button>
          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'Sora, sans-serif' }}>
            v1.0.0 · LookML Auditor
          </div>
        </div>
      </aside>

      {/* ── Main content with geometric background ── */}
      <div className="main-content">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulseGlow {
            0% { box-shadow: 0 0 0 0 rgba(99,91,255,0.5); }
            100% { box-shadow: 0 0 0 5px rgba(99,91,255,0); }
          }
        `}} />
        {/* Decorative background shapes */}
        <svg style={{ position: 'absolute', top: 0, right: 0, width: '500px', height: '400px', pointerEvents: 'none', zIndex: 0, opacity: 0.4 }} viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="400" cy="80" rx="220" ry="160" fill="#DDD9F0" transform="rotate(-20 400 80)" />
          <ellipse cx="460" cy="300" rx="130" ry="90" fill="#EEF2FF" transform="rotate(10 460 300)" />
        </svg>
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '360px', height: '300px', pointerEvents: 'none', zIndex: 0, opacity: 0.3 }} viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="60" cy="260" rx="180" ry="120" fill="#DDD9F0" transform="rotate(15 60 260)" />
        </svg>

        <TopBar result={auditData} onReset={onReset} />
        <div className="page-content">
          {activeTab === 'overview' && (
            <KpiGrid 
              result={auditData} 
              filters={filters} 
              onKpiClick={handleKpiClick}
            />
          )}
          {activeTab === 'overview'   && (
            <OverviewTab 
              result={auditData} 
              onKpiClick={handleKpiClick}
            />
          )}
          {activeTab === 'issues'     && (
            <IssuesTab 
              key={auditData._auditTimestamp} 
              auditData={auditData} 
              isLoading={isLoading} 
              externalFilters={issueFilters}
              onFilterChange={setIssueFilters}
            />
          )}
          {activeTab === 'visuals'    && <VisualizationsTab result={auditData} />}
          {activeTab === 'inventory'  && <InventoryTab      result={auditData} />}
          {activeTab === 'rules'      && <AuditRulesTab     rules={RULES} />}
          {activeTab === 'fileviewer' && <FileViewerTab     result={auditData} />}
          {activeTab === 'settings'   && <SettingsTab       result={auditData} onReset={onReset} />}
        </div>
      </div>
    </div>
  );
}

// ── SVG Icons ──────────────────────────────────────
function Ico({ children }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function IconOverview()  { return <Ico><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></Ico>; }
function IconIssues()    { return <Ico><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></Ico>; }
function IconVisuals()   { return <Ico><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Ico>; }
function IconInventory() { return <Ico><path d="M21 8v13H8V8zM3 16V3h13"/></Ico>; }
function IconFile()      { return <Ico><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></Ico>; }
function IconSettings()  { return <Ico><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Ico>; }
