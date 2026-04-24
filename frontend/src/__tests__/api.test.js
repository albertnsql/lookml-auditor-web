/**
 * api.test.js — Unit tests for src/api.js
 *
 * Mocks the global fetch so no real network calls are made.
 * Tests every method on the `api` object:
 *   health, auditGithub, auditLocal, auditUpload, getFiles, getFileContent, cleanup
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mockFetch(body, ok = true, status = 200) {
  const response = {
    ok,
    status,
    statusText: ok ? 'OK' : 'Bad Request',
    json: vi.fn().mockResolvedValue(body),
  };
  global.fetch = vi.fn().mockResolvedValue(response);
  return response;
}

function mockFetchError(body, status = 400) {
  return mockFetch(body, false, status);
}

// ─────────────────────────────────────────────────────────────────────────────
// health
// ─────────────────────────────────────────────────────────────────────────────

describe('api.health', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/health', async () => {
    mockFetch({ status: 'ok' });
    await api.health();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/health'), {});
  });

  it('returns parsed JSON body', async () => {
    mockFetch({ status: 'ok', message: 'running' });
    const result = await api.health();
    expect(result.status).toBe('ok');
  });

  it('throws on non-ok response', async () => {
    mockFetchError({ detail: 'Server error' }, 500);
    await expect(api.health()).rejects.toThrow('Server error');
  });

  it('throws HTTP status text when detail missing', async () => {
    const res = { ok: false, status: 503, statusText: 'Service Unavailable', json: vi.fn().mockRejectedValue(new Error()) };
    global.fetch = vi.fn().mockResolvedValue(res);
    await expect(api.health()).rejects.toThrow('Service Unavailable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// auditGithub
// ─────────────────────────────────────────────────────────────────────────────

describe('api.auditGithub', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls POST /api/audit/github with url and subfolder', async () => {
    mockFetch({ health_score: 90 });
    await api.auditGithub('https://github.com/org/repo', 'lookml/');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/audit/github'),
      expect.objectContaining({ method: 'POST' }),
    );
    const [, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.url).toBe('https://github.com/org/repo');
    expect(body.subfolder).toBe('lookml/');
  });

  it('defaults subfolder to empty string', async () => {
    mockFetch({ health_score: 80 });
    await api.auditGithub('https://github.com/org/repo');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.subfolder).toBe('');
  });

  it('sends Content-Type application/json', async () => {
    mockFetch({ health_score: 75 });
    await api.auditGithub('https://github.com/org/repo');
    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('throws on error response', async () => {
    mockFetchError({ detail: 'git clone failed' }, 400);
    await expect(api.auditGithub('https://bad.url')).rejects.toThrow('git clone failed');
  });

  it('returns parsed audit response', async () => {
    mockFetch({ health_score: 95, views: [], issues: [] });
    const result = await api.auditGithub('https://github.com/org/repo');
    expect(result.health_score).toBe(95);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// auditLocal
// ─────────────────────────────────────────────────────────────────────────────

describe('api.auditLocal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls POST /api/audit/local', async () => {
    mockFetch({ health_score: 80 });
    await api.auditLocal('/home/user/project');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/audit/local'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends path in request body', async () => {
    mockFetch({ health_score: 80 });
    await api.auditLocal('/home/user/project');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.path).toBe('/home/user/project');
  });

  it('throws on 400 response', async () => {
    mockFetchError({ detail: 'Valid local directory path is required.' }, 400);
    await expect(api.auditLocal('')).rejects.toThrow('Valid local directory path is required.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// auditUpload
// ─────────────────────────────────────────────────────────────────────────────

describe('api.auditUpload', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls POST /api/audit/upload', async () => {
    mockFetch({ health_score: 70 });
    const file = new File(['content'], 'project.zip', { type: 'application/zip' });
    await api.auditUpload(file);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/audit/upload'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends FormData body (no Content-Type header)', async () => {
    mockFetch({ health_score: 70 });
    const file = new File(['content'], 'project.zip', { type: 'application/zip' });
    await api.auditUpload(file);
    const [, options] = fetch.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    // Content-Type must NOT be set manually (browser sets it with boundary)
    expect(options.headers).toBeUndefined();
  });

  it('appends file under "file" key in FormData', async () => {
    mockFetch({ health_score: 70 });
    const file = new File(['zip content'], 'project.zip', { type: 'application/zip' });
    await api.auditUpload(file);
    const [, options] = fetch.mock.calls[0];
    const fd = options.body;
    expect(fd.get('file')).toEqual(file);
  });

  it('throws on 400 for non-zip', async () => {
    mockFetchError({ detail: 'Only .zip files are accepted.' }, 400);
    const file = new File(['txt'], 'project.txt', { type: 'text/plain' });
    await expect(api.auditUpload(file)).rejects.toThrow('Only .zip files are accepted.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getFiles
// ─────────────────────────────────────────────────────────────────────────────

describe('api.getFiles', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/audit/files', async () => {
    mockFetch({ files: [] });
    await api.getFiles();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/audit/files'), {});
  });

  it('returns files array', async () => {
    mockFetch({ files: [{ path: '/a.lkml', relative: 'a.lkml' }] });
    const result = await api.getFiles();
    expect(result.files).toHaveLength(1);
  });

  it('throws on 404 (no audit yet)', async () => {
    mockFetchError({ detail: 'No audit has been run yet.' }, 404);
    await expect(api.getFiles()).rejects.toThrow('No audit has been run yet.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getFileContent
// ─────────────────────────────────────────────────────────────────────────────

describe('api.getFileContent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/audit/file?path=...', async () => {
    mockFetch({ content: 'view: orders {}', path: '/orders.lkml' });
    await api.getFileContent('/orders.lkml');
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('/api/audit/file');
    expect(url).toContain('path=');
    expect(url).toContain(encodeURIComponent('/orders.lkml'));
  });

  it('returns content field', async () => {
    mockFetch({ content: 'view: orders {}', path: '/orders.lkml' });
    const result = await api.getFileContent('/orders.lkml');
    expect(result.content).toBe('view: orders {}');
  });

  it('throws on 404 for missing file', async () => {
    mockFetchError({ detail: 'File not found: /missing.lkml' }, 404);
    await expect(api.getFileContent('/missing.lkml'))
      .rejects.toThrow('File not found: /missing.lkml');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cleanup
// ─────────────────────────────────────────────────────────────────────────────

describe('api.cleanup', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls DELETE /api/audit/cleanup', async () => {
    mockFetch({ status: 'deleted', path: '/tmp/lookml_audit_xyz' });
    await api.cleanup();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/audit/cleanup'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('returns status from response', async () => {
    mockFetch({ status: 'nothing_to_clean' });
    const result = await api.cleanup();
    expect(result.status).toBe('nothing_to_clean');
  });

  it('throws on server error', async () => {
    mockFetchError({ detail: 'Cleanup failed' }, 500);
    await expect(api.cleanup()).rejects.toThrow('Cleanup failed');
  });
});
