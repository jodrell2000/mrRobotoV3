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
const { __mockModelsGenerateContent } = require( '@google/genai' );

// Mock the environment variable for testing
process.env.googleAIKey = 'test-api-key';

describe( 'MachineLearningService', () => {
  let service;
  let consoleSpy;
  let mockModelsGenerateContent;
  let mockServices;

  beforeEach( () => {
    // Reset mocks
    jest.clearAllMocks();

    // Use the mock function from the mock module
    mockModelsGenerateContent = __mockModelsGenerateContent;

    // Mock services object
    mockServices = {
      dataService: {
        loadData: jest.fn().mockResolvedValue(),
        getValue: jest.fn()
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
      mockServices.dataService.getValue.mockReturnValue( 'You are a DJ called {botName} in {hangoutName}' );

      const result = await service.getSystemInstructions();

      expect( result ).toBe( 'You are a DJ called Test Bot in Test Hangout' );
      expect( mockServices.dataService.loadData ).toHaveBeenCalled();
      expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'MLInstructions' );
    } );

    it( 'should return null when no MLInstructions in data', async () => {
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

  describe( 'askGoogleAI', () => {
    it( 'should return AI response from primary model when successful', async () => {
      const mockResponse = {
        text: 'This is a test response from primary model'
      };

      // Mock system instructions
      mockServices.dataService.getValue.mockReturnValue( 'You are a test DJ called {botName}' );

      mockModelsGenerateContent.mockResolvedValue( mockResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'This is a test response from primary model' );
      expect( mockModelsGenerateContent ).toHaveBeenCalledWith( {
        model: "gemini-2.5-flash",
        contents: 'Test question',
        config: {
          systemInstruction: [ 'You are a test DJ called Test Bot' ]
        }
      } );
      // Should only call primary model, not fallback
      expect( mockModelsGenerateContent ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'should fallback to secondary model when primary returns no response', async () => {
      const mockPrimaryResponse = {
        text: null // Primary fails
      };

      const mockFallbackResponse = {
        text: 'Response from fallback model'
      };

      // First call (primary) fails, second call (fallback) succeeds
      mockModelsGenerateContent
        .mockResolvedValueOnce( mockPrimaryResponse )
        .mockResolvedValueOnce( mockFallbackResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'Response from fallback model' );
      expect( mockModelsGenerateContent ).toHaveBeenCalledTimes( 2 );
      expect( mockModelsGenerateContent ).toHaveBeenCalledWith( {
        model: "gemini-2.5-flash",
        contents: 'Test question'
      } );
      expect( mockModelsGenerateContent ).toHaveBeenCalledWith( {
        model: "gemini-2.0-flash",
        contents: 'Test question'
      } );
    } );

    it( 'should fallback to secondary model when primary throws error', async () => {
      const mockFallbackResponse = {
        text: 'Response from fallback after error'
      };

      // First call (primary) throws error, second call (fallback) succeeds
      mockModelsGenerateContent
        .mockRejectedValueOnce( new Error( 'Primary model API Error' ) )
        .mockResolvedValueOnce( mockFallbackResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'Response from fallback after error' );
      expect( mockModelsGenerateContent ).toHaveBeenCalledTimes( 2 );
      expect( mockModelsGenerateContent ).toHaveBeenCalledWith( {
        model: "gemini-2.5-flash",
        contents: 'Test question'
      } );
      expect( mockModelsGenerateContent ).toHaveBeenCalledWith( {
        model: "gemini-2.0-flash",
        contents: 'Test question'
      } );
    } );

    it( 'should return "No response" when both models return no response', async () => {
      const mockResponse = {
        text: null
      };

      // Both calls fail
      mockModelsGenerateContent.mockResolvedValue( mockResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'No response' );
      expect( mockModelsGenerateContent ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'should return error message when both models throw errors', async () => {
      // Both calls throw errors
      mockModelsGenerateContent
        .mockRejectedValueOnce( new Error( 'Primary API Error' ) )
        .mockRejectedValueOnce( new Error( 'Fallback API Error' ) );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'An error occurred while connecting to Google Gemini. Please wait a minute and try again' );
      expect( mockModelsGenerateContent ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'should return error message when primary succeeds but fallback is called and fails', async () => {
      const mockPrimaryResponse = {
        text: null // Primary returns no response
      };

      // Primary fails with no response, fallback throws error
      mockModelsGenerateContent
        .mockResolvedValueOnce( mockPrimaryResponse )
        .mockRejectedValueOnce( new Error( 'Fallback API Error' ) );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'An error occurred while connecting to Google Gemini. Please wait a minute and try again' );
      expect( mockModelsGenerateContent ).toHaveBeenCalledTimes( 2 );
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
        text: 'Response'
      };

      mockModelsGenerateContent.mockResolvedValue( mockResponse );

      await service.askGoogleAI( 'Test question' );

      expect( mockModelsGenerateContent ).toHaveBeenCalledWith( {
        model: "gemini-2.5-flash",
        contents: 'Test question'
      } );
    } );
  } );
} );