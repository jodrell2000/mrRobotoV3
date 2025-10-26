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
      getState: jest.fn().mockReturnValue( 'Test Bot' )
    };

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

      expect( result ).toBe( 'You are a DJ called Test Bot in Test Hangout\n\nYou are a DJ called Test Bot in Test Hangout' );
      expect( mockServices.dataService.loadData ).toHaveBeenCalled();
      expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'Instructions.MLPersonality' );
      expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'Instructions.MLInstructions' );
    } );

    it( 'should return null when no MLInstructions or MLPersonality in data', async () => {
      mockServices.dataService.getValue.mockReturnValue( null );

      const result = await service.getSystemInstructions();

      expect( result ).toBeNull();
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

      expect( result ).toBe( 'I am Test Bot hosting Test Hangout\n\nFollow these rules for Test Hangout' );
      expect( mockServices.dataService.loadData ).toHaveBeenCalled();
      expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'Instructions.MLPersonality' );
      expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'Instructions.MLInstructions' );
    } );

    it( 'should return only personality when instructions are missing', async () => {
      mockServices.dataService.getValue
        .mockReturnValueOnce( 'I am {botName}' ) // MLPersonality
        .mockReturnValueOnce( null ); // MLInstructions

      const result = await service.createSystemInstruction();

      expect( result ).toBe( 'I am Test Bot' );
    } );

    it( 'should return only instructions when personality is missing', async () => {
      mockServices.dataService.getValue
        .mockReturnValueOnce( null ) // MLPersonality
        .mockReturnValueOnce( 'Follow these rules' ); // MLInstructions

      const result = await service.createSystemInstruction();

      expect( result ).toBe( 'Follow these rules' );
    } );

    it( 'should return null when both personality and instructions are missing', async () => {
      mockServices.dataService.getValue.mockReturnValue( null );

      const result = await service.createSystemInstruction();

      expect( result ).toBeNull();
    } );
  } );

  describe( 'askGoogleAI', () => {
    it( 'should return AI response from primary model when successful', async () => {
      const mockResponse = {
        text: 'This is a test response from primary model'
      };

      // Mock the call order: conversationHistory, MLPersonality, MLInstructions
      mockServices.dataService.getValue
        .mockReturnValueOnce( [] ) // conversationHistory
        .mockReturnValueOnce( 'You are a test DJ called {botName}' ) // MLPersonality
        .mockReturnValueOnce( 'You are a test DJ called {botName}' ); // MLInstructions

      mockSendMessage.mockResolvedValue( mockResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'This is a test response from primary model' );
      expect( mockChatsCreate ).toHaveBeenCalledWith( {
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: 'You are a test DJ called Test Bot\n\nYou are a test DJ called Test Bot',
          history: []
        }
      } );
      expect( mockSendMessage ).toHaveBeenCalledWith( {
        message: 'Test question'
      } );
      // Should only call primary model, not fallback
      expect( mockChatsCreate ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'should fallback to secondary model when primary returns no response', async () => {
      const mockPrimaryResponse = {
        text: null // Primary fails
      };

      const mockFallbackResponse = {
        text: 'Response from fallback model'
      };

      // First call (primary) fails, second call (fallback) succeeds
      mockSendMessage
        .mockResolvedValueOnce( mockPrimaryResponse )
        .mockResolvedValueOnce( mockFallbackResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'Response from fallback model' );
      expect( mockChatsCreate ).toHaveBeenCalledTimes( 2 );
      expect( mockChatsCreate ).toHaveBeenNthCalledWith( 1, {
        model: "gemini-2.5-flash",
        config: {
          history: []
        }
      } );
      expect( mockChatsCreate ).toHaveBeenNthCalledWith( 2, {
        model: "gemini-1.5-pro",
        config: {
          history: []
        }
      } );
    } );

    it( 'should fallback to secondary model when primary throws error', async () => {
      const mockFallbackResponse = {
        text: 'Response from fallback after error'
      };

      // First call (primary) throws error, second call (fallback) succeeds
      mockSendMessage
        .mockRejectedValueOnce( new Error( 'Primary model API Error' ) )
        .mockResolvedValueOnce( mockFallbackResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'Response from fallback after error' );
      expect( mockChatsCreate ).toHaveBeenCalledTimes( 2 );
      expect( mockChatsCreate ).toHaveBeenNthCalledWith( 1, {
        model: "gemini-2.5-flash",
        config: {
          history: []
        }
      } );
      expect( mockChatsCreate ).toHaveBeenNthCalledWith( 2, {
        model: "gemini-1.5-pro",
        config: {
          history: []
        }
      } );
    } );

    it( 'should return "No response" when both models return no response', async () => {
      const mockResponse = {
        text: null
      };

      // Both calls fail
      mockSendMessage.mockResolvedValue( mockResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'No response' );
      expect( mockChatsCreate ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'should return error message when both models throw errors', async () => {
      // Both calls throw errors
      mockSendMessage
        .mockRejectedValueOnce( new Error( 'Primary API Error' ) )
        .mockRejectedValueOnce( new Error( 'Fallback API Error' ) );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'An error occurred while connecting to Google Gemini. Please wait a minute and try again' );
      expect( mockChatsCreate ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'should return error message when primary succeeds but fallback is called and fails', async () => {
      const mockPrimaryResponse = {
        text: null // Primary returns no response
      };

      // Primary fails with no response, fallback throws error
      mockSendMessage
        .mockResolvedValueOnce( mockPrimaryResponse )
        .mockRejectedValueOnce( new Error( 'Fallback API Error' ) );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'An error occurred while connecting to Google Gemini. Please wait a minute and try again' );
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

      // Verify chats.create was called with correct config
      expect( mockChatsCreate ).toHaveBeenCalledWith( {
        model: "gemini-2.5-flash",
        config: {
          history: []
        }
      } );

      // Verify sendMessage was called with the question
      expect( mockSendMessage ).toHaveBeenCalledWith( {
        message: 'Test question'
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
        expect( result[0].question ).toBe( 'Recent question' );
      } );

      it( 'should return all entries from the last hour (no count limit)', async () => {
        const now = Date.now();
        const mockHistory = [];
        for ( let i = 0; i < 5; i++ ) {
          mockHistory.push( {
            timestamp: new Date( now - i * 60 * 1000 ).toISOString(),
            question: `Question ${i}`,
            response: `Response ${i}`
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
          const minutesAgo = i < 5 ? i * 10 : (50 + i * 10); // First 5 within hour, rest older
          mockHistory.push( {
            timestamp: new Date( now - minutesAgo * 60 * 1000 ).toISOString(),
            question: `Question ${i}`,
            response: `Response ${i}`
          } );
        }
        
        mockServices.dataService.getValue.mockReturnValue( mockHistory );
        
        await service.saveConversationEntry( 'New question', 'New response' );
        
        const savedHistory = mockServices.dataService.setValue.mock.calls[0][1];
        
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

      it( 'should handle empty history', () => {
        const result = service.formatChatHistory( [] );
        
        expect( result ).toEqual( [] );
      } );
    } );
  } );
} );