import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';

export default function FixPreviewModal({ issue, onClose, onConfirm }) {
  const [contentLines, setContentLines] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    let active = true;
    api.getFileContent(issue.source_file)
      .then(data => {
        if (active) {
          setContentLines(data.content.split('\n'));
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          setError(err.message);
          setIsLoading(false);
        }
      });
    return () => { active = false; };
  }, [issue.source_file]);

  const handleConfirm = async () => {
    setIsApplying(true);
    try {
      await api.auditFix(issue.source_file, issue.fix_payload);
      onConfirm(issue);
    } catch (err) {
      alert("Fix failed: " + err.message);
      setIsApplying(false);
    }
  };

  const renderDiff = () => {
    if (!contentLines) return null;
    
    const { line_number, insert_text, replace_lines = 0 } = issue.fix_payload;
    const targetIdx = line_number - 1;
    
    const startIdx = Math.max(0, targetIdx - 4);
    const endIdx = Math.min(contentLines.length, targetIdx + replace_lines + 5);
    
    const rows = [];
    
    // Top Context
    for (let i = startIdx; i < targetIdx; i++) {
      const node = { type: 'context', lineNum: i + 1, text: contentLines[i] };
      rows.push({ left: node, right: node });
    }
    
    // Modifications
    const removedNodes = [];
    for (let i = targetIdx; i < targetIdx + replace_lines; i++) {
      removedNodes.push({ type: 'removed', lineNum: i + 1, text: contentLines[i] });
    }
    
    const addedNodes = [];
    if (insert_text) {
      const insertedLines = insert_text.split('\n');
      insertedLines.forEach((text, idx) => {
        addedNodes.push({ type: 'added', lineNum: targetIdx + 1 + idx, text }); 
      });
    }
    
    const maxModLines = Math.max(removedNodes.length, addedNodes.length);
    for (let i = 0; i < maxModLines; i++) {
      rows.push({
        left: removedNodes[i] || { type: 'empty', lineNum: '', text: '' },
        right: addedNodes[i] || { type: 'empty', lineNum: '', text: '' }
      });
    }
    
    // Bottom Context
    const rightLineOffset = addedNodes.length - removedNodes.length;
    for (let i = targetIdx + replace_lines; i < endIdx; i++) {
      rows.push({
        left: { type: 'context', lineNum: i + 1, text: contentLines[i] },
        right: { type: 'context', lineNum: i + 1 + rightLineOffset, text: contentLines[i] }
      });
    }

    const renderPaneRow = (node) => {
      let bg = 'transparent';
      let indicator = ' ';
      if (node.type === 'added') {
        bg = 'rgba(46, 160, 67, 0.2)';
        indicator = '+';
      } else if (node.type === 'removed') {
        bg = 'rgba(248, 81, 73, 0.2)';
        indicator = '-';
      } else if (node.type === 'empty') {
        bg = 'rgba(110, 118, 129, 0.1)';
      }
    
      return (
        <div style={{ display: 'flex', backgroundColor: bg, height: '24px', boxSizing: 'border-box' }}>
          <div style={{ width: '40px', padding: '2px 8px', color: '#6e7681', textAlign: 'right', borderRight: '1px solid #30363d', userSelect: 'none', flexShrink: 0 }}>
            {node.lineNum}
          </div>
          <div style={{ width: '24px', padding: '2px 8px', color: node.type === 'added' ? '#3fb950' : node.type === 'removed' ? '#f85149' : '#6e7681', userSelect: 'none', flexShrink: 0 }}>
            {indicator}
          </div>
          <div style={{ padding: '2px 8px', whiteSpace: 'pre', overflowX: 'hidden', flex: 1, textOverflow: 'ellipsis' }}>
            {node.text}
          </div>
        </div>
      );
    };
    
    return (
      <div style={{ display: 'flex', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden', background: '#1e1e1e', color: '#d4d4d4', fontFamily: "'Fira Code', monospace", fontSize: '13px' }}>
        <div style={{ flex: 1, borderRight: '1px solid #30363d', minWidth: 0, overflowX: 'auto' }}>
          <div style={{ padding: '8px 12px', background: '#2d2d2d', fontWeight: 600, borderBottom: '1px solid #30363d', color: '#fff' }}>Current LookML</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((r, idx) => (
              <React.Fragment key={`l-${idx}`}>{renderPaneRow(r.left)}</React.Fragment>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
          <div style={{ padding: '8px 12px', background: '#2d2d2d', fontWeight: 600, borderBottom: '1px solid #30363d', color: '#fff' }}>Optimized LookML</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((r, idx) => (
              <React.Fragment key={`r-${idx}`}>{renderPaneRow(r.right)}</React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'var(--surface)', width: '1200px', maxWidth: '95vw', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Review Fix: {issue.message}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-2)' }}>✕</button>
        </div>
        
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto', maxHeight: '60vh' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>Loading file context...</div>
          ) : error ? (
            <div style={{ color: 'var(--error)' }}>{error}</div>
          ) : (
            renderDiff()
          )}
        </div>
        
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--bg)', borderRadius: '0 0 12px 12px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isApplying}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={isApplying || isLoading || !!error}>
            {isApplying ? 'Applying...' : 'Confirm Fix'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
