// Mock the modules before importing messageService
jest.mock('../../../src/lib/logging.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../src/services/cometchatApi');

// Now import the modules that use the mocked dependencies
const { messageService } = require('../../../src/services/messageService.js');
const cometchatApi = require('../../../src/services/cometchatApi');
const { logger } = require('../../../src/lib/logging.js');

describe('fetchGroupMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('returns formatted group messages from API response', async () => {
    const { COMMAND_SWITCH } = process.env;
    const mockMessages = [
      {
        id: '25324828',
        sentAt: undefined,
        sender: 'user-123',
        data: { text: `${COMMAND_SWITCH}escortme` }
      },
      {
        id: '25324848',
        sentAt: undefined,
        sender: 'user-789',
        data: { text: `wibble` }
      },
      {
        id: '25324829',
        sentAt: undefined,
        sender: 'user-456',
        data: { text: `${COMMAND_SWITCH}hello` }
      }
    ];

    cometchatApi.apiClient = {
      get: jest.fn().mockResolvedValue({ data: { data: mockMessages } })
    };

    const result = await messageService.fetchGroupMessages();

    expect(result).toEqual([
      {
        id: '25324828',
        sentAt: undefined,
        sender: 'user-123',
        data: {
          text: `${ COMMAND_SWITCH }escortme`
        }
      },
      {
        id: '25324829',
        sentAt: undefined,
        sender: 'user-456',
        data: {
          text: `${ COMMAND_SWITCH }hello`
        }
      }
    ]);

    // The debug function is called with two parameters: a message and an array
    expect(logger.debug).toHaveBeenCalledWith(
      '📥 Group command messages:',
      expect.any(Array)
    );
  });

  test('logs an error when the API call fails', async () => {
    const error = new Error('Network failure');
    cometchatApi.apiClient = {
      get: jest.fn().mockRejectedValue(error)
    };

    await messageService.fetchGroupMessages();

    expect(logger.error).toHaveBeenCalledWith(
      '❌ Error fetching group messages:',
      'Network failure'
    );
  });

  test('returns empty array if no group messages are found', async () => {
    cometchatApi.apiClient = {
      get: jest.fn().mockResolvedValue({ data: { data: [] } })
    };

    const result = await messageService.fetchGroupMessages();
    expect(result).toEqual([]);
  });

  test('returns parsed message with [No Text] if message is missing text', async () => {
    const mockMessages = [
      {
        id: '1',
        sender: 'user-1',
        sentAt: 1234567890,
        data: {}
      }
    ];

    cometchatApi.apiClient = {
      get: jest.fn().mockResolvedValue({ data: { data: mockMessages } })
    };

    const result = await messageService.fetchGroupMessages();

    expect(result).toEqual([]);
  });
});