// Mock the logger
jest.mock( '../../src/lib/logging', () => ( {
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
} ) );

// Mock the Google AI module 
jest.mock( '@google/genai' );

const MachineLearningService = require( '../../src/services/machineLearningService.js' );
const {
  __mockModelsGenerateContent,
  __mockSendMessage,
  __mockChatsCreate,
  __mockGetGenerativeModel
} = require( '@google/genai' );

// Mock the environment variable for testing
process.env.googleAIKey = 'test-api-key';

describe( 'MachineLearningService', () => {
  let service;
  let consoleSpy;
  let mockModelsGenerateContent;
  let mockSendMessage;
  let mockChatsCreate;
  let mockGetGenerativeModel;
  let mockServices;
  let mockChat;

  beforeEach( () => {
    // Reset mocks
    jest.clearAllMocks();

    // Use the mock functions from the mock module
    mockModelsGenerateContent = __mockModelsGenerateContent;
    mockSendMessage = __mockSendMessage;
    mockChatsCreate = __mockChatsCreate;
    mockGetGenerativeModel = __mockGetGenerativeModel;

    // Mock services object
    mockServices = {
      dataService: {
        loadData: jest.fn().mockResolvedValue(),
        getValue: jest.fn(),
        setValue: jest.fn().mockResolvedValue()
      },
      stateService: {
        getHangoutName: jest.fn().mockReturnValue( 'Test Hangout' )
      },
      getState: jest.fn().mockReturnValue( 'Test Bot' ),
      tokenService: {
        replaceTokens: jest.fn().mockImplementation( ( text ) => {
          // Mock token replacement for testing
          return text
            .replace( /{botName}/g, 'Test Bot' )
            .replace( /{hangoutName}/g, 'Test Hangout' );
        } )
      }
    };

    // Setup default mock behaviors after clearing
    mockChat = {
      sendMessage: mockSendMessage
    };
    mockChatsCreate.mockResolvedValue( mockChat );
    mockSendMessage.mockResolvedValue( { text: 'Mock AI chat response' } );

    consoleSpy = jest.spyOn( console, 'error' ).mockImplementation( () => { } );
    service = new MachineLearningService( mockServices );
  } );

  afterEach( () => {
    // Restore console.error
    if ( consoleSpy ) {
      consoleSpy.mockRestore();
    }
  } );

  describe( 'constructor', () => {
    it( 'should initialize with Google AI key from environment', () => {
      expect( service.googleAIKey ).toBe( 'test-api-key' );
      expect( service.genAI ).toBeDefined();
    } );

    it( 'should handle missing API key gracefully', () => {
      delete process.env.googleAIKey;
      const serviceWithoutKey = new MachineLearningService( mockServices );

      expect( serviceWithoutKey.googleAIKey ).toBeUndefined();
      expect( serviceWithoutKey.genAI ).toBeNull();

      // Restore the API key for other tests
      process.env.googleAIKey = 'test-api-key';
    } );
  } );

  describe( 'getSystemInstructions', () => {
    it( 'should return processed system instructions with template replacement', async () => {
      // Mock both MLPersonality and MLInstructions
      mockServices.dataService.getValue
        .mockReturnValueOnce( 'You are a DJ called {botName} in {hangoutName}' ) // MLPersonality
        .mockReturnValueOnce( 'You are a DJ called {botName} in {hangoutName}' ); // MLInstructions

      const result = await service.getSystemInstructions();

      expect( result ).toEqual( [
        "## Safety & Constraints\n- **Prohibited Content:** No sexist, racist, or homophobic language.\n- **Use of Gender Pronouns:** Always use gender-neutral pronouns unless specified otherwise.",
        "\nYou are a DJ called Test Bot in Test Hangout",
        "\nYou are a DJ called Test Bot in Test Hangout"
      ] );
      expect( mockServices.dataService.loadData ).toHaveBeenCalled();
      expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'Instructions.MLPersonality' );
      expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'Instructions.MLInstructions' );
    } );

    it( 'should return hardcoded safety instruction when no MLInstructions or MLPersonality in data', async () => {
      mockServices.dataService.getValue.mockReturnValue( null );

      const result = await service.getSystemInstructions();

      expect( result ).toEqual( [ "## Safety & Constraints\n- **Prohibited Content:** No sexist, racist, or homophobic language.\n- **Use of Gender Pronouns:** Always use gender-neutral pronouns unless specified otherwise." ] );
    } );

    it( 'should return null when dataService is not available', async () => {
      const serviceWithoutData = new MachineLearningService( {} );

      const result = await serviceWithoutData.getSystemInstructions();

      expect( result ).toBeNull();
    } );

    it( 'should handle errors gracefully', async () => {
      mockServices.dataService.loadData.mockRejectedValue( new Error( 'Data load error' ) );

      const result = await service.getSystemInstructions();

      expect( result ).toBeNull();
    } );
  } );

  describe( 'createSystemInstruction', () => {
    it( 'should combine MLPersonality and MLInstructions with template replacement', async () => {
      // Mock both MLPersonality and MLInstructions
      mockServices.dataService.getValue
        .mockReturnValueOnce( 'I am {botName} hosting {hangoutName}' ) // MLPersonality
        .mockReturnValueOnce( 'Follow these rules for {hangoutName}' ); // MLInstructions

      const result = await service.createSystemInstruction();

      expect( result ).toEqual( [
        "## Safety & Constraints\n- **Prohibited Content:** No sexist, racist, or homophobic language.\n- **Use of Gender Pronouns:** Always use gender-neutral pronouns unless specified otherwise.",
        "\nI am Test Bot hosting Test Hangout",
        "\nFollow these rules for Test Hangout"
      ] );
      expect( mockServices.dataService.loadData ).toHaveBeenCalled();
      expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'Instructions.MLPersonality' );
      expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'Instructions.MLInstructions' );
    } );

    it( 'should return only personality when instructions are missing', async () => {
      mockServices.dataService.getValue
        .mockReturnValueOnce( 'I am {botName}' ) // MLPersonality
        .mockReturnValueOnce( null ); // MLInstructions

      const result = await service.createSystemInstruction();

      expect( result ).toEqual( [
        "## Safety & Constraints\n- **Prohibited Content:** No sexist, racist, or homophobic language.\n- **Use of Gender Pronouns:** Always use gender-neutral pronouns unless specified otherwise.",
        "\nI am Test Bot"
      ] );
    } );

    it( 'should return only instructions when personality is missing', async () => {
      mockServices.dataService.getValue
        .mockReturnValueOnce( null ) // MLPersonality
        .mockReturnValueOnce( 'Follow these rules' ); // MLInstructions

      const result = await service.createSystemInstruction();

      expect( result ).toEqual( [
        "## Safety & Constraints\n- **Prohibited Content:** No sexist, racist, or homophobic language.\n- **Use of Gender Pronouns:** Always use gender-neutral pronouns unless specified otherwise.",
        "\nFollow these rules"
      ] );
    } );

    it( 'should return hardcoded safety instruction when both personality and instructions are missing', async () => {
      mockServices.dataService.getValue.mockReturnValue( null );

      const result = await service.createSystemInstruction();

      expect( result ).toEqual( [ "## Safety & Constraints\n- **Prohibited Content:** No sexist, racist, or homophobic language.\n- **Use of Gender Pronouns:** Always use gender-neutral pronouns unless specified otherwise." ] );
    } );
  } );

  describe( 'askGoogleAI', () => {
    it( 'should return "No response" when both models return no response', async () => {
      const mockResponse = {
        text: null
      };

      // Mock getValue to return appropriate values
      mockServices.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'conversationHistory' ) return [];
        return null;
      } );

      // Both calls fail
      mockSendMessage.mockResolvedValue( mockResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'I\'m unable to process your request at the moment. Please try again later.' );
      expect( mockChatsCreate ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'should return error message when both models throw errors', async () => {
      // Mock getValue to return appropriate values
      mockServices.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'conversationHistory' ) return [];
        return null;
      } );

      // Both calls throw errors
      mockSendMessage
        .mockRejectedValueOnce( new Error( 'Primary API Error' ) )
        .mockRejectedValueOnce( new Error( 'Fallback API Error' ) );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'I\'m unable to process your request at the moment. Please try again later.' );
      expect( mockChatsCreate ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'should return error message when primary succeeds but fallback is called and fails', async () => {
      const mockPrimaryResponse = {
        text: null // Primary returns no response
      };

      // Mock getValue to return appropriate values
      mockServices.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'conversationHistory' ) return [];
        return null;
      } );

      // Primary fails with no response, fallback throws error
      mockSendMessage
        .mockResolvedValueOnce( mockPrimaryResponse )
        .mockRejectedValueOnce( new Error( 'Fallback API Error' ) );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'I\'m unable to process your request at the moment. Please try again later.' );
      expect( mockChatsCreate ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'should return configuration error when no API key is set', async () => {
      delete process.env.googleAIKey;
      const serviceWithoutKey = new MachineLearningService();

      const result = await serviceWithoutKey.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'Google AI service is not configured. Please check your googleAIKey environment variable.' );

      // Restore the API key for other tests
      process.env.googleAIKey = 'test-api-key';
    } );

    it( 'should use correct model configurations for primary and fallback', async () => {
      const mockResponse = {
        text: 'Response from new chat API'
      };

      mockSendMessage.mockResolvedValue( mockResponse );

      await service.askGoogleAI( 'Test question' );

      // Verify chats.create was called with correct config (using gemma models)
      // For Gemma models, systemInstruction is included in the question, not passed separately
      // Config should include tools with function declarations
      expect( mockChatsCreate ).toHaveBeenCalledWith( {
        model: "gemma-3-27b-it",
        config: {
          history: [],
          temperature: 2.0,
          tools: expect.arrayContaining( [
            expect.objectContaining( {
              functionDeclarations: expect.arrayContaining( [
                expect.objectContaining( {
                  name: "getSongDetails"
                } )
              ] )
            } )
          ] )
        }
      } );

      // Verify sendMessage was called with the question
      expect( mockSendMessage ).toHaveBeenCalledWith( {
        message: expect.stringContaining( 'Test question' )
      } );
    } );
  } );

  describe( 'conversation history', () => {
    describe( 'loadConversationHistory', () => {
      it( 'should return empty array when no data service available', async () => {
        const serviceWithoutData = new MachineLearningService( {} );

        const result = await serviceWithoutData.loadConversationHistory();

        expect( result ).toEqual( [] );
      } );

      it( 'should return empty array when no conversation history exists', async () => {
        mockServices.dataService.getValue.mockReturnValue( null );

        const result = await service.loadConversationHistory();

        expect( result ).toEqual( [] );
        expect( mockServices.dataService.loadData ).toHaveBeenCalled();
        expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'conversationHistory' );
      } );

      it( 'should filter out entries older than 60 minutes', async () => {
        const now = Date.now();
        const sixtyOneMinutesAgo = new Date( now - 61 * 60 * 1000 ).toISOString();
        const twentyMinutesAgo = new Date( now - 20 * 60 * 1000 ).toISOString();

        const mockHistory = [
          { timestamp: sixtyOneMinutesAgo, question: 'Old question', response: 'Old response' },
          { timestamp: twentyMinutesAgo, question: 'Recent question', response: 'Recent response' }
        ];

        mockServices.dataService.getValue.mockReturnValue( mockHistory );

        const result = await service.loadConversationHistory();

        expect( result ).toHaveLength( 1 );
        expect( result[ 0 ].question ).toBe( 'Recent question' );
      } );

      it( 'should return all entries from the last hour (no count limit)', async () => {
        const now = Date.now();
        const mockHistory = [];
        for ( let i = 0; i < 5; i++ ) {
          mockHistory.push( {
            timestamp: new Date( now - i * 60 * 1000 ).toISOString(),
            question: `Question ${ i }`,
            response: `Response ${ i }`
          } );
        }

        mockServices.dataService.getValue.mockReturnValue( mockHistory );

        const result = await service.loadConversationHistory();

        expect( result ).toHaveLength( 5 );
      } );

      it( 'should handle errors gracefully', async () => {
        mockServices.dataService.loadData.mockRejectedValue( new Error( 'Data load error' ) );

        const result = await service.loadConversationHistory();

        expect( result ).toEqual( [] );
      } );
    } );

    describe( 'saveConversationEntry', () => {
      it( 'should do nothing when no data service available', async () => {
        const serviceWithoutData = new MachineLearningService( {} );

        await serviceWithoutData.saveConversationEntry( 'question', 'response' );

        // Should not throw any errors
      } );

      it( 'should save new entry to conversation history', async () => {
        const existingHistory = [
          { timestamp: new Date().toISOString(), question: 'Old question', response: 'Old response' }
        ];
        mockServices.dataService.getValue.mockReturnValue( existingHistory );

        await service.saveConversationEntry( 'New question', 'New response' );

        expect( mockServices.dataService.loadData ).toHaveBeenCalled();
        expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'conversationHistory' );
        expect( mockServices.dataService.setValue ).toHaveBeenCalledWith(
          'conversationHistory',
          expect.arrayContaining( [
            expect.objectContaining( { question: 'Old question', response: 'Old response' } ),
            expect.objectContaining( { question: 'New question', response: 'New response' } )
          ] )
        );
      } );

      it( 'should filter entries to keep only those from the last hour', async () => {
        const now = Date.now();
        const mockHistory = [];

        // Add 10 entries - some old (more than 1 hour), some recent (within 1 hour)
        for ( let i = 0; i < 10; i++ ) {
          const minutesAgo = i < 5 ? i * 10 : ( 50 + i * 10 ); // First 5 within hour, rest older
          mockHistory.push( {
            timestamp: new Date( now - minutesAgo * 60 * 1000 ).toISOString(),
            question: `Question ${ i }`,
            response: `Response ${ i }`
          } );
        }

        mockServices.dataService.getValue.mockReturnValue( mockHistory );

        await service.saveConversationEntry( 'New question', 'New response' );

        const savedHistory = mockServices.dataService.setValue.mock.calls[ 0 ][ 1 ];

        // Should contain the new entry plus only the entries from the last hour (first 5 + new one = 6)
        expect( savedHistory.length ).toBe( 6 );
        expect( savedHistory ).toEqual( expect.arrayContaining( [
          expect.objectContaining( { question: 'New question', response: 'New response' } )
        ] ) );
      } );

      it( 'should handle errors gracefully', async () => {
        mockServices.dataService.loadData.mockRejectedValue( new Error( 'Data load error' ) );

        await service.saveConversationEntry( 'question', 'response' );

        // Should not throw any errors
      } );
    } );

    describe( 'formatChatHistory', () => {
      it( 'should format conversation history for Google AI', () => {
        const history = [
          { timestamp: '2023-01-01T00:00:00Z', question: 'Question 1', response: 'Response 1' },
          { timestamp: '2023-01-01T00:01:00Z', question: 'Question 2', response: 'Response 2' }
        ];

        const result = service.formatChatHistory( history );

        expect( result ).toEqual( [
          { role: 'user', parts: [ { text: 'Question 1' } ] },
          { role: 'model', parts: [ { text: 'Response 1' } ] },
          { role: 'user', parts: [ { text: 'Question 2' } ] },
          { role: 'model', parts: [ { text: 'Response 2' } ] }
        ] );
      } );

      it( 'should format ML conversation history with new role/content format', () => {
        const history = [
          { role: 'user', content: 'Tell me about the song', timestamp: '2023-01-01T00:00:00Z' },
          { role: 'model', content: 'The song is amazing!', timestamp: '2023-01-01T00:00:00Z' }
        ];

        const result = service.formatChatHistory( history );

        expect( result ).toEqual( [
          { role: 'user', parts: [ { text: 'Tell me about the song' } ] },
          { role: 'model', parts: [ { text: 'The song is amazing!' } ] }
        ] );
      } );

      it( 'should handle empty history', () => {
        const result = service.formatChatHistory( [] );

        expect( result ).toEqual( [] );
      } );
    } );

    describe( 'loadMLConversationHistory', () => {
      it( 'should return empty array when no data service available', async () => {
        const serviceWithoutData = new MachineLearningService( {} );

        const result = await serviceWithoutData.loadMLConversationHistory();

        expect( result ).toEqual( [] );
      } );

      it( 'should return empty array when no ML conversation history exists', async () => {
        mockServices.dataService.getValue.mockReturnValue( [] );

        const result = await service.loadMLConversationHistory();

        expect( result ).toEqual( [] );
      } );

      it( 'should return last 3 pairs flattened to role/content format', async () => {
        const mlHistory = [
          {
            timestamp: '2023-01-01T00:00:00Z',
            pair: [
              { role: 'user', content: 'Question 1' },
              { role: 'model', content: 'Response 1' }
            ]
          },
          {
            timestamp: '2023-01-01T00:01:00Z',
            pair: [
              { role: 'user', content: 'Question 2' },
              { role: 'model', content: 'Response 2' }
            ]
          },
          {
            timestamp: '2023-01-01T00:02:00Z',
            pair: [
              { role: 'user', content: 'Question 3' },
              { role: 'model', content: 'Response 3' }
            ]
          },
          {
            timestamp: '2023-01-01T00:03:00Z',
            pair: [
              { role: 'user', content: 'Question 4' },
              { role: 'model', content: 'Response 4' }
            ]
          },
          {
            timestamp: '2023-01-01T00:04:00Z',
            pair: [
              { role: 'user', content: 'Question 5' },
              { role: 'model', content: 'Response 5' }
            ]
          }
        ];

        mockServices.dataService.getValue.mockReturnValue( mlHistory );

        const result = await service.loadMLConversationHistory();

        // Should return last 3 pairs (6 entries total)
        expect( result ).toHaveLength( 6 );

        // Verify structure and content
        expect( result ).toEqual( [
          { role: 'user', content: 'Question 3', timestamp: '2023-01-01T00:02:00Z' },
          { role: 'model', content: 'Response 3', timestamp: '2023-01-01T00:02:00Z' },
          { role: 'user', content: 'Question 4', timestamp: '2023-01-01T00:03:00Z' },
          { role: 'model', content: 'Response 4', timestamp: '2023-01-01T00:03:00Z' },
          { role: 'user', content: 'Question 5', timestamp: '2023-01-01T00:04:00Z' },
          { role: 'model', content: 'Response 5', timestamp: '2023-01-01T00:04:00Z' }
        ] );
      } );

      it( 'should handle partial pairs gracefully', async () => {
        const mlHistory = [
          {
            timestamp: '2023-01-01T00:00:00Z',
            pair: [
              { role: 'user', content: 'Question 1' }
              // Missing model response
            ]
          },
          {
            timestamp: '2023-01-01T00:01:00Z',
            pair: [
              { role: 'user', content: 'Question 2' },
              { role: 'model', content: 'Response 2' }
            ]
          }
        ];

        mockServices.dataService.getValue.mockReturnValue( mlHistory );

        const result = await service.loadMLConversationHistory();

        // Should include all available messages
        expect( result ).toHaveLength( 3 );
      } );

      it( 'should handle errors gracefully', async () => {
        mockServices.dataService.loadData.mockRejectedValue( new Error( 'Data load error' ) );

        const result = await service.loadMLConversationHistory();

        expect( result ).toEqual( [] );
      } );

      it( 'should clean Gemini tokens from loaded history responses', async () => {
        const mlHistory = [
          {
            timestamp: '2023-01-01T00:00:00Z',
            pair: [
              { role: 'user', content: 'Question 1' },
              { role: 'model', content: 'Response 1 with token<end_of_turn>' }
            ]
          },
          {
            timestamp: '2023-01-01T00:01:00Z',
            pair: [
              { role: 'user', content: '<start_of_turn>user\nQuestion 2<end_of_turn>' },
              { role: 'model', content: '<start_of_turn>model\nResponse 2<end_of_turn>' }
            ]
          }
        ];

        mockServices.dataService.getValue.mockReturnValue( mlHistory );

        const result = await service.loadMLConversationHistory();

        // Verify tokens were removed
        expect( result[ 1 ].content ).toBe( 'Response 1 with token' );
        expect( result[ 3 ].content ).toBe( 'Response 2' );
      } );
    } );

    describe( 'cleanGeminiTokens', () => {
      it( 'should remove <end_of_turn> tokens', () => {
        const text = 'This is a response.<end_of_turn>';

        const result = service.cleanGeminiTokens( text );

        expect( result ).toBe( 'This is a response.' );
      } );

      it( 'should remove <start_of_turn> tokens', () => {
        const text = '<start_of_turn>user\nThis is a question';

        const result = service.cleanGeminiTokens( text );

        expect( result ).toBe( 'This is a question' );
      } );

      it( 'should remove multiple turn tokens', () => {
        const text = '<start_of_turn>user\nQuestion<end_of_turn>\n<start_of_turn>model\nAnswer<end_of_turn>';

        const result = service.cleanGeminiTokens( text );

        expect( result ).toBe( 'Question\nAnswer' );
      } );

      it( 'should trim whitespace after token removal', () => {
        const text = 'Response text<end_of_turn>   ';

        const result = service.cleanGeminiTokens( text );

        expect( result ).toBe( 'Response text' );
      } );

      it( 'should handle null text gracefully', () => {
        const result = service.cleanGeminiTokens( null );

        expect( result ).toBeNull();
      } );

      it( 'should handle empty string gracefully', () => {
        const result = service.cleanGeminiTokens( '' );

        expect( result ).toBe( '' );
      } );

      it( 'should handle non-string input gracefully', () => {
        const result = service.cleanGeminiTokens( 123 );

        expect( result ).toBe( 123 );
      } );

      it( 'should preserve content without tokens', () => {
        const text = 'This is a normal response with no tokens.';

        const result = service.cleanGeminiTokens( text );

        expect( result ).toBe( text );
      } );
    } );
  } );
} );