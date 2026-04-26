# Oracle Cloud Hosting Guide

> **This is optional.** If you're happy running the bot on your local machine, you can skip this entirely.

This guide provides step-by-step instructions for deploying Mr. Roboto V3 to Oracle Cloud Infrastructure (OCI) using the **Always Free tier** — giving you **24/7 bot availability at zero cost, forever**.

---

## Table of Contents

- [Why Oracle Cloud?](#why-oracle-cloud)
- [Prerequisites](#prerequisites)
- [Setup Overview](#setup-overview)
- [Step 1: Create Oracle Cloud Account](#step-1-create-oracle-cloud-account-15-30-minutes)
- [Step 2: Access Oracle Cloud Console](#step-2-access-oracle-cloud-console-2-minutes)
- [Step 2a (Optional): Share Account Access with Others](#step-2a-optional-share-account-access-with-others-5-minutes)
- [Step 3: Create Virtual Cloud Network](#step-3-create-virtual-cloud-network-5-minutes)
- [Step 4: Create a Compute Instance](#step-4-create-a-compute-instance-10-minutes)
- [Step 5: Connect via SSH](#step-5-connect-via-ssh-5-minutes)
- [Step 6: Install Docker](#step-6-install-docker-5-minutes)
- [Step 7: Deploy the Bot](#step-7-deploy-the-bot-automated-method)
- [Managing Your Bot](#managing-your-bot)
- [Data Synchronization](#data-synchronization)
- [Frequently Asked Questions](#frequently-asked-questions)
- [Troubleshooting](#troubleshooting)

---

## Why Oracle Cloud?

**Oracle Cloud's Always Free tier** provides truly free-forever infrastructure — no expiration, no credit crunch, no hidden costs.

| Feature | Local Docker | Oracle Cloud Always Free |
|---------|-------------|--------------------------|
| **24/7 availability** | Only when PC is on | ✅ Always online |
| **Monthly cost** | $0 (electricity) | ✅ $0 forever |
| **Setup time** | 5 minutes | 45-60 minutes (one-time) |
| **Maintenance** | Manual updates | Manual updates via SSH |
| **Expiration** | Never | ✅ Never |

**What you get for free (forever):**
- 2 × AMD micro instances (1/8 OCPU, 1GB RAM each)
- 4 × ARM cores + 24GB RAM (Ampere A1 instances)
- 200GB total block storage
- 10TB/month outbound data transfer

The bot runs perfectly on one AMD micro instance (1GB RAM).

---

## Prerequisites

Before starting, ensure you have:

- ✅ **Your bot's `.env` file** fully configured and working locally (see [Setting Up Your Environment](SETTING_UP_YOUR_ENVIRONMENT.md))
- ✅ **A credit/debit card** for Oracle account verification (you will NOT be charged)
- ✅ **Basic terminal familiarity** - ability to copy/paste commands and use SSH
- ✅ **SSH access** - either SSH key or SSH agent (1Password, Secretive, etc.)

You do **not** need:
- ❌ Docker installed locally (we use pre-built images from GitHub Container Registry)
- ❌ Prior cloud infrastructure experience

---

## Setup Overview

The deployment process has three phases:

**Phase 1: Oracle Cloud Account Setup** (~30 minutes)
1. Create Oracle Cloud account with credit card verification
2. Access Oracle Cloud Console
3. Create Virtual Cloud Network (VCN)
4. Create compute instance (VM)

**Phase 2: VM Preparation** (~15 minutes)
5. Connect to VM via SSH
6. Install Docker

**Phase 3: Bot Deployment** (~5 minutes)
7. Deploy bot using automated script (or manual method)

**Total time:** 45-60 minutes (one-time setup)

---

## Step 1: Create Oracle Cloud Account (15-30 minutes)

Oracle Cloud offers **truly free-forever** resources that never expire. The credit card is for identity verification only — you will NOT be charged for Always Free services.

### Account Creation Process

1. **Start signup**
   - Go to [oracle.com/cloud/free](https://oracle.com/cloud/free)
   - Click **Start for free**

2. **Enter account details**
   - **Country/Territory**: Your location
   - **Email**: Valid email address
   - **First and Last Name**: Real name (must match credit card)
   - Click **Verify my email**

3. **Verify email**
   - Check your inbox for Oracle verification email
   - Click the verification link

4. **Complete registration**
   - **Account Name**: Choose a unique name (e.g., `mrroboto-bot`)
   - **Home Region**: Select closest region
     - UK: **UK South (London)**
     - US East Coast: **US East (Ashburn)**
     - US West Coast: **US West (Phoenix or San Jose)**
     - ⚠️ **IMPORTANT:** Cannot change region after signup
   - **Address**: Must match credit card billing address exactly
   - **Phone**: Valid phone number for SMS verification

5. **Payment verification**
   - Enter credit/debit card details
   - Oracle will authorize $1-2 and immediately refund it
   - This is **identity verification only**
   - ✅ You will NOT be charged for Always Free resources

6. **Submit and wait**
   - Review terms and click **Start my free trial**
   - Wait for account approval (usually instant, up to 24 hours max)
   - Check email for "Your Oracle Cloud account is ready"

### Troubleshooting Signup

**"Unable to process your request" error:**
- Try different browser (Chrome/Firefox)
- Use incognito/private mode
- Try different email address
- Contact Oracle support chat at [cloud.oracle.com](https://cloud.oracle.com)

**Account stuck on "Provisioning":**
- Wait - most accounts approve within 1 hour
- Check email for requests for additional info
- If >24 hours, contact Oracle support

---

## Step 2: Access Oracle Cloud Console (2 minutes)

Once your account is approved:

1. **Sign in**
   - Go to [cloud.oracle.com](https://cloud.oracle.com)
   - Click **Sign in to Cloud**

2. **Enter credentials**
   - **Cloud Account Name**: Enter the account name you chose
   - Click **Next**
   - **Email and Password**: Your login credentials

3. **Navigate to dashboard**
   - You'll see the Oracle Cloud Dashboard
   - This is your main control panel

---

## Step 2a (Optional): Share Account Access with Others (10 minutes)

> **Skip this step if:** You're managing the bot yourself and don't need to give others access.

> **Use this step if:** You want to create the account but hand over technical setup to someone else, or you're setting up access for team members, friends, or family.

Oracle Cloud supports multi-user access through Identity and Access Management (IAM). This is perfect for:
- Parents setting up accounts for children
- Friends helping each other with setup
- Team members sharing a project account
- Someone without a credit card getting access

### How It Works

**Account Owner (Person A):**
- Creates the OCI account with their payment card
- Remains responsible for billing (£0 for Always Free resources)
- Creates IAM users and assigns permissions
- Can revoke access at any time

**IAM User (Person B):**
- Receives email invitation from account owner
- Creates Oracle account (no payment card required)
- Gets access to the owner's tenancy
- Can deploy and manage resources based on assigned permissions
- Cannot see billing information

### Setup Steps

Create a custom group that has full technical access but cannot view billing:

1. **Navigate to Groups**
   - Sign in to Oracle Cloud Console
   - Go to **Identity & Security** → **Domains** → **Default Domain** → **User management** → **Groups**

2. **Create new group**
   - Click **Create Group**
   - **Name**: `TechnicalAdmins` (or any name you prefer)
   - **Description**: `Full technical access without billing visibility`
   - Click **Create**

3. **Add policies to the group**
   - Go to **Identity & Security** → **Policies**
   - Click **Create Policy**
   - **Name**: `TechnicalAdminPolicy`
   - **Description**: `Allows full resource management except billing`
   - **Policy Builder** or **Show manual editor**: Toggle to manual editor
   - Add these policy statements (Allow statements only):
   ```
   Allow group TechnicalAdmins to manage all-resources in tenancy
   Allow group TechnicalAdmins to read usage-budgets in tenancy
   ```
   - Click **Create**
   
   > **Important:** This policy should ONLY contain Allow statements. Do NOT add any Deny statements here.

4. **Enable Deny Policy Feature** (required before creating deny policies):
   - Stay in **Identity & Security** → **Policies**
   - Click the **Actions** drop down menu
   - Select **Policy settings**
   - Click **Enable IAM Deny Policy**
   - Read the warning: "Enabling IAM deny policies is permanent and must be done deliberately"
   - Click **Enable** to confirm
   - When prompted about creating a default deny policy: Select **Yes**
   
   > **Important:** This is a one-time setup. Once enabled, you cannot turn off deny policies (but you can delete individual deny policy statements). The system will automatically create a default policy that prevents regular users from creating deny statements - only administrators can manage deny policies.

5. **Block payment and subscription management** (optional, for extra security):
   - Stay in **Identity & Security** → **Policies**
   - Click **Create Policy** again to create a **NEW, SEPARATE policy**
   - **Name**: `BlockPaymentAccess` (different name from above)
   - **Description**: `Prevents upgrading account or managing payment methods`
   - **Policy Builder** or **Show manual editor**: Toggle to manual editor
   - **Important**: Clear any default/placeholder text in the editor first
   - Add these statements (Deny statements only):
   ```
   Deny group TechnicalAdmins to use subscription in tenancy
   Deny group TechnicalAdmins to manage all-resources in tenancy where request.permission='TENANCY_UPDATE'
   ```
   - Click **Create**
   
   > **Critical:** This MUST be a separate policy from `TechnicalAdminPolicy`. OCI does not allow Allow and Deny statements in the same policy. You should now have TWO policies: one named `TechnicalAdminPolicy` with Allow statements, and one named `BlockPaymentAccess` with Deny statements.
   
   > **Troubleshooting:** If you get "Deny statement passed into Allow compilation" error, ensure you have enabled the Deny Policy Feature in step 4. Also verify the policy editor is completely empty before pasting the Deny statements.
   
   This prevents IAM users from:
   - ✅ Upgrading from Always Free to paid services
   - ✅ Modifying tenancy settings (including payment)
   - ✅ Managing subscriptions
   - ❌ Viewing usage and resource consumption (they can still see this)

**Summary:** After completing the setup, you should have:
- ✅ One group: `TechnicalAdmins`
- ✅ Two policies: `TechnicalAdminPolicy` (with Allow statements) and `BlockPaymentAccess` (with Deny statements)
- ✅ Deny Policy Feature enabled (if you created step 5)

Now when you create IAM users, assign them to the `TechnicalAdmins` group.

#### For Account Owner: Create IAM User

1. **Navigate to IAM**
   - Sign in to Oracle Cloud Console
   - Go to **Identity & Security** → **Domains** → **Default Domain** → **User Management** → **Users**

2. **Create user**
   - Click **Create User**
   - Enter the person's email address
   - Enter first (optional) name and last name

3. **Assign permissions**
   You should se the Group TechAdmins you created earlier in the list under Groups
   - Assign to groups: **TechnicalAdmins** by ticking the box next to that Group name
   - Click **Create**

4. **Invitation sent**
   - Oracle automatically sends invitation email to the user
   - Invitation includes link to activate account

#### For IAM User: Accept Invitation

1. **Check email**
   - Look for invitation from Oracle Cloud
   - Click the activation link

2. **Create account**
   - Set up password (no payment card required)
   - Complete account creation

3. **Access tenancy**
   - Sign in to Oracle Cloud Console
   - You'll have access to the account owner's tenancy
   - Can now proceed with technical setup steps

### Handover to Technical Admin

At this point, the basic account structure and user permissions have been created:
- ✅ Oracle Cloud account created with payment verification
- ✅ `TechnicalAdmins` group created with full technical access
- ✅ IAM user created and assigned to `TechnicalAdmins` group
- ✅ IAM user has accepted invitation and can sign in

**If the account owner will not be responsible for creating resources**, they can now hand over to one of the Technical Admins to proceed with **Step 3** and beyond. The Technical Admin will:
- Create the Virtual Cloud Network (VCN)
- Create the compute instance (VM)
- Install Docker
- Deploy the bot

The Technical Admin will need:
- Their Oracle Cloud IAM user credentials (email and password)
- The bot's `.env` file with all configuration

### Important Notes

- ✅ IAM users can deploy, manage, and SSH to VMs
- ✅ Only account owner sees billing/payment information
- ✅ Always Free resources have no charges regardless of who uses them
- ⚠️ Account owner is responsible for any charges if paid resources are created
- ℹ️ Account owner can revoke IAM user access at any time

---

## Step 3: Create Virtual Cloud Network (5 minutes)

Before creating the VM instance, you need a Virtual Cloud Network (VCN) for internet connectivity.

1. **Open VCN wizard**
   - Click the **≡** menu (top left hamburger icon)
   - Navigate: **Networking** → **Virtual Cloud Networks**
   - Click the down arrow on **Actions** → **Start VCN Wizard**

2. **Select wizard type**
   - Choose: **Create VCN with Internet Connectivity**
   - Click **Start VCN Wizard**

3. **Configure VCN**
   - **VCN Name**: `mrroboto-vcn`
   - **Compartment**: Leave as **root**
   - **VCN IPv4 CIDR Block**: Leave default (`10.0.0.0/16`)
   - **Public Subnet CIDR Block**: Leave default (`10.0.0.0/24`)
   - **Private Subnet CIDR Block**: Leave default (`10.0.1.0/24`)

4. **Create**
   - Click **Next**
   - Review configuration
   - Click **Create**
   - Wait ~30 seconds for completion

The wizard creates:
- Virtual Cloud Network
- Public subnet (for your VM instance)
- Private subnet
- Internet Gateway
- NAT Gateway
- Route tables
- Security lists (includes SSH port 22 by default)

---

## Step 4: Create a Compute Instance (10 minutes)

Now create the virtual machine that will run your bot 24/7.

1. **Navigate to instances**
   - Click the **≡** menu (top left)
   - Navigate: **Compute** → **Instances**
   - Ensure you're in **root compartment** (dropdown at top)
   - Click **Create Instance**

2. **Configure instance name**
   ```
   Name: mrroboto-bot
   ```

3. **Select placement**
   - **Compartment**: Leave as **root**
   - **Availability Domain**: Select any available (usually only 1 option)

4. **Choose shape**
   - Click **Change Shape**
   - Select **Specialty and previous generation**
   - Choose: **VM.Standard.E2.1.Micro**
     - 1/8 OCPU (1 virtual CPU)
     - 1 GB Memory
     - ✅ **Always Free Eligible** badge visible
   - Click **Select Shape**

5. **Choose operating system**
   - Click **Change Image**
   - Select **Ubuntu**
   - Choose **Canonical Ubuntu 24.04** (latest LTS)
     - Architecture: **x86_64** (AMD64)
     - Version: **Full** (not Minimal)
   - Click **Select Image**

6. **Configure networking**
   - **Virtual cloud network**: Select **mrroboto-vcn** (created in Step 3)
   - **Subnet**: Select the **public subnet** (named like `Public Subnet-mrroboto-vcn`)
   - **Assign a public IPv4 address**: ✅ Check this box

7. **Configure SSH keys**

   **Option A: Generate new key pair (Recommended for beginners)**
   - Select **Generate a key pair for me**
   - Click **Save Private Key**
   - Save file as `oracle-mrroboto.key` in `~/Downloads/`
   - Click **Save Public Key** (optional, for your records)

   **Option B: Use existing SSH key**
   - Select **Upload public key files (.pub)**
   - Browse and select your `~/.ssh/id_rsa.pub` or similar
   - Keys for multiple users can be added here if required
   - Once the Instance is created, new ssh keys for rother users to access the system can ONLY be added using ssh

   **Option C: Use SSH agent (1Password, Secretive, etc.)**
   - If you use an SSH agent, select Option B above
   - Upload the public key from your SSH agent
   - No need to save/manage key files

8. **Configure boot volume**
   - Leave default (50 GB) - plenty for the bot

9. **Create the instance**
   - Click **Create** at the bottom
   - Wait for provisioning: **Provisioning** → **Running** (2-3 minutes)
   - ✅ Once **Running**, note the **Public IP Address** (e.g., `144.24.xxx.xxx`)

**Important:** Save the public IP address - you'll need it for all deployment commands.

---

## Step 5: Connect via SSH (5 minutes)

Test SSH connectivity to your new VM.

### macOS / Linux

If you generated a new key pair in Step 4:

```bash
# Set correct permissions on private key
chmod 400 ~/Downloads/oracle-mrroboto.key

# Connect to instance (replace with YOUR public IP)
ssh -i ~/Downloads/oracle-mrroboto.key ubuntu@YOUR_PUBLIC_IP
```

If using an existing SSH key or SSH agent:

```bash
# Connect directly (SSH will use your default key or agent)
ssh ubuntu@YOUR_PUBLIC_IP
```

### Windows

Using PowerShell:
```powershell
# With key file
ssh -i C:\Users\YourName\Downloads\oracle-mrroboto.key ubuntu@YOUR_PUBLIC_IP

# Or if using PuTTY, convert .key to .ppk first with PuTTYgen
```

### First Connection

- Answer `yes` when prompted: "Are you sure you want to continue connecting?"
- You should see the Ubuntu welcome message
- You're now connected to your Oracle Cloud VM! 🎉

**Keep this SSH session open** for the next steps.

**Note for IAM users:** If you're accessing a VM created by someone else, make sure your SSH public key has been added to the instance first. See [Step 2a: Share Account Access](#step-2a-optional-share-account-access-with-others-5-minutes) for SSH key setup instructions.

---

## Step 6: Install Docker (5 minutes)

Run these commands on the Oracle VM (while connected via SSH):

```bash
# 1. Install Docker using official script
curl -fsSL https://get.docker.com | sh

# 2. Add ubuntu user to docker group (allows Docker without sudo)
sudo usermod -aG docker ubuntu

# 3. Verify Docker installation
docker --version

# 4. Log out for group changes to take effect
exit
```

**Reconnect via SSH:**
```bash
ssh -i ~/Downloads/oracle-mrroboto.key ubuntu@YOUR_PUBLIC_IP
# Or: ssh ubuntu@YOUR_PUBLIC_IP  (if using agent/default key)
```

**Test Docker:**
```bash
docker ps
# Should show empty table (not "permission denied")
```

✅ Docker is now installed and ready!

---

## Step 7: Deploy the Bot

Deploy the bot using the automated deployment script from your **local machine** (not the VM).

**On your local machine:**

```bash
# Navigate to your project directory, eg.
cd ~/Documents/Git/mrRobotoV3

# First-time deployment with data upload
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/deploy-to-oracle.sh --upload-data --logs
```

Replace `YOUR_PUBLIC_IP` with your instance's public IP from Step 4.

**What the script does:**
1. ✅ Tests SSH connection
2. ✅ Creates `~/mrroboto` directory on VM
3. ✅ Uploads `.env` file (automatically strips quotes and removes `GCS_BUCKET_NAME`)
4. ✅ Uploads `data/` directory (excludes `*_example` files)
5. ✅ Pulls Docker image from GitHub Container Registry
6. ✅ Stops old container (if exists)
7. ✅ Starts new container with correct configuration
8. ✅ Shows logs (if `--logs` flag used)

**Script Options:**

```bash
# Deploy with data upload and show logs
ORACLE_IP=144.24.xxx.xxx ./scripts/deploy-to-oracle.sh --upload-data --logs

# Update bot (keeps existing data on VM)
ORACLE_IP=144.24.xxx.xxx ./scripts/deploy-to-oracle.sh

# Deploy without uploading .env (use existing VM .env)
ORACLE_IP=144.24.xxx.xxx ./scripts/deploy-to-oracle.sh --skip-env

# Just watch logs without redeploying
ORACLE_IP=144.24.xxx.xxx ./scripts/deploy-to-oracle.sh --skip-env --logs
```

**SSH Authentication:**

The script supports multiple authentication methods:

- **SSH Agent (1Password, Secretive, etc.):** Just set `ORACLE_IP`
```bash
ORACLE_IP=144.24.xxx.xxx ./scripts/deploy-to-oracle.sh --upload-data
```

- **SSH Key File:** Set `ORACLE_SSH_KEY` environment variable
```bash
ORACLE_IP=144.24.xxx.xxx ORACLE_SSH_KEY=~/Downloads/oracle-mrroboto.key ./scripts/deploy-to-oracle.sh --upload-data
```

- **Custom SSH Key Location:** Point to any key file
```bash
ORACLE_IP=144.24.xxx.xxx ORACLE_SSH_KEY=~/.ssh/oracle_custom ./scripts/deploy-to-oracle.sh --upload-data
```

**Docker Image Version:**

By default, the script deploys the `latest` tag. You can specify a different version:

- **Deploy latest (default):**
```bash
ORACLE_IP=144.24.xxx.xxx ./scripts/deploy-to-oracle.sh --upload-data
```

- **Deploy specific version:**
```bash
IMAGE_TAG=1.0.0 ORACLE_IP=144.24.xxx.xxx ./scripts/deploy-to-oracle.sh --upload-data
```

- **Deploy with version and SSH key:**
```bash
IMAGE_TAG=1.0.0 ORACLE_IP=144.24.xxx.xxx ORACLE_SSH_KEY=~/.ssh/oracle.key ./scripts/deploy-to-oracle.sh
```

**After deployment:**

Check the logs for successful startup:
```
✅ Bot instance created
✅ Connected to hangout
```

**Verify in hangout:**
1. Go to your tt.fm hangout
2. Bot should appear in the user list
3. Test: `!ping` → bot should respond with "Pong!"

---

## Managing Your Bot

Common management tasks for your Oracle Cloud bot.

### View Logs

**Live logs (follow mode):**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker logs -f mrroboto'
# Press Ctrl+C to exit
```

**Last 100 lines:**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker logs --tail 100 mrroboto'
```

### Restart Bot

**Graceful restart (recommended):**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker restart -t 30 mrroboto'
```

The `-t 30` gives the bot 30 seconds to shut down gracefully before forcing termination.

**Quick restart:**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker restart mrroboto'
```

### Stop/Start Bot

**Stop bot:**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker stop -t 30 mrroboto'
```

**Start stopped bot:**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker start mrroboto'
```

### Check Bot Status

**Is bot running?**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker ps | grep mrroboto'
# Shows container info if running
```

**Container health:**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker stats --no-stream mrroboto'
# Shows CPU, memory, network usage
```

### Update to New Version

When a new bot version is released:

**Option 1: Using deployment script (recommended)**
```bash
# From local machine
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/deploy-to-oracle.sh
```

**Option 2: Manual update**
```bash
# SSH into VM
ssh ubuntu@YOUR_PUBLIC_IP

# Pull latest image
docker pull ghcr.io/jodrell2000/mrrobotov3:latest

# Stop and remove old container
docker stop mrroboto && docker rm mrroboto

# Start new version
docker run -d \
  --name mrroboto \
  --restart unless-stopped \
  --env-file /home/ubuntu/mrroboto/.env \
  -v /home/ubuntu/mrroboto/data:/usr/src/app/data \
  ghcr.io/jodrell2000/mrrobotov3:latest
```

Your data persists in the volume mount, so you won't lose any history.

### Check VM Resources

**Disk space:**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'df -h'
```

**Memory usage:**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'free -h'
```

**All docker containers:**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker ps -a'
```

### Update Ubuntu (Monthly Maintenance)

```bash
ssh ubuntu@YOUR_PUBLIC_IP 'sudo apt update && sudo apt upgrade -y'
```

Run this monthly to keep the OS secure and up-to-date.

---

## Data Synchronization

The sync script helps you transfer data between your local machine and Oracle VM.

### Download Data from VM

**Basic download:**
```bash
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/sync-oracle-data.sh
```

**Download with local backup:**
```bash
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/sync-oracle-data.sh --backup
```

This creates a timestamped backup (e.g., `data-backup-20260416-143022`) before downloading.

### Upload Data to VM

```bash
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/sync-oracle-data.sh --upload
```

**Warning:** This overwrites data on the VM. Use with caution.

### Use Cases

**Backup VM data:**
```bash
# Download with backup
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/sync-oracle-data.sh --backup
```

**Test changes locally, then deploy:**
```bash
# 1. Download current VM data
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/sync-oracle-data.sh

# 2. Test changes locally with docker-compose
./docker-start-safe.sh

# 3. Once satisfied, upload to VM
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/sync-oracle-data.sh --upload

# 4. Restart bot
ssh ubuntu@YOUR_PUBLIC_IP 'docker restart mrroboto'
```

**Migrate between deployments:**
```bash
# Download from old VM
ORACLE_IP=OLD_IP ./scripts/sync-oracle-data.sh --backup

# Upload to new VM
ORACLE_IP=NEW_IP ./scripts/sync-oracle-data.sh --upload
```

### What Gets Synced

The data directory includes:
- `botConfig.json` - Bot configuration and personality
- `chat.json` - Chat message history
- `welcomeMessages.json` - Custom welcome messages
- `aliases.json` - User aliases
- `themes.json` - Hangout themes
- `mrroboto.db` - SQLite database (song history, conversations)
- `image-validation-cache.json` - Image URL validation cache

Files ending in `_example` are automatically excluded from uploads.

---

## Frequently Asked Questions

### Account & Billing

**Q: Will I really never be charged for the Always Free VM?**

A: Correct! As long as you use **Always Free Eligible** resources (look for the badge when creating resources), you will never be charged. The VM.Standard.E2.1.Micro shape is permanently free with no expiration.

Be careful not to accidentally create paid resources (larger instances, load balancers, etc.). Always verify the "Always Free Eligible" badge.

---

**Q: Why does Oracle need my credit card if it's free?**

A: Identity verification only. Oracle authorizes $1-2 and immediately refunds it. This prevents abuse and bot signups. You will NOT be charged for Always Free resources.

---

**Q: My account signup is stuck on "Provisioning" or "Pending Approval". What do I do?**

A: Most accounts approve within 5-30 minutes, but can take up to 24 hours. Common reasons:
- High demand in selected region
- Credit card verification delay
- Automated fraud detection triggered manual review

**Solutions:**
1. Wait - most approve within 1 hour
2. Check email for additional info requests
3. If >24 hours, contact Oracle support at [cloud.oracle.com](https://cloud.oracle.com)

---

**Q: Can someone else set up the account and give me access without my credit card?**

A: Yes! See [Step 2a (Optional): Share Account Access with Others](#step-2a-optional-share-account-access-with-others-5-minutes) for complete instructions on setting up multi-user access with IAM and SSH key management.

---

### Instance Creation

**Q: Which availability domain should I pick?**

A: Choose any available (usually only 1 option per region). All availability domains have identical capabilities. If one shows "Out of capacity", try another.

---

**Q: Do I need a shielded instance?**

A: No. Shielded instances add enterprise security features (Secure Boot, vTPM) that aren't necessary for a chat bot. Standard security is sufficient.

---

**Q: Ubuntu 24.04, 22.04, or 20.04?**

A: Choose **24.04** (Noble Numbat) - latest LTS with support until 2029. Includes newer packages and longest support window.

---

**Q: "Full Ubuntu" or "Minimal"?**

A: Choose **Full Ubuntu** (Canonical Ubuntu). Minimal strips helpful utilities (nano, curl, man pages) to save ~200MB. Since you get 50GB storage, use Full for convenience.

---

**Q: x86_64 or aarch64 architecture?**

A: Choose **x86_64** (AMD64). The VM.Standard.E2.1.Micro shape uses AMD EPYC processors (x86 architecture). ARM (aarch64) instances aren't available in Always Free tier.

---

**Q: "Out of host capacity" error when creating instance**

A: Oracle's Always Free tier has limited availability. Solutions:
1. Try different availability domain (AD-1, AD-2, AD-3)
2. Try again in a few hours - capacity fluctuates
3. Different time of day (early morning often better)
4. Last resort: Different region (requires new account signup)

---

### SSH & Access

**Q: Can I use 1Password or other SSH agents instead of key files?**

A: Yes! The deployment scripts support SSH agents (1Password, Secretive, ssh-agent). Just don't set `ORACLE_SSH_KEY` variable:

```bash
# Works with SSH agent
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/deploy-to-oracle.sh
```

Upload your public key from the SSH agent when creating the instance.

---

**Q: Can I SSH from Windows?**

A: Yes! Windows 10/11 includes SSH in PowerShell:

```powershell
ssh -i C:\Users\YourName\Downloads\oracle-mrroboto.key ubuntu@YOUR_PUBLIC_IP
```

Or use [PuTTY](https://www.putty.org/) with the key converted to `.ppk` format using PuTTYgen.

---

**Q: I lost my SSH private key. How do I access my VM?**

A: Add a new SSH key:

1. Generate new key pair locally:
   ```bash
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/oracle_new
   ```

2. In Oracle Cloud Console → Compute → Instances → your instance
3. Click **Edit** at top
4. Scroll to **Add SSH Keys** → **Paste SSH Keys**
5. Paste contents of `~/.ssh/oracle_new.pub`
6. Click **Save Changes**
7. Connect with new key:
   ```bash
   ssh -i ~/.ssh/oracle_new ubuntu@YOUR_PUBLIC_IP
   ```

**Note:** If you're an IAM user on a shared account, see [Step 2a: Share Account Access](#step-2a-optional-share-account-access-with-others-5-minutes) for complete SSH key setup instructions.

---

**Q: "Connection refused" or "Connection timed out" when trying to SSH**

A: Check these items:

1. **Instance is running:**
   - Oracle Console → Compute → Instances
   - Status should be "Running" (green)

2. **Firewall allows SSH:**
   - Instance page → Primary VNIC → Subnet → Security Lists
   - Verify Ingress Rule: Source `0.0.0.0/0`, TCP port `22`

3. **Key permissions (macOS/Linux):**
   ```bash
   chmod 400 ~/Downloads/oracle-mrroboto.key
   ```

4. **Correct username:**
   - Ubuntu images: `ubuntu@PUBLIC_IP`
   - Oracle Linux: `opc@PUBLIC_IP`

---

### Deployment

**Q: Can I use the same Docker images as local development?**

A: Yes! The images from GitHub Container Registry work identically everywhere:
- `ghcr.io/jodrell2000/mrrobotov3:latest` - Latest stable release (default)
- `ghcr.io/jodrell2000/mrrobotov3:1.0.0` - Specific version tag

The deployment script deploys `latest` by default. To deploy a specific version, use:
```bash
IMAGE_TAG=1.0.0 ORACLE_IP=YOUR_PUBLIC_IP ./scripts/deploy-to-oracle.sh
```

The bot is platform-agnostic and works identically across local Docker, Oracle Cloud, and other platforms.

---

**Q: Do I need `GCS_BUCKET_NAME` in my `.env` file?**

A: No. Remove or comment it out. Google Cloud Storage is only needed for Google Cloud Run's stateless architecture. On Oracle, data persists on the VM's disk in `~/mrroboto/data/`.

---

**Q: Why does my bot name show quotes like `"Mrs. Roboto"`?**

A: Your `.env` file has quoted values, and Docker's `--env-file` doesn't strip quotes (unlike docker-compose). 

**Solution:** Use the deployment script - it automatically strips quotes. Or manually remove quotes from all `.env` values on the VM.

**Wrong:**
```bash
CHAT_NAME="Mrs. Roboto"
COMMAND_SWITCH="!"
```

**Correct for Oracle:**
```bash
CHAT_NAME=Mrs. Roboto
COMMAND_SWITCH=!
```

---

**Q: Bot shows "Invalid URL" error on startup**

A: Same issue as above - quotes in `TTFM_GATEWAY_BASE_URL`. Remove quotes:

**Wrong:**
```bash
TTFM_GATEWAY_BASE_URL="https://gateway.prod.tt.fm"
```

**Correct:**
```bash
TTFM_GATEWAY_BASE_URL=https://gateway.prod.tt.fm
```

Or use the deployment script which handles this automatically.

---

### Bot Management

**Q: How do I update the bot to a newer version?**

A: Use the deployment script (deploys `latest` by default):

```bash
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/deploy-to-oracle.sh
```

Or deploy a specific version:

```bash
IMAGE_TAG=1.0.0 ORACLE_IP=YOUR_PUBLIC_IP ./scripts/deploy-to-oracle.sh
```

Or manually:
```bash
ssh ubuntu@YOUR_PUBLIC_IP

docker pull ghcr.io/jodrell2000/mrrobotov3:latest
docker stop mrroboto && docker rm mrroboto
docker run -d \
  --name mrroboto \
  --restart unless-stopped \
  --env-file /home/ubuntu/mrroboto/.env \
  -v /home/ubuntu/mrroboto/data:/usr/src/app/data \
  ghcr.io/jodrell2000/mrrobotov3:latest
```

Data persists in the volume, so you won't lose history.

---

**Q: What happens if I stop the Docker container?**

A: The container is configured with `--restart unless-stopped`, so it auto-restarts if:
- Bot crashes
- VM reboots

But if you manually stop it (`docker stop mrroboto`), it won't auto-restart. Start it with:
```bash
docker start mrroboto
```

---

**Q: How much disk space does the bot use?**

A: Typical usage:
- Docker image: ~300MB
- Bot data (database, logs, configs): 10-50MB
- **Total:** < 500MB

The 50GB VM storage is more than sufficient (<1% used by bot).

---

**Q: Can I run multiple bots on one VM?**

A: Yes, but the 1GB RAM micro instance is sized for one bot. Running multiple bots may cause out-of-memory errors.

If you need multiple bots, create separate VM instances (you get 2 free micro instances).

---

### Troubleshooting

**Q: Bot was working but stopped responding**

A: Check container status:

```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker ps | grep mrroboto'
```

If not running:
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker logs mrroboto'  # Check crash reason
ssh ubuntu@YOUR_PUBLIC_IP 'docker start mrroboto'  # Restart
```

If VM stopped, start it in Oracle Console.

---

**Q: "Permission denied" when running Docker commands**

A: User not in docker group. Fix:

```bash
sudo usermod -aG docker ubuntu
exit  # Log out
```

Reconnect via SSH and try again.

---

**Q: Container keeps restarting**

A: Check logs for crash reason:

```bash
docker logs mrroboto
```

Common causes:
- Missing environment variable in `.env`
- Malformed `.env` (check for quotes)
- Network connectivity issue

---

**Q: Bot logs show "Error loading botConfig.json: File is empty"**

A: Volume mount issue. Verify:

```bash
docker inspect mrroboto | grep -A 10 Mounts
# Should show: /home/ubuntu/mrroboto/data → /usr/src/app/data

ls -la ~/mrroboto/data/
# Should list config files
```

If empty, bot creates defaults on first run. Or upload data with:
```bash
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/sync-oracle-data.sh --upload
```

---

**Q: VM rebooted and bot didn't restart**

A: Docker service should auto-start. Check:

```bash
sudo systemctl status docker
sudo systemctl enable docker  # Enable auto-start
docker start mrroboto
```

---

**Q: How do I check VM resource usage?**

A: ```bash
# Memory
ssh ubuntu@YOUR_PUBLIC_IP 'free -h'

# Disk
ssh ubuntu@YOUR_PUBLIC_IP 'df -h'

# Docker stats
ssh ubuntu@YOUR_PUBLIC_IP 'docker stats --no-stream mrroboto'
```

Typical usage:
- **Memory:** 100-300MB
- **CPU:** 1-5% (spikes during activity)
- **Disk:** <500MB

---

**Q: Instance stopped and won't start - "Out of host capacity"**

A: Rare but can happen during Oracle maintenance. Solutions:
1. Wait a few hours and retry
2. Create new instance in different availability domain
---

## Troubleshooting

This section covers common issues you may encounter during setup and operation.

### Oracle Cloud Instance Creation Issues

**"Out of host capacity" error**

Oracle's Always Free tier has limited availability in each region.

**Solutions:**
1. Try different availability domain (AD-1, AD-2, AD-3)
2. Wait a few hours - capacity fluctuates
3. Try early morning hours (lower demand)
4. Last resort: Different region (requires new account)

---

**Can't create VCN - "Quota exceeded"**

You may already have VCNs in your tenancy. Check:

1. Oracle Console → Networking → Virtual Cloud Networks
2. Delete unused VCNs
3. Always Free tier includes 2 VCNs - should be plenty

---

**Can't assign public IP during instance creation**

This happens if you try to create a new subnet inline during instance creation instead of using the VCN wizard.

**Solution:** Follow Step 3 (Create VCN first), then use that existing VCN in Step 4.

---

### SSH Connection Issues

**"Connection refused" or "Connection timed out"**

**Check these items:**

1. **Instance is Running:**
   - Oracle Console → Compute → Instances
   - Status should be "Running" (green)
   - If stopped, click **Start**

2. **Firewall allows SSH:**
   - Instance page → Primary VNIC → Subnet → Security Lists
   - Click **Default Security List**
   - Verify Ingress Rule exists:
     - Source: `0.0.0.0/0`
     - IP Protocol: TCP
     - Destination Port Range: `22`
   - If missing, click **Add Ingress Rules** and add it

3. **SSH key permissions (macOS/Linux):**
   ```bash
   chmod 400 ~/Downloads/oracle-mrroboto.key
   ls -l ~/Downloads/oracle-mrroboto.key
   # Should show: -r-------- 1 youruser yourgroup
   ```

4. **Correct username:**
   - Ubuntu images: `ubuntu@PUBLIC_IP`
   - Oracle Linux images: `opc@PUBLIC_IP`

5. **Correct IP address:**
   - Use the **Public IP** from instance details, not private IP

---

**"Permission denied (publickey)"**

**Causes:**
- Wrong private key file
- Key not registered with instance
- Using password instead of key

**Solutions:**
```bash
# Verify you're using the correct key file
ssh -i ~/Downloads/oracle-mrroboto.key ubuntu@YOUR_PUBLIC_IP

# If key is lost, add new key via Oracle Console (see FAQ)
```

---

### Docker and Bot Issues

**"Image not found" error when pulling Docker image**

The GitHub Container Registry (GHCR) image is public.

**Verify:**
```bash
docker pull ghcr.io/jodrell2000/mrrobotov3:latest
```

**If this fails:**
1. Check VM internet connectivity: `ping -c 3 google.com`
2. Verify image exists at [github.com/jodrell2000/mrRobotoV3/packages](https://github.com/jodrell2000/mrRobotoV3/packages)
3. Try specific version: `docker pull ghcr.io/jodrell2000/mrrobotov3:1.0.0-test`

---

**Bot container starts but doesn't connect to hangout**

**Check logs:**
```bash
docker logs -f mrroboto
```

**Common causes:**

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Invalid URL" | Quotes in TTFM_GATEWAY_BASE_URL | Remove quotes from `.env` file |
| "401 Unauthorized" | Wrong BOT_USER_TOKEN | Regenerate token from tt.fm user settings |
| "Unable to resolve nickname" | Quoted values in `.env` | Remove all quotes from `.env` values |
| "Connection refused" | Network connectivity | Check: `ping gateway.prod.tt.fm` |
| "Missing required environment variable" | Incomplete `.env` | Verify all required vars are set |

**Fix:**
Use deployment script (auto-strips quotes) or manually remove quotes from `.env`.

---

**Container keeps restarting**

**Check exit status:**
```bash
docker ps -a | grep mrroboto
# Look at STATUS column
```

**View crash reason:**
```bash
docker logs mrroboto
```

**Common causes:**
- Missing environment variable - check `.env` file is complete
- Malformed `.env` - remove quotes from values
- Out of memory (unlikely with 1GB RAM for one bot)
- Port conflict (unlikely - bot doesn't expose ports)

---

**"Permission denied" when running Docker commands**

User not in docker group.

**Fix:**
```bash
sudo usermod -aG docker ubuntu
exit  # MUST log out
```

Reconnect via SSH and try again:
```bash
docker ps  # Should work without sudo
```

---

**Bot was working but stopped responding**

**1. Check if container is running:**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker ps | grep mrroboto'
```

**If not listed:**
```bash
# View last logs before crash
ssh ubuntu@YOUR_PUBLIC_IP 'docker logs --tail 100 mrroboto'

# Restart container
ssh ubuntu@YOUR_PUBLIC_IP 'docker start mrroboto'
```

**2. Check if VM is running:**
- Oracle Console → Compute → Instances
- Verify status is "Running"
- If stopped, click **Start**

**3. Try restarting:**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'docker restart -t 30 mrroboto'
```

**4. Check disk space:**
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'df -h'
# /dev/sda should not be at 100%
```

---

**Bot logs show "Error loading botConfig.json: File is empty"**

Data directory isn't properly mounted or is empty.

**Verify volume mount:**
```bash
docker inspect mrroboto | grep -A 10 Mounts
# Should show:
# Source: /home/ubuntu/mrroboto/data
# Destination: /usr/src/app/data
```

**Check data directory:**
```bash
ls -la ~/mrroboto/data/
# Should list: botConfig.json, chat.json, mrroboto.db, etc.
```

**If empty:**
The bot creates default files on first run. Or upload data:
```bash
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/sync-oracle-data.sh --upload
```

---

**Bot name or command switch shows quotes**

Your `.env` file has quoted values and Docker's `--env-file` doesn't strip them.

**Wrong:**
```bash
CHAT_NAME="Mrs. Roboto"
COMMAND_SWITCH="!"
```

**Correct:**
```bash
CHAT_NAME=Mrs. Roboto
COMMAND_SWITCH=!
```

**Solution:** Use deployment script (auto-fixes) or manually edit `.env` on VM.

---

### VM Management Issues

**VM rebooted and bot didn't restart**

Docker should auto-start, but verify:

```bash
ssh ubuntu@YOUR_PUBLIC_IP

# Check Docker service
sudo systemctl status docker

# Enable auto-start if disabled
sudo systemctl enable docker
sudo systemctl start docker

# Start bot container
docker start mrroboto
```

---

**Instance stopped and won't start - "Out of host capacity"**

Rare, but can happen during Oracle infrastructure maintenance.

**Solutions:**
1. Wait a few hours and click **Start** again
2. If persistent (>24 hours):
   - Create Boot Volume Backup: Instance → Boot Volume → Create Backup
   - Create new instance in different availability domain
   - Attach backed-up boot volume to new instance

---

**Deployment script fails with "Connection refused"**

**Verify:**
1. Can you SSH manually? `ssh ubuntu@YOUR_PUBLIC_IP`
2. Is ORACLE_IP set correctly? `echo $ORACLE_IP`
3. Is SSH key specified (if not using agent)? `echo $ORACLE_SSH_KEY`

**Debug:**
```bash
# Test SSH connection
ssh -v ubuntu@YOUR_PUBLIC_IP 'echo "Connection OK"'

# Run deployment with SSH agent
ORACLE_IP=YOUR_PUBLIC_IP ./scripts/deploy-to-oracle.sh

# Or with SSH key explicitly
ORACLE_IP=YOUR_PUBLIC_IP ORACLE_SSH_KEY=~/Downloads/oracle-mrroboto.key ./scripts/deploy-to-oracle.sh
```

---

**Disk space warning**

Check usage:
```bash
ssh ubuntu@YOUR_PUBLIC_IP 'df -h'
```

If approaching 100%:
```bash
# Clean old Docker images
ssh ubuntu@YOUR_PUBLIC_IP 'docker system prune -a -f'

# Check largest files
ssh ubuntu@YOUR_PUBLIC_IP 'du -sh ~/mrroboto/*'

# Clean logs if too large
ssh ubuntu@YOUR_PUBLIC_IP 'docker logs mrroboto 2>&1 | tail -1000 > /tmp/recent.log'
```

---

### Getting Help

If you're still stuck after checking this guide:

1. **Check bot logs** for specific error messages:
   ```bash
   ssh ubuntu@YOUR_PUBLIC_IP 'docker logs --tail 100 mrroboto'
   ```

2. **Verify environment** is correctly configured:
   ```bash
   ssh ubuntu@YOUR_PUBLIC_IP 'cat ~/mrroboto/.env'
   ```

3. **Test connectivity** from VM:
   ```bash
   ssh ubuntu@YOUR_PUBLIC_IP 'ping -c 3 gateway.prod.tt.fm'
   ```

4. **GitHub Issues**: Report bugs or ask questions at the [mrRobotoV3 repository](https://github.com/jodrell2000/mrRobotoV3/issues)

---

## Summary

You now have:
- ✅ Oracle Cloud Always Free account
- ✅ Ubuntu 24.04 VM running 24/7
- ✅ Docker installed and configured
- ✅ Mr. Roboto V3 bot deployed and running
- ✅ Automated deployment and sync scripts
- ✅ **£0/month hosting cost forever**

**Next steps:**
- Test bot commands in your hangout (`!ping`, `!help`)
- Customize bot personality in `data/botConfig.json`
- Set up regular data backups with sync script
- Update Ubuntu monthly: `ssh ubuntu@YOUR_PUBLIC_IP 'sudo apt update && sudo apt upgrade -y'`

**Useful resources:**
- [Chat Commands Documentation](CHAT_COMMANDS.md)
- [Setting Up Your Environment](SETTING_UP_YOUR_ENVIRONMENT.md)
- [GitHub Container Registry](https://github.com/jodrell2000/mrRobotoV3/pkgs/container/mrrobotov3)
- [Oracle Cloud Documentation](https://docs.oracle.com/en-us/iaas/Content/home.htm)

Enjoy your free, 24/7 cloud-hosted bot! 🎉
