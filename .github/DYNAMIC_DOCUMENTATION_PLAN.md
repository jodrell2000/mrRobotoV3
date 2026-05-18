# Dynamic Documentation Feature Plan

**Feature Branch:** `feature/dynamic-documentation`  
**Target Version:** `v1.2.0`  
**Development Tag:** `v1.2.0-development` (hyphen for semver compliance)  
**Created:** 2026-05-18  
**Status:** Planning

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
- HTTP server exists in `src/index.js` (lines 7-13)
- Server listens on `process.env.PORT || 8080`
- Currently only responds with `"ok"` for health checks
- Originally designed for Google Cloud Run

### Current Limitations
- Port 8080 not exposed in Oracle deployment
- Dockerfile exposes port 3000 (mismatch with server listening on 8080)
- No routing logic - all requests get same response
- No HTML generation capabilities

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
GET /chatcommands     → Chat commands with messages and images (using .pug templates)
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
- **Response:** HTML page rendered from .pug templates (reused from existing project)
- **Template Engine:** Pug (jade) - requires adding as dependency
- **Content:**
  - List of all chat commands
  - Associated messages for each command
  - Images/screenshots showing command usage
  - Visual examples of command output
- **Data Source:** Command files + image directory
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
- Render pug templates for /chatcommands
- Generate inline HTML for other endpoints
- Read command metadata from command files
- Serve static files and images
- Query live state from stateService
- Access configuration from dataService
- Retrieve statistics from databaseService
- Provide simple HTML templating

**Key Methods:**
```javascript
- generateLandingPage()
- generateChatCommandsPage() // Uses pug templates
- generateCommandsPage()      // Technical reference
- generateStatusPage()
- generateTokensPage()
- generatePersonalityPage()
- generateStatsPage()
- renderPugTemplate(templateName, data)
- serveStaticFile(filePath)
- wrapInTemplate(title, content) // For non-pug pages
```

### 3. HTML Templates

**Template Engine:** Pug (formerly Jade) - to be added as dependency

**Template Locations:**
- Reuse existing .pug templates from other project for /chatcommands
- Create new templates in `src/templates/web/` or `templates/` for other pages
- Option to mix: Pug templates for complex pages, inline HTML for simple pages

**Files:**
- `chatcommands.pug` - Chat commands listing with images (reused from existing project)
- `layout.pug` - Base HTML structure with CSS (if using pug for all pages)
- Alternative: Simple inline HTML generation for other endpoints (no template engine needed)

**Styling:**
- Inline CSS or separate stylesheet
- Mobile-friendly responsive design
- Dark mode support (matches TT.fm aesthetic)

## Implementation Plan

### Phase 1: Infrastructure Setup
1. ✅ Create feature branch
2. ✅ Create planning document
3. Update Dockerfile:
   - Fix port exposure (3000 → 8080)
   - Add VERSION_TAG build arg
   - Create VERSION file during build
4. Update GitHub Actions workflow to pass version as build arg
5. Update Oracle deployment script to map port 8080
6. Update docker-compose.yml to expose port 8080
7. Test basic HTTP server accessibility

### Phase 2: Documentation Service
1. Create `versionService.js` for reading version info
2. Create `documentationService.js`
3. Implement HTML template wrapper
4. Register services in serviceContainer
5. Add basic landing page generation
6. Test services independently

### Phase 3: Chat Commands Documentation
1. Add `pug` package dependency
2. Import .pug templates from existing project
3. Implement chat commands discovery logic
4. Parse command metadata and associated messages
5. Serve command images from data directory
6. Generate /chatcommands page using pug templates
7. Test template rendering and image serving

### Phase 4: Command Reference Documentation
1. Implement command metadata discovery
2. Parse command files (requiredRole, description, example)
3. Generate /commands reference page
4. Group commands by category
5. Add search/filter functionality (client-side JavaScript)

### Phase 5: Status Pages
1. Implement live status page:
   - Bot version (from VERSION file)
   - Git tag (e.g., v1.1.3)
   - Build date and commit SHA
   - Bot uptime
   - Bot state (connected, hangout name)
   - Current DJ and song
   - User count
2. Add token reference page (built-in + custom tokens)
3. Create personality configuration viewer
4. Add database statistics page

### Phase 6: Routing & Integration
1. Update `src/index.js` with routing logic
2. Integrate documentationService
3. Handle 404 errors gracefully
4. Add navigation menu to all pages

### Phase 7: Testing & Deployment
1. Write unit tests for documentationService
2. Test all endpoints locally
3. Update CHANGELOG.md
4. Create release notes
5. Deploy to production and configure firewall

## Technical Decisions

### Why Not Use Express.js?
- Project guidelines prefer Node.js built-in modules
- Minimal dependencies philosophy
- Simple routing needs don't justify framework overhead
- Current server is already using native `http` module

### Template Engine Decision
- **Pug templates** for /chatcommands (reusing existing templates from other project)
- **Mixed approach:** Can use pug where beneficial, inline HTML for simple pages
- **Dependency:** Add `pug` package for template rendering
- **Rationale:** Reusing proven templates saves development time, pug is lightweight

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
- Source: Command files in `src/commands/` + message data + images
- Data: Command names, associated messages, images/screenshots
- Images: Served from `data/` or `html/images/` directory
- Templates: Pug templates (reused from existing project)
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

- [ ] Web server accessible from browser at `http://193.123.182.235:8080`
- [ ] All planned routes return valid HTML or appropriate responses
- [ ] /chatcommands displays commands with messages and images using pug templates
- [ ] /commands documentation is accurate and complete with metadata
- [ ] Command images are served correctly
- [ ] Live status reflects current bot state and version info
- [ ] Token reference includes all available tokens
- [ ] Pages are mobile-responsive
- [ ] All tests passing
- [ ] Documentation updated

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
- Mitigation: Cache generated HTML, lazy load stats

### High Risk
- None identified

## Timeline Estimate

- **Phase 1 (Infrastructure):** 1-2 hours
- **Phase 2 (Services):** 2-3 hours
- **Phase 3 (Chat Commands):** 3-4 hours
- **Phase 4 (Command Reference):** 2-3 hours
- **Phase 5 (Status Pages):** 2-3 hours
- **Phase 6 (Integration):** 1-2 hours
- **Phase 7 (Testing):** 2-3 hours

**Total Estimate:** 13-20 hours

## Notes

- Keep implementation simple and maintainable
- Follow existing code style and patterns
- Use CommonJS modules (no ES6 imports)
- Add `pug` as dependency for template rendering
- Reuse existing .pug templates from other project for /chatcommands
- Avoid external dependencies where possible (except pug)
- Test thoroughly before deployment
- Document configuration changes needed for Oracle Cloud
- Ensure images are served correctly from data directory
