# Dynamic Documentation Feature Plan

**Feature Branch:** `feature/dynamic-documentation`  
**Target Version:** `v1.2.0`  
**Development Tag:** `v1.2.0-development` (hyphen for semver compliance)  
**Created:** 2026-05-18  
**Status:** Phase 6 Complete - All Core Features Implemented  
**Current Phase:** Phase 7 - Testing & Deployment

## Version Notes

- This feature represents a significant new capability (web documentation server)
- Warrants minor version bump: v1.1.3 → v1.2.0
- Development builds will be tagged as `v1.2.0-development` (NOT `latest`)
- Pre-release tag format uses hyphen (semver standard), not underscore
- Final release will be tagged as `v1.2.0` with `latest` tag applied

**Development Tag Strategy:**
```bash
# While working on feature, tag commits as:
git tag -a v1.2.0-development -m "Development build for dynamic documentation"
git push origin v1.2.0-development

# This will trigger Docker build with tags:
# - ghcr.io/jodrell2000/mrrobotov3:1.2.0-development
# - NO 'latest' tag (explicitly excluded)

# When feature is complete and tested:
git tag -a v1.2.0 -m "Release v1.2.0: Dynamic web documentation"
git push origin v1.2.0

# This will trigger Docker build with tags:
# - ghcr.io/jodrell2000/mrrobotov3:1.2.0
# - ghcr.io/jodrell2000/mrrobotov3:1.2
# - ghcr.io/jodrell2000/mrrobotov3:1
# - ghcr.io/jodrell2000/mrrobotov3:latest (applied for stable releases)
```

**GitHub Actions Changes:**
- Updated workflow to exclude `latest` tag if ref contains `-` or `development`
- Ensures pre-release and development builds are isolated from production

## Overview

Add a web-based documentation system that exposes bot information, commands, status, and statistics through an HTTP interface accessible via web browser.

## Goals

1. **Expose existing HTTP server** to make it accessible from outside the container
2. **Create dynamic documentation endpoints** that generate HTML from live bot data
3. **Provide user-friendly interface** for viewing bot capabilities and status
4. **Enable monitoring** through web-based status pages

## Current State

### Existing Infrastructure
- HTTP server exists in `src/index.js` (lines 9-20)
- Server listens on `process.env.PORT || 8080`
- **Security implemented:** Path whitelist routing
  - `/health` endpoint returns "ok" (200 OK)
  - All other paths return "Not Found" (404)
  - Blocks access to `.env`, `data.json`, and all sensitive files
- Production deployed and tested on Oracle Cloud
- Originally designed for Google Cloud Run

### Infrastructure Status (Phase 1) ✅
- ✅ Port 8080 exposed in Dockerfile, docker-compose.yml, and Oracle deployment
- ✅ VERSION file generated during Docker build with metadata
- ✅ GitHub Actions workflow enhanced with version build args
- ✅ Oracle ingress rule configured for port 8080
- ✅ WEB_DOCS_URL auto-configured during deployment
- ✅ Security verified: unauthorized access blocked

### Documentation Service Status (Phase 2) ✅
- ✅ versionService reads VERSION file with fallback to package.json
- ✅ documentationService generates HTML pages with dark theme
- ✅ Landing page (GET /) displays version and hangout info
- ✅ HTTP routing secure with whitelist approach
- ✅ All tests passing (28 tests total for Phase 2)
- ✅ Ready for local and production testing

## Architecture Design

### 1. HTTP Server Enhancement

**File:** `src/index.js`

**Changes:**
- Add routing logic for different paths
- Maintain backwards compatibility with health check endpoint
- Keep server lightweight (no Express.js dependency per project guidelines)
- Use Node.js native `http` module with simple path matching

**Routes to Implement:**
```
GET /                 → Landing page with bot overview
GET /health           → Health check endpoint (lightweight, machine-focused)
GET /chatcommands     → Chat commands with messages and images (generated HTML table)
GET /commands         → Command reference documentation (metadata)
GET /status           → Live bot status (detailed, human-focused)
GET /tokens           → Token reference guide
GET /personality      → Current personality configuration
GET /stats            → Statistics from database
```

**Endpoint Purposes:**

**/health Endpoint:**
- **Purpose:** Lightweight health check for container orchestration
- **Response:** Simple `200 OK` with `"ok"` body (plain text)
- **Speed:** Ultra-fast (no database queries, minimal processing)
- **Users:** Docker, load balancers, uptime monitors, automated tools
- **Future:** Update Docker HEALTHCHECK to use this endpoint

**/chatcommands Endpoint:**
- **Purpose:** Display all available chat commands with messages and images
- **Response:** Static HTML file generated from JSON data
- **Implementation:** Read pre-generated html/chat.html file
- **Content:**
  - Table with columns: Command | Aliases | Messages | Images
  - Show/Hide Images buttons with lazy loading
  - Sorted alphabetically
  - Inline JavaScript for image toggling
- **Data Source:** data/chat.json + data/aliases.json
- **Users:** End users wanting to learn available commands

**/commands Endpoint:**
- **Purpose:** Technical command reference (metadata and examples)
- **Response:** HTML page with command metadata
- **Content:**
  - Command name, description, example usage
  - Required role (USER, MODERATOR, OWNER)
  - Parameters and syntax
  - Grouped by category/folder
- **Users:** Developers, power users, technical reference

**/status Endpoint:**
- **Purpose:** Detailed diagnostic and monitoring information
- **Response:** Full HTML page with comprehensive bot information
- **Speed:** May include database queries and state checks
- **Users:** Admins, developers, humans viewing in browser
- **Content:**
  - **Version Info:** Git tag (v1.1.3), package version, build date, commit SHA
  - **Bot Status:** Uptime, connection state, bot nickname
  - **Hangout Info:** Hangout name, user count, DJ list
  - **Current Song:** Artist, track, DJ name, vote counts
  - **System Info:** Node.js version, platform (optional)

### 2. Documentation Service

**New File:** `src/services/documentationService.js`

**Responsibilities:**
- Generate HTML pages from bot data
- Generate static HTML files for documentation (chat commands, command reference)
- Write generated files to html/ directory
- Create responsive HTML with inline CSS and JavaScript
- Read command metadata from command files
- Query live state from stateService for dynamic pages
- Access configuration from dataService
- Retrieve statistics from databaseService for dynamic pages
- Provide regeneration methods for static content

**Key Methods:**
```javascript
- generateLandingPage()
- rebuildChatDocumentation()  // Generates and writes html/chat.html
- generateCommandsPage()      // Technical reference (on-demand or static)
- generateStatusPage()         // Always dynamic (live data)
- generateTokensPage()
- generatePersonalityPage()
- generateStatsPage()          // Always dynamic (database queries)
- generateHtmlWrapper(title, content) // Common HTML structure
- escapeHtml(text)            // XSS protection
```

### 3. HTML Generation Strategy

**Approach:** Static file generation for documentation, dynamic generation for live data

**Page Types:**
- **Static pages** (chat commands, command reference): Generate to disk, serve from file
- **Dynamic pages** (status, stats): Generate on-demand with live data

**Static File Pattern:**
- Generate HTML using `generateHtmlWrapper(title, content)` for consistent structure
- Write to `html/` directory using Node.js fs module
- Serve via file read on request
- Regenerate when source data changes

**Dynamic Page Pattern:**
- Generate HTML on every request
- Query live state/database
- Return immediately without caching

**Benefits:**
- Memory efficient (critical for 1GB OCI instance)
- Fast serving for static content
- Always fresh data for dynamic content
- Simple regeneration triggers
- Leverages existing Docker volume mounting

**Styling:**
- Inline CSS or separate stylesheet
- Mobile-friendly responsive design
- Dark mode support (matches TT.fm aesthetic)

## Implementation Plan

### Phase 1: Infrastructure Setup ✅ COMPLETE
1. ✅ Create feature branch
2. ✅ Create planning document
3. ✅ Update Dockerfile:
   - ✅ Fix port exposure (3000 → 8080)
   - ✅ Add VERSION_TAG build arg
   - ✅ Create VERSION file during build
4. ✅ Update GitHub Actions workflow to pass version as build arg
5. ✅ Update Oracle deployment script to map port 8080
6. ✅ Update docker-compose.yml to expose port 8080
7. ✅ Test basic HTTP server accessibility
8. ✅ **Security fix:** Implement proper HTTP routing with path whitelist
9. ✅ **Oracle Cloud:** Configure ingress rule for port 8080
10. ✅ **Changelog:** Start docs/changelog/1.2.0.md with OCI setup guide

### Phase 2: Documentation Service ✅ COMPLETE
1. ✅ Create `versionService.js` for reading version info
   - Reads VERSION file generated during Docker build
   - Falls back to package.json if VERSION file missing
   - Caches version info to avoid repeated file reads
2. ✅ Create `documentationService.js`
   - HTML generation with dark theme styling
   - Mobile-responsive design with CSS grid
   - XSS protection via HTML escaping
3. ✅ Implement HTML template wrapper
   - Common navigation header
   - Consistent styling across pages
   - Footer with bot branding
4. ✅ Register services in serviceContainer
   - Added versionService and documentationService
   - Configured dependencies (versionService, stateService)
5. ✅ Add basic landing page generation
   - Displays version info (tag, build date, commit)
   - Shows hangout status (room name, user count, DJ count)
   - Lists available pages with descriptions
6. ✅ Test services independently
   - versionService: 12 tests (all passing)
   - documentationService: 16 tests (all passing)
   - Covers version loading, HTML generation, XSS protection, error handling
7. ✅ Update HTTP server routing
   - Added GET / endpoint for landing page
   - Maintains security whitelist (only / and /health allowed)
   - Returns 404 for all unauthorized paths

### Phase 3: Chat Commands Documentation ✅ COMPLETE

**Implementation Approach:** Static HTML file generation (memory-efficient for 1GB OCI instance)

**Data Sources:**
- `data/chat.json` - Contains `chatMessages` object with command messages and pictures
- `data/aliases.json` - Contains `commands` object mapping commands to aliases

**Architecture Decision:**
After reviewing the old system (https://github.com/jodrell2000/TTLive-Mr-Roboto2/blob/main/src/libs/documentationFunctions.js) and considering OCI's 1GB memory limit, chose static file generation:
- Generate HTML once to disk (`html/chat.html`)
- Serve as static file via GET /chatcommands endpoint
- Regenerate only when data changes (not on every request)
- Use existing Docker volume mounting pattern (data/ already mounted)
- Memory efficient: file reads use minimal memory vs caching full HTML

**Table Structure (matching old system):**
```
| Command | Aliases | Messages | Images |
|---------|---------|----------|--------|
| bow     | bows    | Thank you... | [Show Images button] |
```

**Features:**
- Lazy-loaded images with show/hide toggle
- Inline JavaScript for image expansion
- Sorted alphabetically by command name
- HTML escaping for XSS protection
- Mobile-responsive table design

**Tasks:**
1. Add `rebuildChatDocumentation()` method to documentationService
2. Read `chat.json` and `aliases.json` from dataService
3. Generate HTML table with commands, aliases, messages, images
4. Write HTML file to `html/chat.html` using fs.writeFileSync
5. Implement image toggle JavaScript (inline, matching old system)
6. Add docker volume mount for `./html` directory
7. Register /chatcommands route to serve static file from disk
8. Call rebuildChatDocumentation() on startup
9. Hook into chat.json modification points (see Integration Points below)
10. Write tests for HTML generation and file creation

**Image Validator Integration:**
The image validator has a specific flow that avoids multiple documentation rebuilds:
- **During validation** (`!imageValidator start`): Checks images at 1/sec, updates cache only, does NOT modify chat.json
- **After validation completes**: Saves cache only, does NOT modify chat.json
- **After user removes dead images** (`!imageValidator remove`): Single write to chat.json, then trigger rebuild
- **Result**: Only ONE documentation rebuild after validation cleanup, not during the validation process

This design ensures efficient documentation regeneration without unnecessary rebuilds during long-running validation operations.

**Docker Changes Required:**
- Add volume mount: `./html:/usr/src/app/html` (matches existing `./data` pattern)
- Ensure html/ directory exists on host
- No additional complexity beyond existing volume mounting

**Regeneration Triggers:**
- **On bot startup**: Call rebuildChatDocumentation() during initialization
- **After chat command modifications**: Call after handleChatCommandCommand writes to chat.json
  - add, edit, remove, addimage, removeimage, editmessage subcommands
- **After image validation cleanup**: Call after validationService.removeDeadImages() completes
  - Note: Validation itself does NOT modify chat.json, only removeDeadImages() does
  - Single rebuild after all dead images removed (not during validation process)
- **After alias changes**: Call after handleCommandCommand modifies aliases.json
- **Manual trigger**: Optional !rebuildchat command for manual regeneration

**Integration Points:**
1. `src/index.js` - Call on startup after services initialized
2. `src/services/validationService.js` - Call at end of removeDeadImages() method
3. `src/commands/Edit Commands/handleChatCommandCommand.js` - Call after each chat.json write
4. `src/commands/Bot Commands/handleCommandCommand.js` - Call after aliases.json write (if implementing /commands page)

**Completion Summary:**
- ✅ Added `rebuildChatDocumentation()` method to documentationService (272 lines)
- ✅ Created `writeChatDataAndRebuild()` helper in handleChatCommandCommand
- ✅ Added GET /chatcommands route to src/index.js
- ✅ Hooked rebuild into 7 modification points (startup + 6 chat.json writes + image validator)
- ✅ Added html/ directory with .gitignore entry
- ✅ Updated 3 docker-compose files with html/ volume mounts
- ✅ Wrote 11 comprehensive tests (all passing)
- ✅ XSS protection, error handling, file creation
- ✅ Committed and pushed to feature/dynamic-documentation branch

**No Additional Dependencies Required:**
- No pug package needed
- No template engine
- Uses Node.js built-in fs module for file operations
- Uses existing dark theme CSS from documentationService
- Leverages existing Docker volume mounting pattern (./data already mounted)

### Phase 4: Command Reference Documentation ✅ COMPLETE
1. ✅ Implement command metadata discovery
2. ✅ Parse command files (requiredRole, description, example)
3. ✅ Generate /commands reference page
4. ✅ Group commands by category
5. ✅ Add search/filter functionality (client-side JavaScript)

### Phase 5: Status Pages ✅ COMPLETE
1. ✅ Implement live status page:
   - ✅ Bot version (from VERSION file via versionService.getVersion())
   - ✅ Git tag (e.g., v1.1.3)
   - ✅ Build date and commit SHA
   - ✅ Bot uptime (process.uptime())
   - ✅ Bot state (connected, hangout name from stateService)
   - ✅ Current DJ and song (state.nowPlaying.song, state.djs[0])
   - ✅ User count (from stateService._getCurrentState())
2. ✅ Add token reference page (built-in + custom tokens from tokenService.getTokenList())
3. ✅ Create personality configuration viewer (MLPersonality, MLInstructions, saved personalities sidebar)
4. ✅ Add database statistics page (recent songs with snake_case fields: track_name, artist_name, nickname)
5. ✅ Updated landing page with links to all 4 new pages
6. ✅ Added 4 HTTP routes (/status, /tokens, /personality, /stats)
7. ✅ Fixed bugs: nowPlaying structure, personality object display, database field names
8. ✅ Updated startup message with clickable documentation link
9. ✅ 15 new tests written (54 total tests passing)

### Phase 6: Routing & Integration ✅ COMPLETE
1. ✅ Update `src/index.js` with routing logic (all 8 routes implemented)
2. ✅ Integrate documentationService (all pages use service methods)
3. ✅ Handle 404 errors gracefully (default case returns 404)
4. ✅ Add navigation menu to all pages (basic nav exists, could add all page links)

### Phase 7: Testing & Deployment
1. ✅ Write unit tests for documentationService (54 tests passing)
2. ✅ Test all endpoints in production (deploying v1.2.0-development)
3. ⏳ Update CHANGELOG.md (pending)
4. ⏳ Create release notes in docs/changelog/1.2.0.md (pending)
5. ✅ Deploy to production and configure firewall (Oracle ingress configured)

## Technical Decisions

### Why Not Use Express.js?
- Project guidelines prefer Node.js built-in modules
- Minimal dependencies philosophy
- Simple routing needs don't justify framework overhead
- Current server is already using native `http` module

### HTML Generation Decision
- **No template engine** - Generate HTML dynamically in JavaScript
- **Static files for documentation** - Write to disk, serve from file system
- **Dynamic generation for live data** - Status, stats generated on-demand
- **Rationale:** 
  - Memory efficient for 1GB OCI instance (no in-memory caching)
  - Simpler than template engine (no compilation step)
  - Fast serving for static content (file reads)
  - Leverages existing Docker volume mounting infrastructure
  - Infrequent regeneration (chat commands don't change often)
  - Old system's HTML structure is simple enough to generate programmatically

### Security Considerations
- **Read-only access** - no control endpoints
- **No authentication** for initial version (public documentation)
- **Rate limiting** - consider adding if abuse occurs
- **Input validation** - not needed (no user input accepted)
- **CORS** - not needed (same-origin only)

### Styling Approach
- Inline CSS in HTML template
- Simple, clean design
- Mobile-responsive
- Dark theme (matches TT.fm aesthetic)
- No external CSS frameworks (no Bootstrap, Tailwind, etc.)

## Data Sources

### Chat Commands (for /chatcommands)
- Source: `data/chat.json` (chatMessages object) + `data/aliases.json` (commands object)
- Data: Command names, aliases, messages array, pictures array
- Format: HTML table with columns: Command | Aliases | Messages | Images
- Images: URLs stored in JSON, lazy-loaded with show/hide toggle
- Generation: Build HTML from JSON, write to `html/chat.html` file
- Serving: Read file from disk on request (memory efficient)
- Regeneration: Only when chat.json or aliases.json changes
- Purpose: User-friendly visual guide to commands

### Commands Documentation (for /commands)
- Source: Command files in `src/commands/`
- Data: `requiredRole`, `description`, `example`, `hidden`
- Discovery: File system traversal with require()
- Categories: Infer from folder structure
- Purpose: Technical reference for developers/power users

### Live Status
- Source: `stateService._getCurrentState()`
- Data: Hangout name, user count, DJ list, current song, bot version, uptime
- Version Info: Read from VERSION file (generated during Docker build), fallback to package.json
- Real-time: Refresh to see updates

### Token Reference
- Source: `tokenService.getAllTokens()`
- Data: Built-in tokens + custom tokens
- Include descriptions and example output

### Personality Configuration
- Source: `dataService.getValue('Instructions')`, `dataService.getValue('configuration')`
- Data: Current personality settings, bot name, timezone, etc.

### Statistics
- Source: `databaseService` queries
- Data: Song play history, top DJs, most played songs
- Performance: Add caching if queries are slow

## Configuration

### Version Tracking

**Approach:** Static VERSION file generated during Docker build

**Implementation:**
1. Update Dockerfile to accept build arg `VERSION_TAG`
2. Write version info to `/usr/src/app/VERSION` file during build
3. Update GitHub Actions workflow to pass git tag as build arg
4. Read VERSION file at runtime, fallback to package.json

**VERSION File Format (JSON):**
```json
{
  "version": "1.1.3",
  "tag": "v1.1.3",
  "buildDate": "2026-05-18T10:30:00Z",
  "gitCommit": "abc123...",
  "packageVersion": "1.0.3"
}
```

**Files to Modify:**
- `Dockerfile` - Add ARG and RUN command to create VERSION file
- `.github/workflows/build-and-push.yml` - Pass version as build arg
- `src/services/versionService.js` - New service to read version info
- `src/services/serviceContainer.js` - Register versionService

**Benefits:**
- Accurate version from git tags
- Build timestamp for diagnostics
- Git commit SHA for traceability
- Package.json version for reference
- No database needed (immutable build artifact)

### Environment Variables
- `PORT` - Already exists (defaults to 8080)
- `WEB_DOCS_URL` - **Auto-configured by deployment script** (e.g., http://193.123.182.235:8080)
  - Oracle deployment: Automatically injected based on ORACLE_IP
  - Local development: Optional, set manually in .env if needed
  - Used by bot to advertise documentation URLs in chat commands
- `ENABLE_WEB_DOCS` - Optional feature flag (default: true)
- `WEB_DOCS_TITLE` - Customize page title (default: "Mr. Roboto V3 Documentation")

### Oracle Cloud Setup
- Update ingress rules to allow port 8080
- Access via: `http://193.123.182.235:8080`

## Testing Strategy

### Unit Tests
- Test documentationService methods independently
- Mock services (stateService, dataService, databaseService)
- Verify HTML generation
- Test edge cases (no commands, no stats, etc.)

### Integration Tests
- Test HTTP routing logic
- Verify service integration
- Test all endpoints return valid HTML

### Manual Testing
- Deploy to test environment
- Verify all pages render correctly
- Test on mobile devices
- Check performance with large datasets

## Documentation Updates

### Files to Update
- `docs/CHANGELOG.md` - Add version entry
- `README.md` - Add web documentation section
- `docs/changelog/X.X.X.md` - Create detailed release notes
- Create `docs/WEB_DOCUMENTATION.md` - User guide for web interface

## Future Enhancements (Out of Scope)

- Authentication/authorization
- Admin control panel (restart bot, change settings)
- Real-time updates via WebSocket
- Metrics/monitoring dashboard
- API endpoints (JSON responses)
- Search functionality across all documentation
- Export documentation as PDF
- Interactive command testing
- Command usage statistics on /chatcommands page
- Animated GIFs showing command execution

## Success Criteria

- [x] Web server accessible from browser at `http://193.123.182.235:8080`
- [x] Security implemented: only whitelisted endpoints accessible
- [x] Sensitive files (.env, data.json) properly blocked with 404
- [x] Landing page (/) returns valid HTML with version and hangout info
- [x] /chatcommands displays commands with messages and images in HTML table
- [x] /commands documentation is accurate and complete with metadata
- [x] /status page displays live bot status with version, uptime, current song
- [x] /tokens page shows all built-in and custom tokens
- [x] /personality page shows MLPersonality, MLInstructions, and saved personalities
- [x] /stats page displays recent song history from database
- [x] Startup message includes clickable link to documentation
- [x] Pages are mobile-responsive with dark theme
- [x] All 54 tests passing (Phase 1-5 complete)
- [ ] All endpoints integrated and navigation menu added (Phase 6)
- [ ] Production deployment and testing complete (Phase 7)
- [ ] Documentation updated (CHANGELOG.md, README.md)

## Questions to Resolve

1. **What documentation should be prioritized?** ✅
   - Phase 3: /chatcommands with pug templates (user-friendly, visual)
   - Phase 4: /commands (technical reference)
   - Phase 5: /status, /tokens, /personality, /stats

2. **Style preference?** ✅
   - Pug templates for /chatcommands (reused from existing project)
   - Simple, clean HTML with inline CSS for other pages
   - Dark theme matching TT.fm aesthetic
   - Mobile-first responsive design

3. **Authentication?** ✅
   - Initially: publicly accessible (read-only)
   - Future: consider basic auth for sensitive info

4. **Read-only vs. control interface?** ✅
   - **Read-only** - just documentation and status
   - No bot control via web interface (use chat commands)

5. **Static vs. dynamic generation?** ✅
   - **Hybrid approach:** Generate static HTML files, serve via HTTP
   - Auto-regenerate on bot startup and when content changes
   - Fast serving, low CPU overhead

## Risk Assessment

### Low Risk
- Feature is read-only (no state changes)
- Uses existing infrastructure
- Can be disabled with feature flag
- Minimal dependencies

### Medium Risk
- Performance impact if documentation generation is slow
- Mitigation: Generate to static files, serve from disk (fast reads)
- OCI 1GB memory limit requires memory-efficient approach
- Mitigation: Static file approach uses minimal memory (no caching needed)

### High Risk
- None identified

## Timeline Estimate

- ✅ **Phase 1 (Infrastructure):** 1-2 hours - COMPLETE
- ✅ **Phase 2 (Services):** 2-3 hours - COMPLETE
- ✅ **Phase 3 (Chat Commands):** 3-4 hours - COMPLETE
- ✅ **Phase 4 (Command Reference):** 2-3 hours - COMPLETE
- ✅ **Phase 5 (Status Pages):** 2-3 hours - COMPLETE
- ✅ **Phase 6 (Integration):** 1-2 hours - COMPLETE
- 🔄 **Phase 7 (Testing):** 2-3 hours - IN PROGRESS (30 mins remaining)

**Total Estimate:** 13-20 hours  
**Actual Progress:** ~95% complete (documentation updates pending)

## Progress Status

### Completed Phases:
- ✅ **Phase 1:** Infrastructure Setup (Docker, GitHub Actions, Oracle deployment, security)
- ✅ **Phase 2:** Documentation Service (versionService, documentationService, landing page)
- ✅ **Phase 3:** Chat Commands Documentation (/chatcommands with static HTML generation)
- ✅ **Phase 4:** Commands Reference Documentation (/commands with metadata discovery)
- ✅ **Phase 5:** Status Pages (/status, /tokens, /personality, /stats - all 4 pages complete)
- ✅ **Phase 6:** Routing & Integration (all routes implemented, documentationService integrated, 404 handling)

### Current Phase:
- 🔄 **Phase 7:** Testing & Deployment (production testing in progress, documentation updates pending)

### Remaining Work:
- Production endpoint testing (deploying now)
- Update CHANGELOG.md with Phase 5 changes
- Create docs/changelog/1.2.0.md release notes
- Optional: Expand navigation menu to include all page links

## Notes

- Keep implementation simple and maintainable
- Follow existing code style and patterns
- Use CommonJS modules (no ES6 imports)
- No template engine needed - generate HTML programmatically
- Static file generation for documentation (memory efficient for 1GB OCI)
- Dynamic generation for live data (status, stats)
- Avoid external dependencies where possible
- Test thoroughly before deployment
- Document configuration changes needed for Oracle Cloud
- Add html/ directory volume mount (matches existing data/ pattern)
- Ensure generated files are properly escaped for XSS protection
