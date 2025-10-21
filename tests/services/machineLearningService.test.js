// Mock the Google Generative AI module before requiring the service
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent
}));
const mockGoogleGenerativeAI = jest.fn(() => ({
  getGenerativeModel: mockGetGenerativeModel
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: mockGoogleGenerativeAI
}));

const MachineLearningService = require('../../src/services/machineLearningService.js');

// Mock the environment variable for testing
process.env.googleAIKey = 'test-api-key';

describe('MachineLearningService', () => {
  let service;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create service instance
    service = new MachineLearningService();
  });

  describe('constructor', () => {
    it('should initialize with Google AI key from environment', () => {
      expect(service.googleAIKey).toBe('test-api-key');
      expect(service.genAI).toBeDefined();
    });

    it('should handle missing API key gracefully', () => {
      delete process.env.googleAIKey;
      const serviceWithoutKey = new MachineLearningService();
      
      expect(serviceWithoutKey.googleAIKey).toBeUndefined();
      expect(serviceWithoutKey.genAI).toBeNull();
      
      // Restore the API key for other tests
      process.env.googleAIKey = 'test-api-key';
    });
  });

  describe('askGoogleAI', () => {
    it('should return AI response when successful', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('This is a test response')
        }
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const result = await service.askGoogleAI('Test question');
      
      expect(result).toBe('This is a test response');
      expect(mockGenerateContent).toHaveBeenCalledWith('Test question');
    });

    it('should return "No response" when response text is not available', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue(null)
        }
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const result = await service.askGoogleAI('Test question');
      
      expect(result).toBe('No response');
    });

    it('should handle errors gracefully', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'));
      
      const result = await service.askGoogleAI('Test question');
      
      expect(result).toBe('An error occurred while connecting to Google Gemini. Please wait a minute and try again');
    });

    it('should return configuration error when no API key is set', async () => {
      delete process.env.googleAIKey;
      const serviceWithoutKey = new MachineLearningService();
      
      const result = await serviceWithoutKey.askGoogleAI('Test question');
      
      expect(result).toBe('Google AI service is not configured. Please check your googleAIKey environment variable.');
      
      // Restore the API key for other tests
      process.env.googleAIKey = 'test-api-key';
    });

    it('should use correct model configuration', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Response')
        }
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      await service.askGoogleAI('Test question');
      
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: "gemini-2.5-flash" });
    });
  });
});