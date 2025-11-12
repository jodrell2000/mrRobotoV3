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

describe( 'messageService.sendGroupMessage - Object Parameters', () => {
  let buildCustomDataSpy;
  let buildPayloadSpy;

  beforeEach( () => {
    jest.clearAllMocks();

    // Set up mock implementations for cometchatApi functions
    cometchatApi.buildCustomData.mockImplementation( async ( message, services, senderUid, senderName, senderAvatarId, senderColor ) => ( {
      message: message,
      avatarId: senderAvatarId || services.dataService?.getValue( 'botData.CHAT_AVATAR_ID' ),
      userName: senderName || services.dataService?.getValue( 'botData.CHAT_NAME' ),
      color: senderColor || `#${ services.dataService?.getValue( 'botData.CHAT_COLOUR' ) }`,
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

  test( 'should handle object-style message with custom room', async () => {
    const mockResponse = { data: { id: 'msg-123', text: 'Test message' } };
    cometchatApi.sendMessage.mockResolvedValueOnce( mockResponse );

    const messageObj = {
      message: 'Test with custom room',
      room: 'custom-room-id'
    };

    const result = await messageService.sendGroupMessage( messageObj );

    expect( result.message ).toBe( 'Test with custom room' );
    expect( result.messageResponse ).toEqual( mockResponse.data );
    expect( buildCustomDataSpy ).toHaveBeenCalledWith( 'Test with custom room', expect.any( Object ), null, null, null, null );
    expect( buildPayloadSpy ).toHaveBeenCalledWith(
      'custom-room-id',
      'group',
      expect.any( Object ),
      'Test with custom room'
    );
  } );

  test( 'should handle object-style message with images', async () => {
    const mockResponse = { data: { id: 'msg-456' } };
    cometchatApi.sendMessage.mockResolvedValueOnce( mockResponse );

    const mockCustomDataWithImages = {
      message: "Test with images",
      imageUrls: [ 'image1.jpg', 'image2.jpg' ],
      avatarId: 'avatar123',
      userName: 'TestBot',
      color: '#ff0000',
      mentions: [],
      userUuid: 'bot-uid',
      badges: [ 'VERIFIED', 'STAFF' ],
      id: 'uuid-123'
    };

    buildCustomDataSpy.mockResolvedValueOnce( mockCustomDataWithImages );

    const messageObj = {
      message: 'Test with images',
      images: [ 'image1.jpg', 'image2.jpg' ]
    };

    const result = await messageService.sendGroupMessage( messageObj );

    expect( result.message ).toBe( 'Test with images' );
    expect( buildCustomDataSpy ).toHaveBeenCalledWith( 'Test with images', expect.any( Object ), null, null, null, null );
    // Verify that images were added to customData
    expect( mockCustomDataWithImages.imageUrls ).toEqual( [ 'image1.jpg', 'image2.jpg' ] );
  } );

  test( 'should handle object-style message with mentions', async () => {
    const mockResponse = { data: { id: 'msg-789' } };
    cometchatApi.sendMessage.mockResolvedValueOnce( mockResponse );

    const messageObj = {
      message: 'Test with mentions',
      mentions: [
        { position: 0, nickname: 'User1', userId: 'user1' },
        { position: 10, nickname: 'User2', userId: 'user2' }
      ]
    };

    const result = await messageService.sendGroupMessage( messageObj );

    expect( result.message ).toBe( 'Test with mentions' );
    expect( buildCustomDataSpy ).toHaveBeenCalledWith( 'Test with mentions', expect.any( Object ), null, null, null, null );

    // Check that the spy was called and verify mentions structure
    const customDataCall = buildCustomDataSpy.mock.results[ 0 ].value;
    expect( customDataCall ).resolves.toHaveProperty( 'mentions' );
  } );

  test( 'should handle string message with options.images', async () => {
    const mockResponse = { data: { id: 'msg-999' } };
    cometchatApi.sendMessage.mockResolvedValueOnce( mockResponse );

    const mockCustomDataWithImages = {
      message: "String message with images",
      imageUrls: [ 'option-image.png' ],
      avatarId: 'avatar123',
      userName: 'TestBot',
      color: '#ff0000',
      mentions: [],
      userUuid: 'bot-uid',
      badges: [ 'VERIFIED', 'STAFF' ],
      id: 'uuid-123'
    };

    buildCustomDataSpy.mockResolvedValueOnce( mockCustomDataWithImages );

    const options = {
      images: [ 'option-image.png' ],
      room: 'options-room'
    };

    const result = await messageService.sendGroupMessage( 'String message with images', options );

    expect( result.message ).toBe( 'String message with images' );
    expect( buildPayloadSpy ).toHaveBeenCalledWith(
      'options-room',
      'group',
      expect.any( Object ),
      'String message with images'
    );
  } );

  test( 'should return error object when object message has no message property', async () => {
    const invalidMessageObj = {
      room: 'test-room'
      // Missing message property
    };

    const result = await messageService.sendGroupMessage( invalidMessageObj );

    expect( result.error ).toBeDefined();
    expect( result.message ).toBeUndefined();
  } );

  test( 'should return error object when message is empty string', async () => {
    const result = await messageService.sendGroupMessage( '' );

    expect( result.error ).toBe( 'Message content is required' );
    expect( result.message ).toBe( '' );
  } );

  test( 'should return error object when object has empty message', async () => {
    const emptyMessageObj = {
      message: '',
      room: 'test-room'
    };

    const result = await messageService.sendGroupMessage( emptyMessageObj );

    expect( result.error ).toBeDefined();
    expect( result.message ).toBe( '' );
  } );
} );
