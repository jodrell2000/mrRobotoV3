const handleWhatyearCommand = require( '../../src/commands/ML Commands/handleWhatyearCommand' );

describe( 'handleWhatyearCommand', () => {
    let mockServices;
    let mockContext;

    beforeEach( () => {
        mockServices = {
            messageService: {
                sendResponse: jest.fn()
            },
            machineLearningService: {
                askGoogleAI: jest.fn()
            },
            hangoutState: {
                nowPlaying: {
                    song: {
                        trackName: 'Bohemian Rhapsody',
                        artistName: 'Queen'
                    }
                },
                djs: [
                    { uuid: 'test-dj-uuid' }
                ]
            },
            logger: {
                debug: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            },
            dataService: {
                getValue: jest.fn().mockImplementation( ( key ) => {
                    if ( key === 'botData.CHAT_NAME' ) return 'TestBot';
                    return null;
                } )
            },
            stateService: {
                getHangoutName: jest.fn().mockReturnValue( 'Test Hangout' )
            },
            hangUserService: {
                getUserNicknameByUuid: jest.fn().mockResolvedValue( 'TestDJ' )
            },
            tokenService: {
                replaceTokens: jest.fn().mockImplementation( async ( template, tokens ) => {
                    let result = template;
                    if ( tokens ) {
                        Object.entries( tokens ).forEach( ( [ key, value ] ) => {
                            result = result.replace( `{${ key }}`, value );
                        } );
                    }
                    return result;
                } )
            }
        };

        mockContext = {
            sender: {
                uuid: 'test-user-uuid',
                username: 'TestUser'
            },
            fullMessage: { isPrivateMessage: false }
        };

        jest.clearAllMocks();
    } );

    describe( 'command metadata', () => {
        it( 'should have correct metadata', () => {
            expect( handleWhatyearCommand.requiredRole ).toBe( 'USER' );
            expect( handleWhatyearCommand.description ).toBe( 'Find out what year the currently playing song was released' );
            expect( handleWhatyearCommand.example ).toBe( 'whatyear' );
            expect( handleWhatyearCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'successful execution', () => {
        it( 'should get release year about currently playing song', async () => {
            mockServices.dataService.getValue.mockReturnValue( 'In what year was the song {trackName} by {artistName} originally released?' );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( '1975 - Bohemian Rhapsody was released as part of Queen\'s album "A Night at the Opera"' );

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toContain( '1975' );
            expect( result.response ).toContain( 'Bohemian Rhapsody' );

            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                'In what year was the song Bohemian Rhapsody by Queen originally released?'
            );

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( '1975' ),
                expect.objectContaining( {
                    responseChannel: 'public',
                    isPrivateMessage: false
                } )
            );
        } );

        it( 'should work with private messages', async () => {
            mockContext.fullMessage.isPrivateMessage = true;
            mockServices.dataService.getValue.mockReturnValue( 'In what year was the song {trackName} by {artistName} originally released?' );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( '1975' );

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( true );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.any( String ),
                expect.objectContaining( {
                    isPrivateMessage: true,
                    responseChannel: 'request'
                } )
            );
        } );
    } );

    describe( 'error handling', () => {
        it( 'should handle no song currently playing', async () => {
            mockServices.hangoutState.nowPlaying = null;

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'No song currently playing' );

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                '🎵 No song is currently playing. Start a song first and try again!',
                expect.any( Object )
            );

            // AI should not be called
            expect( mockServices.machineLearningService.askGoogleAI ).not.toHaveBeenCalled();
        } );

        it( 'should handle missing song object', async () => {
            mockServices.hangoutState.nowPlaying = { song: null };

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'No song currently playing' );

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                '🎵 No song is currently playing. Start a song first and try again!',
                expect.any( Object )
            );
        } );

        it( 'should handle missing track name', async () => {
            mockServices.hangoutState.nowPlaying = {
                song: {
                    trackName: null,
                    artistName: 'Queen'
                }
            };

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Missing song details' );

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                '🎵 Unable to get song details. Please try again when a song is playing.',
                expect.any( Object )
            );
        } );

        it( 'should handle missing artist name', async () => {
            mockServices.hangoutState.nowPlaying = {
                song: {
                    trackName: 'Bohemian Rhapsody',
                    artistName: null
                }
            };

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Missing song details' );

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                '🎵 Unable to get song details. Please try again when a song is playing.',
                expect.any( Object )
            );
        } );

        it( 'should handle AI service errors', async () => {
            mockServices.dataService.getValue.mockReturnValue( 'In what year was the song {trackName} by {artistName} originally released?' );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'error occurred' );

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true ); // Command succeeded but AI failed

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                '🎵 Sorry, I couldn\'t find the release year for "Bohemian Rhapsody" by Queen right now. Please try again later.',
                expect.any( Object )
            );
        } );

        it( 'should handle "No response" from AI', async () => {
            mockServices.dataService.getValue.mockReturnValue( 'In what year was the song {trackName} by {artistName} originally released?' );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'No response' );

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                '🎵 Sorry, I couldn\'t find the release year for "Bohemian Rhapsody" by Queen right now. Please try again later.',
                expect.any( Object )
            );
        } );

        it( 'should handle AI service throwing an error', async () => {
            mockServices.dataService.getValue.mockReturnValue( 'In what year was the song {trackName} by {artistName} originally released?' );
            mockServices.machineLearningService.askGoogleAI.mockRejectedValue( new Error( 'Network error' ) );

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Network error' );

            expect( mockServices.logger.error ).toHaveBeenCalledWith( '[whatyear] Error getting song facts: Network error' );

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                '🎵 Sorry, there was an error getting release year information. Please try again later.',
                expect.any( Object )
            );
        } );

        it( 'should handle missing hangout state', async () => {
            mockServices.hangoutState = null;

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'No song currently playing' );

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                '🎵 No song is currently playing. Start a song first and try again!',
                expect.any( Object )
            );
        } );
    } );

    describe( 'response formatting', () => {
        it( 'should format successful response with song title and artist', async () => {
            mockServices.dataService.getValue.mockReturnValue( 'In what year was the song {trackName} by {artistName} originally released?' );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( '1975' );

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toBe( '1975' );
        } );

        it( 'should handle different song titles and artists', async () => {
            mockServices.hangoutState.nowPlaying.song = {
                trackName: 'Imagine',
                artistName: 'John Lennon'
            };
            mockServices.dataService.getValue.mockReturnValue( 'In what year was the song {trackName} by {artistName} originally released?' );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( '1971' );

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toBe( '1971' );

            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                'In what year was the song Imagine by John Lennon originally released?'
            );
        } );

        it( 'should use default template when dataService returns null', async () => {
            mockServices.dataService.getValue.mockReturnValue( null );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( '1975' );

            const result = await handleWhatyearCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );

            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                'In what year was the song Bohemian Rhapsody by Queen originally released?'
            );
        } );
    } );


} );