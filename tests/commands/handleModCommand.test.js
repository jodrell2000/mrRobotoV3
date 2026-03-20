'use strict';

const handleModCommand = require( '../../src/commands/Moderator Commands/handleModCommand' );

const makeServices = ( { role = 'moderator', allUserData = {}, djs = [] } = {} ) => ( {
    stateService: {
        getUserRole: jest.fn().mockReturnValue( role ),
        _getAllUserData: jest.fn().mockReturnValue( allUserData ),
        _getDjs: jest.fn().mockReturnValue( djs )
    },
    messageService: {
        sendResponse: jest.fn().mockResolvedValue( undefined )
    },
    hangSocketServices: {
        removeDj: jest.fn().mockResolvedValue( undefined ),
        skipSong: jest.fn().mockResolvedValue( undefined )
    }
} );

const makeContext = ( sender = 'uuid-mod-1' ) => ( {
    sender,
    fullMessage: { isPrivateMessage: true }
} );

describe( 'handleModCommand', () => {
    describe( 'metadata', () => {
        test( 'requiredRole is MODERATOR', () => {
            expect( handleModCommand.requiredRole ).toBe( 'MODERATOR' );
        } );
        test( 'description is set', () => {
            expect( typeof handleModCommand.description ).toBe( 'string' );
            expect( handleModCommand.description.length ).toBeGreaterThan( 0 );
        } );
        test( 'example is set', () => {
            expect( typeof handleModCommand.example ).toBe( 'string' );
        } );
        test( 'hidden is false', () => {
            expect( handleModCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'permission check', () => {
        test( 'rejects users without moderator role', async () => {
            const services = makeServices( { role: 'user' } );
            const result = await handleModCommand( { args: 'listUsers', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /permissions/i );
        } );

        test( 'allows moderators', async () => {
            const services = makeServices( { role: 'moderator' } );
            const result = await handleModCommand( { args: 'listUsers', services, context: makeContext() } );
            expect( result.success ).toBe( true );
        } );

        test( 'allows owners', async () => {
            const services = makeServices( { role: 'owner' } );
            const result = await handleModCommand( { args: 'listUsers', services, context: makeContext() } );
            expect( result.success ).toBe( true );
        } );
    } );

    describe( 'listUsers subcommand', () => {
        const allUserData = {
            'uuid-1': { userProfile: { nickname: 'DJ Cool' } },
            'uuid-2': { userProfile: { nickname: 'Zara' } },
            'uuid-3': { userProfile: { nickname: 'Alice' } },
            'uuid-4': { userProfile: { nickname: 'DJ Spaces  ' } }
        };

        test( 'returns each nickname wrapped in double quotes', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'listUsers', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( result.response ).toContain( '"DJ Cool"' );
            expect( result.response ).toContain( '"Zara"' );
            expect( result.response ).toContain( '"Alice"' );
        } );

        test( 'preserves trailing spaces inside quotes', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'listUsers', services, context: makeContext() } );
            expect( result.response ).toContain( '"DJ Spaces  "' );
        } );

        test( 'returns nicknames sorted alphabetically', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'listUsers', services, context: makeContext() } );
            const lines = result.response.split( '\n' );
            expect( lines[ 0 ] ).toBe( '"Alice"' );
            expect( lines[ 1 ] ).toBe( '"DJ Cool"' );
            expect( lines[ 2 ] ).toBe( '"DJ Spaces  "' );
            expect( lines[ 3 ] ).toBe( '"Zara"' );
        } );

        test( 'returns a message when no users are present', async () => {
            const services = makeServices( { allUserData: {} } );
            const result = await handleModCommand( { args: 'listUsers', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( result.response ).toMatch( /no users/i );
        } );

        test( 'is case-insensitive for the subcommand name', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'LISTUSERS', services, context: makeContext() } );
            expect( result.success ).toBe( true );
        } );

        test( 'sends response via messageService', async () => {
            const services = makeServices( { allUserData } );
            await handleModCommand( { args: 'listUsers', services, context: makeContext() } );
            expect( services.messageService.sendResponse ).toHaveBeenCalled();
        } );
    } );

    describe( 'unknown subcommand', () => {
        test( 'returns usage text', async () => {
            const services = makeServices();
            const result = await handleModCommand( { args: 'unknown', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.response ).toMatch( /usage/i );
        } );

        test( 'returns usage text when no subcommand given', async () => {
            const services = makeServices();
            const result = await handleModCommand( { args: '', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.response ).toMatch( /usage/i );
        } );
    } );

    describe( 'remove subcommand', () => {
        const allUserData = {
            'uuid-dj': { userProfile: { nickname: 'DJ Cool' } },
            'uuid-other': { userProfile: { nickname: 'Alice' } }
        };
        const djs = [ { uuid: 'uuid-dj' } ];

        test( 'returns error when name is missing', async () => {
            const services = makeServices( { allUserData, djs } );
            const result = await handleModCommand( { args: 'remove', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /missing dj name/i );
        } );

        test( 'returns error when user is not found', async () => {
            const services = makeServices( { allUserData, djs } );
            const result = await handleModCommand( { args: 'remove Unknown DJ', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /user not found/i );
        } );

        test( 'returns error when user is not on the decks', async () => {
            const services = makeServices( { allUserData, djs } );
            const result = await handleModCommand( { args: 'remove Alice', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /not on decks/i );
        } );

        test( 'removes the DJ and returns success', async () => {
            const services = makeServices( { allUserData, djs } );
            const result = await handleModCommand( { args: 'remove DJ Cool', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'DJ Cool' );
            expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith( services.socket, 'uuid-dj' );
        } );

        test( 'matches DJ name case-insensitively', async () => {
            const services = makeServices( { allUserData, djs } );
            const result = await handleModCommand( { args: 'remove dj cool', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith( services.socket, 'uuid-dj' );
        } );

        test( 'strips surrounding double quotes from name', async () => {
            const services = makeServices( { allUserData, djs } );
            const result = await handleModCommand( { args: 'remove "DJ Cool"', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith( services.socket, 'uuid-dj' );
        } );

        test( 'responds privately to the moderator', async () => {
            const services = makeServices( { allUserData, djs } );
            await handleModCommand( { args: 'remove DJ Cool', services, context: makeContext() } );
            const [ , opts ] = services.messageService.sendResponse.mock.calls.at( -1 );
            expect( opts.isPrivateMessage ).toBe( true );
        } );

        test( 'returns error response when socket action throws', async () => {
            const services = makeServices( { allUserData, djs } );
            services.hangSocketServices.removeDj.mockRejectedValueOnce( new Error( 'socket failure' ) );
            const result = await handleModCommand( { args: 'remove DJ Cool', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'socket failure' );
        } );
    } );

    describe( 'skip subcommand', () => {
        test( 'calls skipSong and returns success', async () => {
            const services = makeServices();
            const result = await handleModCommand( { args: 'skip', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.hangSocketServices.skipSong ).toHaveBeenCalledWith( services.socket );
        } );

        test( 'is case-insensitive for the subcommand name', async () => {
            const services = makeServices();
            const result = await handleModCommand( { args: 'SKIP', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.hangSocketServices.skipSong ).toHaveBeenCalled();
        } );

        test( 'returns error response when socket action throws', async () => {
            const services = makeServices();
            services.hangSocketServices.skipSong.mockRejectedValueOnce( new Error( 'not allowed' ) );
            const result = await handleModCommand( { args: 'skip', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'not allowed' );
        } );
    } );
} );
