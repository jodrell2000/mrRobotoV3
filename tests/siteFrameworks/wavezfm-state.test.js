const normalizeWavezState = require( '../../src/siteFrameworks/wavezfm/normalizeWavezState.js' );
const translateWavezEvent = require( '../../src/siteFrameworks/wavezfm/translateWavezEvent.js' );

describe( 'Wavez.fm state normalization', () => {
    test( 'normalizes room, bot identity, current user, and flexible settings', () => {
        const state = normalizeWavezState( {
            data: {
                bot: {
                    id: 'room-bot:token-1',
                    name: 'I ❤️ the 80s Bot',
                    permissions: [ 'read_state', 'send_chat' ]
                },
                room: {
                    id: 'room-1',
                    slug: 'i-the-80s',
                    name: "I ❤️ the '80s!",
                    description: 'Room description',
                    queueLocked: false
                },
                currentUser: {
                    id: 'user-1',
                    username: 'Jodrell',
                    roomRole: 'host'
                },
                snapshot: {
                    roomId: 'room-1',
                    roomName: "I ❤️ the '80s!",
                    roomSlug: 'i-the-80s'
                }
            }
        }, { WAVEZFM_ROOM_ID: 'fallback-room' } );

        expect( state.room ).toEqual( {
            id: 'room-1',
            name: "I ❤️ the '80s!",
            url: 'i-the-80s',
            description: 'Room description'
        } );
        expect( state.usersById[ 'user-1' ] ).toMatchObject( {
            id: 'user-1',
            nickname: 'Jodrell',
            platformRole: 'host',
            isPresent: true
        } );
        expect( state.djQueue ).toEqual( [] );
        expect( state.nowPlaying ).toBeNull();
        expect( state.votes ).toEqual( { likes: 0, dislikes: 0, grabs: 0 } );
        expect( state.roomSettings.queueLocked ).toBe( false );
        expect( state.metadata ).toMatchObject( {
            source: 'wavezfm',
            bot: { id: 'room-bot:token-1', name: 'I ❤️ the 80s Bot' }
        } );
    } );

    test( 'room role wins over unrelated platformRole/globalRole fields (e.g. subscription tier)', () => {
        const state = normalizeWavezState( {
            data: {
                currentUser: {
                    id: 'user-1',
                    username: 'Jodrell',
                    roomRole: 'host',
                    platformRole: 'subscriber'
                }
            }
        }, { WAVEZFM_ROOM_ID: 'fallback-room' } );

        expect( state.usersById[ 'user-1' ] ).toMatchObject( {
            id: 'user-1',
            platformRole: 'host'
        } );
    } );

    test( 'handles partial Wavez responses', () => {
        expect( normalizeWavezState( {}, { WAVEZFM_ROOM_ID: 'fallback-room' } ) ).toMatchObject( {
            room: { id: 'fallback-room' },
            usersById: {},
            djQueue: [],
            nowPlaying: null
        } );
    } );

    test( 'normalizes verified queue, playback, and vote fields', () => {
        const state = normalizeWavezState( {
            data: {
                room: { id: 'room-1', name: 'Room' },
                snapshot: {
                    roomId: 'room-1',
                    queue: [ 'dj-1', 'dj-2' ],
                    playback: {
                        trackId: 'track-1',
                        source: 'youtube',
                        sourceId: 'source-1',
                        title: 'Painter Man',
                        artist: 'Boney M.',
                        startedAtServerMs: 1789218947651,
                        djId: 'dj-1',
                        nextTrack: { id: 'track-2', title: 'Next' }
                    },
                    votes: { woots: 3, mehs: 1, grabs: 2 }
                }
            }
        } );

        expect( state.djQueue ).toEqual( [
            { position: 0, userId: 'dj-1', nextSong: { id: 'track-2', title: 'Next' }, isPlaying: true },
            { position: 1, userId: 'dj-2', nextSong: undefined, isPlaying: false }
        ] );
        expect( state.nowPlaying ).toMatchObject( {
            djId: 'dj-1',
            playId: 'track-1',
            song: { id: 'track-1', artist: 'Boney M.', title: 'Painter Man', providerIds: { youtube: 'source-1' } }
        } );
        expect( state.votes ).toEqual( { likes: 3, dislikes: 1, grabs: 2 } );
    } );
} );

describe( 'Wavez.fm playback event translation', () => {
    test( 'translates explicit track ended and started packets', () => {
        const ended = translateWavezEvent( {
            event: 'track_ended',
            timestamp: '2026-09-13T15:06:20.419Z',
            payload: {
                roomId: 'room-1',
                trackId: 'track-old',
                source: 'youtube',
                sourceId: 'source-old',
                title: 'Old Track',
                artist: 'Artist',
                djId: 'dj-1',
                startedAtServerMs: 1000
            }
        }, { config: { WAVEZFM_ROOM_ID: 'room-1' } } );
        const started = translateWavezEvent( {
            event: 'track_started',
            timestamp: '2026-09-13T15:06:20.420Z',
            payload: {
                roomId: 'room-1',
                trackId: 'track-new',
                source: 'youtube',
                sourceId: 'source-new',
                title: 'New Track',
                artist: 'Artist',
                djId: 'dj-1',
                startedAtServerMs: 2000
            }
        }, { config: { WAVEZFM_ROOM_ID: 'room-1' } } );

        expect( ended[ 0 ] ).toMatchObject( {
            type: 'trackEnded',
            roomId: 'room-1',
            payload: { playId: 'track-old', playback: { djId: 'dj-1' } }
        } );
        expect( started[ 0 ] ).toMatchObject( {
            type: 'trackStarted',
            roomId: 'room-1',
            payload: { playId: 'track-new', playback: { song: { title: 'New Track' } } }
        } );
    } );

    test( 'translates vote_updated and votes_snapshot packets into a normalized voteChanged event', () => {
        const updated = translateWavezEvent( {
            type: 'event',
            event: 'vote_updated',
            version: 'v1',
            timestamp: '2026-09-13T16:20:19.179Z',
            payload: {
                requestId: 'req-29-1789316418288',
                userId: 'cdf05ce7-0cbe-4361-bcb3-4247219c2b9f',
                type: 'woot',
                active: true,
                previousReaction: null,
                trackId: 'a0c34a5f-0484-491c-988d-efbae82ce9ce',
                votesSnapshot: {
                    woots: 2,
                    mehs: 0,
                    grabs: 0,
                    wootUserIds: [ 'd35ef5b7-c78c-4433-a64b-c7d3d5eb9849', 'cdf05ce7-0cbe-4361-bcb3-4247219c2b9f' ],
                    mehUserIds: [],
                    grabUserIds: [],
                    revision: 70,
                    trackId: 'a0c34a5f-0484-491c-988d-efbae82ce9ce'
                }
            }
        }, { config: { WAVEZFM_ROOM_ID: 'room-1' } } );
        const snapshot = translateWavezEvent( {
            type: 'event',
            event: 'votes_snapshot',
            version: 'v1',
            timestamp: '2026-09-13T16:20:18.983Z',
            payload: {
                woots: 1,
                mehs: 0,
                grabs: 0,
                wootUserIds: [ 'd35ef5b7-c78c-4433-a64b-c7d3d5eb9849' ],
                mehUserIds: [],
                grabUserIds: [],
                revision: 69,
                trackId: 'a0c34a5f-0484-491c-988d-efbae82ce9ce'
            }
        }, { config: { WAVEZFM_ROOM_ID: 'room-1' } } );

        expect( updated[ 0 ] ).toMatchObject( {
            type: 'voteChanged',
            payload: { votes: { likes: 2, dislikes: 0, grabs: 0 } }
        } );
        expect( snapshot[ 0 ] ).toMatchObject( {
            type: 'voteChanged',
            payload: { votes: { likes: 1, dislikes: 0, grabs: 0 } }
        } );
    } );
} );