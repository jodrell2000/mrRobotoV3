'use strict';

const handleModCommand = require( '../../src/commands/Moderator Commands/handleModCommand' );

const makeServices = ( { role = 'moderator', allUserData = {}, djs = [] } = {} ) => {
    // Convert old-style allUserData to normalized users format for getUsers()
    const users = Object.entries( allUserData ).map( ( [ uuid, userData ] ) => ( {
        id: uuid,
        uuid,
        nickname: userData?.userProfile?.nickname || uuid,
        platformRole: userData?.userProfile?.role || 'user',
        isPresent: true,
        userProfile: userData?.userProfile
    } ) );

    // Convert old-style djs to normalized format for getDjQueue()
    const djQueue = djs.map( ( dj, index ) => ( {
        position: index,
        userId: dj.uuid || dj.id,
        uuid: dj.uuid,
        id: dj.id || dj.uuid,
        isPlaying: index === 0
    } ) );

    return {
        stateService: {
            getUserRole: jest.fn().mockReturnValue( role ),
            getUsers: jest.fn().mockReturnValue( users ),
            getDjQueue: jest.fn().mockReturnValue( djQueue ),
            _getAllUserData: jest.fn().mockReturnValue( allUserData ),
            _getDjs: jest.fn().mockReturnValue( djs ),
            getHangoutName: jest.fn().mockReturnValue( 'Test Hangout' )
        },
        messageService: {
            sendResponse: jest.fn().mockResolvedValue( undefined )
        },
        socketAdapter: {
            removeDj: jest.fn().mockResolvedValue( { success: true } ),
            skipSong: jest.fn().mockResolvedValue( { success: true } ),
            moveInQueue: jest.fn().mockResolvedValue( { success: true } ),
            kickUser: jest.fn().mockResolvedValue( { success: true } )
        },
        platformActions: {
            removeFromDJQueue: jest.fn().mockResolvedValue( { success: true } ),
            skipTrack: jest.fn().mockResolvedValue( { success: true } ),
            moveInQueue: jest.fn().mockResolvedValue( { success: true } ),
            kickUser: jest.fn().mockResolvedValue( { success: true } ),
            muteUser: jest.fn().mockResolvedValue( { success: true, supported: true } ),
            unmuteUser: jest.fn().mockResolvedValue( { success: true, supported: true } )
        }
    };
};

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
            expect( services.platformActions.removeFromDJQueue ).toHaveBeenCalledWith( 'uuid-dj' );
        } );

        test( 'matches DJ name case-insensitively', async () => {
            const services = makeServices( { allUserData, djs } );
            const result = await handleModCommand( { args: 'remove dj cool', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.removeFromDJQueue ).toHaveBeenCalledWith( 'uuid-dj' );
        } );

        test( 'strips surrounding double quotes from name', async () => {
            const services = makeServices( { allUserData, djs } );
            const result = await handleModCommand( { args: 'remove "DJ Cool"', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.removeFromDJQueue ).toHaveBeenCalledWith( 'uuid-dj' );
        } );

        test( 'responds privately to the moderator', async () => {
            const services = makeServices( { allUserData, djs } );
            await handleModCommand( { args: 'remove DJ Cool', services, context: makeContext() } );
            const [ , opts ] = services.messageService.sendResponse.mock.calls.at( -1 );
            expect( opts.isPrivateMessage ).toBe( true );
        } );

        test( 'returns error response when socket action throws', async () => {
            const services = makeServices( { allUserData, djs } );
            services.platformActions.removeFromDJQueue.mockResolvedValueOnce( { success: false, error: 'socket failure' } );
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
            expect( services.platformActions.skipTrack ).toHaveBeenCalled();
        } );

        test( 'is case-insensitive for the subcommand name', async () => {
            const services = makeServices();
            const result = await handleModCommand( { args: 'SKIP', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.skipTrack ).toHaveBeenCalled();
        } );

        test( 'returns error response when socket action throws', async () => {
            const services = makeServices();
            services.platformActions.skipTrack.mockResolvedValueOnce( { success: false, error: 'not allowed' } );
            const result = await handleModCommand( { args: 'skip', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'not allowed' );
        } );
    } );

    describe( 'requeue subcommand', () => {
        const allUserData = {
            'uuid-dj': {
                userProfile: { nickname: 'DJ Cool', role: 'moderator' }
            }
        };
        const djs = [ { uuid: 'uuid-dj' } ];

        test( 'returns error when name is missing', async () => {
            const services = makeServices();
            const result = await handleModCommand( { args: 'requeue', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toContain( 'Missing' );
        } );

        test( 'returns error when position is missing', async () => {
            const services = makeServices();
            const result = await handleModCommand( { args: 'requeue DJ Cool', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toContain( 'Invalid' );
        } );

        test( 'returns error when position is not a number', async () => {
            const services = makeServices();
            const result = await handleModCommand( { args: 'requeue DJ Cool invalid', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toContain( 'Invalid' );
        } );

        test( 'returns error when user is not found', async () => {
            const services = makeServices();
            const result = await handleModCommand( { args: 'requeue Unknown 2', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toContain( 'not found' );
        } );

        test( 'returns error when user is not on the decks', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'requeue DJ Cool 2', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toContain( 'Not on decks' );
        } );

        test( 'calls moveInQueue and returns success', async () => {
            const services = makeServices( { allUserData, djs } );
            const result = await handleModCommand( { args: 'requeue DJ Cool 3', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.moveInQueue ).toHaveBeenCalledWith( 'uuid-dj', 3 );
        } );

        test( 'is case-insensitive for the subcommand name', async () => {
            const services = makeServices( { allUserData, djs } );
            const result = await handleModCommand( { args: 'REQUEUE DJ Cool 2', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.moveInQueue ).toHaveBeenCalled();
        } );

        test( 'handles quoted names', async () => {
            const services = makeServices( { allUserData, djs } );
            const result = await handleModCommand( { args: 'requeue "DJ Cool" 1', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.moveInQueue ).toHaveBeenCalledWith( 'uuid-dj', 1 );
        } );

        test( 'returns error response when socket action throws', async () => {
            const services = makeServices( { allUserData, djs } );
            services.platformActions.moveInQueue.mockResolvedValueOnce( { success: false, error: 'position out of range' } );
            const result = await handleModCommand( { args: 'requeue DJ Cool 5', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'position out of range' );
        } );
    } );

    describe( 'kick subcommand', () => {
        const allUserData = {
            'uuid-1': { userProfile: { nickname: 'User To Kick' } },
            'uuid-2': { userProfile: { nickname: 'Another User' } }
        };

        test( 'kicks a user by name', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'kick "User To Kick"', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.kickUser ).toHaveBeenCalledWith( 'uuid-1', '' );
        } );

        test( 'kicks a user with a reason', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'kick "User To Kick" spam', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.kickUser ).toHaveBeenCalledWith( 'uuid-1', 'spam' );
        } );

        test( 'returns error when user not found', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'kick "Nonexistent User"', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'User not found' );
            expect( services.platformActions.kickUser ).not.toHaveBeenCalled();
        } );

        test( 'returns error when no username provided', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'kick', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Missing username' );
        } );

        test( 'handles api failure', async () => {
            const services = makeServices( { allUserData } );
            services.platformActions.kickUser.mockResolvedValueOnce( { success: false, error: 'API error' } );
            const result = await handleModCommand( { args: 'kick "User To Kick"', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'API error' );
        } );

        test( 'handles exception during kick', async () => {
            const services = makeServices( { allUserData } );
            services.platformActions.kickUser.mockRejectedValueOnce( new Error( 'Network error' ) );
            const result = await handleModCommand( { args: 'kick "User To Kick"', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Network error' );
        } );
    } );

    describe( 'mute subcommand', () => {
        const allUserData = {
            'uuid-mute-1': { userProfile: { nickname: 'User To Mute' } },
            'uuid-mute-2': { userProfile: { nickname: 'Another User' } }
        };

        test( 'mutes a user by name', async () => {
            const services = makeServices( { allUserData } );
            services.platformActions.muteUser.mockResolvedValueOnce( { success: true, supported: true } );
            const result = await handleModCommand( { args: 'mute "User To Mute"', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.muteUser ).toHaveBeenCalledWith( 'uuid-mute-1', null );
        } );

        test( 'mutes a user with duration', async () => {
            const services = makeServices( { allUserData } );
            services.platformActions.muteUser.mockResolvedValueOnce( { success: true, supported: true } );
            const result = await handleModCommand( { args: 'mute "User To Mute" 5m', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.muteUser ).toHaveBeenCalledWith( 'uuid-mute-1', 5 * 60 * 1000 );
        } );

        test( 'mutes a user with duration without unit (defaults to minutes)', async () => {
            const services = makeServices( { allUserData } );
            services.platformActions.muteUser.mockResolvedValueOnce( { success: true, supported: true } );
            const result = await handleModCommand( { args: 'mute "User To Mute" 5', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.muteUser ).toHaveBeenCalledWith( 'uuid-mute-1', 5 * 60 * 1000 );
        } );

        test( 'mutes a user with duration and reason', async () => {
            const services = makeServices( { allUserData } );
            services.platformActions.muteUser.mockResolvedValueOnce( { success: true, supported: true } );
            const result = await handleModCommand( { args: 'mute "User To Mute" 5m spam', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.muteUser ).toHaveBeenCalledWith( 'uuid-mute-1', 5 * 60 * 1000 );
        } );

        test( 'mutes a user without quotes and defaults duration to minutes', async () => {
            const services = makeServices( { allUserData } );
            services.platformActions.muteUser.mockResolvedValueOnce( { success: true, supported: true } );
            const result = await handleModCommand( { args: 'mute "User To Mute" 5 test', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.muteUser ).toHaveBeenCalledWith( 'uuid-mute-1', 5 * 60 * 1000 );
        } );

        test( 'returns error when user not found', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'mute "Nonexistent User"', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'User "Nonexistent User" not found' );
        } );

        test( 'returns error when username not provided', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'mute', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Missing username' );
        } );

        test( 'handles mute api failure', async () => {
            const services = makeServices( { allUserData } );
            services.platformActions.muteUser.mockResolvedValueOnce( { success: false, supported: true, error: 'API error' } );
            const result = await handleModCommand( { args: 'mute "User To Mute"', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toContain( 'Failed to mute' );
        } );

        test( 'handles exception during mute', async () => {
            const services = makeServices( { allUserData } );
            services.platformActions.muteUser.mockRejectedValueOnce( new Error( 'Network error' ) );
            const result = await handleModCommand( { args: 'mute "User To Mute"', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Network error' );
        } );
    } );

    describe( 'unmute subcommand', () => {
        const allUserData = {
            'uuid-unmute-1': { userProfile: { nickname: 'User To Unmute' } },
            'uuid-unmute-2': { userProfile: { nickname: 'Another User' } }
        };

        test( 'unmutes a user by name', async () => {
            const services = makeServices( { allUserData } );
            services.platformActions.unmuteUser.mockResolvedValueOnce( { success: true, supported: true } );
            const result = await handleModCommand( { args: 'unmute "User To Unmute"', services, context: makeContext() } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.unmuteUser ).toHaveBeenCalledWith( 'uuid-unmute-1' );
        } );

        test( 'returns error when user not found', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'unmute "Nonexistent User"', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'User "Nonexistent User" not found' );
        } );

        test( 'returns error when username not provided', async () => {
            const services = makeServices( { allUserData } );
            const result = await handleModCommand( { args: 'unmute', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Missing username' );
        } );

        test( 'handles unmute api failure', async () => {
            const services = makeServices( { allUserData } );
            services.platformActions.unmuteUser.mockResolvedValueOnce( { success: false, supported: true, error: 'API error' } );
            const result = await handleModCommand( { args: 'unmute "User To Unmute"', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toContain( 'Failed to unmute' );
        } );

        test( 'handles exception during unmute', async () => {
            const services = makeServices( { allUserData } );
            services.platformActions.unmuteUser.mockRejectedValueOnce( new Error( 'Network error' ) );
            const result = await handleModCommand( { args: 'unmute "User To Unmute"', services, context: makeContext() } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Network error' );
        } );
    } );
} );
