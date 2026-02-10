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

### Option 1: Cloud-Hosted Browser at ont-run.com (New - Recommended)

**Approach**: Host the browser UI at ont-run.com and send ontology data from Go backend to the cloud for review.

**Pros**:
- **Zero frontend code in Go backend** - fully achieves the stated goal
- No embedded assets or Node.js build steps
- Browser UI maintained centrally by ont-run team
- Automatic updates - users always get latest browser features
- Works consistently across all backends (TypeScript, Go, future languages)
- Smaller Go binary
- Better for CI/CD - no browser launch needed
- Team collaboration features already planned for cloud

**Cons**:
- Requires internet connection for review
- Privacy concern: Ontology data sent to cloud (mitigated - see below)
- Latency for API calls vs localhost
- Requires ont-run.com infrastructure changes
- Fall back to CLI needed for offline scenarios

**Data Privacy**:
- Only ontology metadata is sent (already happens with cloud registration)
- Resolver code (business logic) NEVER sent
- Environment configs NEVER sent
- Auth functions NEVER sent
- Actual user data NEVER sent

**What's Already Sent** (via existing cloud registration):
✅ Function names and descriptions
✅ Access groups
✅ Entities
✅ Input/output JSON schemas
✅ Field references
✅ Hash of current ontology

**What's Missing for Review Mode**:
❌ Previous ontology version (from ont.lock)
❌ Diff information
❌ Ability to approve/reject and update local ont.lock

**Implementation Steps**:

**Phase 1: Backend Changes** (Go - 1 day)
1. Modify cloud registration to include:
   - Current ont.lock contents (if exists)
   - Diff data computed locally
   - Server endpoint URL for callback
2. Add webhook endpoint to receive approval/rejection from cloud
3. On approval callback, write new ont.lock file locally
4. Generate browser URL with UUID and open in browser

**Phase 2: Cloud Service Changes** (ont-run.com - 2-3 days)
1. Add `/review/{uuid}` endpoint to host browser UI
2. Store ontology versions with diffs
3. Add approval/rejection workflow API
4. Send approval callback to local server webhook
5. Display browser UI with existing React app

**Phase 3: Offline Fallback** (1 day)
1. Detect if cloud is unreachable
2. Fall back to CLI-based diff output
3. Allow local approval with `--approve` flag

**Total Estimated Effort**: 4-5 days (split between Go backend and cloud service)

**User Workflow**:
```bash
# 1. Dev makes ontology changes in Go code
# 2. Go server starts and detects changes
# 3. Server sends data to ont-run.com
# 4. Opens browser to: https://ont-run.com/review/{uuid}
# 5. User reviews changes in cloud-hosted UI
# 6. User clicks "Approve" or "Reject"
# 7. Cloud service notifies local server via webhook
# 8. Local server updates ont.lock file
# 9. Server continues running
```

**Security Considerations**:
- Generate temporary review token for webhook authentication
- Webhook endpoint only accepts callbacks for pending reviews
- Review tokens expire after 1 hour
- HTTPS required for webhook callbacks in production

---

### Option 2: Embed TypeScript Browser Server (Previous Recommendation)

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

### Option 3: Build Native Go Browser UI

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

### Option 4: CLI-Only Review with External Browser Link

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

### Option 5: Hybrid Approach

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

### Primary Recommendation: Option 1 (Cloud-Hosted Browser)

**Cloud-hosted browser at ont-run.com is now the recommended approach** for the following reasons:

1. **Achieves the Core Goal**: Zero frontend code in Go backend
2. **Simplicity**: Go backend remains pure Go with no UI dependencies
3. **Consistency**: Single browser implementation works for all backend languages
4. **Maintainability**: Central UI updates benefit all users instantly
5. **Future-Ready**: Aligns with planned team collaboration features
6. **Better DX**: No build complexity or asset bundling in Go projects

### Trade-offs

**Privacy & Security**:
- Ontology metadata is sent to cloud (function signatures, access rules, schemas)
- This data is already sent during cloud registration
- Business logic (resolver code) NEVER leaves local machine
- Suitable for most use cases; Option 2 available for air-gapped environments

**Offline Support**:
- Internet required for visual review
- CLI fallback for offline scenarios
- Consider Option 2 (embedded browser) for offline-first requirements

### Implementation Priority

**Phase 1** (Immediate): Cloud-hosted browser
- Enables Go backend users to review ontology changes visually
- Maintains consistency with TypeScript backend experience
- Prepares infrastructure for team features

**Phase 2** (Future): Embedded browser option
- Add `--offline` flag to use local embedded browser
- Download browser bundle on first use if not embedded
- Provides alternative for users with strict privacy requirements

---

## Previous Recommendation (For Reference)

**Option 2 (Embed TypeScript Browser)** was previously recommended before cloud hosting was considered. It's still a valid alternative for:
- Air-gapped environments
- Offline-first requirements
- Organizations with strict data policies
- Development when cloud service is unavailable

Implementation details remain in Option 2 above.

---

## Implementation Roadmap (Cloud-Hosted)

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

## Implementation Roadmap (Cloud-Hosted)

### Go Backend Changes (2 days)

**Phase 1: Enhanced Cloud Registration** (1 day)
```go
// Add to pkg/cloud/client.go
type ReviewRequest struct {
    UUID            string           `json:"uuid"`
    CurrentOntology OntologySnapshot `json:"currentOntology"`
    PreviousOntology *OntologySnapshot `json:"previousOntology"` // from ont.lock
    Diff            *DiffData        `json:"diff"`
    CallbackURL     string           `json:"callbackUrl"` // local webhook
    ReviewToken     string           `json:"reviewToken"` // for auth
}

// Add to pkg/server/
func (s *Server) startReviewWebhook() {
    // Listen for approval callbacks from cloud
    s.mux.HandleFunc("/api/review-callback", s.handleReviewCallback)
}
```

**Phase 2: Review Workflow** (1 day)
1. Detect ontology changes on startup
2. Generate secure review token
3. Send review request to ont-run.com
4. Get review URL from response
5. Open browser to cloud-hosted UI
6. Handle approval callback
7. Update ont.lock file
8. Continue server startup

### Cloud Service Changes (2-3 days)

**Phase 1: Backend API** (1 day)
- `POST /api/review/create` - Accept review request
- `GET /api/review/{uuid}` - Get review data
- `POST /api/review/{uuid}/approve` - Approve changes
- `POST /api/review/{uuid}/reject` - Reject changes
- Store reviews in database (temporary, 1 hour TTL)

**Phase 2: Frontend** (1 day)
- Route: `/review/{uuid}` 
- Reuse existing browser React app
- Fetch review data from cloud API
- Display diff and visualization
- Send approve/reject to cloud API
- Show success/error messages

**Phase 3: Callback System** (1 day)
- Send POST to callbackURL on approve/reject
- Include reviewToken for authentication
- Retry logic with exponential backoff
- Handle unreachable callback URLs

### Security Implementation

**Review Token Generation** (Go backend):
```go
token := generateSecureToken() // 32-byte random
store in memory with 1-hour expiration
send to cloud with review request
```

**Callback Authentication** (Go backend):
```go
func (s *Server) handleReviewCallback(w http.ResponseWriter, r *http.Request) {
    token := r.Header.Get("X-Review-Token")
    if !s.isValidReviewToken(token) {
        http.Error(w, "Invalid token", 401)
        return
    }
    // Process approval/rejection
}
```

**Total Estimated Effort**: 4-5 days

---

## Implementation Roadmap (Embedded Browser - Option 2)

For reference, if Option 2 (embedded browser) is chosen instead:

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

## Comparison Table

| Feature | Cloud-Hosted (Opt 1) | Embedded Browser (Opt 2) | Native Go UI (Opt 3) | CLI Only (Opt 4) |
|---------|---------------------|--------------------------|---------------------|-----------------|
| **Zero Go frontend code** | ✅ Yes | ❌ No (embed TS) | ❌ No | ✅ Yes |
| **Go binary size** | Small | Large (+5-10MB) | Medium | Small |
| **Build complexity** | Low | Medium (Node.js) | Low | Low |
| **Internet required** | Yes | No | No | Optional |
| **Update frequency** | Automatic | Manual rebuild | Manual rebuild | N/A |
| **Consistency** | All backends | All backends | Go only | N/A |
| **Team features** | Future-ready | Requires rewrite | Requires rewrite | No |
| **Development time** | 4-5 days | 3-4 days | 10-14 days | 1 day |
| **Privacy** | Metadata to cloud | Fully local | Fully local | Fully local |
| **Offline support** | CLI fallback | Full | Full | Full |

---

## Data Flow Diagrams

### Option 1: Cloud-Hosted Browser

```
┌─────────────┐
│ Go Backend  │
│             │ 1. Detect changes
│ main.go     │ 2. Compute diff
└──────┬──────┘
       │ 3. Send review request
       │    (ontology, diff, callback URL)
       ▼
┌─────────────────────┐
│  ont-run.com        │
│  Cloud Service      │ 4. Store review data
│                     │ 5. Return review URL
└──────┬──────────────┘
       │ 6. Open browser
       ▼
┌─────────────────────┐
│  User Browser       │
│  https://ont-run    │ 7. View diff & approve
│  .com/review/{uuid} │
└──────┬──────────────┘
       │ 8. Approval action
       ▼
┌─────────────────────┐
│  ont-run.com        │
│  Cloud Service      │ 9. Send callback
└──────┬──────────────┘
       │ 10. POST to webhook
       ▼
┌─────────────┐
│ Go Backend  │
│             │ 11. Update ont.lock
│ Webhook     │ 12. Continue startup
└─────────────┘
```

### Option 2: Embedded Browser

```
┌─────────────┐
│ Go Backend  │
│             │ 1. Detect changes
│ main.go     │ 2. Compute diff
│             │ 3. Start embedded server
└──────┬──────┘
       │ 4. Serve browser UI
       ▼
┌─────────────────────┐
│  Embedded Server    │
│  localhost:8081     │ 5. Return review URL
└──────┬──────────────┘
       │ 6. Open browser
       ▼
┌─────────────────────┐
│  User Browser       │
│  http://localhost   │ 7. View diff & approve
│  :8081/browser      │
└──────┬──────────────┘
       │ 8. Approval action
       ▼
┌─────────────┐
│ Go Backend  │
│             │ 9. Update ont.lock
│ API Handler │ 10. Continue startup
└─────────────┘
```

---

## Questions for Stakeholders

1. **Is sending ontology metadata to ont-run.com acceptable?**
   - Note: This data is already sent during cloud registration
   - Business logic code never leaves local machine
   - Alternative: Option 2 for fully local solution

2. **Are team collaboration features planned for ont-run.com?**
   - If yes, cloud-hosted browser is the foundation
   - Enables features like: team approvals, audit trails, compliance reporting

3. **What is the priority: Speed to market vs. offline-first?**
   - Cloud-hosted: Faster to market (4-5 days)
   - Embedded: Better offline support (3-4 days + build complexity)

4. **Should Go backend support offline review initially?**
   - Yes: Implement CLI fallback in Phase 1
   - No: Add offline support in Phase 2

5. **Budget for ont-run.com infrastructure changes?**
   - Review storage (database/cache)
   - Webhook callbacks (with retries)
   - Hosting browser UI at /review/{uuid}

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

## Conclusion

The Go backend currently lacks the ontology browser capability that exists in the TypeScript backend. 

**Based on the new requirement that "Go code contains no front end stuff"**, the **cloud-hosted browser at ont-run.com (Option 1) is the recommended approach**. This solution:

1. ✅ Completely eliminates frontend code from Go backend
2. ✅ Leverages existing cloud infrastructure
3. ✅ Provides consistent experience across all backend languages
4. ✅ Enables future team collaboration features
5. ✅ Maintains security by keeping business logic local

**The Go backend already sends sufficient data to ont-run.com** (via cloud registration) to support the browser UI. The missing pieces are:
- Previous ontology version (from ont.lock)
- Diff computation
- Approval callback mechanism

These can be added with approximately **4-5 days of development effort** split between Go backend changes (2 days) and cloud service changes (2-3 days).

For users with strict privacy requirements or offline needs, **Option 2 (embedded browser)** remains a valid alternative that can be added later as a fallback option.

---

## Next Steps

1. **Stakeholder Decision**: Review the comparison table and choose primary approach
2. **Infrastructure Planning**: If cloud-hosted, plan ont-run.com service changes
3. **Implementation**: Follow the detailed roadmap in this document
4. **Documentation**: Update README and add browser usage guide
5. **Testing**: Verify both happy path and offline fallback scenarios
