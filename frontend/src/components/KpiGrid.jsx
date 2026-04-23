import React, { useState, useEffect } from 'react';
import { scoreMeta } from '../utils';

// ── Count-up hook ────────────────────────────────────────────
function useCountUp(target, duration = 600, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof target !== 'number') return;
    let raf;
    function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
    const start = performance.now();
    function tick(now) {
      const elapsed = Math.max(0, now - start - delay);
      const progress = Math.min(elapsed / duration, 1);
      setVal(Math.round(easeOutQuart(progress) * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return val;
}

// ── Tooltip text ─────────────────────────────────────────────
const TIPS = {
  'Total Issues':   'Sum of all errors, warnings, and info-level findings across the project.',
  'Errors':         'Critical issues that will break explores or cause incorrect query results.',
  'Warnings':       'Non-critical issues that degrade maintainability or performance.',
  'Views':          'Total view files parsed in this LookML project.',
  'Explores':       'Number of explore definitions found.',
  'Derived Tables': 'PDTs and NDTs detected across all views.',
  'Dimensions':     'Total dimension fields across all views.',
  'Measures':       'Total measure fields across all views.',
  'Orphan Views':   'Views that are defined in .lkml files but never joined into any Explore. They\'re invisible to end users but still parsed by Looker on every project load, adding unnecessary overhead. Safe to delete if confirmed unused.',
  'Zombies':        'Explores or Views that exist in the project but contain zero dimensions and zero measures — essentially empty shells. Unlike Orphan Views (which have fields but no Explore), Zombies are structurally incomplete. They may be placeholders from incomplete migrations or leftover scaffolding.',
  'Missing PK':     'Views missing a dimension with primary_key: yes. Without a declared primary key, Looker cannot accurately detect fanout in joins — this can silently inflate metric values (e.g. revenue appearing 3x higher) when the view is joined to a fact table with a one-to-many relationship.',
  'No Label':       'Fields missing a label — shows technical names in the UI.',
  'No Description': 'Fields with no description — hurts self-service usability.',
};

export default function KpiGrid({ result, filters, onKpiClick }) {
  const { views, explores, issues, health_score, category_scores } = result;
  const fv = filterViews(views, filters);
  const fe = filterExplores(explores, filters);
  const fi = issues;

  const errors   = fi.filter(i => i.severity === 'error');
  const warnings = fi.filter(i => i.severity === 'warning');
  const allViewNames = new Set(views.map(v => v.name));
  const allRefs = new Set(explores.flatMap(e => [e.base_view, ...e.joins.map(j => j.resolved_view)]));
  const orphans   = fv.filter(v => !allRefs.has(v.name));
  const zombies   = fe.filter(e => !allViewNames.has(e.base_view));
  const missingPk = fv.filter(v => !v.has_primary_key);
  const noLabel   = fv.flatMap(v => v.fields.filter(f => !f.hidden && ['dimension','dimension_group','measure'].includes(f.field_type) && !f.label));
  const noDesc    = fv.flatMap(v => v.fields.filter(f => !f.hidden && ['dimension','dimension_group','measure'].includes(f.field_type) && !f.description));
  const derived   = fv.filter(v => v.is_derived_table).length;
  const dims      = fv.reduce((s, v) => s + v.n_dimensions, 0);
  const meas      = fv.reduce((s, v) => s + v.n_measures, 0);
  const { color: hsColor, label: hsLabel } = scoreMeta(health_score);

  const miniScores = [
    { label: 'Broken Ref', score: category_scores?.broken_reference ?? 0 },
    { label: 'Dup Def',    score: category_scores?.duplicate_def    ?? 0 },
    { label: 'Join Int',   score: category_scores?.join_integrity   ?? 0 },
    { label: 'Field Qual', score: category_scores?.field_quality    ?? 0 },
  ];

  return (
    <div style={{ marginBottom: '32px' }}>

      {/* ── Tier 1 — 5-column grid with 2-span hero ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '12px', width: '100%' }}>
        <div style={{ gridColumn: 'span 2' }}>
          <HeroCard health={health_score} miniScores={miniScores} animDelay={100} />
        </div>
        <KpiCard label="Total Issues" value={fi.length}        valueColor="var(--text-1)"                                          dur={600} delay={160} animIdx={1} contextStr={`across ${fv.length} views`} onClick={() => onKpiClick?.('total')} />
        <KpiCard label="Errors"       value={errors.length}   valueColor={errors.length   > 0 ? 'var(--error)'   : 'var(--text-1)'} dur={600} delay={220} animIdx={2} contextStr={errors.length > 0 ? 'critical · fix required' : 'all clear'} onClick={() => onKpiClick?.('errors')} />
        <KpiCard label="Warnings"     value={warnings.length} valueColor={warnings.length > 0 ? 'var(--warning)' : 'var(--text-1)'} dur={600} delay={280} animIdx={3} contextStr={warnings.length > 0 ? 'needs review' : 'all clear'} onClick={() => onKpiClick?.('warnings')} />
      </div>

      {/* ── Tier 2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '12px', width: '100%' }}>
        {[
          { label: 'Views',          value: fv.length },
          { label: 'Explores',       value: fe.length },
          { label: 'Derived Tables', value: derived },
          { label: 'Dimensions',     value: dims },
          { label: 'Measures',       value: meas },
        ].map((k, i) => (
          <KpiCard key={k.label} {...k} dur={400} delay={300 + i * 40} animIdx={i} />
        ))}
      </div>

      {/* ── Tier 3 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', width: '100%' }}>
        {[
          { label: 'Orphan Views',    value: orphans.length,  valueColor: orphans.length  > 0 ? 'var(--warning)' : 'var(--text-1)', onClick: () => onKpiClick?.('orphan_views') },
          { label: 'Zombies',         value: zombies.length,  valueColor: zombies.length  > 0 ? 'var(--error)'   : 'var(--text-1)' },
          { label: 'Missing PK',      value: missingPk.length,valueColor: missingPk.length> 0 ? 'var(--warning)' : 'var(--text-1)', onClick: () => onKpiClick?.('missing_pk') },
          { label: 'No Label',        value: noLabel.length,  valueColor: 'var(--text-2)', onClick: () => onKpiClick?.('no_label') },
          { label: 'No Description',  value: noDesc.length,   valueColor: 'var(--text-2)', onClick: () => onKpiClick?.('no_description') },
        ].map((k, i) => (
          <KpiCard key={k.label} {...k} dur={400} delay={450 + i * 40} animIdx={i} />
        ))}
      </div>
    </div>
  );
}

// ── Hero Card ─────────────────────────────────────────────────
function HeroCard({ health, miniScores, animDelay = 0 }) {
  const displayed = useCountUp(health, 800, animDelay);
  const [hovered, setHovered] = useState(false);
  const { bg, color, dot, label } = scoreMeta(health);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? 'linear-gradient(135deg, #FFFFFF 50%, #EEF2FF 100%)'
          : 'linear-gradient(135deg, #FFFFFF 60%, #F0EEFF 100%)',
        border: `1.5px solid ${hovered ? 'rgba(99,91,255,0.35)' : 'rgba(99,91,255,0.2)'}`,
        borderRadius: '8px',
        padding: '22px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px',
        boxShadow: hovered
          ? '0 8px 24px rgba(99,91,255,0.10), 0 2px 8px rgba(0,0,0,0.06)'
          : '0 1px 3px rgba(99,91,255,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        transition: 'all 150ms ease',
        animation: `fadeSlideUp 300ms ease-out ${animDelay}ms both`,
        cursor: 'default',
        minHeight: '100px',
      }}
    >
      {/* Left: score + label */}
      <div>
        <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
          Health Score
        </div>
        <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '48px', fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {displayed}<span style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-3)' }}>/100</span>
        </div>
        <div style={{ marginTop: '10px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: bg, color: color, borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontFamily: 'Sora, sans-serif', fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
            {label}
          </span>
        </div>
      </div>

      {/* Right: mini sparkline bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', paddingBottom: '4px' }}>
        {miniScores.map((s, i) => (
          <MiniBar key={s.label} label={s.label} score={s.score} delay={animDelay + 300 + i * 80} />
        ))}
      </div>
    </div>
  );
}

function MiniBar({ label, score, delay }) {
  const [h, setH] = useState(0);
  const MAX_H = 48; // fixed max-height 48px
  
  useEffect(() => {
    const t = setTimeout(() => setH((score / 100) * MAX_H), delay);
    return () => clearTimeout(t);
  }, [score, delay]);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{ position: 'relative', width: 8, height: MAX_H, background: '#DDD9F0', borderRadius: '4px', display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ position: 'absolute', top: -16, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums', fontFamily: 'Sora, sans-serif' }}>{score}</span>
        </div>
        <div style={{ width: '100%', height: h, background: 'var(--success)', borderRadius: '4px', transition: 'height 600ms ease-out' }} />
      </div>
      <div style={{ fontSize: '9px', color: 'var(--text-3)', textAlign: 'center', maxWidth: '36px', lineHeight: 1.2, fontFamily: 'Sora, sans-serif' }}>{label}</div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, valueColor = 'var(--text-1)', dur = 600, delay = 0, animIdx = 0, contextStr = '', onClick }) {
  const count = useCountUp(typeof value === 'number' ? value : 0, dur, delay);
  const displayed = typeof value === 'number' ? count.toLocaleString() : value;
  const tip = TIPS[label];
  const [tipVisible, setTipVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isClickable = !!onClick;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100px',
        background: hovered ? 'linear-gradient(135deg,#FFFFFF,#FAFBFF)' : '#FFFFFF',
        border: `1px solid ${hovered ? (isClickable ? 'rgba(99,91,255,0.35)' : 'rgba(99,91,255,0.35)') : 'var(--border)'}`,
        borderTop: `3px solid ${hovered ? (isClickable ? 'var(--accent)' : 'var(--accent)') : 'transparent'}`,
        borderRadius: '8px',
        padding: '18px 18px 16px',
        boxShadow: hovered
          ? '0 8px 24px rgba(99,91,255,0.10), 0 2px 8px rgba(0,0,0,0.06)'
          : '0 1px 3px rgba(99,91,255,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        transition: 'all 150ms ease',
        position: 'relative',
        animation: `fadeSlideUp 300ms ease-out ${delay}ms both`,
        cursor: isClickable ? 'pointer' : 'default',
        transform: hovered && isClickable ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </div>
        {tip && (
          <div style={{ position: 'relative' }}
            onMouseEnter={() => setTipVisible(true)}
            onMouseLeave={() => setTipVisible(false)}
          >
            <span style={{
              width: 15, height: 15, borderRadius: '50%',
              border: '1px solid var(--border-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: 700, color: 'var(--text-3)',
              cursor: 'default', userSelect: 'none',
              fontFamily: 'Georgia, serif', fontStyle: 'italic',
              opacity: hovered ? 1 : 0,
              transition: 'opacity 150ms ease',
            }}>?</span>
            {tipVisible && <DarkTooltip text={tip} />}
          </div>
        )}
      </div>
      <div style={{
        fontFamily: 'Sora, sans-serif',
        fontSize: '32px', fontWeight: 700, color: valueColor,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
      }}>
        {displayed}
      </div>
      {contextStr && (
        <div style={{ fontSize: '12px', color: valueColor === 'var(--error)' ? 'var(--error)' : valueColor === 'var(--warning)' ? 'var(--warning)' : 'var(--text-3)', marginTop: '4px', fontFamily: 'Sora, sans-serif', fontWeight: valueColor === 'var(--text-1)' ? 400 : 500 }}>
          {contextStr}
        </div>
      )}

      {isClickable && (
        <div style={{
          font: '11px Sora', fontWeight: 600,
          color: 'var(--text-3)', marginTop: '8px',
          display: 'flex', alignItems: 'center', gap: '4px',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 150ms ease'
        }}>
          View in Issues
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Dark Tooltip ──────────────────────────────────────────────
function DarkTooltip({ text }) {
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 10px)', right: 0,
      background: '#1E1B4B', color: '#FFFFFF',
      border: '2px solid rgba(99,91,255,0.6)',
      borderRadius: '10px', padding: '10px 14px',
      fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 400,
      maxWidth: 220, width: 'max-content', zIndex: 300,
      boxShadow: '0 8px 32px rgba(99,91,255,0.25)',
      lineHeight: 1.5,
      animation: 'tooltipIn 150ms ease both',
    }}>
      {text}
      {/* Arrow */}
      <div style={{
        position: 'absolute', bottom: -7, right: 8,
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '7px solid #1E1B4B',
      }} />
    </div>
  );
}

export function filterViews(views, { folders }) {
  if (!folders || folders.length === 0) return views;
  return views.filter(v => {
    if (!v.source_file) return false;
    return folders.some(f => v.source_file.replace(/\\/g, '/').includes(f));
  });
}
export function filterExplores(explores, { exploreNames }) {
  if (!exploreNames || exploreNames.length === 0) return explores;
  return explores.filter(e => exploreNames.includes(e.name));
}
