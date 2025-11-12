# Upgrade Guide: 0.8.5_beta → 0.9.0_beta

This guide walks you through upgrading from mrRobotoV3 version 0.8.5_beta to 0.9.0_beta. **Estimated time: 5-10 minutes**

## Overview of Changes

Version 0.9.0_beta introduces a major new feature: **Chat Command Management System** and **Image Validation Tool**. These features require new data files and configuration.

### What's New
- ✅ Dynamic chat command system with full CRUD operations
- ✅ Automated image validation and dead link detection
- ✅ New data files: `chat.json` and `aliases.json` for managing chat commands
- ✅ Image validation cache for performance optimization

## Step-by-Step Upgrade Instructions

### Step 1: Check the new directory structure exists
With this new version a data folder should have been created at the root level of the project

By default it will contain the following
```
data/
├── botConfig.json_example
├── chat.json_example
├── aliases.json_example
└── themes.json_example
```

The Bot data has been moved into this folder. You can copy your existing file into this folder, but you also need to rename it. We'll leave the original file where it is as a backup for now

```bash
cp data.json data/botConfig.json
```

### Step 2: Create `chat.json` from Example

The new chat command system stores commands in `chat.json`.

1. Navigate to your `data` directory
2. Copy `chat.json_example` to `chat.json`:
   ```bash
   cp data/chat.json_example data/chat.json
   ```

### Step 3: Create `aliases.json` from Example

Chat command aliases allow alternative names to trigger the same command.

1. In your `data` directory, copy `aliases.json_example` to `aliases.json`:
   ```bash
   cp data/aliases.json_example data/aliases.json
   ```


### Step 6: Verify Data File Structure

Your `data` directory should now contain:

```
data/
├── botConfig.json
├── botConfig.json_example
├── chat.json
├── chat.json_example
├── aliases.json
├── aliases.json_example
└── themes.json
```

### Step 7: Start the Bot

Start the upgraded bot as you normally would. Docker is the preferred method using the safe script:

```bash
./docker-start-safe.sh
```

But you can use npm directly if you want to
```bash
npm start
```

Monitor the logs to ensure everything starts correctly. You should see initialization messages for the chat command system.

## What You Can Do Now
MODERATORs can now edit and create new chat picture/message commands directly in the public or private chat that any Hangout user can use
See [CHAT_COMMANDS.md](CHAT_COMMANDS.md) for complete documentation.

## Troubleshooting

### Issue: "chat.json not found"
**Solution**: Make sure you created `chat.json` from `chat.json_example` in the `data` directory.

### Issue: "aliases.json not found"
**Solution**: Make sure you created `aliases.json` from `aliases.json_example` in the `data` directory.

### Issue: Chat commands not appearing in chat
**Solution**: Verify that your `.env` file has the correct `COMMAND_PREFIX` setting.

### Issue: Image validation not starting
**Solution**: Ensure you have MODERATOR role and check the bot logs for errors.


## Support

For more information about the new features:
- [Chat Commands Documentation](CHAT_COMMANDS.md)
- [Changelog](CHANGELOG.md)
- [Writing New Commands](WRITING_NEW_COMMANDS.md)

---
