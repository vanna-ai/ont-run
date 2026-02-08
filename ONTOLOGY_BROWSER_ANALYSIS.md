# Ontology Browser Analysis for Go Backend

## Executive Summary

The TypeScript backend has a built-in **ontology browser** that provides a visual, interactive UI for viewing and reviewing ontology changes. The Go backend **does NOT currently have this capability**. This document outlines what the browser does and provides implementation options for adding similar functionality to the Go backend.

---

## What is the Ontology Browser?

The ontology browser is an interactive web UI that serves two purposes:

1. **Review Mode**: When ontology changes are detected, it displays a visual diff and allows human approval/rejection of changes
2. **Browse Mode**: When no changes exist, it provides an interactive visualization of the entire ontology structure

### Key Features

#### Review Mode (when changes are detected)
- Visual diff showing added/modified/deleted functions, access groups, and entities
- Side-by-side comparison of old vs new ontology
- Approve/reject buttons for human-controlled ontology updates
- Source code viewer showing the raw ontology config file
- Change highlighting with color coding (green=added, orange=modified, red=deleted)

#### Browse Mode (no changes)
- Interactive graph visualization of the entire ontology
- Node types: Functions, Access Groups, Entities
- Search functionality to find specific nodes
- Node detail panels showing:
  - Function inputs/outputs (JSON schemas)
  - Access group descriptions
  - Entity descriptions
  - Relationships between nodes
- Filter options (e.g., show only functions with userContext)
- Test mode: Can execute functions directly from the browser with mock data

### Technical Implementation (TypeScript)

**Location**: `src/browser/`
- `server.ts` - Hono server that hosts the browser UI
- `launch.ts` - Background launcher for auto-opening the browser
- `transform.ts` - Transforms ontology config to graph data
- `browser-app/` - React application for the UI

**How it works**:
1. Server detects ontology changes on startup (in dev mode)
2. Computes diff between current config and `ont.lock` file
3. Automatically launches browser UI at `http://localhost:3457` (or next available port)
4. User reviews changes in browser and approves/rejects
5. On approval, writes new `ont.lock` file
6. Server continues running

**Auto-launch behavior** (TypeScript):
- Dev mode: Automatically launches browser when changes detected
- Production mode: Blocks startup and requires manual `npx ont-run review` command
- Browser opens automatically unless in headless environment

---

## Current Go Backend Capabilities

### What Go Backend Has:
✅ Lockfile generation (`pkg/ontology/lock.go`)
✅ Lockfile validation and diff computation (`pkg/ontology/lock.go` - `DiffLock()`)
✅ Hash-based change detection
✅ Detailed diff reporting (shows which functions/entities/groups changed)
✅ Console output of diffs with `String()` method
✅ MCP server support
✅ REST API support
✅ TypeScript SDK generation

### What Go Backend Lacks:
❌ Visual browser UI for reviewing changes
❌ Auto-launch of browser on ontology changes
❌ Interactive ontology graph visualization
❌ Web-based approval/rejection workflow
❌ Test mode for executing functions from a UI

### Current Go Workflow
When ontology changes are detected:
1. Go server computes the diff
2. Prints changes to console (text-based)
3. Dev mode: Auto-generates new `ont.lock` file (no approval required)
4. Production mode: Exits with error requiring manual lockfile update

**Key difference**: The Go backend auto-approves changes in dev mode without human review, whereas TypeScript requires explicit human approval via the browser.

---

## Implementation Options

### Option 1: Embed TypeScript Browser Server (Recommended)

**Approach**: Bundle the existing TypeScript browser UI as a Go embedded file system and serve it from the Go server.

**Pros**:
- Reuses existing, battle-tested browser UI code
- Consistent experience between TypeScript and Go backends
- Leverages existing React application and visualization logic
- Fastest to implement (mostly integration work)

**Cons**:
- Adds Node.js build step to Go backend workflow
- Increases binary size with embedded UI assets
- Requires bundling JavaScript assets

**Implementation Steps**:
1. Build the TypeScript browser app as standalone bundle
2. Embed the built assets in Go binary using `//go:embed`
3. Create HTTP handler in `pkg/server/` to serve the browser UI
4. Add launch logic similar to TypeScript's `launchReviewInBackground`
5. Integrate with existing lockfile diff logic
6. Add API endpoints for:
   - GET `/browser/api/graph` - Graph data
   - GET `/browser/api/diff` - Diff data
   - POST `/browser/api/approve` - Approve changes
   - POST `/browser/api/reject` - Reject changes

**Estimated Effort**: 2-3 days

---

### Option 2: Build Native Go Browser UI

**Approach**: Create a new browser UI using Go templates or a lightweight Go web framework.

**Pros**:
- Pure Go solution (no Node.js dependency)
- Smaller binary size
- Potentially faster startup
- More control over UI implementation

**Cons**:
- Significant development effort to replicate existing UI
- Need to reimplement graph visualization
- Need to maintain two separate UI codebases
- Risk of feature drift between TS and Go implementations

**Implementation Steps**:
1. Choose UI approach (HTML templates, HTMX, Templ, etc.)
2. Design graph visualization (could use Cytoscape.js via CDN)
3. Build diff viewer component
4. Build approval/rejection workflow
5. Add search and filtering
6. Add test mode functionality

**Estimated Effort**: 1-2 weeks

---

### Option 3: CLI-Only Review with External Browser Link

**Approach**: Keep the review process CLI-based but provide a link to a hosted browser UI or run a temporary server.

**Pros**:
- Minimal code changes to Go backend
- No embedded assets needed
- User has choice of CLI vs browser

**Cons**:
- Less integrated experience
- Requires separate command or step
- May confuse users about when to use which tool

**Implementation Steps**:
1. Add `ont-run review-go` CLI command (TypeScript CLI)
2. Command reads Go-generated `ont.lock` diff
3. Launches browser UI similar to existing review command
4. Approves/rejects and updates lockfile

**Estimated Effort**: 1 day

---

### Option 4: Hybrid Approach (Recommended Alternative)

**Approach**: Keep simple CLI diff output but add optional browser launch via environment variable or flag.

**Pros**:
- Flexible: Users choose CLI or browser
- Smaller default binary without browser assets
- Browser can be downloaded on-demand or bundled separately

**Cons**:
- More complex deployment (two modes)
- Need to document both workflows

**Implementation Steps**:
1. Keep existing console diff output as default
2. Add flag: `ONT_BROWSER=true` or `--browser` flag
3. When enabled, download/extract browser UI on first use (like Go modules)
4. Launch browser server similar to Option 1
5. Fall back to CLI if browser unavailable

**Estimated Effort**: 2-3 days

---

## Recommendation

**Option 1 (Embed TypeScript Browser)** is recommended for the following reasons:

1. **Consistency**: Users get the same experience regardless of backend choice
2. **Proven**: The TypeScript browser is already tested and working
3. **Maintainability**: Only one UI codebase to maintain
4. **Speed**: Fastest to implement since most code already exists
5. **Features**: Includes all features (review, browse, test mode) out of the box

### Implementation Roadmap

**Phase 1: Basic Integration** (1-2 days)
- Bundle browser UI as standalone static assets
- Embed in Go binary with `//go:embed`
- Add HTTP handler to serve UI at `/browser`
- Add API endpoint to provide ontology data

**Phase 2: Review Workflow** (1 day)
- Integrate with existing `DiffLock()` logic
- Add approval/rejection API endpoints
- Wire up lockfile writing on approval
- Add auto-launch on ontology changes (dev mode)

**Phase 3: Polish** (1 day)
- Add browser detection for headless environments
- Add configuration options (port, auto-open, etc.)
- Update documentation
- Add tests

**Total Estimated Effort**: 3-4 days

---

## Code References

### TypeScript Implementation
- `src/browser/server.ts` - Browser server and API
- `src/browser/launch.ts` - Auto-launch logic
- `src/browser/transform.ts` - Graph data transformation
- `src/cli/commands/review.ts` - CLI review command
- `src/server/api/index.ts` - Auto-launch integration

### Go Implementation Points
- `pkg/ontology/lock.go` - Lockfile and diff logic (already exists)
- `pkg/server/mcp.go` - Server implementation
- `examples/basic/main.go` - Example server startup

### Key TypeScript Functions to Port
- `startBrowserServer()` - Main server setup
- `launchReviewInBackground()` - Background launch
- `transformToGraphData()` - Ontology → graph conversion
- `enhanceWithDiff()` - Add change indicators to graph

---

## Additional Considerations

### Security
- Browser UI should only be accessible on localhost
- Consider adding authentication for production use
- Don't expose browser in production mode by default

### Configuration
- Add environment variables:
  - `ONT_BROWSER_PORT` - Custom port (default: 8081)
  - `ONT_BROWSER_OPEN` - Auto-open browser (default: true in dev)
  - `ONT_BROWSER_ENABLED` - Enable browser UI (default: true in dev, false in prod)

### Documentation Updates Needed
- Add "Ontology Browser" section to README
- Document Go-specific browser usage
- Update CLI help text
- Add screenshots/demo video

### Testing
- Add integration test for browser server
- Test auto-launch behavior
- Test approval/rejection workflow
- Test headless environment detection

---

## Questions for Stakeholders

1. Should the browser UI be bundled in the Go binary by default, or made optional?
2. Should we maintain feature parity with TypeScript browser, or start with a minimal version?
3. What is the priority: Speed to market vs. pure Go solution?
4. Should production mode support browser UI at all, or CLI only?

---

## Conclusion

The Go backend currently lacks the ontology browser capability that exists in the TypeScript backend. The recommended approach is to embed the existing TypeScript browser UI in the Go binary, which provides the fastest path to feature parity while maintaining consistency across both implementations. This can be accomplished in approximately 3-4 days of development effort.
