const votedOnSong = require( '../../src/handlers/votedOnSong' );
const { handleVotedOnSongEvent } = require( '../../src/handlers/votedOnSong' );

describe( 'votedOnSong handler', () => {
    let services;

    beforeEach( () => {
        global.previousPlayedSong = null;

        services = {
            logger: {
                debug: jest.fn(),
                error: jest.fn()
            }
        };
    } );

    test( 'should handle no stored previous song gracefully', () => {
        const message = {
            statePatch: [
                { op: 'replace', path: '/voteCounts/likes', value: 5 }
            ]
        };

        expect( () => votedOnSong( message, {}, services ) ).not.toThrow();
        expect( services.logger.debug ).toHaveBeenCalledWith( '[votedOnSong] No previous song stored to update vote counts' );
    } );

    test( 'should update vote counts for stored previous song', () => {
        global.previousPlayedSong = {
            djUuid: 'test-dj',
            artistName: 'Test Artist',
            trackName: 'Test Song',
            voteCounts: { likes: 1, dislikes: 0, stars: 0 }
        };

        const message = {
            statePatch: [
                { op: 'replace', path: '/voteCounts/likes', value: 5 },
                { op: 'replace', path: '/voteCounts/stars', value: 2 }
            ]
        };

        votedOnSong( message, {}, services );

        expect( global.previousPlayedSong.voteCounts ).toEqual( {
            likes: 5,
            dislikes: 0,
            stars: 2
        } );
    } );
} );

describe( 'handleVotedOnSongEvent (normalized handler)', () => {
    let services;

    beforeEach( () => {
        global.previousPlayedSong = null;

        services = {
            logger: {
                debug: jest.fn(),
                error: jest.fn()
            },
            afkService: {
                recordActivity: jest.fn()
            },
            frameworkSpecification: { id: 'hangfm' }
        };
    } );

    test( 'should return early if no services in context', async () => {
        const event = { payload: { votes: { likes: 5, dislikes: 0, stars: 2 } } };
        const context = {};

        await handleVotedOnSongEvent( event, context );
        // Should not throw
    } );

    test( 'should return early if no votes in payload', async () => {
        const event = { payload: {} };
        const context = { services };

        await handleVotedOnSongEvent( event, context );

        expect( services.logger.debug ).toHaveBeenCalledWith( '[handleVotedOnSongEvent] No votes in event payload' );
    } );

    test( 'should update previous song vote counts for Hang framework', async () => {
        global.previousPlayedSong = {
            djUuid: 'test-dj',
            artistName: 'Test Artist',
            trackName: 'Test Song',
            voteCounts: { likes: 1, dislikes: 0, stars: 0 }
        };

        const event = {
            payload: {
                votes: { likes: 5, dislikes: 2, stars: 3 }
            }
        };
        const context = { services };

        await handleVotedOnSongEvent( event, context );

        expect( global.previousPlayedSong.voteCounts ).toEqual( {
            likes: 5,
            dislikes: 2,
            stars: 3
        } );
    } );

    test( 'should map grabs to stars for Wavez framework', async () => {
        services.frameworkSpecification.id = 'wavezfm';
        global.previousPlayedSong = {
            djUuid: 'test-dj',
            artistName: 'Test Artist',
            trackName: 'Test Song',
            voteCounts: { likes: 1, dislikes: 0, stars: 0 }
        };

        const event = {
            payload: {
                votes: { likes: 3, dislikes: 1, grabs: 2 }
            }
        };
        const context = { services };

        await handleVotedOnSongEvent( event, context );

        // For Wavez, grabs should be mapped to stars in global.previousPlayedSong
        expect( global.previousPlayedSong.voteCounts.stars ).toBe( 2 );
        expect( global.previousPlayedSong.voteCounts.likes ).toBe( 3 );
        expect( global.previousPlayedSong.voteCounts.dislikes ).toBe( 1 );
    } );

    test( 'should record AFK activity for user who voted', async () => {
        global.previousPlayedSong = {
            voteCounts: { likes: 0, dislikes: 0, stars: 0 }
        };

        const event = {
            payload: {
                votes: { likes: 1, dislikes: 0, stars: 0 },
                userId: 'user-123',
                active: true
            }
        };
        const context = { services };

        await handleVotedOnSongEvent( event, context );

        expect( services.afkService.recordActivity ).toHaveBeenCalledWith( 'user-123', 'vote' );
    } );

    test( 'should not record AFK activity when active is false', async () => {
        global.previousPlayedSong = {
            voteCounts: { likes: 0, dislikes: 0, stars: 0 }
        };

        const event = {
            payload: {
                votes: { likes: 1, dislikes: 0, stars: 0 },
                userId: 'user-123',
                active: false
            }
        };
        const context = { services };

        await handleVotedOnSongEvent( event, context );

        expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
    } );

    test( 'should not record AFK activity when userId is missing', async () => {
        global.previousPlayedSong = {
            voteCounts: { likes: 0, dislikes: 0, stars: 0 }
        };

        const event = {
            payload: {
                votes: { likes: 1, dislikes: 0, stars: 0 }
            }
        };
        const context = { services };

        await handleVotedOnSongEvent( event, context );

        expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
    } );

    test( 'should handle missing afkService gracefully', async () => {
        const servicesWithoutAfk = { ...services, afkService: undefined };
        global.previousPlayedSong = {
            voteCounts: { likes: 0, dislikes: 0, stars: 0 }
        };

        const event = {
            payload: {
                votes: { likes: 1, dislikes: 0, stars: 0 },
                userId: 'user-123'
            }
        };
        const context = { services: servicesWithoutAfk };

        await handleVotedOnSongEvent( event, context );

        expect( global.previousPlayedSong.voteCounts.likes ).toBe( 1 );
    } );

    test( 'should initialize voteCounts if not present', async () => {
        global.previousPlayedSong = {
            djUuid: 'test-dj',
            artistName: 'Test Artist',
            trackName: 'Test Song'
            // No voteCounts yet
        };

        const event = {
            payload: {
                votes: { likes: 5, dislikes: 2, stars: 3 }
            }
        };
        const context = { services };

        await handleVotedOnSongEvent( event, context );

        expect( global.previousPlayedSong.voteCounts ).toBeDefined();
        expect( global.previousPlayedSong.voteCounts.likes ).toBe( 5 );
    } );
} );