import React, { useState, useMemo } from 'react';

function buildTree(files) {
  const root = { name: 'root', type: 'folder', children: {}, path: '' };
  files.forEach(f => {
    const parts = f.relative.split(/[/\\]/);
    let curr = root;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) {
        curr.children[p] = { ...f, name: p, type: 'file' };
      } else {
        if (!curr.children[p]) {
          curr.children[p] = { name: p, type: 'folder', children: {}, path: parts.slice(0, i+1).join('/') };
        }
        curr = curr.children[p];
      }
    });
  });
  return root;
}

function TreeNode({ node, level, selectedPath, onSelect }) {
  const [isOpen, setIsOpen] = useState(true);
  
  if (node.type === 'file') {
    const isSelected = selectedPath === node.path;
    return (
      <div 
        onClick={() => onSelect(node.path)}
        style={{
          padding: `4px 8px 4px ${level * 12 + 12}px`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
          background: isSelected ? 'rgba(99,91,255,0.1)' : 'transparent',
          color: isSelected ? 'var(--accent)' : 'var(--text-2)',
          fontSize: '13px',
          borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
          transition: 'all 0.1s'
        }}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg)'; }}
        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ fontSize: '14px', opacity: 0.8 }}>📄</span>
        <span title={node.name} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
      </div>
    );
  }
  
  const children = Object.values(node.children).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  
  return (
    <div>
      {node.name !== 'root' && (
        <div 
          onClick={() => setIsOpen(!isOpen)}
          style={{
            padding: `4px 8px 4px ${level * 12 + 12}px`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            color: 'var(--text-1)',
            fontSize: '13px', fontWeight: 500,
            userSelect: 'none',
            borderLeft: '2px solid transparent'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)' }
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent' }
        >
          <span style={{ fontSize: '14px', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 100ms', display: 'inline-block', width: '14px', textAlign: 'center' }}>▸</span>
          <span style={{ fontSize: '14px', opacity: 0.8 }}>{isOpen ? '📂' : '📁'}</span>
          <span title={node.name} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
        </div>
      )}
      {isOpen && children.map(c => (
        <TreeNode key={c.name} node={c} level={node.name === 'root' ? level : level + 1} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default function FileTree({ files, selectedPath, onSelect }) {
  const tree = useMemo(() => buildTree(files), [files]);
  
  return (
    <div style={{ width: '250px', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)' }}>
        Explorer
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0', fontFamily: 'Inter, sans-serif' }}>
        <TreeNode node={tree} level={0} selectedPath={selectedPath} onSelect={onSelect} />
      </div>
    </div>
  );
}
