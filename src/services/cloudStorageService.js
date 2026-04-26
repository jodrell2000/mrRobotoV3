const { Storage } = require( '@google-cloud/storage' );
const { logger } = require( '../lib/logging' );
const fs = require( 'fs' ).promises;
const path = require( 'path' );

/**
 * Cloud Storage Service
 * Handles synchronization of data directory with Google Cloud Storage
 */
class CloudStorageService {
    constructor () {
        this.storage = null;
        this.bucketName = process.env.GCS_BUCKET_NAME || null;
        this.bucket = null;
        this.dataDir = path.join( process.cwd(), 'data' );
        this.enabled = false;

        // Initialize if bucket name is provided
        if ( this.bucketName ) {
            try {
                this.storage = new Storage();
                this.bucket = this.storage.bucket( this.bucketName );
                this.enabled = true;
                logger.info( `☁️ [CloudStorageService] Initialized with bucket: ${ this.bucketName }` );
            } catch ( error ) {
                logger.warn( `☁️ [CloudStorageService] Failed to initialize: ${ error.message }` );
                this.enabled = false;
            }
        } else {
            logger.info( '☁️ [CloudStorageService] Not enabled (no GCS_BUCKET_NAME configured)' );
        }
    }

    /**
     * Check if Cloud Storage is enabled and configured
     * @returns {boolean}
     */
    isEnabled () {
        return this.enabled;
    }

    /**
     * Upload a single file to GCS
     * @param {string} localPath - Local file path
     * @param {string} gcsPath - Path in GCS bucket
     * @returns {Promise<boolean>}
     */
    async uploadFile ( localPath, gcsPath ) {
        if ( !this.enabled ) {
            logger.debug( `☁️ [CloudStorageService] Skipping upload (not enabled): ${ localPath }` );
            return false;
        }

        try {
            await this.bucket.upload( localPath, {
                destination: gcsPath,
                metadata: {
                    cacheControl: 'no-cache',
                },
            } );
            logger.debug( `☁️ [CloudStorageService] Uploaded: ${ gcsPath }` );
            return true;
        } catch ( error ) {
            logger.error( `☁️ [CloudStorageService] Failed to upload ${ localPath }: ${ error.message }` );
            return false;
        }
    }

    /**
     * Download a single file from GCS
     * @param {string} gcsPath - Path in GCS bucket
     * @param {string} localPath - Local file path to save to
     * @returns {Promise<boolean>}
     */
    async downloadFile ( gcsPath, localPath ) {
        if ( !this.enabled ) {
            logger.debug( `☁️ [CloudStorageService] Skipping download (not enabled): ${ gcsPath }` );
            return false;
        }

        try {
            // Ensure directory exists
            const dir = path.dirname( localPath );
            await fs.mkdir( dir, { recursive: true } );

            // Download file
            await this.bucket.file( gcsPath ).download( {
                destination: localPath,
            } );

            // Verify file was written successfully
            const stats = await fs.stat( localPath );
            if ( stats.size === 0 ) {
                logger.error( `☁️ [CloudStorageService] Downloaded file is empty: ${ gcsPath }` );
                return false;
            }

            // Verify file is readable
            await fs.access( localPath, fs.constants.R_OK );

            logger.debug( `☁️ [CloudStorageService] Downloaded: ${ gcsPath } -> ${ localPath } (${ stats.size } bytes)` );
            return true;
        } catch ( error ) {
            if ( error.code === 404 ) {
                logger.debug( `☁️ [CloudStorageService] File not found in GCS: ${ gcsPath }` );
            } else {
                logger.error( `☁️ [CloudStorageService] Failed to download ${ gcsPath }: ${ error.message }` );
            }
            return false;
        }
    }

    /**
     * Check if a file exists in GCS
     * @param {string} gcsPath - Path in GCS bucket
     * @returns {Promise<boolean>}
     */
    async fileExists ( gcsPath ) {
        if ( !this.enabled ) {
            return false;
        }

        try {
            const [ exists ] = await this.bucket.file( gcsPath ).exists();
            return exists;
        } catch ( error ) {
            logger.error( `☁️ [CloudStorageService] Error checking file existence: ${ error.message }` );
            return false;
        }
    }

    /**
     * Upload all files from data directory to GCS
     * @returns {Promise<{success: boolean, uploaded: number, failed: number}>}
     */
    async syncToCloud () {
        if ( !this.enabled ) {
            logger.warn( '☁️ [CloudStorageService] Cannot sync to cloud - service not enabled' );
            return { success: false, uploaded: 0, failed: 0 };
        }

        logger.info( '☁️ [CloudStorageService] Starting sync to cloud...' );
        let uploaded = 0;
        let failed = 0;

        try {
            // Get all files in data directory
            const files = await this.getAllDataFiles();

            for ( const file of files ) {
                const localPath = path.join( this.dataDir, file );
                const gcsPath = `data/${ file }`;

                const success = await this.uploadFile( localPath, gcsPath );
                if ( success ) {
                    uploaded++;
                } else {
                    failed++;
                }
            }

            logger.info( `☁️ [CloudStorageService] Sync complete: ${ uploaded } uploaded, ${ failed } failed` );
            return { success: failed === 0, uploaded, failed };
        } catch ( error ) {
            logger.error( `☁️ [CloudStorageService] Sync to cloud failed: ${ error.message }` );
            return { success: false, uploaded, failed };
        }
    }

    /**
     * Download all files from GCS to data directory
     * @returns {Promise<{success: boolean, downloaded: number, failed: number}>}
     */
    async syncFromCloud () {
        if ( !this.enabled ) {
            logger.warn( '☁️ [CloudStorageService] Cannot sync from cloud - service not enabled' );
            return { success: false, downloaded: 0, failed: 0 };
        }

        logger.info( '☁️ [CloudStorageService] Starting sync from cloud...' );
        let downloaded = 0;
        let failed = 0;
        let totalBytes = 0;

        try {
            // List all files in the data/ prefix
            const [ files ] = await this.bucket.getFiles( { prefix: 'data/' } );
            logger.info( `☁️ [CloudStorageService] Found ${ files.length } files in cloud` );

            for ( const file of files ) {
                // Skip directory markers
                if ( file.name.endsWith( '/' ) ) {
                    continue;
                }

                // Extract relative path (remove 'data/' prefix)
                const relativePath = file.name.substring( 5 );
                const localPath = path.join( this.dataDir, relativePath );

                const success = await this.downloadFile( file.name, localPath );
                if ( success ) {
                    downloaded++;
                    // Get file size for logging
                    try {
                        const stats = await fs.stat( localPath );
                        totalBytes += stats.size;
                    } catch ( e ) {
                        // Ignore stat errors
                    }
                } else {
                    failed++;
                }
            }

            // Give file system a moment to flush all writes
            await new Promise( resolve => setTimeout( resolve, 100 ) );

            logger.info( `☁️ [CloudStorageService] Sync from cloud complete: ${ downloaded } downloaded (${ totalBytes } bytes), ${ failed } failed` );
            return { success: failed === 0, downloaded, failed };
        } catch ( error ) {
            logger.error( `☁️ [CloudStorageService] Sync from cloud failed: ${ error.message }` );
            return { success: false, downloaded, failed };
        }
    }

    /**
     * Get all data files (excluding example files and hidden files)
     * @returns {Promise<string[]>}
     */
    async getAllDataFiles () {
        const files = [];

        async function scanDir ( dir, baseDir ) {
            const entries = await fs.readdir( dir, { withFileTypes: true } );

            for ( const entry of entries ) {
                const fullPath = path.join( dir, entry.name );
                const relativePath = path.relative( baseDir, fullPath );

                // Skip hidden files, example files, and .gitkeep
                if ( entry.name.startsWith( '.' ) ||
                    entry.name.endsWith( '_example' ) ||
                    entry.name === '.gitkeep' ) {
                    continue;
                }

                if ( entry.isDirectory() ) {
                    await scanDir( fullPath, baseDir );
                } else if ( entry.isFile() ) {
                    files.push( relativePath );
                }
            }
        }

        try {
            await scanDir( this.dataDir, this.dataDir );
        } catch ( error ) {
            logger.error( `☁️ [CloudStorageService] Error scanning data directory: ${ error.message }` );
        }

        return files;
    }

    /**
     * Load initial data from cloud on startup
     * @returns {Promise<boolean>}
     */
    async loadFromCloudOnStartup () {
        if ( !this.enabled ) {
            logger.info( '☁️ [CloudStorageService] Skipping cloud data load (not enabled)' );
            return false;
        }

        logger.info( '☁️ [CloudStorageService] Loading data from cloud on startup...' );

        // Check if any data exists in cloud
        const hasData = await this.fileExists( 'data/botConfig.json' );

        if ( !hasData ) {
            logger.info( '☁️ [CloudStorageService] No data found in cloud, using defaults' );
            return false;
        }

        // Sync all data from cloud
        const result = await this.syncFromCloud();

        if ( result.success && result.downloaded > 0 ) {
            logger.info( `☁️ [CloudStorageService] Successfully loaded ${ result.downloaded } files from cloud` );
            return true;
        }

        logger.warn( '☁️ [CloudStorageService] Failed to load data from cloud, using defaults' );
        return false;
    }
}

module.exports = CloudStorageService;
