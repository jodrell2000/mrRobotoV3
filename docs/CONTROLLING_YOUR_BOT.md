# Controlling Your Bot: Complete Guide

This guide covers all the ways you can control and customize your Mr. Roboto bot, from editing messages and AI behavior to managing features and commands.

## 🔒 Privacy First: Use Direct Messages

**Important**: All bot control commands can be used in direct messages with the bot to avoid cluttering the public chat. Simply send the bot a private message with any of the commands below. The bot will respond privately, keeping your configuration work organized and discrete.

## 📝 Editing Messages and Templates

The bot uses customizable templates for various messages. Use the `!edit` command to modify these templates.

### Available Edit Commands

#### View Available Items
```
!edit list
```
This shows all editable messages, AI question templates, and system settings organized by category.

#### Edit a Template
```
!edit <templateName> <newContent>
```

**Example:**
```
!edit welcomeMessage Welcome {username}! 🎵 Ready to rock in {hangoutName}?
```

### Message Templates

#### User Interaction Messages
- **welcomeMessage** - Greeting when users join the room
  - Tokens: `{username}`, `{hangoutName}`, `{botName}`
  - Default: "Welcome {username} to {hangoutName}!"

#### Music Event Messages
- **nowPlayingMessage** - Announcement when a song starts
  - Tokens: `{username}`, `{trackName}`, `{artistName}`, `{botName}`
  - Default: "{username} is now playing {trackName} by {artistName}"

- **justPlayedMessage** - Summary after a song finishes
  - Tokens: `{username}`, `{trackName}`, `{artistName}`, `{likes}`, `{dislikes}`, `{stars}`, `{botName}`
  - Default: "{username} played...\n{trackName} by {artistName}\nStats: 👍 {likes} 👎 {dislikes} ❤️ {stars}"

### AI Question Templates

These templates control how the bot asks AI questions about music:

- **popfactsQuestion** - Template for interesting facts about songs used by the popfacts command
- **whatyearQuestion** - Template for release year queries used by the whatyear command
- **meaningQuestion** - Template for song meaning analysis used by the meaning command
- **bandQuestion** - Template for artist information used by the band command
- **introQuestion** - Template for artist introductions used by the intro command

**Example AI template edit:**
```
!edit popfactsQuestion Tell me 3 fascinating facts about {trackName} by {artistName} that would surprise music fans!
```

### Available Template Tokens

Templates support dynamic content through tokens that get replaced with real data:

- `{username}` - The user's display name
- `{hangoutName}` - The name of your music room
- `{botName}` - Your bot's name
- `{trackName}` - The current song title
- `{artistName}` - The current artist name
- `{likes}` - Number of likes the song received
- `{dislikes}` - Number of dislikes the song received
- `{stars}` - Number of stars/favorites the song received

## 🤖 AI Personality and Instructions

Control how your bot's AI responds and behaves using specialized system settings. These instructions are sent when the chat is created with the AI system, meaning you don't have to include this kind of information with all indivitual question command templates.

### AI Personality
```
!edit MLPersonality You are a chill, knowledgeable music curator for {hangoutName}. Respond like a friendly record store owner who knows everything about music history.
```

This defines the overall character and tone of your bot's AI responses.

### AI Instructions
```
!edit MLInstructions Always fact-check information using reliable sources such as MusicBrainz or Wikipedia. Keep responses under 200 words. Use emojis sparingly but effectively.
```

This provides specific behavioral guidelines for how the AI should operate.

### How AI Settings Work Together

The bot combines your personality and instructions to create a comprehensive system prompt for AI responses. The personality sets the "who" (character/tone) while instructions set the "how" (behavior/rules).

**Example combination:**
- **Personality**: "Friendly radio DJ for {hangoutName}"
- **Instructions**: "Keep responses under 100 words and always be positive"
- **Result**: AI responds as an upbeat DJ with concise, positive messages

## ⚙️ Feature Management

Control major bot capabilities with the `!feature` command.

### View Feature Status
```
!feature list
```
Shows all available features and their current status (enabled/disabled).

### Toggle Features
```
!feature <featureName> <on|off>
```

**Examples:**
```
!feature aiQuestions on
!feature welcomeMessages off
!feature musicStats on
```

### Common Features
- **aiQuestions** - AI-powered music information responses
- **welcomeMessages** - Greeting new users
- **musicStats** - Song statistics tracking and display
- **popfacts** - Interesting facts about songs
- **whatyear** - Song release year information
- **meaning** - Song lyric meaning analysis
- **bandinfo** - Artist information responses

## 🎛️ Command Management

Enable or disable specific bot commands with the `!command` command.

### View Command Status
```
!command list
```
Shows all bot commands and their availability status.

### Toggle Commands
```
!command <commandName> <on|off>
```

**Examples:**
```
!command ping off
!command help on
!command status off
```

This is useful for:
- Removing commands you don't want users to access
- Temporarily disabling problematic features
- Customizing the bot's available functionality

## 🔧 Administrative Controls

### Bot Settings
- **!changebotname** - Change the bot's display name
- **!state** - View current bot configuration and status
- **!status** - Check bot operational status

### Permission Levels
Commands have different permission requirements:
- **USER** - Available to all room members
- **MODERATOR** - Requires room moderator privileges
- **OWNER** - Requires room owner privileges

Most control commands require OWNER privileges for security.

## 💡 Best Practices

### Message Design
1. **Keep it conversational** - Write templates as if the bot is speaking naturally
2. **Use tokens wisely** - Personalize messages with user/song information
3. **Test your changes** - Send a test message to see how templates look in practice
4. **Consider context** - Remember when and how often these messages appear

### AI Configuration
1. **Be specific** - Clear personality and instructions lead to better responses
2. **Set boundaries** - Use instructions to define response length, tone, and content limits
3. **Match your room** - Tailor the AI personality to your community's vibe
4. **Iterate and improve** - Adjust based on how the AI actually responds

### Feature Management
1. **Start simple** - Enable core features first, add advanced ones gradually
2. **Monitor usage** - Disable features that aren't useful to your community
3. **Seasonal adjustments** - Turn features on/off for special events or themes

### Privacy and Organization
1. **Use direct messages** - Keep configuration work private and organized
2. **Document changes** - Keep track of what templates and settings work best
3. **Test thoroughly** - Verify changes work as expected before announcing them

## 🆘 Troubleshooting

### Common Issues

**Template not updating?**
- Check that you're using the exact template name from `!edit list`
- Verify you have OWNER permissions
- Make sure you're using valid token names

**AI responses seem wrong?**
- Review your MLPersonality and MLInstructions settings
- Check if conflicting instructions are causing confusion
- Try simpler, more direct personality/instruction text

**Features not working?**
- Use `!feature list` to check if the feature is enabled
- Verify related commands are also enabled with `!command list`
- Check the bot's overall status with `!status`

**Can't access commands?**
- Verify you have the required permission level (usually OWNER for control commands)
- Make sure the command itself is enabled
- Try using the command in a direct message

### Getting Help

If you encounter issues:
1. Check the `!help` command for quick reference
2. Use `!state` to see current configuration
3. Review this documentation for proper usage patterns
4. Test changes incrementally to isolate problems

## 📋 Quick Reference

### Essential Commands
```bash
# View what you can edit
!edit list

# Edit a template
!edit templateName new content here

# Check feature status
!feature list

# Toggle a feature
!feature featureName on/off

# Check command status  
!command list

# Toggle a command
!command commandName on/off

# Check bot status
!status
!state
```

### Remember
- Use direct messages for privacy
- OWNER permissions required for most control commands  
- Templates support dynamic tokens like {username} and {trackName}
- AI personality and instructions work together
- Test changes before announcing them to your community

---

*This documentation covers Mr. Roboto V3's complete control system. For technical implementation details, see the other documentation files in this repository.*