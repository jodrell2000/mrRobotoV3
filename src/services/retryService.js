const { logger } = require( '../lib/logging.js' );

/**
 * Retry service with exponential backoff and circuit breaker pattern
 * Provides resilient HTTP request handling for external services
 */
class RetryService {
    constructor () {
        this.circuitBreakers = new Map(); // Track circuit breakers by endpoint
        this.retryConfigs = {
            default: {
                maxRetries: 3,
                baseDelay: 1000, // 1 second
                maxDelay: 8000,  // 8 seconds max
                backoffMultiplier: 2,
                circuitBreakerThreshold: 5, // failures before opening circuit
                circuitBreakerTimeout: 30000 // 30 seconds before trying again
            }
        };
    }

    /**
     * Execute a function with retry logic and circuit breaker protection
     * @param {Function} fn - Async function to execute
     * @param {Object} options - Retry configuration options
     * @param {string} endpointKey - Unique key for circuit breaker tracking
     * @returns {Promise} Result of the function execution
     */
    async executeWithRetry ( fn, options = {}, endpointKey = 'default' ) {
        const config = { ...this.retryConfigs.default, ...options };

        // Check circuit breaker state
        if ( this.isCircuitOpen( endpointKey ) ) {
            const error = new Error( `Circuit breaker is OPEN for endpoint: ${ endpointKey }` );
            error.code = 'CIRCUIT_BREAKER_OPEN';
            throw error;
        }

        let lastError;
        let attempt = 0;

        while ( attempt <= config.maxRetries ) {
            try {
                const result = await fn();

                // Success - reset circuit breaker failure count
                this.recordSuccess( endpointKey );

                if ( attempt > 0 ) {
                    logger.info( `✅ [RetryService] ${ endpointKey } succeeded on attempt ${ attempt + 1 }` );
                }

                return result;
            } catch ( error ) {
                lastError = error;
                attempt++;

                // Check if this is a retryable error
                if ( !this.isRetryableError( error ) ) {
                    logger.debug( `❌ [RetryService] ${ endpointKey } - Non-retryable error: ${ error.message }` );
                    this.recordFailure( endpointKey );
                    throw error;
                }

                // If we've exhausted retries
                if ( attempt > config.maxRetries ) {
                    logger.error( `❌ [RetryService] ${ endpointKey } - Max retries (${ config.maxRetries }) exceeded` );
                    this.recordFailure( endpointKey );
                    break;
                }

                // Calculate delay with exponential backoff
                const delay = Math.min(
                    config.baseDelay * Math.pow( config.backoffMultiplier, attempt - 1 ),
                    config.maxDelay
                );

                logger.warn( `⚠️ [RetryService] ${ endpointKey } - Attempt ${ attempt } failed: ${ error.message }. Retrying in ${ delay }ms...` );

                // Wait before retry
                await this.delay( delay );
            }
        }

        // All retries failed
        this.recordFailure( endpointKey );
        throw lastError;
    }

    /**
     * Check if an error is worth retrying
     * @param {Error} error - The error to check
     * @returns {boolean} True if the error is retryable
     */
    isRetryableError ( error ) {
        // Network errors that are typically temporary
        const retryableErrors = [
            'ECONNRESET',
            'ENOTFOUND',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'socket hang up',
            'timeout',
            'Network Error'
        ];

        // HTTP status codes that are retryable
        const retryableStatusCodes = [ 408, 417, 429, 500, 502, 503, 504 ];

        // Check error message
        const errorMessage = error.message || '';
        if ( retryableErrors.some( retryableError => errorMessage.includes( retryableError ) ) ) {
            return true;
        }

        // Check HTTP status codes
        if ( error.response && retryableStatusCodes.includes( error.response.status ) ) {
            // Special logging for 417 errors to help with debugging
            if ( error.response.status === 417 ) {
                logger.warn( `⚠️ [RetryService] 417 Expectation Failed - this may indicate header/configuration issues. Response: ${ JSON.stringify( error.response.data ) }` );
            }
            return true;
        }

        // Check axios error codes
        if ( error.code && [ 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT' ].includes( error.code ) ) {
            return true;
        }

        return false;
    }

    /**
     * Check if circuit breaker is open for an endpoint
     * @param {string} endpointKey - Endpoint identifier
     * @returns {boolean} True if circuit is open
     */
    isCircuitOpen ( endpointKey ) {
        const breaker = this.circuitBreakers.get( endpointKey );
        if ( !breaker ) return false;

        if ( breaker.state === 'OPEN' ) {
            // Check if timeout period has passed
            if ( Date.now() - breaker.lastFailureTime > this.retryConfigs.default.circuitBreakerTimeout ) {
                breaker.state = 'HALF_OPEN';
                logger.info( `🔄 [RetryService] Circuit breaker for ${ endpointKey } moved to HALF_OPEN state` );
                return false;
            }
            return true;
        }

        return false;
    }

    /**
     * Record a successful operation
     * @param {string} endpointKey - Endpoint identifier
     */
    recordSuccess ( endpointKey ) {
        const breaker = this.circuitBreakers.get( endpointKey );
        if ( breaker ) {
            breaker.failureCount = 0;
            if ( breaker.state === 'HALF_OPEN' ) {
                breaker.state = 'CLOSED';
                logger.info( `✅ [RetryService] Circuit breaker for ${ endpointKey } moved to CLOSED state` );
            }
        }
    }

    /**
     * Record a failed operation
     * @param {string} endpointKey - Endpoint identifier
     */
    recordFailure ( endpointKey ) {
        let breaker = this.circuitBreakers.get( endpointKey );

        if ( !breaker ) {
            breaker = {
                failureCount: 0,
                lastFailureTime: 0,
                state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
            };
            this.circuitBreakers.set( endpointKey, breaker );
        }

        breaker.failureCount++;
        breaker.lastFailureTime = Date.now();

        // Open circuit if threshold reached
        if ( breaker.failureCount >= this.retryConfigs.default.circuitBreakerThreshold && breaker.state === 'CLOSED' ) {
            breaker.state = 'OPEN';
            logger.error( `🚫 [RetryService] Circuit breaker OPENED for ${ endpointKey } after ${ breaker.failureCount } failures` );
        }
    }

    /**
     * Get circuit breaker status for monitoring
     * @param {string} endpointKey - Endpoint identifier
     * @returns {Object} Circuit breaker status
     */
    getCircuitStatus ( endpointKey ) {
        const breaker = this.circuitBreakers.get( endpointKey );
        if ( !breaker ) {
            return { state: 'CLOSED', failureCount: 0, lastFailureTime: null };
        }
        return { ...breaker };
    }

    /**
     * Get all circuit breaker statuses
     * @returns {Object} All circuit breaker statuses
     */
    getAllCircuitStatuses () {
        const statuses = {};
        for ( const [ key, breaker ] of this.circuitBreakers.entries() ) {
            statuses[ key ] = { ...breaker };
        }
        return statuses;
    }

    /**
     * Reset a specific circuit breaker
     * @param {string} endpointKey - Endpoint identifier
     */
    resetCircuitBreaker ( endpointKey ) {
        const breaker = this.circuitBreakers.get( endpointKey );
        if ( breaker ) {
            breaker.failureCount = 0;
            breaker.state = 'CLOSED';
            logger.info( `🔄 [RetryService] Circuit breaker for ${ endpointKey } manually reset to CLOSED state` );
        }
    }

    /**
     * Utility delay function
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    async delay ( ms ) {
        return new Promise( resolve => setTimeout( resolve, ms ) );
    }
}

module.exports = RetryService;