// Mock modules before importing messageService
jest.mock( '../../../src/lib/logging.js', () => ( {
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
} ) );

jest.mock( '../../../src/lib/buildUrl.js', () => ( {
  buildUrl: jest.fn()
} ) );

jest.mock( '../../../src/services/openchatApi.js', () => ( {
  BASE_URL: 'https://test-api.cometchat.com',
  apiClient: {
    get: jest.fn()
  },
  fetchMessages: jest.fn()
} ) );

jest.mock( '../../../src/config.js', () => ( {
  BOT_UID: 'test-bot-uid'
} ) );

const { messageService } = require( '../../../src/services/messageService.js' );
const { buildUrl } = require( '../../../src/lib/buildUrl.js' );
const openchatApi = require( '../../../src/services/openchatApi.js' );
const config = require( '../../../src/config.js' );
const { logger } = require( '../../../src/lib/logging.js' );

describe( 'messageService.fetchAllPrivateUserMessages', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    buildUrl.mockReturnValue( 'https://test-api.cometchat.com/v3/users/test-user/messages' );
  } );

  test( 'should return simplified messages for user with customData', async () => {
    const mockResponse = {
      data: {
        data: [
          {
            id: 'msg-1',
            data: {
              text: 'Hello there!',
              metadata: {
                chatMessage: { customField: 'value' }
              }
            },
            sentAt: 1640995200,
            sender: { uid: 'user-123' }
          },
          {
            id: 'msg-2',
            data: {
              text: 'Direct text message'
            },
            sentAt: null,
            sender: { uid: 'user-456' }
          }
        ]
      }
    };
    openchatApi.fetchMessages.mockResolvedValue( mockResponse );

    const result = await messageService.fetchAllPrivateUserMessages( 'test-user' );

    expect( openchatApi.fetchMessages ).toHaveBeenCalledWith(
      'v3/messages?receiverType=user&sender=test-user&limit=100'
    );
    expect( result ).toEqual( [
      {
        id: 'msg-1',
        text: 'Hello there!',
        sentAt: 1640995200,
        sender: 'user-123',
        customData: { customField: 'value' }
      },
      {
        id: 'msg-2',
        text: 'Direct text message',
        sentAt: null,
        sender: 'user-456',
        customData: null
      }
    ] );
  } );

  test( 'should handle messages with no content gracefully', async () => {
    const mockResponse = {
      data: {
        data: [
          {
            id: 'msg-empty',
            data: {},
            sentAt: null,
            sender: { uid: 'user-789' }
          }
        ]
      }
    };
    openchatApi.fetchMessages.mockResolvedValue( mockResponse );

    const result = await messageService.fetchAllPrivateUserMessages( 'test-user' );

    expect( result ).toEqual( [
      {
        id: 'msg-empty',
        text: '[No content]',
        sentAt: null,
        sender: 'user-789',
        customData: null
      }
    ] );
  } );

  test( 'should return empty array when no messages found', async () => {
    const mockResponse = {
      data: []
    };
    openchatApi.fetchMessages.mockResolvedValue( mockResponse );

    const result = await messageService.fetchAllPrivateUserMessages( 'test-user' );

    expect( result ).toEqual( [] );
  } );

  test( 'should return empty array when response data is missing', async () => {
    const mockResponse = { data: null };
    openchatApi.fetchMessages.mockResolvedValue( mockResponse );

    const result = await messageService.fetchAllPrivateUserMessages( 'test-user' );

    expect( result ).toEqual( [] );
  } );

  test( 'should return empty array when data is not an array', async () => {
    const mockResponse = {
      data: 'not-an-array'
    };
    openchatApi.fetchMessages.mockResolvedValue( mockResponse );

    const result = await messageService.fetchAllPrivateUserMessages( 'test-user' );

    expect( result ).toEqual( [] );
  } );

  test( 'should handle API errors gracefully', async () => {
    const error = new Error( 'Network error' );
    openchatApi.fetchMessages.mockRejectedValue( error );

    const result = await messageService.fetchAllPrivateUserMessages( 'test-user' );

    // Check that error was logged (don't test exact message format)
    expect( logger.error ).toHaveBeenCalledWith( expect.stringContaining( 'Error fetching private messages' ) );
    expect( result ).toEqual( [] );
  } );
} );
