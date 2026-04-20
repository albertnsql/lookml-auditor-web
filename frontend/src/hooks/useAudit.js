import { useState, useCallback } from 'react';
import { api } from '../api';

// Central hook that holds audit results and drives the app state
export function useAudit() {
  const [result, setResult] = useState(null);     // AuditResponse | null
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const runLocal = useCallback(async (path) => {
    setLoading(true); setError(null);
    try {
      const data = await api.auditLocal(path);
      setResult({ ...data, _auditTimestamp: Date.now() });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const runGithub = useCallback(async (url, subfolder) => {
    setLoading(true); setError(null);
    try {
      const data = await api.auditGithub(url, subfolder);
      setResult({ ...data, _auditTimestamp: Date.now() });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const runUpload = useCallback(async (file) => {
    setLoading(true); setError(null);
    try {
      const data = await api.auditUpload(file);
      setResult({ ...data, _auditTimestamp: Date.now() });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null); setError(null);
  }, []);

  const cleanup = useCallback(async () => {
    try { await api.cleanup(); } catch (_) {}
    setResult(null); setError(null);
  }, []);

  return { result, loading, error, runGithub, runUpload, runLocal, reset, cleanup };
}
