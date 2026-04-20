// api.js — All fetch helpers for the LookML Auditor API

const BASE = '/api';

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
