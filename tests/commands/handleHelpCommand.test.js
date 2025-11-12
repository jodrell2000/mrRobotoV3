// Mock config module to avoid environment dependencies
jest.mock( '../../src/config.js', () => ( {
    COMMAND_SWITCH: '!',
    COMETCHAT_API_KEY: 'test-api-key',
    COMETCHAT_AUTH_TOKEN: 'test-auth-token',
    LOG_LEVEL: 'INFO',
    SOCKET_MESSAGE_LOG_LEVEL: 'OFF',
    BOT_UID: 'test-bot-uid',
    HANGOUT_ID: 'test-hangout-id',
    BOT_USER_TOKEN: 'test-bot-token',
    CHAT_AVATAR_ID: 'test-avatar',
    CHAT_NAME: 'TestBot',
    CHAT_COLOUR: 'ff0000',
    COMETCHAT_RECEIVER_UID: 'test-receiver-uid',
    TTFM_GATEWAY_BASE_URL: 'http://test.example.com'
} ) );

// Mock logging module to prevent file system operations
jest.mock( '../../src/lib/logging.js', () => ( {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn()
} ) );

// Mock fs module to prevent reading actual botConfig.json file
jest.mock( 'fs', () => ( {
    readFileSync: jest.fn().mockImplementation( ( filePath ) => {
        // Return mock botConfig.json content for any botConfig.json path
        if ( filePath.includes( 'botConfig.json' ) ) {
            return JSON.stringify( {
                disabledCommands: [],
                disabledFeatures: [],
                welcomeMessage: "Hey {username}, welcome to {hangoutName}",
                nowPlayingMessage: "{username} is now playing \"{trackName}\" by {artistName}",
                botData: {
                    CHAT_AVATAR_ID: "test-avatar",
                    CHAT_NAME: "TestBot",
                    CHAT_COLOUR: "ff0000"
                }
            } );
        }
        // Default fallback for other files
        return '{}';
    } ),
    readdirSync: jest.fn().mockImplementation( ( dirPath ) => {
        // Mock the directory structure based on path
        const normalizedPath = dirPath.replace( /\\/g, '/' );

        if ( normalizedPath.includes( 'commands/Bot Commands' ) ) {
            return [
                'handleChangebotnameCommand.js',
                'handleCommandCommand.js',
                'handleFeatureCommand.js',
                'handleStatusCommand.js'
            ];
        } else if ( normalizedPath.includes( 'commands/General Commands' ) ) {
            return [
                'handleEchoCommand.js',
                'handleHelpCommand.js',
                'handlePingCommand.js'
            ];
        } else if ( normalizedPath.includes( 'commands/Debug Commands' ) ) {
            return [ 'handleStateCommand.js' ];
        } else if ( normalizedPath.includes( 'commands/Edit Commands' ) ) {
            return [ 'handleEditCommand.js' ];
        } else if ( normalizedPath.includes( 'commands/ML Commands' ) ) {
            return [ 'handlePopfactsCommand.js' ];
        } else if ( normalizedPath.includes( 'commands' ) && !normalizedPath.includes( '/' ) ) {
            // Root commands directory
            return [ 'handleUnknownCommand.js' ];
        }
        return [];
    } ),
    statSync: jest.fn().mockImplementation( ( filePath ) => {
        const normalizedPath = filePath.replace( /\\/g, '/' );

        // Mock folders as directories
        if ( normalizedPath.includes( 'Bot Commands' ) ||
            normalizedPath.includes( 'General Commands' ) ||
            normalizedPath.includes( 'Debug Commands' ) ||
            normalizedPath.includes( 'Edit Commands' ) ||
            normalizedPath.includes( 'ML Commands' ) ) {
            return { isDirectory: () => true };
        }

        // Mock .js files as files
        if ( normalizedPath.endsWith( '.js' ) ) {
            return { isDirectory: () => false };
        }

        return { isDirectory: () => false };
    } ),
    existsSync: jest.fn().mockReturnValue( true ),
    mkdirSync: jest.fn()
} ) );

// Mock command modules
jest.doMock( '../../src/commands/General Commands/handleEchoCommand.js', () => ( {
    requiredRole: 'USER',
    description: 'Echo back your message',
    example: 'echo Hello everyone!',
    hidden: false
} ) );

jest.doMock( '../../src/commands/General Commands/handlePingCommand.js', () => ( {
    requiredRole: 'USER',
    description: 'Test if bot is responsive',
    example: 'ping',
    hidden: false
} ) );

jest.doMock( '../../src/commands/Bot Commands/handleChangebotnameCommand.js', () => ( {
    requiredRole: 'OWNER',
    description: 'Change the bot name',
    example: 'changebotname MyAwesomeBot',
    hidden: false
} ) );

jest.doMock( '../../src/commands/Bot Commands/handleCommandCommand.js', () => ( {
    requiredRole: 'OWNER',
    description: 'Manage bot commands - list, enable, disable, or check status',
    example: 'command list',
    hidden: false
} ) );

jest.doMock( '../../src/commands/Bot Commands/handleFeatureCommand.js', () => ( {
    requiredRole: 'OWNER',
    description: 'Manage optional bot features',
    example: 'feature list',
    hidden: false
} ) );

jest.doMock( '../../src/commands/Bot Commands/handleStatusCommand.js', () => ( {
    requiredRole: 'MODERATOR',
    description: 'Show bot status',
    example: 'status',
    hidden: false
} ) );

jest.doMock( '../../src/commands/Debug Commands/handleStateCommand.js', () => ( {
    requiredRole: 'OWNER',
    description: 'Show current state',
    example: 'state',
    hidden: true
} ) );

jest.doMock( '../../src/commands/Edit Commands/handleEditCommand.js', () => ( {
    requiredRole: 'MODERATOR',
    description: 'Edit editable message templates (welcomeMessage, nowPlayingMessage, justPlayedMessage, popfactsQuestion)',
    example: 'edit welcomeMessage',
    hidden: false
} ) );

jest.doMock( '../../src/commands/ML Commands/handlePopfactsCommand.js', () => ( {
    requiredRole: 'USER',
    description: 'Get interesting facts about the currently playing song',
    example: 'popfacts',
    hidden: false
} ) );

jest.doMock( '../../src/commands/handleUnknownCommand.js', () => ( {
    requiredRole: 'USER',
    description: 'Handle unknown commands',
    example: 'unknown',
    hidden: true
} ) );

const handleHelpCommand = require( '../../src/commands/General Commands/handleHelpCommand' );

describe( 'handleHelpCommand', () => {
    let mockServices;
    let mockCommandParams;

    beforeEach( () => {
        jest.clearAllMocks();

        mockServices = {
            messageService: {
                sendResponse: jest.fn()
            },
            logger: {
                info: jest.fn(),
                debug: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            }
        };

        mockCommandParams = {
            command: 'help',
            args: '',
            services: mockServices,
            context: {
                sender: 'testUser'
            }
        };
    } );

    it( 'should return available commands organized by folder', async () => {
        const result = await handleHelpCommand( mockCommandParams );

        expect( result.success ).toBe( true );
        expect( result.response ).toContain( '🤖 Available Commands:' );
        expect( result.response ).toContain( '� Bot Commands:' );
        expect( result.response ).toContain( '� General Commands:' );
        expect( mockServices.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should include expected commands in correct sections with roles', async () => {
        const result = await handleHelpCommand( mockCommandParams );

        // Check for General Commands with roles
        expect( result.response ).toContain( '!echo (USER) - Echo back your message' );
        expect( result.response ).toContain( '!help (USER) - Show this help message' );
        expect( result.response ).toContain( '!ping (USER) - Test if bot is responsive' );

        // Check for Bot Commands
        expect( result.response ).toContain( '!status (MODERATOR) - Show bot status' );
    } );

    it( 'should not include hidden commands', async () => {
        const result = await handleHelpCommand( mockCommandParams );

        // The unknown command should be hidden and not appear in help
        expect( result.response ).not.toContain( 'unknown' );
    } );

    it( 'should handle errors gracefully', async () => {
        // Mock path.join to throw an error for this test - this will trigger the main catch block
        const path = require( 'path' );
        const originalJoin = path.join;
        path.join = jest.fn( () => {
            throw new Error( 'Path error' );
        } );

        const result = await handleHelpCommand( mockCommandParams );

        expect( result.success ).toBe( false );
        expect( result.response ).toContain( '❌ Error loading help information' );
        expect( mockServices.messageService.sendResponse ).toHaveBeenCalled();

        // Restore original function
        path.join = originalJoin;
    } );

    it( 'should sort commands alphabetically within each folder', async () => {
        const result = await handleHelpCommand( mockCommandParams );

        // Check that commands in General Commands folder are in alphabetical order
        const generalSection = result.response.split( '🗂 General Commands:' )[ 1 ]?.split( '🗂' )[ 0 ];
        if ( generalSection ) {
            const generalCommands = generalSection.match( /!(\w+)/g );
            if ( generalCommands && generalCommands.length > 1 ) {
                const commandNames = generalCommands.map( cmd => cmd.substring( 1 ) ); // Remove the '!'
                const sortedNames = [ ...commandNames ].sort();
                expect( commandNames ).toEqual( sortedNames );
            }
        }
    } );

    it( 'should show specific command help when a command is provided as argument', async () => {
        mockCommandParams.args = 'echo';

        const result = await handleHelpCommand( mockCommandParams );

        expect( result.success ).toBe( true );
        expect( result.response ).toContain( 'Help for command: !echo' );
        expect( result.response ).toContain( 'Description: Echo back your message' );
        expect( result.response ).toContain( 'Example: !echo Hello everyone!' );
        expect( result.response ).toContain( 'Required Role: USER' );
        expect( mockServices.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should show error message for non-existent command', async () => {
        mockCommandParams.args = 'nonexistent';

        const result = await handleHelpCommand( mockCommandParams );

        expect( result.success ).toBe( false );
        expect( result.response ).toContain( 'Command "nonexistent" does not exist' );
        expect( result.response ).toContain( 'Type !help to see all available commands' );
        expect( result.error ).toContain( 'Command "nonexistent" not found' );
        expect( mockServices.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should handle case-insensitive command names', async () => {
        mockCommandParams.args = 'ECHO';

        const result = await handleHelpCommand( mockCommandParams );

        expect( result.success ).toBe( true );
        expect( result.response ).toContain( 'Help for command: !echo' );
        expect( result.response ).toContain( 'Example: !echo Hello everyone!' );
    } );

    it( 'should show specific help for owner commands', async () => {
        mockCommandParams.args = 'changebotname';

        const result = await handleHelpCommand( mockCommandParams );

        expect( result.success ).toBe( true );
        expect( result.response ).toContain( 'Help for command: !changebotname' );
        expect( result.response ).toContain( 'Description: Change the bot name' );
        expect( result.response ).toContain( 'Example: !changebotname MyAwesomeBot' );
        expect( result.response ).toContain( 'Required Role: OWNER' );
    } );

    it( 'should include tip about specific help in general help', async () => {
        const result = await handleHelpCommand( mockCommandParams );

        expect( result.success ).toBe( true );
        expect( result.response ).toContain( 'Type !help [command] to see specific examples and usage' );
    } );
} );