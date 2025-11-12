# Writing New Commands

This guide explains how to create new bot commands for mrRobotoV3.

## File Structure

Commands are organized in logical folders within the `src/commands` directory for better organization and developer clarity.

### Command Folders

1. **`Bot Commands/`** - Bot management and administration commands
   - Example: changebotname, status, feature
2. **`General Commands/`** - General user-facing commands  
   - Example: echo, help, ping
3. **`Edit Commands/`** - Commands for editing bot messages and templates
   - Example: edit (for message templates)
4. **`Debug Commands/`** - Debugging and diagnostic commands (usually hidden)
   - Example: state
5. **`ML Commands/`** - Machine learning and AI-powered commands
   - Example: popfacts

### Creating New Commands

1. **Choose the appropriate folder** based on your command's purpose
2. **Create a new file** following the pattern: `handleXXXCommand.js` (where XXX is your command name)
3. **The command name** will be extracted from the filename automatically

Example:
```javascript
// For a command !ping that checks bot responsiveness
// Create: src/commands/General Commands/handlePingCommand.js
// Users will type: !ping

// For a command !restart that manages the bot (owner-only)
// Create: src/commands/Bot Commands/handleRestartCommand.js
// Users will type: !restart
```

### Folder Guidelines

**Bot Commands** - Use for:
- Bot configuration and settings
- Administrative functions
- Owner/moderator management tools

**General Commands** - Use for:
- User-friendly utility commands
- Fun or entertainment commands
- Basic bot interactions

**Edit Commands** - Use for:
- Template editing commands
- Message customization features
- Content management tools

**Debug Commands** - Use for:
- Diagnostic and troubleshooting commands
- Internal state inspection
- Developer tools (usually hidden)

**ML Commands** - Use for:
- AI-powered features
- Machine learning integrations
- Advanced content generation

## Basic Command Structure

Every command file should follow this template:

```javascript
// Set the required permission level
const requiredRole = 'USER';  // Can be: 'OWNER', 'MODERATOR', or 'USER'
const description = 'Brief description of what this command does';
const example = 'commandname argument example';  // Example usage without the command prefix
const hidden = false;  // Set to true to hide from help listing

/**
 * Handle the XXX command
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Everything after the command
 * @param {Object} commandParams.services - All available services
 * @param {Object} commandParams.context - Additional context (sender info etc.)
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} - Command result
 */
async function handleXXXCommand(commandParams) {
    const { args, services, context, responseChannel = 'request' } = commandParams;
    const { messageService } = services;  // Extract any services you need

    // Your command logic here
    const response = `Command XXX executed with args: ${args}`;
    
    // Use messageService.sendResponse for automatic channel routing
    await messageService.sendResponse(response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    });

    return {
        success: true,
        shouldRespond: true,
        response
    };
}

// Attach metadata to the function
handleXXXCommand.requiredRole = requiredRole;
handleXXXCommand.description = description;
handleXXXCommand.example = example;
handleXXXCommand.hidden = hidden;

module.exports = handleXXXCommand;
```

## Command Parameters

The `commandParams` object contains:

| Parameter | Type | Description |
|-----------|------|-------------|
| command | string | The command name (lowercase) |
| args | string | Everything after the command |
| services | Object | All available services |
| context | Object | Sender info and message context |
| responseChannel | string | Where to send the response ('public' or 'request') |

### Available Services

Access services through `commandParams.services`:

```javascript
const { 
    messageService,    // Send messages to the room
    hangUserService,   // Interact with users
    stateService,     // Access room state
    hangoutState      // Direct access to state
} = services;
```

## Response Channels

The `responseChannel` parameter controls where the bot sends its response:

### Channel Options

- **`'request'` (default)**: Responds in the same channel as the original message
  - If the command was sent in public chat → responds in public chat
  - If the command was sent as a private message → responds as a private message
- **`'public'`**: Always responds in the public group chat, regardless of where the command originated

### Using Response Channels

Always use `messageService.sendResponse()` instead of `sendGroupMessage()` or `sendPrivateMessage()` directly:

```javascript
// ✅ Correct: Respects responseChannel setting
await messageService.sendResponse(response, {
    responseChannel,
    isPrivateMessage: context?.fullMessage?.isPrivateMessage,
    sender: context?.sender,
    services
});

// ❌ Incorrect: Always sends to group chat
await messageService.sendGroupMessage(response);

// ❌ Incorrect: Always sends private message
await messageService.sendPrivateMessage(response, sender, services);
```

### Example Response Scenarios

```javascript
// User sends "!help" in public chat with responseChannel='request'
// → Bot responds in public chat

// User sends "!help" via private message with responseChannel='request'  
// → Bot responds via private message

// User sends "!help" via private message with responseChannel='public'
// → Bot responds in public chat (announces the help publicly)
```

## Permission Levels

Set the required permission level at the top of your file:

```javascript
const requiredRole = 'USER';     // Most permissive - allows all users
const requiredRole = 'MODERATOR'; // Requires moderator, coOwner, or owner
const requiredRole = 'OWNER';     // Most restrictive - requires coOwner or owner
```

Permission hierarchy (highest to lowest):
1. **OWNER** (includes: owner, coOwner roles)
2. **MODERATOR** (includes: owner, coOwner, moderator roles)  
3. **USER** (includes: all roles)

## Help System Integration

The bot includes an intelligent help system that automatically discovers and displays your commands organized by folder. Commands are displayed grouped by their folder location with role requirements clearly marked.

### Help Display Format

The help system shows commands organized by folder:

```
🤖 Available Commands:

🗂 Bot Commands:
!changebotname (OWNER) - Change the bot name
!status (MODERATOR) - Show bot status

🗂 General Commands:
!echo (USER) - Echo back your message
!ping (USER) - Check if bot is responding

🗂 Edit Commands:
!edit (MODERATOR) - Edit message templates

💡 Tip: Type !help [command] to see specific examples and usage.
```

### Required Metadata

Every command should include these metadata properties:

```javascript
const requiredRole = 'USER';           // Permission level required
const description = 'Brief description of what this command does';
const example = 'commandname argument example';  // Example usage (without ! prefix)
const hidden = false;                  // Whether to hide from help listing
```

### Metadata Guidelines

#### **Description**
- Keep it concise (under 50 characters)
- Clearly explain what the command does
- Use present tense ("Send a message", not "Sends a message")

Examples:
```javascript
const description = 'Echo back your message';
const description = 'Check if bot is responding';
const description = 'Change the bot name';
```

#### **Example**
- Show realistic usage with actual arguments
- Don't include the command prefix (`!`)
- Use placeholder values that make sense

Examples:
```javascript
const example = 'echo Hello everyone!';
const example = 'changebotname MyAwesomeBot';
const example = 'welcome Hi {username}, welcome to {hangoutName}!';
```

#### **Hidden**
- Set to `true` for internal/utility commands
- Set to `false` for user-facing commands
- Hidden commands won't appear in help listings

#### **Command State Management**
Commands are enabled by default. To disable commands at runtime:
- Use the `togglecommand` command (owner only): `!togglecommand disable commandname`
- Disabled commands are stored in `data/botConfig.json` outside of git
- Commands can be re-enabled with: `!togglecommand enable commandname`
- Check status with: `!togglecommand status commandname`

```javascript
const hidden = false;  // Normal user command
const hidden = true;   // Internal/utility command
```

### Help System Features

The help system provides two types of assistance:

#### **General Help** (`!help`)
Shows all available commands organized by folder:

```
🤖 Available Commands:

� Bot Commands:
!changebotname (OWNER) - Change the bot name
!status (MODERATOR) - Show bot status

🗂 General Commands:
!echo (USER) - Echo back your message
!ping (USER) - Check if bot is responding

� Edit Commands:
!edit (MODERATOR) - Edit message templates

💡 Tip: Type !help [command] to see specific examples and usage.
```

#### **Specific Command Help** (`!help commandname`)
Shows detailed information for a specific command:

```
🤖 Help for command: !echo

📝 Description: Echo back your message
🎯 Example: !echo Hello everyone!
👤 Required Role: USER
```

#### **Error Handling**
If a user asks for help on a non-existent command:

```
❌ Command "nonexistent" does not exist.
Type !help to see all available commands.
```

### Complete Metadata Example

```javascript
// Command metadata
const requiredRole = 'MODERATOR';
const description = 'Update the welcome message template';
const example = 'editwelcome Hi {username}, welcome to {hangoutName}!';
const hidden = false;

async function handleEditwelcomeCommand(commandParams) {
    // Command implementation here
}

// Attach ALL metadata to the function
handleEditwelcomeCommand.requiredRole = requiredRole;
handleEditwelcomeCommand.description = description;
handleEditwelcomeCommand.example = example;
handleEditwelcomeCommand.hidden = hidden;

module.exports = handleEditwelcomeCommand;
```

### Automatic Discovery

Commands are automatically discovered when:
1. They're placed in one of the command folders within `src/commands/`
2. They follow the `handleXXXCommand.js` naming pattern
3. They include the required metadata properties
4. They're not marked as `hidden: true`

The help system will automatically:
- Extract the command name from the filename
- Group commands by their folder location
- Sort commands alphabetically within each folder
- Display role requirements in brackets after each command name
- Handle case-insensitive help requests

### Folder-Based Organization Benefits

- **Developer Clarity**: Easy to find commands by purpose
- **User Understanding**: Logical grouping in help display
- **Maintenance**: Better code organization and navigation
- **Scalability**: New command types can have dedicated folders

## Command Response Format

Your command must return an object with:

```javascript
return {
    success: true,          // Was the command successful?
    shouldRespond: true,    // Should the bot send a response?
    response: "message"     // The response message (if shouldRespond is true)
};
```

### Handling Errors with Response Channels

When handling errors, make sure to send error messages using the same response channel pattern:

```javascript
if (!args.trim()) {
    const errorResponse = '❓ Please provide the required arguments.';
    await messageService.sendResponse(errorResponse, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    });
    return {
        success: false,
        shouldRespond: true,
        response: errorResponse
    };
}
```

## Example Command

Here's a complete example of a simple greeting command with proper help system integration:

```javascript
// File: src/commands/General Commands/handleGreetCommand.js

// Command metadata
const requiredRole = 'USER';
const description = 'Send a friendly greeting';
const example = 'greet Alice';
const hidden = false;

/**
 * Handle the greet command
 * @param {Object} commandParams - Standard command parameters
 * @returns {Promise<Object>} Command result
 */
async function handleGreetCommand(commandParams) {
    const { args, services, context, responseChannel = 'request' } = commandParams;
    const { messageService } = services;

    const name = args.trim() || context.sender;
    const response = `👋 Hello, ${name}!`;
    
    await messageService.sendResponse(response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    });
    
    return {
        success: true,
        shouldRespond: true,
        response
    };
}

// Attach metadata to the function
handleGreetCommand.requiredRole = requiredRole;
handleGreetCommand.description = description;
handleGreetCommand.example = example;
handleGreetCommand.hidden = hidden;

module.exports = handleGreetCommand;
```

This command will:
- Appear in `!help` under "� General Commands" as: `!greet (USER) - Send a friendly greeting`
- Show detailed help with `!help greet`: includes description, example, and required role
- Accept an optional name argument, defaulting to the sender's ID if none provided
- Respond in the same channel as the original command (public or private)

## Testing Your Command

1. Create a test file in `tests/commands/handleXXXCommand.test.js`
2. Test different permission levels
3. Test with various arguments
4. Test error conditions
5. **Test help system integration**
6. **Test folder organization** (ensure command appears in correct folder in help)

### Help System Testing

Include tests to verify your command integrates properly with the help system:

```javascript
const handleGreetCommand = require('../../src/commands/General Commands/handleGreetCommand');

describe('handleGreetCommand', () => {
    // ... other tests ...

    it('should have proper metadata for help system', () => {
        expect(handleGreetCommand.requiredRole).toBe('USER');
        expect(handleGreetCommand.description).toBe('Send a friendly greeting');
        expect(handleGreetCommand.example).toBe('greet Alice');
        expect(handleGreetCommand.hidden).toBe(false);
    });

    it('should appear in help command listing under correct folder', async () => {
        // Test that your command appears in the right folder when !help is called
        const handleHelpCommand = require('../../src/commands/General Commands/handleHelpCommand');
        const result = await handleHelpCommand({
            args: '',
            services: mockServices,
            context: { sender: 'testUser' }
        });
        
        expect(result.response).toContain('🗂 General Commands:');
        expect(result.response).toContain('!greet (USER) - Send a friendly greeting');
    });

    it('should show specific help when requested', async () => {
        // Test that !help greet shows detailed information
        const handleHelpCommand = require('../../src/commands/General Commands/handleHelpCommand');
        const result = await handleHelpCommand({
            args: 'greet',
            services: mockServices,
            context: { sender: 'testUser' }
        });
        
        expect(result.response).toContain('Help for command: !greet');
        expect(result.response).toContain('Description: Send a friendly greeting');
        expect(result.response).toContain('Example: !greet Alice');
        expect(result.response).toContain('Required Role: USER');
    });
});
```

The command will be automatically loaded by the bot when you add it to the appropriate folder in `src/commands`.

## Quick Reference Checklist

When creating a new command, ensure you:

- [ ] **Folder placement**: Choose the appropriate folder for your command type
- [ ] **File naming**: Use `handleXXXCommand.js` pattern
- [ ] **Metadata**: Include `requiredRole`, `description`, `example`, and `hidden`
- [ ] **Function signature**: Accept `commandParams` object with proper destructuring
- [ ] **Response handling**: Use `messageService.sendResponse()` with proper channel routing
- [ ] **Return format**: Return object with `success`, `shouldRespond`, and `response`
- [ ] **Metadata attachment**: Attach all metadata properties to the function
- [ ] **Export**: Use `module.exports = handleXXXCommand`
- [ ] **Testing**: Create comprehensive tests including help system integration and folder placement
- [ ] **Documentation**: Clear JSDoc comments explaining parameters and return values

### Command Folder Reference

| Folder | Purpose | Examples |
|--------|---------|----------|
| `Bot Commands/` | Bot administration & management | changebotname, status, feature |
| `General Commands/` | User-facing utility commands | echo, ping, help |
| `Edit Commands/` | Template & content editing | edit (message templates) |
| `Debug Commands/` | Diagnostic & development tools | state (usually hidden) |
| `ML Commands/` | AI & machine learning features | popfacts, generate |

### Command Metadata Template

```javascript
const requiredRole = 'USER';           // 'USER' | 'MODERATOR' | 'OWNER'
const description = 'Brief description';  // Under 50 characters
const example = 'command arg1 arg2';    // Realistic example without !
const hidden = false;                   // true to hide from help
```

### Help System Commands for Testing

- `!help` - Shows all available commands
- `!help commandname` - Shows specific command help
- `!help nonexistent` - Tests error handling

Your command will automatically be included in the help system when properly configured!

## Command Administration

The bot includes a powerful command administration system that allows owners to enable/disable commands at runtime without modifying source code.

### Toggle Command System

Commands are **enabled by default**. The `togglecommand` allows owners to manage command states:

#### Syntax
```
!togglecommand <action> <commandname>
```

#### Actions
- **`enable`** - Enable a disabled command
- **`disable`** - Disable an enabled command  
- **`status`** - Check if a command is enabled or disabled

#### Examples
```
!togglecommand disable ping     # Disable the ping command
!togglecommand enable ping      # Re-enable the ping command
!togglecommand status ping      # Check ping command status
```

#### How It Works
- Disabled commands are stored in `data/botConfig.json` (outside of git)
- Changes persist across bot restarts
- No source code modifications needed
- Git repository stays clean and synchronized
- Deployment-specific command states

#### Safety Features
- Cannot disable the `unknown` command (handles unrecognized commands)
- Only owners can use `togglecommand`
- Validates command exists before toggling
- Clear status messages for all operations

#### When Commands Are Disabled
Users attempting to use disabled commands receive:
```
❌ The "commandname" command is currently disabled.
```

## Command Administration

### Enabling and Disabling Commands

Commands can be dynamically enabled or disabled at runtime using the `togglecommand` feature. This provides fine-grained control over which commands are available without requiring a bot restart.

#### The `enabled` Flag

Every command should include an `enabled` flag in its metadata:

```javascript
const enabled = true;  // Command is active and can be executed
// or
const enabled = false; // Command is disabled
```

When a command is disabled:
- Users receive a "Command 'commandname' is currently disabled" message
- The command still appears in help listings (unless also marked as `hidden`)
- Only the owner can re-enable it using `togglecommand`

#### The `togglecommand` Command

The `togglecommand` command allows owners to enable/disable other commands at runtime:

```
!togglecommand enable commandname    # Enable a command
!togglecommand disable commandname   # Disable a command
!togglecommand status commandname    # Check command status
```

**Examples:**
```
!togglecommand disable echo          # Disables the echo command
!togglecommand enable echo           # Re-enables the echo command
!togglecommand status ping           # Shows: "Command 'ping' is currently enabled"
```

**Features:**
- Owner-only access (highest permission level)
- Persistent changes (survives bot restarts)
- Real-time effect (no restart required)
- Built-in validation (prevents disabling critical commands like help)
- Clear feedback messages

#### Best Practices

1. **Default State**: Always set new commands to `enabled = true`
2. **Testing**: Use `togglecommand` to test command disable/enable flows
3. **Maintenance**: Temporarily disable problematic commands instead of removing them
4. **Critical Commands**: The system prevents disabling essential commands like `help` and `togglecommand` itself
