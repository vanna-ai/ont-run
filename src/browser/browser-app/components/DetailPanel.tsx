import React, { useEffect, useState } from 'react';
import type { NodeDetails } from '../types';
import { formatType, formatSchema, formatSchemaType } from '../utils/formatting';

interface DetailPanelProps {
  selectedNodeData: any | null;
  onNodeSelect: (nodeId: string) => void;
  onTestFunction: (functionName: string) => void;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  selectedNodeData,
  onNodeSelect,
  onTestFunction,
}) => {
  const [details, setDetails] = useState<NodeDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedNodeData) {
      setDetails(null);
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      try {
        const [type, id] = selectedNodeData.id.split(':');
        const response = await fetch(`/api/node/${type}/${id}`);
        const data = await response.json();
        setDetails(data);
      } catch (error) {
        console.error('Failed to fetch node details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [selectedNodeData]);

  if (!selectedNodeData) {
    return (
      <aside className="detail-panel empty">
        <div className="empty-state-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </div>
        <div className="empty-state-title">Select a node</div>
        <div className="empty-state-text">
          Click on any node in the graph to view its details, connections, and schema.
        </div>
      </aside>
    );
  }

  const data = selectedNodeData;
  const changeStatus = data.changeStatus || 'unchanged';
  const changeBadge = changeStatus !== 'unchanged' ? (
    <span className={`detail-change-badge ${changeStatus}`}>
      {changeStatus === 'added' ? 'New' : changeStatus === 'removed' ? 'Removed' : 'Modified'}
    </span>
  ) : null;

  const userContextBadge = data.metadata?.usesUserContext ? (
    <span className="user-context-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      User Context
    </span>
  ) : null;

  const orgContextBadge = data.metadata?.usesOrganizationContext ? (
    <span className="org-context-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18" />
        <path d="M15 3v18" />
      </svg>
      Org Context
    </span>
  ) : null;

  const readOnlyBadge = data.type === 'function' && data.isReadOnly !== undefined ? (
    <span className={`readonly-badge ${data.isReadOnly ? 'query' : 'mutation'}`}>
      {data.isReadOnly ? 'Query' : 'Mutation'}
    </span>
  ) : null;

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <div className={`detail-type ${data.type}`}>
          {formatType(data.type)}
          {changeBadge}
          {readOnlyBadge}
          {userContextBadge}
          {orgContextBadge}
        </div>
        <div className="detail-name">{data.label}</div>
        <div className="detail-description">{data.description || 'No description'}</div>
      </div>

      {changeStatus !== 'unchanged' && data.changeDetails && (
        <ChangeSection changeStatus={changeStatus} changeDetails={data.changeDetails} />
      )}
      {changeStatus === 'added' && !data.changeDetails && (
        <div className="detail-section change-section added">
          <div className="detail-section-title">Change</div>
          <div className="change-summary">This is a newly added {formatType(data.type).toLowerCase()}.</div>
        </div>
      )}
      {changeStatus === 'removed' && !data.changeDetails && (
        <div className="detail-section change-section removed">
          <div className="detail-section-title">Change</div>
          <div className="change-summary">This {formatType(data.type).toLowerCase()} will be removed.</div>
        </div>
      )}

      {loading && (
        <div className="detail-section">
          <div className="detail-section-title">Loading details...</div>
        </div>
      )}

      {!loading && details && (
        <>
          {data.type === 'function' && (
            <FunctionDetails
              details={details}
              data={data}
              changeStatus={changeStatus}
              onNodeSelect={onNodeSelect}
              onTestFunction={onTestFunction}
            />
          )}
          {(data.type === 'accessGroup' || data.type === 'entity') && (
            <EntityAccessDetails details={details} data={data} onNodeSelect={onNodeSelect} />
          )}
        </>
      )}
    </aside>
  );
};

const ChangeSection: React.FC<{ changeStatus: string; changeDetails: any }> = ({
  changeStatus,
  changeDetails,
}) => {
  const items = [];

  if (changeDetails.oldAccess && changeDetails.newAccess) {
    const oldList = changeDetails.oldAccess.join(', ');
    const newList = changeDetails.newAccess.join(', ');
    items.push(
      <div key="access" className="change-item">
        <span className="change-label">Access:</span>
        <span className="change-old">{oldList}</span>
        <span className="change-arrow">→</span>
        <span className="change-new">{newList}</span>
      </div>
    );
  }

  if (changeDetails.oldEntities && changeDetails.newEntities) {
    const oldList = changeDetails.oldEntities.join(', ') || '(none)';
    const newList = changeDetails.newEntities.join(', ') || '(none)';
    items.push(
      <div key="entities" className="change-item">
        <span className="change-label">Entities:</span>
        <span className="change-old">{oldList}</span>
        <span className="change-arrow">→</span>
        <span className="change-new">{newList}</span>
      </div>
    );
  }

  if (changeDetails.oldDescription && changeDetails.newDescription) {
    items.push(
      <div key="description" className="change-item change-item-block">
        <span className="change-label">Description:</span>
        <div className="change-description-diff">
          <div className="change-old">{changeDetails.oldDescription}</div>
          <div className="change-arrow">↓</div>
          <div className="change-new">{changeDetails.newDescription}</div>
        </div>
      </div>
    );
  }

  if (changeDetails.inputsChanged) {
    items.push(
      <div key="inputs" className="change-item">
        <span className="change-label">Input schema changed</span>
      </div>
    );
  }

  if (changeDetails.outputsChanged) {
    items.push(
      <div key="outputs" className="change-item">
        <span className="change-label">Output schema changed</span>
      </div>
    );
  }

  if (items.length === 0) {
    items.push(
      <div key="default" className="change-item">
        <span className="change-label">Details modified</span>
      </div>
    );
  }

  return (
    <div className={`detail-section change-section ${changeStatus}`}>
      <div className="detail-section-title">Changes</div>
      {items}
    </div>
  );
};

const FunctionDetails: React.FC<{
  details: NodeDetails;
  data: any;
  changeStatus: string;
  onNodeSelect: (nodeId: string) => void;
  onTestFunction: (functionName: string) => void;
}> = ({ details, data, changeStatus, onNodeSelect, onTestFunction }) => {
  return (
    <>
      {details.connections.accessGroups.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-title">Access Groups</div>
          <div className="tag-list">
            {details.connections.accessGroups.map((g) => (
              <span
                key={g}
                className="tag access"
                onClick={() => onNodeSelect(`accessGroup:${g}`)}
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

      {details.connections.entities.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-title">Entities</div>
          <div className="tag-list">
            {details.connections.entities.map((e) => (
              <span
                key={e}
                className="tag entity"
                onClick={() => onNodeSelect(`entity:${e}`)}
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {details.connections.dependsOn.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-title">Dependencies (fieldFrom)</div>
          {details.connections.dependsOn.map((d, i) => (
            <div key={i} className="dependency-item">
              <span
                className="function-link"
                onClick={() => onNodeSelect(`function:${d.functionName}`)}
              >
                {d.functionName}
              </span>
              <span className="dependency-path">{d.path}</span>
            </div>
          ))}
        </div>
      )}

      {details.connections.dependedOnBy.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-title">Used By</div>
          <ul className="function-list">
            {details.connections.dependedOnBy.map((f) => (
              <li key={f}>
                <span
                  className="function-link"
                  onClick={() => onNodeSelect(`function:${f}`)}
                >
                  {f}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.metadata?.inputs && (
        <div className="detail-section">
          <div className="detail-section-title">Input Schema</div>
          <pre className="schema-viewer">{formatSchema(data.metadata.inputs)}</pre>
        </div>
      )}

      {data.metadata?.outputs && (
        <div className="detail-section returns-section">
          <div className="detail-section-title">Returns</div>
          <div className="returns-display">
            <span className="returns-type-large">
              {formatSchemaType(data.metadata.outputs)}
            </span>
          </div>
          <pre className="schema-viewer">{formatSchema(data.metadata.outputs)}</pre>
        </div>
      )}

      {changeStatus !== 'removed' && (
        <div className="detail-section">
          <button className="test-btn" onClick={() => onTestFunction(data.label)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Test Function
          </button>
        </div>
      )}
    </>
  );
};

const EntityAccessDetails: React.FC<{
  details: NodeDetails;
  data: any;
  onNodeSelect: (nodeId: string) => void;
}> = ({ details, data, onNodeSelect }) => {
  if (details.connections.functions.length > 0) {
    return (
      <div className="detail-section">
        <div className="detail-section-title">
          Functions ({details.connections.functions.length})
        </div>
        <div className="function-cards">
          {details.connections.functions.map((f) => (
            <div
              key={f.name}
              className="function-card"
              onClick={() => onNodeSelect(`function:${f.name}`)}
            >
              <div className="function-card-header">
                <span className="function-card-name">{f.name}</span>
              </div>
              <div className="function-card-desc">{f.description}</div>
              {f.outputs && (
                <div className="function-card-returns">
                  <span className="returns-label">Returns:</span>
                  <span className="returns-type">{formatSchemaType(f.outputs)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="detail-section">
      <div className="detail-section-title">Functions</div>
      <p className="no-data">
        No functions{' '}
        {data.type === 'accessGroup' ? 'require this access' : 'operate on this entity'}
      </p>
    </div>
  );
};
