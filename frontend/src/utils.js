// Shared utilities used across tabs

export function scoreMeta(s) {
  if (s >= 85) return { color: 'var(--success)', label: 'Healthy' };
  if (s >= 60) return { color: 'var(--warning)', label: 'Needs Attention' };
  return { color: 'var(--error)', label: 'Critical' };
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
