# Docker Distribution Implementation Plan

**Project:** Mr. Roboto V3  
**Goal:** Enable hybrid distribution via GitHub Container Registry with local and cloud hosting options  
**Target Audience:** Non-technical users who want to easily run the bot  
**Status:** Planning Complete - Ready for Implementation

---

## Executive Summary

This plan transforms Mr. Roboto V3 from a "clone and build" project into a user-friendly distribution with pre-built Docker images. Users will be able to pull and run the bot with minimal setup, while advanced users can optionally deploy to free cloud hosting.

**Key Benefits:**
- ✅ No build tools required for end users
- ✅ Free image hosting via GitHub Container Registry
- ✅ Automated builds on git tags
- ✅ Simple 3-step Quick Start guide
- ✅ Optional free cloud hosting (Google Cloud Run)
- ✅ Interactive setup helpers for `.env` configuration

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
      - 'v*.*.*-*'      # Also supports pre-release tags (v1.0.0-beta, v1.0.0-alpha)

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
- Supports pre-release tags (v1.0.0-beta, v1.0.0-alpha)
- Uses built-in `GITHUB_TOKEN` (no manual secret configuration)
- Creates multiple tags: version, major.minor, major, and latest
- Adds metadata labels for better organization

**Testing Instructions:**
1. Commit and push the workflow file
2. Create a test tag: `git tag v1.0.0-test && git push origin v1.0.0-test`
3. Check Actions tab for workflow execution
4. Verify image appears in Packages tab
5. Test pull: `docker pull ghcr.io/jodrell2000/mrrobotov3:v1.0.0-test`
6. Delete test tag and image after verification

**Troubleshooting:**
- If push fails: Check package permissions in repo settings
- If tag doesn't trigger: Verify tag format matches `v*.*.*` pattern
- If authentication fails: Ensure Actions have package write permission

---

#### Step 1.3: Test Automation Workflow and Set Package to Public
**Time:** 15 minutes  
**Dependencies:** Step 1.2

**Actions:**
1. Create test git tag: `git tag v1.0.0-beta`
2. Push tag to GitHub: `git push origin v1.0.0-beta`
3. Monitor GitHub Actions tab for workflow run: https://github.com/jodrell2000/mrRobotoV3/actions
4. After workflow completes, go to Packages tab: https://github.com/jodrell2000/mrRobotoV3/packages
5. Click on the `mrrobotov3` package
6. Click "Package settings" in the right sidebar
7. Scroll to "Danger Zone" → "Change package visibility"
8. Select "Public" and confirm
9. Pull and test image locally:
   ```bash
   docker pull ghcr.io/jodrell2000/mrrobotov3:v1.0.0-beta
   docker run --env-file .env ghcr.io/jodrell2000/mrrobotov3:v1.0.0-beta
   ```

**Success Criteria:**
- ✅ GitHub Action completes successfully
- ✅ Package appears in Packages tab with correct tags
- ✅ Package visibility is set to Public
- ✅ Image can be pulled without authentication (test in incognito/different account)
- ✅ Image runs and bot connects successfully

**Note:** After setting to public, anyone can pull your image without authentication: `docker pull ghcr.io/jodrell2000/mrrobotov3:latest`

---

### Phase 2: Non-Techie Local Docker Documentation

**Objective:** Replace "clone and build" with simple "pull and run" for non-technical users

#### Step 2.1: Create Ultra-Simple Quick Start Guide
**Time:** 2-3 hours  
**Dependencies:** Phase 1 complete (step 1.3)

**File to Create:** `docs/QUICK_START.md`

**Content Structure:**

```markdown
# Quick Start Guide - Run Mr. Roboto V3 in 3 Steps! 🚀

No coding experience required! This guide will help you run Mr. Roboto V3 on your computer in just a few minutes.

## What You'll Need

- A computer (Windows, Mac, or Linux)
- 10 minutes of your time
- Your bot credentials (we'll tell you where to get these)

---

## Step 1: Install Docker Desktop

Docker lets you run applications in containers - think of it like a virtual box that contains everything the bot needs.

### Windows
1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/
2. Run the installer
3. Restart your computer when prompted
4. Open Docker Desktop and wait for it to start (you'll see a green icon)

### Mac
1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/
2. Open the .dmg file and drag Docker to Applications
3. Launch Docker from Applications folder
4. Wait for Docker to start (green icon in menu bar)

### Linux
Run these commands in terminal:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and log back in
```

**How to check if it's working:**
Open a terminal/command prompt and type:
```bash
docker --version
```
You should see something like "Docker version 24.x.x"

---

## Step 2: Set Up Your Bot Configuration

The bot needs some information to connect to your hangout. Don't worry - we'll walk you through it!

### Option A: Use the Interactive Helper (Easiest!)

**Mac/Linux:**
1. Download the setup helper: [setup-env.sh](../scripts/setup-env.sh)
2. Open terminal in the folder where you downloaded it
3. Run: `bash setup-env.sh`
4. Answer the questions - the script explains what each one means
5. Your `.env` file is ready!

**Windows:**
1. Download the setup helper: [setup-env.ps1](../scripts/setup-env.ps1)
2. Right-click and select "Run with PowerShell"
3. Answer the questions
4. Your `.env` file is ready!

### Option B: Create .env File Manually

1. Download the [.env_example](../.env_example) file
2. Rename it to `.env` (remove the `_example` part)
3. Open it in Notepad (Windows) or TextEdit (Mac)
4. Fill in these values:

```env
BOT_USER_TOKEN="your-bot-token-here"
COMETCHAT_AUTH_TOKEN="your-auth-token-here"
BOT_UID="your-bot-uuid-here"
HANGOUT_ID="your-hangout-uuid-here"
COMMAND_SWITCH="/"
LOG_LEVEL="info"
```

**Where do I get these values?**

See our detailed guide: [Setting Up Your Environment](SETTING_UP_YOUR_ENVIRONMENT.md)

Quick summary:
- `BOT_USER_TOKEN`: Your bot's authentication token from hang.fm
- `COMETCHAT_AUTH_TOKEN`: From CometChat dashboard
- `BOT_UID`: Your bot's unique ID (UUID format)
- `HANGOUT_ID`: The hangout room ID where bot will run
- `COMMAND_SWITCH`: The character that starts commands (usually `/`)
- `LOG_LEVEL`: How much detail in logs (info, debug, or off)

---

## Step 3: Run Your Bot! 🎉

Now the easy part - just one command!

### Mac/Linux
Open terminal and run:
```bash
docker run -d \
  --name mrroboto \
  --env-file .env \
  -v ./data:/app/data \
  -v ./logs:/app/logs \
  --restart unless-stopped \
  ghcr.io/jodrell2000/mrrobotov3:latest
```

### Windows (Command Prompt)
```cmd
docker run -d ^
  --name mrroboto ^
  --env-file .env ^
  -v %cd%\data:/app/data ^
  -v %cd%\logs:/app/logs ^
  --restart unless-stopped ^
  ghcr.io/jodrell2000/mrrobotov3:latest
```

### Windows (PowerShell)
```powershell
docker run -d `
  --name mrroboto `
  --env-file .env `
  -v ${PWD}\data:/app/data `
  -v ${PWD}\logs:/app/logs `
  --restart unless-stopped `
  ghcr.io/jodrell2000/mrrobotov3:latest
```

**What does this command do?**
- `-d`: Runs in background (detached mode)
- `--name mrroboto`: Names your container "mrroboto"
- `--env-file .env`: Loads your configuration
- `-v ./data:/app/data`: Saves bot data to your computer
- `-v ./logs:/app/logs`: Saves logs to your computer
- `--restart unless-stopped`: Auto-restart if it crashes
- `ghcr.io/jodrell2000/mrrobotov3:latest`: The bot image

---

## Managing Your Bot

### Check if it's running
```bash
docker ps
```
You should see "mrroboto" in the list.

### View bot logs
```bash
docker logs mrroboto
```

### View live logs (press Ctrl+C to stop)
```bash
docker logs -f mrroboto
```

### Stop the bot
```bash
docker stop mrroboto
```

### Start the bot again
```bash
docker start mrroboto
```

### Remove the bot completely
```bash
docker stop mrroboto
docker rm mrroboto
# Your data and logs are safe in ./data and ./logs folders
```

### Update to latest version
```bash
docker stop mrroboto
docker rm mrroboto
docker pull ghcr.io/jodrell2000/mrrobotov3:latest
# Then run the "docker run" command again from Step 3
```

---

## Troubleshooting

### "docker: command not found"
Docker isn't installed or isn't in your PATH. Go back to Step 1.

### "Cannot connect to the Docker daemon"
Docker Desktop isn't running. Start Docker Desktop and wait for the green icon.

### "Error response from daemon: Conflict. The container name '/mrroboto' is already in use"
A container with that name already exists. Either:
- Remove it: `docker rm mrroboto`
- Or use a different name: change `--name mrroboto` to `--name mrroboto2`

### Bot starts but immediately stops
Check the logs: `docker logs mrroboto`
Common issues:
- Missing or incorrect `.env` values
- Invalid BOT_USER_TOKEN format (check for extra quotes or spaces)
- Wrong HANGOUT_ID

### "No such file or directory: '.env'"
The `.env` file isn't in your current directory. Either:
- Make sure you're in the right folder: `pwd` (Mac/Linux) or `cd` (Windows)
- Use full path: `--env-file /full/path/to/.env`

### Bot doesn't respond to commands
- Check the `COMMAND_SWITCH` in your `.env` (should match what you type, usually `/`)
- Verify bot has proper permissions in the hangout
- Check logs for connection errors

---

## Need More Help?

- 📖 **Detailed Setup Guide**: [Setting Up Your Environment](SETTING_UP_YOUR_ENVIRONMENT.md)
- 🐛 **Report Issues**: https://github.com/jodrell2000/mrRobotoV3/issues
- 💬 **Community**: [Link to Discord/forum if available]
- 📚 **All Documentation**: [docs/](../docs/)

---

## Advanced: Run as a Service

Want the bot to start automatically when your computer boots?

### Linux (systemd)
Create `/etc/systemd/system/mrroboto.service`:
```ini
[Unit]
Description=Mr. Roboto V3 Bot
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/your/bot/folder
ExecStart=/usr/bin/docker start mrroboto
ExecStop=/usr/bin/docker stop mrroboto

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mrroboto
sudo systemctl start mrroboto
```

### Mac (launchd)
Create `~/Library/LaunchAgents/com.mrroboto.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.mrroboto</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/docker</string>
        <string>start</string>
        <string>mrroboto</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

Then:
```bash
launchctl load ~/Library/LaunchAgents/com.mrroboto.plist
```

### Windows (Task Scheduler)
1. Open Task Scheduler
2. Create Basic Task
3. Name: "Mr. Roboto Bot"
4. Trigger: "When the computer starts"
5. Action: "Start a program"
6. Program: `C:\Program Files\Docker\Docker\resources\bin\docker.exe`
7. Arguments: `start mrroboto`
8. Finish

---

**Congratulations!** Your bot is now running. Check your hangout to see it online! 🎊
```

**Additional Assets Needed:**
- Screenshots for each major step
- GIF/video showing the full process (optional but highly recommended)
- macOS and Windows specific screenshots

**Success Criteria:**
- Non-technical person can follow without getting stuck
- All commands are copy-pasteable
- Common errors are documented with solutions
- Links to detailed docs for advanced topics

---

#### Step 2.2: Create Interactive .env Setup Helper
**Time:** 2-3 hours  
**Dependencies:** None (can work in parallel with 2.1)

**File to Create:** `scripts/setup-env.sh`

**Features:**
- Interactive prompts for each environment variable
- Plain English explanations for each value
- Input validation (UUID format, non-empty strings)
- Handles special characters in tokens
- Creates properly formatted `.env` file
- Backup existing `.env` if present

**Pseudo-code Structure:**
```bash
#!/usr/bin/env bash
# Interactive .env setup for Mr. Roboto V3

# Welcome message
# Check if .env exists (offer to backup)
# Prompt for each variable with explanation:
#   - BOT_USER_TOKEN (explain what it is, where to get it)
#   - COMETCHAT_AUTH_TOKEN
#   - BOT_UID (validate UUID format)
#   - HANGOUT_ID (validate UUID format)
#   - COMMAND_SWITCH (default to "/")
#   - LOG_LEVEL (offer choices: off, info, debug)
#   - googleAIKey (optional, explain it's for ML features)
# Write to .env with proper quoting
# Test docker compose config parsing
# Success message with next steps
```

**Validation Examples:**
- UUID format: `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`
- Non-empty required fields
- Token format checking (eyJ... for JWT)

**Testing:**
- Run script and verify generated `.env`
- Test with various input (valid, invalid, special characters)
- Verify Docker can parse the generated file

---

#### Step 2.3: Create Windows PowerShell Helper (Optional)
**Time:** 1-2 hours  
**Dependencies:** Step 2.2 (adapt bash script)

**File to Create:** `scripts/setup-env.ps1`

Adapt the bash script logic to PowerShell for Windows users who don't have WSL/Git Bash.

---

#### Step 2.4: Update Main README.md
**Time:** 30 minutes  
**Dependencies:** Steps 2.1, 2.2

**Changes to Make:**

1. **Add prominent "Easy Setup" section at top** (before existing setup sections):
```markdown
## 🎉 Easy Setup (No Coding Required)

Want to run Mr. Roboto V3 without installing build tools? Use our pre-built Docker images!

### Quick Start (3 Steps)
1. Install Docker Desktop
2. Configure your bot (we have a helper!)
3. Run one command

**[👉 Follow the Quick Start Guide](docs/QUICK_START.md)**

**Docker Image:** `ghcr.io/jodrell2000/mrrobotov3:latest`

[![Docker Image](https://img.shields.io/badge/docker-ghcr.io-blue?logo=docker)](https://github.com/jodrell2000/mrRobotoV3/pkgs/container/mrrobotov3)
```

2. **Rename existing setup section** to "For Developers: Build from Source"

3. **Add deployment options section**:
```markdown
## 🌐 Deployment Options

- **Local Docker** (Recommended): Run on your computer - [Quick Start Guide](docs/QUICK_START.md)
- **Cloud Hosting** (Advanced): Deploy to Google Cloud Run for free 24/7 hosting - [Cloud Hosting Guide](docs/CLOUD_HOSTING.md)
- **From Source** (Developers): Build and customize - [Developer Setup](#for-developers-build-from-source)
```

**Success Criteria:**
- New users immediately see the easy path
- Existing source-building workflow still documented
- Clear distinction between user vs developer paths

---

### Phase 3: Cloud Hosting Option (Google Cloud Run)

**Objective:** Provide optional free cloud hosting for users who want 24/7 operation

#### Step 3.1: Create Cloud Hosting Guide
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

- Completed the [Quick Start](QUICK_START.md) and bot works locally
- Google account (Gmail)
- Basic command line comfort (or willingness to learn!)

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

#### Step 3.2: Create Cloud Run Deployment Helper
**Time:** 2-3 hours  
**Dependencies:** Step 3.1

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

#### Step 3.3: Document Alternative Cloud Options
**Time:** 1 hour  
**Dependencies:** Step 3.1

Add sections to `CLOUD_HOSTING.md` for:
- Oracle Cloud Always Free setup
- Fly.io with cost notes
- Mention other options (Railway, Render) with current status

---

### Phase 4: Testing & Polish

**Objective:** Ensure everything works for non-technical users

#### Step 4.1: End-to-End Testing
**Time:** 2-3 hours  
**Dependencies:** All previous phases complete

**Testing Checklist:**

**Local Deployment Test:**
- [ ] Fresh machine test (or VM)
- [ ] Follow QUICK_START.md exactly as written
- [ ] Run setup-env.sh and use generated .env
- [ ] Pull and run Docker image
- [ ] Verify bot connects to hangout
- [ ] Test basic bot commands
- [ ] Test bot restart
- [ ] Test bot update process

**Cloud Deployment Test:**
- [ ] Follow CLOUD_HOSTING.md from start
- [ ] Deploy to Cloud Run test instance
- [ ] Verify secrets are loaded correctly
- [ ] Test bot functionality in cloud
- [ ] Check CloudWatch logs
- [ ] Monitor cost in billing console (should be $0)
- [ ] Test service scaling

**Helper Scripts Test:**
- [ ] Test setup-env.sh on Mac
- [ ] Test setup-env.sh on Linux
- [ ] Test setup-env.ps1 on Windows (if created)
- [ ] Test deploy-to-cloudrun.sh with valid inputs
- [ ] Test error handling for invalid inputs

**Documentation Test:**
- [ ] All links work (no 404s)
- [ ] Code blocks are copy-pasteable
- [ ] Screenshots match current UI
- [ ] Commands work as written
- [ ] Try to break it (follow docs wrong on purpose)

**Cross-Platform Test:**
- [ ] macOS (Intel and Apple Silicon if possible)
- [ ] Windows 11
- [ ] Ubuntu Linux
- [ ] Docker Desktop on all platforms

---

#### Step 4.2: Documentation Review and Polish
**Time:** 2-3 hours  
**Dependencies:** Parallel with 4.1

**Tasks:**

1. **Add Visual Diagrams:**
   - Architecture diagram showing user → Docker → bot flow
   - Cloud architecture diagram for Cloud Run deployment
   - Decision tree: "Which deployment option is right for me?"

2. **Create Comparison Tables:**
   - Local vs Cloud hosting pros/cons
   - Cost comparison
   - Difficulty comparison

3. **Add FAQ Section** (to QUICK_START.md):
   ```markdown
   ## Frequently Asked Questions
   
   **Q: Do I need to keep Docker Desktop open?**
   A: No, once the bot is running, Docker runs in the background.
   
   **Q: Will this slow down my computer?**
   A: The bot uses very little resources (256MB RAM). You won't notice it.
   
   **Q: How do I update the bot?**
   A: [Update instructions]
   
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

#### Step 4.3: Update CHANGELOG
**Time:** 30 minutes  
**Dependencies:** All previous steps

**File to Modify:** `docs/CHANGELOG.md`

**Additions:**
```markdown
## [2.0.0] - TBD

### Added - Distribution Enhancements
- **Docker Image Distribution**: Pre-built images now available at `ghcr.io/jodrell2000/mrrobotov3`
- **Quick Start Guide**: New non-technical user guide for running bot with Docker (`docs/QUICK_START.md`)
- **Cloud Hosting Guide**: Optional guide for deploying to Google Cloud Run (`docs/CLOUD_HOSTING.md`)
- **Setup Helper Script**: Interactive `.env` configuration tool (`scripts/setup-env.sh`)
- **Cloud Deployment Script**: Automated Cloud Run deployment (`scripts/deploy-to-cloudrun.sh`)
- **GitHub Actions Workflow**: Automated Docker image builds on git tags (`.github/workflows/build-and-push.yml`)

### Changed
- **README.md**: Updated with Quick Start section and deployment options
- **DOCKER_SETUP.md**: Now references pre-built images instead of local builds

### Documentation
- Added comparison tables for deployment options
- Added troubleshooting guides for common Docker issues
- Added FAQ sections to Quick Start guide
- Added visual architecture diagrams

### Notes
- This is a major version bump due to significant changes in deployment workflow
- Existing local development workflow remains unchanged
- Build-from-source still fully supported for developers
```

**Version Consideration:**
Since this significantly changes the deployment model and user experience, recommend bumping to v2.0.0 (major version change).

---

## Implementation Timeline

**Estimated Total Time:** 20-25 hours

**Suggested Schedule:**

**Week 1: Core Infrastructure**
- Day 1: Phase 1 (GHCR setup and automation) - 2 hours
- Day 2-3: Phase 2.1-2.2 (Quick Start guide and setup helpers) - 6 hours
- Day 4: Phase 2.3-2.4 (README updates) - 2 hours

**Week 2: Cloud & Polish**
- Day 5-6: Phase 3.1-3.2 (Cloud hosting guide and scripts) - 6 hours
- Day 7: Phase 3.3 (Alternative cloud options) - 1 hour
- Day 8-9: Phase 4 (Testing and polish) - 5 hours

**Accelerated Schedule:**
Can be completed in 2-3 full days if working continuously.

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
- [ ] Quick Start guide under 500 words for main steps
- [ ] Setup helper script under 200 lines
- [ ] All tests pass on 3+ platforms
- [ ] Zero broken links in documentation

**Qualitative:**
- [ ] Non-technical person can complete Quick Start without help
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
- Documentation is additive, existing setup still works
- Can mark Quick Start as "Beta" until stable

**Phase 3 Issues:**
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
      - 'v*.*.*-*'    # Matches: v1.0.0-beta, v2.0.0-alpha.1
```

**Tag Examples:**
- ✅ `v1.0.0` → Triggers, creates tags: `1.0.0`, `1.0`, `1`, `latest`
- ✅ `v2.3.1` → Triggers, creates tags: `2.3.1`, `2.3`, `2`, `latest`
- ✅ `v1.0.0-beta` → Triggers, creates tag: `1.0.0-beta` (no `latest`)
- ❌ `1.0.0` → Doesn't trigger (missing `v` prefix)
- ❌ `release-1.0` → Doesn't trigger (wrong format)

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
  --env-file .env \
  -v ./data:/app/data \
  -v ./logs:/app/logs \
  --restart unless-stopped \
  ghcr.io/jodrell2000/mrrobotov3:latest
```

**Each Flag:**
- `-d` = Detached mode (runs in background)
- `--name mrroboto` = Assign container name for easy reference
- `--env-file .env` = Load environment variables from file
- `-v ./data:/app/data` = Mount local `./data` to container `/app/data`
- `-v ./logs:/app/logs` = Mount local `./logs` to container `/app/logs`
- `--restart unless-stopped` = Auto-restart on failure (but not after manual stop)
- `ghcr.io/jodrell2000/mrrobotov3:latest` = Image to run

**Alternative: Using docker-compose:**
For more complex setups, users can still use docker-compose.yml:
```yaml
services:
  mrroboto:
    image: ghcr.io/jodrell2000/mrrobotov3:latest
    container_name: mrroboto
    env_file: .env
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
```

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

**Issue:** `.env` file not being read
**Solution:**
- Ensure file is named exactly `.env` (not `env.txt` or `.env.txt`)
- Check you're in the same directory as `.env`
- Use absolute path: `--env-file /full/path/to/.env`
- On Windows, ensure no hidden file extensions

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
