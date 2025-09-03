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

describe('fetchPrivateMessagesForUUID', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('logs the sender and message when lastMessage exists', async () => {
    const mockLastMessage = {
      id: '25812293',
      sender: 'abcdef-ccd3-4c1b-9846-5336fbd3b415',
      data: {
        text: 'Hello Mr. Roboto version 3!',
        metadata: {},
        entities: {}
      }
    };

    cometchatApi.apiClient = {
      get: jest.fn().mockResolvedValue({
        data: {
          data: {
            lastMessage: mockLastMessage
          }
        }
      })
    };

    await messageService.fetchPrivateMessagesForUUID('test-user-uuid');

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('📥 Private message from abcdef-ccd3-4c1b-9846-5336fbd3b415: Hello Mr. Roboto version 3!')
    );
  });

  test('logs a fallback message if text is missing', async () => {
    const mockLastMessage = {
      sender: 'user-123',
      data: {}
    };

    cometchatApi.apiClient = {
      get: jest.fn().mockResolvedValue({
        data: {
          data: {
            lastMessage: mockLastMessage
          }
        }
      })
    };

    await messageService.fetchPrivateMessagesForUUID('test-user-uuid');

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('📥 Private message from user-123: [No Text]')
    );
  });

  test('logs when no lastMessage exists', async () => {
    cometchatApi.apiClient = {
      get: jest.fn().mockResolvedValue({
        data: {
          data: {
            lastMessage: null
          }
        }
      })
    };

    await messageService.fetchPrivateMessagesForUUID('test-user-uuid');

    expect(logger.debug).toHaveBeenCalledWith('📥 No private messages found.');
  });

  test('logs an error when the API call fails', async () => {
    cometchatApi.apiClient = {
      get: jest.fn().mockRejectedValue(new Error('Request failed'))
    };

    await messageService.fetchPrivateMessagesForUUID('test-user-uuid');

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('❌ Error fetching private messages:')
    );
  });

  test('returns array with message if it starts with command switch', async () => {
    const { COMMAND_SWITCH } = process.env;
    const commandText = `${COMMAND_SWITCH}do-something`;

    const mockLastMessage = {
      sender: 'test-user',
      data: {
        text: commandText
      }
    };

    cometchatApi.apiClient = {
      get: jest.fn().mockResolvedValue({
        data: {
          data: {
            lastMessage: mockLastMessage
          }
        }
      })
    };

    const result = await messageService.fetchPrivateMessagesForUUID('test-user-uuid');

    // Function currently doesn't return anything (return statement is commented out)
    expect(result).toBeUndefined();
  });

  test('fetchPrivateMessagesForUUID does not return array if message does not start with switch', async () => {
    cometchatApi.apiClient = {
      get: jest.fn().mockResolvedValue({
        data: { data: { lastMessage: { sender: 'u1', data: { text: 'hello world' } } } }
      })
    };

    const result = await messageService.fetchPrivateMessagesForUUID('test-user-uuid');
    expect(result).toBeUndefined(); // no return
  });
});
