// Mock the modules before importing messageService
jest.mock('../../../src/lib/logging.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../src/services/openchatApi');

// Now import the modules that use the mocked dependencies
const { messageService } = require('../../../src/services/messageService.js');
const openchatApi = require('../../../src/services/openchatApi');
const { logger } = require('../../../src/lib/logging.js');

describe('fetchAllPrivateUserMessages with logging options', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    // Mock the fetchMessages method
    openchatApi.fetchMessages = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('handles messages when logLastMessage is true and messages exist', async () => {
    const mockMessages = [
      {
        id: '25812293',
        sender: { uid: 'abcdef-ccd3-4c1b-9846-5336fbd3b415' },
        data: {
          text: 'Hello Mr. Roboto version 3!',
          metadata: {},
          entities: {}
        },
        sentAt: 1640995200
      }
    ];

    openchatApi.fetchMessages.mockResolvedValue({
      data: {
        data: mockMessages
      }
    });

    const result = await messageService.fetchAllPrivateUserMessages('test-user-uuid', { logLastMessage: true, returnData: false });

    // Should return empty array when returnData is false
    expect(result).toEqual([]);
  });

  test('handles messages when text is missing', async () => {
    const mockMessages = [
      {
        id: '25812294',
        sender: { uid: 'user-123' },
        data: {
          metadata: {},
          entities: {}
        },
        sentAt: 1640995200
      }
    ];

    openchatApi.fetchMessages.mockResolvedValue({
      data: {
        data: mockMessages
      }
    });

    const result = await messageService.fetchAllPrivateUserMessages('test-user-uuid', { logLastMessage: true, returnData: false });

    // Should return empty array when returnData is false
    expect(result).toEqual([]);
  });

  test('handles when no messages exist', async () => {
    openchatApi.fetchMessages.mockResolvedValue({
      data: {
        data: []
      }
    });

    const result = await messageService.fetchAllPrivateUserMessages('test-user-uuid', { logLastMessage: true, returnData: false });

    // Should return empty array when no messages and returnData is false
    expect(result).toEqual([]);
  });

  test('logs an error when the API call fails', async () => {
    openchatApi.fetchMessages.mockRejectedValue(new Error('Request failed'));

    await messageService.fetchAllPrivateUserMessages('test-user-uuid', { logLastMessage: true, returnData: false });

    // Check that error was logged (don't test exact format)
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error fetching private messages')
    );
  });

  test('returns empty array when returnData is false', async () => {
    const mockMessages = [
      {
        id: '25812293',
        sender: { uid: 'test-user' },
        data: {
          text: 'Test message'
        },
        sentAt: 1640995200
      }
    ];

    openchatApi.fetchMessages.mockResolvedValue({
      data: {
        data: mockMessages
      }
    });

    const result = await messageService.fetchAllPrivateUserMessages('test-user-uuid', { returnData: false });

    expect(result).toEqual([]);
  });

  test('returns message data when returnData is true (default)', async () => {
    const mockMessages = [
      {
        id: '25812293',
        sender: { uid: 'test-user' },
        data: {
          text: 'Test message'
        },
        sentAt: 1640995200
      }
    ];

    openchatApi.fetchMessages.mockResolvedValue({
      data: {
        data: mockMessages
      }
    });

    const result = await messageService.fetchAllPrivateUserMessages('test-user-uuid');

    expect(result).toEqual([
      {
        id: '25812293',
        text: 'Test message',
        sender: 'test-user',
        sentAt: 1640995200,
        customData: null
      }
    ]);
  });

  test('handles both logging and data return when both options are true', async () => {
    const mockMessages = [
      {
        id: '25812293',
        sender: { uid: 'test-user' },
        data: {
          text: 'Test message'
        },
        sentAt: 1640995200
      }
    ];

    openchatApi.fetchMessages.mockResolvedValue({
      data: {
        data: mockMessages
      }
    });

    const result = await messageService.fetchAllPrivateUserMessages('test-user-uuid', { 
      logLastMessage: true, 
      returnData: true 
    });

    // Should return the data when returnData is true
    expect(result).toEqual([
      {
        id: '25812293',
        text: 'Test message',
        sender: 'test-user',
        sentAt: 1640995200,
        customData: null
      }
    ]);
  });
});
