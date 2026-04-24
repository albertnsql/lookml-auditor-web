import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import './index.css';
import LandingPage from './components/LandingPage';
import Dashboard   from './components/Dashboard';
import RulesPage   from './components/RulesPage';
import ScrollToTop from './components/ScrollToTop';
import { useAudit } from './hooks/useAudit';

export default function App() {
  const { result, loading, runGithub, runUpload, reset } = useAudit();
  const location = useLocation();
  const path = location.pathname;

  // Create a new reference with a timestamp whenever result changes
  const auditData = useMemo(() => {
    if (!result) return null;
    return { ...result, _auditTimestamp: Date.now() };
  }, [result]);

  return (
    <>
      <ScrollToTop />
      {path === '/rules' ? (
        <RulesPage />
      ) : auditData ? (
        <Dashboard auditData={auditData} isLoading={loading} onReset={reset} />
      ) : (
        <LandingPage 
          onAuditDone={(data) => {}} 
          useAuditProps={{ runGithub, runUpload, loading }}
        />
      )}
    </>
  );
}
