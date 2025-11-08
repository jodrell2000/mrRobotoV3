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

### Option 1: Docker Setup (Recommended) 🐳

For the most consistent experience across different systems:

1. **Install Docker**: Download from [docker.com](https://www.docker.com/get-started)

2. **Clone and configure**:
   ```bash
   git clone --branch v0.4.0_alpha https://github.com/jodrell2000/mrRobotoV3.git
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

### Option 2: Traditional Node.js Setup

1. Clone the repository with the latest stable release:
   ```bash
   # Latest release (0.4.6_alpha)
   git clone --branch 0.4.6_alpha https://github.com/jodrell2000/mrRobotoV3.git
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

To start the bot:

```bash
npm start
```

This executes:

```bash
node src/index.js
```

## 🎯 Commands Overview

### Chat Commands
The bot supports chat commands that can be managed at runtime without code changes. Moderators can create, remove, and configure chat commands using:

```
!chatCommand add <command>                              # Create a new chat command
!chatCommand remove <command>                           # Delete a chat command
!chatCommand addMessage <command> <message>             # Add a message to a command
!chatCommand removeMessage <command> <message>          # Remove a message (exact match)
!chatCommand addImage <command> <url>                   # Add an image URL to a command
!chatCommand removeImage <command> <url>                # Remove an image (exact match)
!chatCommand addAlias <command> <alias>                 # Create an alias for a command
!chatCommand removeAlias <alias>                        # Remove an alias
```

Chat commands support message tokens:
- `{djUsername}` - Current DJ name
- `{senderUsername}` - User who triggered the command

For more information, see [WRITING_NEW_COMMANDS.md](docs/WRITING_NEW_COMMANDS.md)

## 🧪 Running Tests

Your test suite covers:

- ✅ Successful sending/fetching of private & group messages
- ✅ Error handling and fallback message conditions

To run tests:

```bash
npm test
```

Test results summary and coverage (if you run with `--coverage`) will be shown.

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
