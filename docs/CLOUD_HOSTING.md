# Cloud Hosting Guide

> **This is optional.** If you're happy running the bot on your local machine, you can skip this entirely.

Running Mr. Roboto V3 on cloud infrastructure gives you 24/7 bot availability without keeping your computer on. This guide covers Oracle Cloud's Always Free tier as the recommended option, with alternatives included for comparison.

---

## Table of Contents

- [Why Cloud Hosting?](#why-cloud-hosting)
- [Prerequisites](#prerequisites)
- [Option 1: Oracle Cloud Always Free (Recommended)](#option-1-oracle-cloud-always-free-recommended)
- [Option 2: Other Platforms](#option-2-other-platforms)
- [Platform Comparison](#platform-comparison)
- [Frequently Asked Questions](#frequently-asked-questions)
- [Troubleshooting](#troubleshooting)

---

## Why Cloud Hosting?

| Feature | Local Docker | Cloud Hosting |
|---------|-------------|---------------|
| 24/7 availability | Only when PC is on | Always |
| Cost | $0 (electricity) | $0 (Oracle Always Free) |
| Setup complexity | Easy | Medium |
| Maintenance | Manual updates | Manual updates |

---

## Prerequisites

Before starting, you need:

- A fully configured `.env` file with your bot credentials (see [Setting Up Your Environment](SETTING_UP_YOUR_ENVIRONMENT.md))
- Basic comfort with terminal commands

You do **not** need Docker installed locally — the pre-built images are already published on GitHub Container Registry.

---

## Option 1: Oracle Cloud Always Free (Recommended)

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

#### Step 3: Create Virtual Cloud Network (5 minutes)

Before creating the instance, you must create a Virtual Cloud Network (VCN) with internet connectivity.

1. From the dashboard, click the **≡** menu (top left)
2. Navigate: **Networking** → **Virtual Cloud Networks**
3. Click the down arrow on **Actions** → Select **Start VCN Wizard**
4. Select **Create VCN with Internet Connectivity**
5. Click **Start VCN Wizard**

**VCN Configuration:**
- **VCN Name**: `mrroboto-vcn`
- **Compartment**: Leave as root
- **VCN IPv4 CIDR Block**: Leave as default (`10.0.0.0/16`)
- **Public Subnet CIDR Block**: Leave as default (`10.0.0.0/24`)
- **Private Subnet CIDR Block**: Leave as default (`10.0.1.0/24`)

6. Click **Next**
7. Review the configuration
8. Click **Create**

Wait for the VCN creation to complete (~30 seconds). This creates:
- Virtual Cloud Network
- Public subnet (for your instance)
- Private subnet
- Internet Gateway
- NAT Gateway
- Security Lists

---

#### Step 4: Create a Compute Instance (10 minutes)

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
7. Choose **Canonical Ubuntu 24.04**
8. Click **Select Image**

**Networking:**
- **Virtual cloud network**: Select **mrroboto-vcn** (the one you just created)
- **Subnet**: Select the **public subnet** (named like `Public Subnet-mrroboto-vcn`)
- **Assign a public IPv4 address**: Check this box ✓

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

#### Step 5: Configure Firewall (Optional but Recommended)

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

#### Step 6: Connect via SSH (5 minutes)

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

#### Step 7: Install Docker (5 minutes)

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

#### Step 8: Prepare Environment (5 minutes)

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

#### Step 9: Deploy the Bot (5 minutes)

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

#### Step 10: Verify Bot in Hangout (2 minutes)

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

# Run new version (same command as Step 9)
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

## Option 2: Other Platforms

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
| Oracle Cloud | $0 | Never | Medium | Yes |
| Fly.io | ~$3–5 | N/A | Medium | Yes |
| Railway | $0–5 credit | Monthly | Easy | Yes |
| Render | $7+ | N/A | Easy | Yes (paid only) |

**Recommendation:** **Oracle Cloud Always Free** is the best option for free 24/7 cloud hosting. The setup takes 30-60 minutes but the VM is truly free forever with no hidden costs.

---

## Frequently Asked Questions

### Instance Creation Questions

**Q: Which availability domain should I pick when creating an instance?**

A: Choose any available domain (usually there's only one option per region). All availability domains within the same region have identical capabilities and performance. If one domain says "Out of capacity", simply select another.

---

**Q: Do I need a shielded instance?**

A: No. Shielded instances add security features (Secure Boot, vTPM) that are useful for enterprise workloads or sensitive data processing. For a Discord/chat bot, standard security is sufficient. Shielded instances can add configuration complexity without meaningful benefit for this use case.

---

**Q: What's the difference between Ubuntu 24.04, 22.04, and 20.04?**

A: These are different Long-Term Support (LTS) release versions:
- **Ubuntu 24.04 (Noble Numbat)** - Latest LTS, support until 2029
- **Ubuntu 22.04 (Jammy Jellyfish)** - Previous LTS, support until 2027
- **Ubuntu 20.04 (Focal Fossa)** - Older LTS, support until 2025

**Recommendation:** Choose **24.04** for the longest support window and latest package versions.

---

**Q: Should I use "Full Ubuntu" or "Minimal"?**

A: Choose **Full Ubuntu** (Canonical Ubuntu). The Minimal version strips out helpful utilities (nano, curl, man pages) to save ~200MB of disk space. Since the Always Free VM includes 50GB of storage, the space savings aren't significant, and you'll save time by not having to install basic tools manually.

---

**Q: x86_64 (AMD64) or aarch64 (ARM64)?**

A: Choose **x86_64** (also called AMD64 or amd64). The VM.Standard.E2.1.Micro Always Free shape uses AMD EPYC processors (x86 architecture). The aarch64 option is for ARM-based instances which are not available in the Always Free tier.

---

**Q: Can I use the same Docker images as with local deployment?**

A: Yes! The same Docker images from GitHub Container Registry (`ghcr.io/jodrell2000/mrrobotov3:latest` or `:1.0.0-test`) work identically on Oracle Cloud VMs, Google Cloud Run, or any other Docker-compatible platform. The bot code is platform-agnostic.

---

**Q: Do I need GCS_BUCKET_NAME in my .env file for Oracle Cloud?**

A: No. Google Cloud Storage (GCS) integration is only used with Google Cloud Run due to its stateless architecture. On Oracle Cloud, your data persists directly on the VM's disk (in `~/mrroboto/data/`), so you should **remove or comment out** the `GCS_BUCKET_NAME` line from your `.env` file.

---

**Q: How do I update the bot to a newer version on Oracle Cloud?**

A: Follow these steps:

```bash
# 1. Pull the latest image
docker pull ghcr.io/jodrell2000/mrrobotov3:latest

# 2. Stop and remove the old container
docker stop mrroboto && docker rm mrroboto

# 3. Start the new version (same command as initial deployment)
docker run -d \
  --name mrroboto \
  --restart unless-stopped \
  --env-file .env \
  -v ~/mrroboto/data:/usr/src/app/data \
  ghcr.io/jodrell2000/mrrobotov3:latest
```

Your data persists in the volume mount (`~/mrroboto/data`), so you won't lose any history or configuration.

---

**Q: Will I be charged for Oracle Cloud Always Free resources?**

A: No. Oracle's Always Free resources (including the VM.Standard.E2.1.Micro instance) are **free forever** with no expiration. The credit card verification during signup is for identity verification only. As long as you only use Always Free eligible resources (look for the "Always Free Eligible" badge), you will never be charged.

However, be careful not to accidentally create paid resources (larger instances, load balancers, etc.). Stick to the VM.Standard.E2.1.Micro shape and you'll stay at $0.

---

**Q: My Oracle Cloud account signup is stuck on "Provisioning" or "Pending Approval". What should I do?**

A: Account approval usually takes 5-30 minutes but can occasionally take up to 24 hours. Common reasons for delays:
- High demand in your selected region
- Credit card verification taking longer than usual
- Manual review triggered by automated fraud detection

**Solutions:**
1. Wait - most accounts get approved within an hour
2. Check your email for requests for additional information
3. If stuck for >24 hours, contact Oracle Cloud support via live chat at [cloud.oracle.com](https://cloud.oracle.com)

---

**Q: Can I SSH into the Oracle VM from Windows?**

A: Yes! Modern Windows 10/11 includes an SSH client in PowerShell:

```powershell
# In PowerShell
ssh -i C:\Users\YourName\Downloads\oracle-mrroboto.key ubuntu@YOUR_PUBLIC_IP
```

Alternatively, you can use [PuTTY](https://www.putty.org/):
1. Download PuTTY and PuTTYgen
2. Use PuTTYgen to convert the `.key` file to `.ppk` format
3. Configure PuTTY with the public IP and `.ppk` key file

---

**Q: What happens if I accidentally stop the Docker container?**

A: The container is configured with `--restart unless-stopped`, so it will automatically restart if:
- The bot crashes due to an error
- The VM reboots (power outage, maintenance, etc.)

However, if you manually stop it with `docker stop mrroboto`, it won't auto-restart. To start it again:

```bash
docker start mrroboto
```

Or if you deleted the container, recreate it with the `docker run` command from Step 9 of the Oracle setup.

---

**Q: How much disk space will the bot use?**

A: Typical usage:
- Docker image: ~300MB
- Bot data (database, logs, configs): 10-50MB
- Total: < 500MB

The Always Free VM includes 50GB of storage, so you'll use less than 1% of available space. Ubuntu system files use ~2-3GB.

---

## Troubleshooting

### Oracle Cloud Instance Creation Issues

**"Out of host capacity" error**

Oracle's Always Free tier has limited availability in each region. If you see this:
1. Try a different availability domain (AD-1, AD-2, or AD-3)
2. Try again in a few hours - capacity fluctuates
3. Consider a different region (though this requires a new account)

---

**Can't SSH into instance - "Connection refused" or "Connection timed out"**

1. **Verify the instance is Running:**
   - Go to Oracle Cloud Console → Compute → Instances
   - Status should be "Running" (green)
   - Note the Public IP address

2. **Check firewall rules:**
   - On instance page → Primary VNIC → Subnet
   - Click Security Lists → Default Security List
   - Verify Ingress Rule exists: Source 0.0.0.0/0, TCP port 22
   - If missing, add it: **Add Ingress Rules** → Source CIDR: `0.0.0.0/0`, IP Protocol: TCP, Destination Port: `22`

3. **Verify SSH key permissions:**
   ```bash
   # macOS/Linux - key must be read-only for owner
   chmod 400 ~/Downloads/oracle-mrroboto.key
   ls -l ~/Downloads/oracle-mrroboto.key
   # Should show: -r-------- 1 youruser yourgroup
   ```

4. **Check you're using the correct username:**
   - Ubuntu images: use `ubuntu@PUBLIC_IP`
   - Oracle Linux images: use `opc@PUBLIC_IP`

---

### Docker and Bot Issues

**"Image not found" error when pulling Docker image**

The GHCR image is public. Verify access:
```bash
docker pull ghcr.io/jodrell2000/mrrobotov3:latest
```

If this fails:
1. Check your internet connection on the Oracle VM: `ping -c 3 google.com`
2. Verify image exists at [github.com/jodrell2000/mrRobotoV3/packages](https://github.com/jodrell2000/mrRobotoV3/packages)
3. Try a specific version tag: `docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.0-test`

---

**Bot container starts but doesn't connect to hangout**

Check the container logs for startup errors:
```bash
docker logs -f mrroboto
```

Common causes:
- **Wrong `BOT_USER_TOKEN`** — regenerate from the tt.fm website user settings
- **Wrong `HANGOUT_ID`** — verify the hangout UUID (found in hangout URL)
- **Missing environment variable** — ensure all required variables are in your `.env` file
- **Network connectivity** — verify VM can reach internet: `ping -c 3 gateway.prod.tt.fm`

---

**Container keeps restarting**

```bash
# Check exit status and restart count
docker ps -a

# View logs for crash reason
docker logs mrroboto
```

Common causes:
- Missing required environment variable - check `.env` file
- Port conflict (unlikely, bot doesn't expose ports)
- Out of memory (unlikely with 1GB RAM)

---

**"Permission denied" when running docker commands**

You need to be in the `docker` group:
```bash
# Add user to docker group
sudo usermod -aG docker ubuntu

# Log out and back in
exit

# Reconnect via SSH
ssh -i ~/Downloads/oracle-mrroboto.key ubuntu@YOUR_PUBLIC_IP

# Verify docker works without sudo
docker ps
```

---

**Bot was working but stopped responding**

1. **Check if container is running:**
   ```bash
   docker ps
   ```
   If not listed, it crashed. View logs: `docker logs mrroboto`

2. **Check VM is running:**
   - Oracle Cloud Console → Compute → Instances
   - Verify status is "Running"
   - If stopped, click **Start** to restart the VM

3. **Restart the container:**
   ```bash
   docker restart mrroboto
   ```

4. **Check disk space:**
   ```bash
   df -h
   # /dev/sda1 or /dev/sda3 should not be at 100%
   ```

---

**Bot logs show "Error loading botConfig.json: File is empty"**

This usually means the data directory didn't mount correctly:
```bash
# Verify volume mount
docker inspect mrroboto | grep -A 10 Mounts

# Should show: Source: /home/ubuntu/mrroboto/data
#              Destination: /usr/src/app/data

# Check data directory exists and has files
ls -la ~/mrroboto/data/
```

If empty, the bot will create default files on first run.

---

### VM Management Issues

**Forgot the SSH private key / lost the `.key` file**

You'll need to add a new SSH key:
1. Generate a new key pair on your local machine:
   ```bash
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/oracle_new
   ```
2. In Oracle Cloud Console → Compute → Instances → your instance
3. Click **Edit** at the top
4. Scroll to **Add SSH Keys** → **Paste SSH Keys**
5. Paste contents of `~/.ssh/oracle_new.pub`
6. Click **Save Changes**
7. Connect with new key:
   ```bash
   ssh -i ~/.ssh/oracle_new ubuntu@YOUR_PUBLIC_IP
   ```

---

**Instance stopped and won't start - "Out of host capacity"**

This is rare but can happen during Oracle infrastructure maintenance. Solutions:
1. Wait a few hours and try starting again
2. If persistent, you may need to create a new instance in a different availability domain
3. Before deleting the old instance, stop it and create a **Boot Volume Backup** to preserve data

---

**How to check VM resource usage**

```bash
# Memory usage
free -h

# Disk space
df -h

# CPU and process list (top)
top
# Press 'q' to exit

# Docker container resource usage
docker stats mrroboto
# Press Ctrl+C to exit
```

The bot typically uses:
- **Memory:** 100-300MB
- **CPU:** 1-5% (spikes during song changes/messages)
- **Disk:** < 500MB total

---

**VM rebooted and bot didn't restart**

The `--restart unless-stopped` flag should handle this automatically. If not:
```bash
# Check if Docker service is running
sudo systemctl status docker

# Start Docker if stopped
sudo systemctl start docker

# Enable Docker to start on boot
sudo systemctl enable docker

# Check if container is running
docker ps

# Start container if stopped
docker start mrroboto
```
