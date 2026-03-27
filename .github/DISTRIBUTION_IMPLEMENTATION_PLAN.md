# Docker Distribution Implementation Plan

**Project:** Mr. Roboto V3  
**Goal:** Enable hybrid distribution via GitHub Container Registry with local and cloud hosting options  
**Target Audience:** Non-technical users who want to easily run the bot  
**Status:** Phase 1 Complete ✅ | Phase 2 In Progress 🔄

---

## Executive Summary

This plan transforms Mr. Roboto V3 from a "clone and build" project into a user-friendly distribution with pre-built Docker images for cloud hosting. Users will be able to deploy the bot to free cloud hosting with minimal setup.

**Key Benefits:**
- ✅ No build tools required for end users
- ✅ Free image hosting via GitHub Container Registry
- ✅ Automated builds on git tags
- ✅ Free cloud hosting (Google Cloud Run)
- ✅ Multi-architecture support (AMD64 + ARM64)

---

## Current Implementation Status

**Last Updated:** March 27, 2026  
**Phase Completed:** Phase 1 - GHCR Setup & Automation  
**Next Phase:** Phase 2 - Cloud Hosting Guide

### ✅ Phase 1 Complete - What's Been Done

All steps of Phase 1 have been successfully completed and tested:

**Step 1.1 - GHCR Setup:** ✅ COMPLETE
- GHCR is auto-enabled (no manual setup needed)
- Package appears at: https://github.com/jodrell2000/mrRobotoV3/packages
- Package has been set to PUBLIC visibility (important!)

**Step 1.2 - GitHub Actions Workflow:** ✅ COMPLETE
- File created: `.github/workflows/build-and-push.yml`
- Workflow triggers on semantic version tags: `v*.*.*` and `v*.*.*-*`
- Uses built-in `GITHUB_TOKEN` (no manual secrets)
- Successfully creates version tags (strips 'v' prefix from git tags)

**Step 1.3 - Testing & Public Package:** ✅ COMPLETE
- Test tag `v1.0.0-test` pushed and built successfully
- Package set to PUBLIC (anyone can pull without authentication)
- Image pulls successfully: `docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.0-test`
- Bot runs correctly with volume-mounted .env file
- Verified .env is NOT baked into image (security confirmed)

**Step 1.4 - Multi-Architecture Support:** ✅ COMPLETE
- Workflow updated with QEMU and Docker Buildx
- Builds for both `linux/amd64` and `linux/arm64` platforms
- Test tag `v1.0.1-multiarch` pushed and built successfully
- Verified on Apple Silicon Mac: no platform warnings, native ARM64 execution
- Node.js v18.20.8 confirmed working

### 🔑 Key Technical Details Discovered

**Tag Format (CRITICAL):**
- Git tags use `v` prefix: `v1.0.0`, `v1.0.1-multiarch`
- Docker image tags strip the `v`: `1.0.0`, `1.0.1-multiarch`
- Always pull WITHOUT the `v`: `docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.1-multiarch`

**Environment Variables:**
- Bot uses `dotenv` library which reads `.env` from filesystem
- Docker's `--env-file` flag CONFLICTS with dotenv - do not use it
- Only use volume mount: `-v "$(pwd)/.env:/usr/src/app/.env"`
- Mount path MUST be `/usr/src/app/.env` (matches Dockerfile WORKDIR)
- Successfully loads 13 environment variables when properly mounted

**Package Visibility:**
- GHCR packages default to PRIVATE regardless of repo visibility
- Must manually set to PUBLIC after first push (one-time step)
- Located in: Package settings → Danger Zone → Change package visibility

**Logging:**
- Bot logs to FILES in mounted `./logs/` directory, NOT to stdout
- Use `docker logs` only for basic status
- For detailed bot logs, check files in `./logs/` directory

**Image Details:**
- Repository: https://github.com/jodrell2000/mrRobotoV3
- Image URL: `ghcr.io/jodrell2000/mrrobotov3` (lowercase, auto-converted)
- Base: `node:18-alpine`
- WORKDIR: `/usr/src/app`
- User: non-root (mrroboto, UID 1001)
- Platforms: `linux/amd64`, `linux/arm64`

**Test Tags Created:**
- `v1.0.0-test` - Initial testing (AMD64 only)
- `v1.0.1-multiarch` - Multi-architecture testing (AMD64 + ARM64)

### 📋 Files Modified/Created in Phase 1

**Created:**
- `.github/workflows/build-and-push.yml` - Multi-arch Docker build workflow
- `.github/DISTRIBUTION_IMPLEMENTATION_PLAN.md` - This file

**Existing Files (Reference These):**
- `Dockerfile` - Production-ready, no changes needed
- `.dockerignore` - Properly excludes .env files
- `docker-compose.prod.yml` - Security patterns for reference
- `.env_example` - Template for users

### 🚀 Ready for Phase 2

**What You Need to Start Phase 2:**
1. Pull latest changes from git
2. Review Phase 2 Section below (starts at "Phase 2: Cloud Hosting Option")
3. Have Google Cloud account ready (free tier)
4. Reference test tags: `1.0.0-test` or `1.0.1-multiarch`
5. Bot .env values ready for testing Secret Manager setup

**Starting Point:** Step 2.1 - Create Cloud Hosting Guide
**Estimated Time:** 7 hours for full Phase 2
**Main Deliverable:** `docs/CLOUD_HOSTING.md` with Google Cloud Run deployment guide

**Important Notes for Continuation:**
- All Docker images are public and ready to use
- Multi-arch builds work perfectly (confirmed tested)
- Environment variable mounting pattern is well-documented
- Security is verified (.env not in images)
- Tag format issue is documented and resolved

---

## 🤖 COPILOT HANDOFF CONTEXT

**For Next Copilot Session: Read this section first to understand project state and continue work.**

### Project Overview
Implementing Docker distribution for Mr. Roboto V3 (Discord/chat bot). Goal: Pre-built multi-arch Docker images via GHCR + cloud hosting documentation. Currently transitioning from Phase 1 (complete) to Phase 2 (cloud hosting guides).

### Phase 1 Status: ✅ COMPLETE

Successfully implemented automated Docker image distribution:
- **Workflow Created:** `.github/workflows/build-and-push.yml` with multi-arch support
- **Trigger:** Semantic version git tags (`v*.*.*`, `v*.*.*-*`)
- **Platforms:** linux/amd64 + linux/arm64 (QEMU + Docker Buildx)
- **Registry:** GitHub Container Registry (GHCR) - free, public
- **Test Tags:** `v1.0.0-test` (single-arch), `v1.0.1-multiarch` (multi-arch)
- **Verification:** All images build successfully, pull without authentication, run correctly

### Critical Technical Facts (Reference These)

**1. Tag Format Convention:**
```
Git tag:    v1.0.0          → Docker tag: 1.0.0
Git tag:    v1.0.1-multiarch → Docker tag: 1.0.1-multiarch
```
- `docker/metadata-action@v5` strips `v` prefix automatically
- Users must pull without `v`: `docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.1-multiarch`
- This is by design, documented in plan, not a bug

**2. Environment Variable Loading:**
```bash
# ✅ CORRECT METHOD (volume mount only)
docker run -v "$(pwd)/.env:/usr/src/app/.env" ghcr.io/jodrell2000/mrrobotov3:1.0.1-multiarch

# ❌ WRONG (--env-file conflicts with dotenv library)
docker run --env-file .env ghcr.io/jodrell2000/mrrobotov3:1.0.1-multiarch
```
- Bot uses `dotenv` library which reads from filesystem
- Mount path must be `/usr/src/app/.env` (matches Dockerfile WORKDIR)
- Confirmed: loads 13 environment variables correctly

**3. GHCR Package Visibility:**
- Default: PRIVATE (regardless of repo visibility)
- Required: Manual change to PUBLIC after first push
- Location: Package settings → Danger Zone → Change package visibility
- Status: Already set to public for this project

**4. Logging Behavior:**
- Bot writes to FILES in `./logs/` directory (mounted volume)
- NOT to stdout (minimal docker logs output)
- Users must check log files, not `docker logs` command

**5. Security:**
- ✅ Verified: `.env` NOT in Docker images
- `.dockerignore` properly excludes `.env` files
- Only `.env_example` included as template

### Repository State

**Image URLs:**
- Repository: `https://github.com/jodrell2000/mrRobotoV3`
- Images: `ghcr.io/jodrell2000/mrrobotov3`
- Latest multi-arch: `ghcr.io/jodrell2000/mrrobotov3:1.0.1-multiarch`
- Package page: `https://github.com/jodrell2000/mrRobotoV3/packages`

**Files Created in Phase 1:**
- `.github/workflows/build-and-push.yml` - Multi-arch build workflow
- `.github/DISTRIBUTION_IMPLEMENTATION_PLAN.md` - This comprehensive plan

**Files to Reference:**
- `Dockerfile` - Node 18 Alpine, WORKDIR=/usr/src/app, non-root user
- `.dockerignore` - Security: excludes .env files
- `docs/SETTING_UP_YOUR_ENVIRONMENT.md` - Environment variable descriptions
- `.env_example` - Template for users

### User Intent & Scope

**Original Goal:** Deploy to AWS ECR/ECS
**Pivoted To:** Free solution via GHCR + cloud hosting guides
**Scope Reduction:** Removed local Docker quick start guides (Phase 2 original)
**Current Focus:** Cloud hosting deployment only (Google Cloud Run, Oracle Cloud, Fly.io)

**Requirements:**
- ✅ Free image hosting (GHCR)
- 🔄 Free cloud hosting guides (Phase 2 - next)
- ✅ Security (.env never in images)
- ❌ Non-technical user guides (removed from scope)

### Next: Phase 2 - Cloud Hosting Documentation

**Step 2.1: Create Cloud Hosting Guide (3-4 hours)**
Create `docs/CLOUD_HOSTING.md` with:
- Google Cloud Run step-by-step deployment
- Secret Manager configuration for .env values
- Cost estimates and free tier optimization
- Health checks and monitoring
- Troubleshooting section

**Step 2.2: Deployment Automation Script (2-3 hours)**
Create `scripts/deploy-to-cloudrun.sh` to automate:
- gcloud CLI checks
- Secret creation from local .env
- Cloud Run service deployment
- Health check configuration

**Step 2.3: Alternative Platforms (1 hour)**
Document Oracle Cloud Always Free, Fly.io with comparison table

**Total Estimated Time:** 6-8 hours

### Technical Details for Documentation

**Cloud Run Service Configuration:**
- Image: `ghcr.io/jodrell2000/mrrobotov3:latest` (or specific tag)
- Memory: 512MB (minimum for bot)
- CPU: 1 vCPU
- Port: Check Dockerfile EXPOSE (if any) or bot config
- Health check: Bot has health endpoint (verify in code)
- Environment variables: Inject from Secret Manager
- Region: us-central1 (default, lowest latency for most)

**Secret Manager Variables Needed:**
```
BOT_USER_TOKEN
COMETCHAT_AUTH_TOKEN
BOT_UID
HANGOUT_ID
COMMAND_SWITCH
LOG_LEVEL
googleAIKey (optional)
```

**Cost Monitoring:**
- Google Cloud Run free tier: 2M requests/month, 360,000 GB-seconds
- Typical bot usage: ~50,000 GB-seconds/month
- Should stay within free tier
- Add billing alert setup instructions

### Testing Checklist for Phase 2

When implementing documentation:
- [ ] Deploy to actual Cloud Run instance using `1.0.1-multiarch` tag
- [ ] Verify 13 environment variables load (check logs for "injecting env (13)")
- [ ] Confirm bot connects to hangout and responds
- [ ] Monitor Google Cloud Console costs (should be $0)
- [ ] Test deployment script on fresh Google Cloud project
- [ ] Verify all commands are copy-pasteable
- [ ] Take screenshots for documentation

### Conversation Continuity

**To continue effectively, Copilot should:**
1. Acknowledge reading this handoff section
2. Confirm understanding of Phase 1 completion
3. Ask user if ready to start Phase 2, Step 2.1
4. Reference technical details from this section in documentation
5. Not revisit resolved Phase 1 issues

**Topics Already Resolved (Don't Re-discuss):**
- ✅ GHCR vs AWS ECR decision
- ✅ Tag format issue
- ✅ Environment variable mounting strategy
- ✅ Package visibility workflow
- ✅ Multi-arch configuration
- ✅ Security verification
- ✅ Local deployment docs removal

**If Issues Arise:**
- Reference "Critical Technical Facts" section above
- Test images available: `ghcr.io/jodrell2000/mrrobotov3:1.0.1-multiarch`
- All Phase 1 outcomes confirmed working

**User Communication Style:**
- Prefers concise responses (one brief paragraph)
- Values direct implementation over verbose explanation
- Will ask clarifying questions when needed
- Follows project guidelines in `.github/copilot-instructions.md`

---

### 🔄 Switching Machines - Commands to Run

**On Current Machine (before switching):**
```bash
# 1. Stage all changes
git add .

# 2. Commit Phase 1 completion
git commit -m "Phase 1 complete: Multi-arch Docker distribution via GHCR

- Added GitHub Actions workflow for automated builds
- Implemented multi-architecture support (AMD64 + ARM64)
- Tested and verified Docker image distribution
- Updated implementation plan with Phase 1 status
- Ready for Phase 2: Cloud hosting guide"

# 3. Push to remote
git push origin main  # or your branch name

# 4. Verify push succeeded
git log --oneline -n 3
```

**On New Machine (to resume):**
```bash
# 1. Clone repository (if not already cloned)
git clone https://github.com/jodrell2000/mrRobotoV3.git
cd mrRobotoV3

# 2. Or pull latest if already cloned
git pull origin main

# 3. Verify you have the latest files
ls -la .github/workflows/build-and-push.yml
cat .github/DISTRIBUTION_IMPLEMENTATION_PLAN.md | head -20

# 4. Jump to Phase 2 in the plan
# Open .github/DISTRIBUTION_IMPLEMENTATION_PLAN.md
# Find "### Phase 2: Cloud Hosting Option"
# Start with Step 2.1: Create Cloud Hosting Guide

# 5. Test Docker image (optional verification)
docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.1-multiarch
docker run --rm ghcr.io/jodrell2000/mrrobotov3:1.0.1-multiarch node --version
# Should show: v18.20.8 with no platform warnings
```

**For New Copilot Session to Continue:**
```
1. User will say: "Continue from where we left off on Phase 2"
2. You should respond: "I've read the COPILOT HANDOFF CONTEXT section. Phase 1 (GHCR setup 
   and multi-arch builds) is complete. Ready to start Phase 2, Step 2.1: Create Cloud Hosting 
   Guide (docs/CLOUD_HOSTING.md). Should I proceed with drafting the Google Cloud Run 
   deployment guide?"
3. Reference all technical details from "Critical Technical Facts" section when writing documentation
4. Do NOT revisit Phase 1 topics (all resolved)
5. Focus on cloud deployment only (local deployment removed from scope)
```

**Context Summary for Quick Reference:**
- ✅ Phase 1 Complete: Multi-arch Docker images building and published
- 🔄 Phase 2 Starting: Cloud hosting documentation (Google Cloud Run focus)
- 🎯 Goal: Enable users to deploy bot to free cloud hosting
- 📦 Test Image: `ghcr.io/jodrell2000/mrrobotov3:1.0.1-multiarch`
- 🔑 Key Facts: Tag format (v-prefix stripping), env mounting, GHCR visibility, logging behavior

---

## Implementation Phases

### Phase 1: GitHub Container Registry (GHCR) Setup & Automation

**Objective:** Set up automated Docker image builds and free public distribution

#### Step 1.1: Understand GitHub Container Registry Setup
**Time:** 2 minutes  
**Dependencies:** None

**Important:** GitHub Container Registry (GHCR) is **automatically enabled** for all GitHub repositories. There's no manual setup required!

**What You Need to Know:**
1. GHCR is enabled by default - no settings to change
2. Package is created automatically on first image push
3. Images will be available at `ghcr.io/jodrell2000/mrrobotov3` (uses lowercase repo name)
4. Package visibility defaults to **private** on first push
5. You'll set it to **public** after the first image is pushed (Step 1.3)

**Repository Packages Page:**
- After first push, package appears at: https://github.com/jodrell2000/mrRobotoV3/packages
- Or in your user packages: https://github.com/jodrell2000?tab=packages

**Image Naming:**
- GHCR automatically converts repo names to lowercase
- Your image: `ghcr.io/jodrell2000/mrrobotov3` (note: no hyphens, lowercase)

**Verification:**
- No verification needed - GHCR is ready to use
- Package will appear after first push in Step 1.3

---

#### Step 1.2: Create GitHub Actions Workflow
**Time:** 30-45 minutes  
**Dependencies:** Step 1.1 (can work in parallel)

**File to Create:** `.github/workflows/build-and-push.yml`

**Workflow Configuration:**
```yaml
name: Build and Push Docker Image

on:
  push:
    tags:
      - 'v*.*.*'        # Triggers on semantic version tags (v1.0.0, v1.2.3, etc.)
      - 'v*.*.*-*'      # Also supports pre-release tags (v1.0.0-test, v1.0.0-alpha)

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (tags, labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

      - name: Summary
        run: |
          echo "## Docker Image Published! 🚀" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Image:** \`${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}\`" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Tags:**" >> $GITHUB_STEP_SUMMARY
          echo "\`\`\`" >> $GITHUB_STEP_SUMMARY
          echo "${{ steps.meta.outputs.tags }}" >> $GITHUB_STEP_SUMMARY
          echo "\`\`\`" >> $GITHUB_STEP_SUMMARY
```

**Key Features:**
- Triggered by semantic version tags (v1.0.0, v2.1.3, etc.)
- Supports pre-release tags (v1.0.0-test, v1.0.0-alpha)
- Uses built-in `GITHUB_TOKEN` (no manual secret configuration)
- Creates multiple tags: version, major.minor, major, and latest
- Adds metadata labels for better organization

**What to do after creating this file:**
1. Commit the workflow file: `git add .github/workflows/build-and-push.yml && git commit -m "Add Docker build workflow"`
2. Push to GitHub: `git push origin main` (or your branch name)
3. Proceed to Step 1.3 to test it

**Note:** The image won't exist yet - you'll test pulling it in Step 1.3 after pushing a tag.

**Troubleshooting:**
- If push fails: Check package permissions in repo settings
- If tag doesn't trigger: Verify tag format matches `v*.*.*` pattern
- If authentication fails: Ensure Actions have package write permission

---

#### Step 1.3: Test Automation Workflow and Set Package to Public
**Time:** 15 minutes  
**Dependencies:** Step 1.2 complete (workflow file committed and pushed)

**Actions:**

1. **Create and push test tag:**
   ```bash
   git tag v1.0.0-test
   git push origin v1.0.0-test
   ```

2. **Monitor the build:**
   - Go to Actions tab: https://github.com/jodrell2000/mrRobotoV3/actions
   - You should see "Build and Push Docker Image" workflow running
   - Click on the workflow run to see progress
   - Wait for it to complete (usually 2-5 minutes)

3. **Verify package was created:**
   - Go to Packages tab: https://github.com/jodrell2000/mrRobotoV3/packages
   - You should see `mrrobotov3` package (note: lowercase, no hyphens)
   - It will be marked as "Private"

4. **Make package public:**
   - Click on the `mrrobotov3` package
   - Click "Package settings" in the right sidebar
   - Scroll to "Danger Zone" → "Change package visibility"
   - Select "Public" and confirm
   - ⚠️ **Important:** Make sure you want this public before confirming

5. **Test pulling the image (now it should exist!):**
   ```bash
   docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.0-test
   ```
   **Note:** The Docker image tag is `1.0.0-test` (without `v`) even though the git tag was `v1.0.0-test`. The metadata action strips the `v` prefix.
   
   - This should succeed and download the image
   - You should see layers being pulled
   
   **If you still get "manifest unknown":**
   - The package is still private! Go back and complete step 4 (make it public)
   - OR, wrong tag - try without `v`: `docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.0-test`
   - OR, authenticate with: `echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u jodrell2000 --password-stdin`
   - To verify it's public: try pulling from a different computer or incognito browser

6. **Test running the bot:**
   ```bash
   docker run -v "$(pwd)/.env:/usr/src/app/.env" ghcr.io/jodrell2000/mrrobotov3:1.0.0-test
   ```
   **Note:** The `.env` file must be mounted into the container because the bot uses `dotenv` which reads from a file on disk.
   
   - Check logs to verify bot starts correctly
   - You should see `[dotenv@17.3.1] injecting env (X)` where X > 0
   - Press Ctrl+C to stop
   
   **Expected Warnings:**
   - **Platform warning** (Apple Silicon Macs): `WARNING: The requested image's platform (linux/amd64) does not match the detected host platform (linux/arm64/v8)` - This is normal and runs via emulation. See Phase 1 Step 1.4 for multi-architecture builds.

**Success Criteria:**
- ✅ GitHub Action completes successfully
- ✅ Package appears in Packages tab with correct tags
- ✅ Package visibility is set to Public
- ✅ Image can be pulled without authentication (test in incognito/different account)
- ✅ Image runs and bot connects successfully

**Note:** After setting to public, anyone can pull your image without authentication: `docker pull ghcr.io/jodrell2000/mrrobotov3:latest`

---

#### Step 1.4: Add Multi-Architecture Support (Optional - Recommended)
**Time:** 30 minutes  
**Dependencies:** Step 1.3 complete (workflow working)

**Objective:** Build images for both AMD64 (Intel) and ARM64 (Apple Silicon, Raspberry Pi) to eliminate platform warnings and improve performance.

**Why This Matters:**
- Apple Silicon Macs (M1/M2/M3) are ARM64 but current image is AMD64
- Results in "platform mismatch" warning and slower performance via emulation
- ARM64 native builds run ~20-30% faster on Apple Silicon
- Also enables Raspberry Pi support

**Implementation:**

Update `.github/workflows/build-and-push.yml` to use buildx for multi-platform:

```yaml
# Add these steps before "Build and push Docker image"
- name: Set up QEMU
  uses: docker/setup-qemu-action@v3

- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

# Then modify the build step:
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    context: .
    platforms: linux/amd64,linux/arm64  # Add this line
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    labels: ${{ steps.meta.outputs.labels }}
```

**Trade-offs:**
- ✅ Eliminates platform warnings
- ✅ Better performance on Apple Silicon and ARM devices
- ✅ Broader compatibility
- ❌ Builds take ~2-3 minutes longer (must compile for both architectures)
- ❌ Uses more GitHub Actions minutes (still free for public repos)

**Testing:**
```bash
# Create a test tag
git tag v1.0.1-multiarch
git push origin v1.0.1-multiarch

# Wait for build, then test on your platform
docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.1-multiarch

# Verify no platform warning
docker run --rm ghcr.io/jodrell2000/mrrobotov3:1.0.1-multiarch node --version
```

**Skip if:** You only have Intel/AMD users and don't need ARM support. Can always add later.

---

### Phase 2: Cloud Hosting Option (Google Cloud Run)

**Objective:** Provide optional free cloud hosting for users who want 24/7 operation

**Prerequisites from Phase 1:**
- ✅ Docker images published to GHCR
- ✅ Multi-architecture support working
- ✅ Images are public and pullable
- ✅ Test image available: `ghcr.io/jodrell2000/mrrobotov3:1.0.1-multiarch`

**Phase 2 Deliverables Overview:**
- [ ] **Step 2.1:** Complete cloud hosting guide (`docs/CLOUD_HOSTING.md`) - 3-4 hours
- [ ] **Step 2.2:** Create deployment automation script (`scripts/deploy-to-cloudrun.sh`) - 2-3 hours
- [ ] **Step 2.3:** Document alternative cloud platforms (Oracle, Fly.io, etc.) - 1 hour

**Estimated Total Time:** 6-8 hours

**What You'll Need:**
- Google Cloud account (free tier)
- Bot .env values ready for Secret Manager
- gcloud CLI installed (for testing deployment script)
- Access to bot for live testing on cloud

**Key Focus Areas:**
1. Step-by-step Google Cloud Run deployment guide with screenshots
2. Secret management via Google Secret Manager
3. Cost monitoring and free tier optimization
4. Deployment automation script for repeatable deployments
5. Comparison table of cloud platform options

---

#### Step 2.1: Create Cloud Hosting Guide
**Time:** 3-4 hours  
**Dependencies:** Phase 1 complete

**File to Create:** `docs/CLOUD_HOSTING.md`

**Content Outline:**
```markdown
# Cloud Hosting Guide (Optional - Advanced)

⚠️ **Note:** This is OPTIONAL. If you're happy running the bot on your computer, you can skip this entirely!

## Why Cloud Hosting?

- 24/7 operation (no need to keep your computer on)
- Access from anywhere
- Automatic scaling
- Free within Google Cloud's generous limits

## Prerequisites

- Access to pre-built Docker image at `ghcr.io/jodrell2000/mrrobotov3:latest`
- Google account (Gmail)
- Basic command line comfort (or willingness to learn!)
- Bot credentials (.env values ready)

---

## Option 1: Google Cloud Run (Recommended)

### Cost Estimate
Google Cloud Run free tier includes:
- 2 million requests per month
- 360,000 GB-seconds of compute time
- 180,000 vCPU-seconds

**For a typical bot:** Your bot will likely use ~50,000 GB-seconds per month, well within the free tier. You'll pay $0/month.

### Step 1: Create Google Cloud Account
1. Go to https://console.cloud.google.com
2. Sign in with Google account
3. Accept terms and enable free trial ($300 credit)
4. Create a new project: "mrroboto-bot"

### Step 2: Enable Required APIs
[Detailed steps with screenshots]

### Step 3: Set Up Secrets
[Guide for creating secrets in Secret Manager]

### Step 4: Deploy to Cloud Run
**Option A: Using gcloud CLI (Recommended)**
[Commands and explanations]

**Option B: Using Console UI**
[Step-by-step with screenshots]

### Step 5: Monitor and Manage
[How to view logs, check costs, scale]

---

## Option 2: Oracle Cloud Always Free

Oracle offers truly free-forever compute instances.

[Brief guide for Oracle Cloud]

---

## Option 3: Other Free Tiers

**Fly.io:**
- 3 x 256MB VMs free
- Your bot needs 512MB, so will need paid plan (~$3-5/month)

[Mention other options]

---

## Comparison Table

| Platform | Free Tier | Monthly Cost | Difficulty | 24/7 Support |
|----------|-----------|--------------|------------|--------------|
| Local Docker | N/A | $0 (your electricity) | Easy | Only when PC is on |
| Google Cloud Run | 2M requests | $0 (within limits) | Medium | Yes |
| Oracle Cloud | 1GB RAM ARM instance | $0 (forever) | Hard | Yes |
| Fly.io | 3x256MB | $3-5/month | Medium | Yes |

---

## Troubleshooting Cloud Deployments

[Common issues and solutions]

---

## Cost Monitoring

Want to make sure you stay in the free tier?

[Instructions for setting up billing alerts]
```

**Assets Needed:**
- Screenshots for each major Cloud Run step
- Example gcloud commands
- Cost calculator spreadsheet or tool

---

#### Step 2.2: Create Cloud Run Deployment Helper
**Time:** 2-3 hours  
**Dependencies:** Step 2.1

**File to Create:** `scripts/deploy-to-cloudrun.sh`

**Features:**
- Check for gcloud CLI installation
- Interactive prompts for project ID, region, service name
- Automatically imports secrets from local `.env` to Secret Manager
- Deploys service with proper configuration
- Sets up health checks
- Configures resource limits
- Shows deployment URL and status

**Pseudo-code:**
```bash
#!/usr/bin/env bash
# Deploy Mr. Roboto V3 to Google Cloud Run

# Check prerequisites (gcloud, docker)
# Authenticate if needed
# Prompt for project ID
# Prompt for region (default: us-central1)
# Create secrets in Secret Manager from .env
# Build and push image to GCR (or use GHCR)
# Deploy Cloud Run service with secrets
# Configure health checks and resources
# Display deployment URL and next steps
```

---

#### Step 2.3: Document Alternative Cloud Options
**Time:** 1 hour  
**Dependencies:** Step 2.1

Add sections to `CLOUD_HOSTING.md` for:
- Oracle Cloud Always Free setup
- Fly.io with cost notes
- Mention other options (Railway, Render) with current status

---

### Phase 3: Testing & Polish

**Objective:** Ensure everything works for non-technical users

#### Step 3.1: End-to-End Testing
**Time:** 2-3 hours  
**Dependencies:** All previous phases complete

**Testing Checklist:**

**Cloud Deployment Test:**
- [ ] Fresh machine test (or VM)
- [ ] Follow CLOUD_HOSTING.md from start
- [ ] Deploy to Cloud Run test instance
- [ ] Verify secrets are loaded correctly
- [ ] Test bot functionality in cloud
- [ ] Check CloudWatch logs
- [ ] Monitor cost in billing console (should be $0)
- [ ] Test service scaling
- [ ] Test multi-arch image on different platforms
- [ ] Verify secrets are loaded correctly
- [ ] Test bot functionality in cloud
- [ ] Check CloudWatch logs
- [ ] Monitor cost in billing console (should be $0)
- [ ] Test service scaling
- [ ] Test multi-arch image on different platforms

**Helper Scripts Test:**
- [ ] Test deploy-to-cloudrun.sh with valid inputs
- [ ] Test error handling for invalid inputs
- [ ] Verify secrets are properly created in Secret Manager

**Documentation Test:**
- [ ] All links work (no 404s)
- [ ] Code blocks are copy-pasteable
- [ ] Screenshots match current UI
- [ ] Commands work as written
- [ ] Try to break it (follow docs wrong on purpose)

**Multi-Architecture Test:**
- [ ] Pull image on macOS Apple Silicon (ARM64)
- [ ] Pull image on macOS Intel (AMD64)
- [ ] Pull image on Windows 11 (AMD64)
- [ ] Pull image on Ubuntu Linux (AMD64)
- [ ] Verify no platform warnings

---

#### Step 3.2: Documentation Review and Polish
**Time:** 2-3 hours  
**Dependencies:** Parallel with 3.1

**Tasks:**

1. **Add Visual Diagrams:**
   - Architecture diagram showing cloud deployment flow
   - Cloud architecture diagram for Cloud Run deployment
   - Multi-architecture build diagram

2. **Create Comparison Tables:**
   - Cloud platform options pros/cons (Google Cloud Run vs Oracle vs Fly.io)
   - Cost comparison across platforms
   - Feature comparison

3. **Add FAQ Section** (to CLOUD_HOSTING.md):
   ```markdown
   ## Frequently Asked Questions
   
   **Q: How much will this cost me?**
   A: Google Cloud Run has a generous free tier. Most bots stay within free limits.
   
   **Q: Can I run this on my own computer instead?**
   A: Yes, pull the Docker image and run it locally with docker run.
   
   **Q: How do I monitor my bot?**
   A: Use Cloud Run logs in the Google Cloud Console.
   
   [More FAQs]
   ```

4. **Proofread Everything:**
   - Remove technical jargon
   - Simplify complex sentences
   - Add analogies where helpful
   - Check for assumption of knowledge

5. **Add "Need Help?" Section:**
   ```markdown
   ## Need Help?
   
   Stuck? Don't worry!
   
   - 🐛 **Bug or Issue**: [Open an issue on GitHub](https://github.com/jodrell2000/mrRobotoV3/issues)
   - 💬 **Questions**: [Join our community] (if available)
   - 📖 **More Docs**: [All documentation](../docs/)
   - ✉️ **Contact**: [Maintainer contact if available]
   ```

---

#### Step 3.3: Update CHANGELOG
**Time:** 30 minutes  
**Dependencies:** All previous steps

**File to Modify:** `docs/CHANGELOG.md`

**Additions:**
```markdown
## [2.0.0] - TBD

### Added - Distribution Enhancements
- **Docker Image Distribution**: Pre-built images now available at `ghcr.io/jodrell2000/mrrobotov3`
- **Multi-Architecture Support**: Images for both AMD64 and ARM64 platforms
- **Cloud Hosting Guide**: Guide for deploying to Google Cloud Run (`docs/CLOUD_HOSTING.md`)
- **Cloud Deployment Script**: Automated Cloud Run deployment (`scripts/deploy-to-cloudrun.sh`)
- **GitHub Actions Workflow**: Automated multi-arch Docker image builds on git tags (`.github/workflows/build-and-push.yml`)

### Changed
- **README.md**: Updated with cloud deployment options
- **DOCKER_SETUP.md**: Now references pre-built images instead of local builds

### Documentation
- Added comparison tables for deployment options
- Added troubleshooting guides for common Docker issues
- Added cloud deployment architecture diagrams

### Notes
- This is a major version bump due to significant changes in deployment workflow
- Existing local development workflow remains unchanged
- Build-from-source still fully supported for developers
```

**Version Consideration:**
Since this significantly changes the deployment model and user experience, recommend bumping to v2.0.0 (major version change).

---

## Implementation Timeline

**Estimated Total Time:** 14-17 hours

**Suggested Schedule:**

**Week 1: Core Infrastructure & Cloud Setup**
- Day 1: Phase 1 (GHCR setup and automation) - 2 hours
- Day 2-4: Phase 2 (Cloud hosting guide and scripts) - 7 hours

**Week 2: Testing & Polish**
- Day 5-6: Phase 3 (Testing and polish) - 5 hours

**Accelerated Schedule:**
Can be completed in 1-2 full days if working continuously.

---

## Resource Requirements

**Skills Needed:**
- Bash scripting (for helper scripts)
- Docker knowledge (already have this)
- GitHub Actions basics (workflow syntax)
- Technical writing (documentation)
- Google Cloud basics (for cloud guide)

**Tools Needed:**
- GitHub account with repo access (have)
- Docker Desktop for testing (have)
- Google Cloud account for cloud testing (free tier)
- Screen capture tool for screenshots
- Markdown editor

**External Dependencies:**
- GitHub Container Registry (free, no setup needed)
- GitHub Actions (free for public repos)
- Google Cloud Run (free tier for testing)

---

## Success Metrics

**Quantitative:**
- [ ] Docker image published to GHCR
- [ ] GitHub Actions workflow passes on test tag
- [ ] Multi-architecture builds working (AMD64 + ARM64)
- [ ] Cloud hosting guide complete
- [ ] All tests pass on cloud deployment
- [ ] Zero broken links in documentation

**Qualitative:**
- [ ] Technical users can deploy to cloud without issues
- [ ] Documentation reads naturally (no jargon)
- [ ] Error messages are helpful and actionable
- [ ] Cloud deployment stays within free tier
- [ ] Existing developers aren't confused by changes

---

## Rollback Plan

If issues arise during implementation:

**Phase 1 Issues:**
- Can revert workflow file without affecting anything
- No user-facing changes yet

**Phase 2 Issues:**
- Cloud hosting is optional, can mark as "Coming Soon"
- Won't affect local deployment

**Critical Issues:**
- All existing functionality (clone and build) remains unchanged
- Users can continue using local dev setup
- Docker image distribution is additive feature

---

## Future Enhancements (Out of Scope)

**Post-v2.0.0 Considerations:**

1. **Multi-architecture images** (ARM64 + AMD64)
   - Would support Apple Silicon and Raspberry Pi
   - Requires GitHub Actions matrix builds
   - Approximately 2-3 hours additional work

2. **Video tutorials**
   - Screen recording of full setup process
   - 5-10 minute walkthrough
   - Hosted on YouTube or similar
   - 4-6 hours to produce

3. **Web-based .env configurator**
   - Simple web form for generating .env
   - Hosted on GitHub Pages
   - Download button for generated file
   - 8-10 hours development

4. **Helm chart for Kubernetes**
   - For advanced users wanting k8s deployment
   - Out of scope for simplicity goal
   - Can add if requested

5. **Pre-configured cloud templates**
   - Terraform/CloudFormation for one-click deploy
   - More complex than current scope
   - Consider for v2.1.0

6. **Monitoring dashboard setup**
   - Grafana + Prometheus integration
   - CloudWatch dashboard templates
   - Advanced feature for later

---

## Reference Materials

**Current Files (Reference During Implementation):**
- `Dockerfile` - Already production-ready, no changes needed
- `docker-compose.prod.yml` - Security hardening patterns to reference
- `docker-start-safe.sh` - .env parsing logic to adapt for helpers
- `docs/SETTING_UP_YOUR_ENVIRONMENT.md` - Required env vars documentation
- `.dockerignore` - Already properly configured for security
- `.env_example` - Template for users to copy

**External Documentation:**
- GitHub Container Registry: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- GitHub Actions Docker: https://docs.github.com/en/actions/publishing-packages/publishing-docker-images
- Google Cloud Run: https://cloud.google.com/run/docs
- Docker Best Practices: https://docs.docker.com/develop/dev-best-practices/

---

## Questions to Resolve During Implementation

1. **Image Versioning Strategy:**
   - Use semantic versioning for tags? (v1.0.0, v1.1.0, v2.0.0)
   - Keep `latest` for latest stable release?
   - Use `-beta` and `-alpha` suffixes for pre-releases?
   - **Recommendation:** Yes to all above

2. **Data Persistence Warning:**
   - For cloud hosting, should we add prominent warnings about SQLite limitations?
   - Recommend backup strategies?
   - **Recommendation:** Yes, add warning section in CLOUD_HOSTING.md

3. **Windows Support Level:**
   - Provide full PowerShell scripts, or just document WSL2/Git Bash workarounds?
   - **Recommendation:** Start with bash + WSL docs, add PowerShell if requested

4. **Secret Management UX:**
   - For cloud hosting, create web-based UI for secret entry instead of CLI?
   - **Recommendation:** CLI scripts for v2.0, web UI for v2.1 if popular

5. **Cost Monitoring:**
   - Add helper script to check Cloud Run usage and projected costs?
   - **Recommendation:** Add to CLOUD_HOSTING.md as manual steps, automate in v2.1

6. **Package Naming:** ✅ **RESOLVED**
   - GHCR automatically uses lowercase repository name
   - Image will be: `ghcr.io/jodrell2000/mrrobotov3` (no hyphens, all lowercase)
   - This cannot be changed - GHCR enforces lowercase conversion

---

## Getting Started with Implementation

**Immediate Next Steps:**

1. **Create Implementation Branch:**
   ```bash
   git checkout -b feature/docker-distribution
   ```

2. **Start with Phase 1, Step 1.1:**
   - Enable GHCR in GitHub repo settings
   - Takes 5 minutes, unblocks everything else

3. **Work in Parallel:**
   - One person can work on Phase 1 (GitHub Actions)
   - Another can work on Phase 2 (documentation)
   - Scripts can be developed independently

4. **Test Early and Often:**
   - Push workflow with test tag ASAP
   - Verify image builds before writing docs
   - Have someone follow docs draft to find issues

5. **Incremental Commits:**
   - Commit after each major step
   - Use descriptive commit messages
   - Push to branch regularly for backup

**First Commit Checklist:**
- [ ] Create feature branch
- [ ] Enable GHCR in repo settings
- [ ] Create `.github/workflows/build-and-push.yml`
- [ ] Test with tag push
- [ ] Verify image appears in Packages
- [ ] Document any issues encountered

---

## Contact & Questions

For questions during implementation:
- Review this plan first
- Check existing documentation referenced above
- Open a draft PR with questions in description
- Tag relevant maintainers for review

**Plan Author:** GitHub Copilot  
**Plan Date:** March 24, 2026  
**Plan Version:** 1.0  
**Repository:** https://github.com/jodrell2000/mrRobotoV3

---

## Appendix A: GitHub Actions Workflow Deep Dive

**Workflow Trigger Explanation:**
```yaml
on:
  push:
    tags:
      - 'v*.*.*'      # Matches: v1.0.0, v2.5.3, v10.2.45
      - 'v*.*.*-*'    # Matches: v1.0.0-test, v2.0.0-alpha.1
```

**Tag Examples:**
- ✅ `v1.0.0` → Triggers, creates Docker tags: `1.0.0`, `1.0`, `1`, `latest` (note: `v` stripped)
- ✅ `v2.3.1` → Triggers, creates Docker tags: `2.3.1`, `2.3`, `2`, `latest`
- ✅ `v1.0.0-test` → Triggers, creates Docker tag: `1.0.0-test` (no `latest`, `v` stripped)
- ❌ `1.0.0` → Doesn't trigger (missing `v` prefix)
- ❌ `release-1.0` → Doesn't trigger (wrong format)

**Important:** Git tags include `v` prefix (e.g., `v1.0.0`), but Docker image tags **do not** (e.g., `1.0.0`). The metadata action automatically strips the `v`.

**Example:**
```bash
git tag v1.0.0-test              # Git tag WITH v
git push origin v1.0.0-test
# Creates Docker image tag: 1.0.0-test (WITHOUT v)
docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.0-test  # Pull WITHOUT v
```

**Permissions Explanation:**
```yaml
permissions:
  contents: read      # Can read repository contents
  packages: write     # Can push to GHCR
```

**Metadata Action Outputs:**
The `docker/metadata-action` automatically generates:
- Version tags from git tag
- Build date labels
- Git commit SHA labels
- Source repository links

**Cost:** $0 (GitHub Actions free for public repos)

---

## Appendix B: Docker Run Command Explained

**Full Command Breakdown:**
```bash
docker run -d \
  --name mrroboto \
  -v "$(pwd)/.env:/usr/src/app/.env" \
  -v ./data:/usr/src/app/data \
  -v ./logs:/usr/src/app/logs \
  --restart unless-stopped \
  ghcr.io/jodrell2000/mrrobotov3:latest
```

**Each Flag:**
- `-d` = Detached mode (runs in background)
- `--name mrroboto` = Assign container name for easy reference
- `-v "$(pwd)/.env:/usr/src/app/.env"` = Mount .env file into container for dotenv library to read
- `-v ./data:/usr/src/app/data` = Mount local `./data` to container `/usr/src/app/data`
- `-v ./logs:/usr/src/app/logs` = Mount local `./logs` to container `/usr/src/app/logs`
- `--restart unless-stopped` = Auto-restart on failure (but not after manual stop)
- `ghcr.io/jodrell2000/mrrobotov3:latest` = Image to run

**Why `/usr/src/app`?**
The Dockerfile sets `WORKDIR /usr/src/app`, so all paths inside the container are relative to this directory. The bot's code expects to find `.env`, `data/`, and `logs/` in the working directory.

**Why no `--env-file`?**
Docker's `--env-file` flag interferes with the `dotenv` library. Use only the volume mount.

**Alternative: Using docker-compose:**
For more complex setups, users can still use docker-compose.yml:
```yaml
services:
  mrroboto:
    image: ghcr.io/jodrell2000/mrrobotov3:latest
    container_name: mrroboto
    volumes:
      - ./.env:/usr/src/app/.env
      - ./data:/usr/src/app/data
      - ./logs:/usr/src/app/logs
    restart: unless-stopped
```
**Note:** Do NOT use `env_file` in docker-compose - it conflicts with dotenv. Use only the volume mount.

Run with: `docker compose up -d`

---

## Appendix C: Environment Variable Reference

**Required Variables:**
```env
BOT_USER_TOKEN="eyJ..."           # JWT token from hang.fm
COMETCHAT_AUTH_TOKEN="xxx..."     # CometChat authentication
BOT_UID="uuid-here"               # Bot's unique identifier
HANGOUT_ID="uuid-here"            # Target hangout room ID
```

**Optional Variables:**
```env
COMMAND_SWITCH="/"                # Command prefix (default: /)
LOG_LEVEL="info"                  # Logging: off, info, debug (default: off)
SOCKET_MESSAGE_LOG_LEVEL="OFF"   # Socket logging (default: OFF)
googleAIKey="xxx..."              # For ML features (optional)
```

**Static Variables (Same for All Instances):**
```env
COMETCHAT_API_KEY="xxx..."        # Hardcoded in code
TTFM_GATEWAY_BASE_URL="..."       # Hardcoded in code
```

**Validation Rules:**
- `BOT_UID`: Must be valid UUID format
- `HANGOUT_ID`: Must be valid UUID format
- `BOT_USER_TOKEN`: Usually starts with "eyJ" (JWT format)
- `COMMAND_SWITCH`: Single character recommended
- `LOG_LEVEL`: Must be "off", "info", or "debug"

---

## Appendix D: Troubleshooting Common Issues

**Issue:** "Error response from daemon: manifest unknown" when pulling image
**Solution:**
- **Tag format mismatch**: Git tag is `v1.0.0` but Docker image tag is `1.0.0` (no `v` prefix)
  - The metadata action strips the `v` from git tags
  - Try: `docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.0` (without `v`)
- **Package is private**: Make it public in Package Settings → Change visibility to Public
- **Or authenticate** to pull private package:
  ```bash
  # Create GitHub Personal Access Token with read:packages scope at:
  # https://github.com/settings/tokens
  echo "YOUR_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
  docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.0
  ```

**Issue:** GitHub Action fails with "denied: permission_denied"
**Solution:** 
1. Go to repo Settings → Actions → General
2. Scroll to "Workflow permissions"
3. Select "Read and write permissions"
4. Save changes

**Issue:** Docker image pulls locally but fails in GitHub Action
**Solution:** Dockerfile likely has local dependencies. Check:
- All npm packages are in package.json
- No local file references outside context
- .dockerignore is properly configured

**Issue:** Bot starts but can't connect to hangout
**Solution:**
- Verify `BOT_USER_TOKEN` is correctly formatted (no extra quotes)
- Check `HANGOUT_ID` is correct UUID
- Ensure `BOT_UID` matches the bot account
- Check logs: `docker logs mrroboto`

**Issue:** `.env` file not being read / "injecting env (0)"
**Root Causes:**
1. `.env` file not mounted into container
2. Using `--env-file` flag which interferes with dotenv library

**Solution:** Use ONLY volume mount (no `--env-file`):
```bash
# Correct - volume mount only
docker run -d \
  --name mrroboto \
  -v "$(pwd)/.env:/usr/src/app/.env" \
  -v ./data:/usr/src/app/data \
  -v ./logs:/usr/src/app/logs \
  --restart unless-stopped \
  ghcr.io/jodrell2000/mrrobotov3:latest
```

**Why this works:**
The bot uses `dotenv` library which reads `.env` directly from the filesystem. Docker's `--env-file` flag interferes with this process.

**Additional checks:**
- Ensure file is named exactly `.env` (not `env.txt` or `.env.txt`)
- Check you're in the same directory as `.env`
- Verify mount path is `/usr/src/app/.env` (matches WORKDIR in Dockerfile)
- On Windows, ensure no hidden file extensions
- Verify the file has content: `cat .env` (should show your variables)

**Issue:** "Cannot find module" errors in container
**Solution:**
- Image may not have rebuilt with latest code
- Force rebuild: `docker pull ghcr.io/jodrell2000/mrrobotov3:latest --no-cache`
- Check if new dependencies were added but image not updated

**Issue:** Data or logs not persisting
**Solution:**
- Verify volume mounts: `docker inspect mrroboto | grep -A 5 Mounts`
- Check local folder permissions
- On Windows, ensure Docker Desktop has access to drive

---

## Appendix E: Security Checklist

**Before Publishing Images:**
- [ ] `.env` file is in `.dockerignore`
- [ ] No secrets in Dockerfile
- [ ] No secrets in source code
- [ ] GitHub Actions doesn't log secrets
- [ ] Image runs as non-root user (already configured)
- [ ] No unnecessary tools in image (curl, wget, etc.)

**For Users:**
- [ ] `.env` file kept private (gitignore)
- [ ] Tokens not shared in screenshots/logs
- [ ] Regular token rotation recommended
- [ ] Warning about not sharing `.env` in all docs

**Cloud Deployment:**
- [ ] Secrets stored in Secret Manager (not env vars)
- [ ] IAM permissions follow least privilege
- [ ] Cloud Run service not public (no --allow-unauthenticated)
- [ ] Network egress restrictions if needed

---

**END OF IMPLEMENTATION PLAN**

For questions or clarifications, refer to the plan sections above or consult the referenced documentation.
