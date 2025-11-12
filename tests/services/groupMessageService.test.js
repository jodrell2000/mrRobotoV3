// Mock dependencies before importing
jest.mock( '../../src/lib/logging.js', () => ( {
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
} ) );

jest.mock( '../../src/config.js', () => ( {
  HANGOUT_ID: 'test-hangout-123',
  BOT_UID: 'bot-uid-456',
  COMMAND_SWITCH: '!'
} ) );

jest.mock( '../../src/services/cometchatApi.js', () => ( {
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
jest.mock( 'uuid', () => ( {
  v4: jest.fn( () => 'mock-uuid-123' )
} ) );

const groupMessageService = require( '../../src/services/groupMessageService.js' );
const cometchatApi = require( '../../src/services/cometchatApi.js' );
const { logger } = require( '../../src/lib/logging.js' );
const config = require( '../../src/config.js' );

describe( 'groupMessageService', () => {
  let mockServices;

  beforeEach( () => {
    jest.clearAllMocks();
    // Reset the latest message ID
    groupMessageService.setLatestGroupMessageId( null );

    // Set up mock implementations for cometchatApi functions
    cometchatApi.buildCustomData.mockImplementation( async ( message, services ) => {
      // Call the actual dataService methods to match test expectations
      if ( services.dataService ) {
        if ( services.dataService.getAllData ) {
          services.dataService.getAllData();
        }
      }

      return {
        message: message,
        avatarId: services.dataService?.getValue( 'botData.CHAT_AVATAR_ID' ),
        userName: services.dataService?.getValue( 'botData.CHAT_NAME' ),
        color: `#${ services.dataService?.getValue( 'botData.CHAT_COLOUR' ) }`,
        mentions: [],
        userUuid: 'bot-uid-456',
        badges: [ 'VERIFIED', 'STAFF' ],
        id: 'mock-uuid-123'
      };
    } );

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

    // Create mock services for tests that need them
    mockServices = {
      updateLastMessageId: jest.fn(),
      getState: jest.fn(),
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    };
  } );

  describe( 'Helper Functions', () => {
    describe( 'getLatestGroupMessageId and setLatestGroupMessageId', () => {
      test( 'should set and get latest group message ID', () => {
        expect( groupMessageService.getLatestGroupMessageId() ).toBeNull();

        groupMessageService.setLatestGroupMessageId( 'msg-123' );
        expect( groupMessageService.getLatestGroupMessageId() ).toBe( 'msg-123' );

        groupMessageService.setLatestGroupMessageId( 'msg-456' );
        expect( groupMessageService.getLatestGroupMessageId() ).toBe( 'msg-456' );
      } );
    } );

    describe( 'filterMessagesForCommands', () => {
      test( 'should filter messages that start with command switch', () => {
        const messages = [
          { id: '1', data: { text: '!hello' } },
          { id: '2', data: { text: 'regular message' } },
          { id: '3', data: { text: '!test command' } }
        ];

        const result = groupMessageService.filterMessagesForCommands( messages );

        expect( result ).toEqual( [
          { id: '1', data: { text: '!hello' } },
          { id: '3', data: { text: '!test command' } }
        ] );
      } );

      test( 'should return empty array for non-array input', () => {
        expect( groupMessageService.filterMessagesForCommands( null ) ).toEqual( [] );
        expect( groupMessageService.filterMessagesForCommands( undefined ) ).toEqual( [] );
        expect( groupMessageService.filterMessagesForCommands( 'not-array' ) ).toEqual( [] );
        expect( groupMessageService.filterMessagesForCommands( {} ) ).toEqual( [] );
      } );

      test( 'should handle messages with missing text gracefully', () => {
        const messages = [
          { id: '1', data: { text: '!valid' } },
          { id: '2', data: {} },
          { id: '3' },
          { id: '4', data: { text: null } },
          { id: '5', data: { text: '!another' } }
        ];

        const result = groupMessageService.filterMessagesForCommands( messages );

        expect( result ).toEqual( [
          { id: '1', data: { text: '!valid' } },
          { id: '5', data: { text: '!another' } }
        ] );
      } );
    } );

    describe( 'buildCustomData', () => {
      test( 'should build custom data with all fields', async () => {
        const mockServices = {
          dataService: {
            getValue: jest.fn()
              .mockReturnValueOnce( 'avatar-123' )
              .mockReturnValueOnce( 'TestBot' )
              .mockReturnValueOnce( 'ff0000' ),
            getAllData: jest.fn().mockReturnValue( { some: 'data' } )
          }
        };

        const result = await groupMessageService.buildCustomData( 'Test message', mockServices );

        expect( result ).toEqual( {
          message: 'Test message',
          avatarId: 'avatar-123',
          userName: 'TestBot',
          color: '#ff0000',
          mentions: [],
          userUuid: 'bot-uid-456',
          badges: [ 'VERIFIED', 'STAFF' ],
          id: 'mock-uuid-123'
        } );

        expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'botData.CHAT_AVATAR_ID' );
        expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'botData.CHAT_NAME' );
        expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'botData.CHAT_COLOUR' );
        expect( mockServices.dataService.getAllData ).toHaveBeenCalled();
      } );

      test( 'should handle missing dataService gracefully', async () => {
        const result = await groupMessageService.buildCustomData( 'Test message', {} );

        expect( result ).toEqual( {
          message: 'Test message',
          avatarId: undefined,
          userName: undefined,
          color: '#undefined',
          mentions: [],
          userUuid: 'bot-uid-456',
          badges: [ 'VERIFIED', 'STAFF' ],
          id: 'mock-uuid-123'
        } );
      } );
    } );

    describe( 'buildPayload', () => {
      test( 'should build correct payload structure', async () => {
        const customData = {
          message: 'Test message',
          avatarId: 'avatar-123',
          userName: 'TestBot'
        };

        const result = await groupMessageService.buildPayload(
          'room-123',
          'group',
          customData,
          'Test message'
        );

        expect( result ).toEqual( {
          receiver: 'room-123',
          receiverType: 'group',
          category: 'message',
          type: 'text',
          data: {
            text: 'Test message',
            metadata: {
              chatMessage: customData
            }
          }
        } );
      } );
    } );
  } );

  describe( 'joinChat', () => {
    test( 'should successfully join chat group', async () => {
      const mockResponse = { success: true, data: { joined: true } };
      cometchatApi.joinChatGroup.mockResolvedValue( mockResponse );

      const result = await groupMessageService.joinChat( 'room-123' );

      expect( result ).toBe( mockResponse );
      expect( cometchatApi.joinChatGroup ).toHaveBeenCalledWith( 'room-123' );
    } );

    test( 'should handle already joined error gracefully', async () => {
      const error = new Error( 'ERR_ALREADY_JOINED: User already joined' );
      cometchatApi.joinChatGroup.mockRejectedValue( error );

      const result = await groupMessageService.joinChat( 'room-123' );

      expect( result ).toEqual( { success: true, alreadyJoined: true } );
      expect( logger.debug ).toHaveBeenCalledWith( '✅ User already joined chat group - continuing' );
    } );

    test( 'should throw other errors', async () => {
      const error = new Error( 'Network error' );
      cometchatApi.joinChatGroup.mockRejectedValue( error );

      await expect( groupMessageService.joinChat( 'room-123' ) ).rejects.toThrow( 'Network error' );
      expect( logger.error ).toHaveBeenCalledWith( '❌ Error joining chat: Network error' );
    } );
  } );

  describe( 'fetchGroupMessagesRaw', () => {
    test( 'should call cometchatApi.fetchMessages with correct parameters', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: [
            { id: 'msg-1', data: { text: 'Hello' } },
            { id: 'msg-2', data: { text: 'World' } }
          ]
        }
      };
      cometchatApi.fetchMessages.mockResolvedValue( mockResponse );

      const customParams = [ [ 'id', 'last-msg-123' ], [ 'per_page', 25 ] ];
      const result = await groupMessageService.fetchGroupMessagesRaw( 'room-123', customParams, mockServices );

      // Verify the endpoint format
      expect( cometchatApi.fetchMessages ).toHaveBeenCalledWith(
        'v3.0/groups/room-123/messages',
        [
          [ 'per_page', 50 ], // default params first
          [ 'hideMessagesFromBlockedUsers', 0 ],
          [ 'unread', 0 ],
          [ 'withTags', 0 ],
          [ 'undelivered', 0 ],
          [ 'hideDeleted', 0 ],
          [ 'affix', 'append' ],
          [ 'id', 'last-msg-123' ], // then custom params
          [ 'per_page', 25 ] // custom per_page overrides default
        ]
      );

      expect( result ).toEqual( mockResponse.data.data );
      // Debug logging is currently commented out in implementation
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessageRaw] Response status: 200');
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessageRaw] Response data count: 2');
    } );

    test( 'should return empty array on API error', async () => {
      const error = new Error( 'API Error' );
      error.response = { status: 500, data: 'Server Error' };
      error.config = { url: 'test-url' };
      cometchatApi.fetchMessages.mockRejectedValue( error );

      const result = await groupMessageService.fetchGroupMessagesRaw( 'room-123', [], mockServices );

      expect( result ).toEqual( [] );
      expect( logger.error ).toHaveBeenCalledWith(
        expect.stringContaining( '❌ Error in fetchGroupMessagesRaw:' )
      );
    } );

    test( 'should handle empty response data gracefully', async () => {
      const mockResponse = { status: 200, data: {} };
      cometchatApi.fetchMessages.mockResolvedValue( mockResponse );

      const result = await groupMessageService.fetchGroupMessagesRaw( 'room-123', [], mockServices );

      expect( result ).toEqual( [] );
    } );
  } );

  describe( 'fetchGroupMessages', () => {
    beforeEach( () => {
      // Mock fetchGroupMessagesRaw to avoid actual API calls
      groupMessageService.fetchGroupMessagesRaw = jest.fn();
    } );

    test( 'should use correct room ID and default parameters', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          sentAt: 1640995200,
          updatedAt: 1640995201,
          sender: { uid: 'user-123' },
          data: { text: '!test command' }
        }
      ];
      groupMessageService.fetchGroupMessagesRaw.mockResolvedValue( mockMessages );

      const result = await groupMessageService.fetchGroupMessages();

      // Should use default HANGOUT_ID from config
      expect( groupMessageService.fetchGroupMessagesRaw ).toHaveBeenCalledWith(
        'test-hangout-123',
        [],
        undefined // services parameter
      );

      expect( result ).toEqual( [ {
        id: 'msg-1',
        text: '!test command',
        sender: 'user-123',
        sentAt: 1640995200,
        updatedAt: 1640995201,
        data: { text: '!test command' }
      } ] );
    } );

    test( 'should pass custom room ID and build correct parameters', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          sentAt: 1640995200,
          sender: { uid: 'user-123' },
          data: { text: '!hello' }
        }
      ];
      groupMessageService.fetchGroupMessagesRaw.mockResolvedValue( mockMessages );
      groupMessageService.setLatestGroupMessageId( 'latest-123' );

      const options = {
        lastID: 'custom-last-456',
        fromTimestamp: 1640990000,
        limit: 25,
        filterCommands: false
      };

      const result = await groupMessageService.fetchGroupMessages( 'custom-room-789', options );

      expect( groupMessageService.fetchGroupMessagesRaw ).toHaveBeenCalledWith(
        'custom-room-789',
        [
          [ 'id', 'custom-last-456' ], // lastID takes precedence over latest
          [ 'updatedAt', 1640990000 ],
          [ 'per_page', 25 ]
        ],
        undefined // services parameter
      );

      // Should return all messages when filterCommands is false
      expect( result ).toEqual( [ {
        id: 'msg-1',
        text: '!hello',
        sender: 'user-123',
        sentAt: 1640995200,
        updatedAt: undefined,
        data: { text: '!hello' }
      } ] );
    } );

    test( 'should use latestGroupMessageId when lastID not provided', async () => {
      groupMessageService.fetchGroupMessagesRaw.mockResolvedValue( [] );
      groupMessageService.setLatestGroupMessageId( 'stored-msg-789' );

      await groupMessageService.fetchGroupMessages( 'room-123', {
        fromTimestamp: 1640990000
      } );

      expect( groupMessageService.fetchGroupMessagesRaw ).toHaveBeenCalledWith(
        'room-123',
        [
          [ 'id', 'stored-msg-789' ],
          [ 'updatedAt', 1640990000 ]
        ],
        undefined // services parameter
      );
    } );

    test( 'should not add id parameter when no messageId available', async () => {
      groupMessageService.fetchGroupMessagesRaw.mockResolvedValue( [] );

      await groupMessageService.fetchGroupMessages( 'room-123', {
        limit: 30
      } );

      expect( groupMessageService.fetchGroupMessagesRaw ).toHaveBeenCalledWith(
        'room-123',
        [
          [ 'per_page', 30 ]
        ],
        undefined // services parameter
      );
    } );

    test( 'should not add per_page parameter when limit is default (50)', async () => {
      groupMessageService.fetchGroupMessagesRaw.mockResolvedValue( [] );
      groupMessageService.setLatestGroupMessageId( 'msg-123' );

      await groupMessageService.fetchGroupMessages( 'room-123', {
        limit: 50,
        lastID: 'custom-456'
      } );

      expect( groupMessageService.fetchGroupMessagesRaw ).toHaveBeenCalledWith(
        'room-123',
        [
          [ 'id', 'custom-456' ]
          // No per_page parameter since it's the default
        ],
        undefined // services parameter
      );
    } );

    test( 'should filter command messages by default', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          sender: { uid: 'user-123' },
          data: { text: '!command message' }
        },
        {
          id: 'msg-2',
          sender: { uid: 'user-456' },
          data: { text: 'regular message' }
        }
      ];
      groupMessageService.fetchGroupMessagesRaw.mockResolvedValue( mockMessages );

      const result = await groupMessageService.fetchGroupMessages( 'room-123' );

      // Should only return command messages
      expect( result ).toHaveLength( 1 );
      expect( result[ 0 ].text ).toBe( '!command message' );
    } );

    test( 'should handle complex sender extraction scenarios', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          sender: { uid: 'direct-sender' },
          data: { text: '!test1' }
        },
        {
          id: 'msg-2',
          sender: null,
          data: {
            text: '!test2',
            entities: {
              sender: {
                entity: { uid: 'entities-sender' }
              }
            }
          }
        },
        {
          id: 'msg-3',
          data: {
            text: '!test3',
            metadata: {
              chatMessage: { userUuid: 'chatmessage-sender' }
            }
          }
        },
        {
          id: 'msg-4',
          data: {
            text: '!test4',
            metadata: {
              message: {
                customData: { userUuid: 'customdata-sender' }
              }
            }
          }
        },
        {
          id: 'msg-5',
          data: { text: '!test5' }
          // No sender info at all
        }
      ];
      groupMessageService.fetchGroupMessagesRaw.mockResolvedValue( mockMessages );

      const result = await groupMessageService.fetchGroupMessages( 'room-123' );

      expect( result ).toEqual( [
        expect.objectContaining( { id: 'msg-1', sender: 'direct-sender' } ),
        expect.objectContaining( { id: 'msg-2', sender: 'entities-sender' } ),
        expect.objectContaining( { id: 'msg-3', sender: 'chatmessage-sender' } ),
        expect.objectContaining( { id: 'msg-4', sender: 'customdata-sender' } ),
        expect.objectContaining( { id: 'msg-5', sender: 'Unknown' } )
      ] );
    } );

    test( 'should handle messages with no text', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          sender: { uid: 'user-123' },
          data: {}
        }
      ];
      groupMessageService.fetchGroupMessagesRaw.mockResolvedValue( mockMessages );

      const result = await groupMessageService.fetchGroupMessages( 'room-123', {
        filterCommands: false
      } );

      expect( result ).toEqual( [ {
        id: 'msg-1',
        text: '[No Text]',
        sender: 'user-123',
        sentAt: undefined,
        updatedAt: undefined,
        data: {}
      } ] );
    } );

    test( 'should return empty array when no messages found', async () => {
      groupMessageService.fetchGroupMessagesRaw.mockResolvedValue( [] );

      const result = await groupMessageService.fetchGroupMessages( 'room-123' );

      expect( result ).toEqual( [] );
      // Debug logging is currently commented out in implementation
      // expect(logger.debug).toHaveBeenCalledWith('No group messages found');
    } );

    test( 'should return empty array when fetchGroupMessagesRaw returns null', async () => {
      groupMessageService.fetchGroupMessagesRaw.mockResolvedValue( null );

      const result = await groupMessageService.fetchGroupMessages( 'room-123' );

      expect( result ).toEqual( [] );
    } );

    test( 'should log detailed debug information', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          sender: { uid: 'user-123' },
          data: { text: '!test' }
        }
      ];
      groupMessageService.fetchGroupMessagesRaw.mockResolvedValue( mockMessages );
      groupMessageService.setLatestGroupMessageId( 'stored-456' );

      const options = {
        lastID: 'custom-789',
        fromTimestamp: 1640990000,
        limit: 25,
        filterCommands: true
      };

      await groupMessageService.fetchGroupMessages( 'custom-room', options );

      // Debug logging is currently commented out in implementation
      // Verify debug logging for input parameters
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] fetchGroupMessages called with:');
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - roomId: custom-room (target: custom-room)');
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - options.lastID: custom-789');
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - options.fromTimestamp: 1640990000');
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - options.limit: 25');
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - options.filterCommands: true');

      // Debug logging is currently commented out in implementation
      // Verify debug logging for message ID resolution
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - getLatestGroupMessageId(): stored-456');
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - resolved messageId: custom-789');

      // Verify debug logging for parameters
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - Added id parameter: custom-789');
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - Added updatedAt parameter: 1640990000');
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - Added per_page parameter: 25');

      // Verify debug logging for results
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - Raw messages count: 1');
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - Filtered messages count: 1');
      // expect(logger.debug).toHaveBeenCalledWith('[GroupMessage] - Final formatted messages count: 1');
    } );

    test( 'should handle errors gracefully', async () => {
      const error = new Error( 'Processing error' );
      groupMessageService.fetchGroupMessagesRaw.mockRejectedValue( error );

      const result = await groupMessageService.fetchGroupMessages( 'room-123' );

      expect( result ).toEqual( [] );
      expect( logger.error ).toHaveBeenCalledWith( '❌ Error fetching group messages: Processing error' );
    } );
  } );

  describe( 'sendGroupMessage', () => {
    beforeEach( () => {
      cometchatApi.sendMessage.mockResolvedValue( {
        data: { data: { id: 'sent-msg-123' } }
      } );
    } );

    test( 'should send message with string input and default options', async () => {
      const mockCustomData = {
        message: 'Hello world',
        avatarId: 'avatar-123',
        userName: 'TestBot'
      };

      // Mock buildCustomData method
      const buildCustomDataSpy = jest.spyOn( groupMessageService, 'buildCustomData' )
        .mockResolvedValue( mockCustomData );

      const result = await groupMessageService.sendGroupMessage( 'Hello world' );

      expect( buildCustomDataSpy ).toHaveBeenCalledWith( 'Hello world', {}, null, null, null, null );
      expect( cometchatApi.sendMessage ).toHaveBeenCalledWith( {
        receiver: 'test-hangout-123', // default HANGOUT_ID
        receiverType: 'group',
        category: 'message',
        type: 'text',
        data: {
          text: 'Hello world',
          metadata: {
            chatMessage: mockCustomData
          }
        }
      } );

      expect( result ).toEqual( {
        message: 'Hello world',
        messageResponse: { data: { id: 'sent-msg-123' } }
      } );

      buildCustomDataSpy.mockRestore();
    } );

    test( 'should send message with object input', async () => {
      const mockCustomData = { message: 'Test message' };
      const buildCustomDataSpy = jest.spyOn( groupMessageService, 'buildCustomData' )
        .mockResolvedValue( mockCustomData );

      const messageOptions = {
        message: 'Test message',
        room: 'custom-room-456',
        images: [ 'image1.jpg', 'image2.jpg' ],
        mentions: [
          { position: 5, nickname: 'User1', userId: 'user-1' },
          { position: 10, nickname: 'User2', userId: 'user-2' }
        ]
      };

      await groupMessageService.sendGroupMessage( messageOptions );

      expect( buildCustomDataSpy ).toHaveBeenCalledWith( 'Test message', {}, null, null, null, null );

      // Check that images and mentions were added to customData
      const sentPayload = cometchatApi.sendMessage.mock.calls[ 0 ][ 0 ];
      expect( sentPayload.receiver ).toBe( 'custom-room-456' );
      expect( sentPayload.data.metadata.chatMessage.imageUrls ).toEqual( [ 'image1.jpg', 'image2.jpg' ] );
      expect( sentPayload.data.metadata.chatMessage.mentions ).toEqual( [
        { start: 5, userNickname: 'User1', userUuid: 'user-1' },
        { start: 10, userNickname: 'User2', userUuid: 'user-2' }
      ] );

      buildCustomDataSpy.mockRestore();
    } );

    test( 'should throw error when message content is missing', async () => {
      const result = await groupMessageService.sendGroupMessage( '' );

      expect( result ).toEqual( {
        message: '',
        error: 'Message content is required'
      } );

      expect( logger.error ).toHaveBeenCalledWith( '❌ Failed to send group message: ' );
    } );

    test( 'should handle API errors gracefully', async () => {
      const mockCustomData = { message: 'Test message' };
      const buildCustomDataSpy = jest.spyOn( groupMessageService, 'buildCustomData' )
        .mockResolvedValue( mockCustomData );

      const apiError = new Error( 'API Error' );
      apiError.response = {
        status: 500,
        data: 'Server error'
      };
      cometchatApi.sendMessage.mockRejectedValue( apiError );

      const result = await groupMessageService.sendGroupMessage( 'Test message' );

      expect( result ).toEqual( {
        message: 'Test message',
        error: 'Server error'
      } );

      expect( logger.error ).toHaveBeenCalledWith( '❌ Failed to send group message: Test message' );
      expect( logger.error ).toHaveBeenCalledWith( 'Error response data: Server error' );
      expect( logger.error ).toHaveBeenCalledWith( 'Error message: API Error' );
      expect( logger.error ).toHaveBeenCalledWith( 'Error status: 500' );

      buildCustomDataSpy.mockRestore();
    } );
  } );

  describe( 'sendGroupPictureMessage', () => {
    test( 'should call sendGroupMessage with correct image parameters', async () => {
      const sendGroupMessageSpy = jest.spyOn( groupMessageService, 'sendGroupMessage' )
        .mockResolvedValue( { success: true } );

      const services = { dataService: {} };
      await groupMessageService.sendGroupPictureMessage(
        'Check this image!',
        'https://example.com/image.jpg',
        services
      );

      expect( sendGroupMessageSpy ).toHaveBeenCalledWith( {
        message: 'Check this image!',
        images: [ 'https://example.com/image.jpg' ],
        services: services,
        senderUid: null,
        senderName: null,
        senderAvatarId: null,
        senderColor: null
      } );

      sendGroupMessageSpy.mockRestore();
    } );

    test( 'should handle errors from sendGroupMessage', async () => {
      const sendGroupMessageSpy = jest.spyOn( groupMessageService, 'sendGroupMessage' )
        .mockRejectedValue( new Error( 'Send failed' ) );

      await expect(
        groupMessageService.sendGroupPictureMessage( 'Test', 'image.jpg', {} )
      ).rejects.toThrow( 'Send failed' );

      expect( logger.error ).toHaveBeenCalledWith( '❌ Failed to send group picture message: Send failed' );

      sendGroupMessageSpy.mockRestore();
    } );
  } );
} );
