import React, { useState } from 'react';
import type { GraphData, GraphNode } from '../types';
import { escapeHtml } from '../utils/formatting';

interface TableViewProps {
  graphData: GraphData;
}

export const TableView: React.FC<TableViewProps> = ({ graphData }) => {
  const accessGroups = graphData.nodes.filter((n) => n.type === 'accessGroup');
  const entities = graphData.nodes.filter((n) => n.type === 'entity');
  const functions = graphData.nodes.filter((n) => n.type === 'function');

  return (
    <div className="table-view active">
      <div id="tableContent">
        <TableSection title="Access Groups" items={accessGroups} type="accessGroup" edges={graphData.edges} />
        {entities.length > 0 && (
          <TableSection title="Entities" items={entities} type="entity" edges={graphData.edges} />
        )}
        <TableSection title="Functions" items={functions} type="function" edges={graphData.edges} />
      </div>
    </div>
  );
};

interface TableSectionProps {
  title: string;
  items: GraphNode[];
  type: string;
  edges: any[];
}

const TableSection: React.FC<TableSectionProps> = ({ title, items, type, edges }) => {
  const [collapsed, setCollapsed] = useState(false);
  const changedCount = items.filter((n) => n.changeStatus !== 'unchanged').length;

  // Sort: changed items first, then by name
  const sortedItems = [...items].sort((a, b) => {
    const aChanged = a.changeStatus !== 'unchanged' ? 0 : 1;
    const bChanged = b.changeStatus !== 'unchanged' ? 0 : 1;
    if (aChanged !== bChanged) return aChanged - bChanged;
    return a.label.localeCompare(b.label);
  });

  const nodeType = type === 'accessGroup' ? 'access' : type;

  return (
    <div className={`table-section ${collapsed ? 'collapsed' : ''}`}>
      <div className="table-section-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="table-section-title">
          <span className="dot" style={{ background: `var(--node-${nodeType})` }}></span>
          {title}
          <span className="table-section-count">{items.length}</span>
          {changedCount > 0 && <span className="change-badge modified">{changedCount}</span>}
        </div>
        <svg
          className="table-section-toggle"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      <div className="table-section-content">
        {sortedItems.map((item) => (
          <TableItem key={item.id} item={item} type={type} edges={edges} />
        ))}
      </div>
    </div>
  );
};

interface TableItemProps {
  item: GraphNode;
  type: string;
  edges: any[];
}

const TableItem: React.FC<TableItemProps> = ({ item, type, edges }) => {
  const statusClass = item.changeStatus !== 'unchanged' ? item.changeStatus : '';
  const icon =
    item.changeStatus === 'added' ? '+' : item.changeStatus === 'removed' ? '−' : item.changeStatus === 'modified' ? '~' : '';

  // Get tags for functions
  const accessEdges = type === 'function' ? edges.filter((e) => e.source === item.id && e.type === 'requires-access') : [];
  const entityEdges = type === 'function' ? edges.filter((e) => e.source === item.id && e.type === 'operates-on') : [];

  return (
    <div className={`table-item ${statusClass}`}>
      <div className="table-item-icon">{icon}</div>
      <div className="table-item-content">
        <div className="table-item-name" dangerouslySetInnerHTML={{ __html: escapeHtml(item.label) }} />
        <div className="table-item-description" dangerouslySetInnerHTML={{ __html: escapeHtml(item.description) }} />

        {type === 'function' && (accessEdges.length > 0 || entityEdges.length > 0) && (
          <div className="table-item-tags">
            {accessEdges.map((edge) => {
              const groupName = edge.target.replace('accessGroup:', '');
              return (
                <span key={edge.id} className="table-item-tag access">
                  {groupName}
                </span>
              );
            })}
            {entityEdges.map((edge) => {
              const entityName = edge.target.replace('entity:', '');
              return (
                <span key={edge.id} className="table-item-tag entity">
                  {entityName}
                </span>
              );
            })}
          </div>
        )}

        {item.changeDetails && item.changeStatus === 'modified' && (
          <div className="table-item-change">
            {item.changeDetails.oldAccess && item.changeDetails.newAccess && (
              <div>
                Access: <span className="old">{item.changeDetails.oldAccess.join(', ')}</span>
                <span className="arrow">→</span>
                <span className="new">{item.changeDetails.newAccess.join(', ')}</span>
              </div>
            )}
            {item.changeDetails.inputsChanged && <div>Input schema changed</div>}
            {item.changeDetails.outputsChanged && <div>Output schema changed</div>}
            {item.changeDetails.entitiesChanged && (
              <div>
                Entities: <span className="old">{(item.changeDetails.oldEntities || []).join(', ')}</span>
                <span className="arrow">→</span>
                <span className="new">{(item.changeDetails.newEntities || []).join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
