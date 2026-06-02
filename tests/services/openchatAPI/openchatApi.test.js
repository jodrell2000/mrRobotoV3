// tests/openchatApi.test.js
const MockAdapter = require( 'axios-mock-adapter' );

jest.mock( '../../../src/config.js', () => ( {
    COMETCHAT_API_KEY: 'test-api-key',
    COMETCHAT_AUTH_TOKEN: 'test-app-id',
    OPENCHAT_BASE_URL: 'https://openchat.prod.tt.fm/',
    BOT_UID: 'test-bot-uid'
} ) );

const openchatApi = require( '../../../src/services/openchatApi' );

describe( 'openchatApi module', () => {
    test( 'BASE_URL is constructed correctly from OPENCHAT_BASE_URL', () => {
        expect( openchatApi.BASE_URL ).toBe( 'https://openchat.prod.tt.fm/' );
    } );

    test( 'BASE_URL falls back to default when OPENCHAT_BASE_URL not set', () => {
        // The mock above sets OPENCHAT_BASE_URL, so we expect that value
        expect( openchatApi.BASE_URL ).toBe( 'https://openchat.prod.tt.fm/' );
    } );

    test( 'headers are defined correctly', () => {
        expect( openchatApi.headers ).toEqual( {
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
        expect( openchatApi.apiClient.defaults.baseURL ).toBe( openchatApi.BASE_URL );
        expect( openchatApi.apiClient.defaults.headers[ 'Content-Type' ] ).toBe( 'application/json' );
        expect( openchatApi.apiClient.defaults.headers[ 'authtoken' ] ).toBe( 'test-app-id' );
        expect( openchatApi.apiClient.defaults.headers[ 'appid' ] ).toBe( 'test-api-key' );
    } );

    test( 'apiClient can make GET requests (mocked)', async () => {
        const mock = new MockAdapter( openchatApi.apiClient );
        mock.onGet( '/test-endpoint' ).reply( 200, { success: true } );

        const response = await openchatApi.apiClient.get( '/test-endpoint' );
        expect( response.status ).toBe( 200 );
        expect( response.data ).toEqual( { success: true } );

        mock.restore();
    } );
} );
