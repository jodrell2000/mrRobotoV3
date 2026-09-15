const playedOneTimeAnimation = require( '../../src/handlers/playedOneTimeAnimation' );
const { handlePlayedOneTimeAnimationEvent } = require( '../../src/handlers/playedOneTimeAnimation' );

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

describe( 'handlePlayedOneTimeAnimationEvent (normalized handler)', () => {
    let services;
    let stateService;

    beforeEach( () => {
        global.previousPlayedSong = null;

        stateService = {
            getVotes: jest.fn().mockReturnValue( { likes: 3, dislikes: 1, stars: 2, grabs: 0 } ),
            setVotes: jest.fn(),
            _getDjs: jest.fn().mockReturnValue( [ { uuid: 'current-dj-123' } ] ),
            getState: jest.fn().mockReturnValue( {} )
        };

        services = {
            logger: {
                debug: jest.fn(),
                error: jest.fn(),
                info: jest.fn()
            },
            afkService: {
                recordActivity: jest.fn()
            },
            stateService,
            frameworkSpecification: { id: 'hangfm' }
        };
    } );

    test( 'should return early if no services in context', async () => {
        const event = { payload: { emoji: '💜', userId: 'user-123' } };
        const context = {};

        await handlePlayedOneTimeAnimationEvent( event, context );
        // Should not throw and should not call any services
    } );

    test( 'should return early if no emoji in payload', async () => {
        const event = { payload: { userId: 'user-123' } };
        const context = { services };

        await handlePlayedOneTimeAnimationEvent( event, context );

        expect( services.logger.debug ).toHaveBeenCalled();
        expect( stateService.setVotes ).not.toHaveBeenCalled();
    } );

    test( 'should return early if emoji is not a snag emoji', async () => {
        const event = { payload: { emoji: '😀', userId: 'user-123' } };
        const context = { services };

        await handlePlayedOneTimeAnimationEvent( event, context );

        expect( services.logger.debug ).toHaveBeenCalled();
        expect( stateService.setVotes ).not.toHaveBeenCalled();
    } );

    test( 'should increment stars for Hang framework when snag emoji detected', async () => {
        const event = { payload: { emoji: '💜', userId: 'current-dj-123' } };
        const context = { services };

        await handlePlayedOneTimeAnimationEvent( event, context );

        expect( stateService.getVotes ).toHaveBeenCalled();
        expect( stateService.setVotes ).toHaveBeenCalledWith( {
            likes: 3,
            dislikes: 1,
            stars: 3,
            grabs: 0
        } );
        expect( services.logger.info ).toHaveBeenCalled();
    } );

    test( 'should increment grabs for Wavez framework when snag emoji detected', async () => {
        services.frameworkSpecification.id = 'wavezfm';
        stateService.getVotes.mockReturnValue( { likes: 3, dislikes: 1, stars: 0, grabs: 2 } );

        const event = { payload: { emoji: '⭐️', userId: 'current-dj-123' } };
        const context = { services };

        await handlePlayedOneTimeAnimationEvent( event, context );

        expect( stateService.setVotes ).toHaveBeenCalledWith( {
            likes: 3,
            dislikes: 1,
            stars: 0,
            grabs: 3
        } );
    } );

    test( 'should record AFK activity for emoji sender', async () => {
        const event = { payload: { emoji: '💜', userId: 'user-123' } };
        const context = { services };

        await handlePlayedOneTimeAnimationEvent( event, context );

        expect( services.afkService.recordActivity ).toHaveBeenCalledWith( 'user-123', 'emoji' );
    } );

    test( 'should update previousPlayedSong vote counts when user is current DJ', async () => {
        global.previousPlayedSong = {
            voteCounts: { likes: 0, dislikes: 0, stars: 0, grabs: 0 }
        };

        const event = { payload: { emoji: '💜', userId: 'current-dj-123' } };
        const context = { services };

        await handlePlayedOneTimeAnimationEvent( event, context );

        expect( global.previousPlayedSong.voteCounts.stars ).toBe( 1 );
    } );

    test( 'should not update previousPlayedSong vote counts when user is not current DJ', async () => {
        global.previousPlayedSong = {
            voteCounts: { likes: 0, dislikes: 0, stars: 0, grabs: 0 }
        };

        const event = { payload: { emoji: '💜', userId: 'other-user-123' } };
        const context = { services };

        await handlePlayedOneTimeAnimationEvent( event, context );

        expect( global.previousPlayedSong.voteCounts.stars ).toBe( 0 );
    } );

    test( 'should handle missing stateService gracefully', async () => {
        const servicesWithoutStateService = { ...services, stateService: undefined };
        const context = { services: servicesWithoutStateService };
        const event = { payload: { emoji: '💜', userId: 'user-123' } };

        await handlePlayedOneTimeAnimationEvent( event, context );

        expect( servicesWithoutStateService.logger.debug ).toHaveBeenCalled();
    } );
} );
