const { logger } = require( '../lib/logging.js' );

/**
 * Token Service - Manages dynamic tokens for messages and AI instructions
 */
class TokenService {
    constructor ( services ) {
        this.services = services;
        this.logger = logger;

        // Built-in tokens that are always available
        this.builtInTokens = {
            '{hangoutName}': () => this.services.stateService?.getHangoutName?.() || 'Hangout FM',
            '{botName}': () => this.services.getState?.( 'botNickname' ) || 'DJ Bot',
            '{currentTime}': () => this.getCurrentTime(),
            '{currentDate}': () => this.getCurrentDate(),
            '{currentDayOfWeek}': () => this.getCurrentDayOfWeek(),
            '{greetingTime}': () => this.getGreetingTime()
        };
    }

    /**
     * Get configuration value with fallback to defaults
     * @param {string} key - Configuration key
     * @param {any} defaultValue - Default value if not found
     * @returns {any} Configuration value
     */
    getConfigValue ( key, defaultValue ) {
        try {
            if ( this.services?.dataService ) {
                return this.services.dataService.getValue( `configuration.${ key }` ) || defaultValue;
            }
        } catch ( error ) {
            this.logger.debug( `[TokenService] Could not get config value ${ key }: ${ error.message }` );
        }
        return defaultValue;
    }

    /**
     * Get current time formatted according to configuration
     * @returns {string} Formatted current time (hours and minutes only)
     */
    getCurrentTime () {
        try {
            const timezone = this.getConfigValue( 'timezone', 'Europe/London' );
            const locale = this.getConfigValue( 'locale', 'en-GB' );
            const timeFormat = this.getConfigValue( 'timeFormat', '24' );

            const options = {
                timeZone: timezone,
                hour12: timeFormat === '12',
                hour: '2-digit',
                minute: '2-digit'
            };

            return new Date().toLocaleTimeString( locale, options );
        } catch ( error ) {
            this.logger.debug( `[TokenService] Error formatting time: ${ error.message }` );
            return new Date().toLocaleTimeString( 'en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' } );
        }
    }

    /**
     * Get current date formatted according to configuration
     * @returns {string} Formatted current date
     */
    getCurrentDate () {
        try {
            const timezone = this.getConfigValue( 'timezone', 'Europe/London' );
            const locale = this.getConfigValue( 'locale', 'en-GB' );

            const options = {
                timeZone: timezone
            };

            return new Date().toLocaleDateString( locale, options );
        } catch ( error ) {
            this.logger.debug( `[TokenService] Error formatting date: ${ error.message }` );
            return new Date().toLocaleDateString( 'en-GB', { timeZone: 'Europe/London' } );
        }
    }

    /**
     * Get current day of week according to configuration
     * @returns {string} Current day of week
     */
    getCurrentDayOfWeek () {
        try {
            const timezone = this.getConfigValue( 'timezone', 'Europe/London' );
            const locale = this.getConfigValue( 'locale', 'en-GB' );

            const options = {
                timeZone: timezone,
                weekday: 'long'
            };

            return new Date().toLocaleDateString( locale, options );
        } catch ( error ) {
            this.logger.debug( `[TokenService] Error formatting day of week: ${ error.message }` );
            return new Date().toLocaleDateString( 'en-GB', { timeZone: 'Europe/London', weekday: 'long' } );
        }
    }

    /**
     * Get appropriate greeting based on current time (morning, afternoon, evening, night)
     * @returns {string} Time-based greeting
     */
    getGreetingTime () {
        try {
            const timezone = this.getConfigValue( 'timezone', 'Europe/London' );

            // Get current hour in the configured timezone
            const now = new Date();
            const timeString = now.toLocaleString( 'en-US', {
                timeZone: timezone,
                hour12: false,
                hour: '2-digit'
            } );
            const hour = parseInt( timeString );

            // Determine greeting based on hour (24-hour format)
            if ( hour >= 4 && hour < 12 ) {
                return 'morning';
            } else if ( hour >= 12 && hour < 18 ) {
                return 'afternoon';
            } else if ( hour >= 18 && hour < 20 ) {
                return 'evening';
            } else {
                return 'night';
            }
        } catch ( error ) {
            this.logger.debug( `[TokenService] Error determining greeting time: ${ error.message }` );
            // Fallback using system time
            const hour = new Date().getHours();
            if ( hour >= 4 && hour < 12 ) return 'morning';
            if ( hour >= 12 && hour < 18 ) return 'afternoon';
            if ( hour >= 18 && hour < 21 ) return 'evening';
            return 'night';
        }
    }

    /**
     * Get all available tokens (built-in + custom)
     * @param {boolean} skipDataLoad - Skip calling loadData() if data is already loaded
     * @returns {Object} Object containing all available tokens and their resolvers
     */
    async getAllTokens ( skipDataLoad = false ) {
        try {
            if ( !skipDataLoad && this.services?.dataService ) {
                await this.services.dataService.loadData();
            }

            const customTokens = this.services?.dataService?.getValue( 'customTokens' ) || {};

            return {
                ...this.builtInTokens,
                ...customTokens
            };
        } catch ( error ) {
            this.logger.error( `[TokenService] Error getting all tokens: ${ error.message }` );
            return this.builtInTokens;
        }
    }

    /**
     * Add or update a custom token
     * @param {string} tokenName - Token name (with or without braces)
     * @param {string|Function} tokenValue - Static value or function that returns a value
     * @param {string} description - Human-readable description of the token
     * @param {boolean} skipDataLoad - Skip calling loadData() if data is already loaded
     * @returns {Promise<Object>} Result object
     */
    async setCustomToken ( tokenName, tokenValue, description = '', skipDataLoad = false ) {
        try {
            if ( !this.services?.dataService ) {
                return { success: false, error: 'DataService not available' };
            }

            if ( !skipDataLoad ) {
                await this.services.dataService.loadData();
            }

            // Normalize token name to include braces
            const normalizedTokenName = tokenName.startsWith( '{' ) ? tokenName : `{${ tokenName }}`;

            // Get existing custom tokens
            const customTokens = this.services.dataService.getValue( 'customTokens' ) || {};

            // Add the new token
            customTokens[ normalizedTokenName ] = {
                value: tokenValue,
                description: description,
                createdAt: new Date().toISOString(),
                type: typeof tokenValue === 'function' ? 'dynamic' : 'static'
            };

            // Save back to dataService
            await this.services.dataService.setValue( 'customTokens', customTokens );

            this.logger.info( `[TokenService] Added custom token: ${ normalizedTokenName }` );

            return {
                success: true,
                message: `Token ${ normalizedTokenName } added successfully`,
                tokenName: normalizedTokenName
            };
        } catch ( error ) {
            this.logger.error( `[TokenService] Error setting custom token: ${ error.message }` );
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove a custom token
     * @param {string} tokenName - Token name to remove
     * @param {boolean} skipDataLoad - Skip calling loadData() if data is already loaded
     * @returns {Promise<Object>} Result object
     */
    async removeCustomToken ( tokenName, skipDataLoad = false ) {
        try {
            if ( !this.services?.dataService ) {
                return { success: false, error: 'DataService not available' };
            }

            if ( !skipDataLoad ) {
                await this.services.dataService.loadData();
            }

            // Normalize token name
            const normalizedTokenName = tokenName.startsWith( '{' ) ? tokenName : `{${ tokenName }}`;

            // Get existing custom tokens
            const customTokens = this.services.dataService.getValue( 'customTokens' ) || {};

            if ( !customTokens[ normalizedTokenName ] ) {
                return { success: false, error: `Token ${ normalizedTokenName } not found` };
            }

            // Remove the token
            delete customTokens[ normalizedTokenName ];

            // Save back to dataService
            await this.services.dataService.setValue( 'customTokens', customTokens );

            this.logger.info( `[TokenService] Removed custom token: ${ normalizedTokenName }` );

            return {
                success: true,
                message: `Token ${ normalizedTokenName } removed successfully`,
                tokenName: normalizedTokenName
            };
        } catch ( error ) {
            this.logger.error( `[TokenService] Error removing custom token: ${ error.message }` );
            return { success: false, error: error.message };
        }
    }

    /**
     * Replace all tokens in a string with their resolved values
     * @param {string} text - Text containing tokens to replace
     * @param {Object} context - Additional context for token resolution
     * @param {boolean} skipDataLoad - Skip calling loadData() if data is already loaded
     * @returns {Promise<string>} Text with tokens replaced
     */
    async replaceTokens ( text, context = {}, skipDataLoad = false ) {
        try {
            if ( !text || typeof text !== 'string' ) {
                return text;
            }

            const allTokens = await this.getAllTokens( skipDataLoad );
            let processedText = text;

            // Replace each token found in the text
            for ( const [ tokenName, tokenConfig ] of Object.entries( allTokens ) ) {
                if ( processedText.includes( tokenName ) ) {
                    let resolvedValue;

                    if ( typeof tokenConfig === 'function' ) {
                        // Built-in token (function)
                        resolvedValue = await tokenConfig( context );
                    } else if ( tokenConfig?.value ) {
                        // Custom token with config object
                        if ( typeof tokenConfig.value === 'function' ) {
                            resolvedValue = await tokenConfig.value( context );
                        } else {
                            resolvedValue = tokenConfig.value;
                        }
                    } else {
                        // Direct value
                        resolvedValue = tokenConfig;
                    }

                    // Replace all instances of this token
                    processedText = processedText.replace( new RegExp( tokenName.replace( /[{}]/g, '\\$&' ), 'g' ), resolvedValue || '' );
                }
            }

            // Handle context-specific tokens (like track/artist info)
            if ( context.trackName ) {
                processedText = processedText.replace( /\{trackName\}/g, context.trackName );
            }
            if ( context.artistName ) {
                processedText = processedText.replace( /\{artistName\}/g, context.artistName );
            }
            if ( context.username ) {
                processedText = processedText.replace( /\{username\}/g, context.username );
            }
            if ( context.likes !== undefined ) {
                processedText = processedText.replace( /\{likes\}/g, context.likes );
            }
            if ( context.dislikes !== undefined ) {
                processedText = processedText.replace( /\{dislikes\}/g, context.dislikes );
            }
            if ( context.stars !== undefined ) {
                processedText = processedText.replace( /\{stars\}/g, context.stars );
            }

            return processedText;
        } catch ( error ) {
            this.logger.error( `[TokenService] Error replacing tokens: ${ error.message }` );
            return text; // Return original text on error
        }
    }

    /**
     * Get a list of all available tokens with their descriptions
     * @param {boolean} skipDataLoad - Skip calling loadData() if data is already loaded
     * @returns {Promise<Array>} Array of token information
     */
    async getTokenList ( skipDataLoad = false ) {
        try {
            const allTokens = await this.getAllTokens( skipDataLoad );
            const tokenList = [];

            // Add built-in tokens
            for ( const [ tokenName ] of Object.entries( this.builtInTokens ) ) {
                tokenList.push( {
                    name: tokenName,
                    type: 'built-in',
                    description: this.getBuiltInTokenDescription( tokenName )
                } );
            }

            // Add custom tokens
            if ( this.services?.dataService ) {
                const customTokens = this.services.dataService.getValue( 'customTokens' ) || {};
                for ( const [ tokenName, tokenConfig ] of Object.entries( customTokens ) ) {
                    tokenList.push( {
                        name: tokenName,
                        type: 'custom',
                        description: tokenConfig.description || 'Custom token',
                        createdAt: tokenConfig.createdAt,
                        valueType: tokenConfig.type
                    } );
                }
            }

            return tokenList;
        } catch ( error ) {
            this.logger.error( `[TokenService] Error getting token list: ${ error.message }` );
            return [];
        }
    }

    /**
     * Get description for built-in tokens
     * @param {string} tokenName - Token name
     * @returns {string} Description
     */
    getBuiltInTokenDescription ( tokenName ) {
        const descriptions = {
            '{hangoutName}': 'Name of the current hangout',
            '{botName}': 'Current bot nickname',
            '{currentTime}': 'Current time',
            '{currentDate}': 'Current date',
            '{currentDayOfWeek}': 'Current day of the week',
            '{greetingTime}': 'Time-based greeting (morning, afternoon, evening, night)'
        };
        return descriptions[ tokenName ] || 'Built-in token';
    }
}

module.exports = TokenService;