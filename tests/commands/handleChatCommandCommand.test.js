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
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        verbose: jest.fn()
    }
} ) );

jest.mock( 'fs' );

const fs = require( 'fs' );
const path = require( 'path' );
const handleChatCommandCommand = require( '../../src/commands/Edit Commands/handleChatCommandCommand' );

describe( 'handleChatCommandCommand', () => {
    let mockServices;
    let mockContext;

    beforeEach( () => {
        jest.clearAllMocks();

        // Mock services
        mockServices = {
            messageService: {
                sendResponse: jest.fn().mockResolvedValue()
            }
        };

        // Mock context
        mockContext = {
            sender: 'test-sender-123',
            fullMessage: { isPrivateMessage: false }
        };

        // Setup default fs mocks
        fs.readFileSync = jest.fn();
        fs.writeFileSync = jest.fn();
        fs.existsSync = jest.fn();
        fs.readdirSync = jest.fn().mockReturnValue( [] );
        fs.statSync = jest.fn().mockReturnValue( { isDirectory: jest.fn().mockReturnValue( false ) } );
    } );

    describe( 'metadata', () => {
        it( 'should have correct metadata properties', () => {
            expect( handleChatCommandCommand.requiredRole ).toBe( 'MODERATOR' );
            expect( handleChatCommandCommand.description ).toBe( 'Manage chat commands' );
            expect( handleChatCommandCommand.example ).toBe( 'add props' );
            expect( handleChatCommandCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'add command', () => {
        it( 'should create a new chat command', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( { props: { messages: [], pictures: [] } } );
                }
                if ( filePath.includes( 'aliases.json' ) ) {
                    return JSON.stringify( {} );
                }
                // For command loading in loadAllCommands
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'add newcmd',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'newcmd' );
            expect( result.response ).toContain( 'created' );
            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );

        it( 'should reject if command already exists as chat command', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( { props: { messages: [], pictures: [] } } );
                }
                if ( filePath.includes( 'aliases.json' ) ) {
                    return JSON.stringify( {} );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'add props',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'already exists' );
        } );

        it( 'should require a command name', async () => {
            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'add',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Usage' );
        } );
    } );

    describe( 'remove command', () => {
        it( 'should remove a chat command', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        testcmd: { messages: [ 'test' ], pictures: [] },
                        props: { messages: [], pictures: [] }
                    } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'remove testcmd',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'testcmd' );
            expect( result.response ).toContain( 'removed' );
            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );

        it( 'should reject if command does not exist', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( { props: { messages: [], pictures: [] } } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'remove nonexistent',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'does not exist' );
        } );
    } );

    describe( 'addMessage', () => {
        it( 'should add a message to a command', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: { messages: [], pictures: [] }
                    } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'addMessage props This is a new message',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'Message added' );
            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );

        it( 'should reject duplicate messages', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: { messages: [ 'This is a new message' ], pictures: [] }
                    } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'addMessage props This is a new message',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'already exists' );
        } );

        it( 'should reject empty messages', async () => {
            fs.existsSync.mockReturnValue( true );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'addMessage props',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'empty' );
        } );
    } );

    describe( 'removeMessage', () => {
        it( 'should remove a message from a command', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: { messages: [ 'This is a message to remove' ], pictures: [] }
                    } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'removeMessage props This is a message to remove',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'Message removed' );
            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );

        it( 'should only delete exact message matches', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: { messages: [ 'This is a message' ], pictures: [] }
                    } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'removeMessage props Different message',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'not found' );
            expect( result.response ).toContain( 'exact matches' );
        } );
    } );

    describe( 'addImage', () => {
        it( 'should add a valid image URL', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: { messages: [], pictures: [] }
                    } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'addImage props https://media.giphy.com/media/test.gif',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'Image added' );
            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );

        it( 'should reject invalid image URLs', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: { messages: [], pictures: [] }
                    } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'addImage props not-a-valid-url',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Invalid image URL' );
        } );

        it( 'should accept imgur URLs', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: { messages: [], pictures: [] }
                    } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'addImage props https://i.imgur.com/test.gif',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( true );
        } );

        it( 'should reject duplicate images', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: { messages: [], pictures: [ 'https://media.giphy.com/media/test.gif' ] }
                    } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'addImage props https://media.giphy.com/media/test.gif',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'already exists' );
        } );
    } );

    describe( 'removeImage', () => {
        it( 'should remove an image URL', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: { messages: [], pictures: [ 'https://media.giphy.com/media/test.gif' ] }
                    } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'removeImage props https://media.giphy.com/media/test.gif',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'Image removed' );
            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );

        it( 'should only delete exact URL matches', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: { messages: [], pictures: [ 'https://media.giphy.com/media/test.gif' ] }
                    } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'removeImage props https://media.giphy.com/media/different.gif',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'not found' );
            expect( result.response ).toContain( 'exact matches' );
        } );
    } );

    describe( 'addAlias', () => {
        it( 'should create an alias for a command', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( { props: { messages: [], pictures: [] } } );
                }
                if ( filePath.includes( 'aliases.json' ) ) {
                    return JSON.stringify( {} );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'addAlias props proops',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'Alias' );
            expect( result.response ).toContain( 'created' );
            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );

        it( 'should reject alias if command does not exist', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {} );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'addAlias nonexistent myalias',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'does not exist' );
        } );

        it( 'should reject if alias already exists', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( { props: { messages: [], pictures: [] } } );
                }
                if ( filePath.includes( 'aliases.json' ) ) {
                    return JSON.stringify( { myalias: { command: 'props' } } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'addAlias props myalias',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'already exists' );
        } );
    } );

    describe( 'removeAlias', () => {
        it( 'should remove an alias', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'aliases.json' ) ) {
                    return JSON.stringify( { myalias: { command: 'props' } } );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'removeAlias myalias',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'removed' );
            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );

        it( 'should reject if alias does not exist', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'aliases.json' ) ) {
                    return JSON.stringify( {} );
                }
                return JSON.stringify( {} );
            } );

            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'removeAlias nonexistentalias',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'does not exist' );
        } );
    } );

    describe( 'help', () => {
        it( 'should show help when no subcommand provided', async () => {
            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: '',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Usage' );
            expect( result.response ).toContain( 'add' );
            expect( result.response ).toContain( 'remove' );
            expect( result.response ).toContain( 'addMessage' );
            expect( result.response ).toContain( 'addImage' );
            expect( result.response ).toContain( 'addAlias' );
        } );

        it( 'should reject unknown subcommands', async () => {
            const result = await handleChatCommandCommand( {
                command: 'chatcommand',
                args: 'unknown',
                services: mockServices,
                context: mockContext
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Unknown subcommand' );
        } );
    } );
} );
