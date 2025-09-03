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
      expect( mockServices.logger.error ).toHaveBeenCalledWith( `Error stack: ${ error.stack }` );
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
        filterCommands: true
      } );
      expect( result ).toBe( mockMessages );
    } );

    test( 'should handle empty lastMessageIDs', async () => {
      bot.lastMessageIDs = {};

      await bot._fetchNewMessages();

      expect( mockServices.messageService.fetchGroupMessages ).toHaveBeenCalledWith( 'test-hangout-123', {
        fromTimestamp: undefined,
        lastID: undefined,
        filterCommands: true
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
      expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'Processing message: "Hello world" from user123' );
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
      expect( mockServices.logger.debug ).toHaveBeenCalledWith( `parseCommands result: ${ JSON.stringify( parseResult ) }` );
      expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'Command detected: "test" with remainder: "args"' );

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

      expect( mockServices.logger.warn ).toHaveBeenCalledWith( 'parseCommands is not a function: object' );
    } );

    test( 'should handle missing commandService', async () => {
      const parseResult = { isCommand: true, command: 'test', remainder: 'args' };
      mockServices.parseCommands.mockResolvedValue( parseResult );
      mockServices.commandService = 'not-a-function';

      await bot._handleMessage( '!test args', 'user123', { id: 'msg1' } );

      expect( mockServices.logger.warn ).toHaveBeenCalledWith( 'commandService is not available: string' );
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
} );
