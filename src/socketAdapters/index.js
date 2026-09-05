/**
 * Socket Adapter Loader
 * 
 * Loads the appropriate socket adapter based on the framework configuration.
 * Centralized point for instantiating socket adapters.
 */

const HangFmSocketAdapter = require( './HangFmSocketAdapter' );

/**
 * Load a socket adapter based on framework name
 * 
 * @param {string} frameworkName - The API framework name (e.g., 'hangfm')
 * @param {Object} config - Configuration object with SOCKET_SERVER_URL and other settings
 * @returns {AbstractSocketAdapter} An instance of the appropriate socket adapter
 * @throws {Error} If framework is not supported
 */
function loadSocketAdapter ( frameworkName, config ) {
    switch ( frameworkName ) {
        case 'hangfm':
            return new HangFmSocketAdapter( config );

        default:
            throw new Error(
                `Socket adapter not found for framework: ${ frameworkName }. ` +
                `Supported frameworks: hangfm`
            );
    }
}

module.exports = {
    loadSocketAdapter
};
