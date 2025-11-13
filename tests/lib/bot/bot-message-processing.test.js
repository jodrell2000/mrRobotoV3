const { Bot } = require( '../../../src/lib/bot.js' );

// Mock ttfm-socket
jest.mock( 'ttfm-socket', () => ( {
  SocketClient: jest.fn().mockImplementation( () => ( {
    joinRoom: jest.fn(),
    on: jest.fn()
  } ) ),
  ServerMessageName: {},
  StatefulServerMessageName: {},
  StatelessServerMessageName: {}
} ) );

// Mock fs promises
jest.mock( 'fs', () => ( {
  promises: {
    appendFile: jest.fn()
  }
} ) );

describe( 'Bot - Message Processing', () => {
  let bot;
  let mockServices;

  beforeEach( () => {
    jest.clearAllMocks();

    mockServices = {
      config: {
        HANGOUT_ID: 'test-hangout-123',
        BOT_USER_TOKEN: 'test-bot-token-456',
        BOT_UID: 'test-bot-uid-789'
      },
      logger: {
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      },
      messageService: {
        joinChat: jest.fn().mockResolvedValue(),
        fetchGroupMessages: jest.fn().mockResolvedValue( [] )
      },
      parseCommands: jest.fn(),
      commandService: jest.fn(),
      updateLastMessageId: jest.fn(),
      getState: jest.fn().mockReturnValue( null )
    };

    bot = new Bot( 'test-slug', mockServices );
  } );

  describe( 'processNewPublicMessages', () => {
    test( 'should process new messages successfully', async () => {
      const mockMessages = [
        { id: 'msg1', sentAt: 1000, sender: 'user1', data: { metadata: { chatMessage: { message: 'Hello' } } } }
      ];

      bot._fetchNewMessages = jest.fn().mockResolvedValue( mockMessages );
      bot._processMessageBatch = jest.fn().mockResolvedValue();

      await bot.processNewPublicMessages();

      expect( bot._fetchNewMessages ).toHaveBeenCalled();
      expect( bot._processMessageBatch ).toHaveBeenCalledWith( mockMessages );
    } );

    test( 'should handle no new messages', async () => {
      bot._fetchNewMessages = jest.fn().mockResolvedValue( [] );
      bot._processMessageBatch = jest.fn();

      await bot.processNewPublicMessages();

      expect( bot._fetchNewMessages ).toHaveBeenCalled();
      expect( bot._processMessageBatch ).not.toHaveBeenCalled();
    } );

    test( 'should handle null/undefined messages', async () => {
      bot._fetchNewMessages = jest.fn().mockResolvedValue( null );
      bot._processMessageBatch = jest.fn();

      await bot.processNewPublicMessages();

      expect( bot._processMessageBatch ).not.toHaveBeenCalled();
    } );

    test( 'should handle errors gracefully', async () => {
      const error = new Error( 'Fetch failed' );
      bot._fetchNewMessages = jest.fn().mockRejectedValue( error );

      await bot.processNewPublicMessages();

      expect( mockServices.logger.error ).toHaveBeenCalledWith( 'Error in processNewPublicMessages: Fetch failed' );
    } );

    test( 'should handle non-Error objects', async () => {
      const errorObj = { custom: 'error', message: 'Custom error message' };
      bot._fetchNewMessages = jest.fn().mockRejectedValue( errorObj );

      await bot.processNewPublicMessages();

      expect( mockServices.logger.error ).toHaveBeenCalledWith( 'Error in processNewPublicMessages: Custom error message' );
    } );

    test( 'should handle primitive error values', async () => {
      bot._fetchNewMessages = jest.fn().mockRejectedValue( 'String error' );

      await bot.processNewPublicMessages();

      expect( mockServices.logger.error ).toHaveBeenCalledWith( 'Error in processNewPublicMessages: String error' );
    } );
  } );

  describe( '_fetchNewMessages', () => {
    test( 'should fetch messages with correct parameters', async () => {
      bot.lastMessageIDs = {
        fromTimestamp: 1000,
        id: 'last-msg-id'
      };

      const mockMessages = [ { id: 'new-msg' } ];
      mockServices.messageService.fetchGroupMessages.mockResolvedValue( mockMessages );

      const result = await bot._fetchNewMessages();

      expect( mockServices.messageService.fetchGroupMessages ).toHaveBeenCalledWith( 'test-hangout-123', {
        fromTimestamp: 1000,
        lastID: 'last-msg-id',
        filterCommands: true,
        services: mockServices
      } );
      expect( result ).toBe( mockMessages );
    } );

    test( 'should handle empty lastMessageIDs', async () => {
      bot.lastMessageIDs = {};

      await bot._fetchNewMessages();

      expect( mockServices.messageService.fetchGroupMessages ).toHaveBeenCalledWith( 'test-hangout-123', {
        fromTimestamp: undefined,
        lastID: undefined,
        filterCommands: true,
        services: mockServices
      } );
    } );
  } );

  describe( '_processMessageBatch', () => {
    test( 'should process each message in batch', async () => {
      const messages = [
        { id: 'msg1' },
        { id: 'msg2' },
        { id: 'msg3' }
      ];

      bot._processSingleMessage = jest.fn().mockResolvedValue();

      await bot._processMessageBatch( messages );

      expect( bot._processSingleMessage ).toHaveBeenCalledTimes( 3 );
      expect( bot._processSingleMessage ).toHaveBeenNthCalledWith( 1, { id: 'msg1' } );
      expect( bot._processSingleMessage ).toHaveBeenNthCalledWith( 2, { id: 'msg2' } );
      expect( bot._processSingleMessage ).toHaveBeenNthCalledWith( 3, { id: 'msg3' } );
    } );
  } );

  describe( '_processSingleMessage', () => {
    test( 'should process valid message', async () => {
      const message = {
        id: 'test-msg',
        sentAt: 1000,
        sender: 'user123',
        data: { metadata: { chatMessage: { message: 'Hello world' } } }
      };

      bot._updateMessageTracking = jest.fn();
      bot._extractChatMessage = jest.fn().mockReturnValue( 'Hello world' );
      bot._shouldIgnoreMessage = jest.fn().mockReturnValue( false );
      bot._handleMessage = jest.fn().mockResolvedValue();

      await bot._processSingleMessage( message );

      expect( bot._updateMessageTracking ).toHaveBeenCalledWith( message );
      expect( bot._extractChatMessage ).toHaveBeenCalledWith( message );
      expect( bot._shouldIgnoreMessage ).toHaveBeenCalledWith( 'user123' );
      // Don't test debug output - it's implementation detail
      expect( bot._handleMessage ).toHaveBeenCalledWith( 'Hello world', 'user123', message );
    } );

    test( 'should skip messages with no chat content', async () => {
      const message = { id: 'test-msg', sentAt: 1000, sender: 'user123' };

      bot._updateMessageTracking = jest.fn();
      bot._extractChatMessage = jest.fn().mockReturnValue( '' );
      bot._shouldIgnoreMessage = jest.fn();
      bot._handleMessage = jest.fn();

      await bot._processSingleMessage( message );

      expect( bot._updateMessageTracking ).toHaveBeenCalledWith( message );
      expect( bot._extractChatMessage ).toHaveBeenCalledWith( message );
      expect( bot._shouldIgnoreMessage ).not.toHaveBeenCalled();
      expect( bot._handleMessage ).not.toHaveBeenCalled();
    } );

    test( 'should skip messages from ignored senders', async () => {
      const message = {
        id: 'test-msg',
        sentAt: 1000,
        sender: 'test-bot-uid-789', // Bot's own UID
        data: { metadata: { chatMessage: { message: 'Bot message' } } }
      };

      bot._updateMessageTracking = jest.fn();
      bot._extractChatMessage = jest.fn().mockReturnValue( 'Bot message' );
      bot._shouldIgnoreMessage = jest.fn().mockReturnValue( true );
      bot._handleMessage = jest.fn();

      await bot._processSingleMessage( message );

      expect( bot._shouldIgnoreMessage ).toHaveBeenCalledWith( 'test-bot-uid-789' );
      expect( bot._handleMessage ).not.toHaveBeenCalled();
    } );

    test( 'should handle missing sender', async () => {
      const message = {
        id: 'test-msg',
        sentAt: 1000,
        data: { metadata: { chatMessage: { message: 'Hello' } } }
      };

      bot._updateMessageTracking = jest.fn();
      bot._extractChatMessage = jest.fn().mockReturnValue( 'Hello' );
      bot._shouldIgnoreMessage = jest.fn().mockReturnValue( false );
      bot._handleMessage = jest.fn().mockResolvedValue();

      await bot._processSingleMessage( message );

      expect( bot._shouldIgnoreMessage ).toHaveBeenCalledWith( '' );
      expect( bot._handleMessage ).toHaveBeenCalledWith( 'Hello', '', message );
    } );

    test( 'should extract sender UUID from object with uid property', async () => {
      const message = {
        id: 'test-msg',
        sentAt: 1000,
        sender: { uid: 'user-uuid-123' },
        data: { metadata: { chatMessage: { message: 'Hello' } } }
      };

      bot._updateMessageTracking = jest.fn();
      bot._extractChatMessage = jest.fn().mockReturnValue( 'Hello' );
      bot._shouldIgnoreMessage = jest.fn().mockReturnValue( false );
      bot._handleMessage = jest.fn().mockResolvedValue();

      await bot._processSingleMessage( message );

      expect( bot._shouldIgnoreMessage ).toHaveBeenCalledWith( 'user-uuid-123' );
      expect( bot._handleMessage ).toHaveBeenCalledWith( 'Hello', 'user-uuid-123', message );
    } );

    test( 'should handle sender as direct string', async () => {
      const message = {
        id: 'test-msg',
        sentAt: 1000,
        sender: 'user-uuid-456',
        data: { metadata: { chatMessage: { message: 'Hello' } } }
      };

      bot._updateMessageTracking = jest.fn();
      bot._extractChatMessage = jest.fn().mockReturnValue( 'Hello' );
      bot._shouldIgnoreMessage = jest.fn().mockReturnValue( false );
      bot._handleMessage = jest.fn().mockResolvedValue();

      await bot._processSingleMessage( message );

      expect( bot._shouldIgnoreMessage ).toHaveBeenCalledWith( 'user-uuid-456' );
      expect( bot._handleMessage ).toHaveBeenCalledWith( 'Hello', 'user-uuid-456', message );
    } );
  } );

  describe( '_updateMessageTracking', () => {
    test( 'should update tracking with message details', () => {
      const message = {
        id: 'msg-123',
        sentAt: 1500
      };

      bot._updateMessageTracking( message );

      expect( mockServices.updateLastMessageId ).toHaveBeenCalledWith( 'msg-123' );
      expect( bot.lastMessageIDs.fromTimestamp ).toBe( 1501 ); // sentAt + 1
      expect( bot.lastMessageIDs.id ).toBe( 'msg-123' );
    } );
  } );

  describe( '_extractChatMessage', () => {
    test( 'should extract chat message from valid structure', () => {
      const message = {
        data: {
          metadata: {
            chatMessage: {
              message: 'Hello world!'
            }
          }
        }
      };

      const result = bot._extractChatMessage( message );
      expect( result ).toBe( 'Hello world!' );
    } );

    test( 'should return empty string for missing structure', () => {
      const cases = [
        {},
        { data: {} },
        { data: { metadata: {} } },
        { data: { metadata: { chatMessage: {} } } },
        { data: { metadata: { chatMessage: { message: null } } } }
      ];

      cases.forEach( message => {
        const result = bot._extractChatMessage( message );
        expect( result ).toBe( '' );
      } );
    } );
  } );

  describe( '_shouldIgnoreMessage', () => {
    test( 'should ignore bot own messages', () => {
      const result = bot._shouldIgnoreMessage( 'test-bot-uid-789' );
      expect( result ).toBe( true );
    } );

    test( 'should not ignore other users', () => {
      const result = bot._shouldIgnoreMessage( 'user123' );
      expect( result ).toBe( false );
    } );

    test( 'should handle undefined/null senders', () => {
      expect( bot._shouldIgnoreMessage( null ) ).toBe( false );
      expect( bot._shouldIgnoreMessage( undefined ) ).toBe( false );
      expect( bot._shouldIgnoreMessage( '' ) ).toBe( false );
    } );
  } );

  describe( '_handleMessage', () => {
    test( 'should process command messages', async () => {
      const parseResult = {
        isCommand: true,
        command: 'test',
        remainder: 'args'
      };

      mockServices.parseCommands.mockResolvedValue( parseResult );
      mockServices.commandService.mockResolvedValue( { success: true } );

      await bot._handleMessage( '!test args', 'user123', { id: 'msg1' } );

      expect( mockServices.parseCommands ).toHaveBeenCalledWith( '!test args', mockServices );
      // Don't test debug output - it's implementation detail

      expect( mockServices.commandService ).toHaveBeenCalledWith(
        'test',
        'args',
        mockServices,
        {
          sender: 'user123',
          fullMessage: { id: 'msg1' },
          chatMessage: '!test args'
        }
      );
    } );

    test( 'should handle non-command messages', async () => {
      const parseResult = {
        isCommand: false
      };

      mockServices.parseCommands.mockResolvedValue( parseResult );

      await bot._handleMessage( 'Just a regular message', 'user123', { id: 'msg1' } );

      expect( mockServices.parseCommands ).toHaveBeenCalledWith( 'Just a regular message', mockServices );
      expect( mockServices.commandService ).not.toHaveBeenCalled();
    } );

    test( 'should handle missing parseCommands service', async () => {
      mockServices.parseCommands = null;

      await bot._handleMessage( 'test message', 'user123', { id: 'msg1' } );

      // Check that warning was logged (don't test exact message format)
      expect( mockServices.logger.warn ).toHaveBeenCalledWith( expect.stringContaining( 'parseCommands is not a function' ) );
    } );

    test( 'should handle missing commandService', async () => {
      const parseResult = { isCommand: true, command: 'test', remainder: 'args' };
      mockServices.parseCommands.mockResolvedValue( parseResult );
      mockServices.commandService = 'not-a-function';

      await bot._handleMessage( '!test args', 'user123', { id: 'msg1' } );

      // Check that warning was logged (don't test exact message format)
      expect( mockServices.logger.warn ).toHaveBeenCalledWith( expect.stringContaining( 'commandService is not available' ) );
    } );

    test( 'should handle parseCommands errors and re-throw', async () => {
      const error = new Error( 'Parse error' );
      mockServices.parseCommands.mockRejectedValue( error );

      await expect( bot._handleMessage( 'test', 'user123', { id: 'msg1' } ) ).rejects.toThrow( 'Parse error' );

      expect( mockServices.logger.error ).toHaveBeenCalledWith( 'Error in _handleMessage: Parse error' );
      expect( mockServices.logger.error ).toHaveBeenCalledWith( `Error stack: ${ error.stack }` );
    } );

    test( 'should handle non-Error objects in _handleMessage', async () => {
      const errorObj = { message: 'Custom error' };
      mockServices.parseCommands.mockRejectedValue( errorObj );

      // The function should still re-throw the error
      await expect( bot._handleMessage( 'test', 'user123', { id: 'msg1' } ) ).rejects.toEqual( errorObj );

      expect( mockServices.logger.error ).toHaveBeenCalledWith( 'Error in _handleMessage: Custom error' );
    } );
  } );

  describe( '_fetchNewPrivateMessages', () => {
    beforeEach( () => {
      // Add required services for private message fetching
      mockServices.stateService = {
        _getAllUsers: jest.fn()
      };
      mockServices.privateMessageService = {
        fetchNewPrivateUserMessages: jest.fn()
      };
      mockServices.setState = jest.fn();

      // Initialize bot with private message tracking
      bot.lastPrivateMessageTracking = {};
    } );

    test( 'should fetch messages with correct parameters', async () => {
      const mockUsers = [
        { uuid: 'user1' },
        { uuid: 'user2' },
        { uuid: 'test-bot-uid-789' } // This should be skipped (bot's own UID)
      ];

      const mockUserMessages = [
        {
          id: 'pm1',
          text: 'Hello bot!',
          sender: 'user1',
          sentAt: 1609459200000
        }
      ];

      mockServices.stateService._getAllUsers.mockReturnValue( mockUsers );
      mockServices.privateMessageService.fetchNewPrivateUserMessages
        .mockResolvedValueOnce( mockUserMessages ) // user1
        .mockResolvedValueOnce( [] ); // user2

      const result = await bot._fetchNewPrivateMessages();

      expect( mockServices.stateService._getAllUsers ).toHaveBeenCalled();
      expect( mockServices.privateMessageService.fetchNewPrivateUserMessages ).toHaveBeenCalledTimes( 2 );
      expect( mockServices.privateMessageService.fetchNewPrivateUserMessages ).toHaveBeenCalledWith( 'user1', {
        lastMessageId: undefined,
        lastTimestamp: undefined,
        logLastMessage: false,
        returnData: true
      } );
      expect( mockServices.privateMessageService.fetchNewPrivateUserMessages ).toHaveBeenCalledWith( 'user2', {
        lastMessageId: undefined,
        lastTimestamp: undefined,
        logLastMessage: false,
        returnData: true
      } );

      // Should return transformed messages
      expect( result ).toHaveLength( 1 );
      expect( result[ 0 ] ).toMatchObject( {
        id: 'pm1',
        sentAt: 1609459200000,
        sender: 'user1',
        isPrivateMessage: true,
        recipientUUID: 'user1',
        data: {
          metadata: {
            chatMessage: {
              message: 'Hello bot!',
              userUuid: 'user1'
            }
          }
        }
      } );
    } );

    test( 'should handle empty users list', async () => {
      mockServices.stateService._getAllUsers.mockReturnValue( [] );

      const result = await bot._fetchNewPrivateMessages();

      expect( result ).toEqual( [] );
      expect( mockServices.privateMessageService.fetchNewPrivateUserMessages ).not.toHaveBeenCalled();
    } );

    test( 'should pass tracking info to fetchNewPrivateUserMessages', async () => {
      const mockUsers = [ { uuid: 'user1' } ];
      const mockUserMessages = [
        { id: 'pm2', text: 'New message', sender: 'user1', sentAt: 1609459300000 }
      ];

      // Set last processed message tracking for user1
      bot.lastPrivateMessageTracking[ 'user1' ] = {
        lastMessageId: 'pm1',
        lastTimestamp: 1609459200000
      };

      mockServices.stateService._getAllUsers.mockReturnValue( mockUsers );
      mockServices.privateMessageService.fetchNewPrivateUserMessages.mockResolvedValue( mockUserMessages );

      const result = await bot._fetchNewPrivateMessages();

      // Should call with tracking info passed to the service
      expect( mockServices.privateMessageService.fetchNewPrivateUserMessages ).toHaveBeenCalledWith( 'user1', {
        lastMessageId: 'pm1',
        lastTimestamp: 1609459200000,
        logLastMessage: false,
        returnData: true
      } );

      // Should return the new message
      expect( result ).toHaveLength( 1 );
      expect( result[ 0 ].id ).toBe( 'pm2' );
    } );

    test( 'should handle errors for individual users gracefully', async () => {
      const mockUsers = [
        { uuid: 'user1' },
        { uuid: 'user2' }
      ];

      mockServices.stateService._getAllUsers.mockReturnValue( mockUsers );
      mockServices.privateMessageService.fetchNewPrivateUserMessages
        .mockRejectedValueOnce( new Error( 'API error for user1' ) )
        .mockResolvedValueOnce( [
          { id: 'pm2', text: 'Message from user2', sender: 'user2', sentAt: 1609459200000 }
        ] );

      const result = await bot._fetchNewPrivateMessages();

      // Check that warning was logged (don't test exact message format)
      expect( mockServices.logger.warn ).toHaveBeenCalledWith( expect.stringContaining( 'Failed to fetch private messages for user user1' ) );

      // Should still return messages from user2
      expect( result ).toHaveLength( 1 );
      expect( result[ 0 ].sender ).toBe( 'user2' );
    } );

    test( 'should handle service errors gracefully', async () => {
      mockServices.stateService._getAllUsers.mockImplementation( () => {
        throw new Error( 'State service error' );
      } );

      const result = await bot._fetchNewPrivateMessages();

      expect( result ).toEqual( [] );
      // Check that error was logged (don't test exact message format)
      expect( mockServices.logger.error ).toHaveBeenCalledWith( expect.stringContaining( 'Error in _fetchNewPrivateMessages' ) );
    } );
  } );
} );
