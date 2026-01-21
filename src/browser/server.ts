import { Hono } from "hono";
import open from "open";
import type { OntologyConfig } from "../config/types.js";
import type { OntologyDiff } from "../lockfile/types.js";
import { writeLockfile } from "../lockfile/index.js";
import { serve, findAvailablePort } from "../runtime/index.js";
import { transformToGraphData, enhanceWithDiff, searchNodes, getNodeDetails, type EnhancedGraphData } from "./transform.js";

export interface BrowserServerOptions {
  config: OntologyConfig;
  /** Diff data for review mode (null = browse-only, no changes) */
  diff?: OntologyDiff | null;
  /** Directory to write the lockfile to on approval */
  configDir?: string;
  port?: number;
  openBrowser?: boolean;
}

export interface BrowserServerResult {
  /** Whether changes were approved (only set if there were changes) */
  approved?: boolean;
}

export async function startBrowserServer(options: BrowserServerOptions): Promise<BrowserServerResult> {
  const { config, diff = null, configDir, port: preferredPort, openBrowser = true } = options;

  // Transform config to graph data and enhance with diff info
  const baseGraphData = transformToGraphData(config);
  const graphData = enhanceWithDiff(baseGraphData, diff);

  return new Promise(async (resolve) => {
    const app = new Hono();

    // API: Get full graph data (enhanced with change status)
    app.get("/api/graph", (c) => c.json(graphData));

    // API: Get diff data
    app.get("/api/diff", (c) => c.json(diff));

    // API: Get node details
    app.get("/api/node/:type/:id", (c) => {
      const { type, id } = c.req.param();
      const nodeId = `${type}:${id}`;
      const details = getNodeDetails(baseGraphData, nodeId);
      if (!details.node) {
        return c.json({ error: "Node not found" }, 404);
      }
      return c.json(details);
    });

    // API: Search nodes
    app.get("/api/search", (c) => {
      const query = c.req.query("q") || "";
      if (query.length < 1) {
        return c.json({ results: [] });
      }
      const results = searchNodes(baseGraphData, query);
      return c.json({ results });
    });

    // API: Approve changes (only works if diff exists)
    app.post("/api/approve", async (c) => {
      if (!diff || !configDir) {
        return c.json({ error: "No changes to approve" }, 400);
      }
      try {
        await writeLockfile(configDir, diff.newOntology, diff.newHash);
        // Give time for response to be sent before resolving
        setTimeout(() => {
          resolve({ approved: true });
        }, 500);
        return c.json({ success: true });
      } catch (error) {
        return c.json(
          {
            error: "Failed to write lockfile",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    });

    // API: Reject changes
    app.post("/api/reject", (c) => {
      // Give time for response to be sent before resolving
      setTimeout(() => {
        resolve({ approved: false });
      }, 500);
      return c.json({ success: true });
    });

    // Serve UI
    app.get("/", (c) => c.html(generateBrowserUI(graphData)));

    // Start server
    const port = preferredPort || (await findAvailablePort(3457));
    const server = await serve(app, port);

    const url = `http://localhost:${server.port}`;
    const hasChanges = diff?.hasChanges ?? false;
    console.log(`\nOntology ${hasChanges ? "Review" : "Browser"} available at: ${url}`);

    if (openBrowser) {
      console.log("Opening in browser...\n");
      try {
        await open(url);
      } catch {
        console.log("Could not open browser automatically.");
        console.log(`Please open ${url} manually.\n`);
      }
    }

    if (hasChanges) {
      console.log("Waiting for review decision...\n");
    } else {
      console.log("Press Ctrl+C to stop the server.\n");
      // If no changes, resolve immediately with no approval status
      // But keep server running for browsing
    }
  });
}

function generateBrowserUI(graphData: EnhancedGraphData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${graphData.meta.ontologyName} - Ontology Browser</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600&family=Space+Mono&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      /* Vanna Brand Colors */
      --vanna-navy: #023d60;
      --vanna-cream: #e7e1cf;
      --vanna-teal: #15a8a8;
      --vanna-orange: #fe5d26;
      --vanna-magenta: #bf1363;

      /* Change indicator colors (Vanna palette complements) */
      --change-added: #2a9d8f;
      --change-added-bg: rgba(42, 157, 143, 0.12);
      --change-removed: #c44536;
      --change-removed-bg: rgba(196, 69, 54, 0.1);
      --change-modified: var(--vanna-orange);
      --change-modified-bg: rgba(254, 93, 38, 0.1);

      /* Semantic mappings */
      --bg-primary: #f8f6f1;
      --bg-secondary: #ffffff;
      --bg-tertiary: var(--vanna-cream);
      --bg-hover: #f0ede5;
      --border-primary: rgba(2, 61, 96, 0.12);
      --border-highlight: var(--vanna-teal);
      --text-primary: var(--vanna-navy);
      --text-secondary: #475569;
      --text-muted: #64748b;

      /* Node colors */
      --node-entity: var(--vanna-teal);
      --node-function: var(--vanna-navy);
      --node-access: var(--vanna-magenta);

      /* Edge colors */
      --edge-operates: var(--vanna-teal);
      --edge-access: var(--vanna-magenta);
      --edge-depends: var(--vanna-orange);

      /* Accents */
      --accent-primary: var(--vanna-teal);
      --accent-success: var(--vanna-teal);
      --accent-warning: var(--vanna-orange);
    }

    body {
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(to bottom, var(--vanna-cream), #ffffff, var(--vanna-cream));
      background-attachment: fixed;
      color: var(--text-primary);
      height: 100vh;
      overflow: hidden;
    }

    .layout {
      display: grid;
      grid-template-rows: 64px 1fr;
      grid-template-columns: 260px 1fr 340px;
      height: 100vh;
    }

    /* Header */
    .header {
      grid-column: 1 / -1;
      background: rgba(231, 225, 207, 0.9);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(21, 168, 168, 0.2);
      display: flex;
      align-items: center;
      padding: 0 24px;
      gap: 24px;
      position: relative;
      z-index: 1000;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: 'Roboto Slab', serif;
      font-weight: 600;
      font-size: 18px;
      color: var(--vanna-navy);
    }

    .logo-icon {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
    }

    .logo-icon svg {
      width: 100%;
      height: 100%;
      border-radius: 8px;
    }

    .search-container {
      flex: 1;
      max-width: 420px;
      position: relative;
    }

    .search-input {
      width: 100%;
      padding: 10px 14px 10px 40px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(2, 61, 96, 0.15);
      border-radius: 9999px;
      color: var(--text-primary);
      font-family: 'Space Grotesk', sans-serif;
      font-size: 14px;
      outline: none;
      transition: all 0.2s ease;
    }

    .search-input:focus {
      background: white;
      border-color: var(--vanna-teal);
      box-shadow: 0 0 0 3px rgba(21, 168, 168, 0.15);
    }

    .search-input::placeholder {
      color: var(--text-muted);
    }

    .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }

    .filter-buttons {
      display: flex;
      gap: 8px;
    }

    .filter-btn {
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(2, 61, 96, 0.1);
      border-radius: 9999px;
      color: var(--text-secondary);
      font-family: 'Space Grotesk', sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter-btn:hover {
      background: white;
      border-color: var(--vanna-teal);
      color: var(--vanna-navy);
      transform: translateY(-1px);
    }

    .filter-btn.active {
      background: var(--vanna-teal);
      border-color: var(--vanna-teal);
      color: white;
      box-shadow: 0 4px 15px rgba(21, 168, 168, 0.3);
    }

    .filter-btn .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .filter-btn .dot.entity { background: var(--node-entity); }
    .filter-btn .dot.function { background: var(--node-function); }
    .filter-btn .dot.access { background: var(--node-access); }
    .filter-btn.active .dot { background: white; }

    .layout-selector {
      display: flex;
      gap: 4px;
      margin-left: auto;
      background: rgba(255, 255, 255, 0.5);
      padding: 4px;
      border-radius: 9999px;
    }

    .layout-btn {
      padding: 6px 12px;
      background: transparent;
      border: none;
      border-radius: 9999px;
      color: var(--text-muted);
      font-family: 'Space Grotesk', sans-serif;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .layout-btn:hover {
      color: var(--vanna-navy);
    }

    .layout-btn.active {
      background: white;
      color: var(--vanna-teal);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    /* View Tabs */
    .view-tabs {
      display: flex;
      gap: 4px;
      background: rgba(255, 255, 255, 0.5);
      padding: 4px;
      border-radius: 9999px;
      margin-right: 16px;
    }

    .view-tab {
      padding: 8px 16px;
      background: transparent;
      border: none;
      border-radius: 9999px;
      color: var(--text-muted);
      font-family: 'Space Grotesk', sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .view-tab:hover {
      color: var(--vanna-navy);
    }

    .view-tab.active {
      background: white;
      color: var(--vanna-teal);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    /* Change Indicators */
    .change-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 600;
      margin-left: 6px;
    }

    .change-badge.added {
      background: var(--change-added-bg);
      color: var(--change-added);
    }

    .change-badge.removed {
      background: var(--change-removed-bg);
      color: var(--change-removed);
    }

    .change-badge.modified {
      background: var(--change-modified-bg);
      color: var(--change-modified);
    }

    /* Review Footer */
    .review-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(12px);
      border-top: 1px solid rgba(21, 168, 168, 0.2);
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 1000;
    }

    .review-footer.hidden {
      display: none;
    }

    .changes-summary {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 14px;
      color: var(--text-secondary);
    }

    .changes-summary .change-count {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .changes-summary .change-count.added { color: var(--change-added); }
    .changes-summary .change-count.removed { color: var(--change-removed); }
    .changes-summary .change-count.modified { color: var(--change-modified); }

    .review-actions {
      display: flex;
      gap: 12px;
    }

    .review-btn {
      padding: 10px 20px;
      border-radius: 9999px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }

    .review-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .review-btn.reject {
      background: var(--change-removed-bg);
      border-color: rgba(196, 69, 54, 0.3);
      color: var(--change-removed);
    }

    .review-btn.reject:hover:not(:disabled) {
      background: rgba(196, 69, 54, 0.2);
    }

    .review-btn.approve {
      background: var(--vanna-teal);
      color: white;
      box-shadow: 0 4px 15px rgba(21, 168, 168, 0.3);
    }

    .review-btn.approve:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(21, 168, 168, 0.4);
    }

    /* Table View */
    .table-view {
      display: none;
      grid-column: 2 / 4;
      padding: 24px;
      overflow-y: auto;
      background: linear-gradient(to bottom, rgba(255, 255, 255, 0.5), rgba(231, 225, 207, 0.3));
    }

    .table-view.active {
      display: block;
    }

    .table-section {
      background: white;
      border: 1px solid rgba(2, 61, 96, 0.08);
      border-radius: 16px;
      margin-bottom: 20px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(15, 23, 42, 0.04);
    }

    .table-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: rgba(231, 225, 207, 0.4);
      border-bottom: 1px solid rgba(2, 61, 96, 0.08);
      cursor: pointer;
      user-select: none;
    }

    .table-section-header:hover {
      background: rgba(231, 225, 207, 0.6);
    }

    .table-section-title {
      font-family: 'Roboto Slab', serif;
      font-size: 14px;
      font-weight: 600;
      color: var(--vanna-navy);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .table-section-count {
      background: rgba(21, 168, 168, 0.1);
      color: var(--vanna-teal);
      padding: 2px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
    }

    .table-section-toggle {
      color: var(--text-muted);
      transition: transform 0.2s ease;
    }

    .table-section.collapsed .table-section-toggle {
      transform: rotate(-90deg);
    }

    .table-section.collapsed .table-section-content {
      display: none;
    }

    .table-section-content {
      padding: 8px;
    }

    .table-item {
      display: flex;
      align-items: flex-start;
      padding: 12px 16px;
      border-radius: 12px;
      margin-bottom: 4px;
      transition: all 0.2s ease;
      border-left: 3px solid transparent;
    }

    .table-item:last-child {
      margin-bottom: 0;
    }

    .table-item:hover {
      background: rgba(231, 225, 207, 0.3);
    }

    .table-item.added {
      border-left-color: var(--change-added);
    }

    .table-item.removed {
      background: var(--change-removed-bg);
      border-left-color: var(--change-removed);
    }

    .table-item.modified {
      border-left-color: var(--change-modified);
    }

    .table-item-icon {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      margin-right: 12px;
      flex-shrink: 0;
    }

    .table-item.added .table-item-icon { color: var(--change-added); }
    .table-item.removed .table-item-icon { color: var(--change-removed); }
    .table-item.modified .table-item-icon { color: var(--change-modified); }

    .table-item-content {
      flex: 1;
      min-width: 0;
    }

    .table-item-name {
      font-weight: 600;
      color: var(--vanna-navy);
      margin-bottom: 4px;
    }

    .table-item.removed .table-item-name {
      text-decoration: line-through;
      opacity: 0.7;
    }

    .table-item-description {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .table-item-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .table-item-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 500;
    }

    .table-item-tag.access {
      background: rgba(191, 19, 99, 0.1);
      color: var(--vanna-magenta);
    }

    .table-item-tag.entity {
      background: rgba(21, 168, 168, 0.1);
      color: var(--vanna-teal);
    }

    .table-item-change {
      margin-top: 8px;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.03);
      border-radius: 8px;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .table-item-change .old {
      text-decoration: line-through;
      color: var(--change-removed);
    }

    .table-item-change .arrow {
      margin: 0 8px;
      color: var(--text-muted);
    }

    .table-item-change .new {
      color: var(--change-added);
    }

    /* No Changes State */
    .no-changes {
      text-align: center;
      padding: 48px 24px;
      color: var(--text-muted);
    }

    .no-changes-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .no-changes-text {
      font-size: 16px;
      color: var(--text-secondary);
    }

    /* Sidebar */
    .sidebar {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px);
      border-right: 1px solid rgba(21, 168, 168, 0.15);
      padding: 20px;
      overflow-y: auto;
    }

    .sidebar-section {
      margin-bottom: 28px;
    }

    .sidebar-title {
      font-family: 'Roboto Slab', serif;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--vanna-navy);
      margin-bottom: 14px;
      opacity: 0.7;
    }

    .stat-grid {
      display: grid;
      gap: 10px;
    }

    .stat-card {
      background: white;
      border: 1px solid rgba(2, 61, 96, 0.08);
      border-radius: 16px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.25s ease;
      box-shadow: 0 4px 15px rgba(15, 23, 42, 0.04);
    }

    .stat-card:hover {
      border-color: var(--vanna-teal);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(21, 168, 168, 0.12);
    }

    .stat-card.active {
      border-color: var(--vanna-teal);
      background: linear-gradient(135deg, white, rgba(21, 168, 168, 0.08));
      box-shadow: 0 8px 25px rgba(21, 168, 168, 0.15);
    }

    .stat-value {
      font-family: 'Roboto Slab', serif;
      font-size: 28px;
      font-weight: 700;
      color: var(--vanna-navy);
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 13px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stat-label .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(2, 61, 96, 0.06);
    }

    .legend-item:last-child {
      border-bottom: none;
    }

    .legend-shape {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .legend-shape.entity {
      width: 24px;
      height: 16px;
      border: 2px solid var(--node-entity);
      border-radius: 4px;
      background: rgba(21, 168, 168, 0.1);
    }

    .legend-shape.function {
      width: 22px;
      height: 22px;
      background: rgba(2, 61, 96, 0.1);
      border: 2px solid var(--node-function);
      clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
    }

    .legend-shape.access {
      width: 20px;
      height: 20px;
      border: 2px solid var(--node-access);
      border-radius: 50%;
      background: rgba(191, 19, 99, 0.1);
    }

    .legend-text {
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .legend-edge {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
    }

    .legend-line {
      width: 28px;
      height: 3px;
      border-radius: 2px;
    }

    .legend-line.operates { background: var(--edge-operates); }
    .legend-line.access { background: var(--edge-access); }
    .legend-line.depends { background: var(--edge-depends); }

    /* Graph Container */
    .graph-container {
      background:
        radial-gradient(circle at 2px 2px, rgba(2, 61, 96, 0.3) 1px, transparent 0),
        radial-gradient(circle at 30% 20%, rgba(21, 168, 168, 0.06), transparent 50%),
        radial-gradient(circle at 70% 80%, rgba(191, 19, 99, 0.04), transparent 50%),
        linear-gradient(135deg, #faf9f6, #f5f3ed);
      background-size: 32px 32px, 100% 100%, 100% 100%, 100% 100%;
      position: relative;
    }

    #cy {
      width: 100%;
      height: 100%;
    }

    .graph-controls {
      position: absolute;
      bottom: 20px;
      left: 20px;
      display: flex;
      gap: 8px;
    }

    .graph-control-btn {
      width: 40px;
      height: 40px;
      background: white;
      border: 1px solid rgba(2, 61, 96, 0.1);
      border-radius: 12px;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(15, 23, 42, 0.06);
    }

    .graph-control-btn:hover {
      background: white;
      border-color: var(--vanna-teal);
      color: var(--vanna-teal);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(21, 168, 168, 0.15);
    }

    /* Detail Panel */
    .detail-panel {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(12px);
      border-left: 1px solid rgba(21, 168, 168, 0.15);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .detail-panel.empty {
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;
    }

    .empty-state-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, rgba(21, 168, 168, 0.1), rgba(191, 19, 99, 0.05));
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      color: var(--vanna-teal);
    }

    .empty-state-title {
      font-family: 'Roboto Slab', serif;
      font-size: 16px;
      font-weight: 600;
      color: var(--vanna-navy);
      margin-bottom: 10px;
    }

    .empty-state-text {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.6;
      max-width: 220px;
    }

    .detail-header {
      padding: 24px;
      border-bottom: 1px solid rgba(2, 61, 96, 0.08);
      background: linear-gradient(135deg, white, rgba(231, 225, 207, 0.3));
    }

    .detail-type {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .detail-type.entity { color: var(--node-entity); }
    .detail-type.function { color: var(--node-function); }
    .detail-type.accessGroup { color: var(--node-access); }

    .detail-name {
      font-family: 'Roboto Slab', serif;
      font-size: 22px;
      font-weight: 700;
      color: var(--vanna-navy);
      margin-bottom: 10px;
      word-break: break-word;
    }

    .detail-description {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .detail-change-badge {
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .detail-change-badge.added {
      background: var(--change-added-bg);
      color: var(--change-added);
    }

    .detail-change-badge.removed {
      background: var(--change-removed-bg);
      color: var(--change-removed);
    }

    .detail-change-badge.modified {
      background: var(--change-modified-bg);
      color: var(--change-modified);
    }

    .change-section {
      border-left: 3px solid var(--text-muted);
      margin: 0 24px 0 24px;
      padding: 16px 20px !important;
      border-radius: 0 12px 12px 0;
    }

    .change-section.added {
      background: var(--change-added-bg);
      border-left-color: var(--change-added);
    }

    .change-section.removed {
      background: var(--change-removed-bg);
      border-left-color: var(--change-removed);
    }

    .change-section.modified {
      background: var(--change-modified-bg);
      border-left-color: var(--change-modified);
    }

    .change-section .detail-section-title {
      opacity: 1;
      margin-bottom: 12px;
    }

    .change-section.added .detail-section-title { color: var(--change-added); }
    .change-section.removed .detail-section-title { color: var(--change-removed); }
    .change-section.modified .detail-section-title { color: var(--change-modified); }

    .change-summary {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .change-item {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 8px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    .change-item:last-child {
      margin-bottom: 0;
    }

    .change-label {
      font-weight: 500;
      color: var(--text-primary);
    }

    .change-old {
      color: var(--change-removed);
      text-decoration: line-through;
    }

    .change-arrow {
      color: var(--text-muted);
    }

    .change-new {
      color: var(--change-added);
      font-weight: 500;
    }

    .change-item-block {
      flex-direction: column;
      align-items: flex-start;
    }

    .change-description-diff {
      margin-top: 8px;
      width: 100%;
      font-size: 12px;
    }

    .change-description-diff .change-old,
    .change-description-diff .change-new {
      padding: 8px 12px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: normal;
    }

    .change-description-diff .change-old {
      background: rgba(196, 69, 54, 0.08);
      border: 1px solid rgba(196, 69, 54, 0.2);
    }

    .change-description-diff .change-new {
      background: rgba(42, 157, 143, 0.08);
      border: 1px solid rgba(42, 157, 143, 0.2);
    }

    .change-description-diff .change-arrow {
      text-align: center;
      padding: 4px 0;
    }

    .detail-section {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(2, 61, 96, 0.06);
    }

    .detail-section:last-child {
      border-bottom: none;
    }

    .detail-section-title {
      font-family: 'Roboto Slab', serif;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--vanna-navy);
      opacity: 0.6;
      margin-bottom: 14px;
    }

    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tag {
      padding: 6px 12px;
      background: white;
      border: 1px solid rgba(2, 61, 96, 0.1);
      border-radius: 9999px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tag:hover {
      border-color: var(--vanna-teal);
      color: var(--vanna-teal);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(21, 168, 168, 0.15);
    }

    .tag.entity {
      border-color: rgba(21, 168, 168, 0.3);
      background: rgba(21, 168, 168, 0.08);
      color: var(--vanna-teal);
    }
    .tag.function {
      border-color: rgba(2, 61, 96, 0.2);
      background: rgba(2, 61, 96, 0.05);
      color: var(--vanna-navy);
    }
    .tag.access {
      border-color: rgba(191, 19, 99, 0.3);
      background: rgba(191, 19, 99, 0.08);
      color: var(--vanna-magenta);
    }

    .schema-viewer {
      background: linear-gradient(135deg, #faf9f6, #f5f3ed);
      border: 1px solid rgba(2, 61, 96, 0.08);
      border-radius: 12px;
      padding: 16px;
      font-family: 'Space Mono', monospace;
      font-size: 12px;
      line-height: 1.7;
      overflow-x: auto;
      color: var(--vanna-navy);
      max-height: 200px;
      overflow-y: auto;
    }

    .function-list {
      list-style: none;
    }

    .function-list li {
      padding: 10px 0;
      border-bottom: 1px solid rgba(2, 61, 96, 0.06);
    }

    .function-list li:last-child {
      border-bottom: none;
    }

    .function-link {
      color: var(--vanna-navy);
      text-decoration: none;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .function-link:hover {
      color: var(--vanna-teal);
    }

    .function-cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .function-card {
      background: white;
      border: 1px solid rgba(2, 61, 96, 0.1);
      border-radius: 12px;
      padding: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .function-card:hover {
      border-color: var(--vanna-teal);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(21, 168, 168, 0.12);
    }

    .function-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .function-card-name {
      font-family: 'Space Mono', monospace;
      font-size: 13px;
      font-weight: 500;
      color: var(--vanna-navy);
    }

    .function-card-desc {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.4;
      margin-bottom: 8px;
    }

    .function-card-returns {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-top: 8px;
      border-top: 1px solid rgba(2, 61, 96, 0.06);
    }

    .returns-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .returns-type {
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      color: var(--vanna-teal);
      background: rgba(21, 168, 168, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
    }

    .returns-section .returns-display {
      margin-bottom: 12px;
    }

    .returns-type-large {
      font-family: 'Space Mono', monospace;
      font-size: 14px;
      font-weight: 500;
      color: var(--vanna-teal);
      background: rgba(21, 168, 168, 0.1);
      padding: 8px 14px;
      border-radius: 8px;
      display: inline-block;
      border: 1px solid rgba(21, 168, 168, 0.2);
    }

    .dependency-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(2, 61, 96, 0.06);
      font-size: 13px;
    }

    .dependency-item:last-child {
      border-bottom: none;
    }

    .dependency-path {
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      color: var(--vanna-teal);
      background: rgba(21, 168, 168, 0.1);
      padding: 3px 8px;
      border-radius: 6px;
    }

    .no-data {
      font-size: 13px;
      color: var(--text-muted);
      font-style: italic;
    }

    /* Keyboard hint */
    .kbd {
      display: inline-block;
      padding: 3px 8px;
      background: white;
      border: 1px solid rgba(2, 61, 96, 0.15);
      border-radius: 6px;
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      color: var(--vanna-navy);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
    }

    /* Search Results Dropdown */
    .search-results {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid rgba(21, 168, 168, 0.2);
      border-radius: 16px;
      margin-top: 8px;
      max-height: 320px;
      overflow-y: auto;
      z-index: 9999;
      box-shadow: 0 25px 55px rgba(21, 168, 168, 0.18);
      display: none;
    }

    .search-results.visible {
      display: block;
    }

    .search-result-item {
      padding: 12px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid rgba(2, 61, 96, 0.06);
      transition: all 0.15s ease;
    }

    .search-result-item:last-child {
      border-bottom: none;
    }

    .search-result-item:hover {
      background: rgba(21, 168, 168, 0.06);
    }

    .search-result-type {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .search-result-type.entity { background: var(--node-entity); }
    .search-result-type.function { background: var(--node-function); }
    .search-result-type.accessGroup { background: var(--node-access); }

    .search-result-label {
      flex: 1;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: var(--vanna-navy);
    }

    .search-result-match {
      font-size: 11px;
      color: var(--text-muted);
      background: rgba(2, 61, 96, 0.05);
      padding: 2px 8px;
      border-radius: 9999px;
    }
  </style>
</head>
<body>
  <div class="layout">
    <header class="header">
      <div class="logo">
        <div class="logo-icon">
          <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="500" zoomAndPan="magnify" viewBox="0 0 375 374.999991" height="500" preserveAspectRatio="xMidYMid meet" version="1.0"><defs><g/><clipPath id="80f08af47a"><path d="M 4.902344 5.25 L 370.152344 5.25 L 370.152344 370.5 L 4.902344 370.5 Z M 4.902344 5.25 " clip-rule="nonzero"/></clipPath><clipPath id="723b9215da"><path d="M 103.148438 5.25 L 271.851562 5.25 C 273.457031 5.25 275.066406 5.289062 276.671875 5.367188 C 278.277344 5.445312 279.878906 5.566406 281.480469 5.722656 C 283.078125 5.878906 284.675781 6.078125 286.265625 6.3125 C 287.855469 6.546875 289.441406 6.824219 291.015625 7.136719 C 292.59375 7.449219 294.160156 7.800781 295.722656 8.191406 C 297.28125 8.582031 298.832031 9.011719 300.367188 9.480469 C 301.90625 9.945312 303.433594 10.449219 304.949219 10.992188 C 306.460938 11.535156 307.960938 12.113281 309.445312 12.726562 C 310.933594 13.34375 312.402344 13.996094 313.855469 14.679688 C 315.308594 15.367188 316.746094 16.089844 318.164062 16.851562 C 319.582031 17.609375 320.980469 18.398438 322.359375 19.226562 C 323.738281 20.054688 325.09375 20.914062 326.433594 21.804688 C 327.769531 22.699219 329.082031 23.625 330.375 24.582031 C 331.667969 25.539062 332.933594 26.53125 334.175781 27.550781 C 335.417969 28.570312 336.636719 29.621094 337.828125 30.699219 C 339.019531 31.777344 340.183594 32.886719 341.320312 34.023438 C 342.457031 35.160156 343.566406 36.324219 344.644531 37.515625 C 345.726562 38.707031 346.773438 39.925781 347.792969 41.167969 C 348.816406 42.410156 349.804688 43.679688 350.761719 44.96875 C 351.71875 46.261719 352.644531 47.574219 353.539062 48.914062 C 354.429688 50.25 355.292969 51.605469 356.117188 52.984375 C 356.945312 54.367188 357.738281 55.765625 358.496094 57.183594 C 359.253906 58.601562 359.976562 60.035156 360.664062 61.488281 C 361.351562 62.941406 362 64.414062 362.617188 65.898438 C 363.230469 67.382812 363.8125 68.882812 364.351562 70.398438 C 364.894531 71.910156 365.398438 73.4375 365.863281 74.976562 C 366.332031 76.515625 366.761719 78.0625 367.152344 79.621094 C 367.542969 81.183594 367.894531 82.75 368.207031 84.328125 C 368.519531 85.90625 368.796875 87.488281 369.03125 89.078125 C 369.269531 90.667969 369.464844 92.265625 369.621094 93.863281 C 369.78125 95.464844 369.898438 97.066406 369.976562 98.675781 C 370.054688 100.28125 370.09375 101.886719 370.09375 103.496094 L 370.09375 272.195312 C 370.09375 273.800781 370.054688 275.410156 369.976562 277.015625 C 369.898438 278.621094 369.78125 280.222656 369.621094 281.824219 C 369.464844 283.425781 369.269531 285.019531 369.03125 286.609375 C 368.796875 288.199219 368.519531 289.785156 368.207031 291.363281 C 367.894531 292.9375 367.542969 294.507812 367.152344 296.066406 C 366.761719 297.625 366.332031 299.175781 365.863281 300.714844 C 365.398438 302.253906 364.894531 303.777344 364.351562 305.292969 C 363.8125 306.804688 363.230469 308.304688 362.617188 309.792969 C 362 311.277344 361.351562 312.746094 360.664062 314.199219 C 359.976562 315.652344 359.253906 317.089844 358.496094 318.507812 C 357.738281 319.925781 356.945312 321.324219 356.117188 322.703125 C 355.292969 324.082031 354.429688 325.441406 353.539062 326.777344 C 352.644531 328.113281 351.71875 329.429688 350.761719 330.71875 C 349.804688 332.011719 348.816406 333.277344 347.792969 334.519531 C 346.773438 335.765625 345.726562 336.980469 344.644531 338.171875 C 343.566406 339.363281 342.457031 340.527344 341.320312 341.664062 C 340.183594 342.800781 339.019531 343.910156 337.828125 344.988281 C 336.636719 346.070312 335.417969 347.121094 334.175781 348.140625 C 332.933594 349.160156 331.667969 350.148438 330.375 351.105469 C 329.082031 352.0625 327.769531 352.988281 326.433594 353.882812 C 325.09375 354.777344 323.738281 355.636719 322.359375 356.460938 C 320.980469 357.289062 319.582031 358.082031 318.164062 358.839844 C 316.746094 359.597656 315.308594 360.320312 313.855469 361.007812 C 312.402344 361.695312 310.933594 362.347656 309.445312 362.960938 C 307.960938 363.578125 306.460938 364.15625 304.949219 364.695312 C 303.433594 365.238281 301.90625 365.742188 300.367188 366.210938 C 298.832031 366.675781 297.28125 367.105469 295.722656 367.496094 C 294.160156 367.886719 292.59375 368.238281 291.015625 368.550781 C 289.441406 368.867188 287.855469 369.140625 286.265625 369.378906 C 284.675781 369.613281 283.078125 369.808594 281.480469 369.96875 C 279.878906 370.125 278.277344 370.242188 276.671875 370.320312 C 275.066406 370.402344 273.457031 370.441406 271.851562 370.441406 L 103.148438 370.441406 C 101.542969 370.441406 99.933594 370.402344 98.328125 370.320312 C 96.722656 370.242188 95.121094 370.125 93.519531 369.96875 C 91.921875 369.808594 90.324219 369.613281 88.734375 369.378906 C 87.144531 369.140625 85.558594 368.867188 83.984375 368.550781 C 82.40625 368.238281 80.835938 367.886719 79.277344 367.496094 C 77.71875 367.105469 76.167969 366.675781 74.628906 366.210938 C 73.09375 365.742188 71.566406 365.238281 70.050781 364.695312 C 68.539062 364.15625 67.039062 363.578125 65.554688 362.960938 C 64.066406 362.347656 62.597656 361.695312 61.144531 361.007812 C 59.691406 360.320312 58.253906 359.597656 56.835938 358.839844 C 55.417969 358.082031 54.019531 357.289062 52.640625 356.460938 C 51.261719 355.636719 49.90625 354.777344 48.566406 353.882812 C 47.230469 352.988281 45.917969 352.0625 44.625 351.105469 C 43.332031 350.148438 42.066406 349.160156 40.824219 348.140625 C 39.582031 347.121094 38.363281 346.070312 37.171875 344.988281 C 35.980469 343.910156 34.816406 342.800781 33.679688 341.664062 C 32.542969 340.527344 31.433594 339.363281 30.355469 338.171875 C 29.273438 336.980469 28.226562 335.765625 27.203125 334.519531 C 26.183594 333.277344 25.195312 332.011719 24.238281 330.71875 C 23.28125 329.429688 22.355469 328.113281 21.460938 326.777344 C 20.566406 325.441406 19.707031 324.082031 18.882812 322.703125 C 18.054688 321.324219 17.261719 319.925781 16.503906 318.507812 C 15.746094 317.089844 15.023438 315.652344 14.335938 314.199219 C 13.648438 312.746094 12.996094 311.277344 12.382812 309.792969 C 11.765625 308.304688 11.1875 306.804688 10.648438 305.292969 C 10.105469 303.777344 9.601562 302.253906 9.132812 300.714844 C 8.667969 299.175781 8.238281 297.625 7.847656 296.066406 C 7.457031 294.507812 7.105469 292.9375 6.792969 291.363281 C 6.476562 289.785156 6.203125 288.199219 5.96875 286.609375 C 5.730469 285.019531 5.535156 283.425781 5.378906 281.824219 C 5.21875 280.222656 5.101562 278.621094 5.023438 277.015625 C 4.945312 275.410156 4.902344 273.800781 4.902344 272.195312 L 4.902344 103.496094 C 4.902344 101.886719 4.945312 100.28125 5.023438 98.675781 C 5.101562 97.066406 5.21875 95.464844 5.378906 93.863281 C 5.535156 92.265625 5.730469 90.667969 5.96875 89.078125 C 6.203125 87.488281 6.476562 85.90625 6.792969 84.328125 C 7.105469 82.75 7.457031 81.183594 7.847656 79.621094 C 8.238281 78.0625 8.667969 76.515625 9.132812 74.976562 C 9.601562 73.4375 10.105469 71.910156 10.648438 70.398438 C 11.1875 68.882812 11.765625 67.382812 12.382812 65.898438 C 12.996094 64.414062 13.648438 62.941406 14.335938 61.488281 C 15.023438 60.035156 15.746094 58.601562 16.503906 57.183594 C 17.261719 55.765625 18.054688 54.367188 18.882812 52.984375 C 19.707031 51.605469 20.566406 50.25 21.460938 48.914062 C 22.355469 47.574219 23.28125 46.261719 24.238281 44.96875 C 25.195312 43.679688 26.183594 42.410156 27.203125 41.167969 C 28.226562 39.925781 29.273438 38.707031 30.355469 37.515625 C 31.433594 36.324219 32.542969 35.160156 33.679688 34.023438 C 34.816406 32.886719 35.980469 31.777344 37.171875 30.699219 C 38.363281 29.621094 39.582031 28.570312 40.824219 27.550781 C 42.066406 26.53125 43.332031 25.539062 44.625 24.582031 C 45.917969 23.625 47.230469 22.699219 48.566406 21.804688 C 49.90625 20.914062 51.261719 20.054688 52.640625 19.226562 C 54.019531 18.398438 55.417969 17.609375 56.835938 16.851562 C 58.253906 16.089844 59.691406 15.367188 61.144531 14.679688 C 62.597656 13.996094 64.066406 13.34375 65.554688 12.726562 C 67.039062 12.113281 68.539062 11.535156 70.050781 10.992188 C 71.566406 10.449219 73.09375 9.945312 74.628906 9.480469 C 76.167969 9.011719 77.71875 8.582031 79.277344 8.191406 C 80.835938 7.800781 82.40625 7.449219 83.984375 7.136719 C 85.558594 6.824219 87.144531 6.546875 88.734375 6.3125 C 90.324219 6.078125 91.921875 5.878906 93.519531 5.722656 C 95.121094 5.566406 96.722656 5.445312 98.328125 5.367188 C 99.933594 5.289062 101.542969 5.25 103.148438 5.25 Z M 103.148438 5.25 " clip-rule="nonzero"/></clipPath><linearGradient x1="21.35189" gradientTransform="matrix(0, -1.547421, 1.547421, 0, 4.904122, 370.440392)" y1="-15.46228" x2="214.648932" gradientUnits="userSpaceOnUse" y2="251.461714" id="fc3e7af47d"><stop stop-opacity="1" stop-color="rgb(1.33667%, 27.052307%, 39.756775%)" offset="0"/><stop stop-opacity="1" stop-color="rgb(1.371765%, 27.253723%, 39.892578%)" offset="0.00390625"/><stop stop-opacity="1" stop-color="rgb(1.408386%, 27.456665%, 40.029907%)" offset="0.0078125"/><stop stop-opacity="1" stop-color="rgb(1.443481%, 27.659607%, 40.16571%)" offset="0.0117187"/><stop stop-opacity="1" stop-color="rgb(1.480103%, 27.862549%, 40.301514%)" offset="0.015625"/><stop stop-opacity="1" stop-color="rgb(1.515198%, 28.065491%, 40.437317%)" offset="0.0195312"/><stop stop-opacity="1" stop-color="rgb(1.551819%, 28.268433%, 40.574646%)" offset="0.0234375"/><stop stop-opacity="1" stop-color="rgb(1.58844%, 28.469849%, 40.710449%)" offset="0.0273437"/><stop stop-opacity="1" stop-color="rgb(1.625061%, 28.672791%, 40.847778%)" offset="0.03125"/><stop stop-opacity="1" stop-color="rgb(1.660156%, 28.875732%, 40.983582%)" offset="0.0351563"/><stop stop-opacity="1" stop-color="rgb(1.696777%, 29.078674%, 41.120911%)" offset="0.0390625"/><stop stop-opacity="1" stop-color="rgb(1.731873%, 29.28009%, 41.256714%)" offset="0.0429688"/><stop stop-opacity="1" stop-color="rgb(1.768494%, 29.483032%, 41.392517%)" offset="0.046875"/><stop stop-opacity="1" stop-color="rgb(1.803589%, 29.685974%, 41.52832%)" offset="0.0507812"/><stop stop-opacity="1" stop-color="rgb(1.84021%, 29.888916%, 41.665649%)" offset="0.0546875"/><stop stop-opacity="1" stop-color="rgb(1.875305%, 30.091858%, 41.801453%)" offset="0.0585938"/><stop stop-opacity="1" stop-color="rgb(1.911926%, 30.2948%, 41.938782%)" offset="0.0625"/><stop stop-opacity="1" stop-color="rgb(1.948547%, 30.496216%, 42.074585%)" offset="0.0664063"/><stop stop-opacity="1" stop-color="rgb(1.985168%, 30.699158%, 42.210388%)" offset="0.0703125"/><stop stop-opacity="1" stop-color="rgb(2.020264%, 30.9021%, 42.346191%)" offset="0.0742188"/><stop stop-opacity="1" stop-color="rgb(2.056885%, 31.105042%, 42.483521%)" offset="0.078125"/><stop stop-opacity="1" stop-color="rgb(2.09198%, 31.307983%, 42.619324%)" offset="0.0820312"/><stop stop-opacity="1" stop-color="rgb(2.128601%, 31.510925%, 42.756653%)" offset="0.0859375"/><stop stop-opacity="1" stop-color="rgb(2.163696%, 31.712341%, 42.892456%)" offset="0.0898438"/><stop stop-opacity="1" stop-color="rgb(2.200317%, 31.915283%, 43.028259%)" offset="0.09375"/><stop stop-opacity="1" stop-color="rgb(2.236938%, 32.118225%, 43.164062%)" offset="0.0976563"/><stop stop-opacity="1" stop-color="rgb(2.27356%, 32.321167%, 43.301392%)" offset="0.101562"/><stop stop-opacity="1" stop-color="rgb(2.308655%, 32.522583%, 43.437195%)" offset="0.105469"/><stop stop-opacity="1" stop-color="rgb(2.345276%, 32.725525%, 43.574524%)" offset="0.109375"/><stop stop-opacity="1" stop-color="rgb(2.380371%, 32.928467%, 43.710327%)" offset="0.113281"/><stop stop-opacity="1" stop-color="rgb(2.416992%, 33.131409%, 43.847656%)" offset="0.117188"/><stop stop-opacity="1" stop-color="rgb(2.452087%, 33.334351%, 43.983459%)" offset="0.121094"/><stop stop-opacity="1" stop-color="rgb(2.488708%, 33.537292%, 44.119263%)" offset="0.125"/><stop stop-opacity="1" stop-color="rgb(2.523804%, 33.738708%, 44.255066%)" offset="0.128906"/><stop stop-opacity="1" stop-color="rgb(2.560425%, 33.94165%, 44.392395%)" offset="0.132813"/><stop stop-opacity="1" stop-color="rgb(2.597046%, 34.144592%, 44.528198%)" offset="0.136719"/><stop stop-opacity="1" stop-color="rgb(2.633667%, 34.347534%, 44.665527%)" offset="0.140625"/><stop stop-opacity="1" stop-color="rgb(2.668762%, 34.54895%, 44.801331%)" offset="0.144531"/><stop stop-opacity="1" stop-color="rgb(2.705383%, 34.751892%, 44.937134%)" offset="0.148438"/><stop stop-opacity="1" stop-color="rgb(2.740479%, 34.954834%, 45.072937%)" offset="0.152344"/><stop stop-opacity="1" stop-color="rgb(2.7771%, 35.157776%, 45.210266%)" offset="0.15625"/><stop stop-opacity="1" stop-color="rgb(2.812195%, 35.360718%, 45.346069%)" offset="0.160156"/><stop stop-opacity="1" stop-color="rgb(2.848816%, 35.56366%, 45.483398%)" offset="0.164063"/><stop stop-opacity="1" stop-color="rgb(2.885437%, 35.765076%, 45.619202%)" offset="0.167969"/><stop stop-opacity="1" stop-color="rgb(2.922058%, 35.968018%, 45.756531%)" offset="0.171875"/><stop stop-opacity="1" stop-color="rgb(2.957153%, 36.170959%, 45.892334%)" offset="0.175781"/><stop stop-opacity="1" stop-color="rgb(2.993774%, 36.373901%, 46.028137%)" offset="0.179688"/><stop stop-opacity="1" stop-color="rgb(3.02887%, 36.576843%, 46.16394%)" offset="0.183594"/><stop stop-opacity="1" stop-color="rgb(3.065491%, 36.779785%, 46.30127%)" offset="0.1875"/><stop stop-opacity="1" stop-color="rgb(3.100586%, 36.981201%, 46.437073%)" offset="0.191406"/><stop stop-opacity="1" stop-color="rgb(3.137207%, 37.184143%, 46.574402%)" offset="0.195312"/><stop stop-opacity="1" stop-color="rgb(3.173828%, 37.387085%, 46.710205%)" offset="0.199219"/><stop stop-opacity="1" stop-color="rgb(3.210449%, 37.590027%, 46.846008%)" offset="0.203125"/><stop stop-opacity="1" stop-color="rgb(3.245544%, 37.791443%, 46.981812%)" offset="0.207031"/><stop stop-opacity="1" stop-color="rgb(3.282166%, 37.994385%, 47.119141%)" offset="0.210938"/><stop stop-opacity="1" stop-color="rgb(3.317261%, 38.197327%, 47.254944%)" offset="0.214844"/><stop stop-opacity="1" stop-color="rgb(3.353882%, 38.400269%, 47.392273%)" offset="0.21875"/><stop stop-opacity="1" stop-color="rgb(3.388977%, 38.60321%, 47.528076%)" offset="0.222656"/><stop stop-opacity="1" stop-color="rgb(3.425598%, 38.806152%, 47.663879%)" offset="0.226563"/><stop stop-opacity="1" stop-color="rgb(3.460693%, 39.007568%, 47.799683%)" offset="0.230469"/><stop stop-opacity="1" stop-color="rgb(3.497314%, 39.21051%, 47.937012%)" offset="0.234375"/><stop stop-opacity="1" stop-color="rgb(3.533936%, 39.413452%, 48.072815%)" offset="0.238281"/><stop stop-opacity="1" stop-color="rgb(3.570557%, 39.616394%, 48.210144%)" offset="0.242188"/><stop stop-opacity="1" stop-color="rgb(3.605652%, 39.819336%, 48.345947%)" offset="0.246094"/><stop stop-opacity="1" stop-color="rgb(3.642273%, 40.022278%, 48.483276%)" offset="0.25"/><stop stop-opacity="1" stop-color="rgb(3.677368%, 40.223694%, 48.61908%)" offset="0.253906"/><stop stop-opacity="1" stop-color="rgb(3.713989%, 40.426636%, 48.754883%)" offset="0.257812"/><stop stop-opacity="1" stop-color="rgb(3.749084%, 40.629578%, 48.890686%)" offset="0.261719"/><stop stop-opacity="1" stop-color="rgb(3.785706%, 40.83252%, 49.028015%)" offset="0.265625"/><stop stop-opacity="1" stop-color="rgb(3.822327%, 41.033936%, 49.163818%)" offset="0.269531"/><stop stop-opacity="1" stop-color="rgb(3.858948%, 41.236877%, 49.301147%)" offset="0.273438"/><stop stop-opacity="1" stop-color="rgb(3.894043%, 41.439819%, 49.436951%)" offset="0.277344"/><stop stop-opacity="1" stop-color="rgb(3.930664%, 41.642761%, 49.572754%)" offset="0.28125"/><stop stop-opacity="1" stop-color="rgb(3.965759%, 41.845703%, 49.708557%)" offset="0.285156"/><stop stop-opacity="1" stop-color="rgb(4.00238%, 42.048645%, 49.845886%)" offset="0.289063"/><stop stop-opacity="1" stop-color="rgb(4.037476%, 42.250061%, 49.981689%)" offset="0.292969"/><stop stop-opacity="1" stop-color="rgb(4.074097%, 42.453003%, 50.119019%)" offset="0.296875"/><stop stop-opacity="1" stop-color="rgb(4.109192%, 42.655945%, 50.254822%)" offset="0.300781"/><stop stop-opacity="1" stop-color="rgb(4.145813%, 42.858887%, 50.392151%)" offset="0.304688"/><stop stop-opacity="1" stop-color="rgb(4.182434%, 43.060303%, 50.527954%)" offset="0.308594"/><stop stop-opacity="1" stop-color="rgb(4.219055%, 43.263245%, 50.663757%)" offset="0.3125"/><stop stop-opacity="1" stop-color="rgb(4.25415%, 43.466187%, 50.799561%)" offset="0.316406"/><stop stop-opacity="1" stop-color="rgb(4.290771%, 43.669128%, 50.93689%)" offset="0.320313"/><stop stop-opacity="1" stop-color="rgb(4.325867%, 43.87207%, 51.072693%)" offset="0.324219"/><stop stop-opacity="1" stop-color="rgb(4.362488%, 44.075012%, 51.210022%)" offset="0.328125"/><stop stop-opacity="1" stop-color="rgb(4.397583%, 44.276428%, 51.345825%)" offset="0.332031"/><stop stop-opacity="1" stop-color="rgb(4.434204%, 44.47937%, 51.481628%)" offset="0.335938"/><stop stop-opacity="1" stop-color="rgb(4.470825%, 44.682312%, 51.617432%)" offset="0.339844"/><stop stop-opacity="1" stop-color="rgb(4.507446%, 44.885254%, 51.754761%)" offset="0.34375"/><stop stop-opacity="1" stop-color="rgb(4.542542%, 45.088196%, 51.890564%)" offset="0.347656"/><stop stop-opacity="1" stop-color="rgb(4.579163%, 45.291138%, 52.027893%)" offset="0.351562"/><stop stop-opacity="1" stop-color="rgb(4.614258%, 45.492554%, 52.163696%)" offset="0.355469"/><stop stop-opacity="1" stop-color="rgb(4.650879%, 45.695496%, 52.2995%)" offset="0.359375"/><stop stop-opacity="1" stop-color="rgb(4.685974%, 45.898438%, 52.435303%)" offset="0.363281"/><stop stop-opacity="1" stop-color="rgb(4.722595%, 46.101379%, 52.572632%)" offset="0.367188"/><stop stop-opacity="1" stop-color="rgb(4.75769%, 46.302795%, 52.708435%)" offset="0.371094"/><stop stop-opacity="1" stop-color="rgb(4.794312%, 46.505737%, 52.845764%)" offset="0.375"/><stop stop-opacity="1" stop-color="rgb(4.830933%, 46.708679%, 52.981567%)" offset="0.378906"/><stop stop-opacity="1" stop-color="rgb(4.867554%, 46.911621%, 53.118896%)" offset="0.382813"/><stop stop-opacity="1" stop-color="rgb(4.902649%, 47.114563%, 53.2547%)" offset="0.386719"/><stop stop-opacity="1" stop-color="rgb(4.93927%, 47.317505%, 53.390503%)" offset="0.390625"/><stop stop-opacity="1" stop-color="rgb(4.974365%, 47.518921%, 53.526306%)" offset="0.394531"/><stop stop-opacity="1" stop-color="rgb(5.010986%, 47.721863%, 53.663635%)" offset="0.398438"/><stop stop-opacity="1" stop-color="rgb(5.046082%, 47.924805%, 53.799438%)" offset="0.402344"/><stop stop-opacity="1" stop-color="rgb(5.082703%, 48.127747%, 53.936768%)" offset="0.40625"/><stop stop-opacity="1" stop-color="rgb(5.119324%, 48.330688%, 54.072571%)" offset="0.410156"/><stop stop-opacity="1" stop-color="rgb(5.155945%, 48.53363%, 54.208374%)" offset="0.414063"/><stop stop-opacity="1" stop-color="rgb(5.19104%, 48.735046%, 54.344177%)" offset="0.417969"/><stop stop-opacity="1" stop-color="rgb(5.227661%, 48.937988%, 54.481506%)" offset="0.421875"/><stop stop-opacity="1" stop-color="rgb(5.262756%, 49.14093%, 54.61731%)" offset="0.425781"/><stop stop-opacity="1" stop-color="rgb(5.299377%, 49.343872%, 54.754639%)" offset="0.429688"/><stop stop-opacity="1" stop-color="rgb(5.334473%, 49.545288%, 54.890442%)" offset="0.433594"/><stop stop-opacity="1" stop-color="rgb(5.371094%, 49.74823%, 55.026245%)" offset="0.4375"/><stop stop-opacity="1" stop-color="rgb(5.406189%, 49.951172%, 55.162048%)" offset="0.441406"/><stop stop-opacity="1" stop-color="rgb(5.44281%, 50.154114%, 55.299377%)" offset="0.445313"/><stop stop-opacity="1" stop-color="rgb(5.479431%, 50.357056%, 55.435181%)" offset="0.449219"/><stop stop-opacity="1" stop-color="rgb(5.516052%, 50.559998%, 55.57251%)" offset="0.453125"/><stop stop-opacity="1" stop-color="rgb(5.551147%, 50.761414%, 55.708313%)" offset="0.457031"/><stop stop-opacity="1" stop-color="rgb(5.587769%, 50.964355%, 55.845642%)" offset="0.460938"/><stop stop-opacity="1" stop-color="rgb(5.622864%, 51.167297%, 55.981445%)" offset="0.464844"/><stop stop-opacity="1" stop-color="rgb(5.659485%, 51.370239%, 56.117249%)" offset="0.46875"/><stop stop-opacity="1" stop-color="rgb(5.69458%, 51.573181%, 56.253052%)" offset="0.472656"/><stop stop-opacity="1" stop-color="rgb(5.731201%, 51.776123%, 56.390381%)" offset="0.476563"/><stop stop-opacity="1" stop-color="rgb(5.767822%, 51.977539%, 56.526184%)" offset="0.480469"/><stop stop-opacity="1" stop-color="rgb(5.804443%, 52.180481%, 56.663513%)" offset="0.484375"/><stop stop-opacity="1" stop-color="rgb(5.839539%, 52.383423%, 56.799316%)" offset="0.488281"/><stop stop-opacity="1" stop-color="rgb(5.87616%, 52.586365%, 56.93512%)" offset="0.492188"/><stop stop-opacity="1" stop-color="rgb(5.911255%, 52.787781%, 57.070923%)" offset="0.496094"/><stop stop-opacity="1" stop-color="rgb(5.947876%, 52.990723%, 57.208252%)" offset="0.5"/><stop stop-opacity="1" stop-color="rgb(5.982971%, 53.193665%, 57.344055%)" offset="0.503906"/><stop stop-opacity="1" stop-color="rgb(6.019592%, 53.396606%, 57.481384%)" offset="0.507813"/><stop stop-opacity="1" stop-color="rgb(6.054688%, 53.599548%, 57.617188%)" offset="0.511719"/><stop stop-opacity="1" stop-color="rgb(6.091309%, 53.80249%, 57.754517%)" offset="0.515625"/><stop stop-opacity="1" stop-color="rgb(6.12793%, 54.003906%, 57.89032%)" offset="0.519531"/><stop stop-opacity="1" stop-color="rgb(6.164551%, 54.206848%, 58.026123%)" offset="0.523438"/><stop stop-opacity="1" stop-color="rgb(6.199646%, 54.40979%, 58.161926%)" offset="0.527344"/><stop stop-opacity="1" stop-color="rgb(6.236267%, 54.612732%, 58.299255%)" offset="0.53125"/><stop stop-opacity="1" stop-color="rgb(6.271362%, 54.814148%, 58.435059%)" offset="0.535156"/><stop stop-opacity="1" stop-color="rgb(6.307983%, 55.01709%, 58.572388%)" offset="0.539063"/><stop stop-opacity="1" stop-color="rgb(6.343079%, 55.220032%, 58.708191%)" offset="0.542969"/><stop stop-opacity="1" stop-color="rgb(6.3797%, 55.422974%, 58.843994%)" offset="0.546875"/><stop stop-opacity="1" stop-color="rgb(6.416321%, 55.625916%, 58.979797%)" offset="0.550781"/><stop stop-opacity="1" stop-color="rgb(6.452942%, 55.828857%, 59.117126%)" offset="0.554688"/><stop stop-opacity="1" stop-color="rgb(6.488037%, 56.030273%, 59.25293%)" offset="0.558594"/><stop stop-opacity="1" stop-color="rgb(6.524658%, 56.233215%, 59.390259%)" offset="0.5625"/><stop stop-opacity="1" stop-color="rgb(6.559753%, 56.436157%, 59.526062%)" offset="0.566406"/><stop stop-opacity="1" stop-color="rgb(6.596375%, 56.639099%, 59.661865%)" offset="0.570313"/><stop stop-opacity="1" stop-color="rgb(6.63147%, 56.842041%, 59.797668%)" offset="0.574219"/><stop stop-opacity="1" stop-color="rgb(6.668091%, 57.044983%, 59.934998%)" offset="0.578125"/><stop stop-opacity="1" stop-color="rgb(6.703186%, 57.246399%, 60.070801%)" offset="0.582031"/><stop stop-opacity="1" stop-color="rgb(6.739807%, 57.449341%, 60.20813%)" offset="0.585938"/><stop stop-opacity="1" stop-color="rgb(6.776428%, 57.652283%, 60.343933%)" offset="0.589844"/><stop stop-opacity="1" stop-color="rgb(6.813049%, 57.855225%, 60.481262%)" offset="0.59375"/><stop stop-opacity="1" stop-color="rgb(6.848145%, 58.056641%, 60.617065%)" offset="0.597656"/><stop stop-opacity="1" stop-color="rgb(6.884766%, 58.259583%, 60.752869%)" offset="0.601563"/><stop stop-opacity="1" stop-color="rgb(6.919861%, 58.462524%, 60.888672%)" offset="0.605469"/><stop stop-opacity="1" stop-color="rgb(6.956482%, 58.665466%, 61.026001%)" offset="0.609375"/><stop stop-opacity="1" stop-color="rgb(6.991577%, 58.868408%, 61.161804%)" offset="0.613281"/><stop stop-opacity="1" stop-color="rgb(7.028198%, 59.07135%, 61.299133%)" offset="0.617188"/><stop stop-opacity="1" stop-color="rgb(7.064819%, 59.272766%, 61.434937%)" offset="0.621094"/><stop stop-opacity="1" stop-color="rgb(7.10144%, 59.475708%, 61.57074%)" offset="0.625"/><stop stop-opacity="1" stop-color="rgb(7.136536%, 59.67865%, 61.706543%)" offset="0.628906"/><stop stop-opacity="1" stop-color="rgb(7.173157%, 59.881592%, 61.843872%)" offset="0.632813"/><stop stop-opacity="1" stop-color="rgb(7.208252%, 60.084534%, 61.979675%)" offset="0.636719"/><stop stop-opacity="1" stop-color="rgb(7.244873%, 60.287476%, 62.117004%)" offset="0.640625"/><stop stop-opacity="1" stop-color="rgb(7.279968%, 60.488892%, 62.252808%)" offset="0.644531"/><stop stop-opacity="1" stop-color="rgb(7.316589%, 60.691833%, 62.390137%)" offset="0.648438"/><stop stop-opacity="1" stop-color="rgb(7.35321%, 60.894775%, 62.52594%)" offset="0.652344"/><stop stop-opacity="1" stop-color="rgb(7.389832%, 61.097717%, 62.661743%)" offset="0.65625"/><stop stop-opacity="1" stop-color="rgb(7.424927%, 61.299133%, 62.797546%)" offset="0.660156"/><stop stop-opacity="1" stop-color="rgb(7.461548%, 61.502075%, 62.934875%)" offset="0.664063"/><stop stop-opacity="1" stop-color="rgb(7.496643%, 61.705017%, 63.070679%)" offset="0.667969"/><stop stop-opacity="1" stop-color="rgb(7.533264%, 61.907959%, 63.208008%)" offset="0.671875"/><stop stop-opacity="1" stop-color="rgb(7.568359%, 62.110901%, 63.343811%)" offset="0.675781"/><stop stop-opacity="1" stop-color="rgb(7.60498%, 62.313843%, 63.479614%)" offset="0.679688"/><stop stop-opacity="1" stop-color="rgb(7.640076%, 62.515259%, 63.615417%)" offset="0.683594"/><stop stop-opacity="1" stop-color="rgb(7.676697%, 62.718201%, 63.752747%)" offset="0.6875"/><stop stop-opacity="1" stop-color="rgb(7.713318%, 62.921143%, 63.88855%)" offset="0.691406"/><stop stop-opacity="1" stop-color="rgb(7.749939%, 63.124084%, 64.025879%)" offset="0.695313"/><stop stop-opacity="1" stop-color="rgb(7.785034%, 63.3255%, 64.161682%)" offset="0.699219"/><stop stop-opacity="1" stop-color="rgb(7.821655%, 63.528442%, 64.297485%)" offset="0.703125"/><stop stop-opacity="1" stop-color="rgb(7.85675%, 63.731384%, 64.433289%)" offset="0.707031"/><stop stop-opacity="1" stop-color="rgb(7.893372%, 63.934326%, 64.570618%)" offset="0.710938"/><stop stop-opacity="1" stop-color="rgb(7.928467%, 64.137268%, 64.706421%)" offset="0.714844"/><stop stop-opacity="1" stop-color="rgb(7.965088%, 64.34021%, 64.84375%)" offset="0.71875"/><stop stop-opacity="1" stop-color="rgb(8.001709%, 64.541626%, 64.979553%)" offset="0.722656"/><stop stop-opacity="1" stop-color="rgb(8.03833%, 64.744568%, 65.116882%)" offset="0.726563"/><stop stop-opacity="1" stop-color="rgb(8.073425%, 64.94751%, 65.252686%)" offset="0.730469"/><stop stop-opacity="1" stop-color="rgb(8.110046%, 65.150452%, 65.388489%)" offset="0.734375"/><stop stop-opacity="1" stop-color="rgb(8.145142%, 65.353394%, 65.524292%)" offset="0.738281"/><stop stop-opacity="1" stop-color="rgb(8.181763%, 65.556335%, 65.661621%)" offset="0.742188"/><stop stop-opacity="1" stop-color="rgb(8.210754%, 65.718079%, 65.769958%)" offset="0.75"/><stop stop-opacity="1" stop-color="rgb(8.239746%, 65.879822%, 65.879822%)" offset="1"/></linearGradient></defs><g clip-path="url(#80f08af47a)"><g clip-path="url(#723b9215da)"><path fill="url(#fc3e7af47d)" d="M 4.902344 370.441406 L 370.09375 370.441406 L 370.09375 5.25 L 4.902344 5.25 Z M 4.902344 370.441406 " fill-rule="nonzero"/></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(14.595707, 240.71852)"><g><path d="M 73.75 -113.28125 C 77.832031 -113.28125 81.632812 -112.507812 85.15625 -110.96875 C 88.6875 -109.425781 91.773438 -107.332031 94.421875 -104.6875 C 97.066406 -102.039062 99.160156 -98.953125 100.703125 -95.421875 C 102.253906 -91.890625 103.03125 -88.140625 103.03125 -84.171875 L 103.03125 -29.109375 C 103.03125 -25.140625 102.253906 -21.390625 100.703125 -17.859375 C 99.160156 -14.328125 97.066406 -11.238281 94.421875 -8.59375 C 91.773438 -5.945312 88.6875 -3.851562 85.15625 -2.3125 C 81.632812 -0.769531 77.832031 0 73.75 0 L 41.515625 0 C 37.429688 0 33.625 -0.769531 30.09375 -2.3125 C 26.570312 -3.851562 23.488281 -5.945312 20.84375 -8.59375 C 18.195312 -11.238281 16.097656 -14.328125 14.546875 -17.859375 C 13.003906 -21.390625 12.234375 -25.140625 12.234375 -29.109375 L 12.234375 -84.171875 C 12.234375 -88.140625 13.003906 -91.890625 14.546875 -95.421875 C 16.097656 -98.953125 18.195312 -102.039062 20.84375 -104.6875 C 23.488281 -107.332031 26.570312 -109.425781 30.09375 -110.96875 C 33.625 -112.507812 37.429688 -113.28125 41.515625 -113.28125 Z M 80.375 -84.171875 C 80.375 -86.046875 79.738281 -87.585938 78.46875 -88.796875 C 77.195312 -90.015625 75.625 -90.625 73.75 -90.625 L 41.515625 -90.625 C 39.640625 -90.625 38.066406 -90.015625 36.796875 -88.796875 C 35.523438 -87.585938 34.890625 -86.046875 34.890625 -84.171875 L 34.890625 -29.109375 C 34.890625 -27.234375 35.523438 -25.6875 36.796875 -24.46875 C 38.066406 -23.257812 39.640625 -22.65625 41.515625 -22.65625 L 73.75 -22.65625 C 75.625 -22.65625 77.195312 -23.257812 78.46875 -24.46875 C 79.738281 -25.6875 80.375 -27.234375 80.375 -29.109375 Z M 80.375 -84.171875 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(129.862068, 240.71852)"><g><path d="M 80.203125 -109.8125 C 80.203125 -110.800781 80.5625 -111.65625 81.28125 -112.375 C 82 -113.09375 82.851562 -113.453125 83.84375 -113.453125 L 99.390625 -113.453125 C 100.378906 -113.453125 101.234375 -113.09375 101.953125 -112.375 C 102.671875 -111.65625 103.03125 -110.800781 103.03125 -109.8125 L 103.03125 -3.640625 C 103.03125 -2.648438 102.671875 -1.796875 101.953125 -1.078125 C 101.234375 -0.359375 100.378906 0 99.390625 0 L 83.84375 0 C 82.851562 0 82 -0.359375 81.28125 -1.078125 C 80.5625 -1.796875 80.203125 -2.648438 80.203125 -3.640625 L 80.203125 -42.34375 L 34.890625 -83.015625 L 34.890625 -3.640625 C 34.890625 -2.648438 34.53125 -1.796875 33.8125 -1.078125 C 33.101562 -0.359375 32.25 0 31.25 0 L 15.875 0 C 14.882812 0 14.03125 -0.359375 13.3125 -1.078125 C 12.59375 -1.796875 12.234375 -2.648438 12.234375 -3.640625 L 12.234375 -109.8125 C 12.234375 -110.800781 12.59375 -111.65625 13.3125 -112.375 C 14.03125 -113.09375 14.882812 -113.453125 15.875 -113.453125 L 31.25 -113.453125 C 32.25 -113.453125 33.351562 -113.203125 34.5625 -112.703125 C 35.769531 -112.203125 36.765625 -111.625 37.546875 -110.96875 L 80.203125 -72.765625 Z M 80.203125 -109.8125 "/></g></g></g><g fill="#ffffff" fill-opacity="1"><g transform="translate(245.12843, 240.71852)"><g><path d="M 99.390625 -113.453125 C 100.378906 -113.453125 101.234375 -113.09375 101.953125 -112.375 C 102.671875 -111.65625 103.03125 -110.800781 103.03125 -109.8125 L 103.03125 -94.265625 C 103.03125 -93.273438 102.671875 -92.445312 101.953125 -91.78125 C 101.234375 -91.125 100.378906 -90.796875 99.390625 -90.796875 L 68.96875 -90.796875 L 68.96875 -3.640625 C 68.96875 -2.648438 68.609375 -1.796875 67.890625 -1.078125 C 67.171875 -0.359375 66.316406 0 65.328125 0 L 49.78125 0 C 48.789062 0 47.960938 -0.359375 47.296875 -1.078125 C 46.640625 -1.796875 46.3125 -2.648438 46.3125 -3.640625 L 46.3125 -90.796875 L 15.875 -90.796875 C 14.882812 -90.796875 14.03125 -91.125 13.3125 -91.78125 C 12.59375 -92.445312 12.234375 -93.273438 12.234375 -94.265625 L 12.234375 -109.8125 C 12.234375 -110.800781 12.59375 -111.65625 13.3125 -112.375 C 14.03125 -113.09375 14.882812 -113.453125 15.875 -113.453125 Z M 99.390625 -113.453125 "/></g></g></g></svg>
        </div>
        <span>${graphData.meta.ontologyName}</span>
      </div>

      <div class="search-container">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input type="text" class="search-input" id="searchInput" placeholder="Search nodes... (press /)" />
        <div class="search-results" id="searchResults"></div>
      </div>

      <div class="view-tabs">
        <button class="view-tab active" data-view="graph">Graph</button>
        <button class="view-tab" data-view="table">Table</button>
      </div>

      <div class="filter-buttons" id="graphFilters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="function">
          <span class="dot function"></span> Functions
        </button>
        <button class="filter-btn" data-filter="entity">
          <span class="dot entity"></span> Entities
        </button>
        <button class="filter-btn" data-filter="accessGroup">
          <span class="dot access"></span> Access
        </button>
      </div>

      <div class="layout-selector">
        <button class="layout-btn active" data-layout="cose" title="Force-directed">Force</button>
        <button class="layout-btn" data-layout="circle" title="Circular">Circle</button>
        <button class="layout-btn" data-layout="grid" title="Grid">Grid</button>
      </div>
    </header>

    <aside class="sidebar">
      <div class="sidebar-section">
        <div class="sidebar-title">Overview</div>
        <div class="stat-grid">
          <div class="stat-card" data-filter="function">
            <div class="stat-value">${graphData.meta.totalFunctions}</div>
            <div class="stat-label"><span class="dot" style="background: var(--node-function)"></span> Functions</div>
          </div>
          <div class="stat-card" data-filter="entity">
            <div class="stat-value">${graphData.meta.totalEntities}</div>
            <div class="stat-label"><span class="dot" style="background: var(--node-entity)"></span> Entities</div>
          </div>
          <div class="stat-card" data-filter="accessGroup">
            <div class="stat-value">${graphData.meta.totalAccessGroups}</div>
            <div class="stat-label"><span class="dot" style="background: var(--node-access)"></span> Access Groups</div>
          </div>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-title">Node Types</div>
        <div class="legend-item">
          <div class="legend-shape function"></div>
          <div class="legend-text">Function</div>
        </div>
        <div class="legend-item">
          <div class="legend-shape entity"></div>
          <div class="legend-text">Entity</div>
        </div>
        <div class="legend-item">
          <div class="legend-shape access"></div>
          <div class="legend-text">Access Group</div>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-title">Edge Types</div>
        <div class="legend-edge">
          <div class="legend-line operates"></div>
          <div class="legend-text">Operates on</div>
        </div>
        <div class="legend-edge">
          <div class="legend-line access"></div>
          <div class="legend-text">Requires access</div>
        </div>
        <div class="legend-edge">
          <div class="legend-line depends"></div>
          <div class="legend-text">Depends on</div>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-title">Keyboard Shortcuts</div>
        <div style="font-size: 12px; color: var(--text-secondary);">
          <p style="margin-bottom: 8px;"><span class="kbd">/</span> Search</p>
          <p style="margin-bottom: 8px;"><span class="kbd">Esc</span> Clear selection</p>
          <p style="margin-bottom: 8px;"><span class="kbd">F</span> Fit to view</p>
          <p><span class="kbd">1-4</span> Filter types</p>
        </div>
      </div>
    </aside>

    <main class="graph-container">
      <div id="cy"></div>
      <div class="graph-controls">
        <button class="graph-control-btn" id="zoomIn" title="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
          </svg>
        </button>
        <button class="graph-control-btn" id="zoomOut" title="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/>
          </svg>
        </button>
        <button class="graph-control-btn" id="fitView" title="Fit to view">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>
          </svg>
        </button>
      </div>
    </main>

    <aside class="detail-panel empty" id="detailPanel">
      <div class="empty-state-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
        </svg>
      </div>
      <div class="empty-state-title">Select a node</div>
      <div class="empty-state-text">Click on any node in the graph to view its details, connections, and schema.</div>
    </aside>

    <!-- Table View -->
    <div class="table-view" id="tableView">
      <div id="tableContent"></div>
    </div>
  </div>

  <!-- Review Footer -->
  <div class="review-footer ${graphData.meta.hasChanges ? '' : 'hidden'}" id="reviewFooter">
    <div class="changes-summary">
      <span>Pending changes:</span>
      ${graphData.meta.addedCount > 0 ? `<span class="change-count added">+${graphData.meta.addedCount} added</span>` : ''}
      ${graphData.meta.removedCount > 0 ? `<span class="change-count removed">−${graphData.meta.removedCount} removed</span>` : ''}
      ${graphData.meta.modifiedCount > 0 ? `<span class="change-count modified">~${graphData.meta.modifiedCount} modified</span>` : ''}
    </div>
    <div class="review-actions">
      <button class="review-btn reject" id="rejectBtn">Reject Changes</button>
      <button class="review-btn approve" id="approveBtn">Approve & Update Lockfile</button>
    </div>
  </div>

  <script>
    const graphData = ${JSON.stringify(graphData)};
    let cy;
    let selectedNode = null;
    let activeFilter = 'all';

    // Initialize Cytoscape
    function initGraph() {
      const elements = [];

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

      cy = cytoscape({
        container: document.getElementById('cy'),
        elements,
        style: [
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
        ],
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
      cy.on('tap', 'node', function(evt) {
        const node = evt.target;
        selectNode(node);
      });

      // Background click handler
      cy.on('tap', function(evt) {
        if (evt.target === cy) {
          clearSelection();
        }
      });
    }

    function selectNode(node) {
      // Clear previous selection styling
      cy.elements().removeClass('highlighted dimmed');

      // Select node
      cy.nodes().unselect();
      node.select();
      selectedNode = node;

      // Highlight connected nodes and edges
      const connectedEdges = node.connectedEdges();
      const connectedNodes = connectedEdges.connectedNodes();

      node.addClass('highlighted');
      connectedNodes.addClass('highlighted');
      connectedEdges.addClass('highlighted');

      cy.elements().not(node).not(connectedNodes).not(connectedEdges).addClass('dimmed');

      // Update detail panel
      updateDetailPanel(node.data());
    }

    function selectNodeById(nodeId) {
      const node = cy.getElementById(nodeId);
      if (node.length > 0) {
        selectNode(node);
        cy.animate({
          center: { eles: node },
          zoom: 1.5,
          duration: 300,
        });
      }
    }

    function clearSelection() {
      cy.elements().removeClass('highlighted dimmed');
      cy.nodes().unselect();
      selectedNode = null;
      showEmptyState();
    }

    function showEmptyState() {
      const panel = document.getElementById('detailPanel');
      panel.className = 'detail-panel empty';
      panel.innerHTML = \`
        <div class="empty-state-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
          </svg>
        </div>
        <div class="empty-state-title">Select a node</div>
        <div class="empty-state-text">Click on any node in the graph to view its details, connections, and schema.</div>
      \`;
    }

    async function updateDetailPanel(data) {
      const panel = document.getElementById('detailPanel');
      panel.className = 'detail-panel';

      // Fetch detailed node data
      const [type, id] = data.id.split(':');
      const response = await fetch(\`/api/node/\${type}/\${id}\`);
      const details = await response.json();

      // Build change status badge if applicable
      const changeStatus = data.changeStatus || 'unchanged';
      const changeBadge = changeStatus !== 'unchanged'
        ? \`<span class="detail-change-badge \${changeStatus}">\${changeStatus === 'added' ? 'New' : changeStatus === 'removed' ? 'Removed' : 'Modified'}</span>\`
        : '';

      let html = \`
        <div class="detail-header">
          <div class="detail-type \${data.type}">\${formatType(data.type)}\${changeBadge}</div>
          <div class="detail-name">\${data.label}</div>
          <div class="detail-description">\${data.description || 'No description'}</div>
        </div>
      \`;

      // Show change details if this node was modified
      if (changeStatus !== 'unchanged' && data.changeDetails) {
        html += buildChangeSection(changeStatus, data.changeDetails);
      } else if (changeStatus === 'added') {
        html += \`
          <div class="detail-section change-section added">
            <div class="detail-section-title">Change</div>
            <div class="change-summary">This is a newly added \${formatType(data.type).toLowerCase()}.</div>
          </div>
        \`;
      } else if (changeStatus === 'removed') {
        html += \`
          <div class="detail-section change-section removed">
            <div class="detail-section-title">Change</div>
            <div class="change-summary">This \${formatType(data.type).toLowerCase()} will be removed.</div>
          </div>
        \`;
      }

      if (data.type === 'function') {
        // Access Groups
        if (details.connections.accessGroups.length > 0) {
          html += \`
            <div class="detail-section">
              <div class="detail-section-title">Access Groups</div>
              <div class="tag-list">
                \${details.connections.accessGroups.map(g =>
                  \`<span class="tag access" onclick="selectNodeById('accessGroup:\${g}')">\${g}</span>\`
                ).join('')}
              </div>
            </div>
          \`;
        }

        // Entities
        if (details.connections.entities.length > 0) {
          html += \`
            <div class="detail-section">
              <div class="detail-section-title">Entities</div>
              <div class="tag-list">
                \${details.connections.entities.map(e =>
                  \`<span class="tag entity" onclick="selectNodeById('entity:\${e}')">\${e}</span>\`
                ).join('')}
              </div>
            </div>
          \`;
        }

        // Dependencies
        if (details.connections.dependsOn.length > 0) {
          html += \`
            <div class="detail-section">
              <div class="detail-section-title">Dependencies (fieldFrom)</div>
              \${details.connections.dependsOn.map(d => \`
                <div class="dependency-item">
                  <span class="function-link" onclick="selectNodeById('function:\${d.functionName}')">\${d.functionName}</span>
                  <span class="dependency-path">\${d.path}</span>
                </div>
              \`).join('')}
            </div>
          \`;
        }

        // Depended on by
        if (details.connections.dependedOnBy.length > 0) {
          html += \`
            <div class="detail-section">
              <div class="detail-section-title">Used By</div>
              <ul class="function-list">
                \${details.connections.dependedOnBy.map(f => \`
                  <li><span class="function-link" onclick="selectNodeById('function:\${f}')">\${f}</span></li>
                \`).join('')}
              </ul>
            </div>
          \`;
        }

        // Input Schema
        if (data.metadata.inputs) {
          html += \`
            <div class="detail-section">
              <div class="detail-section-title">Input Schema</div>
              <pre class="schema-viewer">\${formatSchema(data.metadata.inputs)}</pre>
            </div>
          \`;
        }

        // Returns (prominent display)
        if (data.metadata.outputs) {
          html += \`
            <div class="detail-section returns-section">
              <div class="detail-section-title">Returns</div>
              <div class="returns-display">
                <span class="returns-type-large">\${formatSchemaType(data.metadata.outputs)}</span>
              </div>
              <pre class="schema-viewer">\${formatSchema(data.metadata.outputs)}</pre>
            </div>
          \`;
        }
      } else if (data.type === 'accessGroup' || data.type === 'entity') {
        // Functions with details
        if (details.connections.functions.length > 0) {
          html += \`
            <div class="detail-section">
              <div class="detail-section-title">Functions (\${details.connections.functions.length})</div>
              <div class="function-cards">
                \${details.connections.functions.map(f => \`
                  <div class="function-card" onclick="selectNodeById('function:\${f.name}')">
                    <div class="function-card-header">
                      <span class="function-card-name">\${f.name}</span>
                    </div>
                    <div class="function-card-desc">\${f.description}</div>
                    \${f.outputs ? \`
                      <div class="function-card-returns">
                        <span class="returns-label">Returns:</span>
                        <span class="returns-type">\${formatSchemaType(f.outputs)}</span>
                      </div>
                    \` : ''}
                  </div>
                \`).join('')}
              </div>
            </div>
          \`;
        } else {
          html += \`
            <div class="detail-section">
              <div class="detail-section-title">Functions</div>
              <p class="no-data">No functions \${data.type === 'accessGroup' ? 'require this access' : 'operate on this entity'}</p>
            </div>
          \`;
        }
      }

      panel.innerHTML = html;
    }

    function formatType(type) {
      const labels = {
        function: 'Function',
        entity: 'Entity',
        accessGroup: 'Access Group',
      };
      return labels[type] || type;
    }

    function formatSchema(schema) {
      if (!schema) return 'No schema';

      // Simplified schema display
      if (schema.type === 'object' && schema.properties) {
        const lines = [];
        for (const [key, value] of Object.entries(schema.properties)) {
          const required = schema.required?.includes(key) ? '' : '?';
          const type = formatSchemaType(value);
          lines.push(\`  \${key}\${required}: \${type}\`);
        }
        return '{\\n' + lines.join(',\\n') + '\\n}';
      }

      return JSON.stringify(schema, null, 2);
    }

    function formatSchemaType(schema) {
      if (!schema) return 'unknown';
      if (schema.type === 'array') {
        return \`\${formatSchemaType(schema.items)}[]\`;
      }
      if (schema.type === 'object') {
        return 'object';
      }
      if (schema.enum) {
        return schema.enum.map(e => \`"\${e}"\`).join(' | ');
      }
      let type = schema.type || 'unknown';
      if (schema.format) {
        type += \` (\${schema.format})\`;
      }
      return type;
    }

    function buildChangeSection(changeStatus, details) {
      if (!details) return '';

      let items = [];

      if (details.oldAccess && details.newAccess) {
        const oldList = details.oldAccess.join(', ');
        const newList = details.newAccess.join(', ');
        items.push(\`
          <div class="change-item">
            <span class="change-label">Access:</span>
            <span class="change-old">\${oldList}</span>
            <span class="change-arrow">→</span>
            <span class="change-new">\${newList}</span>
          </div>
        \`);
      }

      if (details.oldEntities && details.newEntities) {
        const oldList = details.oldEntities.join(', ') || '(none)';
        const newList = details.newEntities.join(', ') || '(none)';
        items.push(\`
          <div class="change-item">
            <span class="change-label">Entities:</span>
            <span class="change-old">\${oldList}</span>
            <span class="change-arrow">→</span>
            <span class="change-new">\${newList}</span>
          </div>
        \`);
      }

      if (details.oldDescription && details.newDescription) {
        items.push(\`
          <div class="change-item change-item-block">
            <span class="change-label">Description:</span>
            <div class="change-description-diff">
              <div class="change-old">\${details.oldDescription}</div>
              <div class="change-arrow">↓</div>
              <div class="change-new">\${details.newDescription}</div>
            </div>
          </div>
        \`);
      }

      if (details.inputsChanged) {
        items.push(\`
          <div class="change-item">
            <span class="change-label">Input schema changed</span>
          </div>
        \`);
      }

      if (details.outputsChanged) {
        items.push(\`
          <div class="change-item">
            <span class="change-label">Output schema changed</span>
          </div>
        \`);
      }

      if (items.length === 0) {
        items.push('<div class="change-item"><span class="change-label">Details modified</span></div>');
      }

      return \`
        <div class="detail-section change-section \${changeStatus}">
          <div class="detail-section-title">Changes</div>
          \${items.join('')}
        </div>
      \`;
    }

    // Filtering
    function setFilter(filter) {
      activeFilter = filter;

      // Update button states
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
      });
      document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.toggle('active', card.dataset.filter === filter);
      });

      // Apply filter to graph
      if (filter === 'all') {
        cy.nodes().removeClass('hidden');
        cy.edges().removeClass('hidden');
      } else {
        cy.nodes().forEach(node => {
          if (node.data('type') === filter) {
            node.removeClass('hidden');
          } else {
            node.addClass('hidden');
          }
        });
        cy.edges().forEach(edge => {
          const source = cy.getElementById(edge.data('source'));
          const target = cy.getElementById(edge.data('target'));
          if (source.hasClass('hidden') || target.hasClass('hidden')) {
            edge.addClass('hidden');
          } else {
            edge.removeClass('hidden');
          }
        });
      }
    }

    // Layout
    function setLayout(layoutName) {
      document.querySelectorAll('.layout-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layout === layoutName);
      });

      const layouts = {
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
          rows: Math.ceil(Math.sqrt(graphData.nodes.length)),
        },
      };

      cy.layout(layouts[layoutName]).run();
    }

    // Search
    let searchTimeout;
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();

      if (query.length < 1) {
        searchResults.classList.remove('visible');
        return;
      }

      searchTimeout = setTimeout(async () => {
        const response = await fetch(\`/api/search?q=\${encodeURIComponent(query)}\`);
        const data = await response.json();

        if (data.results.length > 0) {
          searchResults.innerHTML = data.results.map(r => \`
            <div class="search-result-item" data-node-id="\${r.id}">
              <span class="search-result-type \${r.type}"></span>
              <span class="search-result-label">\${r.label}</span>
              <span class="search-result-match">\${r.matchType}</span>
            </div>
          \`).join('');
          searchResults.classList.add('visible');
        } else {
          searchResults.innerHTML = '<div class="search-result-item"><span class="search-result-label" style="color: var(--text-muted)">No results found</span></div>';
          searchResults.classList.add('visible');
        }
      }, 150);
    });

    searchResults.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (item && item.dataset.nodeId) {
        selectNodeById(item.dataset.nodeId);
        searchInput.value = '';
        searchResults.classList.remove('visible');
      }
    });

    searchInput.addEventListener('blur', () => {
      setTimeout(() => searchResults.classList.remove('visible'), 200);
    });

    // Event listeners
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    });

    document.querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('click', () => setFilter(card.dataset.filter));
    });

    document.querySelectorAll('.layout-btn').forEach(btn => {
      btn.addEventListener('click', () => setLayout(btn.dataset.layout));
    });

    document.getElementById('zoomIn').addEventListener('click', () => {
      cy.zoom(cy.zoom() * 1.3);
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
      cy.zoom(cy.zoom() / 1.3);
    });

    document.getElementById('fitView').addEventListener('click', () => {
      cy.fit(50);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT') {
        if (e.key === 'Escape') {
          e.target.blur();
          searchResults.classList.remove('visible');
        }
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          searchInput.focus();
          break;
        case 'Escape':
          clearSelection();
          break;
        case 'f':
        case 'F':
          cy.fit(50);
          break;
        case '1':
          setFilter('all');
          break;
        case '2':
          setFilter('function');
          break;
        case '3':
          setFilter('entity');
          break;
        case '4':
          setFilter('accessGroup');
          break;
      }
    });

    // Initialize - explicitly load fonts before rendering graph
    // document.fonts.ready is unreliable in Chromium, use document.fonts.load() instead
    async function loadFontsAndInit() {
      try {
        // Explicitly load the fonts we need for canvas
        await Promise.all([
          document.fonts.load('500 12px "Space Grotesk"'),
          document.fonts.load('600 12px "Space Grotesk"'),
          document.fonts.load('400 12px "Space Mono"'),
        ]);
        console.log('Fonts loaded:', document.fonts.check('500 12px "Space Grotesk"') ? 'Space Grotesk OK' : 'Space Grotesk FAILED');
      } catch (e) {
        console.warn('Font loading error:', e);
      }
      initGraph();
    }

    // Debug: Check font after render (call from console: checkFont())
    window.checkFont = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Measure text with Space Grotesk vs fallback
      ctx.font = '500 12px "Space Grotesk", sans-serif';
      const spaceWidth = ctx.measureText('Hello World').width;

      ctx.font = '500 12px sans-serif';
      const fallbackWidth = ctx.measureText('Hello World').width;

      ctx.font = '500 12px Arial';
      const arialWidth = ctx.measureText('Hello World').width;

      console.log('Font widths:', {
        'Space Grotesk': spaceWidth,
        'sans-serif fallback': fallbackWidth,
        'Arial': arialWidth,
        'Using Space Grotesk': spaceWidth !== fallbackWidth && spaceWidth !== arialWidth
      });

      return document.fonts.check('500 12px "Space Grotesk"');
    };

    // View tab switching
    let currentView = 'graph';

    function switchView(view) {
      currentView = view;

      // Update tab buttons
      document.querySelectorAll('.view-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
      });

      // Show/hide views
      const graphContainer = document.querySelector('.graph-container');
      const detailPanel = document.getElementById('detailPanel');
      const tableView = document.getElementById('tableView');
      const graphFilters = document.getElementById('graphFilters');
      const layoutSelector = document.querySelector('.layout-selector');

      if (view === 'graph') {
        graphContainer.style.display = 'block';
        detailPanel.style.display = 'block';
        tableView.classList.remove('active');
        if (graphFilters) graphFilters.style.display = 'flex';
        if (layoutSelector) layoutSelector.style.display = 'flex';
      } else {
        graphContainer.style.display = 'none';
        detailPanel.style.display = 'none';
        tableView.classList.add('active');
        if (graphFilters) graphFilters.style.display = 'none';
        if (layoutSelector) layoutSelector.style.display = 'none';
        renderTableView();
      }
    }

    document.querySelectorAll('.view-tab').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Table view rendering
    function renderTableView() {
      const container = document.getElementById('tableContent');
      const nodes = graphData.nodes;
      const diff = graphData.diff;

      // Group nodes by type
      const accessGroups = nodes.filter(n => n.type === 'accessGroup');
      const entities = nodes.filter(n => n.type === 'entity');
      const functions = nodes.filter(n => n.type === 'function');

      let html = '';

      // Access Groups section
      html += renderTableSection('Access Groups', accessGroups, 'accessGroup');

      // Entities section
      if (entities.length > 0) {
        html += renderTableSection('Entities', entities, 'entity');
      }

      // Functions section
      html += renderTableSection('Functions', functions, 'function');

      container.innerHTML = html;

      // Add collapse/expand handlers
      container.querySelectorAll('.table-section-header').forEach(header => {
        header.addEventListener('click', () => {
          header.parentElement.classList.toggle('collapsed');
        });
      });
    }

    function renderTableSection(title, items, type) {
      const changedCount = items.filter(n => n.changeStatus !== 'unchanged').length;

      let html = '<div class="table-section">';
      html += '<div class="table-section-header">';
      html += '<div class="table-section-title">';
      html += '<span class="dot" style="background: var(--node-' + (type === 'accessGroup' ? 'access' : type) + ')"></span>';
      html += title;
      html += '<span class="table-section-count">' + items.length + '</span>';
      if (changedCount > 0) {
        html += '<span class="change-badge modified">' + changedCount + '</span>';
      }
      html += '</div>';
      html += '<svg class="table-section-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
      html += '</div>';
      html += '<div class="table-section-content">';

      // Sort: changed items first, then by name
      const sortedItems = [...items].sort((a, b) => {
        const aChanged = a.changeStatus !== 'unchanged' ? 0 : 1;
        const bChanged = b.changeStatus !== 'unchanged' ? 0 : 1;
        if (aChanged !== bChanged) return aChanged - bChanged;
        return a.label.localeCompare(b.label);
      });

      for (const item of sortedItems) {
        html += renderTableItem(item, type);
      }

      html += '</div></div>';
      return html;
    }

    function renderTableItem(item, type) {
      const statusClass = item.changeStatus !== 'unchanged' ? item.changeStatus : '';
      const icon = item.changeStatus === 'added' ? '+' : item.changeStatus === 'removed' ? '−' : item.changeStatus === 'modified' ? '~' : '';

      let html = '<div class="table-item ' + statusClass + '">';
      html += '<div class="table-item-icon">' + icon + '</div>';
      html += '<div class="table-item-content">';
      html += '<div class="table-item-name">' + escapeHtml(item.label) + '</div>';
      html += '<div class="table-item-description">' + escapeHtml(item.description) + '</div>';

      // Show tags for functions
      if (type === 'function' && graphData.edges) {
        const accessEdges = graphData.edges.filter(e => e.source === item.id && e.type === 'requires-access');
        const entityEdges = graphData.edges.filter(e => e.source === item.id && e.type === 'operates-on');

        if (accessEdges.length > 0 || entityEdges.length > 0) {
          html += '<div class="table-item-tags">';
          for (const edge of accessEdges) {
            const groupName = edge.target.replace('accessGroup:', '');
            html += '<span class="table-item-tag access">' + escapeHtml(groupName) + '</span>';
          }
          for (const edge of entityEdges) {
            const entityName = edge.target.replace('entity:', '');
            html += '<span class="table-item-tag entity">' + escapeHtml(entityName) + '</span>';
          }
          html += '</div>';
        }
      }

      // Show change details
      if (item.changeDetails && item.changeStatus === 'modified') {
        const details = item.changeDetails;
        html += '<div class="table-item-change">';
        if (details.oldAccess && details.newAccess) {
          html += '<div>Access: <span class="old">' + details.oldAccess.join(', ') + '</span><span class="arrow">→</span><span class="new">' + details.newAccess.join(', ') + '</span></div>';
        }
        if (details.inputsChanged) {
          html += '<div>Input schema changed</div>';
        }
        if (details.outputsChanged) {
          html += '<div>Output schema changed</div>';
        }
        if (details.entitiesChanged) {
          html += '<div>Entities: <span class="old">' + (details.oldEntities || []).join(', ') + '</span><span class="arrow">→</span><span class="new">' + (details.newEntities || []).join(', ') + '</span></div>';
        }
        html += '</div>';
      }

      html += '</div></div>';
      return html;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    }

    // Approve/Reject handlers
    const approveBtn = document.getElementById('approveBtn');
    const rejectBtn = document.getElementById('rejectBtn');

    if (approveBtn) {
      approveBtn.addEventListener('click', async () => {
        approveBtn.disabled = true;
        rejectBtn.disabled = true;
        try {
          const response = await fetch('/api/approve', { method: 'POST' });
          if (response.ok) {
            document.getElementById('reviewFooter').innerHTML =
              '<div class="changes-summary" style="color: var(--vanna-teal);">✓ Changes approved! Lockfile updated. You can close this window.</div>';
          } else {
            throw new Error('Failed to approve');
          }
        } catch (error) {
          alert('Failed to approve changes: ' + error.message);
          approveBtn.disabled = false;
          rejectBtn.disabled = false;
        }
      });
    }

    if (rejectBtn) {
      rejectBtn.addEventListener('click', async () => {
        approveBtn.disabled = true;
        rejectBtn.disabled = true;
        try {
          await fetch('/api/reject', { method: 'POST' });
          document.getElementById('reviewFooter').innerHTML =
            '<div class="changes-summary" style="color: var(--change-removed);">✕ Changes rejected. You can close this window.</div>';
        } catch (error) {
          alert('Failed to reject changes: ' + error.message);
          approveBtn.disabled = false;
          rejectBtn.disabled = false;
        }
      });
    }

    loadFontsAndInit();
  </script>
</body>
</html>`;
}
