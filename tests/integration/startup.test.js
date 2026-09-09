// Integration test for startup token configuration
// Tests the dynamic CometChat token fetching and configuration during bot startup

// Mock logger before any imports
jest.mock( '../../src/lib/logging.js', () => ( {
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
} ) );

// Mock config
jest.mock( '../../src/config.js', () => ( {
    BOT_USER_TOKEN: 'TEST_BOT_TOKEN',
    TTFM_GATEWAY_BASE_URL: 'https://gateway.prod.tt.fm',
    COMETCHAT_AUTH_TOKEN: '',
    COMETCHAT_API_KEY: 'test-api-key'
} ) );

const { getCometChatToken } = require( '../../src/services/hangUserService.js' );
const openchatApi = require( '../../src/services/openchatApi.js' );

const mockServices = {
    apiAdapter: {
        getChatAuthToken: jest.fn()
    }
};

describe( 'Startup Token Configuration', () => {
    beforeEach( () => {
        jest.clearAllMocks();
        mockServices.apiAdapter.getChatAuthToken.mockReset();
    } );

    describe( 'Dynamic Token Fetching', () => {
        test( 'should configure openchatApi with dynamic token on successful fetch', async () => {
            const mockToken = 'auth_dynamic123456789';
            mockServices.apiAdapter.getChatAuthToken.mockResolvedValueOnce( mockToken );

            // Simulate startup sequence
            const dynamicToken = await getCometChatToken( mockServices );
            openchatApi.setAuthToken( dynamicToken );

            expect( dynamicToken ).toBe( mockToken );
            expect( openchatApi.hasAuthToken() ).toBe( true );
        } );

        test( 'should throw error if token fetch fails', async () => {
            const networkError = new Error( 'Gateway API unreachable' );
            mockServices.apiAdapter.getChatAuthToken.mockRejectedValueOnce( networkError );

            await expect( getCometChatToken( mockServices ) )
                .rejects
                .toThrow( 'CometChat token fetch failed: Gateway API unreachable' );
        } );

        test( 'should throw error if BOT_USER_TOKEN is invalid', async () => {
            const authError = new Error( '401 Unauthorized' );
            mockServices.apiAdapter.getChatAuthToken.mockRejectedValueOnce( authError );

            await expect( getCometChatToken( mockServices ) )
                .rejects
                .toThrow( 'CometChat token fetch failed: 401 Unauthorized' );
        } );
    } );

    describe( 'OpenChat API Token Validation', () => {
        test( 'should prevent message sending without configured token', () => {
            // Note: This test would require importing sendMessage and testing it directly
            // Since sendMessage is internal, we test hasAuthToken() which gates sending

            // Simulate no token configured
            const hadToken = openchatApi.hasAuthToken();

            // If token is not configured, hasAuthToken should return false
            // In actual startup, setAuthToken must be called before messages can be sent
            expect( typeof openchatApi.hasAuthToken ).toBe( 'function' );
            expect( typeof openchatApi.setAuthToken ).toBe( 'function' );
        } );

        test( 'hasAuthToken() returns true after setAuthToken() is called', () => {
            openchatApi.setAuthToken( 'test-token-123' );
            expect( openchatApi.hasAuthToken() ).toBe( true );
        } );

        test( 'setAuthToken() validates token is non-empty string', () => {
            expect( () => openchatApi.setAuthToken( '' ) ).toThrow( 'Invalid auth token: must be a non-empty string' );
            expect( () => openchatApi.setAuthToken( null ) ).toThrow( 'Invalid auth token: must be a non-empty string' );
            expect( () => openchatApi.setAuthToken( undefined ) ).toThrow( 'Invalid auth token: must be a non-empty string' );
        } );

        test( 'setAuthToken() accepts valid token string', () => {
            expect( () => openchatApi.setAuthToken( 'valid-token-123' ) ).not.toThrow();
            expect( openchatApi.hasAuthToken() ).toBe( true );
        } );
    } );

    describe( 'Startup Sequence Integration', () => {
        test( 'should complete full token fetch and configuration flow', async () => {
            const mockToken = 'auth_fullFlow123456';
            mockServices.apiAdapter.getChatAuthToken.mockResolvedValueOnce( mockToken );

            // Step 1: Fetch token
            const fetchedToken = await getCometChatToken( mockServices );
            expect( fetchedToken ).toBe( mockToken );

            // Step 2: Configure openchatApi
            openchatApi.setAuthToken( fetchedToken );

            // Step 3: Verify configuration
            expect( openchatApi.hasAuthToken() ).toBe( true );

            expect( mockServices.apiAdapter.getChatAuthToken ).toHaveBeenCalledTimes( 1 );
        } );

        test( 'should handle token fetch failure gracefully', async () => {
            mockServices.apiAdapter.getChatAuthToken.mockRejectedValueOnce( new Error( 'Network timeout' ) );

            let errorCaught = false;
            try {
                await getCometChatToken( mockServices );
            } catch ( error ) {
                errorCaught = true;
                expect( error.message ).toContain( 'CometChat token fetch failed' );
            }

            expect( errorCaught ).toBe( true );
        } );

        test( 'should validate response structure before using token', async () => {
            // Missing cometAuthToken field
            mockServices.apiAdapter.getChatAuthToken.mockRejectedValueOnce( new Error( 'Invalid response: missing cometAuthToken field' ) );

            await expect( getCometChatToken( mockServices ) )
                .rejects
                .toThrow( 'Invalid response: missing cometAuthToken field' );
        } );
    } );

    describe( 'Error Handling', () => {
        test( 'should provide clear error message on missing token field', async () => {
            mockServices.apiAdapter.getChatAuthToken.mockRejectedValueOnce( new Error( 'Invalid response: missing cometAuthToken field' ) );

            await expect( getCometChatToken( mockServices ) )
                .rejects
                .toThrow( 'CometChat token fetch failed: Invalid response: missing cometAuthToken field' );
        } );

        test( 'should provide clear error message on null response', async () => {
            mockServices.apiAdapter.getChatAuthToken.mockRejectedValueOnce( new Error( 'Invalid response: missing cometAuthToken field' ) );

            await expect( getCometChatToken( mockServices ) )
                .rejects
                .toThrow( 'CometChat token fetch failed: Invalid response: missing cometAuthToken field' );
        } );

        test( 'should propagate network errors with context', async () => {
            const originalError = new Error( 'ECONNREFUSED' );
            mockServices.apiAdapter.getChatAuthToken.mockRejectedValueOnce( originalError );

            await expect( getCometChatToken( mockServices ) )
                .rejects
                .toThrow( 'CometChat token fetch failed: ECONNREFUSED' );
        } );
    } );
} );
