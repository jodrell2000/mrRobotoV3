const normalizeHangState = require( '../../src/siteFrameworks/hangfm/normalizeHangState.js' );
const translateHangEvent = require( '../../src/siteFrameworks/hangfm/translateHangEvent.js' );
const framework = require( '../../src/siteFrameworks/hangfm/framework.js' );

describe( 'Hang.fm H3 normalization', () => {
    const config = {
        HANGOUT_ID: 'room-id',
        HANGOUT_SLUG: 'i-love-the-80s'
    };

    test( 'normalizes users, DJ queue, playback, votes, and room settings', () => {
        const state = normalizeHangState( {
            allUsers: [ { uuid: 'user-1', highestRole: 'moderator' } ],
            allUserData: {
                'user-1': { userProfile: { nickname: 'Alex' } }
            },
            djs: [ { uuid: 'user-1', nextSong: { id: 'next-1' } } ],
            nowPlaying: {
                playId: 'play-1',
                startTime: '2026-09-07T12:00:00.000Z',
                song: {
                    songShortId: 'song-1',
                    artistName: 'Artist',
                    trackName: 'Title',
                    musicProviders: { spotify: 'spotify-1' }
                }
            },
            voteCounts: { likes: 3, dislikes: 1, stars: 2 },
            settings: { name: 'Room', description: 'Description', queueLocked: false }
        }, config );

        expect( state.room ).toEqual( {
            id: 'room-id',
            name: 'Room',
            url: 'i-love-the-80s',
            description: 'Description'
        } );
        expect( state.usersById[ 'user-1' ] ).toEqual( {
            id: 'user-1',
            nickname: 'Alex',
            platformRole: 'moderator',
            isPresent: true,
            profile: { nickname: 'Alex' }
        } );
        expect( state.djQueue[ 0 ] ).toEqual( {
            position: 0,
            userId: 'user-1',
            nextSong: { id: 'next-1' },
            isPlaying: true
        } );
        expect( state.nowPlaying ).toMatchObject( {
            djId: 'user-1',
            playId: 'play-1',
            startedAt: '2026-09-07T12:00:00.000Z',
            song: { id: 'song-1', artist: 'Artist', title: 'Title' }
        } );
        expect( state.votes ).toEqual( { likes: 3, dislikes: 1, grabs: 2 } );
        expect( state.roomSettings ).toEqual( { name: 'Room', description: 'Description', queueLocked: false } );
    } );

    test( 'uses null when no track is playing', () => {
        expect( normalizeHangState( { nowPlaying: null }, config ).nowPlaying ).toBeNull();
    } );
} );

describe( 'Hang.fm H3 event translation', () => {
    const baseContext = {
        roomId: 'room-id',
        occurredAt: '2026-09-07T12:00:00.000Z'
    };

    test( 'translates a DJ removal without treating it as a room departure', () => {
        const events = translateHangEvent( { name: 'removedDj', statePatch: [] }, {
            ...baseContext,
            currentState: { djQueue: [] }
        } );

        expect( events ).toHaveLength( 1 );
        expect( events[ 0 ] ).toMatchObject( {
            type: 'djQueueChanged',
            payload: { reason: 'removedDj' }
        } );
        expect( events.some( event => event.type === 'userLeft' ) ).toBe( false );
    } );

    test( 'translates a user removal as room departure', () => {
        const events = translateHangEvent( {
            statePatch: [ { op: 'remove', path: '/allUserData/user-1' } ]
        }, {
            ...baseContext,
            currentState: { djQueue: [] }
        } );

        expect( events ).toContainEqual( expect.objectContaining( {
            type: 'userLeft',
            payload: { userId: 'user-1' }
        } ) );
    } );

    test( 'ends the previous playback once when a new play replaces it', () => {
        const previousState = {
            nowPlaying: {
                playId: 'play-1',
                song: { id: 'song-1', artist: 'Artist', title: 'Old' }
            }
        };
        const currentState = {
            nowPlaying: {
                playId: 'play-2',
                song: { id: 'song-2', artist: 'Artist', title: 'New' }
            }
        };

        const events = translateHangEvent( { statePatch: [ { op: 'replace', path: '/nowPlaying/playId', value: 'play-2' } ] }, {
            ...baseContext,
            previousState,
            currentState
        } );

        expect( events.map( event => event.type ) ).toEqual( [ 'trackEnded', 'trackStarted' ] );
        expect( events[ 0 ].payload.playId ).toBe( 'play-1' );
        expect( events[ 1 ].payload.playId ).toBe( 'play-2' );
        expect( events[ 0 ].payload.dedupeKey ).toBe( 'trackEnded:play-1' );
    } );

    test( 'does not include raw payloads unless requested', () => {
        const message = { name: 'addedDj', statePatch: [] };
        const withoutRaw = translateHangEvent( message, {
            ...baseContext,
            currentState: { djQueue: [] }
        } );
        const withRaw = translateHangEvent( message, {
            ...baseContext,
            currentState: { djQueue: [] },
            includeRaw: true
        } );

        expect( withoutRaw[ 0 ].raw ).toBeUndefined();
        expect( withRaw[ 0 ].raw ).toBe( message );
    } );
} );

test( 'registers the H3 Hang translators in the framework specification', () => {
    expect( framework.translators.normalizeState ).toBe( normalizeHangState );
    expect( framework.translators.translateEvent ).toBe( translateHangEvent );
} );
