import React, { useEffect, useRef } from 'react';

interface GraphViewProps {
  cyRef: React.MutableRefObject<any>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
}

export const GraphView: React.FC<GraphViewProps> = ({
  cyRef,
  onZoomIn,
  onZoomOut,
  onFitView,
}) => {
  return (
    <main className="graph-container">
      <div id="cy"></div>
      <div className="graph-controls">
        <button className="graph-control-btn" onClick={onZoomIn} title="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
          </svg>
        </button>
        <button className="graph-control-btn" onClick={onZoomOut} title="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35M8 11h6" />
          </svg>
        </button>
        <button className="graph-control-btn" onClick={onFitView} title="Fit to view">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </div>
    </main>
  );
};
