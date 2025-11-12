# Chat Commands Documentation

This guide covers managing and using chat commands in mrRobotoV3 v0.9.0+. Chat commands allow moderators to create dynamic responses to user triggers directly from chat, without needing to modify code.

## Table of Contents

- [Overview](#overview)
- [Command Management](#command-management)
  - [Adding Commands](#adding-commands)
  - [Managing Messages](#managing-messages)
  - [Managing Images](#managing-images)
  - [Managing Aliases](#managing-aliases)
  - [Removing Commands](#removing-commands)
- [Chat Command Structure](#chat-command-structure)
- [Token System](#token-system)
- [Image Hosting](#image-hosting)
- [Image Validation](#image-validation)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

Chat commands are simple commands that trigger pre-written messages and/or images.

WHen a Chat command is used, the bot will look in the chat.json file for that command and pick a random message, and image if there are any, and send them as a message. To get things going the command "props" is included with a couple of messages and images. So if you lik the tune the current DJ is spinning use !props (or whatever your commadn switch is)

Chat commands can also have aliases. "props" has the aliases propos, porps and banger so you can use either !banger or to cover typos, !porps and !propos

Chat commands are:

- ✅ **Easy to manage**: Add/remove without code changes
- ✅ **Flexible**: Support messages, images, or both
- ✅ **Dynamic**: Can include tokens like `{djUsername}`, `{senderUsername}`, etc.
- ✅ **Aliased**: Multiple names can trigger the same command
- ✅ **Persistent**: Saved to `data/chat.json`

### Who Can Manage Commands?

Only **MODERATOR** or **OWNER** role users can manage chat commands using the `!chatCommand` command.

### File Locations

- **Commands**: `data/chat.json`
- **Aliases**: `data/aliases.json`
- **Image Cache**: `data/image-validation-cache.json` (auto-created)

---

## Command Management

### Adding Commands

Create a new chat command:

```
!chatCommand add <commandName>
```

**Example:**
```
!chatCommand add thanks
!chatCommand add welcome
```

**Response:**
```
✅ Chat command 'thanks' created successfully
```

**Rules:**
- Command names must be lowercase
- Cannot conflict with any existing static commands
- Cannot conflict with any existing chat commands
- Cannot conflict with any existing aliases

### Managing Messages

#### Add a Message to a Command

```
!chatCommand addMessage <commandName> <message>
```

**Example:**
```
!chatCommand addMessage thanks Thank you!
!chatCommand addMessage thanks Cheers!
```

**Response:**
```
✅ Message added to 'thanks'
```

**Features:**
- Random selection: If multiple messages exist, one is randomly chosen
- Tokens supported: See [Token System](#token-system)

#### Remove a Message from a Command

```
!chatCommand removeMessage <commandName> <message>
```

**Important:** The message must match exactly, including all tokens and spacing.

**Example:**
```
!chatCommand removeMessage props nice one {djUsername}, that's an absolute banger
```

**Response:**
```
✅ Message removed from 'props'
```

### Managing Images

#### Add an Image URL to a Command

```
!chatCommand addImage <commandName> <imageUrl>
```

**Example:**
```
!chatCommand addImage thanks https://media.giphy.com/media/JlpjgShzDsrMIyFu5U/giphy.gif
!chatCommand addImage thanks https://media.giphy.com/media/WRcqyW4t75sTCMrMM0/giphy.gif
```

**Response:**
```
✅ Image added to 'thanks'
```

**Features:**
- URL validation: Bot validates image hosting and URL format
- Automatic checking: Dead links are flagged during validation

#### Remove an Image from a Command

```
!chatCommand removeImage <commandName> <imageUrl>
```

**Example:**
```
!chatCommand removeImage thanks https://media.giphy.com/media/WRcqyW4t75sTCMrMM0/giphy.gif
```

**Response:**
```
✅ Image removed from 'thanks'
```

### Managing Aliases

Aliases let you create alternative names for commands.

#### Add an Alias

```
!chatCommand addAlias <aliasName> <targetCommand>
```

**Example:**
```
!chatCommand addAlias awesome props
!chatCommand addAlias sick props
```

**Response:**
```
✅ Alias 'awesome' added for command 'props'
```

Now users can use `!awesome`, `!sick`, or `!banger` to trigger the `props` command.

**Rules:**
- Alias must not conflict with existing commands, static commands or other aliases
- Alias points to an existing command

#### Remove an Alias

```
!chatCommand removeAlias <aliasName>
```

**Example:**
```
!chatCommand removeAlias awesome
```

**Response:**
```
✅ Alias 'awesome' removed
```

### Removing Commands

```
!chatCommand remove <commandName>
```

**Example:**
```
!chatCommand remove props
```

**Response:**
```
✅ Chat command 'props' removed successfully
```

**Note:** This also removes all aliases pointing to this command.

---

## Chat Command Structure

Commands are stored as JSON in `data/chat.json`:

```json
{
  "props": {
    "messages": [
      "{senderUsername} gives props to {djUsername}",
      "nice one {djUsername}, {senderUsername} thinks that's an absolute banger"
    ],
    "pictures": [
      "https://media.giphy.com/media/j2ptl95PRwZTo0IAuP/giphy.gif",
      "https://media3.giphy.com/media/8c6IfP6VuSzNVutmDS/giphy.webp"
    ]
  },
  "welcome": {
    "messages": [
      "Welcome to the room, {senderUsername}!"
    ],
    "pictures": []
  }
}
```

### Structure Details

- **commandName**: Lowercase identifier (e.g., `"props"`)
  - Must be unique
  - Used with the command prefix (e.g., `!props`)
  
- **messages**: Array of strings
  - Can be empty
  - Random message selected when command runs
  - Supports token substitution
  
- **pictures**: Array of image URLs
  - Can be empty
  - All images displayed when command runs
  - Subject to image validation

---

## Token System

Tokens are placeholders that get replaced with dynamic values when a command runs.

### Available Tokens

| Token | Description | Example |
|-------|-------------|---------|
| `{senderUsername}` | User who triggered the command | "jodrell" |
| `{djUsername}` | Current DJ name | "john_doe" |
| `{hangoutName}` | Name of the hangout | "Chill Vibes" |
| `{botName}` | Name of the bot | "MrRoboto" |
| `{currentTime}` | Current time | "14:30" (24-hour) or "2:30 PM" (12-hour) |
| `{currentDate}` | Current date | "12/11/2025" |
| `{currentDayOfWeek}` | Day of week | "Monday" |
| `{greetingTime}` | Time-based greeting | "morning", "afternoon", "evening", "night" |
| `{timezone}` | Configured timezone | "Europe/London" |
| `{locale}` | Configured locale | "en-GB" |
| `{dateFormat}` | Configured date format | "DD/MM/YYYY" |
| `{timeFormat}` | Configured time format | "24" |

### Using Tokens in Messages

**Example command with tokens:**

```
!chatCommand addMessage welcome Welcome to {hangoutName}, {senderUsername}! Current DJ is {djUsername}
```

When triggered:
```
Input:  !welcome
Output: Welcome to Chill Vibes, john_doe! Current DJ is jane_smith
```

### Token Configuration

Some tokens are configurable via the `!edit` command:

```
!edit timezone Europe/London
!edit locale en-GB
!edit timeFormat 24
!edit dateFormat DD/MM/YYYY
```

---

## Image Hosting

The bot supports images from popular hosting services:

- ✅ **Giphy** (`giphy.com`)
- ✅ **Tenor** (`tenor.com`)
- ✅ **Imgur** (`imgur.com`)
- ✅ Other image hosting services (JPEG, PNG, GIF, WebP)

### Finding Image URLs

#### Giphy
1. Visit https://giphy.com/
2. Search for an image
3. Right-click → **Copy image address**
4. Use the full HTTPS URL

#### Tenor
1. Visit https://tenor.com/
2. Search for an image
3. Right-click → **Copy image address**
4. Use the full HTTPS URL

#### Imgur
1. Visit https://imgur.com/
2. Upload or find an image
3. Right-click on the image → **Copy image address**
4. Use the full HTTPS URL

### URL Format

Always use HTTPS URLs (not HTTP):

```
✅ https://media.giphy.com/media/j2ptl95PRwZTo0IAuP/giphy.gif
❌ http://media.giphy.com/media/j2ptl95PRwZTo0IAuP/giphy.gif
```

---

## Image Validation

The image validation system automatically checks for dead or broken image links.

### What is Image Validation?

- ✅ Checks all images in chat commands
- ✅ Identifies broken/404 links
- ✅ Caches results for performance (30-day TTL)
- ✅ Allows bulk removal of dead images

### Using Image Validator

#### Start Validation

```
!imageValidator start
```

**Response:**
```
✅ Image validation started. Will process 1 image per second with 30-day cache TTL
```

The bot begins validating images in the background at a rate of 1 image per second.

#### Check Status

```
!imageValidator status
```

**Response:**
```
📊 Validation Status:
- Total images: 12
- Validated: 8
- Pending: 4
- Dead images: 2
```

#### View Validation Report

```
!imageValidator report
```

**Response:**
```
📋 Image Validation Report:
Dead images found: 2

props:
  - https://media.giphy.com/media/old-dead-image.gif (404 Not Found)
  
welcome:
  - https://imgur.com/deleted-image.jpg (410 Gone)

Run '!imageValidator remove' to remove these dead images.
```

#### Remove Dead Images

```
!imageValidator remove
```

**Response:**
```
✅ Removed 2 dead images from commands
- props: removed 1 image
- welcome: removed 1 image
```

### How Validation Works

1. **HEAD Request**: Bot sends HEAD request to verify image exists
2. **Fallback**: If HEAD fails, tries GET request
3. **Timeout**: 15-second timeout per request
4. **Retry**: Failed images retried once
5. **Caching**: Results cached for 30 days
6. **Smart Re-checking**: Validates new images, expired cache, and previously dead images

### Validation Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Image found and valid | Keep |
| 404 | Image not found | Remove |
| 410 | Image gone/deleted | Remove |
| 403 | Access forbidden | May be temporary, check manually |
| 5xx | Server error | Retry later |
| Timeout | No response | Check URL manually |

---

## Examples

### Example 1: Welcome Command

Create a command for welcoming new users:

```
!chatCommand add welcome
!chatCommand addMessage welcome Welcome to {hangoutName}, {senderUsername}!
!chatCommand addMessage welcome Hey {senderUsername}, glad you joined us at {hangoutName}!
!chatCommand addImage welcome https://media.giphy.com/media/uVfEOGqIsoRJFYsAyC/200w.gif
!chatCommand addAlias hi welcome
```

Usage: `!welcome` or `!hi`

### Example 2: Rules Command

Create a command that posts hangout rules:

```
!chatCommand add rules
!chatCommand addMessage rules 📋 {hangoutName} Rules: 1️⃣ Be respectful to all users, 2️⃣ No spam or self-promotion, 3️⃣ Enjoy great music!
```

Usage: `!rules`

---

## Troubleshooting

### Issue: "Command not found"
- **Check**: Is the command prefix correct? (Usually `!`)
- **Check**: Is the command spelled correctly?
- **Check**: Is the command name lowercase?

### Issue: "Permission denied"
- **Check**: Do you have MODERATOR role?
- **Solution**: Ask an OWNER to promote you to MODERATOR

### Issue: "Image not displaying"
- **Check**: Is the URL valid and HTTPS?
- **Try**: Test the URL directly in your browser
- **Try**: Run image validation: `!imageValidator report`

### Issue: "Message not removing"
- **Check**: Does the message match exactly?
- **Note**: Message must include all tokens, punctuation, and spacing
- **Try**: Copy/paste the exact message from the command

### Issue: "Alias not working"
- **Check**: Does the target command exist?
- **Check**: Is the alias name spelled correctly?
- **Try**: Remove and recreate: `!chatCommand removeAlias name` then `!chatCommand addAlias name target`

### Issue: "Images not validating"
- **Check**: Run `!imageValidator status` to see progress
- **Check**: Are there any error messages in bot logs?
- **Try**: Restart validation: `!imageValidator start`

---

## Best Practices

1. **Use descriptive command names**: `props` instead of `p`
2. **Add multiple messages**: Users see variety, not the same message every time
3. **Test URLs before adding**: Verify images work in your browser
4. **Use tokens for personalization**: Include `{senderUsername}` or `{djUsername}`
5. **Create aliases for common alternatives**: `!awesome` → `!props`
6. **Validate regularly**: Run `!imageValidator start` weekly
7. **Remove dead images**: Use `!imageValidator remove` when reported as dead

---

## Related Documentation

- [Upgrade Guide (0.8.5 → 0.9.0)](UPGRADE_0.8.5_to_0.9.0.md)
- [Setting Up Your Environment](SETTING_UP_YOUR_ENVIRONMENT.md)
- [Writing New Commands](WRITING_NEW_COMMANDS.md)
- [Changelog](CHANGELOG.md)
