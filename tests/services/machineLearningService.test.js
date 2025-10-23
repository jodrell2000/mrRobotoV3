// Mock the logger
jest.mock( '../../src/lib/logging', () => ( {
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
} ) );

// Mock the Google AI module 
jest.mock( '@google/generative-ai' );

const MachineLearningService = require( '../../src/services/machineLearningService.js' );
const { GoogleGenerativeAI } = require( '@google/generative-ai' );

// Mock the environment variable for testing
process.env.googleAIKey = 'test-api-key';

describe( 'MachineLearningService', () => {
  let service;
  let consoleSpy;
  let mockGoogleGenerativeAI;
  let mockGetGenerativeModel;
  let mockGenerateContent;

  beforeEach( () => {
    // Reset mocks
    jest.clearAllMocks();

    // Set up fresh mock functions
    mockGenerateContent = jest.fn();
    mockGetGenerativeModel = jest.fn( () => ( {
      generateContent: mockGenerateContent
    } ) );
    mockGoogleGenerativeAI = GoogleGenerativeAI;

    // Mock the instance methods
    mockGoogleGenerativeAI.mockImplementation( () => ( {
      getGenerativeModel: mockGetGenerativeModel
    } ) );

    consoleSpy = jest.spyOn( console, 'error' ).mockImplementation( () => { } );
    service = new MachineLearningService();
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
      const serviceWithoutKey = new MachineLearningService();

      expect( serviceWithoutKey.googleAIKey ).toBeUndefined();
      expect( serviceWithoutKey.genAI ).toBeNull();

      // Restore the API key for other tests
      process.env.googleAIKey = 'test-api-key';
    } );
  } );

  describe( 'askGoogleAI', () => {
    it( 'should return AI response from primary model when successful', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue( 'This is a test response from primary model' )
        }
      };

      mockGenerateContent.mockResolvedValue( mockResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'This is a test response from primary model' );
      expect( mockGetGenerativeModel ).toHaveBeenCalledWith( { model: "gemini-2.5-flash" } );
      // Should only call primary model, not fallback
      expect( mockGetGenerativeModel ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'should fallback to secondary model when primary returns no response', async () => {
      const mockPrimaryResponse = {
        response: {
          text: jest.fn().mockReturnValue( null ) // Primary fails
        }
      };

      const mockFallbackResponse = {
        response: {
          text: jest.fn().mockReturnValue( 'Response from fallback model' )
        }
      };

      // First call (primary) fails, second call (fallback) succeeds
      mockGenerateContent
        .mockResolvedValueOnce( mockPrimaryResponse )
        .mockResolvedValueOnce( mockFallbackResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'Response from fallback model' );
      expect( mockGenerateContent ).toHaveBeenCalledTimes( 2 );
      expect( mockGetGenerativeModel ).toHaveBeenCalledWith( { model: "gemini-2.5-flash" } );
      expect( mockGetGenerativeModel ).toHaveBeenCalledWith( { model: "gemini-2.0-flash" } );
    } );

    it( 'should fallback to secondary model when primary throws error', async () => {
      const mockFallbackResponse = {
        response: {
          text: jest.fn().mockReturnValue( 'Response from fallback after error' )
        }
      };

      // First call (primary) throws error, second call (fallback) succeeds
      mockGenerateContent
        .mockRejectedValueOnce( new Error( 'Primary model API Error' ) )
        .mockResolvedValueOnce( mockFallbackResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'Response from fallback after error' );
      expect( mockGenerateContent ).toHaveBeenCalledTimes( 2 );
      expect( mockGetGenerativeModel ).toHaveBeenCalledWith( { model: "gemini-2.5-flash" } );
      expect( mockGetGenerativeModel ).toHaveBeenCalledWith( { model: "gemini-2.0-flash" } );
    } );

    it( 'should return "No response" when both models return no response', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue( null )
        }
      };

      // Both calls fail
      mockGenerateContent.mockResolvedValue( mockResponse );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'No response' );
      expect( mockGenerateContent ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'should return error message when both models throw errors', async () => {
      // Both calls throw errors
      mockGenerateContent
        .mockRejectedValueOnce( new Error( 'Primary API Error' ) )
        .mockRejectedValueOnce( new Error( 'Fallback API Error' ) );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'An error occurred while connecting to Google Gemini. Please wait a minute and try again' );
      expect( mockGenerateContent ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'should return error message when primary succeeds but fallback is called and fails', async () => {
      const mockPrimaryResponse = {
        response: {
          text: jest.fn().mockReturnValue( null ) // Primary returns no response
        }
      };

      // Primary fails with no response, fallback throws error
      mockGenerateContent
        .mockResolvedValueOnce( mockPrimaryResponse )
        .mockRejectedValueOnce( new Error( 'Fallback API Error' ) );

      const result = await service.askGoogleAI( 'Test question' );

      expect( result ).toBe( 'An error occurred while connecting to Google Gemini. Please wait a minute and try again' );
      expect( mockGenerateContent ).toHaveBeenCalledTimes( 2 );
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
        response: {
          text: jest.fn().mockReturnValue( 'Response' )
        }
      };

      mockGenerateContent.mockResolvedValue( mockResponse );

      await service.askGoogleAI( 'Test question' );

      expect( mockGetGenerativeModel ).toHaveBeenCalledWith( { model: "gemini-2.5-flash" } );
    } );
  } );
} );