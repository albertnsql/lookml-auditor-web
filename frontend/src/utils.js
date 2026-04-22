// Shared utilities used across tabs

const healthConfig = {
  'Healthy':         { bg: '#DCFCE7', color: '#15803D', dot: '#22C55E' },
  'Good':            { bg: '#FEF9C3', color: '#A16207', dot: '#EAB308' },
  'Needs Attention': { bg: '#FFEDD5', color: '#C2410C', dot: '#F97316' },
  'Critical':        { bg: '#FEE2E2', color: '#B91C1C', dot: '#EF4444' },
};

export function scoreMeta(s) {
  let label = 'Critical';
  if (s >= 90)      label = 'Healthy';
  else if (s >= 80) label = 'Good';
  else if (s >= 70) label = 'Needs Attention';
  
  return { ...healthConfig[label], label };
}

export function severityColor(sev) {
  if (sev === 'error')   return 'var(--error)';
  if (sev === 'warning') return 'var(--warning)';
  return 'var(--info)';
}

export function severityBadgeClass(sev) {
  if (sev === 'error')   return 'badge badge-error';
  if (sev === 'warning') return 'badge badge-warning';
  return 'badge badge-info';
}

export function relFileName(path) {
  if (!path) return '—';
  return path.replace(/\\/g, '/').split('/').pop();
}

export function downloadCSV(issues, projectName) {
  const headers = ['Severity','Category','Object','Type','Message','Suggestion','File','Line'];
  const rows = issues.map(i => [
    i.severity.toUpperCase(),
    i.category,
    i.object_name,
    i.object_type || '',
    i.message,
    i.suggestion || '',
    relFileName(i.source_file),
    i.line_number || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `lookml_audit_${projectName}.csv`; a.click();
  URL.revokeObjectURL(url);
}
