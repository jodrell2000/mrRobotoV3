/**
 * Abstract base class for verification service providers
 * Each concrete provider extends this class and implements verify()
 */
class BaseProvider {
    constructor ( name, logger ) {
        this.name = name;
        this.logger = logger;
    }

    /**
     * Get the provider name identifier
     * @returns {string} Provider name
     */
    getProvider () {
        return this.name;
    }

    /**
     * Check if provider is available (has required configuration)
     * @returns {boolean} true if provider can be used
     */
    isAvailable () {
        throw new Error( 'isAvailable() must be implemented by subclass' );
    }

    /**
     * Verify artist/band information against this provider
     * @param {string} query - Artist/band name to verify
     * @param {Object} options - Query options (type, etc.)
     * @returns {Promise<Object>} Result: { found: boolean, data: Object|null, error: string|null }
     */
    async verify ( query, options = {} ) {
        throw new Error( 'verify() must be implemented by subclass' );
    }
}

module.exports = BaseProvider;
