import React, { useState } from 'react';

const rules = [
  {
    id: 'missing_label',
    title: 'Missing Field Label',
    description: 'Dimension or measure has no label defined. Users will see the technical field name in the UI instead of a human-readable label.',
    severity: 'warning',
    category: 'Field Quality',
    badExample: 'dimension: customer_id {\n  type: number\n  sql: ${TABLE}.id ;;\n}',
    goodExample: 'dimension: customer_id {\n  type: number\n  label: "Customer ID"\n  sql: ${TABLE}.id ;;\n}',
  },
  {
    id: 'missing_description',
    title: 'Missing Field Description',
    severity: 'warning',
    category: 'Field Quality',
    description: 'Field has no description. Self-service users cannot understand what this field represents without tribal knowledge.',
    badExample: 'measure: total_revenue {\n  type: sum\n  sql: ${TABLE}.revenue ;;\n}',
    goodExample: 'measure: total_revenue {\n  type: sum\n  sql: ${TABLE}.revenue ;;\n  description: "Sum of all revenue"\n}',
  },
  {
    id: 'missing_primary_key',
    title: 'Missing Primary Key',
    severity: 'warning',
    category: 'Field Quality',
    description: 'View has no dimension with primary_key: yes. Looker cannot perform fanout detection without a defined primary key.',
    badExample: 'view: orders {\n  dimension: id {\n    type: number\n  }\n}',
    goodExample: 'view: orders {\n  dimension: id {\n    type: number\n    primary_key: yes\n  }\n}',
  },
  {
    id: 'broken_view_reference',
    title: 'Broken View Reference',
    severity: 'error',
    category: 'Broken Reference',
    description: 'An explore join references a view that does not exist in the project. This will cause the explore to fail to load.',
    badExample: 'explore: orders {\n  join: missing_view {\n    type: left_outer\n  }\n}',
    goodExample: 'explore: orders {\n  join: customers {\n    type: left_outer\n    sql_on: ${orders.customer_id} = ${customers.id} ;;\n  }\n}',
  },
  {
    id: 'duplicate_view_definition',
    title: 'Duplicate View Definition',
    severity: 'error',
    category: 'Duplicate Definition',
    description: 'The same view name is defined in more than one file. Looker will throw an error and the project will fail to load.',
    badExample: '# file1.view.lkml\nview: customers { ... }\n\n# file2.view.lkml\nview: customers { ... }',
    goodExample: '# Only one definition\n# customers.view.lkml\nview: customers { ... }',
  },
  {
    id: 'join_missing_sql_on',
    title: 'Join Missing sql_on',
    severity: 'error',
    category: 'Join Integrity',
    description: 'A join in an explore has no sql_on or foreign_key defined. Looker will produce a cross join which can return millions of rows.',
    badExample: 'join: orders {\n  type: left_outer\n  relationship: many_to_one\n  # missing sql_on!\n}',
    goodExample: 'join: orders {\n  type: left_outer\n  relationship: many_to_one\n  sql_on: ${users.id} = ${orders.user_id} ;;\n}',
  },
  {
    id: 'orphan_view',
    title: 'Orphaned View',
    severity: 'info',
    category: 'Field Quality',
    description: 'View is defined but never joined into any explore. It adds parse overhead and confuses developers.',
    badExample: '# never_used.view.lkml\nview: never_used {\n  sql_table_name: public.temp ;;\n}\n# Not referenced in any explore',
    goodExample: '# Either delete it or add to an explore:\nexplore: main {\n  join: never_used {\n    ...\n  }\n}',
  },
  {
    id: 'fanout_risk',
    title: 'Potential Fanout Risk',
    severity: 'warning',
    category: 'Join Integrity',
    description: 'Join uses many_to_many or is missing a relationship declaration. This can cause metric inflation.',
    badExample: 'join: order_items {\n  type: left_outer\n  sql_on: ${orders.id} = ${order_items.order_id} ;;\n  # missing relationship!\n}',
    goodExample: 'join: order_items {\n  type: left_outer\n  relationship: one_to_many\n  sql_on: ${orders.id} = ${order_items.order_id} ;;\n}',
  },
];

export default function RulesPage() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedRules, setExpandedRules] = useState(new Set());

  const toggleRule = (id) => {
    setExpandedRules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredRules = rules.filter(rule => {
    const matchSearch = !search ||
      rule.title.toLowerCase().includes(search.toLowerCase()) ||
      rule.id.toLowerCase().includes(search.toLowerCase()) ||
      rule.description.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = severityFilter === 'all' || rule.severity === severityFilter;
    const matchCategory = categoryFilter === 'all' || rule.category === categoryFilter;
    return matchSearch && matchSeverity && matchCategory;
  });

  return (
    <div style={{
      background: '#ECEAF6',
      minHeight: '100vh',
      fontFamily: 'Inter, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Same background blobs as landing page */}
      <div style={{
        position: 'fixed', top: '-100px', right: '-100px',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(99,91,255,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0
      }} />
      <div style={{
        position: 'fixed', bottom: '-80px', left: '-80px',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0
      }} />

      <div style={{
        maxWidth: '1200px', margin: '0 auto',
        padding: '48px 48px', position: 'relative', zIndex: 1
      }}>
        {/* Back link */}
        <div style={{ marginBottom: '32px' }}>
          <a href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            font: '13px Sora', fontWeight: 600, color: '#635BFF',
            textDecoration: 'none',
            opacity: 0, animation: 'fadeInUp 0.4s ease-out 0.1s forwards'
          }}>
            ← Back to App
          </a>
        </div>

        {/* Page title */}
        <div style={{ marginBottom: '48px', opacity: 0, animation: 'fadeInUp 0.5s ease-out 0.2s forwards' }}>
          {/* Label */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(99,91,255,0.1)', border: '1px solid rgba(99,91,255,0.2)',
            borderRadius: '20px', padding: '4px 14px',
            font: '11px Sora', fontWeight: 700, color: '#635BFF',
            letterSpacing: '0.08em', marginBottom: '16px'
          }}>
            AUDIT RULES
          </div>
          
          <h1 style={{
            font: '42px Sora', fontWeight: 800, color: '#1E1B4B',
            letterSpacing: '-1px', marginBottom: '12px', lineHeight: 1.1
          }}>
            Complete rule catalog.
          </h1>
          <p style={{ font: '16px Inter', color: '#6B7280', maxWidth: '480px', lineHeight: 1.6 }}>
            Every check performed during a LookML audit — with examples and fix guidance.
          </p>
        </div>

        {/* Stats pills row */}
        <div style={{
          display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap',
          opacity: 0, animation: 'fadeInUp 0.5s ease-out 0.3s forwards'
        }}>
          {[
            { label: 'Total Rules', count: rules.length, bg: '#EEF2FF', color: '#635BFF', border: 'rgba(99,91,255,0.2)' },
            { label: 'Errors',   count: rules.filter(r => r.severity === 'error').length,   bg: '#FEF2F2', color: '#DC2626', border: 'rgba(220,38,38,0.2)' },
            { label: 'Warnings', count: rules.filter(r => r.severity === 'warning').length, bg: '#FFFBEB', color: '#D97706', border: 'rgba(217,119,6,0.2)' },
            { label: 'Info',     count: rules.filter(r => r.severity === 'info').length,    bg: '#EFF6FF', color: '#2563EB', border: 'rgba(37,99,235,0.2)' },
          ].map(({ label, count, bg, color, border }) => (
            <div key={label} style={{
              background: bg, border: `1px solid ${border}`,
              borderRadius: '10px', padding: '10px 18px',
              display: 'flex', flexDirection: 'column', gap: '2px'
            }}>
              <span style={{ font: '20px Sora', fontWeight: 800, color }}>{count}</span>
              <span style={{ font: '11px Sora', fontWeight: 600, color, opacity: 0.7, letterSpacing: '0.06em' }}>
                {label.toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #E2DFF5',
          borderRadius: '12px', padding: '14px 20px',
          display: 'flex', gap: '12px', alignItems: 'center',
          marginBottom: '32px', flexWrap: 'wrap',
          boxShadow: '0 2px 8px rgba(99,91,255,0.06)',
          opacity: 0, animation: 'fadeInUp 0.5s ease-out 0.4s forwards'
        }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search rules..."
              style={{
                width: '100%', padding: '8px 12px 8px 32px',
                background: '#F8F7FF', border: '1px solid #E2DFF5',
                borderRadius: '8px', font: '13px Inter', color: '#1E1B4B',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 150ms, box-shadow 150ms'
              }}
              onFocus={e => {
                e.target.style.borderColor = '#635BFF';
                e.target.style.boxShadow = '0 0 0 3px rgba(99,91,255,0.1)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#E2DFF5';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Severity filter pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['All', 'Error', 'Warning', 'Info'].map(s => (
              <button key={s} onClick={() => setSeverityFilter(s.toLowerCase())}
                style={{
                  padding: '6px 14px', borderRadius: '20px',
                  font: '12px Sora', fontWeight: 600, cursor: 'pointer',
                  border: '1px solid',
                  transition: 'all 150ms ease',
                  ...(severityFilter === s.toLowerCase() ? {
                    background: '#635BFF', color: 'white', borderColor: '#635BFF',
                    boxShadow: '0 2px 8px rgba(99,91,255,0.3)'
                  } : {
                    background: 'transparent', color: '#6B7280', borderColor: '#E2DFF5'
                  })
                }}>
                {s}
              </button>
            ))}
          </div>

          {/* Category dropdown */}
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            style={{
              padding: '8px 14px', background: '#F8F7FF',
              border: '1px solid #E2DFF5', borderRadius: '8px',
              font: '13px Sora', color: '#1E1B4B', cursor: 'pointer',
              outline: 'none'
            }}>
            <option value="all">All Categories</option>
            <option value="Field Quality">Field Quality</option>
            <option value="Broken Reference">Broken Reference</option>
            <option value="Duplicate Definition">Duplicate Definition</option>
            <option value="Join Integrity">Join Integrity</option>
          </select>

          {/* Results count */}
          <span style={{ font: '12px Sora', color: '#9CA3AF', marginLeft: 'auto' }}>
            {filteredRules.length} rules
          </span>
        </div>

        {/* Rule cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '20px'
        }}>
          {filteredRules.map((rule, idx) => {
            const severityConfig = {
              error:   { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'ERROR'   },
              warning: { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'WARNING' },
              info:    { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', label: 'INFO'    },
            }[rule.severity];

            const expanded = expandedRules.has(rule.id);

            return (
              <div key={rule.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2DFF5',
                  borderLeft: `4px solid ${severityConfig.color}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(99,91,255,0.06)',
                  transition: 'all 200ms ease',
                  opacity: 0,
                  animation: `fadeInUp 0.5s ease-out ${0.1 + idx * 0.06}s forwards`,
                  cursor: 'pointer'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(99,91,255,0.12)';
                  e.currentTarget.style.borderColor = 'rgba(99,91,255,0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,91,255,0.06)';
                  e.currentTarget.style.borderColor = '#E2DFF5';
                }}
              >
                {/* Card content wrapper (to prevent click on expansion from triggering card hover/click logic if needed, 
                    but here we just wrap the non-toggle part) */}
                <div style={{ padding: '20px 20px 0 20px' }} onClick={() => toggleRule(rule.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    {/* Rule ID chip */}
                    <code style={{
                      font: '12px "Fira Code", monospace',
                      color: '#635BFF', background: '#EEF2FF',
                      border: '1px solid rgba(99,91,255,0.15)',
                      padding: '3px 10px', borderRadius: '6px'
                    }}>
                      {rule.id}
                    </code>
                    {/* Severity badge */}
                    <span style={{
                      font: '10px Sora', fontWeight: 700,
                      color: severityConfig.color,
                      background: severityConfig.bg,
                      border: `1px solid ${severityConfig.border}`,
                      borderRadius: '20px', padding: '3px 10px',
                      letterSpacing: '0.06em'
                    }}>
                      {severityConfig.label}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 style={{ font: '16px Sora', fontWeight: 700, color: '#1E1B4B', marginBottom: '8px' }}>
                    {rule.title}
                  </h3>

                  {/* Description */}
                  <p style={{ font: '13px Inter', color: '#6B7280', lineHeight: 1.6, marginBottom: '14px' }}>
                    {rule.description}
                  </p>

                  {/* Category tag */}
                  <div style={{
                    display: 'inline-block',
                    font: '10px Sora', fontWeight: 700, letterSpacing: '0.08em',
                    color: '#9CA3AF', marginBottom: '16px',
                    textTransform: 'uppercase'
                  }}>
                    {rule.category}
                  </div>
                </div>

                {/* Expand toggle */}
                <div
                  onClick={() => toggleRule(rule.id)}
                  style={{
                    padding: '12px 20px',
                    borderTop: '1px solid #F0EEFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: expanded ? '#FAFBFF' : 'transparent',
                    transition: 'background 150ms'
                  }}
                >
                  <span style={{ font: '12px Sora', fontWeight: 600, color: '#635BFF' }}>
                    {expanded ? 'Hide example' : 'View example →'}
                  </span>
                  <span style={{
                    color: '#635BFF', fontSize: '14px', fontWeight: 700,
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms ease', display: 'inline-block'
                  }}>
                    ↓
                  </span>
                </div>

                {/* Expandable example */}
                <div style={{
                  maxHeight: expanded ? '600px' : '0',
                  overflow: 'hidden',
                  transition: 'max-height 300ms ease-out'
                }}>
                  <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Bad example */}
                    <div style={{ background: '#FEF2F2', borderRadius: '8px', padding: '12px 14px', border: '1px solid #FECACA' }}>
                      <div style={{ font: '10px Sora', fontWeight: 700, color: '#DC2626', letterSpacing: '0.08em', marginBottom: '8px' }}>
                        ✗ BAD
                      </div>
                      <pre style={{ fontFamily: '"Fira Code", monospace', fontSize: '11px', color: '#374151', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                        {rule.badExample}
                      </pre>
                    </div>
                    {/* Good example */}
                    <div style={{ background: '#F0FDF4', borderRadius: '8px', padding: '12px 14px', border: '1px solid #BBF7D0' }}>
                      <div style={{ font: '10px Sora', fontWeight: 700, color: '#09A55A', letterSpacing: '0.08em', marginBottom: '8px' }}>
                        ✓ GOOD
                      </div>
                      <pre style={{ fontFamily: '"Fira Code", monospace', fontSize: '11px', color: '#374151', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                        {rule.goodExample}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
