const { Bot } = require( '../../../src/lib/bot' );
const { applyPatch } = require( 'fast-json-patch' );

// Mock dependencies
jest.mock( 'fs', () => ( {
  promises: {
    appendFile: jest.fn()
  }
} ) );

const mockServices = {
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  },
  messageService: {
    joinChat: jest.fn(),
    fetchGroupMessages: jest.fn()
  },
  config: {
    HANGOUT_ID: 'test-hangout',
    BOT_USER_TOKEN: 'test-token',
    BOT_UID: 'bot-123',
    SOCKET_MESSAGE_LOG_LEVEL: 'ON' // Add this required config
  },
  updateLastMessageId: jest.fn()
};

describe( 'Bot - State Patching', () => {
  let bot;
  let mockSocket;

  beforeEach( () => {
    jest.clearAllMocks();

    bot = new Bot( 'test-slug', mockServices );

    mockSocket = {
      on: jest.fn(),
      joinRoom: jest.fn(),
      emit: jest.fn()
    };

    bot.socket = mockSocket;

    // Set initial state
    bot.state = {
      room: {
        name: 'Test Room',
        users: [
          { id: 'user1', name: 'User One' },
          { id: 'user2', name: 'User Two' }
        ]
      },
      currentSong: {
        id: 'song1',
        title: 'Original Song'
      }
    };
  } );

  describe( '_setupStatefulMessageListener', () => {
    it( 'should apply state patches correctly', async () => {
      // Set up the listener
      bot._setupStatefulMessageListener();

      // Get the statefulMessage handler
      const statefulMessageHandler = mockSocket.on.mock.calls.find(
        call => call[ 0 ] === 'statefulMessage'
      )[ 1 ];

      // Create a test message with state patch
      const testMessage = {
        name: 'songChanged',
        statePatch: [
          {
            op: 'replace',
            path: '/currentSong/title',
            value: 'New Song Title'
          },
          {
            op: 'add',
            path: '/room/users/-',
            value: { id: 'user3', name: 'User Three' }
          }
        ]
      };

      // Execute the handler
      await statefulMessageHandler( testMessage );

      // Verify state was updated
      expect( bot.state.currentSong.title ).toBe( 'New Song Title' );
      expect( bot.state.room.users ).toHaveLength( 3 );
      expect( bot.state.room.users[ 2 ] ).toEqual( { id: 'user3', name: 'User Three' } );

      // Verify state was correctly patched (logging not asserted — tests must not rely on debug output)
    } );

    it( 'should handle patch errors gracefully', async () => {
      // Set up the listener
      bot._setupStatefulMessageListener();

      // Get the statefulMessage handler
      const statefulMessageHandler = mockSocket.on.mock.calls.find(
        call => call[ 0 ] === 'statefulMessage'
      )[ 1 ];

      // Create a test message with invalid patch
      const testMessage = {
        name: 'invalidPatch',
        statePatch: [
          {
            op: 'replace',
            path: '/nonexistent/path',
            value: 'New Value'
          }
        ]
      };

      // Store original state
      const originalState = JSON.parse( JSON.stringify( bot.state ) );

      // Execute the handler
      await statefulMessageHandler( testMessage );

      // Verify state was not corrupted
      expect( bot.state ).toEqual( originalState );

      // Verify error was logged
      expect( mockServices.logger.error ).toHaveBeenCalledWith(
        expect.stringContaining( 'Failed to apply state patch for invalidPatch' )
      );
    } );

    it( 'should warn when receiving patch without current state', async () => {
      // Remove current state
      bot.state = null;
      // Ensure we're not in initial connection mode
      bot._isInitialConnection = false;

      // Set up the listener
      bot._setupStatefulMessageListener();

      // Get the statefulMessage handler
      const statefulMessageHandler = mockSocket.on.mock.calls.find(
        call => call[ 0 ] === 'statefulMessage'
      )[ 1 ];

      // Create a test message with state patch
      const testMessage = {
        name: 'testMessage',
        statePatch: [
          {
            op: 'replace',
            path: '/test',
            value: 'value'
          }
        ]
      };

      // Execute the handler
      await statefulMessageHandler( testMessage );

      // Verify warning was logged
      expect( mockServices.logger.warn ).toHaveBeenCalledWith(
        'Received state patch but no current state available for message: testMessage'
      );
    } );

    it( 'should handle messages without state patches', async () => {
      // Set up the listener
      bot._setupStatefulMessageListener();

      // Get the statefulMessage handler
      const statefulMessageHandler = mockSocket.on.mock.calls.find(
        call => call[ 0 ] === 'statefulMessage'
      )[ 1 ];

      // Create a test message without state patch
      const testMessage = {
        name: 'simpleMessage'
        // No statePatch property
      };

      // Store original state
      const originalState = JSON.parse( JSON.stringify( bot.state ) );

      // Execute the handler
      await statefulMessageHandler( testMessage );

      // Verify state was not changed
      expect( bot.state ).toEqual( originalState );

      // State should be unchanged (no patch provided)
    } );

    it( 'should preserve state immutability with mutate=false', async () => {
      // Set up the listener
      bot._setupStatefulMessageListener();

      // Get the statefulMessage handler
      const statefulMessageHandler = mockSocket.on.mock.calls.find(
        call => call[ 0 ] === 'statefulMessage'
      )[ 1 ];

      // Store reference to original state object
      const originalStateObject = bot.state;

      // Create a test message with state patch
      const testMessage = {
        name: 'testPatch',
        statePatch: [
          {
            op: 'replace',
            path: '/currentSong/title',
            value: 'Modified Title'
          }
        ]
      };

      // Execute the handler
      await statefulMessageHandler( testMessage );

      // Verify that bot.state is a new object (not mutated)
      expect( bot.state ).not.toBe( originalStateObject );
      expect( bot.state.currentSong.title ).toBe( 'Modified Title' );

      // Verify original state object was not modified
      expect( originalStateObject.currentSong.title ).toBe( 'Original Song' );
    } );
  } );
} );
