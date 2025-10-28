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

Templates support dynamic content through tokens that get replaced with real data. The bot provides both built-in tokens and allows you to create custom tokens.

#### Built-in Context Tokens
- `{username}` - The user's display name
- `{hangoutName}` - The name of your music room
- `{botName}` - Your bot's name
- `{trackName}` - The current song title
- `{artistName}` - The current artist name
- `{likes}` - Number of likes the song received
- `{dislikes}` - Number of dislikes the song received
- `{stars}` - Number of stars/favorites the song received

#### Built-in Time/Date Tokens (Timezone-Aware)
- `{currentTime}` - Current time in your configured timezone
- `{currentDate}` - Current date in your configured locale
- `{currentDayOfWeek}` - Current day of the week
- `{greetingTime}` - Time-based greeting (morning, afternoon, evening, night)

#### Custom Tokens
You can create your own tokens using the `!token` command for reusable content across templates. See the **Advanced Token System** section below for complete details.

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

## 🏷️ Advanced Token System

The bot includes a powerful token system that allows you to create custom, reusable text snippets and configure timezone-aware date/time tokens.

### Built-in Tokens

The bot provides several built-in tokens that work throughout the system:

#### Context Tokens (Available During Events)
- `{username}` - User who triggered the event or current DJ
- `{trackName}` - Current or referenced song title  
- `{artistName}` - Current or referenced artist name
- `{hangoutName}` - Name of your music room
- `{botName}` - Your bot's current nickname
- `{likes}`, `{dislikes}`, `{stars}` - Song statistics

#### Time & Date Tokens (Timezone-Aware)
- `{currentTime}` - Current time in your configured timezone
- `{currentDate}` - Current date in your configured locale format
- `{currentDayOfWeek}` - Current day of the week
- `{greetingTime}` - Time-based greeting that changes throughout the day:
  - "morning" (5:00 AM - 11:59 AM)
  - "afternoon" (12:00 PM - 4:59 PM)
  - "evening" (5:00 PM - 8:59 PM)
  - "night" (9:00 PM - 4:59 AM)

**Example usage in a template:**
```
!edit welcomeMessage Good {greetingTime} {username}! Welcome to {hangoutName} at {currentTime} on {currentDayOfWeek}! 🎵
```

### Custom Token Management

Create and manage your own custom tokens using the `!token` command.

#### View All Available Tokens
```
!token list
```
This displays all built-in tokens, custom tokens, and context tokens with their descriptions.

#### Create Custom Tokens
```
!token add <tokenName> <value> [description]
```

**Examples:**
```
!token add greeting "🎶 Welcome to our awesome music community!"
!token add djTip "Remember to keep the energy high!" "Helpful tip for DJs"
!token add roomRules "Be respectful and enjoy the music 🎵"
```

#### Remove Custom Tokens
```
!token remove <tokenName>
```

**Example:**
```
!token remove greeting
```

#### Test Token Replacement
```
!token test <text with tokens>
```

**Examples:**
```
!token test "Hello {username}, the time is {currentTime}"
!token test "{greeting} It's {currentDayOfWeek} at {currentTime}!"
```

### Timezone Configuration

Configure how date and time tokens display information for your location.

#### Configure Timezone
```
!edit timezone <timezone>
```

**Examples:**
```
!edit timezone Europe/London     # UK time
!edit timezone America/New_York  # US Eastern time
!edit timezone America/Los_Angeles  # US Pacific time
!edit timezone Australia/Sydney  # Australian Eastern time
!edit timezone Asia/Tokyo        # Japan time
```

#### Configure Locale
```
!edit locale <locale>
```

**Examples:**
```
!edit locale en-GB  # British English
!edit locale en-US  # American English  
!edit locale fr-FR  # French
!edit locale de-DE  # German
```

#### Configure Time Format
```
!edit timeFormat <12|24>
```

**Examples:**
```
!edit timeFormat 24  # 24-hour format (14:30)
!edit timeFormat 12  # 12-hour format (2:30 PM)
```

### Using Custom Tokens in Templates

Once created, custom tokens work just like built-in tokens in any template:

```
!token add signature "- {botName}, your friendly DJ bot"
!edit nowPlayingMessage "🎵 Now playing: {trackName} by {artistName} {signature}"
```

### Advanced Token Features

#### Dynamic Tokens
Custom tokens can contain other tokens, creating powerful combinations:

```
!token add timeGreeting "Good {greetingTime}! It's {currentTime} on {currentDayOfWeek}"
!edit welcomeMessage "{timeGreeting} Welcome {username} to {hangoutName}!"
```

#### Conditional Content
Use custom tokens to create template variations:

```
!token add weekendVibes "🎉 Weekend party mode activated!"
!token add weekdayVibes "🎵 Midweek music therapy session"
```

### Token System Benefits

1. **Consistency** - Use the same custom content across multiple templates
2. **Easy Updates** - Change a custom token once to update all templates using it
3. **Localization** - Configure timezone and locale for your community
4. **Personalization** - Create tokens that reflect your room's personality
5. **Efficiency** - Reduce repetitive text in templates

### Best Practices for Tokens

1. **Descriptive Names** - Use clear token names like `greeting` instead of `g1`
2. **Add Descriptions** - Document what your custom tokens are for
3. **Test Changes** - Use `!token test` to verify tokens work as expected
4. **Keep It Simple** - Avoid overly complex token combinations
5. **Regular Cleanup** - Remove unused custom tokens periodically

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

# Token management
!token list
!token add tokenName "value" "description"
!token remove tokenName
!token test "text with {tokens}"

# Configuration
!edit timezone Europe/London
!edit locale en-GB
!edit timeFormat 24

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
- Create custom tokens for reusable content across templates
- Configure timezone and locale for accurate time/date tokens
- AI personality and instructions work together
- Test changes before announcing them to your community

---

*This documentation covers Mr. Roboto V3's complete control system. For technical implementation details, see the other documentation files in this repository.*