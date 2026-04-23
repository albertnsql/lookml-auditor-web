import React, { useState, useMemo } from 'react';

// ── Icons ───────────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#9CA3AF' }}>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const ChevronIcon = ({ expanded }) => (
  <svg 
    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
    style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms ease', color: expanded ? '#635BFF' : '#9CA3AF' }}
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

// ── Shared Sub-components ───────────────────────────────────

const SeverityBadge = ({ severity }) => {
  const configs = {
    error:   { dot: '#DC2626', bg: '#FEF2F2', text: '#DC2626', label: 'ERROR' },
    warning: { dot: '#D97706', bg: '#FFFBEB', text: '#D97706', label: 'WARNING' },
    info:    { dot: '#2563EB', bg: '#EFF6FF', text: '#2563EB', label: 'INFO' }
  };
  const config = configs[severity] || configs.info;
  
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '6px',
      background: config.bg, border: `1px solid ${config.dot}20`
    }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: config.dot }}></div>
      <span style={{ fontFamily: 'Sora', fontSize: '10px', fontWeight: 700, color: config.text, letterSpacing: '0.04em' }}>
        {config.label}
      </span>
    </div>
  );
};

const CodePanel = ({ label, code, type }) => {
  const [copied, setCopied] = useState(false);
  const icon = type === 'bad' ? '❌' : '✅';
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px' }}>{icon}</span>
          <span style={{ fontFamily: 'Sora', fontSize: '11px', fontWeight: 700, color: type === 'bad' ? '#EF4444' : '#10B981', letterSpacing: '0.08em' }}>
            {label}
          </span>
        </div>
        <button 
          onClick={handleCopy}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '4px', padding: '4px 8px', cursor: 'pointer',
            fontFamily: 'Sora', fontSize: '10px', fontWeight: 600, color: copied ? '#10B981' : '#94A3B8',
            transition: 'all 150ms ease'
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div style={{ 
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', 
        borderRadius: '8px', padding: '16px', overflowX: 'auto' 
      }}>
        <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.6 }}>
          {highlightCode(code)}
        </pre>
      </div>
    </div>
  );
};

const highlightCode = (code) => {
  const keywords = ['dimension', 'measure', 'view', 'explore', 'join', 'type', 'sql', 'label', 'description', 'primary_key', 'relationship', 'sql_on', 'sql_table_name'];
  return code.split('\n').map((line, i) => {
    if (line.trim().startsWith('#')) {
      return <div key={i} style={{ color: '#6B7280' }}>{line}</div>;
    }
    const parts = line.split(/(\b\w+\b|[:{}|;])/g);
    return (
      <div key={i} style={{ color: '#D1D5DB' }}>
        {parts.map((part, j) => {
          if (keywords.includes(part)) return <span key={j} style={{ color: '#635BFF' }}>{part}</span>;
          if (part.startsWith('"') && part.endsWith('"')) return <span key={j} style={{ color: '#09A55A' }}>{part}</span>;
          if (part === ':') return <span key={j} style={{ color: '#9CA3AF' }}>{part}</span>;
          return part;
        })}
      </div>
    );
  });
};

// ── Main Component ──────────────────────────────────────────

export default function AuditRulesTab({ rules = [] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [hoveredPill, setHoveredPill] = useState(null);

  const filteredRules = useMemo(() => {
    return rules.filter(r => {
      const matchesSearch = !search || 
        r.id.toLowerCase().includes(search.toLowerCase()) ||
        r.category.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'all' || r.severity === filter;
      return matchesSearch && matchesFilter;
    });
  }, [rules, search, filter]);

  const counts = useMemo(() => ({
    all: rules.length,
    error: rules.filter(r => r.severity === 'error').length,
    warning: rules.filter(r => r.severity === 'warning').length,
    info: rules.filter(r => r.severity === 'info').length
  }), [rules]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Bar */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ 
          flex: 1, minWidth: '300px', display: 'flex', alignItems: 'center', gap: '12px',
          background: '#FFFFFF', border: '1px solid #E2DFF5', borderRadius: '12px',
          padding: '0 16px', height: '44px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <SearchIcon />
          <input 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules by ID, name or description..."
            style={{ 
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'Inter', fontSize: '14px', color: '#1E1B4B'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'error', 'warning', 'info'].map((s) => {
            const isActive = filter === s;
            const isHovered = hoveredPill === s;
            const showCount = isActive || isHovered;
            
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                onMouseEnter={() => setHoveredPill(s)}
                onMouseLeave={() => setHoveredPill(null)}
                style={{
                  height: '36px', padding: '0 16px', borderRadius: '20px',
                  fontFamily: 'Sora', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', transition: '150ms ease',
                  background: isActive ? '#635BFF' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#6B7280',
                  border: isActive ? '1px solid #635BFF' : '1px solid #E2DFF5',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <span style={{ textTransform: 'capitalize' }}>{s}</span>
                {showCount && (
                  <span style={{ opacity: 0.6, fontSize: '11px' }}>{counts[s]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Content */}
      <div style={{ 
        background: '#FFFFFF', border: '1px solid #E2DFF5', borderRadius: '12px', 
        overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' 
      }}>
        <div style={{ 
          display: 'grid', gridTemplateColumns: '200px 140px 160px 1fr 140px',
          background: '#F9FAFB', borderBottom: '1px solid #E2DFF5', padding: '12px 24px'
        }}>
          {['RULE ID', 'SEVERITY', 'CATEGORY', 'DESCRIPTION', ''].map((h, i) => (
            <div key={i} style={{ 
              fontFamily: 'Sora', fontSize: '11px', fontWeight: 700, 
              color: '#6B7280', letterSpacing: '0.08em' 
            }}>
              {h}
            </div>
          ))}
        </div>

        <div>
          {filteredRules.map((rule) => {
            const isExpanded = expandedId === rule.id;
            return (
              <div key={rule.id} style={{ borderBottom: '1px solid #E2DFF5' }}>
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : rule.id)}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F9F8FF'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
                  style={{ 
                    display: 'grid', gridTemplateColumns: '200px 140px 160px 1fr 140px',
                    padding: '20px 24px', alignItems: 'center', cursor: 'pointer',
                    transition: '150ms ease', background: '#FFFFFF'
                  }}
                >
                  <code style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1E1B4B', fontSize: '13px' }}>
                    {rule.id}
                  </code>
                  <div><SeverityBadge severity={rule.severity} /></div>
                  <div style={{ color: '#635BFF', fontSize: '13px', fontWeight: 500 }}>{rule.category}</div>
                  <div style={{ 
                    color: '#374151', fontSize: '14px', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                  }}>
                    {rule.description}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                    <span 
                      onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                      onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                      style={{ color: '#635BFF', fontSize: '12px', fontWeight: 600, transition: '150ms ease' }}
                    >
                      {isExpanded ? 'Hide Code' : 'View Code'}
                    </span>
                    <ChevronIcon expanded={isExpanded} />
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ background: '#0F0E1A', padding: '24px', display: 'flex', gap: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <CodePanel label="BAD LOOKML" code={rule.badExample} type="bad" />
                    <CodePanel label="GOOD LOOKML" code={rule.goodExample} type="good" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
