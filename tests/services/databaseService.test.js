const path = require( 'path' );

// Mock filesystem operations for testing  
const fs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn()
};

jest.doMock( 'fs', () => fs );

// Mock better-sqlite3 module
const mockDatabase = {
  prepare: jest.fn(),
  exec: jest.fn(),
  close: jest.fn()
};

const mockStatement = {
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
  finalize: jest.fn()
};

jest.doMock( 'better-sqlite3', () => {
  return jest.fn( () => mockDatabase );
} );

const DatabaseService = require( '../../src/services/databaseService.js' );

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

describe( 'DatabaseService', () => {
  let databaseService;
  let Database;

  beforeEach( () => {
    jest.clearAllMocks();
    Database = require( 'better-sqlite3' );
    
    // Setup default mocks
    fs.existsSync.mockReturnValue( true );
    mockDatabase.prepare.mockReturnValue( mockStatement );
    
    databaseService = new DatabaseService( mockLogger );
  } );

  afterEach( () => {
    if ( databaseService && databaseService.db ) {
      try {
        databaseService.db = null;
      } catch ( err ) {
        // Ignore cleanup errors in tests
      }
    }
  } );

  describe( 'constructor', () => {
    test( 'should create instance with logger', () => {
      expect( databaseService.logger ).toBe( mockLogger );
      expect( databaseService.db ).toBeNull();
      expect( databaseService.isInitialized ).toBe( false );
    } );
  } );

  describe( 'initialize', () => {
    test( 'should initialize database and create tables', async () => {
      await databaseService.initialize();

      expect( Database ).toHaveBeenCalledWith( 
        expect.stringContaining( 'mrroboto.db' ),
        { verbose: expect.any( Function ) }
      );
      expect( mockDatabase.exec ).toHaveBeenCalled();
      expect( databaseService.isInitialized ).toBe( true );
      expect( mockLogger.info ).toHaveBeenCalledWith( 'Database initialized successfully' );
    } );

    test( 'should create data directory if it does not exist', async () => {
      fs.existsSync.mockReturnValue( false );

      await databaseService.initialize();

      expect( fs.mkdirSync ).toHaveBeenCalledWith( 
        expect.stringContaining( 'data' ),
        { recursive: true }
      );
    } );

    test( 'should handle initialization errors', async () => {
      const error = new Error( 'Database error' );
      Database.mockImplementation( () => {
        throw error;
      } );

      await expect( databaseService.initialize() ).rejects.toThrow( 'Database error' );
      expect( mockLogger.error ).toHaveBeenCalledWith( 'Failed to initialize database:', error );
    } );

    test( 'should not initialize twice', async () => {
      await databaseService.initialize();
      jest.clearAllMocks();
      
      await databaseService.initialize();
      
      expect( Database ).not.toHaveBeenCalled();
    } );
  } );

  describe( 'recordSongPlay', () => {
    beforeEach( async () => {
      await databaseService.initialize();
      jest.clearAllMocks();
    } );

    test( 'should record song play successfully', () => {
      const songData = {
        songId: 'song123',
        title: 'Test Song',
        artist: 'Test Artist',
        djId: 'dj123',
        djName: 'Test DJ',
        upVotes: 5,
        downVotes: 2,
        totalVotes: 7,
        playedAt: '2023-01-01 12:00:00'
      };

      mockStatement.run.mockReturnValue( { changes: 1, lastInsertRowid: 1 } );

      const result = databaseService.recordSongPlay( songData );

      expect( mockDatabase.prepare ).toHaveBeenCalledWith( expect.stringContaining( 'INSERT INTO played_songs' ) );
      expect( mockStatement.run ).toHaveBeenCalledWith( songData );
      expect( result ).toEqual( { success: true, id: 1 } );
    } );

    test( 'should handle record song play errors', () => {
      const songData = { songId: 'song123' };
      const error = new Error( 'Insert error' );
      mockStatement.run.mockImplementation( () => {
        throw error;
      } );

      const result = databaseService.recordSongPlay( songData );

      expect( result ).toEqual( { success: false, error: 'Insert error' } );
      expect( mockLogger.error ).toHaveBeenCalledWith( 'Error recording song play:', error );
    } );

    test( 'should throw error if not initialized', () => {
      databaseService.isInitialized = false;
      databaseService.db = null;

      expect( () => databaseService.recordSongPlay( {} ) )
        .toThrow( 'Database not initialized' );
    } );
  } );

  describe( 'getRecentSongs', () => {
    beforeEach( async () => {
      await databaseService.initialize();
      jest.clearAllMocks();
    } );

    test( 'should get recent songs successfully', () => {
      const mockSongs = [
        { id: 1, title: 'Song 1', artist: 'Artist 1' },
        { id: 2, title: 'Song 2', artist: 'Artist 2' }
      ];
      mockStatement.all.mockReturnValue( mockSongs );

      const result = databaseService.getRecentSongs( 10 );

      expect( mockDatabase.prepare ).toHaveBeenCalledWith( expect.stringContaining( 'SELECT * FROM played_songs' ) );
      expect( mockStatement.all ).toHaveBeenCalledWith( { limit: 10 } );
      expect( result ).toEqual( { success: true, songs: mockSongs } );
    } );

    test( 'should handle get recent songs errors', () => {
      const error = new Error( 'Query error' );
      mockStatement.all.mockImplementation( () => {
        throw error;
      } );

      const result = databaseService.getRecentSongs( 10 );

      expect( result ).toEqual( { success: false, error: 'Query error' } );
      expect( mockLogger.error ).toHaveBeenCalledWith( 'Error getting recent songs:', error );
    } );
  } );

  describe( 'saveConversation', () => {
    beforeEach( async () => {
      await databaseService.initialize();
      jest.clearAllMocks();
    } );

    test( 'should save conversation successfully', () => {
      const conversationData = {
        messageId: 'msg123',
        userId: 'user123',
        userName: 'Test User',
        messageText: 'Hello world',
        timestamp: '2023-01-01 12:00:00'
      };

      mockStatement.run.mockReturnValue( { changes: 1, lastInsertRowid: 1 } );

      const result = databaseService.saveConversation( conversationData );

      expect( mockDatabase.prepare ).toHaveBeenCalledWith( expect.stringContaining( 'INSERT INTO conversation_history' ) );
      expect( mockStatement.run ).toHaveBeenCalledWith( conversationData );
      expect( result ).toEqual( { success: true, id: 1 } );
    } );
  } );

  describe( 'close', () => {
    test( 'should close database connection', async () => {
      await databaseService.initialize();
      
      databaseService.close();

      expect( mockDatabase.close ).toHaveBeenCalled();
      expect( databaseService.db ).toBeNull();
      expect( databaseService.isInitialized ).toBe( false );
    } );

    test( 'should handle close when not initialized', () => {
      expect( () => databaseService.close() ).not.toThrow();
    } );
  } );
} );