const handleBandCommand = require( '../../src/commands/ML Commands/handleBandCommand' );

describe( 'handleBandCommand', () => {
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
            expect( handleBandCommand.requiredRole ).toBe( 'USER' );
            expect( handleBandCommand.description ).toBe( 'Tell me something about the band currently playing' );
            expect( handleBandCommand.example ).toBe( 'band' );
            expect( handleBandCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'successful execution', () => {
        it( 'should get information about currently playing artist/band', async () => {
            const mockAIResponse = 'Queen formed in London in 1970. The band consisted of Freddie Mercury, Brian May, Roger Taylor, and John Deacon. They are one of the most successful rock bands of all time.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            // Mock the template from dataService
            const mockTemplate = 'I\'m currently listening to {artistName}. Tell me about them. Include facts such as when and where they formed, when their first and most notable or recent releases were, how well these releases performed in the charts in both the UK and USA, and about any notable former band members. Keep your response under 300 words';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            const result = await handleBandCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );

            // Check that dataService was called to get the template
            expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'mlQuestions.bandQuestion' );

            // Check that AI was called with correct question (template with substitutions)
            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                "I'm currently listening to Queen. Tell me about them. Include facts such as when and where they formed, when their first and most notable or recent releases were, how well these releases performed in the charts in both the UK and USA, and about any notable former band members. Keep your response under 300 words"
            );

            // Check that one response was sent
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledTimes( 1 );

            // Check band response
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                'Queen formed in London in 1970. The band consisted of Freddie Mercury, Brian May, Roger Taylor, and John Deacon. They are one of the most successful rock bands of all time.',
                expect.any( Object )
            );
        } );

        it( 'should work with private messages', async () => {
            const mockAIResponse = 'The Beatles were an English rock band formed in Liverpool in 1960.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            const mockTemplate = 'I\'m currently listening to {artistName}. Tell me about them. Include facts such as when and where they formed, when their first and most recent releases were, how well these releases performed in the charts in both the UK and USA, and about any notable former band members. Keep your response under 300 words';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            // Update mock to have different artist
            mockServices.hangoutState.nowPlaying.song.artistName = 'The Beatles';

            const privateContext = {
                ...mockContext,
                fullMessage: { isPrivateMessage: true }
            };

            const result = await handleBandCommand( {
                services: mockServices,
                context: privateContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );

            // Verify response was sent with private message context
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'The Beatles were an English rock band formed in Liverpool in 1960.' ),
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

            const result = await handleBandCommand( {
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

            const result = await handleBandCommand( {
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

            const result = await handleBandCommand( {
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

            const result = await handleBandCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Missing song details' );
        } );

        it( 'should handle AI service errors', async () => {
            const mockTemplate = 'I\'m currently listening to {artistName}. Tell me about them. Include facts such as when and where they formed, when their first and most recent releases were, how well these releases performed in the charts in both the UK and USA, and about any notable former band members. Keep your response under 300 words';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );
            mockServices.machineLearningService.askGoogleAI.mockRejectedValue( new Error( 'AI service error' ) );

            const result = await handleBandCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( '🎵 Sorry, I couldn\'t get facts about that artist right now. Please try again later.' );
        } );

        it( 'should handle "No response" from AI', async () => {
            const mockTemplate = 'I\'m currently listening to {artistName}. Tell me about them. Include facts such as when and where they formed, when their first and most recent releases were, how well these releases performed in the charts in both the UK and USA, and about any notable former band members. Keep your response under 300 words';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'An error occurred while connecting to Google Gemini. Please wait a minute and try again' );

            const result = await handleBandCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true ); // Command succeeded but AI failed

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                '🎵 Sorry, I couldn\'t get facts about that artist right now. Please try again later.',
                expect.any( Object )
            );
        } );

        it( 'should handle AI service throwing an error', async () => {
            const mockTemplate = 'I\'m currently listening to {artistName}. Tell me about them. Include facts such as when and where they formed, when their first and most recent releases were, how well these releases performed in the charts in both the UK and USA, and about any notable former band members. Keep your response under 300 words';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );
            mockServices.machineLearningService.askGoogleAI.mockImplementation( () => {
                throw new Error( 'Network error' );
            } );

            const result = await handleBandCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( '🎵 Sorry, I couldn\'t get facts about that artist right now. Please try again later.' );
        } );

        it( 'should handle missing hangout state', async () => {
            const noStateServices = {
                ...mockServices,
                hangoutState: undefined
            };

            const result = await handleBandCommand( {
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
        it( 'should format successful response with artist name', async () => {
            const mockAIResponse = 'Queen is a British rock band formed in London in 1970. The original lineup consisted of lead vocalist and pianist Freddie Mercury, guitarist and vocalist Brian May, bass guitarist John Deacon, and drummer and vocalist Roger Taylor.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            const mockTemplate = 'I\'m currently listening to {artistName}. Tell me about them. Include facts such as when and where they formed, when their first and most recent releases were, how well these releases performed in the charts in both the UK and USA, and about any notable former band members. Keep your response under 300 words';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            const result = await handleBandCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toBe( 'Queen is a British rock band formed in London in 1970. The original lineup consisted of lead vocalist and pianist Freddie Mercury, guitarist and vocalist Brian May, bass guitarist John Deacon, and drummer and vocalist Roger Taylor.' );
        } );

        it( 'should handle different artists', async () => {
            const mockAIResponse = 'Led Zeppelin were an English rock band formed in London in 1968.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            const mockTemplate = 'I\'m currently listening to {artistName}. Tell me about them. Include facts such as when and where they formed, when their first and most recent releases were, how well these releases performed in the charts in both the UK and USA, and about any notable former band members. Keep your response under 300 words';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            const differentArtistServices = {
                ...mockServices,
                hangoutState: {
                    nowPlaying: {
                        song: {
                            trackName: 'Stairway to Heaven',
                            artistName: 'Led Zeppelin'
                        }
                    }
                }
            };

            const result = await handleBandCommand( {
                services: differentArtistServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toBe( 'Led Zeppelin were an English rock band formed in London in 1968.' );
        } );

        it( 'should use default template when dataService returns null', async () => {
            const mockAIResponse = 'Queen is a legendary rock band.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );
            mockServices.dataService.getValue.mockReturnValue( null );

            const result = await handleBandCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            // Should use the default template from the command
            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                'I\'m currently listening to Queen. Tell me about them. Include facts such as when and where they formed, when their first and most notable or recent releases were, how well these releases performed in the charts in both the UK and USA, and about any notable former band members. Keep your response under 300 words'
            );
        } );
    } );

    describe( 'logging', () => {
        it( 'should log debug information about the artist being queried', async () => {
            const mockAIResponse = 'Test band response';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            const mockTemplate = 'I\'m currently listening to {artistName}. Tell me about them. Include facts such as when and where they formed, when their first and most recent releases were, how well these releases performed in the charts in both the UK and USA, and about any notable former band members. Keep your response under 300 words';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            await handleBandCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( mockServices.logger.debug ).toHaveBeenCalledWith(
                '[band] Asking AI about: Bohemian Rhapsody by Queen'
            );
        } );
    } );
} );