// Mock logger to keep test output clean
jest.mock( '../../src/lib/logging.js', () => ( {
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
} ) );

const { getUserNicknameByUuid, getAllPresentUsers, getCometChatToken } = require( '../../src/services/hangUserService.js' );

describe( 'hangUserService.getUserNicknameByUuid', () => {
  let mockServices;

  beforeEach( () => {
    jest.clearAllMocks();
    mockServices = {
      apiAdapter: {
        getUserProfile: jest.fn()
      },
      config: {
        BOT_UID: 'test-bot-uid'
      }
    };
  } );

  test( 'returns nickname when response contains top-level nickname', async () => {
    mockServices.apiAdapter.getUserProfile.mockResolvedValueOnce( { nickname: 'Alice' } );

    const uuid = 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc';
    const nickname = await getUserNicknameByUuid( mockServices, uuid );

    expect( nickname ).toBe( 'Alice' );
    expect( mockServices.apiAdapter.getUserProfile ).toHaveBeenCalledWith( uuid );
  } );

  test( 'returns nickname when response contains nested data.nickname', async () => {
    mockServices.apiAdapter.getUserProfile.mockResolvedValueOnce( { data: { nickname: 'Bob' } } );

    const nickname = await getUserNicknameByUuid( mockServices, 'abc' );
    expect( nickname ).toBe( 'Bob' );
  } );

  test( 'throws with clear message when nickname is missing', async () => {
    mockServices.apiAdapter.getUserProfile.mockResolvedValueOnce( {} );
    const uuid = 'no-nickname';

    await expect( getUserNicknameByUuid( mockServices, uuid ) )
      .rejects
      .toThrow( `Unable to resolve nickname for UUID ${ uuid }: Nickname not found in response` );
  } );

  test( 'throws for invalid UUID (empty string)', async () => {
    await expect( getUserNicknameByUuid( mockServices, '' ) )
      .rejects
      .toThrow( 'Unable to resolve nickname for UUID : userUuid must be a non-empty string' );
  } );

  test( 'throws for invalid UUID (non-string)', async () => {
    await expect( getUserNicknameByUuid( mockServices, null ) )
      .rejects
      .toThrow( 'Unable to resolve nickname for UUID null: userUuid must be a non-empty string' );
  } );

  test( 'throws when services parameter is missing', async () => {
    await expect( getUserNicknameByUuid( null, 'test-uuid' ) )
      .rejects
      .toThrow( 'Unable to resolve nickname for UUID test-uuid: services parameter is required' );
  } );

  test( 'throws when apiAdapter is not available', async () => {
    const invalidServices = { config: { BOT_UID: 'test-bot-uid' } };

    await expect( getUserNicknameByUuid( invalidServices, 'test-uuid' ) )
      .rejects
      .toThrow( 'Unable to resolve nickname for UUID test-uuid: API adapter not available' );
  } );
} );

describe( 'hangUserService.getAllPresentUsers', () => {
  let mockServices;

  beforeEach( () => {
    jest.clearAllMocks();
    mockServices = {
      apiAdapter: {
        getAllPresentUsers: jest.fn()
      }
    };
  } );

  test( 'returns array of UUIDs from apiAdapter', async () => {
    const expectedUuids = [
      'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc',
      'f3efc54f-1090-4a83-b5e4-73328eb649d1'
    ];
    mockServices.apiAdapter.getAllPresentUsers.mockResolvedValueOnce( expectedUuids );

    const result = await getAllPresentUsers( mockServices );

    expect( result ).toEqual( expectedUuids );
    expect( mockServices.apiAdapter.getAllPresentUsers ).toHaveBeenCalledWith( mockServices );
  } );

  test( 'returns empty array when services is null or undefined', async () => {
    expect( await getAllPresentUsers( null ) ).toEqual( [] );
    expect( await getAllPresentUsers( undefined ) ).toEqual( [] );
  } );

  test( 'returns empty array when apiAdapter is missing', async () => {
    const invalidServices = {};

    const result = await getAllPresentUsers( invalidServices );

    expect( result ).toEqual( [] );
  } );

  test( 'handles errors gracefully and returns empty array', async () => {
    mockServices.apiAdapter.getAllPresentUsers.mockRejectedValueOnce( new Error( 'Adapter error' ) );

    const result = await getAllPresentUsers( mockServices );

    expect( result ).toEqual( [] );
  } );
} );

describe( 'hangUserService.getCometChatToken', () => {
  let mockServices;

  beforeEach( () => {
    jest.clearAllMocks();
    mockServices = {
      apiAdapter: {
        getChatAuthToken: jest.fn()
      }
    };
  } );

  test( 'should successfully fetch token from apiAdapter', async () => {
    const mockToken = 'auth_test1234567890abcdef';
    mockServices.apiAdapter.getChatAuthToken.mockResolvedValueOnce( mockToken );

    const token = await getCometChatToken( mockServices );

    expect( token ).toBe( mockToken );
    expect( mockServices.apiAdapter.getChatAuthToken ).toHaveBeenCalled();
  } );

  test( 'should throw error on adapter failure', async () => {
    const adapterError = new Error( 'Network request failed' );
    mockServices.apiAdapter.getChatAuthToken.mockRejectedValueOnce( adapterError );

    await expect( getCometChatToken( mockServices ) )
      .rejects
      .toThrow( 'CometChat token fetch failed: Network request failed' );
  } );

  test( 'should throw error when apiAdapter is not available', async () => {
    const invalidServices = {};

    await expect( getCometChatToken( invalidServices ) )
      .rejects
      .toThrow( 'API adapter not available' );
  } );
} );

test( 'should use correct endpoint URL', async () => {
  makeRequest.mockResolvedValueOnce( { cometAuthToken: 'token123' } );

  await getCometChatToken();

  const callArgs = makeRequest.mock.calls[ 0 ];
  expect( callArgs[ 0 ] ).toBe( 'https://gateway.prod.tt.fm/api/user-service/comet-chat/user-token' );
} );

test( 'should use GET method', async () => {
  makeRequest.mockResolvedValueOnce( { cometAuthToken: 'token123' } );

  await getCometChatToken();

  const callArgs = makeRequest.mock.calls[ 0 ];
  expect( callArgs[ 1 ].method ).toBe( 'GET' );
} );

test( 'should include accept header for JSON', async () => {
  makeRequest.mockResolvedValueOnce( { cometAuthToken: 'token123' } );

  await getCometChatToken();

  const callArgs = makeRequest.mock.calls[ 0 ];
  expect( callArgs[ 2 ].accept ).toBe( 'application/json' );
} );
} );


