import { useState, useEffect } from 'react';
import { scoreMeta } from '../../utils';

export default function OverviewTab({ result }) {
  const { health_score, error_penalty, category_scores, issues } = result;
  const { color: hsColor, label: hsLabel } = scoreMeta(health_score);

  const bySev = groupBy(issues, i => i.severity);
  const byCat = groupBy(issues, i => i.category);
  const total = issues.length;

  const err = (bySev['error']   || []).length;
  const wrn = (bySev['warning'] || []).length;
  const inf = (bySev['info']    || []).length;

  const catRows = [
    { label: 'Field Quality',          count: (byCat['Field Quality']          || []).length, color: 'var(--success)' },
    { label: 'Duplicate View Source',  count: (byCat['Duplicate View Source']  || []).length, color: '#F59E0B' },
    { label: 'Duplicate Field SQL',    count: (byCat['Duplicate Field SQL']    || []).length, color: 'var(--warning)' },
    { label: 'Join Integrity',         count: (byCat['Join Integrity']         || []).length, color: 'var(--error)' },
    { label: 'Broken Reference',       count: (byCat['Broken Reference']       || []).length, color: 'var(--info)' },
  ].sort((a, b) => b.count - a.count);

  const maxCat = Math.max(...catRows.map(r => r.count), 1);

  const catScores = [
    { label: 'Broken Reference',      score: category_scores?.broken_reference      ?? 0 },
    { label: 'Duplicate View Source', score: category_scores?.duplicate_view_source ?? 0 },
    { label: 'Duplicate Field SQL',   score: category_scores?.duplicate_field_sql   ?? 0 },
    { label: 'Join Integrity',        score: category_scores?.join_integrity        ?? 0 },
    { label: 'Field Quality',         score: category_scores?.field_quality         ?? 0 },
  ];

  const topCat = [...catRows].sort((a, b) => b.count - a.count)[0];
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeSlideUp 400ms ease-out 600ms both' }}>

      {/* ── 3-col chart grid (Equal distribution) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', alignItems: 'stretch', width: '100%', minHeight: '420px' }}>

        {/* Col 1 — Project Health: Radial Score Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="section-label" style={{ marginBottom: '16px' }}>Project Health</div>
          <RadialScoreCard score={health_score} catScores={catScores} errCount={err} penalty={error_penalty} />
        </div>

        {/* Col 2 — Issues by Category: Ranked Bar Chart */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="section-label" style={{ marginBottom: '16px' }}>Issues by Category</div>
          {total === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, color: 'var(--success)' }}>
              All clear — no issues detected
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {catRows.map((r, i) => (
                  <RankedBarRow key={r.label} rank={i + 1} row={r} max={maxCat} total={total} delay={i * 80} />
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 'auto', paddingTop: '10px', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)', fontFamily: 'Sora, sans-serif' }}>
                5 categories · {total} total issues
              </div>
            </div>
          )}
        </div>

        {/* Col 3 — Severity Breakdown: Segmented Ring */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', overflow: 'visible' }}>
          <div>
            <div className="section-label" style={{ marginBottom: '16px' }}>Severity Breakdown</div>
            {total === 0 ? (
              <div style={{ color: 'var(--text-3)', fontSize: '14px' }}>No issues</div>
            ) : (
              <>
                <SeverityDonut err={err} wrn={wrn} inf={inf} total={total} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginTop: '14px' }}>
                  {err > 0 && <SevRow color="var(--error)"   label="Errors"   count={err} pct={Math.round((err/total)*100)} />}
                  {wrn > 0 && <SevRow color="var(--warning)" label="Warnings" count={wrn} pct={Math.round((wrn/total)*100)} />}
                  {inf > 0 && <SevRow color="var(--info)"    label="Info"     count={inf} pct={Math.round((inf/total)*100)} />}
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <div style={{
              padding: '8px 10px',
              background: 'linear-gradient(135deg, #FFF7ED, #FFFBEB)',
              borderRadius: '8px', border: '1px solid rgba(217,119,6,0.2)',
            }}>
              <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '10px', fontWeight: 600, color: 'var(--warning)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
                Most Common
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', fontFamily: 'Sora, sans-serif' }}>
                Field Quality <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>(26 issues)</span>
              </div>
            </div>
            
            {err > 0 && (
              <div style={{
                padding: '8px 10px',
                background: 'linear-gradient(135deg, #FEF2F2, #FFF5F5)',
                borderRadius: '8px', border: '1px solid rgba(220,38,38,0.15)',
              }}>
                <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '10px', fontWeight: 600, color: 'var(--error)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Riskiest
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', fontFamily: 'Sora, sans-serif' }}>
                  Join Integrity <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>(errors present)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Glossary bar ── */}
      <div className="card" style={{ padding: '14px 20px', background: 'var(--accent-light)', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.9, border: '1px solid var(--border)' }}>
        <strong style={{ color: 'var(--success)' }}>Broken Reference</strong> — Explores/joins pointing to missing views &nbsp;|&nbsp;{' '}
        <strong style={{ color: 'var(--warning)' }}>Duplicate View Source</strong> — Two+ view files pointing at the same sql_table_name &nbsp;|&nbsp;{' '}
        <strong style={{ color: '#F59E0B' }}>Duplicate Field SQL</strong> — Two fields in the same view sharing identical SQL expressions &nbsp;|&nbsp;{' '}
        <strong style={{ color: 'var(--error)' }}>Join Integrity</strong> — Missing sql_on · bad field refs · missing relationship &nbsp;|&nbsp;{' '}
        <strong style={{ color: 'var(--info)' }}>Field Quality</strong> — Missing PKs · orphaned views · missing labels/descriptions
      </div>

      {/* ── Collapsible methodology ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
            textAlign: 'left', color: 'var(--text-1)',
            fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: 500,
            borderBottom: expanded ? '1px solid var(--border)' : 'none',
            transition: 'background 150ms ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--info-bg)', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--info)', fontFamily: 'Georgia, serif', fontStyle: 'italic', flexShrink: 0 }}>i</span>
          <span style={{ flex: 1 }}>How is the Health Score calculated?</span>
          <ChevronIcon open={expanded} />
        </button>
        {expanded && (
          <div style={{ padding: '20px', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.7 }}>
            <p style={{ marginBottom: '14px' }}><strong style={{ color: 'var(--text-1)' }}>Ratio-based scoring</strong> — each category is scored as the percentage of objects with no issues.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', marginBottom: '16px', padding: '12px 16px', background: 'var(--surface-2)', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--accent)' }}>Broken Reference (35%)</span><span>: issues / (explores + joins)</span>
              <span style={{ color: 'var(--accent)' }}>Duplicate View Source (12.5%)</span><span>: view issues / views</span>
              <span style={{ color: 'var(--accent)' }}>Duplicate Field SQL (12.5%)</span><span>: field SQL issues / fields</span>
              <span style={{ color: 'var(--accent)' }}>Join Integrity (25%)</span><span>: issues / (joins × 2)</span>
              <span style={{ color: 'var(--accent)' }}>Field Quality (15%)</span><span>: issues / (fields + views)</span>
            </div>
            <p style={{ marginBottom: '10px' }}><strong style={{ color: 'var(--text-1)' }}>Severity weights:</strong>&nbsp;<code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px' }}>errors × 8 | warnings × 3 | info × 0.1</code></p>
            <p><strong style={{ color: 'var(--text-1)' }}>Current run:</strong> {err} errors · {wrn} warnings · {inf} info</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Radial Score Card ─────────────────────────────────────────
function RadialScoreCard({ score, catScores, errCount = 0, penalty = 0 }) {
  const [animScore, setAnimScore] = useState(0);
  const { bg, color, label } = scoreMeta(score);

  const cx = 150, cy = 140, r = 120;
  const pathLength = Math.PI * r;

  useEffect(() => {
    const t = setTimeout(() => setAnimScore(score), 50);
    return () => clearTimeout(t);
  }, [score]);

  const offset = pathLength - (animScore / 100) * pathLength;
  const ticks = [70, 80, 90];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Top Half: Arc Gauge */}
      <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', marginBottom: '10px' }}>
        <svg viewBox="0 0 300 155" width="100%" style={{ maxWidth: '300px' }}>
          {/* Base track */}
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#E2DFF5" strokeWidth="16" strokeLinecap="round" />
          
          {/* Fill track */}
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" 
                strokeDasharray={pathLength} strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.34, 1.56, 0.64, 1)' }} />

          {/* Ticks & Labels */}
          {ticks.map(val => {
            const angle = Math.PI - (val / 100) * Math.PI;
            const x1 = cx + (r - 12) * Math.cos(angle);
            const y1 = cy - (r - 12) * Math.sin(angle);
            const x2 = cx + (r + 12) * Math.cos(angle);
            const y2 = cy - (r + 12) * Math.sin(angle);
            const tx = cx + (r + 20) * Math.cos(angle);
            const ty = cy - (r + 20) * Math.sin(angle);
            return (
              <g key={`tick-${val}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--border)" strokeWidth="2" />
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="var(--text-3)" fontFamily="Sora, sans-serif">{val}</text>
              </g>
            );
          })}

          {/* Score Text */}
          <text x={cx} y={118} textAnchor="middle" fontSize="52" fontWeight="700" fill="var(--text-1)" fontFamily="Sora, sans-serif">
            {score}
            <tspan fontSize="18" fill="var(--text-3)" dy="-18" fontWeight="600"> / 100</tspan>
          </text>
        </svg>

        {/* Healthy Badge */}
        <div style={{ position: 'absolute', top: '138px', left: '50%', transform: 'translateX(-50%)', background: bg, color: color, borderRadius: '20px', padding: '4px 14px', fontSize: '13px', fontFamily: 'Sora, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {label}
        </div>

        {/* Penalty Line */}
        {errCount > 0 && penalty > 0 && (
          <div style={{ position: 'absolute', top: '168px', left: '50%', transform: 'translateX(-50%)', color: 'var(--error)', fontSize: '12px', fontWeight: 500, fontFamily: 'Sora, sans-serif', whiteSpace: 'nowrap' }}>
            -{penalty} pts · {errCount} critical error{errCount === 1 ? '' : 's'} {penalty >= 15 && '(cap reached)'}
          </div>
        )}
      </div>

      {/* Bottom Half: 2x2 Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '30px' }}>
        {catScores.map(cat => (
          <ScorePill key={cat.label} label={cat.label} score={cat.score} />
        ))}
      </div>
    </div>
  );
}

function ScorePill({ label, score }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(score), 50);
    return () => clearTimeout(t);
  }, [score]);

  const { color } = scoreMeta(score);
  
  const displayLabel = label === 'Broken Reference'     ? 'BROKEN REFERENCE' :
                       label === 'Duplicate View Source' ? 'DUP VIEW SOURCE' :
                       label === 'Duplicate Field SQL'   ? 'DUP FIELD SQL' :
                       label === 'Join Integrity'        ? 'JOIN INTEGRITY' :
                       label === 'Field Quality'         ? 'FIELD QUALITY' : label.toUpperCase();

  return (
    <div style={{ background: '#F5F3FF', border: '1px solid rgba(99,91,255,0.15)', borderRadius: '10px', padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontFamily: 'Sora, sans-serif', color: 'var(--text-2)', letterSpacing: '0.08em', fontWeight: 600 }}>
          {displayLabel}
        </span>
        <span style={{ fontSize: '20px', fontFamily: 'Sora, sans-serif', fontWeight: 700, color }}>
          {score}
        </span>
      </div>
      <div style={{ width: '100%', height: '5px', background: '#DDD9F0', borderRadius: '2.5px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: '2.5px', transition: 'width 500ms ease-out' }} />
      </div>
    </div>
  );
}

// ── Ranked Bar Chart Row ──────────────────────────────────────
function RankedBarRow({ rank, row, max, total, delay }) {
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState(false);
  const pct = total === 0 ? 0 : Math.round((row.count / total) * 100);

  useEffect(() => {
    const t = setTimeout(() => {
      const targetW = (row.count / max) * 100;
      setWidth(targetW);
    }, delay + 80);
    return () => clearTimeout(t);
  }, [row.count, max, delay]);

  const wPx = `max(${width}%, ${width > 0 && pct < 2 ? '4px' : '0px'})`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 0', paddingLeft: hovered ? '8px' : '0', paddingRight: hovered ? '8px' : '0',
        borderRadius: '8px',
        background: hovered ? '#F5F3FF' : 'transparent',
        transition: 'all 120ms ease',
        height: 56, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        borderBottom: hovered ? '1px solid transparent' : '1px solid #F0EEFF',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', width: '16px' }}>#{rank}</span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)', fontFamily: 'Sora, sans-serif' }}>{row.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: row.color, fontVariantNumeric: 'tabular-nums', width: '24px', textAlign: 'right' }}>{row.count}</span>
        </div>
      </div>
      <div style={{ paddingLeft: '32px' }}>
        <div style={{ height: '8px', borderRadius: '4px', background: '#EEF2FF', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: wPx, background: row.color, borderRadius: '4px', transition: 'width 500ms ease-out' }} />
        </div>
      </div>
    </div>
  );
}

// ── Segmented Ring Donut ──────────────────────────────────────
function SeverityDonut({ err, wrn, inf, total }) {
  const cx = 100, cy = 100, r = 70;
  const C = 2 * Math.PI * r;
  const GAP = 2;
  
  const activeC = C - (3 * GAP);
  const eLen = err === 0 ? 0 : (err / total) * activeC;
  const wLen = wrn === 0 ? 0 : (wrn / total) * activeC;
  const iLen = inf === 0 ? 0 : (inf / total) * activeC;

  const [eD, setED] = useState(0);
  const [wD, setWD] = useState(0);
  const [iD, setID] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setED(eLen), 250);
    const t2 = setTimeout(() => setWD(wLen), 250 + 250);
    const t3 = setTimeout(() => setID(iLen), 250 + 250 + 500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [eLen, wLen, iLen]);

  const eRot = -90;
  const wRot = eRot + (eLen > 0 ? (eLen + GAP)/C * 360 : 0);
  const iRot = wRot + (wLen > 0 ? (wLen + GAP)/C * 360 : 0);

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E9E6F8" strokeWidth="28" />
        {err > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--error)" strokeWidth="28"
          strokeDasharray={`${eD} ${C}`} strokeLinecap="butt"
          style={{ transform: `rotate(${eRot}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 250ms ease-out' }} />}
        {wrn > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--warning)" strokeWidth="28"
          strokeDasharray={`${wD} ${C}`} strokeLinecap="butt"
          style={{ transform: `rotate(${wRot}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 500ms ease-out' }} />}
        {inf > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--info)" strokeWidth="28"
          strokeDasharray={`${iD} ${C}`} strokeLinecap="butt"
          style={{ transform: `rotate(${iRot}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 350ms ease-out' }} />}
        
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="32" fontWeight="700" fontFamily="Sora, sans-serif" fill="var(--text-1)">{total}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" fill="var(--text-3)" fontFamily="Sora, sans-serif">issues</text>
      </svg>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function SevRow({ color, label, count, pct }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '36px', padding: '0 8px', borderRadius: '6px',
        background: hovered ? '#F8F7FF' : 'transparent',
        borderBottom: hovered ? '1px solid transparent' : '1px solid #F0EEFF',
        transition: 'background 120ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)', fontFamily: 'Sora, sans-serif' }}>{label}</span>
      </div>
      <div style={{ width: '80px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', width: '28px', textAlign: 'right' }}>{count}</span>
      </div>
    </div>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 150ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function groupBy(arr, fn) {
  return arr.reduce((acc, x) => { const k = fn(x); (acc[k] = acc[k] || []).push(x); return acc; }, {});
}
