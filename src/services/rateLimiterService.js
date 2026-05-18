const { logger } = require( '../lib/logging.js' );

/**
 * Rate limiter service to prevent DoS attacks on HTTP endpoints
 * Tracks requests per IP address with configurable limits
 */
class RateLimiterService {
    constructor () {
        // Map of IP -> { count, windowStart }
        this.ipRequests = new Map();

        // Window duration in milliseconds (1 minute)
        this.windowMs = 60000;

        // Default limits per endpoint
        this.limits = {
            '/health': 120,  // 120 requests per minute for health checks
            'default': 60    // 60 requests per minute for other endpoints
        };

        // Cleanup old entries every 5 minutes
        this.cleanupInterval = setInterval( () => {
            this._cleanup();
        }, 300000 );

        logger.info( 'Rate limiter initialized with 60 req/min default, 120 req/min for /health' );
    }

    /**
     * Check if a request should be allowed
     * @param {string} ip - Client IP address
     * @param {string} pathname - Request pathname (e.g., '/health')
     * @returns {object} { allowed: boolean, limit: number, remaining: number, resetTime: number }
     */
    checkLimit ( ip, pathname ) {
        if ( !ip ) {
            logger.warn( 'Rate limiter received request with no IP address' );
            return { allowed: true, limit: 0, remaining: 0, resetTime: 0 };
        }

        const now = Date.now();
        const limit = this.limits[ pathname ] || this.limits.default;

        let record = this.ipRequests.get( ip );

        // If no record or window has expired, create new window
        if ( !record || ( now - record.windowStart ) >= this.windowMs ) {
            record = {
                count: 0,
                windowStart: now
            };
            this.ipRequests.set( ip, record );
        }

        // Increment request count
        record.count++;

        const allowed = record.count <= limit;
        const remaining = Math.max( 0, limit - record.count );
        const resetTime = record.windowStart + this.windowMs;

        if ( !allowed ) {
            logger.warn( `Rate limit exceeded for IP ${ ip } on ${ pathname } (${ record.count }/${ limit })` );
        }

        return {
            allowed,
            limit,
            remaining,
            resetTime
        };
    }

    /**
     * Clean up expired entries to prevent memory leaks
     * @private
     */
    _cleanup () {
        const now = Date.now();
        let cleaned = 0;

        for ( const [ ip, record ] of this.ipRequests.entries() ) {
            if ( ( now - record.windowStart ) >= this.windowMs ) {
                this.ipRequests.delete( ip );
                cleaned++;
            }
        }

        if ( cleaned > 0 ) {
            logger.debug( `Rate limiter cleanup: removed ${ cleaned } expired entries` );
        }
    }

    /**
     * Get current rate limiter statistics
     * @returns {object} { trackedIPs: number, limits: object }
     */
    getStats () {
        return {
            trackedIPs: this.ipRequests.size,
            limits: this.limits,
            windowMs: this.windowMs
        };
    }

    /**
     * Reset rate limit for a specific IP (useful for testing)
     * @param {string} ip - IP address to reset
     */
    reset ( ip ) {
        if ( ip ) {
            this.ipRequests.delete( ip );
        } else {
            this.ipRequests.clear();
        }
    }

    /**
     * Cleanup interval on shutdown
     */
    destroy () {
        if ( this.cleanupInterval ) {
            clearInterval( this.cleanupInterval );
        }
    }
}

module.exports = RateLimiterService;
