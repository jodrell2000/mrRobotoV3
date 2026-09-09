const fs = require( 'fs' );
const path = require( 'path' );

// Mock winston to prevent file system interactions
jest.mock( 'winston', () => ( {
  format: {
    combine: jest.fn( () => ( {} ) ),
    colorize: jest.fn( () => ( {} ) ),
    timestamp: jest.fn( () => ( {} ) ),
    printf: jest.fn( ( fn ) => {
      // Call the printf function to trigger line 39
      if ( typeof fn === 'function' ) {
        fn( { level: 'info', message: 'test', timestamp: '2023-01-01' } );
      }
      return {};
    } )
  },
  addColors: jest.fn(),
  createLogger: jest.fn( () => ( {
    levels: { error: 0, warn: 1, info: 2, debug: 3 },
    level: 'debug',
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  } ) ),
  transports: {
    DailyRotateFile: jest.fn(),
    Console: jest.fn().mockImplementation( () => ( {} ) )
  }
} ) );

// Mock winston-daily-rotate-file
jest.mock( 'winston-daily-rotate-file' );

describe( 'logging module', () => {
  let originalExistsSync;
  let originalMkdirSync;
  let originalCwd;

  beforeEach( () => {
    // Store original functions
    originalExistsSync = fs.existsSync;
    originalMkdirSync = fs.mkdirSync;
    originalCwd = process.cwd;

    // Clear module cache to ensure fresh import
    delete require.cache[ require.resolve( '../../src/lib/logging.js' ) ];
  } );

  afterEach( () => {
    // Restore original functions
    fs.existsSync = originalExistsSync;
    fs.mkdirSync = originalMkdirSync;
    process.cwd = originalCwd;

    // Clear module cache
    delete require.cache[ require.resolve( '../../src/lib/logging.js' ) ];
  } );

  test( 'should trigger all code paths including logger creation and exports', () => {
    const testDir = '/test-dir';

    // Mock process.cwd
    process.cwd = jest.fn().mockReturnValue( testDir );

    // Mock file system calls - first test case where directory doesn't exist
    fs.existsSync = jest.fn().mockReturnValue( false );
    fs.mkdirSync = jest.fn();

    // Require the module to trigger execution
    const logging = require( '../../src/lib/logging.js' );

    // Verify everything was called and logger exists
    expect( process.cwd ).toHaveBeenCalled();
    expect( fs.existsSync ).toHaveBeenCalled();
    expect( fs.mkdirSync ).toHaveBeenCalledWith(
      path.join( testDir, 'logs' ),
      { recursive: true }
    );
    expect( logging.logger ).toBeDefined();

    // Test that logger methods are callable (should not throw)
    expect( () => logging.logger.error( 'test' ) ).not.toThrow();
    expect( () => logging.logger.warn( 'test' ) ).not.toThrow();
    expect( () => logging.logger.info( 'test' ) ).not.toThrow();
    expect( () => logging.logger.debug( 'test' ) ).not.toThrow();

    // Verify logger has expected properties
    expect( typeof logging.logger.error ).toBe( 'function' );
    expect( typeof logging.logger.warn ).toBe( 'function' );
    expect( typeof logging.logger.info ).toBe( 'function' );
    expect( typeof logging.logger.debug ).toBe( 'function' );
  } );

  test( 'should not create directory when it already exists', () => {
    const testDir = '/existing-test-dir';

    // Mock process.cwd
    process.cwd = jest.fn().mockReturnValue( testDir );

    // Mock file system calls - directory already exists
    fs.existsSync = jest.fn().mockReturnValue( true );
    fs.mkdirSync = jest.fn();

    // Require the module 
    const logging = require( '../../src/lib/logging.js' );

    // Verify mkdir was not called since directory exists
    expect( fs.mkdirSync ).not.toHaveBeenCalled();

    // Logger should still be created
    expect( logging.logger ).toBeDefined();
  } );

  test( 'should handle various environment configurations', () => {
    const testDir = '/env-test-dir';

    // Test with different LOG_LEVEL
    const originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'warn';

    process.cwd = jest.fn().mockReturnValue( testDir );
    fs.existsSync = jest.fn().mockReturnValue( true );

    // Require the module
    const logging = require( '../../src/lib/logging.js' );

    // Verify logger was created
    expect( logging.logger ).toBeDefined();

    // Restore environment
    process.env.LOG_LEVEL = originalLogLevel;
  } );
} );
