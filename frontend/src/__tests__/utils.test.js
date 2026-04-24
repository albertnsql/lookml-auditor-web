/**
 * utils.test.js — Unit tests for src/utils.js
 *
 * Tests every exported function:
 *   scoreMeta, severityColor, severityBadgeClass, relFileName, downloadCSV
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scoreMeta,
  severityColor,
  severityBadgeClass,
  relFileName,
  downloadCSV,
} from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// scoreMeta
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreMeta', () => {
  it('returns Healthy label for score >= 90', () => {
    expect(scoreMeta(90).label).toBe('Healthy');
    expect(scoreMeta(100).label).toBe('Healthy');
    expect(scoreMeta(95).label).toBe('Healthy');
  });

  it('returns Good label for 80 <= score < 90', () => {
    expect(scoreMeta(80).label).toBe('Good');
    expect(scoreMeta(89).label).toBe('Good');
    expect(scoreMeta(85).label).toBe('Good');
  });

  it('returns Needs Attention label for 70 <= score < 80', () => {
    expect(scoreMeta(70).label).toBe('Needs Attention');
    expect(scoreMeta(79).label).toBe('Needs Attention');
    expect(scoreMeta(75).label).toBe('Needs Attention');
  });

  it('returns Critical label for score < 70', () => {
    expect(scoreMeta(0).label).toBe('Critical');
    expect(scoreMeta(69).label).toBe('Critical');
    expect(scoreMeta(50).label).toBe('Critical');
  });

  it('returns a bg, color, dot, label for every tier', () => {
    for (const score of [100, 85, 75, 50]) {
      const m = scoreMeta(score);
      expect(m.label).toBeTruthy();
      expect(m.bg).toBeTruthy();
      expect(m.color).toBeTruthy();
      expect(m.dot).toBeTruthy();
    }
  });

  it('boundary 90 is Healthy', () => {
    expect(scoreMeta(90).label).toBe('Healthy');
  });

  it('boundary 89 is Good', () => {
    expect(scoreMeta(89).label).toBe('Good');
  });

  it('boundary 80 is Good', () => {
    expect(scoreMeta(80).label).toBe('Good');
  });

  it('boundary 79 is Needs Attention', () => {
    expect(scoreMeta(79).label).toBe('Needs Attention');
  });

  it('boundary 70 is Needs Attention', () => {
    expect(scoreMeta(70).label).toBe('Needs Attention');
  });

  it('boundary 69 is Critical', () => {
    expect(scoreMeta(69).label).toBe('Critical');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// severityColor
// ─────────────────────────────────────────────────────────────────────────────

describe('severityColor', () => {
  it('returns --error for error severity', () => {
    expect(severityColor('error')).toBe('var(--error)');
  });

  it('returns --warning for warning severity', () => {
    expect(severityColor('warning')).toBe('var(--warning)');
  });

  it('returns --info for info severity', () => {
    expect(severityColor('info')).toBe('var(--info)');
  });

  it('returns --info for unknown severity (fallback)', () => {
    expect(severityColor('unknown')).toBe('var(--info)');
  });

  it('is case-sensitive — ERROR is not the same as error', () => {
    // 'ERROR' should fall through to default
    expect(severityColor('ERROR')).toBe('var(--info)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// severityBadgeClass
// ─────────────────────────────────────────────────────────────────────────────

describe('severityBadgeClass', () => {
  it('returns badge-error class for error', () => {
    expect(severityBadgeClass('error')).toBe('badge badge-error');
  });

  it('returns badge-warning class for warning', () => {
    expect(severityBadgeClass('warning')).toBe('badge badge-warning');
  });

  it('returns badge-info class for info', () => {
    expect(severityBadgeClass('info')).toBe('badge badge-info');
  });

  it('returns badge-info class for unknown values', () => {
    expect(severityBadgeClass('critical')).toBe('badge badge-info');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// relFileName
// ─────────────────────────────────────────────────────────────────────────────

describe('relFileName', () => {
  it('extracts filename from unix path', () => {
    expect(relFileName('/home/user/project/orders.view.lkml'))
      .toBe('orders.view.lkml');
  });

  it('extracts filename from windows path', () => {
    expect(relFileName('C:\\Users\\project\\orders.view.lkml'))
      .toBe('orders.view.lkml');
  });

  it('returns — for null', () => {
    expect(relFileName(null)).toBe('—');
  });

  it('returns — for undefined', () => {
    expect(relFileName(undefined)).toBe('—');
  });

  it('returns — for empty string', () => {
    expect(relFileName('')).toBe('—');
  });

  it('returns bare filename unchanged', () => {
    expect(relFileName('orders.view.lkml')).toBe('orders.view.lkml');
  });

  it('handles mixed separators', () => {
    expect(relFileName('views\\sub/orders.view.lkml'))
      .toBe('orders.view.lkml');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// downloadCSV
// ─────────────────────────────────────────────────────────────────────────────

describe('downloadCSV', () => {
  let createObjectURLMock;
  let revokeObjectURLMock;
  let clickMock;
  let appendChildMock;
  let removeChildMock;

  beforeEach(() => {
    // Mock URL.createObjectURL / revokeObjectURL
    createObjectURLMock = vi.fn().mockReturnValue('blob:mock');
    revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    // Mock anchor click
    clickMock = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return { href: '', download: '', click: clickMock };
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls URL.createObjectURL with a Blob', () => {
    downloadCSV([], 'my_project');
    expect(createObjectURLMock).toHaveBeenCalledOnce();
    const blob = createObjectURLMock.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
  });

  it('triggers a click on the anchor', () => {
    downloadCSV([], 'my_project');
    expect(clickMock).toHaveBeenCalledOnce();
  });

  it('sets the download filename with project name', () => {
    let anchorEl;
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        anchorEl = { href: '', download: '', click: vi.fn() };
        return anchorEl;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    });
    downloadCSV([], 'acme_corp');
    expect(anchorEl.download).toBe('lookml_audit_acme_corp.csv');
  });

  it('calls URL.revokeObjectURL after click', () => {
    downloadCSV([], 'my_project');
    expect(revokeObjectURLMock).toHaveBeenCalledOnce();
  });

  it('CSV blob includes header row', () => {
    downloadCSV([
      {
        severity: 'error', category: 'Broken Reference',
        object_name: 'orders', object_type: 'explore',
        message: 'Missing view', suggestion: 'Add view',
        source_file: 'core.explore.lkml', line_number: 10,
      },
    ], 'proj');
    const blob = createObjectURLMock.mock.calls[0][0];
    // Read blob text
    return blob.text().then((text) => {
      expect(text).toContain('Severity');
      expect(text).toContain('Category');
      expect(text).toContain('Message');
    });
  });

  it('CSV includes issue data rows', () => {
    downloadCSV([
      {
        severity: 'warning', category: 'Join Integrity',
        object_name: 'customers', object_type: 'join',
        message: 'Missing relationship', suggestion: '',
        source_file: 'core.explore.lkml', line_number: 5,
      },
    ], 'proj');
    const blob = createObjectURLMock.mock.calls[0][0];
    return blob.text().then((text) => {
      expect(text).toContain('WARNING');
      expect(text).toContain('Join Integrity');
      expect(text).toContain('customers');
    });
  });

  it('handles empty issues array without throwing', () => {
    expect(() => downloadCSV([], 'test')).not.toThrow();
  });

  it('escapes double-quotes in CSV values', () => {
    downloadCSV([
      {
        severity: 'error', category: 'Field Quality',
        object_name: 'orders.status', object_type: 'field',
        message: 'Contains "quotes" here', suggestion: '',
        source_file: '', line_number: null,
      },
    ], 'proj');
    const blob = createObjectURLMock.mock.calls[0][0];
    return blob.text().then((text) => {
      // CSV escapes " as ""
      expect(text).toContain('""quotes""');
    });
  });
});
