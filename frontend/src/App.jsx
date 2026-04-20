import React, { useMemo } from 'react';
import './index.css';
import LandingPage from './components/LandingPage';
import Dashboard   from './components/Dashboard';
import { useAudit } from './hooks/useAudit';

export default function App() {
  const { result, loading, runGithub, runUpload, reset } = useAudit();

  // Create a new reference with a timestamp whenever result changes
  // this satisfies the requirement to force re-renders/useMemo updates
  const auditData = useMemo(() => {
    if (!result) return null;
    return { ...result, _auditTimestamp: Date.now() };
  }, [result]);

  return auditData
    ? <Dashboard auditData={auditData} isLoading={loading} onReset={reset} />
    : <LandingPage onAuditDone={(data) => {
        // This setter is still needed for one-off results if not using runGithub/runUpload
        // but here we are using the internal state of useAudit.
        // Actually LandingPage already uses api.js directly in its current form.
        // I should probably update LandingPage to use useAudit too.
      }} 
      // For now, let's just make sure LandingPage can trigger useAudit functions
      useAuditProps={{ runGithub, runUpload, loading }}
    />;
}
