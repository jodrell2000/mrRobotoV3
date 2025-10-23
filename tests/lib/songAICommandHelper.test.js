const { executeSongAICommand } = require( '../../src/lib/songAICommandHelper' );

describe( 'songAICommandHelper', () => {
    let mockServices;
    let mockContext;
    let mockCommandParams;

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
                        trackName: 'Test Song',
                        artistName: 'Test Artist'
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

        mockCommandParams = {
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        };

        jest.clearAllMocks();
    } );

    describe( 'executeSongAICommand', () => {
        it( 'should execute successfully with basic config', async () => {
            const config = {
                templateKey: 'editableMessages.testMessage',
                defaultTemplate: 'Test question about {trackName} by {artistName}',
                commandName: 'test'
            };

            mockServices.dataService.getValue.mockImplementation( ( key ) => {
                if ( key === 'botData.CHAT_NAME' ) return 'TestBot';
                if ( key === 'editableMessages.testMessage' ) return 'Custom template: {trackName} by {artistName}';
                return null;
            } );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'AI response' );

            const result = await executeSongAICommand( mockCommandParams, config );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );
            expect( result.response ).toContain( '🎵 **Test Song** by **Test Artist**' );
            expect( result.response ).toContain( 'AI response' );

            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                'Custom template: Test Song by Test Artist'
            );
        } );

        it( 'should use default template when dataService returns null', async () => {
            const config = {
                templateKey: 'editableMessages.testMessage',
                defaultTemplate: 'Default template: {trackName} by {artistName}',
                commandName: 'test'
            };

            mockServices.dataService.getValue.mockImplementation( ( key ) => {
                if ( key === 'botData.CHAT_NAME' ) return 'TestBot';
                if ( key === 'editableMessages.testMessage' ) return null;
                return null;
            } );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'AI response' );

            const result = await executeSongAICommand( mockCommandParams, config );

            expect( result.success ).toBe( true );
            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                'Default template: Test Song by Test Artist'
            );
        } );

        it( 'should use custom response formatter when provided', async () => {
            const config = {
                templateKey: 'editableMessages.testMessage',
                defaultTemplate: 'Test question',
                commandName: 'test',
                responseFormatter: ( trackName, artistName, aiResponse ) => {
                    return `Custom: ${ trackName } - ${ artistName }: ${ aiResponse }`;
                }
            };

            mockServices.dataService.getValue.mockReturnValue( 'Test question' );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'AI response' );

            const result = await executeSongAICommand( mockCommandParams, config );

            expect( result.success ).toBe( true );
            expect( result.response ).toBe( 'Custom: Test Song - Test Artist: AI response' );
        } );

        it( 'should handle no song currently playing', async () => {
            const config = {
                templateKey: 'editableMessages.testMessage',
                defaultTemplate: 'Test question',
                commandName: 'test',
                noSongMessage: 'Custom no song message'
            };

            mockServices.hangoutState.nowPlaying = null;

            const result = await executeSongAICommand( mockCommandParams, config );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'No song currently playing' );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                'Custom no song message',
                expect.any( Object )
            );
        } );

        it( 'should handle AI errors gracefully', async () => {
            const config = {
                templateKey: 'editableMessages.testMessage',
                defaultTemplate: 'Test question',
                commandName: 'test'
            };

            mockServices.dataService.getValue.mockReturnValue( 'Test question' );
            mockServices.machineLearningService.askGoogleAI.mockRejectedValue( new Error( 'Network error' ) );

            const result = await executeSongAICommand( mockCommandParams, config );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Network error' );
            expect( mockServices.logger.error ).toHaveBeenCalledWith(
                '[test] Error getting song facts: Network error'
            );
        } );

        it( 'should handle "No response" from AI', async () => {
            const config = {
                templateKey: 'editableMessages.testMessage',
                defaultTemplate: 'Test question',
                commandName: 'customcommand'
            };

            mockServices.dataService.getValue.mockReturnValue( 'Test question' );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'No response' );

            const result = await executeSongAICommand( mockCommandParams, config );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'Sorry, I couldn\'t get information about "Test Song" by Test Artist' );
        } );
    } );
} );