const handleIntroCommand = require( '../../src/commands/ML Commands/handleIntroCommand' );

describe( 'handleIntroCommand', () => {
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
            expect( handleIntroCommand.requiredRole ).toBe( 'USER' );
            expect( handleIntroCommand.description ).toBe( 'Get an introduction to the currently playing artist' );
            expect( handleIntroCommand.example ).toBe( 'intro' );
            expect( handleIntroCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'successful execution', () => {
        it( 'should get introduction about currently playing artist', async () => {
            const mockAIResponse = 'Queen is a British rock band formed in London in 1970. Known for their theatrical live performances and operatic style, they became one of the most popular bands in the world.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            // Mock the template from dataService
            const mockTemplate = 'I\'m listening to {artistName}. Give me a brief introduction to this artist. Include when they started, their genre, and why they\'re notable. Keep it under 150 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            const result = await handleIntroCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );

            // Check that dataService was called to get the template
            expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'mlQuestions.introQuestion' );

            // Check that AI was called with correct question (template with substitutions)
            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                "I'm listening to Queen. Give me a brief introduction to this artist. Include when they started, their genre, and why they're notable. Keep it under 150 words."
            );

            // Check that one response was sent
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledTimes( 1 );

            // Check intro response format (artist only, no song title)
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                'Queen is a British rock band formed in London in 1970. Known for their theatrical live performances and operatic style, they became one of the most popular bands in the world.',
                expect.any( Object )
            );
        } );

        it( 'should work with private messages', async () => {
            const mockAIResponse = 'The Beatles were an English rock band formed in Liverpool in 1960. They are regarded as the most influential band of all time.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            const mockTemplate = 'I\'m listening to {artistName}. Give me a brief introduction to this artist. Include when they started, their genre, and why they\'re notable. Keep it under 150 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            // Update mock to have different artist
            mockServices.hangoutState.nowPlaying.song.artistName = 'The Beatles';

            const privateContext = {
                ...mockContext,
                fullMessage: { isPrivateMessage: true }
            };

            const result = await handleIntroCommand( {
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

        it( 'should handle username with special characters correctly', async () => {
            const mockAIResponse = 'Alice In Chains is an American rock band formed in Seattle, Washington, in 1987. Known for their distinctive vocal harmonies and heavy, grinding guitar sound.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            // Mock template that includes {username} token
            const mockTemplate = 'I\'m listening to {artistName} with DJ {username}. Give me a brief introduction to this artist. Include when they started, their genre, and why they\'re notable. Keep it under 150 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            // Update mock to have Alice In Chains as artist
            mockServices.hangoutState.nowPlaying.song.artistName = 'Alice In Chains';
            mockServices.hangoutState.nowPlaying.song.trackName = 'Rain When I Die';

            // Mock the special character username
            mockServices.hangUserService.getUserNicknameByUuid.mockResolvedValue( '𝖓𝖎𝖓𝖆🌙' );

            const result = await handleIntroCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );

            // Check that AI was called with correct question including actual DJ name
            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                "I'm listening to Alice In Chains with DJ 𝖓𝖎𝖓𝖆🌙. Give me a brief introduction to this artist. Include when they started, their genre, and why they're notable. Keep it under 150 words."
            );

            // Check that getUserNicknameByUuid was called to get the actual name
            expect( mockServices.hangUserService.getUserNicknameByUuid ).toHaveBeenCalledWith( 'test-dj-uuid' );

            // Check response was sent
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledTimes( 1 );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                'Alice In Chains is an American rock band formed in Seattle, Washington, in 1987. Known for their distinctive vocal harmonies and heavy, grinding guitar sound.',
                expect.any( Object )
            );
        } );
    } );

    describe( 'error handling', () => {
        it( 'should handle no song currently playing', async () => {
            const noSongServices = {
                ...mockServices,
                hangoutState: {}
            };

            const result = await handleIntroCommand( {
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

            const result = await handleIntroCommand( {
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

            const result = await handleIntroCommand( {
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

            const result = await handleIntroCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Missing song details' );
        } );

        it( 'should handle AI service errors', async () => {
            const mockTemplate = 'I\'m listening to {artistName}. Give me a brief introduction to this artist. Include when they started, their genre, and why they\'re notable. Keep it under 150 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );
            mockServices.machineLearningService.askGoogleAI.mockRejectedValue( new Error( 'AI service error' ) );

            const result = await handleIntroCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( '🎵 Sorry, I couldn\'t get an introduction to that artist right now. Please try again later.' );
        } );

        it( 'should handle "No response" from AI', async () => {
            const mockTemplate = 'I\'m listening to {artistName}. Give me a brief introduction to this artist. Include when they started, their genre, and why they\'re notable. Keep it under 150 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'An error occurred while connecting to Google Gemini. Please wait a minute and try again' );

            const result = await handleIntroCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true ); // Command succeeded but AI failed

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                '🎵 Sorry, I couldn\'t get an introduction to that artist right now. Please try again later.',
                expect.any( Object )
            );
        } );

        it( 'should handle AI service throwing an error', async () => {
            const mockTemplate = 'I\'m listening to {artistName}. Give me a brief introduction to this artist. Include when they started, their genre, and why they\'re notable. Keep it under 150 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );
            mockServices.machineLearningService.askGoogleAI.mockImplementation( () => {
                throw new Error( 'Network error' );
            } );

            const result = await handleIntroCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toBe( '🎵 Sorry, I couldn\'t get an introduction to that artist right now. Please try again later.' );
        } );

        it( 'should handle missing hangout state', async () => {
            const noStateServices = {
                ...mockServices,
                hangoutState: undefined
            };

            const result = await handleIntroCommand( {
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
        it( 'should format successful response with artist name only', async () => {
            const mockAIResponse = 'Pink Floyd were an English rock band formed in London in 1965. They are known for their progressive and psychedelic music, philosophical lyrics, and elaborate live shows.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            const mockTemplate = 'I\'m listening to {artistName}. Give me a brief introduction to this artist. Include when they started, their genre, and why they\'re notable. Keep it under 150 words.';
            mockServices.dataService.getValue.mockReturnValue( mockTemplate );

            const result = await handleIntroCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toBe( 'Pink Floyd were an English rock band formed in London in 1965. They are known for their progressive and psychedelic music, philosophical lyrics, and elaborate live shows.' );
        } );

        it( 'should handle different artists', async () => {
            const mockAIResponse = 'Led Zeppelin were an English rock band formed in London in 1968. They are one of the most influential rock bands in history.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

            const mockTemplate = 'I\'m listening to {artistName}. Give me a brief introduction to this artist. Include when they started, their genre, and why they\'re notable. Keep it under 150 words.';
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

            const result = await handleIntroCommand( {
                services: differentArtistServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toBe( 'Led Zeppelin were an English rock band formed in London in 1968. They are one of the most influential rock bands in history.' );
        } );

        it( 'should use default template when dataService returns null', async () => {
            const mockAIResponse = 'Queen is a legendary rock band.';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );
            mockServices.dataService.getValue.mockReturnValue( null );

            const result = await handleIntroCommand( {
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            // Should use the default template from the command
            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                'I\'m listening to Queen. Give me a brief introduction to this artist. Include when they started, their genre, and why they\'re notable. Keep it under 150 words.'
            );
        } );
    } );


} );