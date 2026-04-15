# Cloud Hosting Guide

> **This is optional.** If you're happy running the bot on your local machine, you can skip this entirely.

Running Mr. Roboto V3 on cloud infrastructure gives you 24/7 bot availability without keeping your computer on. This guide covers Google Cloud Run as the primary option, with alternatives included for comparison.

---

## Table of Contents

- [Why Cloud Hosting?](#why-cloud-hosting)
- [Prerequisites](#prerequisites)
- [Option 1: Google Cloud Run](#option-1-google-cloud-run-recommended)
- [Option 2: Oracle Cloud Always Free](#option-2-oracle-cloud-always-free)
- [Option 3: Other Platforms](#option-3-other-platforms)
- [Platform Comparison](#platform-comparison)
- [Troubleshooting](#troubleshooting)
- [Cost Monitoring](#cost-monitoring)

---

## Why Cloud Hosting?

| Feature | Local Docker | Cloud Hosting |
|---------|-------------|---------------|
| 24/7 availability | Only when PC is on | Always |
| Cost | $0 (electricity) | $0 (free tier) |
| Setup complexity | Easy | Medium |
| Maintenance | Manual | Manual |

---

## Prerequisites

Before starting, you need:

- A fully configured `.env` file with your bot credentials (see [Setting Up Your Environment](SETTING_UP_YOUR_ENVIRONMENT.md))
- A Google account (Gmail works)
- Basic comfort with terminal commands

You do **not** need Docker installed locally — the pre-built images are already published on GitHub Container Registry.

---

## Option 1: Google Cloud Run (Recommended)

Google Cloud Run is a managed container platform that runs your bot as a persistent process.

### Cost Breakdown

Google Cloud Run free tier (per month):

| Resource | Free Tier | Bot Usage | Cost |
|----------|-----------|-----------|------|
| Compute (GB-seconds) | 360,000 | ~15,000–50,000 | $0 |
| Requests | 2,000,000 | Minimal (bot is outbound) | $0 |
| CPU (vCPU-seconds) | 180,000 | ~30,000–90,000 | $0 |
| Storage (GCS) | 5 GB | < 1 GB | $0 |
| Storage Operations | 5,000 writes/month | ~730 writes/month | $0 |

**Expected monthly cost: $0**

> **Note:** The bot uses plain environment variables (not Secret Manager) to avoid storage costs. Your credentials are still protected by Google Cloud's IAM access controls.

> Set up a billing alert (see [Cost Monitoring](#cost-monitoring)) as a safety net against unexpected charges.

---

### Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with your Google account
3. Click **Select a project** → **New Project**
4. Name it: `mrroboto-bot` (or any name you prefer)
5. Note your **Project ID** — it appears below the project name and may differ from the name

---

### Step 2: Install the gcloud CLI

**macOS (Homebrew):**
```bash
brew install --cask google-cloud-sdk
```

**macOS / Linux (direct install):**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Windows:**
Download and run the installer from [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)

**Verify:**
```bash
gcloud --version
```

---

### Step 3: Authenticate and Set Your Project

```bash
# Log in to your Google account
gcloud auth login

# Set your project (replace YOUR_PROJECT_ID with your actual project ID)
gcloud config set project YOUR_PROJECT_ID

# Verify
gcloud config get project
```

---

### Step 4: Link a Billing Account

Google Cloud requires a billing account to enable APIs — even if you never pay anything. The free tier covers this bot's usage.

1. Go to [console.cloud.google.com/billing](https://console.cloud.google.com/billing)
2. Click **Add billing account** (or **Manage billing accounts** → **Create account**)
3. Follow the prompts — you'll need to enter a credit card, but you will **not** be charged while within the free tier
4. Once created, go to [console.cloud.google.com/billing/projects](https://console.cloud.google.com/billing/projects)
5. Find your project (`mrroboto-bot` or whatever you named it), click the three-dot menu → **Change billing**
6. Select your new billing account and confirm

Alternatively, link it via the CLI:

```bash
# List your billing accounts
gcloud billing accounts list

# Link your project (replace BILLING_ACCOUNT_ID with the ID from the list above, e.g. 01ABCD-123456-789EFG)
gcloud billing projects link $(gcloud config get project) \
  --billing-account BILLING_ACCOUNT_ID
```

> **No surprise charges:** Set up a billing alert in [Cost Monitoring](#cost-monitoring) after deployment to get notified if usage ever approaches $1.

---

### Step 5: Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com
```

This takes about 1–2 minutes.

---

### Step 5a: Set Up Cloud Storage for Data Persistence (Optional but Recommended)

Cloud Run is **stateless** — any changes to files are lost when the container restarts. To persist your bot's data (database, configuration changes, etc.), you need to set up Google Cloud Storage.

#### Why You Need This

Without Cloud Storage:
- ❌ Song history database (`mrroboto.db`) is lost on restart
- ❌ Configuration changes made via commands are lost on restart
- ❌ No backup of your bot's data

With Cloud Storage:
- ✅ Automatic daily backups at 3 AM
- ✅ Data synced to cloud on bot startup
- ✅ Manual sync script available for local development
- ✅ All within Google Cloud's free tier (5GB storage, 5000 operations/month)

#### Create a GCS Bucket

```bash
# Create a bucket in the same region as your Cloud Run service
# Replace 'your-project-id' with your actual project ID
gcloud storage buckets create gs://mrroboto-data-YOUR_PROJECT_ID \
  --location=europe-west1 \
  --uniform-bucket-level-access
```

> **Bucket naming:** Bucket names must be globally unique across all of Google Cloud. We recommend using `mrroboto-data-YOUR_PROJECT_ID` to ensure uniqueness.

#### Add GCS Bucket to Your Environment

Edit your `.env` file and add the bucket name:

```bash
# Add this line to your .env file
GCS_BUCKET_NAME=mrroboto-data-YOUR_PROJECT_ID
```

Replace `YOUR_PROJECT_ID` with your actual bucket name from the previous step.

#### Verify the Bucket Exists

```bash
# List your buckets
gcloud storage buckets list

# Test access to your bucket
gcloud storage ls --buckets gs://mrroboto-data-YOUR_PROJECT_ID
```

You should see your bucket listed with no errors.

#### How Data Sync Works

1. **On bot startup:** Downloads latest data from GCS (if available)
2. **Daily at 3 AM:** Automatically backs up all data files to GCS
3. **Manual sync:** Run `./scripts/sync-cloud-data.sh` to trigger sync and download

All sync operations are logged and visible in your Cloud Run logs.

> **Cost:** Daily backups generate ~730 write operations per month, well within the 5,000 free tier limit.

---

### Step 6: Deploy Using the Helper Script

The quickest path is the included deployment script. Run from your `mrRobotoV3` directory:

```bash
bash scripts/deploy-to-cloudrun.sh
```

The script will:
1. Validate prerequisites
2. Prompt for your project ID, region, and service name
3. Parse your `.env` file and prepare environment variables
4. Deploy the bot to Cloud Run with all environment variables injected
5. Display useful management commands when done

**Optional: Upload local data before deployment**

If you have local data (database, configuration changes) that you want to upload to GCS before deploying:

```bash
bash scripts/deploy-to-cloudrun.sh --upload-data
```

This will:
- Upload your entire `./data` directory to GCS before deployment
- Ensure the deployed bot starts with your latest local data
- Useful when you've made local changes and want them immediately available in production

> **Note:** The `--upload-data` flag requires `GCS_BUCKET_NAME` to be set in your `.env` file. If not configured, the upload will be skipped with a warning.

---

### Step 6 (Manual): Deploy Without the Script

If you prefer to deploy manually or the script fails, follow these steps.

#### 6a. Set Your Environment Variables

You'll need to format your `.env` values as a comma-separated string. Here's an example:

```bash
# Example format (replace with your actual values)
# Include GCS_BUCKET_NAME if you set up Cloud Storage in Step 5a
ENV_STRING="BOT_USER_TOKEN=your_token_here,COMETCHAT_AUTH_TOKEN=your_auth_token,BOT_UID=your_bot_uid,HANGOUT_ID=your_hangout_id,NODE_ENV=production,TTFM_GATEWAY_BASE_URL=https://gateway.prod.tt.fm,COMETCHAT_API_KEY=193427bb5702bab7,COMMAND_SWITCH=/,LOG_LEVEL=info,GCS_BUCKET_NAME=mrroboto-data-YOUR_PROJECT_ID"
```

#### 6b. Deploy to Cloud Run

```bash
gcloud run deploy mrroboto \
  --image ghcr.io/jodrell2000/mrrobotov3:latest \
  --platform managed \
  --region europe-west1 \
  --min-instances 1 \
  --max-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --no-cpu-throttling \
  --no-allow-unauthenticated \
  --set-env-vars "$ENV_STRING"
```

> **Important:** Replace `$ENV_STRING` with your actual comma-separated environment variables from step 6a.

> **Why `--min-instances 1`?** Mr. Roboto V3 maintains a persistent WebSocket connection — it must always be running to receive events. Without `--min-instances 1`, Cloud Run scales to zero when idle and your bot will miss messages.

> **Why `--no-cpu-throttling`?** This keeps CPU allocated to the container at all times, ensuring the WebSocket connection stays active.

---

### Step 7: Verify the Deployment

```bash
# Check service status
gcloud run services describe mrroboto --region europe-west1

# Stream live logs
gcloud beta logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=mrroboto"

# Or read recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mrroboto" --limit 50
```

In the logs you should see the bot startup messages and connection to your hangout.

> **Note on health checks:** Cloud Run expects an HTTP service on the container port. Mr. Roboto V3 is a WebSocket client with no HTTP server, so Cloud Run may report the service as having no traffic endpoint. This is expected — the bot runs continuously via `--min-instances 1` regardless of HTTP health check status.

---

### Step 8: Manage the Service

**View logs:**
```bash
# Stream live logs
gcloud beta logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=mrroboto"

# Or read recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mrroboto" --limit 50
```

**Stop the bot (scale to zero):**
```bash
gcloud run services update mrroboto --region europe-west1 --min-instances 0 --max-instances 1
```

**Restart / update to latest image:**
```bash
gcloud run services update mrroboto --region europe-west1 \
  --image ghcr.io/jodrell2000/mrrobotov3:latest
```

**Update a credential (e.g. if your token changes):**
```bash
# Update your .env file with the new value
nano .env

# Redeploy with updated environment variables
bash scripts/deploy-to-cloudrun.sh

# Or update manually with the new env var string
gcloud run services update mrroboto --region europe-west1 \
  --set-env-vars "BOT_USER_TOKEN=new-token-value,...other-vars..."
```

**Delete the service:**
```bash
gcloud run services delete mrroboto --region europe-west1
```

**Sync and download cloud data (if you configured GCS in Step 5a):**
```bash
# Trigger sync and download all data from cloud to local
./scripts/sync-cloud-data.sh
```

This script will:
1. Optionally trigger a cloud sync from the running bot
2. Create a timestamped backup of your local data directory
3. Download all files from GCS to your local data directory

Use this to:
- Backup cloud data before making changes
- Download latest data for local testing
- Restore data after a fresh deployment

---

### Limitations of Cloud Run for This Bot

| Limitation | Impact | Workaround |
|-----------|--------|------------|
| No persistent volumes | SQLite history data lost on restart | Set up GCS bucket (Step 5a) for automatic backups |
| Default bot config baked into image | Cannot change bot name / appearance without rebuilding | Fork the repo, modify `data/botConfig.json`, push a custom tag |
| Health checks show "no traffic" | Service shows as unhealthy in console | Normal — bot runs correctly via `--min-instances 1` |

---

## Option 2: Oracle Cloud Always Free

Oracle Cloud offers **truly free-forever** virtual machines — unlike Google's credit-based free tier, these never expire.

### Free Tier Details

- 2 × AMD micro instances (1/8 OCPU, 1GB RAM each)
- 4 × ARM cores + 24GB RAM (flexible Always Free instances)
- No expiry on Always Free resources

The AMD micro instance (1GB RAM) is sufficient for the bot.

### Step-by-Step Setup

#### Step 1: Create Oracle Cloud Account (15-30 minutes)

1. Go to [oracle.com/cloud/free](https://oracle.com/cloud/free)
2. Click **Start for free**
3. Fill in account details:
   - **Country/Territory**: Your location
   - **Email**: Valid email address
   - **First and Last Name**: Real name (verified against card)
   - Click **Verify my email**

4. Check your email and click the verification link

5. Complete the signup form:
   - **Account Name**: Choose a unique name (e.g., `mrroboto-bot`)
   - **Home Region**: Choose closest region (e.g., UK South / London, US East / Ashburn)
   - ⚠️ **Cannot change region after signup**
   - **Address**: Must match credit card billing address
   - **Phone**: Valid phone number for verification

6. Add payment verification:
   - Enter credit card details
   - Oracle will authorize $1-2 then immediately refund it
   - ⚠️ **You will NOT be charged** for Always Free resources
   - This is identity verification only

7. Review and accept terms
8. Click **Start my free trial**

9. Wait for account approval:
   - Usually instant, but can take up to 24 hours
   - Check email for "Your Oracle Cloud account is ready"

> **Tip:** If signup fails with "Unable to process your request", try:
> - Different browser (Chrome/Firefox)
> - Incognito/private mode
> - Different email address
> - Contact Oracle support via chat

---

#### Step 2: Access Oracle Cloud Console (2 minutes)

1. Go to [cloud.oracle.com](https://cloud.oracle.com)
2. Click **Sign in to Cloud**
3. Enter your **Cloud Account Name** from Step 1
4. Click **Next**
5. Sign in with your email and password
6. You'll land on the Oracle Cloud Dashboard

---

#### Step 3: Create a Compute Instance (10 minutes)

1. From the dashboard, click the **≡** menu (top left)
2. Navigate: **Compute** → **Instances**
3. Ensure you're in **root compartment** (dropdown at top)
4. Click **Create Instance**

**Instance Configuration:**

**Name:**
```
mrroboto-bot
```

**Placement:**
- **Compartment**: Leave as root
- **Availability Domain**: Select any (usually only 1 available)

**Image and Shape:**
1. Click **Change Shape**
2. Select **Specialty and previous generation**
3. Choose **VM.Standard.E2.1.Micro** (Always Free eligible)
   - 1/8 OCPU, 1 GB Memory
   - Look for the "Always Free Eligible" tag
4. Click **Select Shape**

5. Click **Change Image**
6. Select **Ubuntu**
7. Choose **Canonical Ubuntu 22.04**
8. Click **Select Image**

**Networking:**
- **Virtual cloud network**: Leave as "Create new virtual cloud network"
- **Subnet**: Leave as "Create new public subnet"
- **Public IP**: Select **Assign a public IPv4 address**

**Add SSH Keys:**

**Option A: Generate new key pair (Recommended)**
1. Select **Generate a key pair for me**
2. Click **Save Private Key**
3. Save file as `oracle-mrroboto.key` in a secure location
4. Click **Save Public Key** (optional, for reference)

**Option B: Use existing SSH key**
1. Select **Upload public key files (.pub)**
2. Browse and select your existing `~/.ssh/id_rsa.pub`

**Boot Volume:**
- Leave default (50 GB) - plenty for bot

5. Click **Create** (bottom of page)

**Wait for provisioning:**
- Status: Provisioning → Running (takes 2-3 minutes)
- Once **Running**, note the **Public IP Address** (e.g., 144.24.xxx.xxx)

---

#### Step 4: Configure Firewall (Optional but Recommended)

By default, Oracle blocks most incoming traffic. For SSH access:

1. On your instance page, under **Instance Details**
2. Click the **Virtual Cloud Network** link (e.g., vcn-xxx)
3. Click the **Security Lists** link
4. Click **Default Security List**
5. Verify **Ingress Rule** for SSH exists:
   - Source: 0.0.0.0/0
   - Protocol: TCP
   - Port: 22
6. This should already exist; if not, click **Add Ingress Rules** and add it

> **Note:** The bot doesn't need any incoming connections, so no additional firewall rules needed.

---

#### Step 5: Connect via SSH (5 minutes)

**macOS / Linux:**

```bash
# Set correct permissions on private key
chmod 400 ~/Downloads/oracle-mrroboto.key

# Connect to instance (replace with your public IP)
ssh -i ~/Downloads/oracle-mrroboto.key ubuntu@YOUR_PUBLIC_IP
```

**Windows:**

Using PowerShell:
```powershell
# Connect (right-click to paste public IP)
ssh -i C:\Users\YourName\Downloads\oracle-mrroboto.key ubuntu@YOUR_PUBLIC_IP
```

Or use [PuTTY](https://www.putty.org/) with the private key converted to .ppk format.

**First connection:**
- Answer `yes` to "Are you sure you want to continue connecting?"
- You should see Ubuntu welcome message

---

#### Step 6: Install Docker (5 minutes)

Run these commands on the Oracle VM:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Verify installation
docker --version

# Log out and back in for group changes to take effect
exit
```

**Reconnect via SSH:**
```bash
ssh -i ~/Downloads/oracle-mrroboto.key ubuntu@YOUR_PUBLIC_IP
```

**Test Docker:**
```bash
docker ps
# Should show empty table, not permission error
```

---

#### Step 7: Prepare Environment (5 minutes)

**Create directory for bot:**
```bash
mkdir -p ~/mrroboto
cd ~/mrroboto
```

**Create .env file:**
```bash
nano .env
```

**Paste your .env contents** (from local development):
- Press `Ctrl+Shift+V` to paste
- **Remove or comment out** `GCS_BUCKET_NAME` line (not needed on Oracle)
- Example:

```bash
TTFM_GATEWAY_BASE_URL="https://gateway.prod.tt.fm"
COMETCHAT_API_KEY=193427bb5702bab7
COMETCHAT_AUTH_TOKEN=your-token-here
BOT_UID=your-bot-uid
BOT_USER_TOKEN=your-bot-token
HANGOUT_ID=your-hangout-id
COMMAND_SWITCH="!"
COMETCHAT_RECEIVER_UID=your-receiver-uid
googleAIKey=your-google-ai-key
groqAPIKey=your-groq-key

# Remove this line on Oracle:
# GCS_BUCKET_NAME=mrroboto-data-gen-lang-client-0526975492
```

**Save and exit:**
- Press `Ctrl+X`
- Press `Y` to confirm
- Press `Enter` to save

**Verify file:**
```bash
cat .env
# Check all values are correct
```

---

#### Step 8: Deploy the Bot (5 minutes)

**Pull the Docker image:**
```bash
docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.0-test
```

**Run the bot:**
```bash
docker run -d \
  --name mrroboto \
  --restart unless-stopped \
  --env-file .env \
  -v ~/mrroboto/data:/usr/src/app/data \
  ghcr.io/jodrell2000/mrrobotov3:1.0.0-test
```

**Explanation:**
- `-d`: Run in background
- `--name mrroboto`: Container name
- `--restart unless-stopped`: Auto-restart on VM reboot
- `--env-file .env`: Load environment variables
- `-v ~/mrroboto/data:/usr/src/app/data`: Persist data on VM

**Check bot is running:**
```bash
docker ps
# Should show mrroboto container running

docker logs -f mrroboto
# Watch live logs (Ctrl+C to exit)
```

**Look for successful startup:**
```
✅ Bot instance created
✅ SocketClient created
Connected to hangout
```

---

#### Step 9: Verify Bot in Hangout (2 minutes)

1. Go to your tt.fm hangout
2. Bot should be present in the room
3. Test with a command: `!ping`
4. Bot should respond

---

### Managing Your Oracle Cloud Bot

**View logs:**
```bash
docker logs -f mrroboto
```

**Restart bot:**
```bash
docker restart mrroboto
```

**Stop bot:**
```bash
docker stop mrroboto
```

**Update to new version:**
```bash
# Pull latest image
docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.0-test

# Stop and remove old container
docker stop mrroboto && docker rm mrroboto

# Run new version (same command as Step 8)
docker run -d \
  --name mrroboto \
  --restart unless-stopped \
  --env-file .env \
  -v ~/mrroboto/data:/usr/src/app/data \
  ghcr.io/jodrell2000/mrrobotov3:1.0.0-test
```

**Backup data from VM to local:**
```bash
# On your local machine
scp -i ~/Downloads/oracle-mrroboto.key -r ubuntu@YOUR_PUBLIC_IP:~/mrroboto/data ./backup-data
```

**Upload data from local to VM:**
```bash
# On your local machine
scp -i ~/Downloads/oracle-mrroboto.key -r ./data ubuntu@YOUR_PUBLIC_IP:~/mrroboto/
```

**Check VM resources:**
```bash
# Disk space
df -h

# Memory usage
free -h

# Running processes
top
# Press 'q' to exit
```

**Update Ubuntu (monthly maintenance):**
```bash
sudo apt update && sudo apt upgrade -y
```

---

### Oracle Cloud vs Google Cloud Run

| Feature | Oracle Cloud | Google Cloud Run |
|---------|-------------|------------------|
| Monthly Cost | £0 forever | £0.50-0.70/month |
| Setup Time | 30-60 minutes | 5-10 minutes |
| Management | SSH + Docker commands | gcloud CLI |
| Auto-restart | Yes (Docker) | Yes (managed) |
| Logs | `docker logs` | Cloud Console + CLI |
| Updates | Manual docker pull | Automatic on redeploy |
| Data Persistence | VM disk (persistent) | GCS required |
| Scaling | Fixed 1GB RAM | Can adjust on demand |
| Expires | Never | Never (within free tier) |

> **Note:** Oracle Cloud signup requires credit card verification but will not charge for Always Free resources.

---

## Option 3: Other Platforms

### Fly.io

- **Free machines:** 3 × 256MB VMs — too small for this bot (needs 512MB)
- **Paid:** ~$3–5/month for a 512MB machine
- Simple CLI deployment: `flyctl deploy`

### Railway

- **Free tier:** $5 credit/month — may cover light bot usage
- **Paid:** Starting at $5/month
- Pros: Easy GitHub integration, built-in metrics

### Render

- **Free tier:** Web services spin down after 15 minutes of inactivity — not suitable for a persistent bot
- **Paid:** Starting at $7/month for persistent services

---

## Platform Comparison

| Platform | Monthly Cost | Expires? | Setup Difficulty | Persistent? |
|----------|-------------|----------|-----------------|------------|
| Local Docker | $0 | Never | Easy | Only when PC is on |
| Google Cloud Run | $0 (within free tier) | No | Medium | Yes (with min-instances=1) |
| Oracle Cloud | $0 | Never | Hard | Yes |
| Fly.io | ~$3–5 | N/A | Medium | Yes |
| Railway | $0–5 credit | Monthly | Easy | Yes |
| Render | $7+ | N/A | Easy | Yes (paid only) |

**Recommendation:** Start with **Google Cloud Run** for the easiest path to cloud hosting. Switch to **Oracle Cloud** if you want a guaranteed free-forever option and are comfortable managing a Linux VM.

---

## Troubleshooting

### Cleaning Up Old Secret Manager Resources

If you previously deployed with Secret Manager enabled and want to remove the storage costs:

```bash
# List all secrets
gcloud secrets list

# Delete individual secrets (replace with your secret names)
gcloud secrets delete BOT_USER_TOKEN --quiet
gcloud secrets delete COMETCHAT_AUTH_TOKEN --quiet
gcloud secrets delete BOT_UID --quiet
gcloud secrets delete HANGOUT_ID --quiet
gcloud secrets delete googleAIKey --quiet

# Or delete all secrets at once (use with caution!)
gcloud secrets list --format="value(name)" | xargs -I {} gcloud secrets delete {} --quiet
```

After deleting secrets, redeploy using the updated deployment script which uses plain environment variables:
```bash
bash scripts/deploy-to-cloudrun.sh
```

### "Image not found" error when deploying

The GHCR image is public. Verify access:
```bash
docker pull ghcr.io/jodrell2000/mrrobotov3:latest
```

If this fails, check [github.com/jodrell2000/mrRobotoV3/packages](https://github.com/jodrell2000/mrRobotoV3/packages) for available tags.

### Bot deploys but doesn't connect

Check the Cloud Run logs:
```bash
# Stream live logs
gcloud beta logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=mrroboto"

# Or read recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mrroboto" --limit 50
```

Common causes:
- **Wrong `BOT_USER_TOKEN`** — regenerate from the tt.fm website
- **Wrong `HANGOUT_ID`** — verify the hangout UUID
- **Missing environment variable** — ensure all required variables are in your `.env` file

### Environment variables not loading

If your bot starts but can't connect, verify environment variables are set correctly:
```bash
# Check deployed environment variables
gcloud run services describe mrroboto --region europe-west1 --format="yaml(spec.template.spec.containers[0].env)"
```

Make sure your `.env` file is complete before running the deployment script.

### Service keeps restarting

Check logs for startup errors — a missing required environment variable will cause the bot to crash on startup:
```bash
gcloud run services logs read mrroboto --region europe-west1 --limit 50
```

### gcloud: command not found

Install the Google Cloud SDK (see [Step 2](#step-2-install-the-gcloud-cli)), then run:
```bash
gcloud init
```

---

## Cost Monitoring

To ensure you stay within Google Cloud's free tier:

### Set Up a Billing Alert (Recommended)

1. Go to [console.cloud.google.com/billing](https://console.cloud.google.com/billing)
2. Select your billing account
3. Click **Budgets & alerts** → **Create budget**
4. Set amount: `$1` (you'll be alerted before any meaningful spend)
5. Configure alert thresholds: 50%, 90%, 100%
6. Add your email for notifications

### Expected Monthly Usage

For a typical bot deployment running 24/7 with Cloud Storage enabled:

| Resource | Free Tier | Typical Bot Usage |
|----------|-----------|------------------|
| Compute (GB-seconds) | 360,000 | ~15,000–50,000 |
| CPU (vCPU-seconds) | 180,000 | ~30,000–90,000 |
| Network egress | 1GB/month | < 100MB |
| GCS Storage | 5 GB | < 1 GB |
| GCS Operations | 5,000 writes/month | ~730 writes/month (daily backups) |

**All typical bot usage fits comfortably within the free tier.**

**Expected total: $0/month**

### View Current Usage

In the [Google Cloud Console](https://console.cloud.google.com):
- **Cloud Run**: Navigation menu → Cloud Run → select your service → Metrics tab
- **Billing**: Navigation menu → Billing → Reports
