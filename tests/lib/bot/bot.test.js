const path = require( 'path' );

// Mock better-sqlite3 - must be done before requiring serviceContainer
jest.mock( 'better-sqlite3', () => {
  return jest.fn().mockImplementation( () => ( {
    exec: jest.fn(),
    prepare: jest.fn().mockReturnValue( {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn()
    } ),
    close: jest.fn()
  } ) );
} );

// Mock fs promises - must be done before requiring Bot
const mockAppendFile = jest.fn();
jest.mock( 'fs', () => ( {
  readdirSync: jest.fn().mockReturnValue( [] ), // Mock for commandService
  promises: {
    appendFile: mockAppendFile
  }
} ) );

// Mock Logger module
jest.mock( '../../../src/lib/logging', () => ( {
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
} ) );

// Mock RetryService
jest.mock( '../../../src/services/retryService', () => {
  return jest.fn().mockImplementation( () => ( {
    executeWithRetry: jest.fn(),
    getCircuitStatus: jest.fn(),
    resetCircuitBreaker: jest.fn(),
    isCircuitOpen: jest.fn()
  } ) );
} );

// Mock CometChatApi
jest.mock( '../../../src/services/cometchatApi', () => ( {
  setRetryService: jest.fn(),
  // Add any methods that CometChatApi uses
} ) );

// Mock MessageService
jest.mock( '../../../src/services/messageService', () => ( {
  messageService: {
    joinChat: jest.fn().mockResolvedValue(),
    fetchGroupMessages: jest.fn().mockResolvedValue( [] ),
    sendGroupMessage: jest.fn().mockResolvedValue()
  }
} ) );

// Mock parseCommands
jest.mock( '../../../src/services/parseCommands', () => ( {
  parseCommands: jest.fn()
} ) );

// Mock ttfm-socket
const mockSocketInstance = {
  joinRoom: jest.fn(),
  on: jest.fn()
};

const MockSocketClient = jest.fn().mockImplementation( () => mockSocketInstance );

jest.mock( 'ttfm-socket', () => ( {
  SocketClient: MockSocketClient,
  ServerMessageName: {},
  StatefulServerMessageName: {},
  StatelessServerMessageName: {}
} ) );

// Now import Bot after mocks are set up
const { Bot } = require( '../../../src/lib/bot.js' );

describe( 'Bot', () => {
  let bot;
  let mockServices;
  let originalGetState;

  beforeEach( () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Clear mock on mockAppendFile
    mockAppendFile.mockClear();
    MockSocketClient.mockClear();
    mockSocketInstance.joinRoom.mockClear();
    mockSocketInstance.on.mockClear();

    const serviceContainer = require( '../../../src/services/serviceContainer' );

    // Use the singleton serviceContainer directly
    mockServices = serviceContainer;

    // Mock the logger methods
    mockServices.logger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    };

    // Mock the message service methods
    mockServices.messageService = {
      joinChat: jest.fn().mockResolvedValue(),
      fetchGroupMessages: jest.fn().mockResolvedValue( [] ),
      sendGroupMessage: jest.fn().mockResolvedValue()
    };

    // Mock other services
    mockServices.parseCommands = jest.fn();
    mockServices.commandService = jest.fn();
    mockServices.getState = jest.fn();

    // Mock the config with expected test values
    mockServices.config = {
      HANGOUT_ID: 'test-hangout-123',
      BOT_USER_TOKEN: 'test-bot-token-456',
      BOT_UID: 'test-bot-uid-789',
      COMMAND_SWITCH: '!',
      SOCKET_MESSAGE_LOG_LEVEL: 'ON'
    };

    // Set up hangoutState with required properties for StateService
    mockServices.hangoutState = {
      allUsers: [],
      allUserData: {},
      djs: [],
      settings: {},
      vibeMeter: 0,
      votes: { up: 0, down: 0 }
    };

    // Patch getState for nickname
    originalGetState = mockServices.getState;
    // Additional tests for bot nickname usage in startup message
    // Place this at the end of the file, outside all other describe blocks

    bot = new Bot( 'test-slug', mockServices );
  } );

  afterEach( () => {
    jest.resetAllMocks();
  } );

  describe( 'Constructor', () => {
    test( 'should initialize with services and empty lastMessageIDs', () => {
      expect( bot.services ).toBe( mockServices );
      expect( bot.lastMessageIDs ).toEqual( {} );
    } );
  } );

  describe( '_writeSocketMessagesToLogFile', () => {
    test( 'should write formatted log entry to file', async () => {
      const filename = 'test.log';
      const data = { message: 'test data', id: 123 };

      // Mock Date.toISOString for consistent timestamp
      const mockTimestamp = '2023-01-01T12:00:00.000Z';
      jest.spyOn( Date.prototype, 'toISOString' ).mockReturnValue( mockTimestamp );

      await bot._writeSocketMessagesToLogFile( filename, data );

      const expectedPath = path.join( process.cwd(), 'logs', filename );
      const expectedContent = `${ mockTimestamp }: ${ JSON.stringify( data, null, 2 ) }\n`;

      expect( mockAppendFile ).toHaveBeenCalledWith( expectedPath, expectedContent );
    } );

    test( 'should handle file write errors gracefully', async () => {
      const filename = 'test.log';
      const data = { test: 'data' };
      const writeError = new Error( 'File write failed' );

      mockAppendFile.mockRejectedValueOnce( writeError );

      await bot._writeSocketMessagesToLogFile( filename, data );

      expect( mockServices.logger.error ).toHaveBeenCalledWith(
        `Failed to write to log file ${ filename }: ${ writeError.message }`
      );
    } );
  } );

  describe( 'connect', () => {
    test( 'should execute full connection flow', async () => {
      // Set up socket mock before creating connection
      const mockSocket = {
        on: jest.fn(),
        joinRoom: jest.fn().mockResolvedValue( { state: {} } )
      };
      MockSocketClient.mockImplementation( () => mockSocket );

      // Mock all connection steps
      const originalCreateConnection = bot._createSocketConnection;
      bot._createSocketConnection = jest.fn().mockImplementation( async () => {
        await originalCreateConnection.call( bot );
        return;
      } );
      bot._joinSocketRoom = jest.fn().mockResolvedValue();
      bot._joinCometChat = jest.fn().mockResolvedValue();
      bot._setupReconnectHandler = jest.fn();

      await bot.connect();

      // Verify operations were called
      expect( bot._createSocketConnection ).toHaveBeenCalled();
      expect( bot._joinSocketRoom ).toHaveBeenCalled();
      expect( bot._joinCometChat ).toHaveBeenCalled();
      expect( bot._setupReconnectHandler ).toHaveBeenCalled();

      // Verify socket listeners were set up
      expect( mockSocket.on ).toHaveBeenCalledWith( 'statefulMessage', expect.any( Function ) );
      expect( mockSocket.on ).toHaveBeenCalledWith( 'statelessMessage', expect.any( Function ) );
      expect( mockSocket.on ).toHaveBeenCalledWith( 'serverMessage', expect.any( Function ) );
      expect( mockSocket.on ).toHaveBeenCalledWith( 'error', expect.any( Function ) );
    } );

    test( 'should handle connection errors', async () => {
      // Set up socket mock
      const mockSocket = {
        on: jest.fn(),
        joinRoom: jest.fn().mockResolvedValue( { state: {} } )
      };
      MockSocketClient.mockImplementation( () => mockSocket );

      const connectionError = new Error( 'Connection failed' );
      const originalCreateConnection = bot._createSocketConnection;
      bot._createSocketConnection = jest.fn().mockImplementation( async () => {
        await originalCreateConnection.call( bot );
        return;
      } );
      bot._joinSocketRoom = jest.fn().mockResolvedValue();
      bot._joinCometChat = jest.fn().mockRejectedValue( connectionError );
      bot._setupReconnectHandler = jest.fn();

      await expect( bot.connect() ).rejects.toThrow( 'Connection failed' );

      // Should have called these in order until the error
      expect( bot._createSocketConnection ).toHaveBeenCalled();
      expect( bot._joinSocketRoom ).toHaveBeenCalled();
      expect( bot._joinCometChat ).toHaveBeenCalled();
      expect( bot._setupReconnectHandler ).not.toHaveBeenCalled();

      // Verify socket listeners were set up before the error
      expect( mockSocket.on ).toHaveBeenCalledWith( 'statefulMessage', expect.any( Function ) );
      expect( mockSocket.on ).toHaveBeenCalledWith( 'statelessMessage', expect.any( Function ) );
      expect( mockSocket.on ).toHaveBeenCalledWith( 'serverMessage', expect.any( Function ) );
      expect( mockSocket.on ).toHaveBeenCalledWith( 'error', expect.any( Function ) );
    } );
  } );

  describe( '_joinCometChat', () => {
    test( 'should call messageService.joinChat with hangout ID', async () => {
      await bot._joinCometChat();

      expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'Joining the chat...' );
      expect( mockServices.messageService.joinChat ).toHaveBeenCalledWith( 'test-hangout-123' );
    } );
  } );

  describe( '_createSocketConnection', () => {
    test( 'should create SocketClient with correct URL', async () => {
      await bot._createSocketConnection();

      expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'Creating SocketClient...' );
      expect( MockSocketClient ).toHaveBeenCalledWith( 'https://socket.prod.tt.fm' );
      expect( bot.socket ).toBeDefined();
      expect( mockServices.logger.debug ).toHaveBeenCalledWith( '✅ SocketClient created' );
    } );
  } );

  describe( '_joinSocketRoom', () => {
    test( 'should join room and set state on success', async () => {
      const mockState = {
        roomId: 'test-room',
        users: [],
        allUsers: [],
        allUserData: {},
        djs: [],
        settings: {},
        vibeMeter: 0
      };
      bot._joinRoomWithTimeout = jest.fn().mockResolvedValue( { state: mockState } );

      await bot._joinSocketRoom();

      expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'Joining room...' );
      expect( bot._joinRoomWithTimeout ).toHaveBeenCalled();
      expect( bot.state ).toBe( mockState );
      expect( mockServices.logger.debug ).toHaveBeenCalledWith( '✅ Room joined successfully, setting up state...' );
    } );

    test( 'should handle room join errors', async () => {
      const joinError = new Error( 'Room join failed' );
      bot._joinRoomWithTimeout = jest.fn().mockRejectedValue( joinError );

      await expect( bot._joinSocketRoom() ).rejects.toThrow( 'Room join failed' );

      expect( mockServices.logger.error ).toHaveBeenCalledWith( `❌ Failed to join room: ${ joinError }` );
    } );

    test( 'should log initial state when SOCKET_MESSAGE_LOG_LEVEL is DEBUG', async () => {
      const mockState = {
        roomId: 'debug-room',
        users: [ 'user1' ],
        currentSong: { id: '123' },
        allUsers: [ { uid: 'user1' } ],
        allUserData: { 'user1': { nickname: 'TestUser' } },
        djs: [],
        settings: {},
        vibeMeter: 0
      };
      bot._joinRoomWithTimeout = jest.fn().mockResolvedValue( { state: mockState } );
      mockServices.config.SOCKET_MESSAGE_LOG_LEVEL = 'DEBUG';

      await bot._joinSocketRoom();

      expect( mockAppendFile ).toHaveBeenCalledWith(
        expect.stringMatching( /000000_initialState\.log$/ ),
        expect.stringContaining( '"roomId": "debug-room"' )
      );
      expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'Initial state logged to 000000_initialState.log' );
    } );

    test( 'should not log initial state when SOCKET_MESSAGE_LOG_LEVEL is not DEBUG', async () => {
      const mockState = {
        roomId: 'test-room',
        users: [],
        allUsers: [],
        allUserData: {},
        djs: [],
        settings: {},
        vibeMeter: 0
      };
      bot._joinRoomWithTimeout = jest.fn().mockResolvedValue( { state: mockState } );
      mockServices.config.SOCKET_MESSAGE_LOG_LEVEL = 'ON';

      await bot._joinSocketRoom();

      expect( mockAppendFile ).not.toHaveBeenCalledWith(
        expect.stringMatching( /000000_initialState\.log$/ ),
        expect.anything()
      );
    } );

    test( 'should handle initial state logging errors gracefully', async () => {
      const mockState = {
        roomId: 'error-room',
        users: [],
        allUsers: [],
        allUserData: {},
        djs: [],
        settings: {},
        vibeMeter: 0
      };
      bot._joinRoomWithTimeout = jest.fn().mockResolvedValue( { state: mockState } );
      mockServices.config.SOCKET_MESSAGE_LOG_LEVEL = 'DEBUG';

      const logError = new Error( 'Disk full' );
      mockAppendFile.mockRejectedValueOnce( logError );

      await bot._joinSocketRoom();

      expect( bot.state ).toBe( mockState );
      expect( mockServices.logger.error ).toHaveBeenCalledWith( `Failed to log initial state: ${ logError.message }` );
    } );

    test( 'should initialize global.previousPlayedSong when initial state has nowPlaying', async () => {
      // Clear any existing global state
      global.previousPlayedSong = null;

      const mockState = {
        roomId: 'test-room',
        users: [],
        allUsers: [],
        allUserData: {},
        djs: [ { uuid: 'dj-123' } ],
        settings: {},
        vibeMeter: 0,
        nowPlaying: {
          song: {
            artistName: 'Test Artist',
            trackName: 'Test Track'
          }
        },
        voteCounts: {
          likes: 5,
          dislikes: 2,
          stars: 1
        }
      };
      bot._joinRoomWithTimeout = jest.fn().mockResolvedValue( { state: mockState } );

      await bot._joinSocketRoom();

      expect( global.previousPlayedSong ).toEqual( {
        djUuid: 'dj-123',
        artistName: 'Test Artist',
        trackName: 'Test Track',
        voteCounts: { likes: 5, dislikes: 2, stars: 1 }
      } );
      expect( mockServices.logger.debug ).toHaveBeenCalledWith(
        '[bot] Initialized global.previousPlayedSong from initial state:',
        expect.objectContaining( {
          djUuid: 'dj-123',
          trackName: 'Test Track',
          artistName: 'Test Artist'
        } )
      );
    } );

    test( 'should not initialize global.previousPlayedSong when no nowPlaying in initial state', async () => {
      // Clear any existing global state
      global.previousPlayedSong = null;

      const mockState = {
        roomId: 'test-room',
        users: [],
        allUsers: [],
        allUserData: {},
        djs: [ { uuid: 'dj-123' } ],
        settings: {},
        vibeMeter: 0
        // No nowPlaying object
      };
      bot._joinRoomWithTimeout = jest.fn().mockResolvedValue( { state: mockState } );

      await bot._joinSocketRoom();

      expect( global.previousPlayedSong ).toBeNull();
      expect( mockServices.logger.debug ).toHaveBeenCalledWith(
        '[bot] No currently playing song in initial state - global.previousPlayedSong not initialized'
      );
    } );
  } );

  describe( '_joinRoomWithTimeout', () => {
    beforeEach( () => {
      jest.useFakeTimers();
    } );

    afterEach( () => {
      jest.useRealTimers();
    } );

    test( 'should join room successfully within timeout', async () => {
      const mockResponse = { state: { roomId: 'test' } };
      mockSocketInstance.joinRoom.mockResolvedValue( mockResponse );

      // Set up socket for this test
      bot.socket = mockSocketInstance;

      const joinPromise = bot._joinRoomWithTimeout();

      // Fast-forward time but not past the timeout
      jest.advanceTimersByTime( 5000 );

      const result = await joinPromise;

      expect( mockSocketInstance.joinRoom ).toHaveBeenCalledWith( 'test-bot-token-456', {
        roomUuid: 'test-hangout-123'
      } );
      expect( result ).toBe( mockResponse );
    } );

    test( 'should timeout if room join takes too long', async () => {
      // Make joinRoom hang indefinitely
      mockSocketInstance.joinRoom.mockImplementation( () => new Promise( () => { } ) );

      // Set up socket for this test
      bot.socket = mockSocketInstance;

      const joinPromise = bot._joinRoomWithTimeout();

      // Fast-forward past the timeout (60 seconds + buffer)
      jest.advanceTimersByTime( 61000 );

      await expect( joinPromise ).rejects.toThrow( 'Socket join room timeout after 60 seconds' );
    }, 70000 ); // Set Jest timeout to 70 seconds to allow for the 60-second timeout plus buffer
  } );

  describe( '_setupReconnectHandler', () => {
    beforeEach( () => {
      bot.socket = mockSocketInstance;
    } );

    test( 'should register reconnect event handler', () => {
      bot._setupReconnectHandler();

      expect( mockServices.logger.debug ).toHaveBeenCalledWith( '✅ Setting up reconnect handler...' );
      expect( mockSocketInstance.on ).toHaveBeenCalledWith( 'reconnect', expect.any( Function ) );
    } );

    test( 'should handle successful reconnect', async () => {
      const mockState = { roomId: 'reconnected-room' };
      mockSocketInstance.joinRoom.mockResolvedValue( { state: mockState } );

      bot._setupReconnectHandler();

      // Get the reconnect handler function
      const reconnectHandler = mockSocketInstance.on.mock.calls.find( call => call[ 0 ] === 'reconnect' )[ 1 ];

      await reconnectHandler();

      expect( mockServices.logger.debug ).toHaveBeenCalledWith( '🔄 Reconnecting to room...' );
      expect( mockSocketInstance.joinRoom ).toHaveBeenCalledWith( 'test-bot-token-456', {
        roomUuid: 'test-hangout-123'
      } );
      expect( bot.state ).toBe( mockState );
      expect( mockServices.logger.debug ).toHaveBeenCalledWith( '🔄 Reconnected successfully' );
    } );

    test( 'should handle reconnect errors', async () => {
      const reconnectError = new Error( 'Reconnect failed' );
      mockSocketInstance.joinRoom.mockRejectedValue( reconnectError );

      bot._setupReconnectHandler();

      // Get the reconnect handler function
      const reconnectHandler = mockSocketInstance.on.mock.calls.find( call => call[ 0 ] === 'reconnect' )[ 1 ];

      await reconnectHandler();

      expect( mockServices.logger.error ).toHaveBeenCalledWith( `❌ Reconnection failed: ${ reconnectError }` );
    } );
  } );

  describe( 'configureListeners', () => {
    beforeEach( () => {
      bot.socket = mockSocketInstance;
    } );

    test( 'should set up all listeners', () => {
      bot._setupStatefulMessageListener = jest.fn();
      bot._setupStatelessMessageListener = jest.fn();
      bot._setupServerMessageListener = jest.fn();
      bot._setupErrorListener = jest.fn();

      bot.configureListeners();

      // The debug message was removed in the refactor since listeners are now set up individually
      expect( bot._setupStatefulMessageListener ).toHaveBeenCalled();
      expect( bot._setupStatelessMessageListener ).toHaveBeenCalled();
      expect( bot._setupServerMessageListener ).toHaveBeenCalled();
      expect( bot._setupErrorListener ).toHaveBeenCalled();
    } );
  } );

  describe( '_setupStatefulMessageListener', () => {
    beforeEach( () => {
      bot.socket = mockSocketInstance;
    } );

    test( 'should register statefulMessage handler', async () => {
      bot._writeSocketMessagesToLogFile = jest.fn().mockResolvedValue();

      bot._setupStatefulMessageListener();

      expect( mockSocketInstance.on ).toHaveBeenCalledWith( 'statefulMessage', expect.any( Function ) );

      // Test the handler
      const handler = mockSocketInstance.on.mock.calls.find( call => call[ 0 ] === 'statefulMessage' )[ 1 ];
      const payload = { name: 'testStatefulMessage', data: 'test' };

      await handler( payload );

      expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'statefulMessage - testStatefulMessage' );
      expect( bot._writeSocketMessagesToLogFile ).toHaveBeenCalledWith( 'statefulMessage.log', payload );
    } );
  } );

  describe( '_setupStatelessMessageListener', () => {
    beforeEach( () => {
      bot.socket = mockSocketInstance;
    } );

    test( 'should register statelessMessage handler', async () => {
      bot._writeSocketMessagesToLogFile = jest.fn().mockResolvedValue();

      bot._setupStatelessMessageListener();

      expect( mockSocketInstance.on ).toHaveBeenCalledWith( 'statelessMessage', expect.any( Function ) );

      // Test the handler
      const handler = mockSocketInstance.on.mock.calls.find( call => call[ 0 ] === 'statelessMessage' )[ 1 ];
      const payload = { name: 'testStatelessMessage', data: 'test' };

      await handler( payload );

      expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'statelessMessage - testStatelessMessage' );
      expect( bot._writeSocketMessagesToLogFile ).toHaveBeenCalledWith( 'statelessMessage.log', payload );
    } );
  } );

  describe( '_setupServerMessageListener', () => {
    beforeEach( () => {
      bot.socket = mockSocketInstance;
    } );

    test( 'should register serverMessage handler', async () => {
      bot._writeSocketMessagesToLogFile = jest.fn().mockResolvedValue();

      bot._setupServerMessageListener();

      expect( mockSocketInstance.on ).toHaveBeenCalledWith( 'serverMessage', expect.any( Function ) );

      // Test the handler
      const handler = mockSocketInstance.on.mock.calls.find( call => call[ 0 ] === 'serverMessage' )[ 1 ];
      const payload = { message: { name: 'testServerMessage' }, data: 'test' };

      await handler( payload );

      expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'serverMessage - testServerMessage' );
      expect( bot._writeSocketMessagesToLogFile ).toHaveBeenCalledWith( 'serverMessage.log', payload );
    } );
  } );

  describe( '_setupErrorListener', () => {
    beforeEach( () => {
      bot.socket = mockSocketInstance;
    } );

    test( 'should register error handler', async () => {
      bot._writeSocketMessagesToLogFile = jest.fn().mockResolvedValue();

      // Mock Date.toISOString for consistent timestamp
      const mockTimestamp = '2023-01-01T12:00:00.000Z';
      jest.spyOn( Date.prototype, 'toISOString' ).mockReturnValue( mockTimestamp );

      bot._setupErrorListener();

      expect( mockSocketInstance.on ).toHaveBeenCalledWith( 'error', expect.any( Function ) );

      // Test the handler
      const handler = mockSocketInstance.on.mock.calls.find( call => call[ 0 ] === 'error' )[ 1 ];
      const errorMessage = 'Socket connection error';

      await handler( errorMessage );

      expect( mockServices.logger.debug ).toHaveBeenCalledWith( `Socket error: ${ errorMessage }` );
      expect( bot._writeSocketMessagesToLogFile ).toHaveBeenCalledWith( 'socketError.log', {
        error: errorMessage,
        timestamp: mockTimestamp
      } );
    } );
  } );

} );

// Additional tests for bot nickname usage in startup message
describe( 'Bot nickname usage in startup message', () => {
  let mockServices;
  beforeEach( () => {
    const serviceContainer = require( '../../../src/services/serviceContainer' );
    mockServices = serviceContainer;
    mockServices.getState = jest.fn();
  } );

  test( 'should use botNickname from services.getState in startup message', async () => {
    mockServices.getState.mockReturnValue( 'TestBotNick' );
    // Ensure config has the expected COMMAND_SWITCH for this test
    mockServices.config.COMMAND_SWITCH = '!';
    const botNickname = mockServices.getState( 'botNickname' ) || 'Bot';
    const message = `${ botNickname } is online...user ${ mockServices.config.COMMAND_SWITCH }help to see some of what I can do`;
    expect( message ).toContain( 'TestBotNick is online' );
    expect( message ).toContain( '!help' );
  } );

  test( 'should fallback to "Bot" if nickname is not set', async () => {
    mockServices.getState.mockReturnValue( undefined );
    // Ensure config has the expected COMMAND_SWITCH for this test
    mockServices.config.COMMAND_SWITCH = '!';
    const botNickname = mockServices.getState( 'botNickname' ) || 'Bot';
    const message = `${ botNickname } is online...user ${ mockServices.config.COMMAND_SWITCH }help to see some of what I can do`;
    expect( message ).toContain( 'Bot is online' );
    expect( message ).toContain( '!help' );
  } );
} );
