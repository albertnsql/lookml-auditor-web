import React from 'react';
import { scoreMeta } from '../utils';

export default function TopBar({ result, onReset }) {
  const { bg, color, dot, label } = scoreMeta(result.health_score);
  const isGithub = result.source_type === 'github';

  return (
    <div className="topbar" style={{ height: '60px', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', borderBottom: '1px solid #E2DFF5' }}>
      
      {/* ── Left group ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Accent bar separator */}
        <div style={{ width: '4px', height: '24px', background: 'var(--accent)', borderRadius: '2px' }} />
        
        {/* Breadcrumb — project name */}
        <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: 600, color: 'var(--text-1)' }}>
          {result.project.name}
        </span>

        {/* Health pill */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
          background: bg, color: color,
          border: `1px solid ${color}20`,
          fontFamily: 'Sora, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          transition: 'box-shadow 150ms ease',
          cursor: 'default'
        }}
        onMouseEnter={(e) => e.currentTarget.style.boxShadow = `0 2px 8px ${color}20`}
        onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
          <span>{label} · {result.health_score}/100</span>
        </span>
      </div>

      <div className="topbar-spacer" />

      {/* ── Right group ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {result.suppressed > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 600, fontFamily: 'Sora, sans-serif' }}>
            {result.suppressed} suppressed
          </span>
        )}

        <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

        {isGithub && (
          <a href="#" style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '13px' }}
             onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
             onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>
            <GitHubIcon />
            GitHub
          </a>
        )}

        <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

        <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'monospace', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {result.project.root_path}
        </span>

        <button 
          onClick={onReset}
          style={{
            background: 'var(--accent)', color: 'white', borderRadius: '8px', padding: '8px 20px', 
            fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(99,91,255,0.35)', transition: 'all 150ms ease',
            whiteSpace: 'nowrap', marginLeft: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-hover)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,91,255,0.45)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,91,255,0.35)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Run Audit
        </button>
      </div>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}
