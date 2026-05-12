// api.js — All fetch helpers for the LookML Auditor API

const BASE = import.meta.env.VITE_API_URL || 'https://lookml-auditor-web.onrender.com/api';

async function _fetch(url, options = {}) {
  const res = await fetch(BASE + url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => _fetch('/health'),

  auditGithub: (url, subfolder = '') =>
    _fetch('/audit/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, subfolder }),
    }),

  /**
   * Streaming GitHub audit — uses the SSE endpoint for real progress updates.
   *
   * @param {string} url          - GitHub repo URL
   * @param {string} subfolder    - Optional subfolder
   * @param {function} onProgress - Called with each SSE event object:
   *                                { stage, pct, files_done?, files_total? }
   * @returns {Promise<object>}   - Resolves with the full AuditResponse when pct===100
   */
  auditGithubStream: (url, subfolder = '', onProgress = () => {}) =>
    new Promise(async (resolve, reject) => {
      try {
        const res = await fetch(BASE + '/audit/github/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, subfolder }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          return reject(new Error(err.detail || `HTTP ${res.status}`));
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop(); // keep incomplete tail

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data:')) continue;
            try {
              const event = JSON.parse(line.slice(5).trim());
              onProgress(event);
              if (event.pct === 100 && event.result) {
                return resolve(event.result);
              }
              if (event.pct === -1) {
                return reject(new Error(event.error || 'Audit failed'));
              }
            } catch (_) {
              // ignore malformed SSE lines
            }
          }
        }
        reject(new Error('SSE stream ended without a result'));
      } catch (e) {
        reject(e);
      }
    }),

  auditLocal: (path) =>
    _fetch('/audit/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }),

  auditUpload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return _fetch('/audit/upload', { method: 'POST', body: fd });
  },

  getFiles: () => _fetch('/audit/files'),

  getFileContent: (path) =>
    _fetch('/audit/file?' + new URLSearchParams({ path })),

  cleanup: () => _fetch('/audit/cleanup', { method: 'DELETE' }),
};

