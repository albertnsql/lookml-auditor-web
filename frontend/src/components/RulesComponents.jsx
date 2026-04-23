import React, { useState } from 'react';

// ── Severity Config ───────────────────────────────────────────
const SEV = {
  error:   { dot: '#EF4444', text: '#EF4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',  label: 'Error'   },
  warning: { dot: '#F59E0B', text: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'Warning' },
  info:    { dot: '#3B82F6', text: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', label: 'Info'    },
};

// ── Severity Dot Badge ────────────────────────────────────────
function SeverityBadge({ severity }) {
  const s = SEV[severity] || SEV.info;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '6px',
      background: s.bg, border: `1px solid ${s.border}`,
      fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 700,
      color: s.text, letterSpacing: '0.04em', textTransform: 'uppercase',
      whiteSpace: 'nowrap'
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, boxShadow: `0 0 6px ${s.dot}` }} />
      {s.label}
    </span>
  );
}

// ── Dark Code Block ───────────────────────────────────────────
function CodeBlock({ label, code, type }) {
  const [copied, setCopied] = useState(false);
  const accent = type === 'bad' ? '#EF4444' : '#10B981';
  const accentBg = type === 'bad' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)';
  const icon = type === 'bad' ? '✕' : '✓';

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ background: '#0F172A', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${accent}40`, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: `1px solid rgba(255,255,255,0.05)`,
        background: 'rgba(255,255,255,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%',
            background: accentBg, border: `1px solid ${accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 900, color: accent
          }}>{icon}</span>
          <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 700, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {label}
          </span>
        </div>
        <button onClick={handleCopy} style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px', padding: '3px 10px', cursor: 'pointer',
          fontFamily: 'Sora, sans-serif', fontSize: '10px', fontWeight: 600,
          color: copied ? '#10B981' : '#94A3B8',
          transition: 'all 150ms ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {/* Code body */}
      <div style={{ padding: '20px 20px', overflowX: 'auto' }}>
        <pre style={{
          margin: 0, fontFamily: '"Fira Code", "Cascadia Code", monospace',
          fontSize: '13px', lineHeight: 1.8, color: '#E2E8F0',
          whiteSpace: 'pre'
        }}>
          {highlightLookML(code)}
        </pre>
      </div>
    </div>
  );
}

// ── Minimal LookML syntax highlighting ───────────────────────
function highlightLookML(code) {
  const lines = code.split('\n');
  return lines.map((line, i) => {
    // Comments
    if (line.trim().startsWith('#')) {
      return <span key={i} style={{ color: '#64748B' }}>{line}{'\n'}</span>;
    }
    // Simple rendering
    return <span key={i} style={{ display: 'block' }}>{renderLine(line)}{'\n'}</span>;
  });
}

function renderLine(line) {
  // keywords
  const kw = ['dimension', 'measure', 'view', 'explore', 'join', 'type', 'sql', 'label', 'description', 'primary_key', 'relationship', 'sql_on', 'sql_table_name', 'group_label'];
  if (line.trim().startsWith('#')) {
    return <span style={{ color: '#64748B' }}>{line}</span>;
  }
  const parts = line.split(/(\{|\}|;;|"[^"]*"|\b(?:yes|no)\b)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part === '{' || part === '}') return <span key={i} style={{ color: '#475569' }}>{part}</span>;
    if (part === ';;') return <span key={i} style={{ color: '#818CF8' }}>{part}</span>;
    if (part.startsWith('"') && part.endsWith('"')) return <span key={i} style={{ color: '#34D399' }}>{part}</span>;
    if (part === 'yes' || part === 'no') return <span key={i} style={{ color: '#FBBF24' }}>{part}</span>;
    const kwMatch = kw.find(k => part.trim() === k || part.trim().startsWith(k + ':'));
    if (kwMatch) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > -1) {
        return <span key={i}><span style={{ color: '#818CF8' }}>{part.slice(0, colonIdx)}</span><span style={{ color: '#475569' }}>:</span><span style={{ color: '#F8FAFC' }}>{part.slice(colonIdx + 1)}</span></span>;
      }
      return <span key={i} style={{ color: '#818CF8' }}>{part}</span>;
    }
    return <span key={i} style={{ color: '#F8FAFC' }}>{part}</span>;
  });
}

// ── Rule Row ─────────────────────────────────────────────────
export function RuleRow({ rule, index }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const s = SEV[rule.severity] || SEV.info;

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', animation: `fadeUp 350ms ease-out \${index * 40}ms both` }}>
      {/* Row */}
      <div
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 110px 160px 1fr 120px',
          gap: '0',
          padding: '0',
          background: hovered ? 'rgba(99,91,255,0.04)' : expanded ? 'rgba(99,91,255,0.03)' : 'transparent',
          cursor: 'pointer',
          transition: 'background 150ms ease',
          borderLeft: `3px solid \${expanded ? s.dot : 'transparent'}`,
          alignItems: 'center',
        }}
      >
        {/* Rule ID */}
        <div style={{ padding: '18px 24px' }}>
          <code style={{
            fontFamily: '"Fira Code", monospace', fontSize: '13px', fontWeight: 700,
            color: '#1E1B4B',
          }}>
            {rule.id}
          </code>
        </div>
        {/* Severity */}
        <div style={{ padding: '18px 16px' }}>
          <SeverityBadge severity={rule.severity} />
        </div>
        {/* Category */}
        <div style={{ padding: '18px 16px' }}>
          <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 500, color: '#64748B' }}>
            {rule.category}
          </span>
        </div>
        {/* Description */}
        <div style={{ padding: '18px 16px' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>
            {rule.description}
          </span>
        </div>
        {/* Expand */}
        <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
          <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 600, color: expanded ? '#635BFF' : '#94A3B8' }}>
            {expanded ? 'Collapse' : 'View Code'}
          </span>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={expanded ? '#635BFF' : '#94A3B8'} strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 250ms ease', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* Code Expansion */}
      <div style={{
        maxHeight: expanded ? '800px' : '0',
        overflow: 'hidden',
        transition: 'max-height 400ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
          padding: '20px 24px 28px', background: 'rgba(99,91,255,0.02)',
          borderTop: '1px solid rgba(0,0,0,0.05)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}>
          <CodeBlock label="Bad LookML" code={rule.badExample} type="bad" />
          <CodeBlock label="Good LookML" code={rule.goodExample} type="good" />
        </div>
      </div>
    </div>
  );
}
