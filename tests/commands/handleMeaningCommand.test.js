const handleMeaningCommand = require( '../../src/commands/ML Commands/handleMeaningCommand' );

describe( 'handleMeaningCommand', () => {
    let mockServices;
    let mockContext;

    beforeEach( () => {
        mockServices = {
            messageService: {
                sendResponse: jest.fn().mockResolvedValue()
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
            expect( handleMeaningCommand.requiredRole ).toBe( 'USER' );
            expect( handleMeaningCommand.description ).toBe( 'Tell me what the lyrics for a track are all about' );
            expect( handleMeaningCommand.example ).toBe( 'meaning' );
            expect( handleMeaningCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'successful execution', () => {
        it( 'should get meaning about currently playing song', async () => {
            const mockAIResponse = 'This epic song explores themes of fate, mortality, and redemption through its operatic structure.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            // Mock the template from dataService
            const mockTemplate = 'Tell me the meaning of the lyrics of the song {trackName} by {artistName} in less than 200 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            const result = await handleMeaningCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );

            // Check that dataService was called to get the template
            expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'mlQuestions.meaningQuestion' );

            // Check that AI was called with correct question (template with substitutions)
            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                "Tell me the meaning of the lyrics of the song Bohemian Rhapsody by Queen in less than 200 words."
            );

            // Check that one response was sent
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledTimes( 1 );

            // Check meaning response
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                '🎵 **Bohemian Rhapsody** by **Queen**\n\nThis epic song explores themes of fate, mortality, and redemption through its operatic structure.',
                expect.any( Object )
            );
        } );

        it( 'should work with private messages', async () => {
            const mockAIResponse = 'The song explores deep themes of personal struggle.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            const mockTemplate = 'Tell me the meaning of the lyrics of the song {trackName} by {artistName} in less than 200 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            const privateContext = {
                ...mockContext,
                fullMessage: { isPrivateMessage: true }
            };

            const result = await handleMeaningCommand( {
                services: mockServices,
                context: privateContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );

            // Verify response was sent with private message context
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'The song explores deep themes of personal struggle.' ),
                expect.objectContaining( {
                    isPrivateMessage: true,
                    responseChannel: 'request'
                } )
            );
        } );
    } );

    describe( 'error handling', () => {
        it( 'should handle no song currently playing', async () => {
            const noSongServices = {
                ...mockServices,
                hangoutState: {}
            };

            const result = await handleMeaningCommand( {
                services: noSongServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( '🎵 No song is currently playing. Start a song first and try again!' );
        } );

        it( 'should handle missing song object', async () => {
            const noSongServices = {
                ...mockServices,
                hangoutState: {
                    nowPlaying: {}
                }
            };

            const result = await handleMeaningCommand( {
                services: noSongServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( '🎵 No song is currently playing. Start a song first and try again!' );
        } );

        it( 'should handle missing track name', async () => {
            mockServices.hangoutState.nowPlaying.song.trackName = null;

            const result = await handleMeaningCommand( {
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
            mockServices.hangoutState.nowPlaying.song.artistName = '';

            const result = await handleMeaningCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Missing song details' );
        } );

        it( 'should handle AI service errors', async () => {
            const mockTemplate = 'Tell me the meaning of the lyrics of the song {trackName} by {artistName} in less than 200 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );
            mockServices.machineLearningService.askGoogleAI.mockRejectedValue( new Error( 'AI service error' ) );

            const result = await handleMeaningCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( '🎵 Sorry, I couldn\'t find the meaning of the current song right now. Please try again later.' );
        } );

        it( 'should handle "No response" from AI', async () => {
            const mockTemplate = 'Tell me the meaning of the lyrics of the song {trackName} by {artistName} in less than 200 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'An error occurred while connecting to Google Gemini. Please wait a minute and try again' );

            const result = await handleMeaningCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true ); // Command succeeded but AI failed

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                '🎵 Sorry, I couldn\'t find the meaning of the current song right now. Please try again later.',
                expect.any( Object )
            );
        } );

        it( 'should handle AI service throwing an error', async () => {
            const mockTemplate = 'Tell me the meaning of the lyrics of the song {trackName} by {artistName} in less than 200 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );
            mockServices.machineLearningService.askGoogleAI.mockImplementation( () => {
                throw new Error( 'Network error' );
            } );

            const result = await handleMeaningCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( '🎵 Sorry, I couldn\'t find the meaning of the current song right now. Please try again later.' );
        } );

        it( 'should handle missing hangout state', async () => {
            const noStateServices = {
                ...mockServices,
                hangoutState: undefined
            };

            const result = await handleMeaningCommand( {
                services: noStateServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( '🎵 No song is currently playing. Start a song first and try again!' );
        } );
    } );

    describe( 'response formatting', () => {
        it( 'should format successful response with song title and artist', async () => {
            const mockAIResponse = 'This song explores themes of love and loss through metaphorical imagery.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            const mockTemplate = 'Tell me the meaning of the lyrics of the song {trackName} by {artistName} in less than 200 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            const result = await handleMeaningCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toBe( '🎵 **Bohemian Rhapsody** by **Queen**\n\nThis song explores themes of love and loss through metaphorical imagery.' );
        } );

        it( 'should handle different song titles and artists', async () => {
            const mockAIResponse = 'A powerful anthem about breaking free from constraints.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            const mockTemplate = 'Tell me the meaning of the lyrics of the song {trackName} by {artistName} in less than 200 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            const differentSongServices = {
                ...mockServices,
                hangoutState: {
                    nowPlaying: {
                        song: {
                            trackName: 'Breaking Free',
                            artistName: 'Test Artist'
                        }
                    }
                }
            };

            const result = await handleMeaningCommand( {
                services: differentSongServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toBe( '🎵 **Breaking Free** by **Test Artist**\n\nA powerful anthem about breaking free from constraints.' );
        } );

        it( 'should use default template when dataService returns null', async () => {
            const mockAIResponse = 'This song has deep emotional meaning.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );
            mockServices.dataService.getValue.mockReturnValue( null );

            const result = await handleMeaningCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            // Should use the default template from the command
            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                'Tell me the meaning of the lyrics of the song Bohemian Rhapsody by Queen in less than 200 words.'
            );
        } );
    } );

    describe( 'logging', () => {
        it( 'should log debug information about the song being queried', async () => {
            const mockAIResponse = 'Test meaning response';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            const mockTemplate = 'Tell me the meaning of the lyrics of the song {trackName} by {artistName} in less than 200 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            await handleMeaningCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( mockServices.logger.debug ).toHaveBeenCalledWith(
                '[meaning] Asking AI about: Bohemian Rhapsody by Queen'
            );
        } );
    } );
} );