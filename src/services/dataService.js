const fs = require( 'fs' ).promises;
const path = require( 'path' );
const { logger } = require( '../lib/logging.js' );

class DataService {
    constructor () {
        this.data = {};
    }

    /**
     * Load data from the botConfig.json file in the data directory
     * @returns {Promise<Object>} The loaded data
     * @throws {Error} If the file cannot be read or parsed
     */
    async loadData () {
        const maxRetries = 5;
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const dataPath = path.join( process.cwd(), 'data', 'botConfig.json' );
                const fileContent = await fs.readFile( dataPath, 'utf8' );

                // Check if file is empty
                if (!fileContent || fileContent.trim().length === 0) {
                    throw new Error('File is empty');
                }

                try {
                    this.data = JSON.parse( fileContent );
                    logger.info( 'Successfully loaded data from botConfig.json' );
                    // logger.debug(`data: ${JSON.stringify(this.data, null, 2)}`);
                    return this.data;
                } catch ( parseError ) {
                    logger.error( `Failed to parse botConfig.json (attempt ${attempt}/${maxRetries}): ${ parseError.message }` );
                    lastError = parseError;
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                        continue;
                    }
                    throw parseError;
                }
            } catch ( error ) {
                lastError = error;
                if ( error.code === 'ENOENT' ) {
                    logger.warn( 'botConfig.json not found, using empty data object' );
                    this.data = {};
                    return this.data;
                }
                
                if (attempt < maxRetries) {
                    logger.warn( `Error loading botConfig.json (attempt ${attempt}/${maxRetries}): ${ error.message }. Retrying...` );
                    await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                } else {
                    logger.error( `Error loading botConfig.json after ${maxRetries} attempts: ${ error.message }` );
                    throw error;
                }
            }
        }
        
        throw lastError || new Error('Failed to load botConfig.json after retries');
    }

    /**
     * Get a value from the loaded data
     * @param {string} key - The key to look up, can be a dot-notation path (e.g., 'botData.CHAT_NAME')
     * @returns {*} The value for the key, or undefined if not found
     */
    getValue ( key ) {
        return key.split( '.' ).reduce( ( obj, k ) => obj?.[ k ], this.data );
    }

    /**
     * Get all loaded data
     * @returns {Object} The entire data object
     */
    getAllData () {
        return this.data;
    }

    /**
     * Set a value in the data object and save it to the file
     * @param {string} key - The key to set, can be a dot-notation path (e.g., 'botData.CHAT_NAME')
     * @param {*} value - The value to set
     * @returns {Promise<void>}
     */
    async setValue ( key, value ) {
        // Split the key into path parts
        const parts = key.split( '.' );
        const lastPart = parts.pop();

        // Navigate to the correct object
        let current = this.data;
        for ( const part of parts ) {
            if ( !( part in current ) ) {
                current[ part ] = {};
            }
            current = current[ part ];
        }

        // Set the value
        current[ lastPart ] = value;

        // Save to file
        try {
            const dataPath = path.join( process.cwd(), 'data', 'botConfig.json' );
            await fs.writeFile( dataPath, JSON.stringify( this.data, null, 2 ), 'utf8' );
            // logger.debug(`Successfully updated ${key} to ${value}`);
        } catch ( error ) {
            logger.error( `Failed to save botConfig.json after setting ${ key }: ${ error.message }` );
            throw error;
        }
    }
}

// Export a singleton instance
const dataService = new DataService();
module.exports = dataService;
