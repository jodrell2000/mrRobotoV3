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

jest.mock( '../../../src/services/cometchatApi.js', () => ( {
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
const cometchatApi = require( '../../../src/services/cometchatApi.js' );
const config = require( '../../../src/config.js' );
const { logger } = require( '../../../src/lib/logging.js' );

describe( 'messageService.returnLastUserMessage', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    buildUrl.mockReturnValue( 'https://test-api.cometchat.com/v3/users/test-user/messages' );
  } );

  test( 'should return message ID when user has unread messages', async () => {
    const mockResponse = {
      data: [
        { id: 'message-123', text: 'Hello' },
        { id: 'message-124', text: 'World' }
      ]
    };
    cometchatApi.fetchMessages.mockResolvedValue( mockResponse );

    const result = await messageService.returnLastUserMessage( 'test-user' );

    expect( cometchatApi.fetchMessages ).toHaveBeenCalledWith(
      'v3/users/test-bot-uid/conversations/test-user/messages',
      [
        [ 'unread', 'true' ]
      ]
    );
    expect( result ).toBe( 'message-123' );
  } );

  test( 'should return null when user has no messages', async () => {
    const mockResponse = {
      data: []
    };
    cometchatApi.fetchMessages.mockResolvedValue( mockResponse );

    const result = await messageService.returnLastUserMessage( 'test-user' );

    expect( result ).toBeNull();
  } );

  test( 'should return null when response data is missing', async () => {
    const mockResponse = { data: null };
    cometchatApi.fetchMessages.mockResolvedValue( mockResponse );

    const result = await messageService.returnLastUserMessage( 'test-user' );

    expect( result ).toBeNull();
  } );

  test( 'should return null when API call fails', async () => {
    const error = new Error( 'API error' );
    cometchatApi.fetchMessages.mockRejectedValue( error );

    const result = await messageService.returnLastUserMessage( 'test-user' );

    expect( logger.error ).toHaveBeenCalledWith( '❌ Error getting last user message: API error' );
    expect( result ).toBeNull();
  } );

  test( 'should handle malformed response data', async () => {
    const mockResponse = {
      data: 'not-an-array'
    };
    cometchatApi.fetchMessages.mockResolvedValue( mockResponse );

    const result = await messageService.returnLastUserMessage( 'test-user' );

    expect( result ).toBeUndefined();
  } );
} );
