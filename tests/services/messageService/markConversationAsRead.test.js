// Mock modules before importing messageService
jest.mock( '../../../src/lib/logging.js', () => ( {
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
} ) );

jest.mock( 'axios', () => ( {
  post: jest.fn(),
  patch: jest.fn()
} ) );

jest.mock( '../../../src/services/cometchatApi.js', () => ( {
  BASE_URL: 'https://test-api.cometchat.com',
  headers: {
    'Content-Type': 'application/json',
    'apiKey': 'test-api-key'
  },
  markConversationAsRead: jest.fn()
} ) );

jest.mock( '../../../src/config.js', () => ( {
  HANGOUT_ID: 'test-group-id',
  BOT_UID: 'test-bot-uid',
  COMETCHAT_RECEIVER_UID: 'test-receiver-uid'
} ) );

const { messageService } = require( '../../../src/services/messageService.js' );
const axios = require( 'axios' );
const cometchatApi = require( '../../../src/services/cometchatApi.js' );
const { logger } = require( '../../../src/lib/logging.js' );

describe( 'messageService.markMessageAsInterracted (conversation read)', () => {
  beforeEach( () => {
    jest.clearAllMocks();
  } );

  test( 'should successfully mark conversation as read', async () => {
    const mockResponse = {
      status: 200,
      data: { success: true },
      headers: { 'content-type': 'application/json' }
    };
    cometchatApi.markConversationAsRead.mockResolvedValue( mockResponse );

    await messageService.markMessageAsInterracted();

    expect( cometchatApi.markConversationAsRead ).toHaveBeenCalledWith(
      'https://test-api.cometchat.com/v3/users/test-receiver-uid/conversation/read'
    );
  } );

  test( 'should handle API errors with response data', async () => {
    const apiError = {
      response: {
        data: { error: 'User not found' },
        status: 404,
        headers: { 'content-type': 'application/json' }
      }
    };
    cometchatApi.markConversationAsRead.mockRejectedValue( apiError );

    try {
      await messageService.markMessageAsInterracted();
    } catch ( error ) {
      // Expected to throw
    }

    expect( logger.error ).toHaveBeenCalledWith(
      expect.stringContaining( '❌ Error marking message as read' )
    );
  } );

  test( 'should handle network errors without response', async () => {
    const networkError = new Error( 'Network connection failed' );
    cometchatApi.markConversationAsRead.mockRejectedValue( networkError );

    try {
      await messageService.markMessageAsInterracted();
    } catch ( error ) {
      // Expected to throw
    }

    expect( logger.error ).toHaveBeenCalledWith(
      expect.stringContaining( '❌ Error marking message as read' )
    );
  } );

  test( 'should handle errors with undefined response data', async () => {
    const errorWithEmptyResponse = {
      response: {
        status: 500,
        headers: {}
      },
      message: 'Internal server error'
    };
    cometchatApi.markConversationAsRead.mockRejectedValue( errorWithEmptyResponse );

    try {
      await messageService.markMessageAsInterracted();
    } catch ( error ) {
      // Expected to throw
    }

    expect( logger.error ).toHaveBeenCalledWith(
      expect.stringContaining( '❌ Error marking message as read' )
    );
  } );
} );
