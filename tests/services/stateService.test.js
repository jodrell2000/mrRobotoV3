const StateService = require( '../../src/services/stateService' );

describe( 'StateService', () => {
    let stateService;
    let mockState;

    beforeEach( () => {
        mockState = {
            allUsers: [ { uuid: '123', tokenRole: 'user' } ],
            djs: [ { uuid: '123', nextSong: {} } ],
            nowPlaying: { song: {}, startTime: 0 },
            settings: { name: 'Test Room' },
            vibeMeter: 5,
            voteCounts: { likes: 1, dislikes: 0, stars: 0 },
            allUserData: { '123': { userProfile: {} } }
        };
        stateService = new StateService( mockState );
    } );

    describe( '_getAllUsers (private)', () => {
        it( 'should return all users', () => {
            expect( stateService._getAllUsers() ).toEqual( [ { uuid: '123', tokenRole: 'user' } ] );
        } );

        it( 'should return empty array if no users', () => {
            stateService.hangoutState.allUsers = null;
            expect( stateService._getAllUsers() ).toEqual( [] );
        } );
    } );

    describe( '_getDjs (private)', () => {
        it( 'should return all DJs', () => {
            expect( stateService._getDjs() ).toEqual( [ { uuid: '123', nextSong: {} } ] );
        } );

        it( 'should return empty array if no DJs', () => {
            stateService.hangoutState.djs = null;
            expect( stateService._getDjs() ).toEqual( [] );
        } );
    } );

    describe( '_getNowPlaying (private)', () => {
        it( 'should return now playing info', () => {
            expect( stateService._getNowPlaying() ).toEqual( { song: {}, startTime: 0 } );
        } );

        it( 'should return null if nothing playing', () => {
            stateService.hangoutState.nowPlaying = null;
            expect( stateService._getNowPlaying() ).toBeNull();
        } );
    } );

    describe( '_getSettings (private)', () => {
        it( 'should return settings', () => {
            expect( stateService._getSettings() ).toEqual( { name: 'Test Room' } );
        } );

        it( 'should return empty object if no settings', () => {
            stateService.hangoutState.settings = null;
            expect( stateService._getSettings() ).toEqual( {} );
        } );
    } );

    describe( '_getVibeMeter (private)', () => {
        it( 'should return vibe meter value', () => {
            expect( stateService._getVibeMeter() ).toBe( 5 );
        } );

        it( 'should return 0 if no vibe meter', () => {
            stateService.hangoutState.vibeMeter = null;
            expect( stateService._getVibeMeter() ).toBe( 0 );
        } );
    } );

    describe( 'getVoteCounts (public)', () => {
        it( 'should return vote counts', () => {
            expect( stateService.getVoteCounts() ).toEqual( { likes: 1, dislikes: 0, stars: 0 } );
        } );

        it( 'should return default counts if no votes', () => {
            stateService.hangoutState.voteCounts = null;
            expect( stateService.getVoteCounts() ).toEqual( { likes: 0, dislikes: 0, stars: 0 } );
        } );
    } );

    describe( 'getUserRole (public)', () => {
        beforeEach( () => {
            mockState.allUsers = [
                {
                    uuid: 'owner-uuid',
                    tokenRole: 'globalModerator',
                    canDj: true,
                    highestRole: 'owner'
                },
                {
                    uuid: 'moderator-uuid',
                    tokenRole: 'moderator',
                    canDj: true,
                    highestRole: 'moderator'
                },
                {
                    uuid: 'coowner-uuid',
                    tokenRole: 'coOwner',
                    canDj: true,
                    highestRole: 'coOwner'
                },
                {
                    uuid: 'user-uuid',
                    tokenRole: 'user',
                    canDj: true
                }
            ];
            stateService = new StateService( mockState );
        } );

        it( 'should return "owner" for owner user', () => {
            expect( stateService.getUserRole( 'owner-uuid' ) ).toBe( 'owner' );
        } );

        it( 'should return "moderator" for moderator user', () => {
            expect( stateService.getUserRole( 'moderator-uuid' ) ).toBe( 'moderator' );
        } );

        it( 'should return "coOwner" for co-owner user', () => {
            expect( stateService.getUserRole( 'coowner-uuid' ) ).toBe( 'coOwner' );
        } );

        it( 'should return "user" for regular user without highestRole', () => {
            expect( stateService.getUserRole( 'user-uuid' ) ).toBe( 'user' );
        } );

        it( 'should throw error for non-existent user', () => {
            expect( () => {
                stateService.getUserRole( 'non-existent-uuid' );
            } ).toThrow( 'User with UUID non-existent-uuid not found in the room' );
        } );
    } );

    describe( '_getAllUserData (private)', () => {
        it( 'should return all user data', () => {
            expect( stateService._getAllUserData() ).toEqual( { '123': { userProfile: {} } } );
        } );

        it( 'should return empty object if no user data', () => {
            stateService.hangoutState.allUserData = null;
            expect( stateService._getAllUserData() ).toEqual( {} );
        } );
    } );

    describe( 'getHangoutName (public)', () => {
        it( 'should return the hangout name from settings', () => {
            mockState.settings = { name: 'My Cool Hangout' };
            stateService = new StateService( mockState );
            expect( stateService.getHangoutName() ).toBe( 'My Cool Hangout' );
        } );

        it( 'should return "our Hangout" if no name in settings', () => {
            mockState.settings = { description: 'A room without a name' };
            stateService = new StateService( mockState );
            expect( stateService.getHangoutName() ).toBe( 'our Hangout' );
        } );

        it( 'should return "our Hangout" if settings is null', () => {
            mockState.settings = null;
            stateService = new StateService( mockState );
            expect( stateService.getHangoutName() ).toBe( 'our Hangout' );
        } );

        it( 'should return "our Hangout" if settings.name is empty string', () => {
            mockState.settings = { name: '' };
            stateService = new StateService( mockState );
            expect( stateService.getHangoutName() ).toBe( 'our Hangout' );
        } );
    } );

    describe( 'normalized state access', () => {
        const normalizedState = {
            room: { id: 'room-1', name: 'Room' },
            usersById: {
                'user-1': {
                    id: 'user-1',
                    nickname: 'Alex',
                    platformRole: 'moderator',
                    isPresent: true,
                    profile: { nickname: 'Alex' }
                }
            },
            djQueue: [ { position: 0, userId: 'user-1', isPlaying: true } ],
            nowPlaying: null,
            votes: { likes: 1, dislikes: 2, grabs: 3 },
            roomSettings: { queueLocked: false }
        };

        test( 'uses normalized state for public accessors', () => {
            const normalizedService = new StateService( mockState, {}, normalizedState );

            expect( normalizedService.getState() ).toBe( normalizedState );
            expect( normalizedService.getRoom() ).toEqual( normalizedState.room );
            expect( normalizedService.getUsers() ).toEqual( Object.values( normalizedState.usersById ) );
            expect( normalizedService.getUser( 'user-1' ) ).toEqual( normalizedState.usersById[ 'user-1' ] );
            expect( normalizedService.getDjQueue() ).toEqual( normalizedState.djQueue );
            expect( normalizedService.getCurrentDj() ).toEqual( normalizedState.djQueue[ 0 ] );
            expect( normalizedService.getVotes() ).toEqual( normalizedState.votes );
            expect( normalizedService.getNowPlaying() ).toBeNull();
        } );

        test( 'returns cached profile and marks it stale after refresh failure', async () => {
            const logger = { warn: jest.fn() };
            const services = {
                apiAdapter: {
                    getUserProfile: jest.fn().mockRejectedValue( new Error( 'offline' ) )
                },
                logger
            };
            const normalizedService = new StateService( mockState, services, normalizedState );

            const profile = await normalizedService.getUserProfile( 'user-1', { refresh: true } );

            expect( profile ).toEqual( { nickname: 'Alex' } );
            expect( normalizedState.usersById[ 'user-1' ].profileStale ).toBe( true );
            expect( logger.warn ).toHaveBeenCalled();
        } );
    } );
} );
