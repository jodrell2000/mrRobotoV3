# mrRobotoV3 🤖

Version 3 of Mr. Roboto — rebuilt from scratch rather than being repurposed from an existing Bot

---

## License

[![No Commercial Use](https://img.shields.io/badge/No%20Commercial%20Use-orange?style=for-the-badge&logo=hand)](LICENSE)
[![Attribution Required](https://img.shields.io/badge/Attribution%20Required-black?style=for-the-badge&logo=book)](LICENSE)

This repository is licensed under the **NonCommercial–Attribution License (NC-ATTR)**.
- **NonCommercial use only** – You may not use this project for commercial purposes.
- **Attribution required** – You must credit the original author in any forks, copies, or redistributions.
- See the [LICENSE](LICENSE) file for full details.

---

This code is provided free of charge with the licensing above attached, however if you find it useful, please consider buying me a coffee to say thanks.

<a href="https://www.buymeacoffee.com/jodrell" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## 🛠️ Prerequisites

- **Node.js** v16+ (tested on v20)
- **npm** v8+ (installed with Node)

---

## 🚀 Setup

### Option 1: Oracle Cloud Deployment (Recommended) ☁️

Deploy your bot to Oracle Cloud for **free** 24/7 hosting on the Always Free tier:

- **£0/month forever** - No expiration, no credit card charges
- **24/7 availability** - Always online, no downtime
- **Automated deployment** - Simple one-command deployment script
- **Full VM control** - Complete Linux environment

📖 **Complete Cloud Hosting Guide**: [Cloud Hosting Documentation](docs/CLOUD_HOSTING.md)

Quick start:
```bash
# After setting up your Oracle Cloud VM (see guide above)
# Windows users: Use Git Bash, not PowerShell/CMD
ORACLE_IP=YOUR_VM_IP ./scripts/deploy-to-oracle.sh --upload-data
```

### Option 2: Docker Setup (Local Development) 🐳

For local development and testing:

1. **Install Docker**: Download from [docker.com](https://www.docker.com/get-started)

2. **Clone and configure**:
   ```bash
   git clone --branch v1.0.0 https://github.com/jodrell2000/mrRobotoV3.git
   cd mrRobotoV3
   cp .env_example .env
   # Edit .env with your bot configuration (see setup guide below)
   ```

3. **Start the bot**:
   ```bash
   # Recommended: Use our management script
   ./docker.sh start

   # Or if you have JWT token issues, create a clean .env file first:
   ./create-clean-env.sh
   docker-compose up -d

   # Or use our smart startup script (handles environment issues)
   ./docker-start-safe.sh

   # Or use Docker Compose directly
   docker-compose up -d
   ```
   
   **Note**: If you encounter JWT token parsing issues, run `./create-clean-env.sh` first to create a properly formatted .env file.

4. **Manage the bot**:
   ```bash
   ./docker.sh logs     # View logs
   ./docker.sh status   # Check status
   ./docker.sh stop     # Stop the bot
   ./docker.sh help     # See all commands
   ```

📖 **Full Docker Guide**: [Docker Setup Documentation](docs/DOCKER_SETUP.md)

### Option 3: Traditional Node.js Setup

1. Clone the repository with the latest stable release:
   ```bash
   # Latest release (1.0.0)
   git clone --branch v1.0.0 https://github.com/jodrell2000/mrRobotoV3.git
   cd mrRobotoV3
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a .env file for your Bot. Details on how to obtain all the information needed to build the .env file can be found here: [Creating your .env file](docs/SETTING_UP_YOUR_ENVIRONMENT.md)

4. From the root of the project folder, run the following command. It should read and output the config you've just created. If it doesn't then something is wrong and the application won't be able to read it either
   ```
   node check-dotenv.js
   ```
---

## ✅ Running the App

**Cloud Deployment (Recommended):** See [Cloud Hosting Guide](docs/CLOUD_HOSTING.md) for Oracle Cloud setup.

**Local Development:** After completing setup above, start commands are covered in each setup option:
- Docker: `./docker.sh start` (see [Docker Setup](docs/DOCKER_SETUP.md))
- Node.js: `npm start` (executes `node src/index.js`)

## 🎯 Commands Overview

### Getting Help

The bot has a built-in help system accessible via `!help`:

```
!help                    # List all available commands
!help <command>          # Get detailed help for a specific command
```

Each command also has its own `--help` flag:
```
!chatCommand --help      # Show chatCommand usage and options
!edit --help             # Show edit command syntax
```

### Core Commands

#### `!chatCommand` - Runtime Command Management
Create and manage custom chat commands without code changes (moderator/owner only):

```
!chatCommand add <command>                  # Create new command
!chatCommand addMessage <command> <message> # Add response message
!chatCommand addImage <command> <url>       # Add image response
!chatCommand addAlias <command> <alias>     # Create alias
!chatCommand list                           # List all chat commands
```

Supports tokens: `{djUsername}`, `{senderUsername}`

#### `!edit` - Template Editing
Modify bot message templates (moderator/owner only):

```
!edit list                                  # Show editable templates
!edit <template> <new message>              # Update a template
```

Common templates: `welcomeMessage`, `djChangeMessage`, `songStartMessage`

📖 **Full Documentation**: 
- [Complete Commands List](docs/CHAT_COMMANDS.md)
- [Writing New Commands](docs/WRITING_NEW_COMMANDS.md)
- [Controlling Your Bot](docs/CONTROLLING_YOUR_BOT.md)

---

## 🤝 Feedback & Contributions

All welcome! Whether it's fixing an issue, suggesting improvements, or helping with features, feel free to open a PR or issue.

---


## Developing for Hangout FM

In order to receive actions from the site your Bot connects to the Turntable LIVE Socket Client and runs commands using both the socket, and by calling the Hang.fm REST endpoints

Details for the socket can be found here: https://www.npmjs.com/package/ttfm-socket

Details about the various REST endpoints can be found on the following Swagger pages
* The User Service: https://gateway.prod.tt.fm/api/user-service/api/
* The Room Service: https://gateway.prod.tt.fm/api/room-service/api/
* The Social Service: https://gateway.prod.tt.fm/api/social-service/api/
* The Playlist Service: https://gateway.prod.tt.fm/api/playlist-service/api/
