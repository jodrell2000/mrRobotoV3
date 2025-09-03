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
  makeRequest: jest.fn()
} ) );

jest.mock( '../../../src/services/cometchatApi.js', () => ( {
  headers: {
    'Content-Type': 'application/json',
    'apiKey': 'test-api-key'
  },
  joinChatGroup: jest.fn(),
  sendMessage: jest.fn(),
  fetchMessages: jest.fn(),
  markConversationAsRead: jest.fn()
} ) );

jest.mock( '../../../src/config.js', () => ( {
  COMETCHAT_API_KEY: 'test-api-key',
  HANGOUT_ID: 'test-hangout-id',
  BOT_UID: 'test-bot-uid'
} ) );

const { messageService } = require( '../../../src/services/messageService.js' );
const { makeRequest } = require( '../../../src/lib/buildUrl.js' );
const cometchatApi = require( '../../../src/services/cometchatApi.js' );
const config = require( '../../../src/config.js' );
const { logger } = require( '../../../src/lib/logging.js' );

describe( 'messageService.joinChat', () => {
  beforeEach( () => {
    jest.clearAllMocks();
  } );

  test( 'should successfully join chat room', async () => {
    const mockResponse = { data: { success: true } };
    cometchatApi.joinChatGroup.mockResolvedValue( mockResponse );

    const result = await messageService.joinChat( 'test-room-id' );

    expect( cometchatApi.joinChatGroup ).toHaveBeenCalledWith( 'test-room-id' );
    expect( result ).toBe( mockResponse );
  } );

  test( 'should handle already joined error gracefully', async () => {
    const alreadyJoinedError = new Error( 'ERR_ALREADY_JOINED: User already joined' );
    cometchatApi.joinChatGroup.mockRejectedValue( alreadyJoinedError );

    const result = await messageService.joinChat( 'test-room-id' );

    expect( logger.debug ).toHaveBeenCalledWith( '✅ User already joined chat group - continuing' );
    expect( result ).toEqual( { success: true, alreadyJoined: true } );
  } );

  test( 'should handle other errors by throwing', async () => {
    const otherError = new Error( 'Network error' );
    cometchatApi.joinChatGroup.mockRejectedValue( otherError );

    await expect( messageService.joinChat( 'test-room-id' ) ).rejects.toThrow( 'Network error' );

    expect( logger.error ).toHaveBeenCalledWith( '❌ Error joining chat: Network error' );
  } );

  test( 'should handle errors without message property', async () => {
    const errorWithoutMessage = { status: 500 };
    cometchatApi.joinChatGroup.mockRejectedValue( errorWithoutMessage );

    await expect( messageService.joinChat( 'test-room-id' ) ).rejects.toEqual( errorWithoutMessage );
  } );
} );
