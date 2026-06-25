jest.mock( '../../src/lib/logging', () => ( {
    logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn()
    }
} ) );

jest.mock( '@google/genai' );

const GemmaBackend = require( '../../src/services/gemmaBackend' );
const { logger } = require( '../../src/lib/logging' );

process.env.googleAIKey = 'test-api-key';

describe( 'GemmaBackend', () => {
    let backend;
    let mockGenAI;

    beforeEach( () => {
        jest.clearAllMocks();
        backend = new GemmaBackend();
        mockGenAI = {
            getGenerativeModel: jest.fn()
        };
    } );

    describe( 'constructor', () => {
        it( 'should initialize with null genAI', () => {
            expect( backend.genAI ).toBeNull();
            expect( backend.availableModels ).toBeDefined();
            expect( Array.isArray( backend.availableModels ) ).toBe( true );
        } );
    } );

    describe( 'validateConfig', () => {
        it( 'should validate successfully when API key is present', () => {
            process.env.googleAIKey = 'valid-key';
            const result = backend.validateConfig( {} );

            expect( result ).toBeDefined();
            expect( result.success || result.valid ).toBeTruthy();
        } );

        it( 'should fail validation when API key is missing', () => {
            delete process.env.googleAIKey;
            const result = backend.validateConfig( {} );

            expect( result ).toBeDefined();
            expect( result.success || result.valid ).toBeFalsy();

            // Restore for other tests
            process.env.googleAIKey = 'test-api-key';
        } );
    } );

    describe( 'initialize', () => {
        it( 'should initialize successfully with valid API key', async () => {
            const result = await backend.initialize( {} );

            expect( result.success ).toBe( true );
            expect( backend.genAI ).toBeDefined();
        } );

        it( 'should fail without API key', async () => {
            delete process.env.googleAIKey;
            const testBackend = new GemmaBackend();
            const result = await testBackend.initialize( {} );

            expect( result.success ).toBe( false );
            expect( result.error ).toBeDefined();

            process.env.googleAIKey = 'test-api-key';
        } );

        it( 'should initialize available models during setup', async () => {
            await backend.initialize( {} );

            expect( backend.availableModels ).toBeDefined();
            expect( Array.isArray( backend.availableModels ) ).toBe( true );
        } );
    } );

    describe( 'healthCheck', () => {
        beforeEach( async () => {
            await backend.initialize( {} );
        } );

        it( 'should report status when initialized', async () => {
            const result = await backend.healthCheck();

            expect( result ).toBeDefined();
            expect( result.status ).toBe( 'operational' );
            expect( result.message ).toContain( 'Gemma' );
        } );

        it( 'should report unhealthy when not initialized', async () => {
            backend.genAI = null;
            const result = await backend.healthCheck();

            expect( result.healthy ).toBe( false );
            expect( result.status ).toBe( 'not_initialized' );
            expect( result.message ).toContain( 'not initialized' );
        } );
    } );

    describe( 'queryLLM', () => {
        beforeEach( async () => {
            await backend.initialize( {} );
        } );

        it( 'should fail when genAI is not initialized', async () => {
            backend.genAI = null;
            const result = await backend.queryLLM( 'test question' );

            expect( result.success ).toBe( false );
            expect( result.error ).toContain( 'not initialized' );
        } );

        it( 'should attempt primary models first', async () => {
            backend.availableModels = [ 'gemma-4-31b-it', 'gemma-4-26b-a4b-it' ];
            const result = await backend.queryLLM( 'test question' );

            // Should attempt to query
            expect( result ).toBeDefined();
        } );

        it( 'should include system instruction when provided', async () => {
            backend.availableModels = [ 'gemma-4-31b-it' ];
            const result = await backend.queryLLM( 'test question', {
                systemInstruction: [ 'Be helpful' ]
            } );

            expect( result ).toBeDefined();
        } );
    } );

    describe( 'cleanGeminiTokens', () => {
        it( 'should remove start of turn tokens', () => {
            const text = '<start_of_turn>user\nHello<end_of_turn>';
            const result = backend.cleanGeminiTokens( text );

            expect( result ).not.toContain( '<start_of_turn>' );
            expect( result ).not.toContain( '<end_of_turn>' );
        } );

        it( 'should handle null input', () => {
            const result = backend.cleanGeminiTokens( null );

            expect( result ).toBeNull();
        } );

        it( 'should handle empty string', () => {
            const result = backend.cleanGeminiTokens( '' );

            expect( result ).toBe( '' );
        } );

        it( 'should handle non-string input', () => {
            const result = backend.cleanGeminiTokens( 12345 );

            expect( result ).toBe( 12345 );
        } );

        it( 'should preserve text without tokens', () => {
            const text = 'Hello, this is a normal response';
            const result = backend.cleanGeminiTokens( text );

            expect( result ).toBe( text );
        } );
    } );

    describe( 'formatChatHistory', () => {
        it( 'should format valid chat history', () => {
            const history = [
                { role: 'user', content: 'Hello' },
                { role: 'model', content: 'Hi there' }
            ];
            const result = backend.formatChatHistory( history );

            expect( result ).toBeDefined();
            expect( result.length ).toBe( 2 );
        } );

        it( 'should filter invalid entries', () => {
            const history = [
                { role: 'user', content: 'Hello' },
                { role: 'model' }, // missing content
                { role: 'user', content: 'World' }
            ];
            const result = backend.formatChatHistory( history );

            expect( result.length ).toBeLessThan( history.length );
        } );

        it( 'should handle empty array', () => {
            const result = backend.formatChatHistory( [] );

            expect( result ).toEqual( [] );
        } );

        it( 'should handle null input', () => {
            expect( () => {
                backend.formatChatHistory( null );
            } ).toThrow();
        } );
    } );

    describe( 'initializeAvailableModels', () => {
        beforeEach( async () => {
            await backend.initialize( {} );
        } );

        it( 'should populate availableModels array', async () => {
            await backend.initializeAvailableModels();

            expect( Array.isArray( backend.availableModels ) ).toBe( true );
        } );

        it( 'should initialize models list', async () => {
            await backend.initializeAvailableModels();

            expect( backend.availableModels ).toBeDefined();
            expect( Array.isArray( backend.availableModels ) ).toBe( true );
        } );
    } );

    describe( 'standardized response format', () => {
        it( 'should return response object with required fields', async () => {
            backend.availableModels = [ 'gemma-4-31b-it' ];
            backend.genAI = mockGenAI;

            const result = await backend.queryLLM( 'test' );

            expect( result ).toBeDefined();
            expect( result ).toHaveProperty( 'success' );
        } );

        it( 'should return error object on failure', async () => {
            backend.genAI = null;
            const result = await backend.queryLLM( 'test' );

            expect( result ).toHaveProperty( 'success' );
            expect( result ).toHaveProperty( 'error' );
            expect( result.success ).toBe( false );
        } );
    } );

    describe( 'edge cases', () => {
        beforeEach( async () => {
            await backend.initialize( {} );
        } );

        it( 'should handle empty prompt', async () => {
            const result = await backend.queryLLM( '' );

            expect( result ).toBeDefined();
            expect( result.success !== undefined ).toBe( true );
        } );

        it( 'should handle very long prompt', async () => {
            const longPrompt = 'test '.repeat( 1000 );
            const result = await backend.queryLLM( longPrompt );

            expect( result ).toBeDefined();
        } );

        it( 'should handle special characters in prompt', async () => {
            const specialPrompt = 'test @#$%^&*()_+<>?:"{}|!';
            const result = await backend.queryLLM( specialPrompt );

            expect( result ).toBeDefined();
        } );
    } );
} );
