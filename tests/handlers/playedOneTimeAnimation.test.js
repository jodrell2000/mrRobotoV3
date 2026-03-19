const playedOneTimeAnimation = require( '../../src/handlers/playedOneTimeAnimation' );

describe( 'playedOneTimeAnimation handler', () => {
    let services;

    beforeEach( () => {
        global.previousPlayedSong = null;

        services = {
            logger: {
                debug: jest.fn(),
                error: jest.fn(),
                info: jest.fn()
            },
            afkService: {
                recordActivity: jest.fn()
            },
            hangoutState: {
                voteCounts: { likes: 3, dislikes: 1, stars: 2 },
                djs: [ { uuid: 'current-dj-123' } ]
            }
        };
    } );

    test( 'should handle no stored previous song gracefully', () => {
        const message = {
            name: 'playedOneTimeAnimation',
            params: { userUuid: 'user-123', animation: 'jump' }
        };

        expect( () => playedOneTimeAnimation( message, {}, services ) ).not.toThrow();
    } );

    test( 'should update vote counts from hangout state', () => {
        global.previousPlayedSong = {
            djUuid: 'test-dj',
            artistName: 'Test Artist',
            trackName: 'Test Song',
            voteCounts: { likes: 0, dislikes: 0, stars: 0 }
        };

        const message = {
            name: 'playedOneTimeAnimation',
            params: { userUuid: 'user-123', animation: 'jump' }
        };

        playedOneTimeAnimation( message, {}, services );

        expect( global.previousPlayedSong.voteCounts ).toEqual( {
            likes: 3,
            dislikes: 1,
            stars: 2
        } );
    } );

    test( 'should handle missing vote counts in hangout state', () => {
        global.previousPlayedSong = {
            djUuid: 'test-dj',
            artistName: 'Test Artist',
            trackName: 'Test Song',
            voteCounts: { likes: 5, dislikes: 2, stars: 1 }
        };

        services.hangoutState = {}; // No voteCounts

        const message = {
            name: 'playedOneTimeAnimation',
            params: { userUuid: 'user-123', animation: 'jump' }
        };

        playedOneTimeAnimation( message, {}, services );

        expect( global.previousPlayedSong.voteCounts ).toEqual( { likes: 5, dislikes: 2, stars: 1 } ); // unchanged
    } );

    test( 'should increment stars when snag emoji is detected', () => {
        const message = {
            name: 'playedOneTimeAnimation',
            params: {
                userUuid: 'current-dj-123',
                animation: 'emoji',
                emoji: '💜'
            }
        };

        playedOneTimeAnimation( message, {}, services );

        expect( services.hangoutState.voteCounts.stars ).toBe( 3 ); // 2 + 1
    } );

    test( 'should handle different snag emojis', () => {
        const snagEmojis = [ '💜', '⭐️' ];

        snagEmojis.forEach( ( emoji ) => {
            // Reset state
            services.hangoutState.voteCounts.stars = 5;

            const message = {
                name: 'playedOneTimeAnimation',
                params: {
                    userUuid: 'current-dj-123',
                    animation: 'emoji',
                    emoji: emoji
                }
            };

            playedOneTimeAnimation( message, {}, services );

            expect( services.hangoutState.voteCounts.stars ).toBe( 6 );
        } );
    } );

    test( 'should not increment stars for non-snag emojis', () => {
        const message = {
            name: 'playedOneTimeAnimation',
            params: {
                userUuid: 'current-dj-123',
                animation: 'emoji',
                emoji: '😀'
            }
        };

        playedOneTimeAnimation( message, {}, services );

        expect( services.hangoutState.voteCounts.stars ).toBe( 2 ); // Unchanged
    } );

    describe( 'afkService integration', () => {
        test( 'should record emoji activity for the user who fired the animation', () => {
            const message = {
                name: 'playedOneTimeAnimation',
                params: { userUuid: 'user-abc', emoji: '💜' }
            };

            playedOneTimeAnimation( message, {}, services );

            expect( services.afkService.recordActivity ).toHaveBeenCalledWith( 'user-abc', 'emoji' );
        } );

        test( 'should record emoji activity for non-snag emojis too', () => {
            const message = {
                name: 'playedOneTimeAnimation',
                params: { userUuid: 'user-abc', emoji: '😀' }
            };

            playedOneTimeAnimation( message, {}, services );

            expect( services.afkService.recordActivity ).toHaveBeenCalledWith( 'user-abc', 'emoji' );
        } );

        test( 'should not call recordActivity when userUuid is missing', () => {
            const message = {
                name: 'playedOneTimeAnimation',
                params: { emoji: '💜' }
            };

            playedOneTimeAnimation( message, {}, services );

            expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
        } );

        test( 'should not throw if afkService is absent', () => {
            const servicesWithoutAfk = { ...services, afkService: undefined };
            const message = {
                name: 'playedOneTimeAnimation',
                params: { userUuid: 'user-abc', emoji: '💜' }
            };

            expect( () => playedOneTimeAnimation( message, {}, servicesWithoutAfk ) ).not.toThrow();
        } );
    } );
} );
