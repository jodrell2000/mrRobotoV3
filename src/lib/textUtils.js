const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { logger } = require( './logging' );

let characterMappings = null;
const MAPPINGS_FILE = path.join( process.cwd(), 'data', 'specialCharacters.json' );

/**
 * Load character mappings from the JSON file
 * Creates the file from the example template if it doesn't exist
 * @param {boolean} forceReload - Force reload from disk even if cached
 * @returns {Object} Character mappings object
 */
function loadMappings ( forceReload = false ) {
    if ( characterMappings && !forceReload ) {
        return characterMappings;
    }

    try {
        if ( fs.existsSync( MAPPINGS_FILE ) ) {
            const fileContent = fs.readFileSync( MAPPINGS_FILE, 'utf8' );
            characterMappings = JSON.parse( fileContent );
            logger.debug( `[textUtils] Loaded ${ Object.keys( characterMappings ).length } character mappings` );
        } else {
            // Create the file from the example template
            const exampleFile = path.join( process.cwd(), 'data', 'specialCharacters.json_example' );
            if ( fs.existsSync( exampleFile ) ) {
                const exampleContent = fs.readFileSync( exampleFile, 'utf8' );
                const dirPath = path.dirname( MAPPINGS_FILE );
                if ( !fs.existsSync( dirPath ) ) {
                    fs.mkdirSync( dirPath, { recursive: true } );
                }
                fs.writeFileSync( MAPPINGS_FILE, exampleContent, 'utf8' );
                characterMappings = JSON.parse( exampleContent );
                logger.info( `[textUtils] Created specialCharacters.json from example template with ${ Object.keys( characterMappings ).length } mappings` );
            } else {
                logger.warn( '[textUtils] specialCharacters.json and example template not found, using empty mappings' );
                characterMappings = {};
            }
        }
    } catch ( error ) {
        logger.error( `[textUtils] Failed to load character mappings: ${ error.message }` );
        characterMappings = {};
    }

    return characterMappings;
}

/**
 * Save character mappings to the JSON file
 * @returns {boolean} True if save was successful
 */
function saveMappings () {
    try {
        const dirPath = path.dirname( MAPPINGS_FILE );
        if ( !fs.existsSync( dirPath ) ) {
            fs.mkdirSync( dirPath, { recursive: true } );
        }
        fs.writeFileSync( MAPPINGS_FILE, JSON.stringify( characterMappings, null, 2 ), 'utf8' );
        logger.debug( '[textUtils] Character mappings saved' );
        return true;
    } catch ( error ) {
        logger.error( `[textUtils] Failed to save character mappings: ${ error.message }` );
        return false;
    }
}

/**
 * Normalize text by applying NFKD normalization and custom character mappings
 * This converts decorative Unicode characters to their ASCII equivalents
 * @param {string} text - The text to normalize
 * @returns {string} Normalized text
 */
function normalizeText ( text ) {
    if ( !text || typeof text !== 'string' ) {
        return text;
    }

    // First apply NFKD normalization - this handles many mathematical and compatibility characters
    // NFKD decomposes characters and converts compatibility characters to their base forms
    let normalized = text.normalize( 'NFKD' );

    // Remove combining diacritical marks (accents, etc.) that NFKD introduces
    // This regex matches Unicode combining characters (category Mn)
    normalized = normalized.replace( /[\u0300-\u036f]/g, '' );

    // Now apply custom mappings for characters that NFKD doesn't handle
    // (like Canadian Aboriginal Syllabics used as decorative letters)
    const mappings = loadMappings();

    for ( const [ fancy, ascii ] of Object.entries( mappings ) ) {
        // Use a global replace to handle all occurrences
        normalized = normalized.split( fancy ).join( ascii );
    }

    return normalized;
}

/**
 * Check if a character is a standard ASCII character
 * Standard ASCII is typically printable characters 32-126
 * @param {string} char - The character to check
 * @returns {boolean} True if character is standard ASCII
 */
function isStandardASCII ( char ) {
    if ( !char || char.length !== 1 ) {
        return false;
    }
    const code = char.charCodeAt( 0 );
    // Printable ASCII range: 33-126 (excludes space and control characters)
    // Also allow space (32) for replacements
    return code >= 32 && code <= 126;
}

/**
 * Add or update a character mapping
 * @param {string} fancyChar - The decorative character to map
 * @param {string} asciiChar - The ASCII equivalent
 * @returns {Object} Result with success status and message
 */
function addMapping ( fancyChar, asciiChar ) {
    if ( !fancyChar || fancyChar.length === 0 ) {
        return { success: false, message: 'Fancy character is required' };
    }
    if ( !asciiChar || asciiChar.length === 0 ) {
        return { success: false, message: 'ASCII character is required' };
    }

    // Validate that replacement is a standard ASCII character
    if ( !isStandardASCII( asciiChar ) ) {
        return {
            success: false,
            message: `Invalid replacement character: "${ asciiChar }". Replacement must be a standard ASCII character (A-Z, a-z, 0-9, or common symbols).`
        };
    }

    loadMappings();
    const isUpdate = characterMappings.hasOwnProperty( fancyChar );
    characterMappings[ fancyChar ] = asciiChar;

    if ( saveMappings() ) {
        return {
            success: true,
            message: isUpdate
                ? `Updated mapping: "${ fancyChar }" → "${ asciiChar }"`
                : `Added mapping: "${ fancyChar }" → "${ asciiChar }"`
        };
    } else {
        return { success: false, message: 'Failed to save mappings file' };
    }
}

/**
 * Remove a character mapping
 * @param {string} fancyChar - The decorative character to remove
 * @returns {Object} Result with success status and message
 */
function removeMapping ( fancyChar ) {
    if ( !fancyChar || fancyChar.length === 0 ) {
        return { success: false, message: 'Character is required' };
    }

    loadMappings();

    if ( !characterMappings.hasOwnProperty( fancyChar ) ) {
        return { success: false, message: `No mapping found for "${ fancyChar }"` };
    }

    const oldValue = characterMappings[ fancyChar ];
    delete characterMappings[ fancyChar ];

    if ( saveMappings() ) {
        return { success: true, message: `Removed mapping: "${ fancyChar }" → "${ oldValue }"` };
    } else {
        return { success: false, message: 'Failed to save mappings file' };
    }
}

/**
 * Get all current character mappings
 * @returns {Object} All character mappings
 */
function getMappings () {
    return loadMappings();
}

/**
 * Clear the cached mappings to force a reload on next use
 */
function clearCache () {
    characterMappings = null;
}

module.exports = {
    normalizeText,
    loadMappings,
    addMapping,
    removeMapping,
    getMappings,
    clearCache,
    isStandardASCII
};
