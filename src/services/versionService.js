const fs = require( 'fs' ).promises;
const path = require( 'path' );
const { logger } = require( '../lib/logging.js' );

class VersionService {
    constructor () {
        this.versionInfo = undefined;
    }

    /**
     * Load version information from VERSION file or fallback to package.json
     * @returns {Promise<Object>} Version information object
     */
    async loadVersion () {
        if ( this.versionInfo ) {
            return this.versionInfo;
        }

        try {
            const versionPath = path.join( process.cwd(), 'VERSION' );
            const fileContent = await fs.readFile( versionPath, 'utf8' );
            this.versionInfo = JSON.parse( fileContent );
            logger.info( `Loaded version info from VERSION file: ${ this.versionInfo.tag }` );
            return this.versionInfo;
        } catch ( error ) {
            if ( error.code === 'ENOENT' ) {
                logger.warn( 'VERSION file not found, falling back to package.json' );
            } else {
                logger.warn( `Failed to read VERSION file: ${ error.message }, falling back to package.json` );
            }

            try {
                const packagePath = path.join( process.cwd(), 'package.json' );
                const packageContent = await fs.readFile( packagePath, 'utf8' );
                const packageJson = JSON.parse( packageContent );

                this.versionInfo = {
                    version: packageJson.version,
                    tag: `v${ packageJson.version }`,
                    buildDate: undefined,
                    gitCommit: undefined,
                    packageVersion: packageJson.version
                };

                logger.info( `Using version from package.json: ${ this.versionInfo.version }` );
                return this.versionInfo;
            } catch ( fallbackError ) {
                logger.error( `Failed to read package.json: ${ fallbackError.message }` );
                this.versionInfo = {
                    version: 'unknown',
                    tag: 'unknown',
                    buildDate: undefined,
                    gitCommit: undefined,
                    packageVersion: 'unknown'
                };
                return this.versionInfo;
            }
        }
    }

    /**
     * Get version information (loads if not already loaded)
     * @returns {Promise<Object>} Version information object
     */
    async getVersion () {
        return await this.loadVersion();
    }

    /**
     * Get just the version string (e.g., "1.2.0")
     * @returns {Promise<string>} Version string
     */
    async getVersionString () {
        const info = await this.getVersion();
        return info.version;
    }

    /**
     * Get just the git tag (e.g., "v1.2.0")
     * @returns {Promise<string>} Git tag string
     */
    async getTag () {
        const info = await this.getVersion();
        return info.tag;
    }

    /**
     * Get build date (may be undefined if using package.json fallback)
     * @returns {Promise<string|undefined>} Build date ISO string
     */
    async getBuildDate () {
        const info = await this.getVersion();
        return info.buildDate;
    }

    /**
     * Get git commit SHA (may be undefined if using package.json fallback)
     * @returns {Promise<string|undefined>} Git commit SHA
     */
    async getGitCommit () {
        const info = await this.getVersion();
        return info.gitCommit;
    }
}

module.exports = VersionService;
