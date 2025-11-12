// Mock all dependencies before importing serviceContainer
jest.mock( '../../src/services/messageService.js', () => ( {
  messageService: {
    sendGroupMessage: jest.fn(),
    fetchGroupMessages: jest.fn(),
    buildCustomData: jest.fn()
  }
} ) );

jest.mock( '../../src/services/parseCommands.js', () => jest.fn() );

jest.mock( '../../src/services/commandService.js', () => ( {
  processCommand: jest.fn()
} ) );

jest.mock( '../../src/services/playlistService.js', () => ( {
  getCurrentPlaylist: jest.fn(),
  addToPlaylist: jest.fn()
} ) );

jest.mock( '../../src/lib/logging.js', () => ( {
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
} ) );

jest.mock( '../../src/config.js', () => ( {
  HANGOUT_ID: 'test-hangout-id',
  BOT_UID: 'test-bot-uid'
} ) );

const services = require( '../../src/services/serviceContainer.js' );

describe( 'serviceContainer', () => {
  beforeEach( () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Reset shared state to initial values
    services.state.lastMessageId = null;
    services.state.connectedUsers = [];
    services.state.botStatus = 'disconnected';
    services.state.messageCache = new Map();
    services.state.userSessions = new Map();
    services.state.currentPlaylist = [];
    services.state.dbConnectionStatus = 'disconnected';
  } );

  describe( 'Module Structure and Exports', () => {
    test( 'should export all required services', () => {
      expect( services ).toHaveProperty( 'messageService' );
      expect( services ).toHaveProperty( 'parseCommands' );
      expect( services ).toHaveProperty( 'commandService' );
      expect( services ).toHaveProperty( 'playlistService' );
      expect( services ).toHaveProperty( 'logger' );
      expect( services ).toHaveProperty( 'config' );
    } );

    test( 'should export state management', () => {
      expect( services ).toHaveProperty( 'state' );
      expect( services ).toHaveProperty( 'setState' );
      expect( services ).toHaveProperty( 'getState' );
      expect( services ).toHaveProperty( 'updateLastMessageId' );
    } );

    test( 'should have correct service types', () => {
      expect( typeof services.messageService ).toBe( 'object' );
      expect( typeof services.parseCommands ).toBe( 'function' );
      expect( typeof services.commandService ).toBe( 'object' );
      expect( typeof services.playlistService ).toBe( 'object' );
      expect( typeof services.logger ).toBe( 'object' );
      expect( typeof services.config ).toBe( 'object' );
    } );

    test( 'should have correct helper method types', () => {
      expect( typeof services.setState ).toBe( 'function' );
      expect( typeof services.getState ).toBe( 'function' );
      expect( typeof services.updateLastMessageId ).toBe( 'function' );
    } );
  } );

  describe( 'Shared State Structure', () => {
    test( 'should have correct initial state structure', () => {
      expect( services.state ).toHaveProperty( 'lastMessageId', null );
      expect( services.state ).toHaveProperty( 'connectedUsers' );
      expect( services.state ).toHaveProperty( 'botStatus', 'disconnected' );
      expect( services.state ).toHaveProperty( 'messageCache' );
      expect( services.state ).toHaveProperty( 'userSessions' );
      expect( services.state ).toHaveProperty( 'currentPlaylist' );
      expect( services.state ).toHaveProperty( 'dbConnectionStatus', 'disconnected' );
    } );

    test( 'should initialize arrays as empty arrays', () => {
      expect( Array.isArray( services.state.connectedUsers ) ).toBe( true );
      expect( services.state.connectedUsers ).toHaveLength( 0 );
      expect( Array.isArray( services.state.currentPlaylist ) ).toBe( true );
      expect( services.state.currentPlaylist ).toHaveLength( 0 );
    } );

    test( 'should initialize Maps as empty Maps', () => {
      expect( services.state.messageCache ).toBeInstanceOf( Map );
      expect( services.state.messageCache.size ).toBe( 0 );
      expect( services.state.userSessions ).toBeInstanceOf( Map );
      expect( services.state.userSessions.size ).toBe( 0 );
    } );
  } );

  describe( 'setState method', () => {
    test( 'should update state value correctly', () => {
      services.setState( 'botStatus', 'connected' );

      expect( services.state.botStatus ).toBe( 'connected' );
    } );

    test( 'should update state value correctly', () => {
      services.setState( 'lastMessageId', 'msg-123' );

      expect( services.state.lastMessageId ).toBe( 'msg-123' );
    } );

    test( 'should handle setting complex objects', () => {
      const newUsers = [ 'user1', 'user2', 'user3' ];
      services.setState( 'connectedUsers', newUsers );

      expect( services.state.connectedUsers ).toEqual( newUsers );
    } );

    test( 'should handle setting null values', () => {
      services.setState( 'lastMessageId', 'temp-id' );
      services.setState( 'lastMessageId', null );

      expect( services.state.lastMessageId ).toBeNull();
    } );

    test( 'should handle setting undefined values', () => {
      services.setState( 'dbConnectionStatus', undefined );

      expect( services.state.dbConnectionStatus ).toBeUndefined();
    } );

    test( 'should handle setting Map objects', () => {
      const newCache = new Map( [ [ 'key1', 'value1' ], [ 'key2', 'value2' ] ] );
      services.setState( 'messageCache', newCache );

      expect( services.state.messageCache ).toBe( newCache );
      expect( services.state.messageCache.get( 'key1' ) ).toBe( 'value1' );
    } );
  } );

  describe( 'getState method', () => {
    test( 'should return correct state value', () => {
      services.state.botStatus = 'connected';

      const result = services.getState( 'botStatus' );

      expect( result ).toBe( 'connected' );
    } );

    test( 'should return null for null values', () => {
      services.state.lastMessageId = null;

      const result = services.getState( 'lastMessageId' );

      expect( result ).toBeNull();
    } );

    test( 'should return undefined for non-existent keys', () => {
      const result = services.getState( 'nonExistentKey' );

      expect( result ).toBeUndefined();
    } );

    test( 'should return array references correctly', () => {
      const users = [ 'user1', 'user2', 'user3' ];
      services.setState( 'connectedUsers', users );
      const result = services.getState( 'connectedUsers' );
      expect( result ).toEqual( users ); // Deep equality
    } );

    test( 'should return Map objects correctly', () => {
      const cache = new Map( [ [ 'key1', 'value1' ], [ 'key2', 'value2' ] ] );
      services.setState( 'messageCache', cache );
      const result = services.getState( 'messageCache' );
      expect( Array.from( result.entries() ) ).toEqual( Array.from( cache.entries() ) ); // Deep equality
      expect( result.get( 'key1' ) ).toBe( 'value1' );
    } );
  } );

  describe( 'updateLastMessageId method', () => {
    test( 'should update lastMessageId in state', () => {
      const messageId = 'msg-456';

      services.updateLastMessageId( messageId );

      expect( services.state.lastMessageId ).toBe( messageId );
    } );

    test( 'should log debug message with correct format', () => {
      const messageId = 'msg-789';

      services.updateLastMessageId( messageId );

      expect( services.logger.debug ).toHaveBeenCalledWith( `Last message ID updated to: ${ messageId }` );
    } );

    test( 'should handle null message ID', () => {
      services.updateLastMessageId( null );

      expect( services.state.lastMessageId ).toBeNull();
      expect( services.logger.debug ).toHaveBeenCalledWith( 'Last message ID updated to: null' );
    } );

    test( 'should handle numeric message IDs', () => {
      const numericId = 12345;

      services.updateLastMessageId( numericId );

      expect( services.state.lastMessageId ).toBe( numericId );
      expect( services.logger.debug ).toHaveBeenCalledWith( 'Last message ID updated to: 12345' );
    } );

    test( 'should overwrite previous message ID', () => {
      services.updateLastMessageId( 'old-id' );
      services.updateLastMessageId( 'new-id' );

      expect( services.state.lastMessageId ).toBe( 'new-id' );
      expect( services.logger.debug ).toHaveBeenCalledTimes( 2 );
    } );
  } );

  describe( 'State Management Integration', () => {
    test( 'should maintain state consistency across method calls', () => {
      // Use different methods to modify the same state
      services.setState( 'lastMessageId', 'initial-id' );
      expect( services.getState( 'lastMessageId' ) ).toBe( 'initial-id' );

      services.updateLastMessageId( 'updated-id' );
      expect( services.getState( 'lastMessageId' ) ).toBe( 'updated-id' );
    } );

    test( 'should handle concurrent state updates', () => {
      services.setState( 'botStatus', 'connecting' );
      services.setState( 'connectedUsers', [ 'user1' ] );
      services.updateLastMessageId( 'msg-100' );

      expect( services.getState( 'botStatus' ) ).toBe( 'connecting' );
      expect( services.getState( 'connectedUsers' ) ).toEqual( [ 'user1' ] );
      expect( services.getState( 'lastMessageId' ) ).toBe( 'msg-100' );
    } );

    test( 'should preserve Map and Set object references', () => {
      const originalCache = services.getState( 'messageCache' );
      const originalSessions = services.getState( 'userSessions' );

      services.setState( 'botStatus', 'connected' );

      // Maps should still be the same reference
      expect( services.getState( 'messageCache' ) ).toBe( originalCache );
      expect( services.getState( 'userSessions' ) ).toBe( originalSessions );
    } );
  } );

  describe( 'Service Integration', () => {
    test( 'should have access to all mocked services', () => {
      expect( services.messageService.sendGroupMessage ).toBeDefined();
      expect( services.commandService.processCommand ).toBeDefined();
      expect( services.playlistService.getCurrentPlaylist ).toBeDefined();
      expect( typeof services.parseCommands ).toBe( 'function' );
    } );

    test( 'should have logger available for debugging', () => {
      expect( services.logger.debug ).toBeDefined();
      expect( services.logger.info ).toBeDefined();
      expect( services.logger.warn ).toBeDefined();
      expect( services.logger.error ).toBeDefined();
    } );

    test( 'should have config available', () => {
      expect( services.config ).toBeDefined();
      expect( services.config.HANGOUT_ID ).toBe( 'test-hangout-id' );
      expect( services.config.BOT_UID ).toBe( 'test-bot-uid' );
    } );
  } );

  describe( 'Singleton Behavior', () => {
    test( 'should return the same instance on multiple requires', () => {
      // Clear the module cache and require again
      const services2 = require( '../../src/services/serviceContainer.js' );

      expect( services ).toBe( services2 );
      expect( services.state ).toBe( services2.state );
    } );

    test( 'should maintain state across multiple references', () => {
      const services2 = require( '../../src/services/serviceContainer.js' );

      services.setState( 'testValue', 'shared-state' );

      expect( services2.getState( 'testValue' ) ).toBe( 'shared-state' );
    } );
  } );
} );
