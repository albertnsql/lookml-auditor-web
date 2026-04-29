import React, { useState, useMemo } from 'react';
import { RuleRow } from './RulesComponents';

// ── Rule Data ─────────────────────────────────────────────────
const RULES = [
  {
    id: 'missing_label',
    title: 'Missing Field Label',
    severity: 'warning',
    category: 'Field Quality',
    description: 'Dimension or measure has no label defined. Users see the raw field name in the UI instead of a human-readable label.',
    badExample: `dimension: customer_id {
  type: number
  sql: \${TABLE}.id ;;
}`,
    goodExample: `dimension: customer_id {
  type: number
  label: "Customer ID"
  sql: \${TABLE}.id ;;
}`,
  },
  {
    id: 'missing_description',
    title: 'Missing Field Description',
    severity: 'warning',
    category: 'Field Quality',
    description: 'Field has no description. Self-service users cannot understand what this field represents without tribal knowledge.',
    badExample: `measure: total_revenue {
  type: sum
  sql: \${TABLE}.revenue ;;
}`,
    goodExample: `measure: total_revenue {
  type: sum
  label: "Total Revenue"
  description: "Sum of all confirmed order revenue"
  sql: \${TABLE}.revenue ;;
}`,
  },
  {
    id: 'missing_primary_key',
    title: 'Missing Primary Key',
    severity: 'warning',
    category: 'Field Quality',
    description: 'View has no dimension with primary_key: yes. Looker cannot perform fanout detection without a declared primary key, which can silently inflate aggregated metrics.',
    badExample: `view: orders {
  dimension: id {
    type: number
    sql: \${TABLE}.id ;;
  }
}`,
    goodExample: `view: orders {
  dimension: id {
    type: number
    primary_key: yes
    sql: \${TABLE}.id ;;
  }
}`,
  },
  {
    id: 'broken_view_reference',
    title: 'Broken View Reference',
    severity: 'error',
    category: 'Broken Reference',
    description: 'An explore join references a view name that does not exist anywhere in the project. This causes the explore to fail to load entirely.',
    badExample: `explore: orders {
  join: missing_view {
    type: left_outer
    relationship: many_to_one
  }
}`,
    goodExample: `explore: orders {
  join: customers {
    type: left_outer
    relationship: many_to_one
    sql_on: \${orders.customer_id} = \${customers.id} ;;
  }
}`,
  },
  {
    id: 'duplicate_view_source',
    title: 'Duplicate View Source',
    severity: 'warning',
    category: 'Duplicate View Source',
    description: 'Two view files reference the same sql_table_name. This creates confusion about which view to use and can cause unexpected query results.',
    badExample: `# view_a.view.lkml
view: orders_v1 {
  sql_table_name: public.orders ;;
}

# view_b.view.lkml  ← SAME TABLE!
view: orders_v2 {
  sql_table_name: public.orders ;;
}`,
    goodExample: `# Single canonical view per table:
view: orders {
  sql_table_name: public.orders ;;
  # ... all fields
}`,
  },
  {
    id: 'duplicate_field_sql',
    title: 'Duplicate Field SQL',
    severity: 'warning',
    category: 'Duplicate Field SQL',
    description: 'Two dimensions or measures within the same view share identical SQL expressions. One is likely redundant and should be removed.',
    badExample: `view: orders {
  dimension: revenue {
    type: number
    sql: \${TABLE}.revenue ;;
  }
  dimension: revenue_copy {  # ← redundant
    type: number
    sql: \${TABLE}.revenue ;;
  }
}`,
    goodExample: `view: orders {
  dimension: revenue {
    type: number
    label: "Revenue"
    sql: \${TABLE}.revenue ;;
  }
  # Only one definition per SQL column
}`,
  },
  {
    id: 'join_missing_sql_on',
    title: 'Join Missing sql_on',
    severity: 'error',
    category: 'Join Integrity',
    description: 'A join in an explore has no sql_on or foreign_key defined. Without a join condition, Looker produces a Cartesian product which can return billions of rows.',
    badExample: `join: orders {
  type: left_outer
  relationship: many_to_one
  # missing sql_on — this is a cross join!
}`,
    goodExample: `join: orders {
  type: left_outer
  relationship: many_to_one
  sql_on: \${users.id} = \${orders.user_id} ;;
}`,
  },
  {
    id: 'orphan_view',
    title: 'Orphaned View',
    severity: 'info',
    category: 'Field Quality',
    description: 'View is defined but never joined into any explore. It adds unnecessary parse overhead on every project load and is invisible to end users.',
    badExample: `# never_used.view.lkml
view: never_used {
  sql_table_name: public.temp ;;
  # ... 40 fields nobody can access
}`,
    goodExample: `# Option 1: Delete it entirely.
# Option 2: Expose it through an explore:
explore: main {
  join: never_used {
    relationship: many_to_one
    sql_on: \${main.id} = \${never_used.id} ;;
  }
}`,
  },
  {
    id: 'fanout_risk',
    title: 'Potential Fanout Risk',
    severity: 'warning',
    category: 'Join Integrity',
    description: 'Join is missing a relationship declaration. Without it, Looker cannot warn about fan-out and aggregated metrics may be silently inflated.',
    badExample: `join: order_items {
  type: left_outer
  sql_on: \${orders.id} = \${order_items.order_id} ;;
  # missing relationship: — revenue will be 3x inflated
}`,
    goodExample: `join: order_items {
  type: left_outer
  relationship: one_to_many
  sql_on: \${orders.id} = \${order_items.order_id} ;;
}`,
  },
];

// ── Category Tag ─────────────────────────────────────────────
function CategoryTag({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: '8px',
      fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600,
      border: '1px solid',
      cursor: 'pointer', transition: 'all 150ms ease',
      background: active ? '#635BFF' : 'transparent',
      color: active ? '#fff' : '#64748B',
      borderColor: active ? '#635BFF' : 'rgba(100,116,139,0.2)',
      boxShadow: active ? '0 2px 12px rgba(99,91,255,0.35)' : 'none',
    }}>
      {label}
    </button>
  );
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ label, count, color, glow }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid rgba(0,0,0,0.06)',
      borderRadius: '16px',
      padding: '20px 28px',
      display: 'flex', flexDirection: 'column', gap: '4px',
      boxShadow: `0 4px 24px \${glow}`,
      minWidth: '120px',
    }}>
      <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '36px', fontWeight: 800, color, lineHeight: 1 }}>
        {count}
      </span>
      <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function RulesPage() {
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState('all');

  const filtered = useMemo(() => RULES.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.id.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q);
    const matchSev = sevFilter === 'all' || r.severity === sevFilter;
    return matchSearch && matchSev;
  }), [search, sevFilter]);

  const counts = {
    total:   RULES.length,
    error:   RULES.filter(r => r.severity === 'error').length,
    warning: RULES.filter(r => r.severity === 'warning').length,
    info:    RULES.filter(r => r.severity === 'info').length,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF6', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Animated background ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-200px', right: '-200px',
          width: '700px', height: '700px', borderRadius: '50%',
          background: 'radial-gradient(circle, #DDD9F0 0%, transparent 65%)',
          opacity: 0.8
        }} />
        <div style={{
          position: 'absolute', bottom: '-150px', left: '-150px',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, #D4CFE8 0%, transparent 65%)',
          opacity: 0.6
        }} />
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '56px 40px 80px', position: 'relative', zIndex: 1 }}>

        {/* ── Back link ── */}
        <a href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '48px',
          fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: 600, color: '#635BFF',
          textDecoration: 'none', opacity: 0, animation: 'ru_fade 0.4s ease 0.05s forwards'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to App
        </a>

        {/* ── Header ── */}
        <div style={{ marginBottom: '48px', opacity: 0, animation: 'ru_fade 0.5s ease 0.1s forwards' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(99,91,255,0.1)', border: '1px solid rgba(99,91,255,0.2)',
            borderRadius: '20px', padding: '4px 14px', marginBottom: '20px',
            fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 700, color: '#635BFF', letterSpacing: '0.1em'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#635BFF', boxShadow: '0 0 8px #635BFF' }} />
            AUDIT RULES
          </div>
          <h1 style={{
            fontFamily: 'Sora, sans-serif', fontSize: '52px', fontWeight: 800,
            color: '#0F0E1A', letterSpacing: '-2px', lineHeight: 1.05, marginBottom: '14px'
          }}>
            Rule Catalog.
          </h1>
          <p style={{ fontSize: '16px', color: '#64748B', lineHeight: 1.65, maxWidth: '520px' }}>
            Every check performed during a LookML audit — with severity, category, and real before/after code examples.
          </p>
        </div>

        {/* ── Stat Cards ── */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '48px', flexWrap: 'wrap', opacity: 0, animation: 'ru_fade 0.5s ease 0.2s forwards' }}>
          <StatCard label="Total Rules" count={counts.total}   color="#635BFF" glow="rgba(99,91,255,0.10)"  />
          <StatCard label="Errors"      count={counts.error}   color="#EF4444" glow="rgba(239,68,68,0.08)"  />
          <StatCard label="Warnings"    count={counts.warning} color="#F59E0B" glow="rgba(245,158,11,0.08)" />
          <StatCard label="Info"        count={counts.info}    color="#3B82F6" glow="rgba(59,130,246,0.08)" />
        </div>

        {/* ── Command Bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(99,91,255,0.15)',
          borderRadius: '14px', padding: '12px 16px',
          marginBottom: '24px',
          boxShadow: '0 8px 32px rgba(99,91,255,0.08)',
          opacity: 0, animation: 'ru_fade 0.5s ease 0.3s forwards',
          flexWrap: 'wrap'
        }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '200px', background: '#F8F7FF', borderRadius: '10px', padding: '10px 14px', border: '1px solid rgba(99,91,255,0.1)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search rules by ID, name or description..."
              style={{
                background: 'none', border: 'none', outline: 'none', width: '100%',
                fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#1E1B4B',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '28px', background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

          {/* Severity Filter */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['all', 'error', 'warning', 'info'].map(s => (
              <CategoryTag key={s} label={s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)} active={sevFilter === s} onClick={() => setSevFilter(s)} />
            ))}
          </div>

          {/* Count */}
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>
              {filtered.length} rule{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ── Rule List ── */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid rgba(0,0,0,0.06)',
          overflow: 'hidden',
          boxShadow: '0 4px 32px rgba(0,0,0,0.06)',
          opacity: 0, animation: 'ru_fade 0.5s ease 0.4s forwards'
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '220px 110px 160px 1fr 120px',
            borderBottom: '1px solid rgba(0,0,0,0.07)',
            background: '#FAFAFA',
            padding: '0',
          }}>
            {['Rule ID', 'Severity', 'Category', 'Description', ''].map((h, i) => (
              <div key={i} style={{
                padding: '12px 24px',
                fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: 700,
                color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em',
                ...(i === 4 ? { textAlign: 'right' } : {})
              }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: 600, color: '#94A3B8', marginBottom: '8px' }}>No rules match</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#CBD5E1' }}>Try a different search term or filter.</div>
            </div>
          ) : (
            filtered.map((rule, idx) => (
              <RuleRow key={rule.id} rule={rule} index={idx} />
            ))
          )}
        </div>

        {/* ── Footer note ── */}
        <p style={{ textAlign: 'center', fontFamily: 'Sora, sans-serif', fontSize: '12px', color: '#CBD5E1', marginTop: '32px', opacity: 0, animation: 'ru_fade 0.5s ease 0.6s forwards' }}>
          Click any row to view code examples. All rules are enforced during every audit run.
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ru_fade {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        input::placeholder { color: #94A3B8; }
      `}} />
    </div>
  );
}
