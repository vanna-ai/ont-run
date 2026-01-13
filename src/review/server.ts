import { Hono } from "hono";
import open from "open";
import type { TopologyDiff } from "../lockfile/types.js";
import { writeLockfile } from "../lockfile/index.js";
import { serve, findAvailablePort } from "../runtime/index.js";

export interface ReviewServerOptions {
  /** The topology diff to display */
  diff: TopologyDiff;
  /** Directory to write the lockfile to on approval */
  configDir: string;
  /** Port to run on (default: auto-select) */
  port?: number;
}

/**
 * Start the review server and open the browser
 */
export async function startReviewServer(
  options: ReviewServerOptions
): Promise<{ approved: boolean }> {
  const { diff, configDir, port: preferredPort } = options;

  return new Promise(async (resolve) => {
    const app = new Hono();

    // Serve the UI
    app.get("/", (c) => {
      return c.html(REVIEW_UI_HTML);
    });

    // Get diff data
    app.get("/api/diff", (c) => {
      return c.json(diff);
    });

    // Approve changes
    app.post("/api/approve", async (c) => {
      try {
        await writeLockfile(configDir, diff.newTopology, diff.newHash);
        // Give time for response to be sent before exiting
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

    // Reject changes
    app.post("/api/reject", (c) => {
      // Give time for response to be sent before exiting
      setTimeout(() => {
        resolve({ approved: false });
      }, 500);
      return c.json({ success: true });
    });

    // Start server
    const port = preferredPort || (await findAvailablePort());
    const server = await serve(app, port);

    const url = `http://localhost:${server.port}`;
    console.log(`\nReview UI available at: ${url}`);
    console.log("Opening in browser...\n");

    // Open browser
    try {
      await open(url);
    } catch {
      console.log("Could not open browser automatically.");
      console.log(`Please open ${url} manually.`);
    }
  });
}

// Inline HTML to avoid file path issues when bundled
const REVIEW_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ontology Review</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #0d1117; color: #c9d1d9; min-height: 100vh; padding: 2rem;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #58a6ff; margin-bottom: 0.5rem; font-size: 1.5rem; }
    .subtitle { color: #8b949e; margin-bottom: 2rem; }
    .warning-banner {
      background: #30363d; border: 1px solid #f85149; border-radius: 6px;
      padding: 1rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.75rem;
    }
    .warning-banner .icon { color: #f85149; font-size: 1.5rem; }
    .warning-banner .text { flex: 1; }
    .warning-banner .title { font-weight: 600; color: #f85149; margin-bottom: 0.25rem; }
    .section {
      background: #161b22; border: 1px solid #30363d; border-radius: 6px;
      margin-bottom: 1.5rem; overflow: hidden;
    }
    .section-header {
      background: #21262d; padding: 0.75rem 1rem; font-weight: 600; border-bottom: 1px solid #30363d;
    }
    .section-content { padding: 1rem; }
    .change-item {
      display: flex; align-items: flex-start; gap: 0.75rem;
      padding: 0.75rem; border-radius: 4px; margin-bottom: 0.5rem;
    }
    .change-item:last-child { margin-bottom: 0; }
    .change-item.added { background: rgba(46, 160, 67, 0.1); }
    .change-item.removed { background: rgba(248, 81, 73, 0.1); }
    .change-item.modified { background: rgba(210, 153, 34, 0.1); }
    .change-icon { font-size: 1.25rem; line-height: 1; }
    .change-icon.added { color: #3fb950; }
    .change-icon.removed { color: #f85149; }
    .change-icon.modified { color: #d29922; }
    .change-details { flex: 1; }
    .change-name { font-weight: 600; margin-bottom: 0.25rem; }
    .change-meta { font-size: 0.875rem; color: #8b949e; }
    .access-change { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; margin-top: 0.5rem; }
    .access-old { color: #f85149; text-decoration: line-through; }
    .access-new { color: #3fb950; }
    .access-arrow { color: #8b949e; }
    .tag {
      display: inline-block; padding: 0.125rem 0.5rem; border-radius: 999px;
      font-size: 0.75rem; font-weight: 500;
    }
    .tag.public { background: #238636; }
    .tag.support { background: #1f6feb; }
    .tag.admin { background: #8957e5; }
    .tag.default { background: #30363d; }
    .actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem; }
    button {
      padding: 0.75rem 1.5rem; border-radius: 6px; font-size: 1rem; font-weight: 600;
      cursor: pointer; border: 1px solid transparent; transition: all 0.15s ease;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-reject { background: #21262d; border-color: #30363d; color: #c9d1d9; }
    .btn-reject:hover:not(:disabled) { background: #30363d; }
    .btn-approve { background: #238636; color: white; }
    .btn-approve:hover:not(:disabled) { background: #2ea043; }
    .loading { text-align: center; padding: 3rem; color: #8b949e; }
    .no-changes { text-align: center; padding: 2rem; color: #8b949e; }
    .no-changes .icon { font-size: 3rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Ontology Review</h1>
    <p class="subtitle">Review topology changes before updating the lockfile</p>
    <div id="content"><div class="loading">Loading changes...</div></div>
  </div>
  <script>
    let diffData = null;
    async function loadDiff() {
      try {
        const response = await fetch('/api/diff');
        diffData = await response.json();
        renderDiff(diffData);
      } catch (error) {
        document.getElementById('content').innerHTML =
          '<div class="section"><div class="section-content"><p style="color: #f85149;">Failed to load changes: ' + error.message + '</p></div></div>';
      }
    }
    function getTagClass(group) {
      if (['public', 'support', 'admin'].includes(group)) return group;
      return 'default';
    }
    function renderTags(groups) {
      return groups.map(g => '<span class="tag ' + getTagClass(g) + '">' + g + '</span>').join(' ');
    }
    function renderDiff(diff) {
      if (!diff.hasChanges) {
        document.getElementById('content').innerHTML =
          '<div class="no-changes"><div class="icon">✓</div><p>No topology changes detected.</p></div>';
        return;
      }
      let html = '';
      const hasPublicExpansion = diff.functions.some(fn =>
        fn.type === 'modified' && fn.newAccess?.includes('public') && !fn.oldAccess?.includes('public')
      );
      if (hasPublicExpansion) {
        html += '<div class="warning-banner"><span class="icon">⚠️</span><div class="text">' +
          '<div class="title">Security Warning</div>' +
          '<div>You are expanding access to include public users. Review carefully.</div></div></div>';
      }
      if (diff.addedGroups.length > 0 || diff.removedGroups.length > 0) {
        html += '<div class="section"><div class="section-header">Access Groups</div><div class="section-content">';
        for (const group of diff.addedGroups) {
          html += '<div class="change-item added"><span class="change-icon added">+</span>' +
            '<div class="change-details"><div class="change-name">' + group + '</div>' +
            '<div class="change-meta">New access group</div></div></div>';
        }
        for (const group of diff.removedGroups) {
          html += '<div class="change-item removed"><span class="change-icon removed">−</span>' +
            '<div class="change-details"><div class="change-name">' + group + '</div>' +
            '<div class="change-meta">Removed access group</div></div></div>';
        }
        html += '</div></div>';
      }
      if (diff.functions.length > 0) {
        html += '<div class="section"><div class="section-header">Functions</div><div class="section-content">';
        for (const fn of diff.functions) {
          const icon = fn.type === 'added' ? '+' : fn.type === 'removed' ? '−' : '~';
          html += '<div class="change-item ' + fn.type + '"><span class="change-icon ' + fn.type + '">' + icon + '</span>' +
            '<div class="change-details"><div class="change-name">' + fn.name + '</div>';
          if (fn.type === 'added') {
            html += '<div class="change-meta">' + (fn.newDescription || 'New function') + '</div>' +
              '<div class="access-change">Access: ' + renderTags(fn.newAccess || []) + '</div>';
          } else if (fn.type === 'removed') {
            html += '<div class="change-meta">Function removed</div>';
          } else {
            if (fn.oldAccess && fn.newAccess) {
              html += '<div class="access-change"><span class="access-old">' + renderTags(fn.oldAccess) + '</span>' +
                '<span class="access-arrow">→</span><span class="access-new">' + renderTags(fn.newAccess) + '</span></div>';
            }
            if (fn.inputsChanged) html += '<div class="change-meta">Input schema changed</div>';
            if (fn.oldDescription && fn.newDescription) html += '<div class="change-meta">Description changed</div>';
          }
          html += '</div></div>';
        }
        html += '</div></div>';
      }
      html += '<div class="actions">' +
        '<button class="btn-reject" onclick="reject()">Reject Changes</button>' +
        '<button class="btn-approve" onclick="approve()">Approve & Update Lockfile</button></div>';
      document.getElementById('content').innerHTML = html;
    }
    async function approve() {
      const buttons = document.querySelectorAll('button');
      buttons.forEach(b => b.disabled = true);
      try {
        const response = await fetch('/api/approve', { method: 'POST' });
        if (response.ok) {
          document.getElementById('content').innerHTML =
            '<div class="no-changes"><div class="icon">✓</div><p>Changes approved! Lockfile updated.</p>' +
            '<p style="margin-top: 1rem; color: #8b949e;">You can close this window.</p></div>';
        } else { throw new Error('Failed to approve'); }
      } catch (error) {
        alert('Failed to approve changes: ' + error.message);
        buttons.forEach(b => b.disabled = false);
      }
    }
    async function reject() {
      const buttons = document.querySelectorAll('button');
      buttons.forEach(b => b.disabled = true);
      try {
        await fetch('/api/reject', { method: 'POST' });
        document.getElementById('content').innerHTML =
          '<div class="no-changes"><div class="icon" style="color: #f85149;">✕</div><p>Changes rejected.</p>' +
          '<p style="margin-top: 1rem; color: #8b949e;">You can close this window.</p></div>';
      } catch (error) {
        alert('Failed to reject changes: ' + error.message);
        buttons.forEach(b => b.disabled = false);
      }
    }
    loadDiff();
  </script>
</body>
</html>`;
