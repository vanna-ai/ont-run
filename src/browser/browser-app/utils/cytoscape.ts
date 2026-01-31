import cytoscape from 'cytoscape';
import type { GraphData, LayoutType } from '../types';

export function initializeCytoscape(
  container: HTMLElement,
  graphData: GraphData,
  onNodeSelect: (nodeData: any) => void,
  onBackgroundClick: () => void
) {
  const elements: any[] = [];

  // Add nodes
  for (const node of graphData.nodes) {
    elements.push({
      group: 'nodes',
      data: {
        id: node.id,
        label: node.label,
        type: node.type,
        description: node.description,
        metadata: node.metadata,
        changeStatus: node.changeStatus || 'unchanged',
        changeDetails: node.changeDetails || null,
        usesUserContext: node.metadata?.usesUserContext || false,
        usesOrganizationContext: node.metadata?.usesOrganizationContext || false,
        isReadOnly: node.metadata?.isReadOnly,
      },
    });
  }

  // Add edges
  for (const edge of graphData.edges) {
    elements.push({
      group: 'edges',
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        label: edge.label || '',
      },
    });
  }

  const cy = cytoscape({
    container,
    elements,
    style: getCytoscapeStyles(),
    layout: {
      name: 'cose',
      animate: false,
      nodeRepulsion: 8000,
      idealEdgeLength: 100,
      edgeElasticity: 100,
      gravity: 0.25,
      numIter: 1000,
      padding: 50,
    },
    minZoom: 0.2,
    maxZoom: 3,
    wheelSensitivity: 0.3,
  });

  // Node click handler
  cy.on('tap', 'node', function(evt: any) {
    const node = evt.target;
    onNodeSelect(node);
  });

  // Background click handler
  cy.on('tap', function(evt: any) {
    if (evt.target === cy) {
      onBackgroundClick();
    }
  });

  return cy;
}

export function getCytoscapeStyles() {
  return [
    // Base node style
    {
      selector: 'node',
      style: {
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-family': 'Space Grotesk, -apple-system, BlinkMacSystemFont, sans-serif',
        'font-size': 12,
        'font-weight': 500,
        'color': '#023d60',
        'text-outline-width': 2,
        'text-outline-color': '#ffffff',
        'background-color': '#ffffff',
        'border-width': 2,
        'width': 90,
        'height': 45,
      },
    },
    // Function nodes - Navy
    {
      selector: 'node[type="function"]',
      style: {
        'shape': 'round-hexagon',
        'border-color': '#023d60',
        'background-color': 'rgba(2, 61, 96, 0.08)',
        'width': 100,
        'height': 55,
      },
    },
    // Function nodes that are mutations (isReadOnly: false) - Orange accent
    {
      selector: 'node[type="function"][!isReadOnly]',
      style: {
        'border-color': '#fe5d26',
        'background-color': 'rgba(254, 93, 38, 0.08)',
      },
    },
    // Mutation function nodes - show edit indicator (when no userContext)
    {
      selector: 'node[type="function"][!isReadOnly]:not([?usesUserContext])',
      style: {
        'background-image': 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#fff5f0" stroke="#fe5d26" stroke-width="1.5"/><g transform="translate(6, 6)" fill="none" stroke="#fe5d26" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.5a2.121 2.121 0 0 1 3 3L6 18l-4 1 1-4L14.5 3.5z"/></g></svg>'),
        'background-width': '18px',
        'background-height': '18px',
        'background-position-x': '50%',
        'background-position-y': '75%',
        'text-valign': 'center',
        'text-margin-y': -8,
      },
    },
    // Function nodes with userContext (read-only) - show indicator below label
    {
      selector: 'node[type="function"][?usesUserContext][?isReadOnly]',
      style: {
        'background-image': 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#e8f4f8" stroke="#023d60" stroke-width="1.5"/><g transform="translate(4, 4)" fill="none" stroke="#023d60" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></g></svg>'),
        'background-width': '18px',
        'background-height': '18px',
        'background-position-x': '50%',
        'background-position-y': '75%',
        'text-valign': 'center',
        'text-margin-y': -8,
      },
    },
    // Function nodes with BOTH mutation AND userContext - show both icons
    {
      selector: 'node[type="function"][!isReadOnly][?usesUserContext]',
      style: {
        'border-color': '#fe5d26',
        'background-color': 'rgba(254, 93, 38, 0.08)',
        'background-image': [
          'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#fff5f0" stroke="#fe5d26" stroke-width="1.5"/><g transform="translate(6, 6)" fill="none" stroke="#fe5d26" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.5a2.121 2.121 0 0 1 3 3L6 18l-4 1 1-4L14.5 3.5z"/></g></svg>'),
          'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#e8f4f8" stroke="#023d60" stroke-width="1.5"/><g transform="translate(4, 4)" fill="none" stroke="#023d60" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></g></svg>')
        ],
        'background-width': ['16px', '16px'],
        'background-height': ['16px', '16px'],
        'background-position-x': ['35%', '65%'],
        'background-position-y': ['75%', '75%'],
        'text-valign': 'center',
        'text-margin-y': -8,
      },
    },
    // Entity nodes - Teal
    {
      selector: 'node[type="entity"]',
      style: {
        'shape': 'round-rectangle',
        'border-color': '#15a8a8',
        'background-color': 'rgba(21, 168, 168, 0.12)',
        'width': 95,
        'height': 45,
      },
    },
    // Access group nodes - Magenta
    {
      selector: 'node[type="accessGroup"]',
      style: {
        'shape': 'ellipse',
        'border-color': '#bf1363',
        'background-color': 'rgba(191, 19, 99, 0.1)',
        'width': 80,
        'height': 80,
      },
    },
    // Selected node
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'background-color': '#ffffff',
        'shadow-blur': 15,
        'shadow-color': 'rgba(21, 168, 168, 0.4)',
        'shadow-opacity': 1,
        'shadow-offset-x': 0,
        'shadow-offset-y': 4,
      },
    },
    // Highlighted node (connected to selected)
    {
      selector: 'node.highlighted',
      style: {
        'border-width': 3,
        'opacity': 1,
      },
    },
    // Dimmed node
    {
      selector: 'node.dimmed',
      style: {
        'opacity': 0.25,
      },
    },
    // Hidden node
    {
      selector: 'node.hidden',
      style: {
        'display': 'none',
      },
    },
    // Change status: Added - keep type color, add solid border + glow
    {
      selector: 'node[changeStatus="added"]',
      style: {
        'border-color': '#2a9d8f',
        'border-width': 3,
        'background-opacity': 0.5,
        'shadow-blur': 15,
        'shadow-color': 'rgba(42, 157, 143, 0.5)',
        'shadow-opacity': 1,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
      },
    },
    // Change status: Removed - faded with dashed border
    {
      selector: 'node[changeStatus="removed"]',
      style: {
        'border-color': '#c44536',
        'border-width': 2,
        'border-style': 'dashed',
        'background-opacity': 0.3,
        'opacity': 0.6,
      },
    },
    // Change status: Modified - keep type color, add solid border + subtle glow
    {
      selector: 'node[changeStatus="modified"]',
      style: {
        'border-color': '#fe5d26',
        'border-width': 3,
        'background-opacity': 0.5,
        'shadow-blur': 12,
        'shadow-color': 'rgba(254, 93, 38, 0.4)',
        'shadow-opacity': 1,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
      },
    },
    // Base edge style
    {
      selector: 'edge',
      style: {
        'width': 1.5,
        'line-color': 'rgba(2, 61, 96, 0.2)',
        'target-arrow-color': 'rgba(2, 61, 96, 0.3)',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 0.8,
      },
    },
    // Operates-on edge - Teal
    {
      selector: 'edge[type="operates-on"]',
      style: {
        'line-color': '#15a8a8',
        'target-arrow-color': '#15a8a8',
        'width': 2,
      },
    },
    // Requires-access edge - Magenta
    {
      selector: 'edge[type="requires-access"]',
      style: {
        'line-color': '#bf1363',
        'target-arrow-color': '#bf1363',
        'line-style': 'dashed',
        'line-dash-pattern': [6, 3],
      },
    },
    // Depends-on edge - Orange
    {
      selector: 'edge[type="depends-on"]',
      style: {
        'line-color': '#fe5d26',
        'target-arrow-color': '#fe5d26',
        'line-style': 'dotted',
        'line-dash-pattern': [2, 4],
      },
    },
    // Highlighted edge
    {
      selector: 'edge.highlighted',
      style: {
        'width': 3,
        'opacity': 1,
      },
    },
    // Dimmed edge
    {
      selector: 'edge.dimmed',
      style: {
        'opacity': 0.12,
      },
    },
    // Hidden edge
    {
      selector: 'edge.hidden',
      style: {
        'display': 'none',
      },
    },
  ];
}

export function applyLayout(cy: any, layoutName: LayoutType, nodeCount: number) {
  const layouts: Record<LayoutType, any> = {
    cose: {
      name: 'cose',
      animate: true,
      animationDuration: 500,
      nodeRepulsion: 8000,
      idealEdgeLength: 100,
      gravity: 0.25,
      padding: 50,
    },
    circle: {
      name: 'circle',
      animate: true,
      animationDuration: 500,
      padding: 50,
    },
    grid: {
      name: 'grid',
      animate: true,
      animationDuration: 500,
      padding: 50,
      rows: Math.ceil(Math.sqrt(nodeCount)),
    },
  };

  cy.layout(layouts[layoutName]).run();
}

export async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('500 12px "Space Grotesk"'),
      document.fonts.load('600 12px "Space Grotesk"'),
      document.fonts.load('400 12px "Space Mono"'),
    ]);
    console.log('Fonts loaded:', document.fonts.check('500 12px "Space Grotesk"') ? 'Space Grotesk OK' : 'Space Grotesk FAILED');
  } catch (e) {
    console.warn('Font loading error:', e);
  }
}
