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

    let mockServices;
    let mockContext;

    beforeEach( () => {
        jest.clearAllMocks();

        mockServices = {
            messageService: {
                sendResponse: jest.fn().mockResolvedValue()
            },
            config: { COMMAND_SWITCH: '!' },
            stateService: {
                _getCurrentState: jest.fn().mockReturnValue( {
                    allUserData: {
                        [ mockUuid ]: { userProfile: { nickname: mockNickname } }
                    }
                } )
            },
            databaseService: {
                initialized: true,
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
        it( 'should report no users when file does not exist', async () => {
            fs.existsSync.mockReturnValue( false );
            const result = await handleEditWelcomeCommand( { args: 'list', services: mockServices, context: mockContext } );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'No users have custom welcome messages' ),
                expect.any( Object )
            );
        } );

        it( 'should report no users when file is empty', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {} ) );
            const result = await handleEditWelcomeCommand( { args: 'list', services: mockServices, context: mockContext } );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'No users have custom welcome messages' ),
                expect.any( Object )
            );
        } );

        it( 'should list users with nickname, message count and image count', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [ 'Hey!', 'Welcome!' ], pictures: [ 'https://giphy.com/img.gif' ] }
            } ) );
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

        it( 'should return error when user has no data in file', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {} ) );
            const result = await handleEditWelcomeCommand( { args: `show ${ mockNickname }`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'No custom welcome messages found' ),
                expect.any( Object )
            );
        } );

        it( 'should show messages and images for a user found by nickname', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [ 'Hey {username}!' ], pictures: [ 'https://giphy.com/img.gif' ] }
            } ) );
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
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [ 'Hey!' ], pictures: [] }
            } ) );
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

        it( 'should add a message for a new user entry', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {} ) );
            fs.writeFileSync.mockImplementation( () => { } );

            const result = await handleEditWelcomeCommand( { args: `addMessage ${ mockNickname } Hey there {username}!`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            const saved = JSON.parse( fs.writeFileSync.mock.calls[ 0 ][ 1 ] );
            expect( saved[ mockUuid ].messages ).toContain( 'Hey there {username}!' );
        } );

        it( 'should append a message to an existing user entry', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [ 'First message' ], pictures: [] }
            } ) );
            fs.writeFileSync.mockImplementation( () => { } );

            const result = await handleEditWelcomeCommand( { args: `addMessage ${ mockNickname } Second message`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            const saved = JSON.parse( fs.writeFileSync.mock.calls[ 0 ][ 1 ] );
            expect( saved[ mockUuid ].messages ).toHaveLength( 2 );
        } );

        it( 'should return error for duplicate message', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [ 'Hey there {username}!' ], pictures: [] }
            } ) );
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
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [ 'Other message' ], pictures: [] }
            } ) );
            const result = await handleEditWelcomeCommand( { args: `removeMessage ${ mockNickname } Hey!`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Message not found' ),
                expect.any( Object )
            );
        } );

        it( 'should remove an existing message', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [ 'Hey {username}!', 'Second message' ], pictures: [] }
            } ) );
            fs.writeFileSync.mockImplementation( () => { } );

            const result = await handleEditWelcomeCommand( { args: `removeMessage ${ mockNickname } Hey {username}!`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            const saved = JSON.parse( fs.writeFileSync.mock.calls[ 0 ][ 1 ] );
            expect( saved[ mockUuid ].messages ).not.toContain( 'Hey {username}!' );
            expect( saved[ mockUuid ].messages ).toContain( 'Second message' );
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
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {} ) );
            fs.writeFileSync.mockImplementation( () => { } );

            const result = await handleEditWelcomeCommand( { args: `addImage ${ mockNickname } https://media.giphy.com/img.gif`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            const saved = JSON.parse( fs.writeFileSync.mock.calls[ 0 ][ 1 ] );
            expect( saved[ mockUuid ].pictures ).toContain( 'https://media.giphy.com/img.gif' );
        } );

        it( 'should return error for duplicate image URL', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [], pictures: [ 'https://media.giphy.com/img.gif' ] }
            } ) );
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
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [], pictures: [ 'https://media.giphy.com/other.gif' ] }
            } ) );
            const result = await handleEditWelcomeCommand( { args: `removeImage ${ mockNickname } https://media.giphy.com/img.gif`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
        } );

        it( 'should remove an existing image', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [], pictures: [ 'https://media.giphy.com/img.gif', 'https://media.giphy.com/other.gif' ] }
            } ) );
            fs.writeFileSync.mockImplementation( () => { } );

            const result = await handleEditWelcomeCommand( { args: `removeImage ${ mockNickname } https://media.giphy.com/img.gif`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            const saved = JSON.parse( fs.writeFileSync.mock.calls[ 0 ][ 1 ] );
            expect( saved[ mockUuid ].pictures ).not.toContain( 'https://media.giphy.com/img.gif' );
            expect( saved[ mockUuid ].pictures ).toContain( 'https://media.giphy.com/other.gif' );
        } );
    } );

    describe( 'remove subcommand', () => {
        it( 'should return error when user has no data', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {} ) );
            const result = await handleEditWelcomeCommand( { args: `remove ${ mockNickname }`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
        } );

        it( 'should remove all custom welcome data for a user', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [ 'Hey!' ], pictures: [] }
            } ) );
            fs.writeFileSync.mockImplementation( () => { } );

            const result = await handleEditWelcomeCommand( { args: `remove ${ mockNickname }`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            const saved = JSON.parse( fs.writeFileSync.mock.calls[ 0 ][ 1 ] );
            expect( saved[ mockUuid ] ).toBeUndefined();
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

    describe( 'UUID resolution', () => {
        it( 'should accept a UUID directly without state lookup for resolution', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [ 'Hey!' ], pictures: [] }
            } ) );
            // Reset state mock to verify UUID resolution path
            mockServices.stateService._getCurrentState.mockReturnValue( { allUserData: {} } );
            const result = await handleEditWelcomeCommand( { args: `show ${ mockUuid }`, services: mockServices, context: mockContext } );
            // UUID is resolved directly without state lookup; only getNickname may call state
            expect( result.success ).toBe( true );
        } );

        it( 'should fall back to database when nickname not found in live state', async () => {
            mockServices.stateService._getCurrentState.mockReturnValue( { allUserData: {} } );
            mockServices.databaseService.findDjByNickname.mockReturnValue( { uuid: mockUuid, nickname: mockNickname } );
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [ 'Hey!' ], pictures: [] }
            } ) );
            const result = await handleEditWelcomeCommand( { args: `show ${ mockNickname }`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            expect( mockServices.databaseService.findDjByNickname ).toHaveBeenCalledWith( mockNickname );
        } );

        it( 'should return error when nickname is not found anywhere', async () => {
            mockServices.stateService._getCurrentState.mockReturnValue( { allUserData: {} } );
            mockServices.databaseService.findDjByNickname.mockReturnValue( null );
            mockServices.databaseService.getAllDjNicknames.mockReturnValue( [] );
            const result = await handleEditWelcomeCommand( { args: 'show GhostUser', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'not found' ),
                expect.any( Object )
            );
        } );

        it( 'should resolve a nickname with trailing space inside quotes (trim fix)', async () => {
            mockServices.stateService._getCurrentState.mockReturnValue( { allUserData: {} } );
            mockServices.databaseService.findDjByNickname.mockReturnValue( null );
            mockServices.databaseService.getAllDjNicknames.mockReturnValue( [
                { uuid: mockUuid, nickname: mockNickname }
            ] );
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [ 'Hey!' ], pictures: [] }
            } ) );
            // Trailing space inside quotes should be trimmed and still resolve via normalized fallback
            const result = await handleEditWelcomeCommand( { args: `show "${ mockNickname }"`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
        } );

        it( 'should resolve nickname with double spaces via normalised whitespace fallback', async () => {
            const doubleSpaceUuid = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
            const storedNickname = 'Dr.  Fart  Mustache  ';
            mockServices.stateService._getCurrentState.mockReturnValue( { allUserData: {} } );
            mockServices.databaseService.findDjByNickname.mockReturnValue( null );
            mockServices.databaseService.getAllDjNicknames.mockReturnValue( [
                { uuid: doubleSpaceUuid, nickname: storedNickname }
            ] );
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ doubleSpaceUuid ]: { messages: [ 'Hey!' ], pictures: [] }
            } ) );
            // User types single spaces; DB has double spaces — normalised match should succeed
            const result = await handleEditWelcomeCommand( { args: 'show "Dr. Fart Mustache"', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
        } );
    } );

    describe( 'quoted nickname support', () => {
        const spacedUuid = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
        const spacedNickname = 'Dr. Fart Mustache';

        beforeEach( () => {
            mockServices.stateService._getCurrentState.mockReturnValue( {
                allUserData: {
                    [ spacedUuid ]: { userProfile: { nickname: spacedNickname } }
                }
            } );
        } );

        it( 'should resolve a quoted multi-word nickname for show', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ spacedUuid ]: { messages: [ 'Hey!' ], pictures: [] }
            } ) );
            const result = await handleEditWelcomeCommand( { args: `show "${ spacedNickname }"`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
        } );

        it( 'should add a message for a quoted multi-word nickname', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {} ) );
            fs.writeFileSync.mockImplementation( () => { } );
            const result = await handleEditWelcomeCommand( { args: `addMessage "${ spacedNickname }" Welcome {username}!`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            const saved = JSON.parse( fs.writeFileSync.mock.calls[ 0 ][ 1 ] );
            expect( saved[ spacedUuid ].messages ).toContain( 'Welcome {username}!' );
        } );

        it( 'should add an image for a quoted multi-word nickname', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {} ) );
            fs.writeFileSync.mockImplementation( () => { } );
            const result = await handleEditWelcomeCommand( {
                args: `addImage "${ spacedNickname }" https://c.tenor.com/qosLRuL-U1oAAAAC/69.gif`,
                services: mockServices,
                context: mockContext
            } );
            expect( result.success ).toBe( true );
            const saved = JSON.parse( fs.writeFileSync.mock.calls[ 0 ][ 1 ] );
            expect( saved[ spacedUuid ].pictures ).toContain( 'https://c.tenor.com/qosLRuL-U1oAAAAC/69.gif' );
        } );

        it( 'should remove all data for a quoted multi-word nickname', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ spacedUuid ]: { messages: [ 'Hey!' ], pictures: [] }
            } ) );
            fs.writeFileSync.mockImplementation( () => { } );
            const result = await handleEditWelcomeCommand( { args: `remove "${ spacedNickname }"`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
            const saved = JSON.parse( fs.writeFileSync.mock.calls[ 0 ][ 1 ] );
            expect( saved[ spacedUuid ] ).toBeUndefined();
        } );

        it( 'should still resolve single-word nicknames without quotes', async () => {
            mockServices.stateService._getCurrentState.mockReturnValue( {
                allUserData: {
                    [ mockUuid ]: { userProfile: { nickname: mockNickname } }
                }
            } );
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                [ mockUuid ]: { messages: [ 'Hey!' ], pictures: [] }
            } ) );
            const result = await handleEditWelcomeCommand( { args: `show ${ mockNickname }`, services: mockServices, context: mockContext } );
            expect( result.success ).toBe( true );
        } );
    } );

    describe( 'fuzzy suggestions on not-found', () => {
        beforeEach( () => {
            mockServices.stateService._getCurrentState.mockReturnValue( { allUserData: {} } );
            mockServices.databaseService.findDjByNickname.mockReturnValue( null );
        } );

        it( 'should suggest similar names from the database when user is not found', async () => {
            mockServices.databaseService.getAllDjNicknames.mockReturnValue( [
                { uuid: 'uuid-1', nickname: 'JohnDoe' },
                { uuid: 'uuid-2', nickname: 'JohnDoh' },
                { uuid: 'uuid-3', nickname: 'JaneDoe' }
            ] );
            const result = await handleEditWelcomeCommand( { args: 'show JohnDoe123', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            const call = mockServices.messageService.sendResponse.mock.calls[ 0 ][ 0 ];
            expect( call ).toContain( 'Did you mean' );
            expect( call ).toContain( '"JohnDoe"' );
        } );

        it( 'should wrap suggestions in double quotes', async () => {
            mockServices.databaseService.getAllDjNicknames.mockReturnValue( [
                { uuid: 'uuid-1', nickname: 'Dr. Fart Mustache' }
            ] );
            const result = await handleEditWelcomeCommand( { args: 'show "Dr Fart Mustache"', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            const call = mockServices.messageService.sendResponse.mock.calls[ 0 ][ 0 ];
            expect( call ).toMatch( /"Dr\. Fart Mustache"/ );
        } );

        it( 'should return plain not-found when no similar names exist', async () => {
            mockServices.databaseService.getAllDjNicknames.mockReturnValue( [
                { uuid: 'uuid-1', nickname: 'Zaphod' }
            ] );
            const result = await handleEditWelcomeCommand( { args: 'show XXXXXXXX', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            const call = mockServices.messageService.sendResponse.mock.calls[ 0 ][ 0 ];
            expect( call ).not.toContain( 'Did you mean' );
            expect( call ).toContain( 'not found' );
        } );

        it( 'should also use live state nicknames for suggestions', async () => {
            mockServices.stateService._getCurrentState.mockReturnValue( {
                allUserData: {
                    'live-uuid': { userProfile: { nickname: 'LiveDJ' } }
                }
            } );
            mockServices.databaseService.getAllDjNicknames.mockReturnValue( [] );
            const result = await handleEditWelcomeCommand( { args: 'show LiveDJj', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            const call = mockServices.messageService.sendResponse.mock.calls[ 0 ][ 0 ];
            expect( call ).toContain( 'Did you mean' );
            expect( call ).toContain( '"LiveDJ"' );
        } );
    } );

    describe( 'error handling', () => {
        it( 'should handle file read errors gracefully', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( () => { throw new Error( 'Disk error' ); } );
            const result = await handleEditWelcomeCommand( { args: 'list', services: mockServices, context: mockContext } );
            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Error processing command' );
        } );
    } );
} );
