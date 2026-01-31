import React from 'react';
import type { GraphMeta, FilterType } from '../types';

interface SidebarProps {
  meta: GraphMeta;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ meta, activeFilter, onFilterChange }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-title">Overview</div>
        <div className="stat-grid">
          <div
            className={`stat-card ${activeFilter === 'all' ? 'active' : ''}`}
            data-filter="all"
            onClick={() => onFilterChange('all')}
          >
            <div className="stat-value">{meta.totalNodes}</div>
            <div className="stat-label">Total Nodes</div>
          </div>
          <div
            className={`stat-card ${activeFilter === 'function' ? 'active' : ''}`}
            data-filter="function"
            onClick={() => onFilterChange('function')}
          >
            <div className="stat-value">{meta.totalFunctions}</div>
            <div className="stat-label">
              <span className="dot" style={{ background: 'var(--node-function)' }}></span>
              Functions
            </div>
          </div>
          <div
            className={`stat-card ${activeFilter === 'entity' ? 'active' : ''}`}
            data-filter="entity"
            onClick={() => onFilterChange('entity')}
          >
            <div className="stat-value">{meta.totalEntities}</div>
            <div className="stat-label">
              <span className="dot" style={{ background: 'var(--node-entity)' }}></span>
              Entities
            </div>
          </div>
          <div
            className={`stat-card ${activeFilter === 'accessGroup' ? 'active' : ''}`}
            data-filter="accessGroup"
            onClick={() => onFilterChange('accessGroup')}
          >
            <div className="stat-value">{meta.totalAccessGroups}</div>
            <div className="stat-label">
              <span className="dot" style={{ background: 'var(--node-access)' }}></span>
              Access Groups
            </div>
          </div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-title">Node Types</div>
        <div className="legend-item">
          <div className="legend-shape function"></div>
          <div className="legend-text">Function</div>
        </div>
        <div className="legend-item">
          <div className="legend-shape entity"></div>
          <div className="legend-text">Entity</div>
        </div>
        <div className="legend-item">
          <div className="legend-shape access"></div>
          <div className="legend-text">Access Group</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-title">Edge Types</div>
        <div className="legend-edge">
          <div className="legend-line operates"></div>
          <div className="legend-text">Operates on</div>
        </div>
        <div className="legend-edge">
          <div className="legend-line access"></div>
          <div className="legend-text">Requires access</div>
        </div>
        <div className="legend-edge">
          <div className="legend-line depends"></div>
          <div className="legend-text">Depends on</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-title">Keyboard Shortcuts</div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          <p style={{ marginBottom: '8px' }}><span className="kbd">/</span> Search</p>
          <p style={{ marginBottom: '8px' }}><span className="kbd">Esc</span> Clear selection</p>
          <p style={{ marginBottom: '8px' }}><span className="kbd">F</span> Fit to view</p>
          <p><span className="kbd">1-4</span> Filter types</p>
        </div>
      </div>
    </aside>
  );
};
