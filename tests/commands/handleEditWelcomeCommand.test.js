jest.mock( '../../src/lib/logging.js', () => ( {
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
} ) );

jest.mock( 'fs' );

const fs = require( 'fs' );
const handleEditWelcomeCommand = require( '../../src/commands/Edit Commands/handleEditWelcomeCommand' );

describe( 'handleEditWelcomeCommand', () => {
    const mockUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const mockNickname = 'JohnDoe';
    const mockBotUserId = 1;

    let mockServices;
    let mockContext;

    beforeEach( () => {
        jest.clearAllMocks();

        // Mock database
        const mockDb = {
            prepare: jest.fn().mockReturnValue( {
                all: jest.fn().mockReturnValue( [] ),
                get: jest.fn().mockReturnValue( null ),
                run: jest.fn().mockReturnValue( { changes: 0 } )
            } )
        };

        mockServices = {
            messageService: {
                sendResponse: jest.fn().mockResolvedValue()
            },
            config: { COMMAND_SWITCH: '!', API_FRAMEWORK: 'hangfm' },
            stateService: {
                _getCurrentState: jest.fn().mockReturnValue( {
                    allUserData: {
                        [ mockUuid ]: { userProfile: { nickname: mockNickname } }
                    }
                } )
            },
            databaseService: {
                initialized: true,
                db: mockDb,
                getOrCreateBotUser: jest.fn().mockReturnValue( mockBotUserId ),
                addWelcomeMessage: jest.fn().mockReturnValue( true ),
                removeWelcomeMessage: jest.fn().mockReturnValue( 1 ),
                addWelcomePicture: jest.fn().mockReturnValue( true ),
                removeWelcomePicture: jest.fn().mockReturnValue( 1 ),
                findDjByNickname: jest.fn().mockReturnValue( null ),
                getAllDjNicknames: jest.fn().mockReturnValue( [] )
            },
            logger: {
                debug: jest.fn(),
                info: jest.fn(),
                error: jest.fn()
            }
        };

        mockContext = {
            sender: 'owner-uuid',
            fullMessage: { isPrivateMessage: false }
        };

        fs.existsSync.mockReturnValue( false );
    } );

    describe( 'command metadata', () => {
        it( 'should have correct metadata', () => {
            expect( handleEditWelcomeCommand.requiredRole ).toBe( 'OWNER' );
            expect( typeof handleEditWelcomeCommand.description ).toBe( 'string' );
            expect( typeof handleEditWelcomeCommand.example ).toBe( 'string' );
            expect( handleEditWelcomeCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'missing args', () => {
        it( 'should return usage when no args provided', async () => {
            const result = await handleEditWelcomeCommand( { args: '', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'No subcommand provided' ),
                expect.any( Object )
            );
        } );
    } );

    describe( 'list subcommand', () => {
        it( 'should report no users when database is empty', async () => {
            mockServices.databaseService.db.prepare.mockReturnValue( {
                all: jest.fn().mockReturnValue( [] ),
                get: jest.fn().mockReturnValue( null ),
                run: jest.fn().mockReturnValue( { changes: 0 } )
            } );
            const result = await handleEditWelcomeCommand( { args: 'list', services: mockServices, context: mockContext } );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'No users have custom welcome messages' ),
                expect.any( Object )
            );
        } );

        it( 'should list users with nickname, message count and image count', async () => {
            const mockPrepare = jest.fn().mockImplementation( ( sql ) => {
                if ( sql.includes( 'SELECT DISTINCT bot_user_id FROM welcome_messages' ) ) {
                    return { all: jest.fn().mockReturnValue( [ { bot_user_id: mockBotUserId } ] ) };
                } else if ( sql.includes( 'SELECT DISTINCT bot_user_id FROM welcome_pictures' ) ) {
                    return { all: jest.fn().mockReturnValue( [] ) };
                } else if ( sql.includes( 'SELECT site_specific_id FROM site_ids' ) ) {
                    return { get: jest.fn().mockReturnValue( { site_specific_id: mockUuid } ) };
                } else if ( sql.includes( 'COUNT(*)' ) && sql.includes( 'welcome_messages' ) ) {
                    return { get: jest.fn().mockReturnValue( { count: 2 } ) };
                } else if ( sql.includes( 'COUNT(*)' ) && sql.includes( 'welcome_pictures' ) ) {
                    return { get: jest.fn().mockReturnValue( { count: 1 } ) };
                }
                return { all: jest.fn().mockReturnValue( [] ), get: jest.fn().mockReturnValue( null ) };
            } );
            mockServices.databaseService.db.prepare = mockPrepare;

            const result = await handleEditWelcomeCommand( { args: 'list', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( mockNickname ),
                expect.any( Object )
            );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( '2 message(s)' ),
                expect.any( Object )
            );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( '1 image(s)' ),
                expect.any( Object )
            );
        } );
    } );

    describe( 'show subcommand', () => {
        it( 'should return error when no identifier provided', async () => {
            const result = await handleEditWelcomeCommand( { args: 'show', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
        } );

        it( 'should return error when user not found', async () => {
            mockServices.stateService._getCurrentState.mockReturnValue( { allUserData: {} } );
            const result = await handleEditWelcomeCommand( { args: 'show UnknownUser', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'not found' ),
                expect.any( Object )
            );
        } );

        it( 'should return error when user has no data in database', async () => {
            mockServices.databaseService.getOrCreateBotUser.mockReturnValue( null );
            const result = await handleEditWelcomeCommand( { args: `show ${ mockNickname }`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'No custom welcome messages found' ),
                expect.any( Object )
            );
        } );

        it( 'should show messages and images for a user found by nickname', async () => {
            const mockPrepare = jest.fn().mockImplementation( ( sql ) => {
                if ( sql.includes( 'SELECT message FROM welcome_messages' ) ) {
                    return { all: jest.fn().mockReturnValue( [ { message: 'Hey {username}!' } ] ) };
                } else if ( sql.includes( 'SELECT picture FROM welcome_pictures' ) ) {
                    return { all: jest.fn().mockReturnValue( [ { picture: 'https://giphy.com/img.gif' } ] ) };
                }
                return { all: jest.fn().mockReturnValue( [] ), get: jest.fn().mockReturnValue( null ) };
            } );
            mockServices.databaseService.db.prepare = mockPrepare;

            const result = await handleEditWelcomeCommand( { args: `show ${ mockNickname }`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Hey {username}!' ),
                expect.any( Object )
            );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'https://giphy.com/img.gif' ),
                expect.any( Object )
            );
        } );

        it( 'should show messages for a user found by UUID directly', async () => {
            const mockPrepare = jest.fn().mockImplementation( ( sql ) => {
                if ( sql.includes( 'SELECT message FROM welcome_messages' ) ) {
                    return { all: jest.fn().mockReturnValue( [ { message: 'Hey!' } ] ) };
                } else if ( sql.includes( 'SELECT picture FROM welcome_pictures' ) ) {
                    return { all: jest.fn().mockReturnValue( [] ) };
                }
                return { all: jest.fn().mockReturnValue( [] ), get: jest.fn().mockReturnValue( null ) };
            } );
            mockServices.databaseService.db.prepare = mockPrepare;

            const result = await handleEditWelcomeCommand( { args: `show ${ mockUuid }`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
        } );
    } );

    describe( 'addMessage subcommand', () => {
        it( 'should return error when no identifier provided', async () => {
            const result = await handleEditWelcomeCommand( { args: 'addMessage', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
        } );

        it( 'should return error when user not found', async () => {
            mockServices.stateService._getCurrentState.mockReturnValue( { allUserData: {} } );
            const result = await handleEditWelcomeCommand( { args: 'addMessage UnknownUser Hello!', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
        } );

        it( 'should return error when message is empty', async () => {
            const result = await handleEditWelcomeCommand( { args: `addMessage ${ mockNickname }`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Message cannot be empty' ),
                expect.any( Object )
            );
        } );

        it( 'should add a message for a user', async () => {
            mockServices.databaseService.db.prepare.mockImplementation( ( sql ) => {
                if ( sql.includes( 'SELECT id FROM welcome_messages' ) ) {
                    return { get: jest.fn().mockReturnValue( null ) };
                }
                return { all: jest.fn().mockReturnValue( [] ), get: jest.fn().mockReturnValue( null ) };
            } );

            const result = await handleEditWelcomeCommand( { args: `addMessage ${ mockNickname } Hey there {username}!`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            expect( mockServices.databaseService.addWelcomeMessage ).toHaveBeenCalledWith( mockBotUserId, 'Hey there {username}!' );
        } );

        it( 'should return error for duplicate message', async () => {
            mockServices.databaseService.db.prepare.mockImplementation( ( sql ) => {
                if ( sql.includes( 'SELECT id FROM welcome_messages' ) ) {
                    return { get: jest.fn().mockReturnValue( { id: 1 } ) };
                }
                return { all: jest.fn().mockReturnValue( [] ), get: jest.fn().mockReturnValue( null ) };
            } );

            const result = await handleEditWelcomeCommand( { args: `addMessage ${ mockNickname } Hey there {username}!`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'already exists' ),
                expect.any( Object )
            );
        } );
    } );

    describe( 'removeMessage subcommand', () => {
        it( 'should return error when message not found', async () => {
            mockServices.databaseService.removeWelcomeMessage.mockReturnValue( 0 );
            const result = await handleEditWelcomeCommand( { args: `removeMessage ${ mockNickname } Hey!`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Message not found' ),
                expect.any( Object )
            );
        } );

        it( 'should remove an existing message', async () => {
            mockServices.databaseService.removeWelcomeMessage.mockReturnValue( 1 );
            const result = await handleEditWelcomeCommand( { args: `removeMessage ${ mockNickname } Hey {username}!`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            expect( mockServices.databaseService.removeWelcomeMessage ).toHaveBeenCalledWith( mockBotUserId, 'Hey {username}!' );
        } );
    } );

    describe( 'addImage subcommand', () => {
        it( 'should return error when no identifier provided', async () => {
            const result = await handleEditWelcomeCommand( { args: 'addImage', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
        } );

        it( 'should return error for invalid image URL', async () => {
            const result = await handleEditWelcomeCommand( { args: `addImage ${ mockNickname } not-a-url`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Invalid image URL' ),
                expect.any( Object )
            );
        } );

        it( 'should add a valid image URL', async () => {
            mockServices.databaseService.db.prepare.mockImplementation( ( sql ) => {
                if ( sql.includes( 'SELECT id FROM welcome_pictures' ) ) {
                    return { get: jest.fn().mockReturnValue( null ) };
                }
                return { all: jest.fn().mockReturnValue( [] ), get: jest.fn().mockReturnValue( null ) };
            } );

            const result = await handleEditWelcomeCommand( { args: `addImage ${ mockNickname } https://media.giphy.com/img.gif`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            expect( mockServices.databaseService.addWelcomePicture ).toHaveBeenCalledWith( mockBotUserId, 'https://media.giphy.com/img.gif' );
        } );

        it( 'should return error for duplicate image URL', async () => {
            mockServices.databaseService.db.prepare.mockImplementation( ( sql ) => {
                if ( sql.includes( 'SELECT id FROM welcome_pictures' ) ) {
                    return { get: jest.fn().mockReturnValue( { id: 1 } ) };
                }
                return { all: jest.fn().mockReturnValue( [] ), get: jest.fn().mockReturnValue( null ) };
            } );

            const result = await handleEditWelcomeCommand( { args: `addImage ${ mockNickname } https://media.giphy.com/img.gif`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'already exists' ),
                expect.any( Object )
            );
        } );
    } );

    describe( 'removeImage subcommand', () => {
        it( 'should return error when image not found', async () => {
            mockServices.databaseService.removeWelcomePicture.mockReturnValue( 0 );
            const result = await handleEditWelcomeCommand( { args: `removeImage ${ mockNickname } https://media.giphy.com/img.gif`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
        } );

        it( 'should remove an existing image', async () => {
            mockServices.databaseService.removeWelcomePicture.mockReturnValue( 1 );
            const result = await handleEditWelcomeCommand( { args: `removeImage ${ mockNickname } https://media.giphy.com/img.gif`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            expect( mockServices.databaseService.removeWelcomePicture ).toHaveBeenCalledWith( mockBotUserId, 'https://media.giphy.com/img.gif' );
        } );
    } );

    describe( 'remove subcommand', () => {
        it( 'should return error when user has no data', async () => {
            mockServices.databaseService.getOrCreateBotUser.mockReturnValue( null );
            const result = await handleEditWelcomeCommand( { args: `remove ${ mockNickname }`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
        } );

        it( 'should remove all custom welcome data for a user', async () => {
            mockServices.databaseService.db.prepare.mockImplementation( ( sql ) => {
                if ( sql.includes( 'DELETE FROM welcome_messages' ) || sql.includes( 'DELETE FROM welcome_pictures' ) ) {
                    return { run: jest.fn().mockReturnValue( { changes: 1 } ) };
                }
                return { all: jest.fn().mockReturnValue( [] ), get: jest.fn().mockReturnValue( null ), run: jest.fn().mockReturnValue( { changes: 0 } ) };
            } );

            const result = await handleEditWelcomeCommand( { args: `remove ${ mockNickname }`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
        } );
    } );

    describe( 'unknown subcommand', () => {
        it( 'should return error for unknown subcommand', async () => {
            const result = await handleEditWelcomeCommand( { args: 'badcommand arg1', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Unknown subcommand' ),
                expect.any( Object )
            );
        } );
    } );

    describe( 'error handling', () => {
        it( 'should handle database errors gracefully', async () => {
            mockServices.databaseService.db.prepare.mockImplementation( () => { throw new Error( 'Database error' ); } );
            const result = await handleEditWelcomeCommand( { args: 'list', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Error' );
        } );
    } );
} );
