const playedSong = require( '../../src/handlers/playedSong' );
const votedOnSong = require( '../../src/handlers/votedOnSong' );
const playedOneTimeAnimation = require( '../../src/handlers/playedOneTimeAnimation' );

describe( 'Vote count updating across handlers', () => {
    let services;

    beforeEach( () => {
        // Clear global state
        global.previousPlayedSong = null;
        global.playedSongTimer = null;

        services = {
            logger: {
                debug: jest.fn(),
                error: jest.fn(),
                info: jest.fn()
            },
            hangSocketServices: { upVote: jest.fn().mockResolvedValue() },
            hangoutState: {
                nowPlaying: { song: { artistName: 'Test Artist', trackName: 'Test Song', songShortId: 'song-123' } },
                djs: [ { uuid: 'dj-uuid-123' } ],
                voteCounts: { likes: 0, dislikes: 0, stars: 0 }
            },
            socket: { id: 'socket1' },
            messageService: {
                formatMention: jest.fn().mockImplementation( ( uuid ) => `<@uid:${ uuid }>` ),
                sendGroupMessage: jest.fn().mockResolvedValue()
            },
            dataService: {
                getValue: jest.fn().mockImplementation( ( key ) => {
                    if ( key === 'justPlayedMessage' ) {
                        return '{username} played {trackName} by {artistName} 👍{likes} 👎{dislikes} ⭐{stars}';
                    }
                    return null;
                } )
            },
            featuresService: {
                isFeatureEnabled: jest.fn().mockImplementation( ( feature ) => {
                    return feature === 'justPlayed' || feature === 'nowPlayingMessage';
                } )
            }
        };
    } );

    test( 'should store song with vote counts from hangout state on bot startup', async () => {
        const message = {
            statePatch: [
                { op: 'replace', path: '/djs/0/uuid', value: 'dj-uuid-123' },
                { op: 'replace', path: '/nowPlaying/song/artistName', value: 'Test Artist' },
                { op: 'replace', path: '/nowPlaying/song/trackName', value: 'Test Song' },
                { op: 'replace', path: '/nowPlaying/song/songShortId', value: 'song-123' }
            ]
        };

        // Bot startup: no previous song stored
        global.previousPlayedSong = null;
        services.hangoutState.voteCounts = { likes: 5, dislikes: 1, stars: 2 };

        await playedSong( message, {}, services );

        expect( global.previousPlayedSong ).toEqual( {
            djUuid: 'dj-uuid-123',
            artistName: 'Test Artist',
            trackName: 'Test Song',
            songShortId: 'song-123',
            sevenDigitalId: null,
            spotifyId: null,
            appleId: null,
            youtubeId: null,
            voteCounts: { likes: 5, dislikes: 1, stars: 2 }
        } );
    } );

    test( 'should reset vote counts to 0 for new songs during normal operation', async () => {
        // NOTE: This test scenario is verified to work in practice via manual testing
        // The test framework setup may not perfectly replicate the live environment
        // Start with a previous song already stored
        global.previousPlayedSong = {
            djUuid: 'dj-uuid-123',
            artistName: 'Test Artist',
            trackName: 'Test Song',
            voteCounts: { likes: 5, dislikes: 1, stars: 2 }
        };

        const newMessage = {
            statePatch: [
                { op: 'replace', path: '/djs/0/uuid', value: 'dj-uuid-456' },
                { op: 'replace', path: '/nowPlaying/song/artistName', value: 'New Artist' },
                { op: 'replace', path: '/nowPlaying/song/trackName', value: 'New Song' },
                { op: 'replace', path: '/nowPlaying/song/songShortId', value: 'song-456' }
            ]
        };

        // Update hangout state to reflect the new song
        services.hangoutState.nowPlaying.song = { artistName: 'New Artist', trackName: 'New Song', songShortId: 'song-456' };
        services.hangoutState.voteCounts = { likes: 10, dislikes: 3, stars: 5 }; // Old vote counts
        services.hangoutState.djs = [ { uuid: 'dj-uuid-456' } ]; // New DJ

        await playedSong( newMessage, {}, services );

        // Should reset both stored song vote counts and hangout state vote counts
        expect( global.previousPlayedSong ).toEqual( {
            djUuid: 'dj-uuid-456',
            artistName: 'New Artist',
            trackName: 'New Song',
            songShortId: 'song-456',
            sevenDigitalId: null,
            spotifyId: null,
            appleId: null,
            youtubeId: null,
            voteCounts: { likes: 0, dislikes: 0, stars: 0 }
        } );

        expect( services.hangoutState.voteCounts ).toEqual( {
            likes: 0,
            dislikes: 0,
            stars: 0
        } );
    } );

    test( 'should update stored song vote counts via votedOnSong handler', () => {
        // First, store a song
        global.previousPlayedSong = {
            djUuid: 'dj-uuid-123',
            artistName: 'Test Artist',
            trackName: 'Test Song',
            voteCounts: { likes: 5, dislikes: 1, stars: 2 }
        };

        // Simulate a vote update
        const voteMessage = {
            statePatch: [
                { op: 'replace', path: '/voteCounts/likes', value: 6 },
                { op: 'replace', path: '/voteCounts/dislikes', value: 2 }
            ]
        };

        votedOnSong( voteMessage, {}, services );

        expect( global.previousPlayedSong.voteCounts ).toEqual( {
            likes: 6,
            dislikes: 2,
            stars: 2
        } );
    } );

    test( 'should update stored song vote counts via playedOneTimeAnimation handler', () => {
        // First, store a song
        global.previousPlayedSong = {
            djUuid: 'dj-uuid-123',
            artistName: 'Test Artist',
            trackName: 'Test Song',
            voteCounts: { likes: 5, dislikes: 1, stars: 2 }
        };

        // Update hangout state with new vote counts
        services.hangoutState.voteCounts = { likes: 7, dislikes: 0, stars: 3 };

        const animationMessage = {
            name: 'playedOneTimeAnimation',
            params: { userUuid: 'user-123', animation: 'jump' }
        };

        playedOneTimeAnimation( animationMessage, {}, services );

        expect( global.previousPlayedSong.voteCounts ).toEqual( {
            likes: 7,
            dislikes: 0,
            stars: 3
        } );
    } );

    test( 'should announce justPlayed with updated vote counts when song changes', async () => {
        // First, store a song
        global.previousPlayedSong = {
            djUuid: 'dj-uuid-123',
            artistName: 'Previous Artist',
            trackName: 'Previous Song',
            voteCounts: { likes: 10, dislikes: 2, stars: 5 }
        };

        // Now a new song starts playing
        const newSongMessage = {
            statePatch: [
                { op: 'replace', path: '/djs/0/uuid', value: 'dj-uuid-456' },
                { op: 'replace', path: '/nowPlaying/song/artistName', value: 'New Artist' },
                { op: 'replace', path: '/nowPlaying/song/trackName', value: 'New Song' },
                { op: 'replace', path: '/nowPlaying/song/songShortId', value: 'song-456' }
            ]
        };

        await playedSong( newSongMessage, {}, services );

        // Should have announced the previous song with its vote counts
        expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
            '<@uid:dj-uuid-123> played Previous Song by Previous Artist 👍10 👎2 ⭐5',
            { services }
        );
    } );

    test( 'should integrate snag emoji star votes with justPlayed announcements', async () => {
        // First, store a song
        global.previousPlayedSong = {
            djUuid: 'dj-uuid-123',
            artistName: 'Current Song',
            trackName: 'Playing Now',
            voteCounts: { likes: 5, dislikes: 1, stars: 2 }
        };

        // Simulate snag emoji being sent (this increments stars)
        const snagMessage = {
            name: 'playedOneTimeAnimation',
            params: {
                userUuid: 'dj-uuid-123',
                animation: 'emoji',
                emoji: '💜'
            }
        };

        // Update services to match the current DJ
        services.hangoutState.djs = [ { uuid: 'dj-uuid-123' } ];
        services.hangoutState.voteCounts = { likes: 5, dislikes: 1, stars: 2 };

        playedOneTimeAnimation( snagMessage, {}, services );

        // Verify the star count was incremented in both places
        expect( services.hangoutState.voteCounts.stars ).toBe( 3 );
        expect( global.previousPlayedSong.voteCounts.stars ).toBe( 3 );

        // Now a new song starts playing
        const newSongMessage = {
            statePatch: [
                { op: 'replace', path: '/djs/0/uuid', value: 'dj-uuid-456' },
                { op: 'replace', path: '/nowPlaying/song/artistName', value: 'New Artist' },
                { op: 'replace', path: '/nowPlaying/song/trackName', value: 'New Song' },
                { op: 'replace', path: '/nowPlaying/song/songShortId', value: 'song-456' }
            ]
        };

        await playedSong( newSongMessage, {}, services );

        // Should announce with the updated star count (3 instead of 2)
        expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
            '<@uid:dj-uuid-123> played Playing Now by Current Song 👍5 👎1 ⭐3',
            { services }
        );
    } );
} );
