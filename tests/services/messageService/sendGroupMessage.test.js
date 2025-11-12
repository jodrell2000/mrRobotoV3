// Mock the modules before importing messageService
jest.mock( '../../../src/lib/logging.js', () => ( {
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
} ) );

jest.mock( 'axios' );
jest.mock( '../../../src/services/cometchatApi', () => ( {
  buildCustomData: jest.fn(),
  buildPayload: jest.fn(),
  sendMessage: jest.fn(),
  joinChatGroup: jest.fn(),
  fetchMessages: jest.fn(),
  markConversationAsRead: jest.fn(),
  BASE_URL: 'https://test.cometchat.io',
  headers: {},
  apiClient: {}
} ) );

// Now import the modules that use the mocked dependencies
const axios = require( 'axios' );
const { messageService } = require( '../../../src/services/messageService.js' );
const cometchatApi = require( '../../../src/services/cometchatApi' );
const { logger } = require( '../../../src/lib/logging.js' );

describe( 'messageService', () => {
  let buildCustomDataSpy;
  let buildPayloadSpy;

  beforeEach( () => {
    jest.clearAllMocks();

    // Set up mock implementations for cometchatApi functions
    cometchatApi.buildCustomData.mockImplementation( async ( message, services, senderUid, senderName, senderAvatarId, senderColor ) => ( {
      message: message,
      avatarId: senderAvatarId || services?.dataService?.getValue( 'botData.CHAT_AVATAR_ID' ) || 'bot-01',
      userName: senderName || services?.dataService?.getValue( 'botData.CHAT_NAME' ) || 'Bot',
      color: senderColor || `#${ services?.dataService?.getValue( 'botData.CHAT_COLOUR' ) || 'ff9900' }`,
      mentions: [],
      userUuid: 'test-bot-uid',
      badges: [ 'VERIFIED', 'STAFF' ],
      id: 'mock-uuid'
    } ) );

    cometchatApi.buildPayload.mockImplementation( async ( receiver, receiverType, customData, message ) => ( {
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
    } ) );

    cometchatApi.sendMessage.mockResolvedValue( {
      data: { success: true, id: 'msg-123' }
    } );

    // Set up spies for the tests that expect them
    buildCustomDataSpy = jest.spyOn( cometchatApi, 'buildCustomData' );
    buildPayloadSpy = jest.spyOn( cometchatApi, 'buildPayload' );

    // Mock services object for tests
    const mockServices = {
      dataService: {
        getValue: jest.fn()
          .mockReturnValueOnce( 'avatar123' )  // for CHAT_AVATAR_ID
          .mockReturnValueOnce( 'TestBot' )    // for CHAT_NAME
          .mockReturnValueOnce( 'ff0000' ),    // for CHAT_COLOUR
        getAllData: jest.fn().mockReturnValue( {
          botData: {
            CHAT_AVATAR_ID: 'avatar123',
            CHAT_NAME: 'TestBot',
            CHAT_COLOUR: 'ff0000'
          }
        } )
      }
    };
  } );

  afterEach( () => {
    buildCustomDataSpy.mockRestore();
    buildPayloadSpy.mockRestore();
  } );

  test( 'sendGroupMessage sends a group message', async () => {
    // Mock axios post response
    axios.post.mockResolvedValue( {
      data: {
        success: true,
        message: "Message sent successfully!"
      }
    } );

    // Call sendGroupMessage with test message
    await messageService.sendGroupMessage( "Test message" );

    // Verify internal helper functions called correctly
    expect( buildCustomDataSpy ).toHaveBeenCalledWith( "Test message", expect.any( Object ), null, null, null, null );
    expect( buildPayloadSpy ).toHaveBeenCalledWith(
      expect.any( String ),   // receiver id (string)
      "group",             // receiverType
      expect.any( Object ),   // customData object
      "Test message"       // message text
    );

    // Verify cometchatApi.sendMessage was called (not axios.post)
    expect( cometchatApi.sendMessage ).toHaveBeenCalledTimes( 1 );
  } );

  test( 'sendGroupMessage calls API and completes successfully', async () => {
    axios.post.mockResolvedValue( { data: { success: true } } );

    await messageService.sendGroupMessage( 'Group hello' );

    expect( cometchatApi.sendMessage ).toHaveBeenCalledTimes( 1 );
    expect( logger.error ).not.toHaveBeenCalled();
  } );

  test( 'sendGroupMessage handles API errors and logs error', async () => {
    const error = new Error( 'Group failed' );
    cometchatApi.sendMessage.mockRejectedValue( error );

    await messageService.sendGroupMessage( 'Offline' );

    // Check for the error message split into parts
    expect( logger.error ).toHaveBeenCalledWith( '❌ Failed to send group message: Offline' );
    expect( logger.error ).toHaveBeenCalledWith( 'Error message: Group failed' );
  } );

  test( 'does not use logger.error on successful API call', async () => {
    cometchatApi.sendMessage.mockResolvedValue( { data: { success: true } } );

    await messageService.sendGroupMessage( 'Group Hello' );

    expect( cometchatApi.sendMessage ).toHaveBeenCalled();
    expect( logger.error ).not.toHaveBeenCalled();
  } );

  test( 'calls logger.error on API failure', async () => {
    const error = new Error( 'API failure' );

    cometchatApi.sendMessage.mockRejectedValue( error );
    await messageService.sendGroupMessage( 'Oops' );

    // Check for the error message split into parts
    expect( logger.error ).toHaveBeenCalledWith( '❌ Failed to send group message: Oops' );
    expect( logger.error ).toHaveBeenCalledWith( 'Error message: API failure' );
  } );
} );
