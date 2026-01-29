const { executeSongAICommand, replaceAllUsernamesWithMentions } = require( '../../src/lib/songAICommandHelper' );
const TokenService = require( '../../src/services/tokenService' );

// Mock fs to prevent real file operations during tests
jest.mock( 'fs', () => ( {
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    existsSync: jest.fn(),
    mkdirSync: jest.fn()
} ) );

describe( 'songAICommandHelper', () => {
    let mockServices;
    let mockContext;
    let mockCommandParams;
    let tokenService;

    beforeEach( () => {
        // Create a proper mock dataService for TokenService
        const mockDataService = {
            getValue: jest.fn().mockImplementation( ( key ) => {
                if ( key === 'botData.CHAT_NAME' ) return 'TestBot';
                if ( key === 'configuration.timezone' ) return 'Europe/London';
                if ( key === 'configuration.locale' ) return 'en-GB';
                if ( key === 'configuration.timeFormat' ) return '24';
                if ( key === 'customTokens' ) return {};
                return null;
            } ),
            setValue: jest.fn(),
            loadData: jest.fn()
        };

        const mockStateService = {
            getHangoutName: jest.fn().mockReturnValue( 'Test Hangout' ),
            _getDjs: jest.fn().mockReturnValue( [ { uuid: 'test-dj-uuid' } ] )
        };

        const mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };

        const mockHangUserService = {
            getUserNicknameByUuid: jest.fn().mockImplementation( ( uuid ) => {
                if ( uuid === 'test-user-uuid' ) return Promise.resolve( 'AliceUser' );
                if ( uuid === 'test-dj-uuid' ) return Promise.resolve( 'TestDJ' );
                if ( uuid === 'sender-uuid-string' ) return Promise.resolve( 'BobUser' );
                return Promise.resolve( 'Unknown' );
            } )
        };

        // Create real TokenService with mocked dependencies
        tokenService = new TokenService( {
            dataService: mockDataService,
            stateService: mockStateService,
            logger: mockLogger,
            messageService: {
                formatMention: jest.fn( ( uuid ) => `<@uid:${ uuid }>` )
            },
            hangUserService: mockHangUserService
        } );

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
            logger: mockLogger,
            dataService: mockDataService,
            stateService: mockStateService,
            hangUserService: mockHangUserService,
            tokenService: tokenService
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

        // Note: DO NOT clearAllMocks here - it would reset the mocks inside tokenService
        // Only clear specific mocks that need it
        mockServices.machineLearningService.askGoogleAI.mockClear();
        mockServices.messageService.sendResponse.mockClear();
    } );

    describe( 'executeSongAICommand', () => {
        it( 'should execute successfully with basic config', async () => {
            const config = {
                templateKey: 'editableMessages.testMessage',
                defaultTemplate: 'Test question about {trackName} by {artistName}',
                commandName: 'test',
                responseFormatter: ( trackName, artistName, aiResponse ) => {
                    return `🎵 **${ trackName }** by **${ artistName }**\n\n${ aiResponse }`;
                }
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

        it( 'should use plain username (not mention format) in AI questions with {senderUsername}', async () => {
            const config = {
                templateKey: 'mlQuestions.meaningQuestion',
                defaultTemplate: 'The user {senderUsername} wants to know the meaning of {trackName} by {artistName}',
                commandName: 'meaning'
            };

            mockServices.dataService.getValue.mockImplementation( ( key ) => {
                if ( key === 'botData.CHAT_NAME' ) return 'TestBot';
                if ( key === 'mlQuestions.meaningQuestion' ) return 'The user {senderUsername} wants to know the meaning of {trackName} by {artistName}';
                return null;
            } );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'This song means...' );

            const result = await executeSongAICommand( mockCommandParams, config );

            expect( result.success ).toBe( true );
            // Verify that the AI was called with plain username, NOT mention format
            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                'The user AliceUser wants to know the meaning of Test Song by Test Artist'
            );
            // Ensure it does NOT contain the mention format
            expect( mockServices.machineLearningService.askGoogleAI.mock.calls[ 0 ][ 0 ] ).not.toContain( '<@uid:' );
        } );

        it( 'should handle sender with uuid string (not object)', async () => {
            const config = {
                templateKey: 'mlQuestions.testQuestion',
                defaultTemplate: 'Question from {senderUsername}',
                commandName: 'test'
            };

            mockServices.dataService.getValue.mockImplementation( ( key ) => {
                if ( key === 'botData.CHAT_NAME' ) return 'TestBot';
                return null;
            } );
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'Response' );

            // Pass sender as uuid string instead of object
            const testCommandParams = {
                ...mockCommandParams,
                context: {
                    ...mockContext,
                    sender: 'sender-uuid-string'
                }
            };

            const result = await executeSongAICommand( testCommandParams, config );

            expect( result.success ).toBe( true );
            expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
                'Question from BobUser'
            );
        } );

        it( 'should store question and response in ML conversation history', async () => {
            const config = {
                templateKey: 'mlQuestions.testQuestion',
                defaultTemplate: '## Task\nTell me about {trackName} by {artistName}',
                commandName: 'test'
            };

            let historyData = [];
            mockServices.dataService.getValue.mockImplementation( ( key ) => {
                if ( key === 'botData.CHAT_NAME' ) return 'TestBot';
                if ( key === 'mlConversationHistory' ) return historyData;
                return null;
            } );
            mockServices.dataService.setValue.mockImplementation( async ( key, value ) => {
                if ( key === 'mlConversationHistory' ) {
                    historyData = value;
                }
            } );

            const aiResponse = 'The song is amazing!';
            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( aiResponse );

            const result = await executeSongAICommand( mockCommandParams, config );

            expect( result.success ).toBe( true );

            // Verify history has one pair entry with user and model messages
            expect( historyData.length ).toBe( 1 );
            expect( historyData[ 0 ].timestamp ).toBeDefined();
            expect( historyData[ 0 ].pair ).toBeDefined();
            expect( historyData[ 0 ].pair.length ).toBe( 2 );

            // Check user message
            expect( historyData[ 0 ].pair[ 0 ].role ).toBe( 'user' );
            expect( historyData[ 0 ].pair[ 0 ].content ).toContain( 'Tell me about Test Song by Test Artist' );

            // Check model message
            expect( historyData[ 0 ].pair[ 1 ].role ).toBe( 'model' );
            expect( historyData[ 0 ].pair[ 1 ].content ).toBe( aiResponse );
        } );

        it( 'should keep only last 5 pairs in conversation history', async () => {
            const config = {
                templateKey: 'mlQuestions.testQuestion',
                defaultTemplate: '## Task\nTest question',
                commandName: 'test'
            };

            // Start with 5 existing pairs
            let historyData = Array.from( { length: 5 }, ( _, i ) => ( {
                timestamp: new Date( Date.now() - ( 5 - i ) * 1000 ).toISOString(),
                pair: [
                    { role: 'user', content: `User message ${ i }` },
                    { role: 'model', content: `Model response ${ i }` }
                ]
            } ) );

            mockServices.dataService.getValue.mockImplementation( ( key ) => {
                if ( key === 'botData.CHAT_NAME' ) return 'TestBot';
                if ( key === 'mlConversationHistory' ) return historyData;
                return null;
            } );
            mockServices.dataService.setValue.mockImplementation( async ( key, value ) => {
                if ( key === 'mlConversationHistory' ) {
                    historyData = value;
                }
            } );

            mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'New response' );

            const result = await executeSongAICommand( mockCommandParams, config );

            expect( result.success ).toBe( true );

            // Should still have exactly 5 pairs (oldest removed, 1 new added)
            expect( historyData.length ).toBe( 5 );

            // First old pair should be gone (was index 0, now index -1)
            expect( historyData[ 0 ].pair[ 0 ].content ).toBe( 'User message 1' );

            // New pair should be at the end
            expect( historyData[ 4 ].pair[ 0 ].role ).toBe( 'user' );
            expect( historyData[ 4 ].pair[ 1 ].role ).toBe( 'model' );
            expect( historyData[ 4 ].pair[ 1 ].content ).toBe( 'New response' );
        } );
    } );

    describe( 'replaceAllUsernamesWithMentions', () => {
        const mockLogger = { warn: jest.fn() };

        it( 'should replace single username with mention format', () => {
            const text = 'Gaz, you picked a great song!';
            const hangoutState = {
                allUserData: {
                    'uuid-gaz': {
                        userProfile: { nickname: 'Gaz' }
                    }
                }
            };

            const result = replaceAllUsernamesWithMentions( text, hangoutState, mockLogger );

            expect( result ).toBe( 'Gaz, you picked a great song!'.replace( 'Gaz', '<@uid:uuid-gaz>' ) );
        } );

        it( 'should replace multiple different usernames in text', () => {
            const text = 'Kelsi and Alice both loved this track. Alice really enjoyed it, and Kelsi agrees!';
            const hangoutState = {
                allUserData: {
                    'uuid-kelsi': {
                        userProfile: { nickname: 'Kelsi' }
                    },
                    'uuid-alice': {
                        userProfile: { nickname: 'Alice' }
                    }
                }
            };

            const result = replaceAllUsernamesWithMentions( text, hangoutState, mockLogger );

            expect( result ).toContain( '<@uid:uuid-kelsi>' );
            expect( result ).toContain( '<@uid:uuid-alice>' );
            // Should have 2 Kelsi mentions and 2 Alice mentions
            expect( ( result.match( /uuid-kelsi/g ) || [] ).length ).toBe( 2 );
            expect( ( result.match( /uuid-alice/g ) || [] ).length ).toBe( 2 );
        } );

        it( 'should not replace partial matches (word boundaries)', () => {
            const text = 'This is a Garfield cat, not Gaz!';
            const hangoutState = {
                allUserData: {
                    'uuid-gaz': {
                        userProfile: { nickname: 'Gaz' }
                    }
                }
            };

            const result = replaceAllUsernamesWithMentions( text, hangoutState, mockLogger );

            // Garfield should NOT be replaced, only Gaz
            expect( result ).toContain( 'Garfield' );
            expect( result ).toContain( '<@uid:uuid-gaz>' );
        } );

        it( 'should handle empty text gracefully', () => {
            const hangoutState = {
                allUserData: {
                    'uuid-alice': {
                        userProfile: { nickname: 'Alice' }
                    }
                }
            };

            const result = replaceAllUsernamesWithMentions( '', hangoutState, mockLogger );

            expect( result ).toBe( '' );
        } );

        it( 'should handle null text gracefully', () => {
            const hangoutState = {
                allUserData: {
                    'uuid-alice': {
                        userProfile: { nickname: 'Alice' }
                    }
                }
            };

            const result = replaceAllUsernamesWithMentions( null, hangoutState, mockLogger );

            expect( result ).toBe( null );
        } );

        it( 'should handle missing allUserData gracefully', () => {
            const text = 'Hello Alice!';

            const result = replaceAllUsernamesWithMentions( text, {}, mockLogger );

            expect( result ).toBe( text );
        } );

        it( 'should handle users without nickname gracefully', () => {
            const text = 'Hello Alice and Bob!';
            const hangoutState = {
                allUserData: {
                    'uuid-alice': {
                        userProfile: { nickname: 'Alice' }
                    },
                    'uuid-bob': {
                        userProfile: {} // No nickname
                    }
                }
            };

            const result = replaceAllUsernamesWithMentions( text, hangoutState, mockLogger );

            // Should replace Alice but not error on Bob
            expect( result ).toContain( '<@uid:uuid-alice>' );
            expect( result ).toContain( 'Hello' );
        } );

        it( 'should escape special regex characters in usernames', () => {
            const text = 'Hello User_Name, you rock!';
            const hangoutState = {
                allUserData: {
                    'uuid-special': {
                        userProfile: { nickname: 'User_Name' }
                    }
                }
            };

            const result = replaceAllUsernamesWithMentions( text, hangoutState, mockLogger );

            expect( result ).toContain( '<@uid:uuid-special>' );
        } );

        it( 'should handle errors gracefully and return original text', () => {
            const text = 'Hello Alice!';

            // Create hangoutState that will work but has no users
            const result = replaceAllUsernamesWithMentions( text, { allUserData: {} }, mockLogger );

            // Should return original text unchanged
            expect( result ).toBe( text );
        } );
    } );
} );
