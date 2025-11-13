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
const handleChatCommand = require( '../../src/commands/handleChatCommand' );

describe( 'handleChatCommand', () => {
    let mockServices;
    let mockContext;

    beforeEach( () => {
        jest.clearAllMocks();

        // Mock services
        mockServices = {
            messageService: {
                sendResponse: jest.fn().mockResolvedValue(),
                sendGroupPictureMessage: jest.fn().mockResolvedValue(),
                formatMention: jest.fn( ( uuid ) => `<@uid:${ uuid }>` )
            },
            tokenService: {
                replaceTokens: jest.fn( ( message, context ) => {
                    // Simple token replacement for testing
                    return message
                        .replace( '{senderUsername}', '<@uid:sender-123>' )
                        .replace( '{djUsername}', '<@uid:dj-456>' );
                } )
            }
        };

        // Mock context
        mockContext = {
            sender: 'sender-123',
            username: 'testuser',
            fullMessage: { isPrivateMessage: false }
        };
    } );



    describe( 'metadata', () => {
        it( 'should have correct metadata properties', () => {
            expect( handleChatCommand.requiredRole ).toBe( 'USER' );
            expect( handleChatCommand.description ).toBe( 'Execute chat command from chat.json or list commands' );
            expect( handleChatCommand.example ).toBe( 'props | list | list props' );
            expect( handleChatCommand.hidden ).toBe( true );
        } );
    } );

    describe( 'command execution', () => {
        it( 'should send a random message with token replacement', async () => {
            // Mock fs.readFileSync to return valid chat.json data
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                props: {
                    messages: [
                        "nice one {djUsername}, {senderUsername} thinks that's an absolute banger",
                        "props to {djUsername} from {senderUsername}!",
                        "{senderUsername} is loving this track by {djUsername}"
                    ],
                    pictures: []
                }
            } ) );

            // Mock stateService to provide user profile data
            mockServices.stateService = {
                _getAllUserData: jest.fn().mockReturnValue( {
                    'sender-123': {
                        userProfile: {
                            nickname: 'testuser',
                            avatarId: 'user-avatar-123',
                            color: '#ff0000'
                        }
                    }
                } )
            };

            const result = await handleChatCommand( 'props', '', mockServices, mockContext );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );
            expect( mockServices.tokenService.replaceTokens ).toHaveBeenCalledWith(
                expect.any( String ),
                mockContext
            );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( '<@uid:' ),
                expect.objectContaining( {
                    responseChannel: 'publicChat',
                    isPrivateMessage: false,
                    sender: 'sender-123',
                    services: mockServices,
                    senderUid: 'sender-123',
                    senderName: 'testuser',
                    senderAvatarId: 'user-avatar-123',
                    senderColor: '#ff0000'
                } )
            );
        } );

        it( 'should handle missing chat.json file', async () => {
            fs.readFileSync.mockImplementation( () => {
                const error = new Error( 'File not found' );
                error.code = 'ENOENT';
                throw error;
            } );

            const result = await handleChatCommand( 'missing', '', mockServices, mockContext );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( 'Command not found' );
        } );

        it( 'should handle invalid JSON in chat.json', async () => {
            fs.readFileSync.mockReturnValue( 'invalid json' );

            const result = await handleChatCommand( 'props', '', mockServices, mockContext );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( 'Error loading command data' );
        } );

        it( 'should handle command not found in chat.json', async () => {
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                otherCommand: {
                    messages: [ "test message" ]
                }
            } ) );

            const result = await handleChatCommand( 'missing', '', mockServices, mockContext );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( 'Command not found' );
        } );

        it( 'should handle empty messages array', async () => {
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                props: {
                    messages: [],
                    pictures: []
                }
            } ) );

            const result = await handleChatCommand( 'props', '', mockServices, mockContext );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( 'No messages available for this command' );
        } );

        it( 'should handle service errors gracefully', async () => {
            // Mock fs.readFileSync to return valid chat.json data
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                props: {
                    messages: [ "test message" ],
                    pictures: []
                }
            } ) );

            mockServices.messageService.sendResponse.mockRejectedValue( new Error( 'Network error' ) );

            const result = await handleChatCommand( 'props', '', mockServices, mockContext );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.error ).toBe( 'Network error' );
        } );

        it( 'should select from available messages randomly', async () => {
            const singleMessageData = {
                props: {
                    messages: [ "single test message {djUsername}" ],
                    pictures: []
                }
            };
            fs.readFileSync.mockReturnValue( JSON.stringify( singleMessageData ) );

            const result = await handleChatCommand( 'props', '', mockServices, mockContext );

            expect( result.success ).toBe( true );
            expect( mockServices.tokenService.replaceTokens ).toHaveBeenCalledWith(
                'single test message {djUsername}',
                mockContext
            );
        } );

        it( 'should use publicChat as response channel when no pictures', async () => {
            // Mock fs.readFileSync to return valid chat.json data without pictures
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                props: {
                    messages: [ "test message" ],
                    pictures: []
                }
            } ) );

            await handleChatCommand( 'props', '', mockServices, mockContext );

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.any( String ),
                expect.objectContaining( {
                    responseChannel: 'publicChat'
                } )
            );
        } );

        it( 'should send picture message when pictures are available', async () => {
            // Mock fs.readFileSync to return valid chat.json data with pictures
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                props: {
                    messages: [ "test message" ],
                    pictures: [ "https://example.com/image.gif", "https://example.com/image2.gif" ]
                }
            } ) );

            // Mock stateService to provide user profile data
            mockServices.stateService = {
                _getAllUserData: jest.fn().mockReturnValue( {
                    'sender-123': {
                        userProfile: {
                            nickname: 'testuser',
                            avatarId: 'user-avatar-123',
                            color: '#ff0000'
                        }
                    }
                } )
            };

            await handleChatCommand( 'props', '', mockServices, mockContext );

            expect( mockServices.messageService.sendGroupPictureMessage ).toHaveBeenCalledWith(
                expect.any( String ),
                expect.stringContaining( 'https://' ),
                mockServices,
                'sender-123',
                'testuser',
                'user-avatar-123',
                '#ff0000'
            );
        } );

        it( 'should filter out null values from pictures array', async () => {
            // Mock fs.readFileSync to return chat.json with null in pictures array
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                props: {
                    messages: [ "test message" ],
                    pictures: [ "https://example.com/image.gif", null, "https://example.com/image2.gif" ]
                }
            } ) );

            await handleChatCommand( 'props', '', mockServices, mockContext );

            // Should still send picture message, ignoring the null
            expect( mockServices.messageService.sendGroupPictureMessage ).toHaveBeenCalled();
            const callArgs = mockServices.messageService.sendGroupPictureMessage.mock.calls[ 0 ];
            expect( callArgs[ 1 ] ).not.toBeNull();
        } );
    } );

    describe( 'list subcommand', () => {
        it( 'should list all commands when "list" is passed', async () => {
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: { messages: [ 'msg1' ], pictures: [] },
                        banger: { messages: [ 'msg2' ], pictures: [] }
                    } );
                }
                if ( filePath.includes( 'aliases.json' ) ) {
                    return JSON.stringify( {
                        porps: { command: 'props' },
                        propos: { command: 'props' }
                    } );
                }
            } );
            fs.existsSync.mockReturnValue( true );

            const result = await handleChatCommand( 'dummyCommand', 'list', mockServices, mockContext );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'Chat Commands' );
            expect( result.response ).toContain( 'props' );
            expect( result.response ).toContain( 'porps' );
            expect( result.response ).toContain( 'propos' );
            expect( result.response ).toContain( 'banger' );
        } );

        it( 'should list specific command details when "list <command>" is passed', async () => {
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: {
                            messages: [ 'Great props!', 'Nice props' ],
                            pictures: [ 'https://example.com/image.gif', 'https://example.com/image2.gif' ]
                        }
                    } );
                }
                if ( filePath.includes( 'aliases.json' ) ) {
                    return JSON.stringify( {
                        porps: { command: 'props' },
                        banger: { command: 'props' }
                    } );
                }
            } );
            fs.existsSync.mockReturnValue( true );

            const result = await handleChatCommand( 'dummyCommand', 'list props', mockServices, mockContext );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'props' );
            expect( result.response ).toContain( 'porps' );
            expect( result.response ).toContain( 'banger' );
            expect( result.response ).toContain( 'Images:' );
            expect( result.response ).toContain( 'Messages:' );
            expect( result.response ).toContain( 'Great props' );
        } );

        it( 'should find command by alias in list', async () => {
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: {
                            messages: [ 'Props message' ],
                            pictures: []
                        }
                    } );
                }
                if ( filePath.includes( 'aliases.json' ) ) {
                    return JSON.stringify( {
                        porps: { command: 'props' }
                    } );
                }
            } );
            fs.existsSync.mockReturnValue( true );

            const result = await handleChatCommand( 'dummyCommand', 'list porps', mockServices, mockContext );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'props' );
            expect( result.response ).toContain( 'porps' );
        } );

        it( 'should handle list with non-existent command', async () => {
            fs.readFileSync.mockImplementation( ( filePath ) => {
                if ( filePath.includes( 'chat.json' ) ) {
                    return JSON.stringify( { props: { messages: [ 'msg' ], pictures: [] } } );
                }
                if ( filePath.includes( 'aliases.json' ) ) {
                    return JSON.stringify( {} );
                }
            } );
            fs.existsSync.mockReturnValue( true );

            const result = await handleChatCommand( 'dummyCommand', 'list nonexistent', mockServices, mockContext );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'not found' );
        } );
    } );
} );
