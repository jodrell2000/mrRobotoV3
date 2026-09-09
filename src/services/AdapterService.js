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
const { loadMessagingAdapter } = require( '../messagingAdapters' );
const { loadFramework } = require( '../siteFrameworks' );

class AdapterService {
    constructor ( config, logger, dependencies = {} ) {
        this.config = config;
        this.logger = logger;
        this.dependencies = dependencies;
        this.socketAdapter = null;
        this.apiAdapter = null;
        this.messagingAdapter = null;
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
            // Load framework metadata before validating framework-specific configuration
            this.framework = loadFramework( this.config.API_FRAMEWORK );
            this._validateConfig();

            // Load adapters based on framework
            this.socketAdapter = loadSocketAdapter( this.framework.id, this.config );
            this.apiAdapter = loadApiAdapter( this.framework.id, this.config );
            this.messagingAdapter = loadMessagingAdapter( this.framework.id, {
                messageService: this.dependencies.messageService,
                privateMessageService: this.dependencies.privateMessageService,
                openchatApi: this.dependencies.openchatApi
            } );

            // Log successful initialization
            this.logger.info( `AdapterService initialized for framework: ${ this.framework.id }` );
        } catch ( error ) {
            this.logger.error( `AdapterService initialization failed: ${ error.message }` );
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
        const errors = this.framework?.validateConfig?.( this.config ) || [
            'Site framework metadata is not loaded'
        ];

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

    getMessagingAdapter () {
        if ( !this.messagingAdapter ) throw new Error( 'AdapterService not initialized. Call initialize() first.' );
        return this.messagingAdapter;
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
        return this.framework.id;
    }

    getFrameworkSpecification () {
        if ( !this.framework ) {
            throw new Error( 'AdapterService not initialized. Call initialize() first.' );
        }
        return this.framework;
    }
}

module.exports = AdapterService;
