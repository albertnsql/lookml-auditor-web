import { useState, useCallback } from 'react';
import { api } from '../api';

// Central hook that holds audit results and drives the app state
export function useAudit() {
  const [result, setResult] = useState(null);     // AuditResponse | null
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  // Real-time progress state for the streaming GitHub audit
  const [progress, setProgress] = useState({
    stage: '',
    pct: 0,
    filesDone: 0,
    filesTotal: 0,
  });

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

  /**
   * Standard (non-streaming) GitHub audit — used as a fallback for Upload ZIP
   * and local modes. Also used internally if SSE is unavailable.
   */
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

  /**
   * Streaming GitHub audit — calls the SSE endpoint and feeds real stage labels
   * and file counts back through setProgress so the LandingPage progress bar
   * shows genuine progress instead of a simulated animation.
   *
   * Returns a promise that resolves when the audit is complete.
   * The caller (LandingPage.handleRun) should await this.
   */
  const runGithubStream = useCallback(async (url, subfolder) => {
    setLoading(true);
    setError(null);
    setProgress({ stage: 'Connecting...', pct: 2, filesDone: 0, filesTotal: 0 });

    try {
      const data = await api.auditGithubStream(url, subfolder, (event) => {
        setProgress({
          stage: event.stage ?? '',
          pct: Math.max(0, Math.min(99, event.pct ?? 0)),
          filesDone: event.files_done ?? 0,
          filesTotal: event.files_total ?? 0,
        });
      });

      // Snap to 100 before handing off to caller
      setProgress(p => ({ ...p, pct: 100, stage: 'Complete ✓' }));
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
    setProgress({ stage: '', pct: 0, filesDone: 0, filesTotal: 0 });
  }, []);

  const cleanup = useCallback(async () => {
    try { await api.cleanup(); } catch (_) {}
    setResult(null); setError(null);
    setProgress({ stage: '', pct: 0, filesDone: 0, filesTotal: 0 });
  }, []);

  return {
    result, loading, error, progress,
    runGithub, runGithubStream, runUpload, runLocal,
    reset, cleanup,
  };
}
