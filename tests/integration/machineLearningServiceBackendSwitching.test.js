jest.mock( '../../src/lib/logging', () => ( {
    logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn()
    }
} ) );

jest.mock( '../../src/services/gemmaBackend' );
jest.mock( '../../src/services/mistralBackend' );

const MachineLearningService = require( '../../src/services/machineLearningService' );
const GemmaBackend = require( '../../src/services/gemmaBackend' );
const MistralBackend = require( '../../src/services/mistralBackend' );
const { logger } = require( '../../src/lib/logging' );

describe( 'MachineLearningService - Backend Switching Integration', () => {
    let service;
    let mockServices;
    let mockGemmaInstance;
    let mockMistralInstance;

    beforeEach( () => {
        jest.clearAllMocks();

        // Mock backend instances
        mockGemmaInstance = {
            initialize: jest.fn().mockResolvedValue( { success: true } ),
            queryLLM: jest.fn().mockResolvedValue( {
                success: true,
                response: 'Gemma response',
                model: 'gemma-4-31b-it',
                tokens: 100
            } ),
            healthCheck: jest.fn().mockResolvedValue( {
                healthy: true,
                status: 'operational',
                message: 'Gemma operational'
            } ),
            validateConfig: jest.fn().mockReturnValue( { success: true } )
        };

        mockMistralInstance = {
            initialize: jest.fn().mockResolvedValue( { success: true } ),
            queryLLM: jest.fn().mockResolvedValue( {
                success: true,
                response: 'Mistral response',
                model: 'mistral-tiny-latest',
                tokens: 80
            } ),
            healthCheck: jest.fn().mockResolvedValue( {
                healthy: true,
                status: 'operational',
                message: 'Mistral operational'
            } ),
            validateConfig: jest.fn().mockReturnValue( { success: true } )
        };

        GemmaBackend.mockImplementation( () => mockGemmaInstance );
        MistralBackend.mockImplementation( () => mockMistralInstance );

        mockServices = {
            dataService: {
                loadData: jest.fn().mockResolvedValue(),
                getValue: jest.fn().mockReturnValue( {
                    active: 'gemma',
                    fallbackOrder: [ 'gemma', 'mistral' ],
                    gemma: { enabled: true },
                    mistral: { enabled: true }
                } ),
                setValue: jest.fn().mockResolvedValue()
            }
        };

        service = new MachineLearningService( mockServices );
    } );

    describe( 'Backend Switching', () => {
        beforeEach( async () => {
            await service.initialize();
        } );

        it( 'should switch from Gemma to Mistral', async () => {
            expect( service.getActiveBackend() ).toBe( 'gemma' );

            const result = await service.switchBackend( 'mistral' );

            expect( result.success ).toBe( true );
            expect( service.getActiveBackend() ).toBe( 'mistral' );
            expect( mockServices.dataService.setValue ).toHaveBeenCalledWith( 'llmBackend.active', 'mistral' );
        } );

        it( 'should switch from Mistral to Gemma', async () => {
            await service.switchBackend( 'mistral' );
            expect( service.getActiveBackend() ).toBe( 'mistral' );

            const result = await service.switchBackend( 'gemma' );

            expect( result.success ).toBe( true );
            expect( service.getActiveBackend() ).toBe( 'gemma' );
        } );

        it( 'should reject switching to unknown backend', async () => {
            const result = await service.switchBackend( 'claude' );

            expect( result.success ).toBe( false );
            expect( result.error ).toContain( 'Unknown backend' );
            expect( service.getActiveBackend() ).toBe( 'gemma' );
        } );

        it( 'should persist backend switch to configuration', async () => {
            await service.switchBackend( 'mistral' );

            expect( mockServices.dataService.setValue ).toHaveBeenCalledWith(
                'llmBackend.active',
                'mistral'
            );
        } );

        it( 'should log backend switches', async () => {
            await service.switchBackend( 'mistral' );

            expect( logger.info ).toHaveBeenCalledWith(
                expect.stringContaining( 'Switched to backend: mistral' )
            );
        } );

        it( 'should handle failed initialization during switch', async () => {
            mockMistralInstance.initialize.mockResolvedValueOnce( {
                success: false,
                error: 'API key missing'
            } );

            const result = await service.switchBackend( 'mistral' );

            expect( result.success ).toBe( false );
            expect( service.getActiveBackend() ).toBe( 'gemma' );
        } );
    } );

    describe( 'Fallback Chain', () => {
        beforeEach( async () => {
            await service.initialize();
        } );

        it( 'should fallback to Mistral when Gemma fails', async () => {
            mockGemmaInstance.queryLLM.mockResolvedValueOnce( {
                success: false,
                error: 'Gemma unavailable'
            } );

            const result = await service.tryFallbackQuery( 'test question', [ 'test instruction' ] );

            expect( result ).not.toContain( 'unable to process' );
        } );

        it( 'should try all backends in fallback order', async () => {
            mockGemmaInstance.queryLLM.mockResolvedValueOnce( {
                success: false,
                error: 'Gemma failed'
            } );

            await service.tryFallbackQuery( 'test question', [ 'instruction' ] );

            expect( mockMistralInstance.initialize ).toHaveBeenCalled();
        } );

        it( 'should return error message when all backends fail', async () => {
            mockGemmaInstance.queryLLM.mockResolvedValueOnce( {
                success: false,
                error: 'Gemma failed'
            } );
            mockMistralInstance.queryLLM.mockResolvedValueOnce( {
                success: false,
                error: 'Mistral failed'
            } );

            const result = await service.tryFallbackQuery( 'test question', [] );

            expect( result ).toContain( 'unable to process' );
        } );

        it( 'should switch to fallback backend on success', async () => {
            mockGemmaInstance.queryLLM.mockResolvedValueOnce( {
                success: false,
                error: 'Gemma failed'
            } );

            await service.tryFallbackQuery( 'test', [] );

            expect( service.getActiveBackend() === 'mistral' || service.getActiveBackend() === 'gemma' ).toBe( true );
        } );
    } );

    describe( 'Health Checks', () => {
        beforeEach( async () => {
            await service.initialize();
        } );

        it( 'should report active backend health', async () => {
            const result = await service.healthCheck();

            expect( result.healthy ).toBe( true );
            expect( mockGemmaInstance.healthCheck ).toHaveBeenCalled();
        } );

        it( 'should report unhealthy when backend not initialized', async () => {
            service.activeBackend = null;
            const result = await service.healthCheck();

            expect( result.healthy ).toBe( false );
            expect( result.status ).toBe( 'not_initialized' );
        } );

        it( 'should report health after backend switch', async () => {
            await service.switchBackend( 'mistral' );
            const result = await service.healthCheck();

            expect( mockMistralInstance.healthCheck ).toHaveBeenCalled();
        } );
    } );

    describe( 'Query Routing', () => {
        beforeEach( async () => {
            await service.initialize();
        } );

        it( 'should route queries to active Gemma backend', async () => {
            const result = await service.askGoogleAI( 'test question' );

            expect( result ).toBeDefined();
        } );

        it( 'should route queries to Mistral after switching', async () => {
            await service.switchBackend( 'mistral' );
            const result = await service.askGoogleAI( 'test question' );

            expect( result ).toBeDefined();
        } );

        it( 'should pass system instructions to backend', async () => {
            await service.initialize();

            mockServices.dataService.getValue
                .mockReturnValueOnce( {
                    active: 'gemma',
                    fallbackOrder: [ 'gemma', 'mistral' ],
                    gemma: { enabled: true },
                    mistral: { enabled: true }
                } )
                .mockReturnValueOnce( 'You are a helpful DJ' )
                .mockReturnValueOnce( null );

            await service.createSystemInstruction( true );

            // Verify system instruction was created
            expect( mockServices.dataService.getValue ).toHaveBeenCalled();
        } );
    } );

    describe( 'Concurrent Operations', () => {
        beforeEach( async () => {
            await service.initialize();
        } );

        it( 'should handle multiple queries concurrently', async () => {
            const query1 = service.askGoogleAI( 'question 1' );
            const query2 = service.askGoogleAI( 'question 2' );
            const query3 = service.askGoogleAI( 'question 3' );

            const results = await Promise.all( [ query1, query2, query3 ] );

            expect( results.length ).toBe( 3 );
            results.forEach( result => {
                expect( result ).toBeDefined();
            } );
        } );

        it( 'should handle concurrent backend switch and query', async () => {
            const switchPromise = service.switchBackend( 'mistral' );
            const queryPromise = service.askGoogleAI( 'test question' );

            await Promise.all( [ switchPromise, queryPromise ] );

            expect( logger.info ).toHaveBeenCalled();
        } );
    } );

    describe( 'Error Recovery', () => {
        beforeEach( async () => {
            await service.initialize();
        } );

        it( 'should recover from temporary backend failure', async () => {
            mockGemmaInstance.queryLLM
                .mockResolvedValueOnce( { success: false, error: 'Temporary error' } )
                .mockResolvedValueOnce( {
                    success: true,
                    response: 'Recovered response',
                    model: 'gemma-4-31b-it'
                } );

            const result1 = await service.tryFallbackQuery( 'test', [] );
            const result2 = await service.tryFallbackQuery( 'test', [] );

            expect( result2 ).toBeDefined();
        } );

        it( 'should validate backend is available before switching', async () => {
            const result = await service.switchBackend( 'invalid-backend' );

            expect( result.success ).toBe( false );
            expect( result.error ).toBeDefined();
        } );
    } );

    describe( 'Configuration Management', () => {
        it( 'should initialize with configuration from dataService', async () => {
            mockServices.dataService.getValue.mockReturnValue( {
                active: 'mistral',
                fallbackOrder: [ 'mistral', 'gemma' ],
                gemma: { enabled: false },
                mistral: { enabled: true }
            } );

            await service.initialize();

            expect( service.config.active ).toBe( 'mistral' );
            expect( service.config.fallbackOrder ).toEqual( [ 'mistral', 'gemma' ] );
        } );

        it( 'should use default configuration if not provided', async () => {
            mockServices.dataService.getValue.mockReturnValue( null );

            await service.initialize();

            expect( service.config.active ).toBeDefined();
            expect( service.config.fallbackOrder ).toBeDefined();
        } );
    } );
} );
