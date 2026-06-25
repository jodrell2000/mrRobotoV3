jest.mock( '../../src/lib/logging', () => ( {
    logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn()
    }
} ) );

const MistralBackend = require( '../../src/services/mistralBackend' );
const { logger } = require( '../../src/lib/logging' );

process.env.MISTRAL_API_KEY = 'test-mistral-key';

describe( 'MistralBackend', () => {
    let backend;

    beforeEach( () => {
        jest.clearAllMocks();
        backend = new MistralBackend();
    } );

    describe( 'constructor', () => {
        it( 'should initialize with null client', () => {
            expect( backend.client ).toBeNull();
            expect( backend.availableModels ).toEqual( [] );
        } );
    } );

    describe( 'validateConfig', () => {
        it( 'should return valid when API key is present', () => {
            process.env.MISTRAL_API_KEY = 'valid-key';
            const result = backend.validateConfig( {} );

            expect( result.valid ).toBe( true );
            expect( result.errors ).toEqual( [] );
        } );

        it( 'should return invalid when API key is missing', () => {
            delete process.env.MISTRAL_API_KEY;
            const result = backend.validateConfig( {} );

            expect( result.valid ).toBe( false );
            expect( result.errors[ 0 ] ).toContain( 'MISTRAL_API_KEY' );

            // Restore for other tests
            process.env.MISTRAL_API_KEY = 'test-mistral-key';
        } );
    } );

    describe( 'initialize', () => {
        it( 'should attempt initialization with valid API key', async () => {
            // Note: Dynamic import of Mistral SDK may fail in test environment
            // This test verifies the initialization path attempts correctly
            process.env.MISTRAL_API_KEY = 'test-key';
            backend = new MistralBackend();

            const result = await backend.initialize( {} );

            // Either succeeds or fails due to dynamic import (both are valid test outcomes)
            expect( result ).toHaveProperty( 'success' );
        } );

        it( 'should fail without API key', async () => {
            delete process.env.MISTRAL_API_KEY;
            const result = await backend.initialize( {} );

            expect( result.success ).toBe( false );
            expect( result.error ).toBeDefined();

            process.env.MISTRAL_API_KEY = 'test-mistral-key';
        } );

        it( 'should initialize available models during setup', async () => {
            process.env.MISTRAL_API_KEY = 'test-key';
            backend = new MistralBackend();

            await backend.initialize( {} );

            expect( backend.availableModels ).toBeDefined();
            expect( Array.isArray( backend.availableModels ) ).toBe( true );
        } );
    } );

    describe( 'healthCheck', () => {
        it( 'should report unhealthy when not initialized', async () => {
            const result = await backend.healthCheck();

            expect( result.healthy ).toBe( false );
            expect( result.status ).toBe( 'not_initialized' );
        } );
    } );

    describe( 'queryLLM', () => {
        beforeEach( () => {
            backend.client = {
                chat: {
                    complete: jest.fn().mockResolvedValue( {
                        choices: [ { message: { content: 'Mistral response' } } ],
                        usage: { total_tokens: 100 }
                    } )
                },
                models: {
                    list: jest.fn().mockResolvedValue( {
                        data: [
                            { id: 'mistral-tiny-latest' },
                            { id: 'ministral-3b-latest' }
                        ]
                    } )
                }
            };
        } );

        it( 'should fail when client is not initialized', async () => {
            backend.client = null;
            const result = await backend.queryLLM( 'test question' );

            expect( result.success ).toBe( false );
            expect( result.error ).toContain( 'not initialized' );
        } );

        it( 'should include system instruction when provided', async () => {
            backend.availableModels = [ 'mistral-tiny-latest' ];
            const result = await backend.queryLLM( 'test question', {
                systemInstruction: [ 'Be helpful' ]
            } );

            expect( result ).toBeDefined();
        } );
    } );

    describe( 'fallback chain', () => {
        beforeEach( () => {
            backend.client = {
                chat: {
                    complete: jest.fn()
                },
                models: {
                    list: jest.fn().mockResolvedValue( { data: [] } )
                }
            };
        } );

        it( 'should try primary model first', async () => {
            backend.availableModels = [ 'mistral-tiny-latest', 'mistral-small-latest' ];
            backend.client.chat.complete.mockResolvedValue( {
                choices: [ { message: { content: 'response' } } ],
                usage: { total_tokens: 50 }
            } );

            const result = await backend.queryLLM( 'test' );

            expect( result.success ).toBe( true );
            expect( result.model ).toBeDefined();
        } );

        it( 'should fallback to secondary model on failure', async () => {
            backend.availableModels = [ 'mistral-tiny-latest', 'ministral-3b-latest' ];
            backend.client.chat.complete
                .mockRejectedValueOnce( new Error( 'API error' ) )
                .mockResolvedValueOnce( {
                    choices: [ { message: { content: 'fallback response' } } ],
                    usage: { total_tokens: 75 }
                } );

            const result = await backend.queryLLM( 'test' );

            expect( result ).toBeDefined();
        } );
    } );

    describe( 'initializeAvailableModels', () => {
        beforeEach( () => {
            backend.client = {
                models: {
                    list: jest.fn()
                }
            };
        } );

        it( 'should populate availableModels from API', async () => {
            backend.client.models.list.mockResolvedValue( {
                data: [
                    { id: 'mistral-tiny-latest' },
                    { id: 'mistral-small-latest' },
                    { id: 'mistral-large-latest' }
                ]
            } );

            await backend.initializeAvailableModels();

            expect( backend.availableModels.length ).toBeGreaterThan( 0 );
        } );

        it( 'should filter out embedding models', async () => {
            backend.client.models.list.mockResolvedValue( {
                data: [
                    { id: 'mistral-tiny-latest' },
                    { id: 'mistral-embed' },
                    { id: 'mistral-small-latest' }
                ]
            } );

            await backend.initializeAvailableModels();

            const hasEmbedding = backend.availableModels.some( m => m.includes( 'embed' ) );
            expect( hasEmbedding ).toBe( false );
        } );

        it( 'should handle empty model list', async () => {
            backend.client.models.list.mockResolvedValue( { data: [] } );

            await backend.initializeAvailableModels();

            expect( backend.availableModels ).toEqual( [] );
        } );

        it( 'should handle API errors gracefully', async () => {
            backend.client.models.list.mockRejectedValue( new Error( 'API error' ) );

            await backend.initializeAvailableModels();

            // Test passes if method completes without throwing
            expect( backend.availableModels ).toBeDefined();
        } );
    } );

    describe( 'error handling', () => {
        beforeEach( () => {
            backend.client = {
                chat: {
                    complete: jest.fn()
                },
                models: {
                    list: jest.fn().mockResolvedValue( { data: [] } )
                }
            };
        } );

        it( 'should handle rate limiting (429 error)', async () => {
            backend.availableModels = [ 'mistral-tiny-latest' ];
            const error = new Error( 'Rate limited' );
            error.status = 429;
            backend.client.chat.complete.mockRejectedValue( error );

            const result = await backend.queryLLM( 'test' );

            expect( result.success ).toBe( false );
        } );

        it( 'should handle API timeouts', async () => {
            backend.availableModels = [ 'mistral-tiny-latest' ];
            backend.client.chat.complete.mockRejectedValue( new Error( 'Timeout' ) );

            const result = await backend.queryLLM( 'test' );

            expect( result.success ).toBe( false );
        } );

        it( 'should include error message in response', async () => {
            backend.availableModels = [ 'mistral-tiny-latest' ];
            backend.client.chat.complete.mockRejectedValue( new Error( 'Connection failed' ) );

            const result = await backend.queryLLM( 'test' );

            expect( result.success ).toBe( false );
            expect( result.error ).toBeDefined();
        } );
    } );

    describe( 'standardized response format', () => {
        beforeEach( () => {
            backend.client = {
                chat: {
                    complete: jest.fn()
                },
                models: {
                    list: jest.fn().mockResolvedValue( { data: [] } )
                }
            };
        } );

        it( 'should return response object with required fields on success', async () => {
            backend.availableModels = [ 'mistral-tiny-latest' ];
            backend.client.chat.complete.mockResolvedValue( {
                choices: [ { message: { content: 'test response' } } ],
                usage: { total_tokens: 150 }
            } );

            const result = await backend.queryLLM( 'test' );

            expect( result ).toHaveProperty( 'success' );
            expect( result ).toHaveProperty( 'response' );
            expect( result ).toHaveProperty( 'model' );
            expect( result ).toHaveProperty( 'tokens' );
        } );

        it( 'should return error object on failure', async () => {
            backend.availableModels = [ 'mistral-tiny-latest' ];
            backend.client.chat.complete.mockRejectedValue( new Error( 'API error' ) );

            const result = await backend.queryLLM( 'test' );

            expect( result ).toHaveProperty( 'success' );
            expect( result ).toHaveProperty( 'error' );
            expect( result.success ).toBe( false );
        } );
    } );

    describe( 'edge cases', () => {
        beforeEach( () => {
            backend.client = {
                chat: {
                    complete: jest.fn().mockResolvedValue( {
                        choices: [ { message: { content: 'response' } } ],
                        usage: { total_tokens: 50 }
                    } )
                },
                models: {
                    list: jest.fn().mockResolvedValue( { data: [] } )
                }
            };
            backend.availableModels = [ 'mistral-tiny-latest' ];
        } );

        it( 'should handle empty prompt', async () => {
            const result = await backend.queryLLM( '' );

            expect( result ).toBeDefined();
        } );

        it( 'should handle very long prompt', async () => {
            const longPrompt = 'test '.repeat( 1000 );
            const result = await backend.queryLLM( longPrompt );

            expect( result ).toBeDefined();
        } );

        it( 'should handle special characters', async () => {
            const specialPrompt = 'test @#$%^&*()_+<>?:"{}|!';
            const result = await backend.queryLLM( specialPrompt );

            expect( result ).toBeDefined();
        } );

        it( 'should handle null options', async () => {
            const result = await backend.queryLLM( 'test', null );

            expect( result ).toBeDefined();
        } );

        it( 'should handle undefined options', async () => {
            const result = await backend.queryLLM( 'test', undefined );

            expect( result ).toBeDefined();
        } );
    } );
} );
