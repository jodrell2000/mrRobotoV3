// Mock the modules before importing messageService
jest.mock('../../../src/lib/logging.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../src/config.js', () => ({
  COMMAND_SWITCH: '/'
}));

const { messageService } = require('../../../src/services/messageService.js');

describe('filterMessagesForCommands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set environment variable for consistent testing
    process.env.COMMAND_SWITCH = '/';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('filters messages that start with command switch', () => {
    const messages = [
      {
        id: '1',
        data: { text: '/hello' }
      },
      {
        id: '2', 
        data: { text: 'regular message' }
      },
      {
        id: '3',
        data: { text: '/test command' }
      },
      {
        id: '4',
        data: { text: 'another regular message' }
      }
    ];

    const result = messageService.filterMessagesForCommands(messages);

    expect(result).toEqual([
      {
        id: '1',
        data: { text: '/hello' }
      },
      {
        id: '3',
        data: { text: '/test command' }
      }
    ]);
  });

  test('returns empty array when input is not an array', () => {
    expect(messageService.filterMessagesForCommands(null)).toEqual([]);
    expect(messageService.filterMessagesForCommands(undefined)).toEqual([]);
    expect(messageService.filterMessagesForCommands('not-an-array')).toEqual([]);
    expect(messageService.filterMessagesForCommands({})).toEqual([]);
  });

  test('returns empty array when input is empty array', () => {
    const result = messageService.filterMessagesForCommands([]);
    expect(result).toEqual([]);
  });

  test('filters out messages with missing data', () => {
    const messages = [
      {
        id: '1',
        data: { text: '/hello' }
      },
      {
        id: '2'
        // missing data
      },
      {
        id: '3',
        data: {}
        // missing text
      },
      {
        id: '4',
        data: { text: '/test' }
      }
    ];

    const result = messageService.filterMessagesForCommands(messages);

    expect(result).toEqual([
      {
        id: '1',
        data: { text: '/hello' }
      },
      {
        id: '4',
        data: { text: '/test' }
      }
    ]);
  });

  test('filters out messages with null or undefined text', () => {
    const messages = [
      {
        id: '1',
        data: { text: '/hello' }
      },
      {
        id: '2',
        data: { text: null }
      },
      {
        id: '3',
        data: { text: undefined }
      },
      {
        id: '4',
        data: { text: '/test' }
      }
    ];

    const result = messageService.filterMessagesForCommands(messages);

    expect(result).toEqual([
      {
        id: '1',
        data: { text: '/hello' }
      },
      {
        id: '4',
        data: { text: '/test' }
      }
    ]);
  });

  test('filters out messages with empty string text', () => {
    const messages = [
      {
        id: '1',
        data: { text: '/hello' }
      },
      {
        id: '2',
        data: { text: '' }
      },
      {
        id: '3',
        data: { text: '/test' }
      }
    ];

    const result = messageService.filterMessagesForCommands(messages);

    expect(result).toEqual([
      {
        id: '1',
        data: { text: '/hello' }
      },
      {
        id: '3',
        data: { text: '/test' }
      }
    ]);
  });

  test('uses process.env.COMMAND_SWITCH when available', () => {
    process.env.COMMAND_SWITCH = '!';
    
    const messages = [
      {
        id: '1',
        data: { text: '!hello' }
      },
      {
        id: '2',
        data: { text: '/not-command' }
      },
      {
        id: '3',
        data: { text: '!test' }
      }
    ];

    const result = messageService.filterMessagesForCommands(messages);

    expect(result).toEqual([
      {
        id: '1',
        data: { text: '!hello' }
      },
      {
        id: '3',
        data: { text: '!test' }
      }
    ]);
  });

  test('handles messages that start with command switch but have additional content', () => {
    const messages = [
      {
        id: '1',
        data: { text: '/hello world' }
      },
      {
        id: '2',
        data: { text: '/test arg1 arg2' }
      },
      {
        id: '3',
        data: { text: 'regular /not-command' }
      }
    ];

    const result = messageService.filterMessagesForCommands(messages);

    expect(result).toEqual([
      {
        id: '1',
        data: { text: '/hello world' }
      },
      {
        id: '2',
        data: { text: '/test arg1 arg2' }
      }
    ]);
  });
});
