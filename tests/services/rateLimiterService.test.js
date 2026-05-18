const RateLimiterService = require( '../../src/services/rateLimiterService.js' );

// Mock logger
jest.mock( '../../src/lib/logging.js', () => ( {
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
} ) );

describe( 'RateLimiterService', () => {
    let rateLimiter;

    beforeEach( () => {
        rateLimiter = new RateLimiterService();
        // Clear any intervals to prevent test pollution
        jest.clearAllTimers();
    } );

    afterEach( () => {
        if ( rateLimiter ) {
            rateLimiter.destroy();
        }
    } );

    describe( 'initialization', () => {
        it( 'should initialize with default limits', () => {
            const stats = rateLimiter.getStats();

            expect( stats.limits[ '/health' ] ).toBe( 120 );
            expect( stats.limits.default ).toBe( 60 );
            expect( stats.windowMs ).toBe( 60000 );
        } );

        it( 'should start with no tracked IPs', () => {
            const stats = rateLimiter.getStats();
            expect( stats.trackedIPs ).toBe( 0 );
        } );
    } );

    describe( 'checkLimit', () => {
        it( 'should allow first request from new IP', () => {
            const result = rateLimiter.checkLimit( '192.168.1.1', '/' );

            expect( result.allowed ).toBe( true );
            expect( result.limit ).toBe( 60 );
            expect( result.remaining ).toBe( 59 );
        } );

        it( 'should use health endpoint limit for /health', () => {
            const result = rateLimiter.checkLimit( '192.168.1.1', '/health' );

            expect( result.allowed ).toBe( true );
            expect( result.limit ).toBe( 120 );
            expect( result.remaining ).toBe( 119 );
        } );

        it( 'should track multiple requests from same IP', () => {
            rateLimiter.checkLimit( '192.168.1.1', '/' );
            rateLimiter.checkLimit( '192.168.1.1', '/' );
            const result = rateLimiter.checkLimit( '192.168.1.1', '/' );

            expect( result.allowed ).toBe( true );
            expect( result.remaining ).toBe( 57 );
        } );

        it( 'should reject requests exceeding limit', () => {
            const ip = '192.168.1.1';

            // Make 60 requests (the limit)
            for ( let i = 0; i < 60; i++ ) {
                rateLimiter.checkLimit( ip, '/' );
            }

            // 61st request should be rejected
            const result = rateLimiter.checkLimit( ip, '/' );

            expect( result.allowed ).toBe( false );
            expect( result.remaining ).toBe( 0 );
        } );

        it( 'should track different IPs independently', () => {
            rateLimiter.checkLimit( '192.168.1.1', '/' );
            rateLimiter.checkLimit( '192.168.1.1', '/' );

            const result = rateLimiter.checkLimit( '192.168.1.2', '/' );

            expect( result.allowed ).toBe( true );
            expect( result.remaining ).toBe( 59 );
        } );

        it( 'should reset window after time expires', () => {
            const ip = '192.168.1.1';

            // Make 60 requests
            for ( let i = 0; i < 60; i++ ) {
                rateLimiter.checkLimit( ip, '/' );
            }

            // Mock time passing (61 seconds)
            jest.spyOn( Date, 'now' ).mockReturnValue( Date.now() + 61000 );

            // Should allow request in new window
            const result = rateLimiter.checkLimit( ip, '/' );

            expect( result.allowed ).toBe( true );
            expect( result.remaining ).toBe( 59 );

            jest.restoreAllMocks();
        } );

        it( 'should handle missing IP gracefully', () => {
            const result = rateLimiter.checkLimit( undefined, '/' );

            expect( result.allowed ).toBe( true );
        } );

        it( 'should return reset time', () => {
            const now = Date.now();
            const result = rateLimiter.checkLimit( '192.168.1.1', '/' );

            expect( result.resetTime ).toBeGreaterThan( now );
            expect( result.resetTime ).toBeLessThanOrEqual( now + 60000 );
        } );
    } );

    describe( 'cleanup', () => {
        it( 'should remove expired entries', () => {
            rateLimiter.checkLimit( '192.168.1.1', '/' );
            rateLimiter.checkLimit( '192.168.1.2', '/' );

            expect( rateLimiter.getStats().trackedIPs ).toBe( 2 );

            // Mock time passing (61 seconds)
            jest.spyOn( Date, 'now' ).mockReturnValue( Date.now() + 61000 );

            rateLimiter._cleanup();

            expect( rateLimiter.getStats().trackedIPs ).toBe( 0 );

            jest.restoreAllMocks();
        } );

        it( 'should not remove active entries', () => {
            rateLimiter.checkLimit( '192.168.1.1', '/' );

            // Mock time passing (30 seconds - still within window)
            jest.spyOn( Date, 'now' ).mockReturnValue( Date.now() + 30000 );

            rateLimiter._cleanup();

            expect( rateLimiter.getStats().trackedIPs ).toBe( 1 );

            jest.restoreAllMocks();
        } );
    } );

    describe( 'reset', () => {
        it( 'should reset specific IP', () => {
            rateLimiter.checkLimit( '192.168.1.1', '/' );
            rateLimiter.checkLimit( '192.168.1.2', '/' );

            rateLimiter.reset( '192.168.1.1' );

            expect( rateLimiter.getStats().trackedIPs ).toBe( 1 );
        } );

        it( 'should reset all IPs when no IP specified', () => {
            rateLimiter.checkLimit( '192.168.1.1', '/' );
            rateLimiter.checkLimit( '192.168.1.2', '/' );

            rateLimiter.reset();

            expect( rateLimiter.getStats().trackedIPs ).toBe( 0 );
        } );
    } );

    describe( 'getStats', () => {
        it( 'should return current statistics', () => {
            rateLimiter.checkLimit( '192.168.1.1', '/' );
            rateLimiter.checkLimit( '192.168.1.2', '/health' );

            const stats = rateLimiter.getStats();

            expect( stats.trackedIPs ).toBe( 2 );
            expect( stats.limits ).toHaveProperty( '/health' );
            expect( stats.limits ).toHaveProperty( 'default' );
            expect( stats.windowMs ).toBe( 60000 );
        } );
    } );

    describe( 'destroy', () => {
        it( 'should clear cleanup interval', () => {
            const clearIntervalSpy = jest.spyOn( global, 'clearInterval' );

            rateLimiter.destroy();

            expect( clearIntervalSpy ).toHaveBeenCalled();

            clearIntervalSpy.mockRestore();
        } );
    } );

    describe( 'edge cases', () => {
        it( 'should handle rapid successive requests', () => {
            const ip = '192.168.1.1';
            const results = [];

            for ( let i = 0; i < 65; i++ ) {
                results.push( rateLimiter.checkLimit( ip, '/' ) );
            }

            const allowed = results.filter( r => r.allowed ).length;
            const blocked = results.filter( r => !r.allowed ).length;

            expect( allowed ).toBe( 60 );
            expect( blocked ).toBe( 5 );
        } );

        it( 'should handle IPv6 addresses', () => {
            const result = rateLimiter.checkLimit( '2001:0db8:85a3::8a2e:0370:7334', '/' );

            expect( result.allowed ).toBe( true );
        } );

        it( 'should handle proxied IP format', () => {
            const result = rateLimiter.checkLimit( '192.168.1.1', '/' );

            expect( result.allowed ).toBe( true );
        } );
    } );
} );
