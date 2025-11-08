// src/services/validationService.js
const fs = require( 'fs' );
const path = require( 'path' );
const axios = require( 'axios' );
const { logger } = require( '../lib/logging.js' );

const CACHE_FILE = path.join( __dirname, '../../data/image-validation-cache.json' );
const CACHE_TTL_DAYS = 30;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
const CHECK_TIMEOUT = 5000; // 5 second timeout per image

const validationService = {
    state: {
        isValidating: false,
        currentIndex: 0,
        allImages: [],
        results: {
            checked: 0,
            dead: [],
            ok: []
        },
        startedAt: null,
        deadImages: {} // { commandName: [urls] }
    },

    cache: {},

    /**
     * Load validation cache from file
     */
    loadCache () {
        try {
            if ( fs.existsSync( CACHE_FILE ) ) {
                const data = fs.readFileSync( CACHE_FILE, 'utf8' );
                this.cache = JSON.parse( data );
                logger.debug( `✅ Loaded validation cache with ${ Object.keys( this.cache ).length } entries` );
            } else {
                this.cache = {};
                logger.debug( `📝 No validation cache file found, starting fresh` );
            }
        } catch ( error ) {
            logger.error( `❌ Error loading validation cache: ${ error.message }` );
            this.cache = {};
        }
    },

    /**
     * Save validation cache to file
     */
    async saveCache () {
        try {
            fs.writeFileSync( CACHE_FILE, JSON.stringify( this.cache, null, 2 ), 'utf8' );
        } catch ( error ) {
            logger.error( `❌ Error saving validation cache: ${ error.message }` );
        }
    },

    /**
     * Extract all images from chat.json
     */
    async extractAllImages ( dataService ) {
        const images = [];
        const deadImages = {};

        try {
            const chatData = dataService.getValue( null ); // Get all data
            const allChatCommands = chatData || {};

            for ( const [ commandName, commandData ] of Object.entries( allChatCommands ) ) {
                if ( commandData?.pictures && Array.isArray( commandData.pictures ) ) {
                    for ( const imageUrl of commandData.pictures ) {
                        images.push( { url: imageUrl, command: commandName } );
                    }
                }
            }

            logger.debug( `📊 Extracted ${ images.length } total images from chat commands` );
            return images;
        } catch ( error ) {
            logger.error( `❌ Error extracting images: ${ error.message }` );
            return [];
        }
    },

    /**
     * Get images that need checking (older than TTL or not in cache)
     */
    getImagesToCheck ( allImages ) {
        const now = Date.now();
        const imagesToCheck = [];

        for ( const image of allImages ) {
            const cached = this.cache[ image.url ];

            if ( !cached ) {
                // Never checked before
                imagesToCheck.push( image );
            } else if ( now - cached.lastChecked > CACHE_TTL_MS ) {
                // Checked but expired
                imagesToCheck.push( image );
            }
            // else: recently checked, skip
        }

        logger.debug( `🔍 Found ${ imagesToCheck.length } images to check (out of ${ allImages.length } total)` );
        return imagesToCheck;
    },

    /**
     * Check if a single image URL is accessible
     */
    async checkImageUrl ( imageUrl ) {
        try {
            const response = await axios.head( imageUrl, {
                timeout: CHECK_TIMEOUT,
                maxRedirects: 5,
                validateStatus: () => true // Accept all status codes
            } );

            const status = response.status >= 200 && response.status < 300 ? 'ok' : 'dead';

            return {
                url: imageUrl,
                status: status,
                statusCode: response.status,
                lastChecked: Date.now()
            };
        } catch ( error ) {
            // Network error, timeout, etc
            return {
                url: imageUrl,
                status: 'dead',
                statusCode: 0,
                error: error.message,
                lastChecked: Date.now()
            };
        }
    },

    /**
     * Start validation of images older than TTL
     */
    async startValidation ( dataService ) {
        if ( this.state.isValidating ) {
            logger.warn( `⚠️  Validation already in progress` );
            return { success: false, message: 'Validation already in progress' };
        }

        try {
            const allImages = await this.extractAllImages( dataService );
            const imagesToCheck = this.getImagesToCheck( allImages );

            if ( imagesToCheck.length === 0 ) {
                return { success: true, message: 'All images were checked recently, nothing to validate' };
            }

            this.state.isValidating = true;
            this.state.currentIndex = 0;
            this.state.allImages = imagesToCheck;
            this.state.results = { checked: 0, dead: [], ok: [] };
            this.state.startedAt = Date.now();
            this.state.deadImages = {};

            logger.info( `🚀 Starting validation of ${ imagesToCheck.length } images` );

            return {
                success: true,
                message: `Started validation of ${ imagesToCheck.length } images (1 per second)`
            };
        } catch ( error ) {
            logger.error( `❌ Error starting validation: ${ error.message }` );
            return { success: false, message: `Error starting validation: ${ error.message }` };
        }
    },

    /**
     * Process one image (called by background task once per second)
     */
    async processNextImage () {
        if ( !this.state.isValidating || this.state.currentIndex >= this.state.allImages.length ) {
            if ( this.state.isValidating ) {
                // Validation complete
                await this.finishValidation();
            }
            return;
        }

        try {
            const image = this.state.allImages[ this.state.currentIndex ];
            const result = await this.checkImageUrl( image.url );

            // Update cache
            this.cache[ result.url ] = {
                lastChecked: result.lastChecked,
                status: result.status,
                statusCode: result.statusCode
            };

            // Track results
            this.state.results.checked++;
            if ( result.status === 'dead' ) {
                this.state.results.dead.push( { url: image.url, command: image.command, statusCode: result.statusCode } );
                if ( !this.state.deadImages[ image.command ] ) {
                    this.state.deadImages[ image.command ] = [];
                }
                this.state.deadImages[ image.command ].push( image.url );
            } else {
                this.state.results.ok.push( { url: image.url, command: image.command } );
            }

            this.state.currentIndex++;

            logger.debug( `✅ Checked ${ this.state.results.checked }/${ this.state.allImages.length } - ${ result.status }: ${ result.statusCode }` );
        } catch ( error ) {
            logger.error( `❌ Error processing image: ${ error.message }` );
            this.state.currentIndex++;
        }
    },

    /**
     * Finish validation and save cache
     */
    async finishValidation () {
        this.state.isValidating = false;
        const duration = Math.round( ( Date.now() - this.state.startedAt ) / 1000 );

        await this.saveCache();

        logger.info( `✅ Validation complete in ${ duration }s: ${ this.state.results.checked } checked, ${ this.state.results.dead.length } dead` );
    },

    /**
     * Get current validation status
     */
    getStatus () {
        if ( !this.state.isValidating ) {
            return {
                isValidating: false,
                message: 'No validation in progress'
            };
        }

        const progress = this.state.allImages.length > 0
            ? Math.round( ( this.state.currentIndex / this.state.allImages.length ) * 100 )
            : 0;

        return {
            isValidating: true,
            progress: progress,
            checked: this.state.results.checked,
            total: this.state.allImages.length,
            deadFound: this.state.results.dead.length,
            message: `Validation in progress: ${ this.state.currentIndex }/${ this.state.allImages.length } checked (${ progress }%)`
        };
    },

    /**
     * Get dead images report
     */
    getReport () {
        if ( Object.keys( this.state.deadImages ).length === 0 ) {
            return {
                summary: 'No dead images found',
                dead: {}
            };
        }

        return {
            summary: `Found ${ this.state.results.dead.length } dead images across ${ Object.keys( this.state.deadImages ).length } commands`,
            dead: this.state.deadImages
        };
    },

    /**
     * Remove all dead images from chat.json
     */
    async removeDeadImages ( dataService ) {
        if ( Object.keys( this.state.deadImages ).length === 0 ) {
            return {
                success: true,
                message: 'No dead images to remove'
            };
        }

        try {
            const allChatData = dataService.getValue( null );
            let removedCount = 0;

            for ( const [ commandName, deadUrls ] of Object.entries( this.state.deadImages ) ) {
                if ( allChatData[ commandName ] && Array.isArray( allChatData[ commandName ].pictures ) ) {
                    allChatData[ commandName ].pictures = allChatData[ commandName ].pictures.filter(
                        url => !deadUrls.includes( url )
                    );
                    removedCount += deadUrls.length;
                }
            }

            // Save updated chat data
            dataService.setValue( null, allChatData );

            logger.info( `✅ Removed ${ removedCount } dead images from chat commands` );

            return {
                success: true,
                message: `Removed ${ removedCount } dead images`
            };
        } catch ( error ) {
            logger.error( `❌ Error removing dead images: ${ error.message }` );
            return {
                success: false,
                message: `Error removing dead images: ${ error.message }`
            };
        }
    },

    /**
     * Mark an image as checked when used in a chat command
     */
    markImageChecked ( imageUrl ) {
        this.cache[ imageUrl ] = {
            lastChecked: Date.now(),
            status: 'ok',
            statusCode: 200
        };

        // Async save, don't wait
        this.saveCache().catch( err => logger.warn( `Failed to save cache: ${ err.message }` ) );
    }
};

module.exports = validationService;
