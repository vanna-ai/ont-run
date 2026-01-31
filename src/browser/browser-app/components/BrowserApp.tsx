import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { GraphView } from './GraphView';
import { DetailPanel } from './DetailPanel';
import { TableView } from './TableView';
import { SourceView } from './SourceView';
import { TestModal } from './TestModal';
import { ReviewFooter } from './ReviewFooter';
import type { GraphData, ViewType, FilterType, LayoutType, TestConfig } from '../types';
import { initializeCytoscape, applyLayout, loadFonts } from '../utils/cytoscape';

interface BrowserAppProps {
  graphData: GraphData;
}

export const BrowserApp: React.FC<BrowserAppProps> = ({ graphData }) => {
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all');
  const [currentLayout, setCurrentLayout] = useState<LayoutType>('cose');
  const [currentView, setCurrentView] = useState<ViewType>('graph');
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testFunctionName, setTestFunctionName] = useState<string | null>(null);
  const [testConfig, setTestConfig] = useState<TestConfig | null>(null);
  
  const cyRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load test config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/config');
        const config = await res.json();
        setTestConfig(config);
      } catch (err) {
        console.error('Failed to load config:', err);
      }
    };
    loadConfig();
  }, []);

  // Initialize Cytoscape
  useEffect(() => {
    const initGraph = async () => {
      await loadFonts();
      
      const container = document.getElementById('cy');
      if (!container) return;

      const cy = initializeCytoscape(
        container,
        graphData,
        handleNodeSelect,
        handleBackgroundClick
      );

      cyRef.current = cy;
    };

    initGraph();

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [graphData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          document.querySelector<HTMLInputElement>('.search-input')?.focus();
          break;
        case 'Escape':
          handleBackgroundClick();
          break;
        case 'f':
        case 'F':
          handleFitView();
          break;
        case '1':
          setCurrentFilter('all');
          break;
        case '2':
          setCurrentFilter('function');
          break;
        case '3':
          setCurrentFilter('entity');
          break;
        case '4':
          setCurrentFilter('accessGroup');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNodeSelect = useCallback((node: any) => {
    if (!cyRef.current) return;

    // Clear previous selection styling
    cyRef.current.elements().removeClass('highlighted dimmed');

    // Select node
    cyRef.current.nodes().unselect();
    node.select();
    setSelectedNode(node);

    // Highlight connected nodes and edges
    const connectedEdges = node.connectedEdges();
    const connectedNodes = connectedEdges.connectedNodes();

    node.addClass('highlighted');
    connectedNodes.addClass('highlighted');
    connectedEdges.addClass('highlighted');

    cyRef.current.elements().not(node).not(connectedNodes).not(connectedEdges).addClass('dimmed');
  }, []);

  const handleBackgroundClick = useCallback(() => {
    if (!cyRef.current) return;
    
    cyRef.current.elements().removeClass('highlighted dimmed');
    cyRef.current.nodes().unselect();
    setSelectedNode(null);
  }, []);

  const handleSearchSelect = useCallback((nodeId: string) => {
    if (!cyRef.current) return;
    
    const node = cyRef.current.getElementById(nodeId);
    if (node.length > 0) {
      handleNodeSelect(node);
      cyRef.current.animate({
        center: { eles: node },
        zoom: 1.5,
        duration: 300,
      });
    }
  }, [handleNodeSelect]);

  const handleFilterChange = useCallback((filter: FilterType) => {
    if (!cyRef.current) return;
    
    setCurrentFilter(filter);

    if (filter === 'all') {
      cyRef.current.nodes().removeClass('hidden');
      cyRef.current.edges().removeClass('hidden');
    } else if (filter === 'userContext') {
      // Special filter: show only functions with userContext
      cyRef.current.nodes().forEach((node: any) => {
        if (node.data('type') === 'function' && node.data('usesUserContext')) {
          node.removeClass('hidden');
        } else {
          node.addClass('hidden');
        }
      });
      cyRef.current.edges().addClass('hidden');
    } else if (filter === 'organizationContext') {
      // Special filter: show only functions with organizationContext
      cyRef.current.nodes().forEach((node: any) => {
        if (node.data('type') === 'function' && node.data('usesOrganizationContext')) {
          node.removeClass('hidden');
        } else {
          node.addClass('hidden');
        }
      });
      cyRef.current.edges().addClass('hidden');
    } else {
      cyRef.current.nodes().forEach((node: any) => {
        if (node.data('type') === filter) {
          node.removeClass('hidden');
        } else {
          node.addClass('hidden');
        }
      });
      cyRef.current.edges().forEach((edge: any) => {
        const source = cyRef.current.getElementById(edge.data('source'));
        const target = cyRef.current.getElementById(edge.data('target'));
        if (source.hasClass('hidden') || target.hasClass('hidden')) {
          edge.addClass('hidden');
        } else {
          edge.removeClass('hidden');
        }
      });
    }
  }, []);

  const handleLayoutChange = useCallback((layout: LayoutType) => {
    if (!cyRef.current) return;
    
    setCurrentLayout(layout);
    applyLayout(cyRef.current, layout, graphData.nodes.length);
  }, [graphData.nodes.length]);

  const handleZoomIn = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.zoom(cyRef.current.zoom() * 1.3);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.zoom(cyRef.current.zoom() / 1.3);
  }, []);

  const handleFitView = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.fit(50);
  }, []);

  const handleTestFunction = useCallback((functionName: string) => {
    setTestFunctionName(functionName);
    setTestModalOpen(true);
  }, []);

  const handleApprove = async () => {
    const response = await fetch('/api/approve', { method: 'POST' });
    if (!response.ok) {
      throw new Error('Failed to approve');
    }
  };

  const handleReject = async () => {
    await fetch('/api/reject', { method: 'POST' });
  };

  return (
    <>
      <div className="layout">
        <Header
          meta={graphData.meta}
          activeFilter={currentFilter}
          currentView={currentView}
          currentLayout={currentLayout}
          onFilterChange={handleFilterChange}
          onViewChange={setCurrentView}
          onLayoutChange={handleLayoutChange}
          onSearchSelect={handleSearchSelect}
        />

        {currentView === 'graph' && (
          <>
            <Sidebar
              meta={graphData.meta}
              activeFilter={currentFilter}
              onFilterChange={handleFilterChange}
            />
            <GraphView
              cyRef={cyRef}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFitView={handleFitView}
            />
            <DetailPanel
              selectedNodeData={selectedNode ? selectedNode.data() : null}
              onNodeSelect={handleSearchSelect}
              onTestFunction={handleTestFunction}
            />
          </>
        )}

        {currentView === 'table' && <TableView graphData={graphData} />}
        {currentView === 'source' && <SourceView />}
      </div>

      <ReviewFooter
        meta={graphData.meta}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <TestModal
        isOpen={testModalOpen}
        functionName={testFunctionName}
        testConfig={testConfig}
        onClose={() => {
          setTestModalOpen(false);
          setTestFunctionName(null);
        }}
      />
    </>
  );
};
