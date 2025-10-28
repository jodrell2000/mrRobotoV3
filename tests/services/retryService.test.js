const RetryService = require( '../../src/services/retryService' );

// Mock the logger to prevent test logs from appearing in production
jest.mock( '../../src/lib/logging.js', () => ( {
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
} ) );

describe( 'RetryService', () => {
    let retryService;

    beforeEach( () => {
        retryService = new RetryService();
        jest.clearAllMocks();
    } );

    describe( 'executeWithRetry', () => {
        it( 'should execute function successfully on first attempt', async () => {
            const mockFn = jest.fn().mockResolvedValue( 'success' );

            const result = await retryService.executeWithRetry( mockFn, {}, 'test-endpoint' );

            expect( result ).toBe( 'success' );
            expect( mockFn ).toHaveBeenCalledTimes( 1 );
        } );

        it( 'should retry on retryable errors', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce( new Error( 'socket hang up' ) )
                .mockResolvedValueOnce( 'success' );

            const result = await retryService.executeWithRetry( mockFn, { maxRetries: 2 }, 'test-endpoint' );

            expect( result ).toBe( 'success' );
            expect( mockFn ).toHaveBeenCalledTimes( 2 );
        } );

        it( 'should not retry on non-retryable errors', async () => {
            const error = new Error( 'Invalid request' );
            error.response = { status: 400 };
            const mockFn = jest.fn().mockRejectedValue( error );

            await expect( retryService.executeWithRetry( mockFn, {}, 'test-endpoint' ) )
                .rejects.toThrow( 'Invalid request' );

            expect( mockFn ).toHaveBeenCalledTimes( 1 );
        } );

        it( 'should implement exponential backoff', async () => {
            jest.spyOn( retryService, 'delay' ).mockResolvedValue();

            const mockFn = jest.fn()
                .mockRejectedValueOnce( new Error( 'ECONNRESET' ) )
                .mockRejectedValueOnce( new Error( 'ECONNRESET' ) )
                .mockResolvedValueOnce( 'success' );

            await retryService.executeWithRetry( mockFn, { baseDelay: 100, maxRetries: 3 }, 'test-endpoint' );

            expect( retryService.delay ).toHaveBeenCalledWith( 100 ); // First retry
            expect( retryService.delay ).toHaveBeenCalledWith( 200 ); // Second retry
        } );

        it( 'should respect max delay', async () => {
            jest.spyOn( retryService, 'delay' ).mockResolvedValue();

            const mockFn = jest.fn()
                .mockRejectedValueOnce( new Error( 'ETIMEDOUT' ) )
                .mockRejectedValueOnce( new Error( 'ETIMEDOUT' ) )
                .mockRejectedValueOnce( new Error( 'ETIMEDOUT' ) )
                .mockResolvedValueOnce( 'success' );

            await retryService.executeWithRetry( mockFn, {
                baseDelay: 1000,
                maxDelay: 2000,
                maxRetries: 4
            }, 'test-endpoint' );

            expect( retryService.delay ).toHaveBeenCalledWith( 1000 ); // First retry
            expect( retryService.delay ).toHaveBeenCalledWith( 2000 ); // Second retry (capped)
            expect( retryService.delay ).toHaveBeenCalledWith( 2000 ); // Third retry (capped)
        } );
    } );

    describe( 'isRetryableError', () => {
        it( 'should identify retryable network errors', () => {
            const retryableErrors = [
                new Error( 'socket hang up' ),
                new Error( 'ECONNRESET' ),
                new Error( 'ENOTFOUND' ),
                new Error( 'ECONNREFUSED' ),
                new Error( 'ETIMEDOUT' ),
                new Error( 'Network Error' )
            ];

            retryableErrors.forEach( error => {
                expect( retryService.isRetryableError( error ) ).toBe( true );
            } );
        } );

        it( 'should identify retryable HTTP status codes', () => {
            const retryableStatusCodes = [ 408, 417, 429, 500, 502, 503, 504 ];

            retryableStatusCodes.forEach( status => {
                const error = new Error( 'HTTP Error' );
                error.response = { status };
                expect( retryService.isRetryableError( error ) ).toBe( true );
            } );
        } );

        it( 'should identify non-retryable errors', () => {
            const nonRetryableErrors = [
                new Error( 'Bad Request' ),
                { response: { status: 400 } },
                { response: { status: 401 } },
                { response: { status: 403 } },
                { response: { status: 404 } }
            ];

            nonRetryableErrors.forEach( error => {
                expect( retryService.isRetryableError( error ) ).toBe( false );
            } );
        } );
    } );

    describe( 'circuit breaker', () => {
        it( 'should open circuit after threshold failures', async () => {
            const mockFn = jest.fn().mockRejectedValue( new Error( 'socket hang up' ) );

            // Trigger multiple failures to open circuit
            for ( let i = 0; i < 5; i++ ) {
                try {
                    await retryService.executeWithRetry( mockFn, { maxRetries: 0 }, 'test-endpoint' );
                } catch ( e ) {
                    // Expected failures
                }
            }

            // Circuit should now be open
            await expect( retryService.executeWithRetry( mockFn, {}, 'test-endpoint' ) )
                .rejects.toThrow( 'Circuit breaker is OPEN' );
        } );

        it( 'should reset circuit breaker on success', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce( new Error( 'ECONNRESET' ) )
                .mockResolvedValueOnce( 'success' );

            await retryService.executeWithRetry( mockFn, { maxRetries: 2 }, 'test-endpoint' );

            const status = retryService.getCircuitStatus( 'test-endpoint' );
            expect( status.failureCount ).toBe( 0 );
            expect( status.state ).toBe( 'CLOSED' );
        } );

        it( 'should provide circuit status', () => {
            const status = retryService.getCircuitStatus( 'nonexistent' );
            expect( status.state ).toBe( 'CLOSED' );
            expect( status.failureCount ).toBe( 0 );
        } );

        it( 'should reset circuit breaker manually', async () => {
            const mockFn = jest.fn().mockRejectedValue( new Error( 'socket hang up' ) );

            // Create some failures
            try {
                await retryService.executeWithRetry( mockFn, { maxRetries: 0 }, 'test-endpoint' );
            } catch ( e ) { }

            // Reset manually
            retryService.resetCircuitBreaker( 'test-endpoint' );

            const status = retryService.getCircuitStatus( 'test-endpoint' );
            expect( status.state ).toBe( 'CLOSED' );
            expect( status.failureCount ).toBe( 0 );
        } );
    } );
} );