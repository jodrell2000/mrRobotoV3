/**
 * API Adapter Loader
 * 
 * Loads the appropriate API adapter based on the framework configuration.
 * Centralized point for instantiating API adapters.
 */

const HangFmApiAdapter = require( './HangFmApiAdapter' );
const WavezFmApiAdapter = require( './WavezFmApiAdapter' );

/**
 * Load an API adapter based on framework name
 * 
 * @param {string} frameworkName - The API framework name (e.g., 'hangfm')
 * @param {Object} config - Configuration object with API endpoints and credentials
 * @returns {AbstractSiteAdapter} An instance of the appropriate API adapter
 * @throws {Error} If framework is not supported
 */
function loadApiAdapter ( frameworkName, config ) {
    switch ( frameworkName ) {
        case 'hangfm':
            return new HangFmApiAdapter( config );
        case 'wavezfm':
            return new WavezFmApiAdapter( config );

        default:
            throw new Error(
                `API adapter not found for framework: ${ frameworkName }. ` +
                `Supported frameworks: hangfm, wavezfm`
            );
    }
}

module.exports = {
    loadApiAdapter
};
