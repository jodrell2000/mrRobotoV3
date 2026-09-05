/**
 * AdapterService
 * 
 * Central orchestrator for managing socket and API adapters.
 * Validates configuration, instantiates adapters, and provides access to them.
 * 
 * Single instance pattern - created once in serviceContainer.
 */

const { loadSocketAdapter } = require( '../socketAdapters' );
const { loadApiAdapter } = require( '../apiAdapters' );

class AdapterService {
    constructor ( config ) {
        this.config = config;
        this.socketAdapter = null;
        this.apiAdapter = null;
        this.framework = null;
    }

    /**
     * Initialize adapters with validation
     * 
     * Validates all required configuration variables and throws clear errors
     * if anything is missing or invalid.
     * 
     * @returns {Promise<void>}
     * @throws {Error} If configuration is invalid or adapters cannot be loaded
     */
    async initialize () {
        try {
            // Validate all required configuration
            this._validateConfig();

            // Load adapters based on framework
            this.framework = this.config.API_FRAMEWORK;

            this.socketAdapter = loadSocketAdapter( this.framework, this.config );
            this.apiAdapter = loadApiAdapter( this.framework, this.config );

            // Log successful initialization
            const logger = require( '../lib/logger' );
            logger.info( `AdapterService initialized for framework: ${ this.framework }` );
        } catch ( error ) {
            const logger = require( '../lib/logger' );
            logger.error( `AdapterService initialization failed: ${ error.message }` );
            throw error;
        }
    }

    /**
     * Validate all required configuration variables
     * 
     * @private
     * @throws {Error} With helpful message if any required variable is missing or invalid
     */
    _validateConfig () {
        const errors = [];

        // API_FRAMEWORK validation
        if ( !this.config.API_FRAMEWORK ) {
            errors.push( 'API_FRAMEWORK not set. Set API_FRAMEWORK=hangfm in .env' );
        } else if ( ![ 'hangfm' ].includes( this.config.API_FRAMEWORK ) ) {
            errors.push(
                `API_FRAMEWORK="${ this.config.API_FRAMEWORK }" is not supported. ` +
                `Supported frameworks: hangfm`
            );
        }

        // SOCKET_SERVER_URL validation
        if ( !this.config.SOCKET_SERVER_URL ) {
            errors.push( 'SOCKET_SERVER_URL not set. Set SOCKET_SERVER_URL=https://socket.prod.tt.fm in .env' );
        } else {
            try {
                new URL( this.config.SOCKET_SERVER_URL );
            } catch {
                errors.push( `SOCKET_SERVER_URL="${ this.config.SOCKET_SERVER_URL }" is not a valid URL` );
            }
        }

        // BOT_USER_TOKEN validation
        if ( !this.config.BOT_USER_TOKEN ) {
            errors.push( 'BOT_USER_TOKEN not set. Set BOT_USER_TOKEN in .env with your bot authentication token' );
        }

        // TTFM_GATEWAY_BASE_URL validation
        if ( !this.config.TTFM_GATEWAY_BASE_URL ) {
            errors.push( 'TTFM_GATEWAY_BASE_URL not set. Set TTFM_GATEWAY_BASE_URL=https://gateway.tt.fm in .env' );
        } else {
            try {
                new URL( this.config.TTFM_GATEWAY_BASE_URL );
            } catch {
                errors.push( `TTFM_GATEWAY_BASE_URL="${ this.config.TTFM_GATEWAY_BASE_URL }" is not a valid URL` );
            }
        }

        // HANGOUT_ID validation
        if ( !this.config.HANGOUT_ID ) {
            errors.push( 'HANGOUT_ID not set. Set HANGOUT_ID in .env with your target hangout UUID' );
        } else if ( !this._isValidUuid( this.config.HANGOUT_ID ) ) {
            errors.push( `HANGOUT_ID="${ this.config.HANGOUT_ID }" is not a valid UUID` );
        }

        // BOT_UID validation
        if ( !this.config.BOT_UID ) {
            errors.push( 'BOT_UID not set. Set BOT_UID in .env with your bot user UUID' );
        } else if ( !this._isValidUuid( this.config.BOT_UID ) ) {
            errors.push( `BOT_UID="${ this.config.BOT_UID }" is not a valid UUID` );
        }

        // Throw all errors together
        if ( errors.length > 0 ) {
            const errorMessage = 'AdapterService Configuration Errors:\n' + errors.map( e => `  ❌ ${ e }` ).join( '\n' );
            throw new Error( errorMessage );
        }
    }

    /**
     * Check if a string is a valid UUID
     * 
     * @private
     * @param {string} str - String to validate
     * @returns {boolean} True if valid UUID format
     */
    _isValidUuid ( str ) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test( str );
    }

    /**
     * Get the socket adapter instance
     * 
     * @returns {Object} Socket adapter instance
     * @throws {Error} If initialize() has not been called
     */
    getSocketAdapter () {
        if ( !this.socketAdapter ) {
            throw new Error( 'AdapterService not initialized. Call initialize() first.' );
        }
        return this.socketAdapter;
    }

    /**
     * Get the API adapter instance
     * 
     * @returns {Object} API adapter instance
     * @throws {Error} If initialize() has not been called
     */
    getApiAdapter () {
        if ( !this.apiAdapter ) {
            throw new Error( 'AdapterService not initialized. Call initialize() first.' );
        }
        return this.apiAdapter;
    }

    /**
     * Get the current framework name
     * 
     * @returns {string} Framework name (e.g., 'hangfm')
     * @throws {Error} If initialize() has not been called
     */
    getFramework () {
        if ( !this.framework ) {
            throw new Error( 'AdapterService not initialized. Call initialize() first.' );
        }
        return this.framework;
    }
}

module.exports = AdapterService;
