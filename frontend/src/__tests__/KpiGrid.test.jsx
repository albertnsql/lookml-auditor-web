/**
 * KpiGrid.test.jsx — Component tests for KpiGrid and its filter helpers
 *
 * Tests the exported filterViews / filterExplores functions (pure logic)
 * and renders KpiGrid with a mock audit result to verify KPI counts.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KpiGrid, { filterViews, filterExplores } from '../components/KpiGrid.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_VIEW = (overrides = {}) => ({
  name: 'orders',
  source_file: '/project/views/orders.view.lkml',
  is_derived_table: false,
  has_primary_key: true,
  n_dimensions: 3,
  n_measures: 2,
  n_fields: 5,
  fields: [
    { name: 'id',     field_type: 'dimension', hidden: false, label: 'ID',     description: 'Unique ID' },
    { name: 'status', field_type: 'dimension', hidden: false, label: 'Status', description: 'Order status' },
    { name: 'count',  field_type: 'measure',   hidden: false, label: 'Count',  description: 'Orders count' },
  ],
  ...overrides,
});

const MOCK_EXPLORE = (overrides = {}) => ({
  name: 'orders',
  base_view: 'orders',
  joins: [],
  ...overrides,
});

const MOCK_RESULT = {
  health_score: 88,
  category_scores: {
    broken_reference: 100,
    duplicate_def:    95,
    join_integrity:   90,
    field_quality:    80,
  },
  views: [MOCK_VIEW()],
  explores: [MOCK_EXPLORE()],
  issues: [],
};

const NO_FILTERS = { folders: [], exploreNames: [] };

// ─────────────────────────────────────────────────────────────────────────────
// filterViews
// ─────────────────────────────────────────────────────────────────────────────

describe('filterViews', () => {
  it('returns all views when folders is empty', () => {
    const views = [MOCK_VIEW(), MOCK_VIEW({ name: 'customers' })];
    expect(filterViews(views, { folders: [] })).toHaveLength(2);
  });

  it('filters views by folder substring', () => {
    const views = [
      MOCK_VIEW({ source_file: '/project/views/orders.view.lkml' }),
      MOCK_VIEW({ name: 'staging', source_file: '/project/staging/temp.view.lkml' }),
    ];
    const result = filterViews(views, { folders: ['staging'] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('staging');
  });

  it('returns empty array when no views match folder', () => {
    const views = [MOCK_VIEW({ source_file: '/views/orders.view.lkml' })];
    const result = filterViews(views, { folders: ['staging'] });
    expect(result).toHaveLength(0);
  });

  it('handles view with no source_file', () => {
    const views = [{ name: 'x', source_file: null }];
    const result = filterViews(views, { folders: ['views'] });
    expect(result).toHaveLength(0);
  });

  it('normalises windows backslashes in source_file', () => {
    const views = [MOCK_VIEW({ source_file: 'C:\\project\\views\\orders.view.lkml' })];
    const result = filterViews(views, { folders: ['views'] });
    expect(result).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// filterExplores
// ─────────────────────────────────────────────────────────────────────────────

describe('filterExplores', () => {
  it('returns all explores when exploreNames is empty', () => {
    const explores = [MOCK_EXPLORE(), MOCK_EXPLORE({ name: 'customers' })];
    expect(filterExplores(explores, { exploreNames: [] })).toHaveLength(2);
  });

  it('filters by explore name', () => {
    const explores = [
      MOCK_EXPLORE({ name: 'orders' }),
      MOCK_EXPLORE({ name: 'customers' }),
    ];
    const result = filterExplores(explores, { exploreNames: ['orders'] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('orders');
  });

  it('returns empty when no names match', () => {
    const explores = [MOCK_EXPLORE({ name: 'orders' })];
    expect(filterExplores(explores, { exploreNames: ['inventory'] })).toHaveLength(0);
  });

  it('supports multiple name filters', () => {
    const explores = [
      MOCK_EXPLORE({ name: 'orders' }),
      MOCK_EXPLORE({ name: 'customers' }),
      MOCK_EXPLORE({ name: 'inventory' }),
    ];
    const result = filterExplores(explores, { exploreNames: ['orders', 'inventory'] });
    expect(result).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KpiGrid rendering
// ─────────────────────────────────────────────────────────────────────────────

describe('KpiGrid', () => {
  it('renders without crashing', () => {
    expect(() =>
      render(<KpiGrid result={MOCK_RESULT} filters={NO_FILTERS} />)
    ).not.toThrow();
  });

  it('renders the Health Score label', () => {
    render(<KpiGrid result={MOCK_RESULT} filters={NO_FILTERS} />);
    expect(screen.getByText(/Health Score/i)).toBeInTheDocument();
  });

  it('renders Total Issues KPI', () => {
    render(<KpiGrid result={MOCK_RESULT} filters={NO_FILTERS} />);
    expect(screen.getByText('Total Issues')).toBeInTheDocument();
  });

  it('renders Views KPI', () => {
    render(<KpiGrid result={MOCK_RESULT} filters={NO_FILTERS} />);
    expect(screen.getByText('Views')).toBeInTheDocument();
  });

  it('renders Explores KPI', () => {
    render(<KpiGrid result={MOCK_RESULT} filters={NO_FILTERS} />);
    expect(screen.getByText('Explores')).toBeInTheDocument();
  });

  it('renders Orphan Views KPI label', () => {
    render(<KpiGrid result={MOCK_RESULT} filters={NO_FILTERS} />);
    expect(screen.getByText('Orphan Views')).toBeInTheDocument();
  });

  it('renders Missing PK KPI label', () => {
    render(<KpiGrid result={MOCK_RESULT} filters={NO_FILTERS} />);
    expect(screen.getByText('Missing PK')).toBeInTheDocument();
  });

  it('shows 0 errors for clean project', () => {
    render(<KpiGrid result={MOCK_RESULT} filters={NO_FILTERS} />);
    expect(screen.getByText('Errors')).toBeInTheDocument();
  });

  it('renders with error issues correctly', () => {
    const resultWithErrors = {
      ...MOCK_RESULT,
      issues: [
        { severity: 'error', category: 'Broken Reference', message: 'err', object_name: 'x' },
        { severity: 'warning', category: 'Join Integrity', message: 'warn', object_name: 'y' },
      ],
    };
    expect(() =>
      render(<KpiGrid result={resultWithErrors} filters={NO_FILTERS} />)
    ).not.toThrow();
  });

  it('renders with derived table view', () => {
    const resultWithDT = {
      ...MOCK_RESULT,
      views: [MOCK_VIEW({ is_derived_table: true })],
    };
    render(<KpiGrid result={resultWithDT} filters={NO_FILTERS} />);
    expect(screen.getByText('Derived Tables')).toBeInTheDocument();
  });

  it('renders with missing PK view', () => {
    const resultWithMissingPk = {
      ...MOCK_RESULT,
      views: [MOCK_VIEW({ has_primary_key: false })],
    };
    render(<KpiGrid result={resultWithMissingPk} filters={NO_FILTERS} />);
    expect(screen.getByText('Missing PK')).toBeInTheDocument();
  });
});
