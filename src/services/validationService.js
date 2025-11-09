// src/services/validationService.js
const fs = require( 'fs' );
const path = require( 'path' );
const axios = require( 'axios' );
const { logger } = require( '../lib/logging.js' );

const CACHE_FILE = path.join( __dirname, '../../data/image-validation-cache.json' );
const CACHE_TTL_DAYS = 30;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
const CHECK_TIMEOUT = 15000; // 15 second timeout per image (increased from 5)
const MAX_RETRIES = 2; // Retry failed requests

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
    async extractAllImages () {
        const images = [];

        try {
            const chatPath = path.join( __dirname, '../../data/chat.json' );
            
            if ( !fs.existsSync( chatPath ) ) {
                logger.warn( `📋 chat.json not found at ${ chatPath }` );
                return images;
            }

            const chatDataRaw = fs.readFileSync( chatPath, 'utf8' );
            const chatData = JSON.parse( chatDataRaw );

            for ( const [ commandName, commandData ] of Object.entries( chatData ) ) {
                if ( commandData?.pictures && Array.isArray( commandData.pictures ) ) {
                    for ( const imageUrl of commandData.pictures ) {
                        // Filter out null/undefined values
                        if ( imageUrl && imageUrl.trim() !== '' ) {
                            images.push( { url: imageUrl, command: commandName } );
                        }
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
     * Get images that need checking (never checked, older than TTL, or previously marked as dead)
     */
    getImagesToCheck ( allImages ) {
        const now = Date.now();
        const imagesToCheck = [];

        for ( const image of allImages ) {
            const cached = this.cache[ image.url ];

            if ( !cached ) {
                // Never checked before
                imagesToCheck.push( image );
                logger.debug( `🔍 Adding unchecked image: ${ image.url }` );
            } else if ( now - cached.lastChecked > CACHE_TTL_MS ) {
                // Checked but expired (older than 30 days)
                imagesToCheck.push( image );
                logger.debug( `🕒 Adding expired image: ${ image.url } (last checked ${ Math.round( ( now - cached.lastChecked ) / ( 24 * 60 * 60 * 1000 ) ) } days ago)` );
            } else if ( cached.status === 'dead' ) {
                // Previously marked as dead - always re-check to see if it's been fixed
                imagesToCheck.push( image );
                logger.debug( `💀 Adding previously dead image for re-check: ${ image.url }` );
            }
            // else: recently checked and was OK, skip
        }

        logger.debug( `🔍 Found ${ imagesToCheck.length } images to check (out of ${ allImages.length } total)` );
        return imagesToCheck;
    },

    /**
     * Check if image URL is accessible with retry logic
     */
    async checkImageUrl ( imageUrl ) {
        let lastError;
        
        for ( let attempt = 1; attempt <= MAX_RETRIES; attempt++ ) {
            try {
                // Try HEAD request first (faster)
                let response = await axios.head( imageUrl, {
                    timeout: CHECK_TIMEOUT,
                    maxRedirects: 5,
                    validateStatus: () => true, // Accept all status codes
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; mrRobotoV3-ImageValidator/1.0; +https://github.com/jodrell2000/mrRobotoV3)'
                    }
                } );

                // If HEAD fails with 405 (Method Not Allowed) or 404 (Not Found), try GET with range request
                // Some servers don't support HEAD requests for images but work fine with GET
                if ( response.status === 405 || response.status === 404 ) {
                    logger.debug( `🔄 HEAD request returned ${ response.status } for ${ imageUrl }, trying GET with range...` );
                    
                    response = await axios.get( imageUrl, {
                        timeout: CHECK_TIMEOUT,
                        maxRedirects: 5,
                        validateStatus: () => true,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; mrRobotoV3-ImageValidator/1.0; +https://github.com/jodrell2000/mrRobotoV3)',
                            'Range': 'bytes=0-1023' // Only get first 1KB to check if image exists
                        }
                    } );
                    
                    logger.debug( `🔄 GET request returned ${ response.status } for ${ imageUrl }` );
                }

                // Accept 2xx status codes and 206 (Partial Content) as successful
                const status = ( response.status >= 200 && response.status < 300 ) || response.status === 206 ? 'ok' : 'dead';

                // Log successful validation attempt info
                if ( attempt > 1 ) {
                    logger.debug( `✅ Image validation succeeded on attempt ${ attempt }: ${ imageUrl } (status: ${ response.status })` );
                }

                const result = {
                    url: imageUrl,
                    status: status,
                    statusCode: response.status,
                    lastChecked: Date.now(),
                    attempts: attempt
                };
                
                // Update cache (saved periodically during validation)
                this.cache[ imageUrl ] = result;
                
                return result;
            } catch ( error ) {
                lastError = error;
                
                // Log retry attempts
                if ( attempt < MAX_RETRIES ) {
                    logger.debug( `⚠️  Image validation attempt ${ attempt } failed for ${ imageUrl }: ${ error.message }. Retrying...` );
                    // Wait 2 seconds before retry
                    await new Promise( resolve => setTimeout( resolve, 2000 ) );
                } else {
                    logger.debug( `❌ Image validation failed after ${ MAX_RETRIES } attempts for ${ imageUrl }: ${ error.message }` );
                }
            }
        }

        // All attempts failed
        const result = {
            url: imageUrl,
            status: 'dead',
            statusCode: 0,
            error: lastError.message,
            lastChecked: Date.now(),
            attempts: MAX_RETRIES
        };
        
        // Update cache (saved periodically during validation)
        this.cache[ imageUrl ] = result;
        
        return result;
    },

    /**
     * Start validation of images (unchecked, >30 days old, or previously dead)
     */
    async startValidation () {
        if ( this.state.isValidating ) {
            logger.warn( `⚠️  Validation already in progress` );
            return { success: false, message: 'Validation already in progress' };
        }

        try {
            // Reload cache to ensure we have the latest validation results
            await this.loadCache();
            
            const allImages = await this.extractAllImages();
            const imagesToCheck = this.getImagesToCheck( allImages );

            // Count different types of images being checked
            const now = Date.now();
            let uncheckedCount = 0;
            let expiredCount = 0;
            let deadCount = 0;

            for ( const image of imagesToCheck ) {
                const cached = this.cache[ image.url ];
                if ( !cached ) {
                    uncheckedCount++;
                } else if ( cached.status === 'dead' ) {
                    deadCount++;
                } else if ( now - cached.lastChecked > CACHE_TTL_MS ) {
                    expiredCount++;
                }
            }

            if ( imagesToCheck.length === 0 ) {
                return { success: true, message: 'All images were checked recently and are working, nothing to validate' };
            }

            this.state.isValidating = true;
            this.state.currentIndex = 0;
            this.state.allImages = imagesToCheck;
            this.state.results = { checked: 0, dead: [], ok: [] };
            this.state.startedAt = Date.now();
            this.state.deadImages = {};

            const breakdown = [];
            if ( uncheckedCount > 0 ) breakdown.push( `${ uncheckedCount } new` );
            if ( expiredCount > 0 ) breakdown.push( `${ expiredCount } expired (>30 days)` );
            if ( deadCount > 0 ) breakdown.push( `${ deadCount } previously dead` );

            const message = `Started validation of ${ imagesToCheck.length } images (${ breakdown.join( ', ' ) }) at 1 per second`;

            logger.info( `🚀 ${ message }` );

            return {
                success: true,
                message
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

            // Track results (cache is already updated in checkImageUrl)
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
            
            // Save cache every 10 images to prevent data loss
            if ( this.state.results.checked % 10 === 0 ) {
                await this.saveCache();
                logger.debug( `💾 Cache saved at ${ this.state.results.checked } images` );
            }
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
        logger.debug( `💾 Final cache saved after validation completion` );

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
     * Stop validation (emergency stop)
     */
    async stopValidation () {
        if ( this.state.isValidating ) {
            this.state.isValidating = false;
            await this.saveCache();
            logger.info( `🛑 Validation stopped by user` );
            return { success: true, message: 'Validation stopped' };
        }
        return { success: false, message: 'No validation in progress' };
    },

    /**
     * Get dead images report
     */
    async getReport () {
        // Reload cache to ensure we have latest data
        await this.loadCache();
        
        // Get all images once to avoid repeated calls
        const allImages = await this.extractAllImages();
        
        // Get dead images from cache
        const deadFromCache = {};
        
        for ( const [ url, data ] of Object.entries( this.cache ) ) {
            if ( data.status === 'dead' ) {
                // Find which command this URL belongs to
                const imageInfo = allImages.find( img => img.url === url );
                if ( imageInfo ) {
                    if ( !deadFromCache[ imageInfo.command ] ) {
                        deadFromCache[ imageInfo.command ] = [];
                    }
                    deadFromCache[ imageInfo.command ].push( url );
                }
            }
        }
        
        // Combine with any current validation state
        const combinedDead = { ...deadFromCache };
        for ( const [ command, urls ] of Object.entries( this.state.deadImages || {} ) ) {
            if ( !combinedDead[ command ] ) {
                combinedDead[ command ] = [];
            }
            // Add any new dead images from current state that aren't in cache yet
            for ( const url of urls ) {
                if ( !combinedDead[ command ].includes( url ) ) {
                    combinedDead[ command ].push( url );
                }
            }
        }
        
        // Count total dead images
        const totalDeadCount = Object.values( combinedDead ).reduce( ( total, urls ) => total + urls.length, 0 );
        
        if ( Object.keys( combinedDead ).length === 0 ) {
            return {
                summary: 'No dead images found',
                dead: {}
            };
        }

        return {
            summary: `Found ${ totalDeadCount } dead images across ${ Object.keys( combinedDead ).length } commands`,
            dead: combinedDead
        };
    },

    /**
     * Remove all dead images from chat.json
     */
    async removeDeadImages () {
        // Get current dead images from both cache and validation state
        const report = await this.getReport();
        
        if ( Object.keys( report.dead ).length === 0 ) {
            return {
                success: true,
                message: 'No dead images to remove'
            };
        }

        try {
            const chatPath = path.join( __dirname, '../../data/chat.json' );
            
            if ( !fs.existsSync( chatPath ) ) {
                return {
                    success: false,
                    message: 'chat.json not found'
                };
            }

            const chatDataRaw = fs.readFileSync( chatPath, 'utf8' );
            const chatData = JSON.parse( chatDataRaw );
            let removedCount = 0;

            for ( const [ commandName, deadUrls ] of Object.entries( report.dead ) ) {
                if ( chatData[ commandName ] && Array.isArray( chatData[ commandName ].pictures ) ) {
                    const originalLength = chatData[ commandName ].pictures.length;
                    chatData[ commandName ].pictures = chatData[ commandName ].pictures.filter(
                        url => !deadUrls.includes( url )
                    );
                    removedCount += originalLength - chatData[ commandName ].pictures.length;
                }
            }

            // Save updated chat data
            fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );

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
    },

    /**
     * Remove a specific URL from the cache to force re-validation
     */
    removeCacheEntry( url ) {
        if ( this.cache[ url ] ) {
            delete this.cache[ url ];
            this.saveCache().catch( err => logger.warn( `Failed to save cache: ${ err.message }` ) );
            logger.info( `🗑️ Removed cache entry for: ${ url }` );
            return true;
        }
        return false;
    }
};

module.exports = validationService;
