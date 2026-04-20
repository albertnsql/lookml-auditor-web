/**
 * useAudit.test.jsx — Tests for the useAudit hook
 *
 * Mocks src/api.js so no real network calls are made.
 * Tests state transitions: idle → loading → success / error, and cleanup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudit } from '../hooks/useAudit.js';

// ── Mock the api module ──────────────────────────────────────────────────────

const mockAuditGithub = vi.fn();
const mockAuditUpload = vi.fn();
const mockCleanup     = vi.fn();

vi.mock('../api.js', () => ({
  api: {
    auditGithub: (...args) => mockAuditGithub(...args),
    auditUpload: (...args) => mockAuditUpload(...args),
    cleanup:     (...args) => mockCleanup(...args),
  },
}));

const MOCK_RESULT = {
  health_score: 85,
  views: [],
  explores: [],
  issues: [],
  category_scores: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────

describe('useAudit — initial state', () => {
  it('result is null initially', () => {
    const { result } = renderHook(() => useAudit());
    expect(result.current.result).toBeNull();
  });

  it('loading is false initially', () => {
    const { result } = renderHook(() => useAudit());
    expect(result.current.loading).toBe(false);
  });

  it('error is null initially', () => {
    const { result } = renderHook(() => useAudit());
    expect(result.current.error).toBeNull();
  });

  it('exposes runGithub, runUpload, reset, cleanup functions', () => {
    const { result } = renderHook(() => useAudit());
    expect(typeof result.current.runGithub).toBe('function');
    expect(typeof result.current.runUpload).toBe('function');
    expect(typeof result.current.reset).toBe('function');
    expect(typeof result.current.cleanup).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runGithub — success
// ─────────────────────────────────────────────────────────────────────────────

describe('useAudit.runGithub — success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditGithub.mockResolvedValue(MOCK_RESULT);
  });

  it('sets result on success', async () => {
    const { result } = renderHook(() => useAudit());
    await act(() => result.current.runGithub('https://github.com/org/repo'));
    expect(result.current.result).toEqual(MOCK_RESULT);
  });

  it('loading becomes false after success', async () => {
    const { result } = renderHook(() => useAudit());
    await act(() => result.current.runGithub('https://github.com/org/repo'));
    expect(result.current.loading).toBe(false);
  });

  it('error remains null on success', async () => {
    const { result } = renderHook(() => useAudit());
    await act(() => result.current.runGithub('https://github.com/org/repo'));
    expect(result.current.error).toBeNull();
  });

  it('calls api.auditGithub with url and subfolder', async () => {
    const { result } = renderHook(() => useAudit());
    await act(() => result.current.runGithub('https://github.com/org/repo', 'sub/'));
    expect(mockAuditGithub).toHaveBeenCalledWith('https://github.com/org/repo', 'sub/');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runGithub — error
// ─────────────────────────────────────────────────────────────────────────────

describe('useAudit.runGithub — error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditGithub.mockRejectedValue(new Error('git clone failed'));
  });

  it('sets error on failure', async () => {
    const { result } = renderHook(() => useAudit());
    await act(() => result.current.runGithub('https://bad.url'));
    expect(result.current.error).toBe('git clone failed');
  });

  it('result remains null on failure', async () => {
    const { result } = renderHook(() => useAudit());
    await act(() => result.current.runGithub('https://bad.url'));
    expect(result.current.result).toBeNull();
  });

  it('loading is false after error', async () => {
    const { result } = renderHook(() => useAudit());
    await act(() => result.current.runGithub('https://bad.url'));
    expect(result.current.loading).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runUpload — success / error
// ─────────────────────────────────────────────────────────────────────────────

describe('useAudit.runUpload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets result on upload success', async () => {
    mockAuditUpload.mockResolvedValue(MOCK_RESULT);
    const { result } = renderHook(() => useAudit());
    const file = new File(['zip'], 'project.zip');
    await act(() => result.current.runUpload(file));
    expect(result.current.result).toEqual(MOCK_RESULT);
  });

  it('calls api.auditUpload with the file', async () => {
    mockAuditUpload.mockResolvedValue(MOCK_RESULT);
    const { result } = renderHook(() => useAudit());
    const file = new File(['zip'], 'project.zip');
    await act(() => result.current.runUpload(file));
    expect(mockAuditUpload).toHaveBeenCalledWith(file);
  });

  it('sets error on upload failure', async () => {
    mockAuditUpload.mockRejectedValue(new Error('Only .zip files accepted.'));
    const { result } = renderHook(() => useAudit());
    await act(() => result.current.runUpload(new File(['txt'], 'project.txt')));
    expect(result.current.error).toBe('Only .zip files accepted.');
  });

  it('clears previous error before new run', async () => {
    mockAuditUpload
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(MOCK_RESULT);
    const { result } = renderHook(() => useAudit());
    // first call fails
    await act(() => result.current.runUpload(new File(['x'], 'x.zip')));
    expect(result.current.error).toBe('fail');
    // second call succeeds
    await act(() => result.current.runUpload(new File(['y'], 'y.zip')));
    expect(result.current.error).toBeNull();
    expect(result.current.result).toEqual(MOCK_RESULT);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reset
// ─────────────────────────────────────────────────────────────────────────────

describe('useAudit.reset', () => {
  it('clears result', async () => {
    mockAuditGithub.mockResolvedValue(MOCK_RESULT);
    const { result } = renderHook(() => useAudit());
    await act(() => result.current.runGithub('https://github.com/org/repo'));
    expect(result.current.result).not.toBeNull();
    act(() => result.current.reset());
    expect(result.current.result).toBeNull();
  });

  it('clears error', async () => {
    mockAuditGithub.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAudit());
    await act(() => result.current.runGithub('https://bad'));
    expect(result.current.error).toBe('boom');
    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cleanup
// ─────────────────────────────────────────────────────────────────────────────

describe('useAudit.cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditGithub.mockResolvedValue(MOCK_RESULT);
    mockCleanup.mockResolvedValue({ status: 'deleted' });
  });

  it('calls api.cleanup', async () => {
    const { result } = renderHook(() => useAudit());
    await act(() => result.current.cleanup());
    expect(mockCleanup).toHaveBeenCalledOnce();
  });

  it('resets result and error after cleanup', async () => {
    const { result } = renderHook(() => useAudit());
    await act(() => result.current.runGithub('https://github.com/org/repo'));
    expect(result.current.result).not.toBeNull();
    await act(() => result.current.cleanup());
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('does not throw if api.cleanup rejects', async () => {
    mockCleanup.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useAudit());
    await expect(act(() => result.current.cleanup())).resolves.not.toThrow();
  });
});
