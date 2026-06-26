const fs = require( 'node:fs' );
const path = require( 'node:path' );

/**
 * Verification Service
 * Manages multiple provider plugins and coordinates verification queries
 * Queries all available providers in parallel with a 5 second timeout
 */
class VerificationService {
    constructor ( services = {} ) {
        this.services = services;
        this.logger = services.logger || console;
        this.providers = [];
        this.timeoutMs = parseInt( process.env.VERIFICATION_TIMEOUT_MS || 5000, 10 );
    }

    /**
     * Initialize the service by loading available providers
     * Auto-discovers providers from the providers directory
     * @returns {Promise<void>}
     */
    async initialize () {
        try {
            const providersDir = path.join( __dirname, 'providers' );
            const files = fs.readdirSync( providersDir );

            for ( const file of files ) {
                // Skip base provider and non-js files
                if ( file === 'BaseProvider.js' || !file.endsWith( '.js' ) ) {
                    continue;
                }

                try {
                    const ProviderClass = require( path.join( providersDir, file ) );
                    const provider = new ProviderClass( this.services );

                    // Only register if available (has required config)
                    if ( provider.isAvailable() ) {
                        this.providers.push( provider );
                        this.logger.debug( `✅ [VerificationService] Loaded provider: ${ provider.getProvider() }` );
                    } else {
                        this.logger.debug( `⏭️ [VerificationService] Skipped provider: ${ provider.getProvider() } (not configured)` );
                    }
                } catch ( err ) {
                    this.logger.warn( `⚠️ [VerificationService] Failed to load provider ${ file }: ${ err.message }` );
                }
            }

            if ( this.providers.length === 0 ) {
                this.logger.warn( '⚠️ [VerificationService] No providers available' );
            } else {
                this.logger.info( `✅ [VerificationService] Initialized with ${ this.providers.length } provider(s)` );
            }
        } catch ( err ) {
            this.logger.error( `❌ [VerificationService] Initialization failed: ${ err.message }` );
            throw err;
        }
    }

    /**
     * Verify artist/band information across all providers
     * Queries all available providers in parallel with service-level timeout
     * @param {string} query - Artist/band name to verify
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Results from all providers + timeout flag
     */
    async verify ( query, options = {} ) {
        if ( !query || typeof query !== 'string' ) {
            throw new Error( 'Query must be a non-empty string' );
        }

        if ( this.providers.length === 0 ) {
            this.logger.warn( '⚠️ [VerificationService] No providers available for verification' );
            return { timeout: false };
        }

        this.logger.debug( `🔍 [VerificationService] Verifying: "${ query }"` );

        try {
            // Create promise for each provider
            const verifyPromises = this.providers.map( provider => this._verifyWithProvider( provider, query, options ) );

            // Race against timeout
            const results = await Promise.race( [
                Promise.all( verifyPromises ),
                this._createTimeoutPromise( this.timeoutMs )
            ] );

            // If timeout occurred, results will be { timeout: true }
            if ( results.timeout ) {
                this.logger.warn( `⏱️ [VerificationService] Verification timeout after ${ this.timeoutMs }ms` );
                return results;
            }

            // Build result object with provider names as keys
            const verificationResult = { timeout: false };
            for ( let i = 0; i < this.providers.length; i++ ) {
                const providerName = this.providers[ i ].getProvider();
                verificationResult[ providerName ] = results[ i ];
            }

            return verificationResult;
        } catch ( err ) {
            this.logger.error( `❌ [VerificationService] Verification error: ${ err.message }` );
            return { timeout: false, error: err.message };
        }
    }

    /**
     * Call a single provider's verify method with error handling
     * @private
     */
    async _verifyWithProvider ( provider, query, options ) {
        try {
            const result = await provider.verify( query, options );
            return result || { found: false };
        } catch ( err ) {
            this.logger.debug( `⚠️ [VerificationService] Provider ${ provider.getProvider() } error: ${ err.message }` );
            return {
                found: false,
                error: err.message
            };
        }
    }

    /**
     * Create a promise that rejects after specified milliseconds
     * @private
     */
    _createTimeoutPromise ( ms ) {
        return new Promise( ( resolve ) => {
            setTimeout( () => {
                resolve( { timeout: true } );
            }, ms );
        } );
    }

    /**
     * Get list of available providers
     * @returns {Array<string>} Provider names
     */
    getAvailableProviders () {
        return this.providers.map( p => p.getProvider() );
    }
}

module.exports = VerificationService;
