const { announceTrackEnded, announceTrackStarted } = require( '../../src/handlers/trackAnnouncer' );

describe( 'trackAnnouncer', () => {
    let services;

    beforeEach( () => {
        services = {
            logger: { error: jest.fn(), debug: jest.fn() },
            messageService: {
                formatMention: jest.fn().mockImplementation( ( uuid ) => `<@uid:${ uuid }>` ),
                sendResponse: jest.fn().mockResolvedValue()
            },
            dataService: {
                getValue: jest.fn().mockImplementation( ( key ) => {
                    if ( key === 'editableMessages.nowPlayingMessage' ) return '{username} is now playing {trackName} by {artistName}';
                    if ( key === 'editableMessages.justPlayedMessage' ) return '{username} played {trackName} by {artistName} 👍{likes} 👎{dislikes} ⭐{stars}';
                    return null;
                } )
            },
            featuresService: {
                isFeatureEnabled: jest.fn().mockReturnValue( true )
            },
            stateService: {
                getVotes: jest.fn().mockReturnValue( { likes: 5, dislikes: 2, grabs: 1 } ),
                getUser: jest.fn().mockImplementation( ( uuid ) => {
                    if ( uuid === 'dj-uuid-123' ) return { uuid, nickname: 'Billy' };
                    if ( uuid === 'dj-uuid-456' ) return { uuid, nickname: 'The Cure Fan' };
                    return null;
                } )
            }
        };
    } );

    const hangShapedEvent = ( type ) => ( {
        type,
        source: 'hangfm',
        payload: {
            playback: {
                djId: 'dj-uuid-123',
                song: { artist: 'Billy Idol', title: 'Cradle Of Love' },
                playId: 'play-1'
            }
        }
    } );

    const wavezShapedEvent = ( type ) => ( {
        type,
        source: 'wavezfm',
        payload: {
            playback: {
                djId: 'dj-uuid-456',
                song: { artist: 'The Cure', title: 'Killing An Arab' },
                playId: 'play-2'
            }
        }
    } );

    describe( 'announceTrackStarted', () => {
        test( 'sends nowPlaying announcement for a Hang-shaped event', async () => {
            await announceTrackStarted( hangShapedEvent( 'trackStarted' ), services );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                'Billy is now playing Cradle Of Love by Billy Idol',
                { responseChannel: 'public', services }
            );
        } );

        test( 'sends nowPlaying announcement for a Wavez-shaped event', async () => {
            await announceTrackStarted( wavezShapedEvent( 'trackStarted' ), services );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                'The Cure Fan is now playing Killing An Arab by The Cure',
                { responseChannel: 'public', services }
            );
        } );

        test( 'does not announce when nowPlayingMessage feature is disabled', async () => {
            services.featuresService.isFeatureEnabled.mockReturnValue( false );

            await announceTrackStarted( hangShapedEvent( 'trackStarted' ), services );

            expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
        } );

        test( 'does not announce when playback info is incomplete', async () => {
            const event = { type: 'trackStarted', payload: { playback: { djId: 'dj-uuid-123', song: {} } } };

            await announceTrackStarted( event, services );

            expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
        } );

        test( 'falls back to legacy nowPlayingMessage key and default template', async () => {
            services.dataService.getValue.mockImplementation( ( key ) => key === 'nowPlayingMessage' ? '{username} -> {trackName}' : null );

            await announceTrackStarted( hangShapedEvent( 'trackStarted' ), services );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                'Billy -> Cradle Of Love',
                { responseChannel: 'public', services }
            );
        } );

        test( 'logs and swallows errors from sendResponse', async () => {
            services.messageService.sendResponse.mockRejectedValueOnce( new Error( 'boom' ) );

            await announceTrackStarted( hangShapedEvent( 'trackStarted' ), services );

            expect( services.logger.error ).toHaveBeenCalledWith( expect.stringContaining( 'boom' ) );
        } );
    } );

    describe( 'announceTrackEnded', () => {
        test( 'sends justPlayed announcement with live vote counts for a Hang-shaped event', async () => {
            await announceTrackEnded( hangShapedEvent( 'trackEnded' ), services );

            expect( services.stateService.getVotes ).toHaveBeenCalled();
            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                'Billy played Cradle Of Love by Billy Idol 👍5 👎2 ⭐1',
                { responseChannel: 'public', services }
            );
        } );

        test( 'sends justPlayed announcement for a Wavez-shaped event', async () => {
            await announceTrackEnded( wavezShapedEvent( 'trackEnded' ), services );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                'The Cure Fan played Killing An Arab by The Cure 👍5 👎2 ⭐1',
                { responseChannel: 'public', services }
            );
        } );

        test( 'does not announce when justPlayed feature is disabled', async () => {
            services.featuresService.isFeatureEnabled.mockReturnValue( false );

            await announceTrackEnded( hangShapedEvent( 'trackEnded' ), services );

            expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
        } );

        test( 'does not announce when playback info is incomplete', async () => {
            const event = { type: 'trackEnded', payload: { playback: { djId: 'dj-uuid-123', song: {} } } };

            await announceTrackEnded( event, services );

            expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
        } );

        test( 'defaults vote counts to 0 when stateService has none', async () => {
            services.stateService.getVotes.mockReturnValue( { likes: 0, dislikes: 0, grabs: 0 } );

            await announceTrackEnded( hangShapedEvent( 'trackEnded' ), services );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                'Billy played Cradle Of Love by Billy Idol 👍0 👎0 ⭐0',
                { responseChannel: 'public', services }
            );
        } );

        test( 'falls back to legacy justPlayedMessage key and default template', async () => {
            services.dataService.getValue.mockReturnValue( null );

            await announceTrackEnded( hangShapedEvent( 'trackEnded' ), services );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                'Billy played...\n      Cradle Of Love by Billy Idol\n      Stats: 👍 5 👎 2 ❤️ 1',
                { responseChannel: 'public', services }
            );
        } );

        test( 'logs and swallows errors from sendResponse', async () => {
            services.messageService.sendResponse.mockRejectedValueOnce( new Error( 'boom' ) );

            await announceTrackEnded( hangShapedEvent( 'trackEnded' ), services );

            expect( services.logger.error ).toHaveBeenCalledWith( expect.stringContaining( 'boom' ) );
        } );
    } );
} );

