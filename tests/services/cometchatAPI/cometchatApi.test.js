// tests/cometchatApi.test.js
const MockAdapter = require( 'axios-mock-adapter' );

jest.mock( '../../../src/config.js', () => ( {
  COMETCHAT_API_KEY: 'test-api-key',
  COMETCHAT_AUTH_TOKEN: 'test-app-id',
  BOT_UID: 'test-bot-uid'
} ) );

const cometchatApi = require( '../../../src/services/cometchatApi' );

describe( 'cometchatApi module', () => {
  test( 'BASE_URL is constructed correctly', () => {
    expect( cometchatApi.BASE_URL ).toBe( 'https://test-api-key.apiclient-us.cometchat.io' );
  } );

  test( 'headers are defined correctly', () => {
    expect( cometchatApi.headers ).toEqual( {
      'Content-Type': 'application/json',
      'authtoken': 'test-app-id',
      'appid': 'test-api-key',
      'dnt': 1,
      'origin': 'https://tt.live',
      'referer': 'https://tt.live/',
      'sdk': 'javascript@3.0.10'
    } );
  } );

  test( 'apiClient is configured with correct baseURL and headers', () => {
    expect( cometchatApi.apiClient.defaults.baseURL ).toBe( cometchatApi.BASE_URL );
    expect( cometchatApi.apiClient.defaults.headers[ 'Content-Type' ] ).toBe( 'application/json' );
    expect( cometchatApi.apiClient.defaults.headers[ 'authtoken' ] ).toBe( 'test-app-id' );
    expect( cometchatApi.apiClient.defaults.headers[ 'appid' ] ).toBe( 'test-api-key' );
  } );

  test( 'apiClient can make GET requests (mocked)', async () => {
    const mock = new MockAdapter( cometchatApi.apiClient );
    mock.onGet( '/test-endpoint' ).reply( 200, { success: true } );

    const response = await cometchatApi.apiClient.get( '/test-endpoint' );
    expect( response.status ).toBe( 200 );
    expect( response.data ).toEqual( { success: true } );

    mock.restore();
  } );
} );
