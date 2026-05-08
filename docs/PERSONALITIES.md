# Personality Store

The Personality Store allows you to save, manage, and switch between different bot configurations as named "personalities". Each personality stores your complete bot setup including AI behavior, messages, configuration, features, triggers, and tokens.

## Quick Start

```bash
# Save your current setup (automatically activates it)
!personality save "My Setup" "Description here"

# List all saved personalities
!personality list

# Switch to a different personality
!personality activate "My Setup"

# Update the active personality with changes
!personality update

# Or update a specific personality
!personality update "My Setup"

# Delete a personality
!personality delete "My Setup"
```

## Commands

### `!personality list`
Display all saved personalities with their descriptions and creation dates.

**Example:**
```
!personality list
```

**Output:**
```
🔵 Active: Public Mode - Restricted features for public sessions

📋 All Personalities:
• Public Mode - Restricted features for public sessions (created: 01/05/2026)
• Admin Mode - Full features for admin work (created: 30/04/2026)
• Event Mode - Custom settings for themed events (created: 28/04/2026)
```

### `!personality show <name>`
View a specific personality's AI personality text (truncated preview).

**Examples:**
```
!personality show "Admin Mode"
!personality show admin           # Case-insensitive
```

**Output:**
```
📖 Personality: Admin Mode

You are an enthusiastic DJ assistant with full administrative capabilities...
```

**Note:** Names are case-insensitive. "Admin Mode", "admin mode", and "ADMIN MODE" all refer to the same personality.

### `!personality showall <name>`
View complete details of a personality including all configuration.

**Example:**
```
!personality showall "Admin Mode"
```

**Output:** Shows all personality data organized in sections:
- Name and description
- ML Personality and Instructions
- Editable Messages (welcome, nowPlaying, justPlayed, theme)
- Configuration settings
- ML Questions
- Disabled Commands/Features
- Triggers and Custom Tokens
- Metadata (created, updated timestamps)

### `!personality save <name> <description>`
Save your current bot configuration as a named personality and activate it.

**Required:**
- **Name**: Unique identifier for the personality (case-insensitive)
- **Description**: Brief description (max 50 characters) shown in listings

**Examples:**
```
!personality save "Public Mode" "Restricted features for public sessions"
!personality save "Admin Mode" "Full features for admin work"
```

**Behavior:**
- Saves your current configuration to the database
- Automatically activates the newly saved personality
- The personality becomes the "active" personality

**What Gets Saved:**
- Bot name (not avatar or color - those remain constant)
- AI personality and instructions
- Editable message templates (welcomeMessage, nowPlayingMessage, justPlayedMessage, theme)
- Bot configuration settings
- ML question templates
- Disabled commands and features
- Chat triggers
- Custom tokens

**What Doesn't Get Saved:**
- Bot avatar and color - set once at bot creation, remain constant across personalities
- ML conversation history - preserved across personality changes
- Personalized welcome messages (per-user custom messages/pictures set via `!editwelcome`)

**Validation:**
- Description is required and must be 50 characters or less
- Name must be unique (case-insensitive)

### `!personality update [name] [description]`
Update an existing personality with your current bot configuration.

**Examples:**
```
# Update currently active personality
!personality update

# Update specific personality by name
!personality update "Admin Mode"

# Update with new description
!personality update "Admin Mode" "Updated description here"
```

**Behavior:**
- Without a name: Updates the currently active personality
- With a name: Updates the specified personality
- Useful when you've made changes and want to save them back

**Description:**
- Optional when updating
- If provided, must be 50 characters or less
- Replaces existing description

### `!personality activate <name>`
Load a saved personality, applying all its settings to your bot.

**Examples:**
```
!personality activate "Public Mode"
!personality activate public        # Case-insensitive
```

**What Happens:**
- All bot settings are replaced with the personality's stored configuration
- Bot name changes to match the personality (via TT.fm API)
- CometChat connection is refreshed to update the display name in chat
- Bot avatar and color remain unchanged (set at bot creation)
- AI personality and behavior changes immediately
- ML conversation history is preserved (maintains song/conversation context)
- The bot tracks this as the "active" personality

### `!personality delete <name>`
Remove a personality from the database.

**Examples:**
```
!personality delete "Old Setup"
!personality delete old             # Case-insensitive
```

**Behavior:**
- Permanently removes the personality
- If deleting the currently active personality, clears the active personality tracking
- Confirmation message shows the personality name with proper casing

## Use Cases

### Time-Based Personalities
Switch between different personalities based on time of day:

```bash
# Morning: upbeat and energetic
!personality activate "Morning Energy"

# Evening: chill and relaxed
!personality activate "Evening Vibes"
```

### Event-Based Switching
Different setups for different events:

```bash
# Regular DJ session
!personality activate "Standard DJ"

# Special themed event
!personality activate "80s Night DJ"

# Back to normal after event
!personality activate "Standard DJ"
```

### Testing and Development
Safe experimentation without losing your working configuration:

```bash
# Save current stable setup
!personality save "Stable Production" "Known working configuration"

# Experiment with changes
# ... make changes to botConfig ...
!personality save "Experimental Test" "Testing new features"

# Compare both versions
!personality showall "Stable Production"
!personality showall "Experimental Test"

# Revert if needed
!personality activate "Stable Production"
```

### Mode-Based Personalities
Different feature sets for different situations:

```bash
# Admin Mode
!personality save "Admin Mode" "All features enabled"
# - All commands enabled
# - All features enabled
# - Full configuration access

# Public Mode
!personality save "Public Mode" "Restricted for public sessions"
# - Limited command set
# - Restricted features
# - Safe configuration

# Event Mode
!personality save "Event Mode" "Custom for themed events"
# - Custom welcome messages
# - Themed triggers
# - Event-specific tokens
```

### Iterative Refinement
Improve a personality over time:

```bash
# Activate personality to work on
!personality activate "Chill DJ"

# Test in hangout, make manual tweaks
# ... edit botConfig settings through other commands ...

# Save improvements
!personality update current

# Continue testing and refining
```

## Case-Insensitive Names

Personality names are **case-insensitive**. These all refer to the same personality:
- "Admin Mode"
- "admin mode"
- "ADMIN MODE"
- "AdMiN MoDe"

The original case you use when saving is preserved and displayed in listings.

## Workflow Examples

### Initial Setup

```bash
# 1. Save your current configuration as baseline (automatically activates it)
!personality save "Original Setup" "Initial bot configuration"

# 2. List to verify
!personality list

# 3. View details
!personality showall "Original Setup"
```

### Creating Variations

```bash
# 1. Start with a saved personality
!personality activate "Original Setup"

# 2. Make changes using other commands
!edit MLPersonality "You are now a chill, laid-back DJ..."
!edit welcomeMessage "Hey there! 🎵 Welcome to the vibe, {username}!"

# 3. Save as new personality
!personality save "Chill Mode" "Relaxed personality for late nights"
```

### Making Updates

```bash
# 1. Activate the personality to update
!personality activate "Chill Mode"

# 2. Make your changes
!edit MLPersonality "Updated personality text..."
!feature announcements disable

# 3. Save changes back to the active personality
!personality update

# Or specify by name
!personality update "Chill Mode"
```

### Switching Between Modes

```bash
# Quick switching
!personality activate "Admin Mode"      # Full features for setup
!personality activate "Public Mode"     # Safe mode for public sessions
!personality activate "Event Mode"      # Special event configuration
```

## Best Practices

### Naming Conventions

**Good Names:**
- `Admin Mode` - Clear purpose
- `Public Session` - Describes context
- `80s Night DJ` - Event-specific
- `Testing v2` - Version tracking

**Avoid:**
- `test` - Too vague
- `asdf` - Not descriptive

### Descriptions

Descriptions are limited to 50 characters and displayed in listings. Make them count:

**Good Descriptions:**
- `Full features for admin work` (28 chars)
- `Restricted features for public sessions` (39 chars)
- `Custom settings for themed events` (34 chars)

**Too Long:**
- `This is my personality for when I'm doing administrative work and need all features enabled` (92 chars) ❌

### Organization Strategy

1. **Start with a baseline**: Save your current setup before experimenting
2. **Use descriptive names**: Make it obvious what each personality is for
3. **Document in descriptions**: Use the 50 characters to explain the purpose
4. **Regular cleanup**: Delete personalities you no longer use
5. **Test before activating**: Use `showall` to preview before switching

### Safety Tips

1. **Always save first**: Before making major changes, save your current setup
   ```bash
   !personality save "Backup $(date)" "Pre-update backup"
   ```

2. **Preview before activating**: Use `showall` to check what you're switching to
   ```bash
   !personality showall "New Setup"
   !personality activate "New Setup"
   ```

3. **Keep a stable baseline**: Always maintain one known-good personality
   ```bash
   !personality save "Stable Baseline" "Verified working configuration"
   ```

## Technical Details

### What's Stored

Each personality stores a complete snapshot of your bot configuration:

**Bot Identity:**
- Bot name (CHAT_NAME) - updated via TT.fm API when personality is activated, with automatic CometChat reconnection to refresh display name

**Note:** Avatar ID and color are set once during bot creation and remain constant across all personalities.

**Instructions:****
- `MLPersonality` - AI personality description
- `MLInstructions` - AI behavioral instructions

**Messages:**
- `welcomeMessage` - General user greeting template (applies to all users)
- `nowPlayingMessage` - Song announcement template
- `justPlayedMessage` - Recently played template
- `theme` - Hangout theme setting
- `readTheme` - Theme reading preference

**Note:** Personalized welcome messages (per-user custom messages/pictures managed by `!editwelcome` and stored in `welcomeMessages.json`) are **NOT** included in personalities. These remain constant across personality switches.

**Configuration:**
- All bot configuration settings
- Feature toggles
- Behavioral preferences

**ML Questions:**
- `popfactsQuestion` - Song/artist facts prompt
- `whatyearQuestion` - Release year prompt
- `meaningQuestion` - Lyrics meaning prompt
- `bandQuestion` - Artist/band info prompt
- `introQuestion` - Song introduction prompt

**Disabled Items:**
- Disabled commands list
- Disabled features list

**Custom Behavior:**
- Chat triggers (exact, contains, regex)
- Custom token definitions

### Storage Efficiency

The database automatically deduplicates identical content:
- If two personalities share the same welcome message, only one copy is stored
- When you update a personality, shared content is preserved for other personalities
- Storage savings: typically 40-60% for personalities with overlapping content

### Active Personality Tracking

The bot tracks which personality is currently active:
- Stored in `botConfig.activePersonality`
- Used by the `update current` command
- Cleared when you delete the active personality
- Shown at the top of `personality list` output

## Troubleshooting

### "Personality not found"

**Possible causes:**
- Typo in the name
- Case sensitivity issue (verify with list)

**Solution:**
```bash
# List all personalities to see exact names
!personality list

# The bot suggests similar names if it finds close matches
```

### "Description required"

**Problem:** You tried to save without a description

**Solution:**
```bash
# Always include description in quotes
!personality save "My Setup" "Description here"
```

### "Description must be 50 characters or less"

**Problem:** Your description is too long

**Solution:**
```bash
# Current length shown in error message
# Shorten your description
!personality save "My Setup" "Brief description"
```

### "Personality already exists"

**Problem:** Name already in use (case-insensitive)

**Solution:**
```bash
# Use update instead of save
!personality update "Existing Name"

# Or choose a different name
!personality save "New Name" "Description"
```

### Changes not taking effect

**Problem:** Activated personality but bot behavior unchanged

**Solution:**
1. Verify activation succeeded:
   ```bash
   !personality list  # Check for 🔵 Active indicator
   ```

2. Check the personality contains what you expect:
   ```bash
   !personality showall "Active Name"
   ```

3. ML conversation history is preserved - personality changes don't reset context

## Database Schema

For technical reference, personalities are stored in a normalized SQLite database with 17 tables:

- **1 central table**: `personalities` (id, name, description, timestamps)
- **5 type tables**: Categorize content (instruction_types, editable_message_types, etc.)
- **8 content tables**: Store actual data (instructions, editable_messages, configurations, etc.)
- **8 junction tables**: Link personalities to content (many-to-many relationships)

**Key features:**
- Case-insensitive name matching (COLLATE NOCASE)
- Automatic content deduplication
- Foreign key constraints with CASCADE delete
- Prepared statements for SQL injection protection
- Transactional updates for data consistency

## Permissions

### Moderator Access

Moderators can:
- `!personality list` - View all saved personalities
- `!personality show <name>` - View personality overview (truncated ML personality text)
- `!personality activate <name>` - Switch to a different personality

### Owner-Only Access

Only the bot owner can:
- `!personality showall <name>` - View full personality details (complete configuration)
- `!personality save <name> <description>` - Save new personalities
- `!personality update <name>` - Update existing personalities
- `!personality delete <name>` - Delete personalities

This permission model allows moderators to switch between existing bot configurations (useful for events or time-based changes) and view basic personality information, while maintaining tight control over full configuration details and personality modification.

## Related Commands

These commands work together with the personality system:

- `!edit` - Manage editable message/question templates (including MLPersonality, MLInstructions, welcomeMessage, etc.)
- `!feature` - Enable/disable bot features
- `!command` - Enable/disable bot commands
- `!trigger` - Manage chat triggers
- `!token` - Manage custom tokens
- `!editwelcome` - Manage personalized per-user welcome messages (NOT saved in personalities)

**Important:** Changes made with `!edit`, `!feature`, `!command`, `!trigger`, and `!token` can be saved to a personality using `!personality update current`. However, personalized welcome messages set via `!editwelcome` are stored separately and persist across all personality switches.

## Version History

- **v1.1.0** (2026-05-01) - Initial release of Personality Store feature

---
