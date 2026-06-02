// Mock modules before importing messageService
jest.mock('../../../src/lib/logging.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../src/lib/buildUrl.js', () => ({
  buildUrl: jest.fn(),
  makeRequest: jest.fn()
}));

jest.mock('../../../src/services/openchatApi.js', () => ({
  BASE_URL: 'https://test-api.cometchat.com',
  apiClient: {
    get: jest.fn(),
    post: jest.fn()
  },
  headers: {
    'Content-Type': 'application/json',
    'apiKey': 'test-api-key'
  }
}));

jest.mock('../../../src/config.js', () => ({
  HANGOUT_ID: 'test-hangout-id',
  BOT_UID: 'test-bot-uid'
}));

const { messageService } = require('../../../src/services/messageService.js');
const { buildUrl, makeRequest } = require('../../../src/lib/buildUrl.js');
const openchatApi = require('../../../src/services/openchatApi.js');
const config = require('../../../src/config.js');
const { logger } = require('../../../src/lib/logging.js');

describe('messageService - Helper Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLatestGroupMessageId and setLatestGroupMessageId', () => {
    test('should set and get latest group message ID', () => {
      const testId = 'message-123';
      
      // Set the ID
      messageService.setLatestGroupMessageId(testId);
      
      // Get the ID
      const retrievedId = messageService.getLatestGroupMessageId();
      
      expect(retrievedId).toBe(testId);
    });

    test('should return null when no ID has been set', () => {
      // Reset by setting to null
      messageService.setLatestGroupMessageId(null);
      
      const retrievedId = messageService.getLatestGroupMessageId();
      
      expect(retrievedId).toBeNull();
    });

    test('should handle undefined values', () => {
      messageService.setLatestGroupMessageId(undefined);
      
      const retrievedId = messageService.getLatestGroupMessageId();
      
      expect(retrievedId).toBeUndefined();
    });
  });
});
