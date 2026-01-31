import React, { useState, useEffect, useRef } from 'react';
import type { GraphMeta, FilterType, ViewType, LayoutType, SearchResult } from '../types';

interface HeaderProps {
  meta: GraphMeta;
  activeFilter: FilterType;
  currentView: ViewType;
  currentLayout: LayoutType;
  onFilterChange: (filter: FilterType) => void;
  onViewChange: (view: ViewType) => void;
  onLayoutChange: (layout: LayoutType) => void;
  onSearchSelect: (nodeId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  meta,
  activeFilter,
  currentView,
  currentLayout,
  onFilterChange,
  onViewChange,
  onLayoutChange,
  onSearchSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<number>();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchQuery.length < 1) {
      setShowResults(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        setSearchResults(data.results || []);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
        setShowResults(false);
      }
    }, 150);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSearchSelect = (nodeId: string) => {
    onSearchSelect(nodeId);
    setSearchQuery('');
    setShowResults(false);
    searchInputRef.current?.blur();
  };

  const handleSearchBlur = () => {
    setTimeout(() => setShowResults(false), 200);
  };

  return (
    <header className="header">
      <div className="logo">
        <div className="logo-icon">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="vannaBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#15a8a8', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#023d60', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <rect width="100" height="100" fill="url(#vannaBg)" rx="15" />
            <path
              d="M 30 25 L 50 55 L 70 25 M 50 55 L 50 75"
              stroke="#ffffff"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        <span>{meta.ontologyName}</span>
      </div>

      <div className="search-container">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          className="search-input"
          placeholder="Search functions, entities, access groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onBlur={handleSearchBlur}
        />
        <div className={`search-results ${showResults ? 'visible' : ''}`}>
          {searchResults.length > 0 ? (
            searchResults.map((result) => (
              <div
                key={result.id}
                className="search-result-item"
                onClick={() => handleSearchSelect(result.id)}
              >
                <span className={`search-result-type ${result.type}`}></span>
                <span className="search-result-label">{result.label}</span>
                <span className="search-result-match">{result.matchType}</span>
              </div>
            ))
          ) : (
            <div className="search-result-item">
              <span className="search-result-label" style={{ color: 'var(--text-muted)' }}>
                No results found
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="filter-buttons" id="graphFilters" style={{ display: currentView === 'graph' ? 'flex' : 'none' }}>
        <button
          className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
          data-filter="all"
          onClick={() => onFilterChange('all')}
        >
          <span className="dot" style={{ background: 'var(--vanna-teal)' }}></span>
          All
        </button>
        <button
          className={`filter-btn ${activeFilter === 'function' ? 'active' : ''}`}
          data-filter="function"
          onClick={() => onFilterChange('function')}
        >
          <span className="dot function"></span>
          Functions ({meta.totalFunctions})
        </button>
        <button
          className={`filter-btn ${activeFilter === 'entity' ? 'active' : ''}`}
          data-filter="entity"
          onClick={() => onFilterChange('entity')}
        >
          <span className="dot entity"></span>
          Entities ({meta.totalEntities})
        </button>
        <button
          className={`filter-btn ${activeFilter === 'accessGroup' ? 'active' : ''}`}
          data-filter="accessGroup"
          onClick={() => onFilterChange('accessGroup')}
        >
          <span className="dot access"></span>
          Access ({meta.totalAccessGroups})
        </button>
        {meta.totalUserContextFunctions > 0 && (
          <button
            className={`filter-btn ${activeFilter === 'userContext' ? 'active' : ''}`}
            data-filter="userContext"
            title="Functions using userContext()"
            onClick={() => onFilterChange('userContext')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px' }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            User Context ({meta.totalUserContextFunctions})
          </button>
        )}
        {meta.totalOrganizationContextFunctions > 0 && (
          <button
            className={`filter-btn ${activeFilter === 'organizationContext' ? 'active' : ''}`}
            data-filter="organizationContext"
            title="Functions using organizationContext()"
            onClick={() => onFilterChange('organizationContext')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
              <path d="M15 3v18" />
            </svg>
            Org Context ({meta.totalOrganizationContextFunctions})
          </button>
        )}
      </div>

      <div className="view-tabs">
        <button
          className={`view-tab ${currentView === 'graph' ? 'active' : ''}`}
          data-view="graph"
          onClick={() => onViewChange('graph')}
        >
          Graph
        </button>
        <button
          className={`view-tab ${currentView === 'table' ? 'active' : ''}`}
          data-view="table"
          onClick={() => onViewChange('table')}
        >
          Table
        </button>
        <button
          className={`view-tab ${currentView === 'source' ? 'active' : ''}`}
          data-view="source"
          onClick={() => onViewChange('source')}
        >
          Source
        </button>
      </div>

      <div className="layout-selector" style={{ display: currentView === 'graph' ? 'flex' : 'none' }}>
        <button
          className={`layout-btn ${currentLayout === 'cose' ? 'active' : ''}`}
          data-layout="cose"
          onClick={() => onLayoutChange('cose')}
        >
          Force
        </button>
        <button
          className={`layout-btn ${currentLayout === 'circle' ? 'active' : ''}`}
          data-layout="circle"
          onClick={() => onLayoutChange('circle')}
        >
          Circle
        </button>
        <button
          className={`layout-btn ${currentLayout === 'grid' ? 'active' : ''}`}
          data-layout="grid"
          onClick={() => onLayoutChange('grid')}
        >
          Grid
        </button>
      </div>
    </header>
  );
};
