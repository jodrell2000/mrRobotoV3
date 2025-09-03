// Mock the modules before importing messageService
jest.mock( '../../../src/lib/logging.js', () => ( {
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
} ) );

jest.mock( '../../../src/services/cometchatApi' );
jest.mock( '../../../src/lib/buildUrl', () => ( {
  buildUrl: jest.fn()
} ) );

// Now import the modules that use the mocked dependencies
const { messageService } = require( '../../../src/services/messageService.js' );
const cometchatApi = require( '../../../src/services/cometchatApi' );
const { buildUrl } = require( '../../../src/lib/buildUrl' );
const { logger } = require( '../../../src/lib/logging.js' );

describe( 'fetchGroupMessagesRaw', () => {
  beforeEach( () => {
    buildUrl.mockImplementation( () => 'https://fakeurl.com/api/messages' );
  } );

  afterEach( () => {
    jest.clearAllMocks();
  } );

  test( 'returns messages when API responds with data', async () => {
    const fakeMessages = [ { id: 1, data: { text: 'Hello' } } ];
    cometchatApi.fetchMessages.mockResolvedValue( { data: { data: fakeMessages } } );

    const result = await messageService.fetchGroupMessagesRaw( 'test-room-id', [ [ 'per_page', 1 ] ] );

    expect( result ).toEqual( fakeMessages );
    expect( cometchatApi.fetchMessages ).toHaveBeenCalled();
    expect( logger.error ).not.toHaveBeenCalled(); // no error expected here
  } );

  test( 'returns empty array and logs error when API throws an error (async rejection)', async () => {
    const error = new Error( 'Network error' );
    cometchatApi.fetchMessages.mockRejectedValue( error );

    const result = await messageService.fetchGroupMessagesRaw( 'test-room-id', [ [ 'per_page', 1 ] ] );

    expect( result ).toEqual( [] );
    expect( logger.error ).toHaveBeenCalledWith( expect.stringContaining( '❌ Error in fetchGroupMessagesRaw:' ) );
  } );

  test( 'returns empty array and logs error when API throws an error (sync throw)', async () => {
    const error = new Error( 'Sync error' );
    cometchatApi.fetchMessages.mockImplementation( () => { throw error; } );

    const result = await messageService.fetchGroupMessagesRaw( 'test-room-id', [ [ 'per_page', 1 ] ] );

    expect( result ).toEqual( [] );
    expect( logger.error ).toHaveBeenCalledWith( expect.stringContaining( '❌ Error in fetchGroupMessagesRaw:' ) );
  } );

  test( 'returns empty array and logs error when buildUrl throws', async () => {
    const error = new Error( 'buildUrl failed' );
    cometchatApi.fetchMessages.mockRejectedValue( error );

    const result = await messageService.fetchGroupMessagesRaw( 'test-room-id', [ [ 'per_page', 1 ] ] );

    expect( result ).toEqual( [] );
    expect( logger.error ).toHaveBeenCalledWith( expect.stringContaining( '❌ Error in fetchGroupMessagesRaw:' ) );
  } );

  test( 'returns empty array if response data.data is missing', async () => {
    cometchatApi.fetchMessages.mockResolvedValue( { data: {} } );

    const result = await messageService.fetchGroupMessagesRaw( 'test-room-id' );

    expect( result ).toEqual( [] );
    expect( logger.error ).not.toHaveBeenCalled();
  } );
} );