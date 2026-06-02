// Mock the modules before importing messageService
jest.mock( '../../../src/lib/logging.js', () => ( {
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
} ) );

jest.mock( '../../../src/services/openchatApi', () => ({
  buildCustomData: jest.fn(),
  buildPayload: jest.fn(),
  sendMessage: jest.fn(),
  joinChatGroup: jest.fn(),
  fetchMessages: jest.fn(),
  markConversationAsRead: jest.fn(),
  BASE_URL: 'https://test.cometchat.io',
  headers: {},
  apiClient: {}
}));

// Now import the modules that use the mocked dependencies
const { messageService } = require( '../../../src/services/messageService.js' );
const openchatApi = require( '../../../src/services/openchatApi' );
const { logger } = require( '../../../src/lib/logging.js' );

describe( 'messageService', () => {
  let mockServices;

  beforeEach( () => {
    jest.clearAllMocks();
    
    // Set up mock implementations for openchatApi functions
    openchatApi.buildCustomData.mockImplementation(async (message, services) => ({
      message: message,
      avatarId: services.dataService?.getValue('botData.CHAT_AVATAR_ID'),
      userName: services.dataService?.getValue('botData.CHAT_NAME'),
      color: `#${services.dataService?.getValue('botData.CHAT_COLOUR')}`,
      mentions: [],
      userUuid: 'test-bot-uid',
      badges: ['VERIFIED', 'STAFF'],
      id: 'mock-uuid'
    }));

    openchatApi.buildPayload.mockImplementation(async (receiver, receiverType, customData, message) => ({
      receiver: receiver,
      receiverType: receiverType,
      category: 'message',
      type: 'text',
      data: {
        text: message,
        metadata: {
          chatMessage: customData
        }
      }
    }));
    
    mockServices = {
      dataService: {
        getAllData: jest.fn().mockReturnValue( {} ),
        getValue: jest.fn().mockImplementation( ( key ) => {
          if ( key === 'botData.CHAT_AVATAR_ID' ) return 'avatar123';
          if ( key === 'botData.CHAT_NAME' ) return 'TestBot';
          if ( key === 'botData.CHAT_COLOUR' ) return 'FF0000';
          return null;
        } )
      }
    };
  } );

  afterEach( () => {
    jest.clearAllMocks();
  } );

  test( 'sendPrivateMessage sends correct payload with resolved customData', async () => {
    openchatApi.sendMessage.mockResolvedValue( {
      data: { success: true, message: 'Message sent successfully!' }
    } );

    await messageService.sendPrivateMessage( 'Hello Test', 'test-receiver', mockServices );

    expect( openchatApi.sendMessage ).toHaveBeenCalledTimes( 1 );
    const calledPayload = openchatApi.sendMessage.mock.calls[ 0 ][ 0 ]; // first argument of openchatApi.sendMessage

    // Assert that customData was resolved properly (not a Promise)
    expect( calledPayload ).toHaveProperty( 'data.metadata.chatMessage.message', 'Hello Test' );
    expect( typeof calledPayload.data.metadata.chatMessage ).toBe( 'object' );
  } );

  test( 'sendPrivateMessage logs error on axios failure', async () => {
    const error = {
      response: {
        data: 'Unauthorized'
      },
      message: 'Unauthorized'
    };

    openchatApi.sendMessage.mockRejectedValue( error );

    await messageService.sendPrivateMessage( 'Hello Error', 'test-receiver', mockServices );

    expect( openchatApi.sendMessage ).toHaveBeenCalledTimes( 1 );
    expect( logger.error ).toHaveBeenCalledWith(
      expect.stringContaining( '❌ Failed to send private message: Unauthorized' )
    );
  } );

  test( 'sendPrivateMessage logs error message when err.response is undefined', async () => {
    const error = new Error( 'Network failure' );
    openchatApi.sendMessage.mockRejectedValue( error );

    await messageService.sendPrivateMessage( 'Hello Error', 'test-receiver', mockServices );

    expect( logger.error ).toHaveBeenCalledWith(
      expect.stringContaining( '❌ Failed to send private message: Network failure' )
    );
  } );

  test( 'sendPrivateMessage logs error on cometchat failure with response data', async () => {
    // Mock openchatApi.sendMessage to reject with an error object
    const error = {
      response: {
        data: { message: 'Private message failed' }
      }
    };
    openchatApi.sendMessage.mockRejectedValue( error );

    await messageService.sendPrivateMessage( 'Test private message', 'test-receiver', mockServices );

    expect( openchatApi.sendMessage ).toHaveBeenCalledTimes( 1 );
    expect( logger.error ).toHaveBeenCalledWith(
      expect.stringContaining( '❌ Failed to send private message:' )
    );
  } );
} );
