const { logger } = require( '../lib/logging' );

/**
 * MusicBrainz Service
 * Provides song metadata lookup via the MusicBrainz API
 * API Documentation: https://musicbrainz.org/doc/MusicBrainz_API
 */
class MusicBrainzService {
    constructor ( botName ) {
        this.baseUrl = 'https://musicbrainz.org/ws/2';
        // MusicBrainz requires a descriptive User-Agent with contact info
        // Each bot deployment should have its own User-Agent for proper rate limiting
        const safeBotName = ( botName || 'MrRobotoBot' ).replace( /[^a-zA-Z0-9_-]/g, '' );
        this.userAgent = `${ safeBotName }/1.0 (https://github.com/jodrell2000/mrRobotoV3)`;
        // Rate limiting: MusicBrainz allows 1 request per second
        this.lastRequestTime = 0;
        this.minRequestInterval = 1100; // 1.1 seconds to be safe

        logger.debug( `🎵 [MusicBrainzService] Initialized with User-Agent: ${ this.userAgent }` );
    }

    /**
     * Enforce rate limiting for MusicBrainz API
     * @returns {Promise<void>}
     */
    async enforceRateLimit () {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if ( timeSinceLastRequest < this.minRequestInterval ) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            await new Promise( resolve => setTimeout( resolve, waitTime ) );
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Make a rate-limited request to MusicBrainz API
     * @param {string} endpoint - API endpoint path
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} API response
     */
    async makeRequest ( endpoint, params = {} ) {
        await this.enforceRateLimit();

        const url = new URL( `${ this.baseUrl }${ endpoint }` );
        url.searchParams.set( 'fmt', 'json' );

        for ( const [ key, value ] of Object.entries( params ) ) {
            url.searchParams.set( key, value );
        }

        logger.debug( `🎵 [MusicBrainzService] Requesting: ${ url.toString() }` );

        const response = await fetch( url.toString(), {
            headers: {
                'User-Agent': this.userAgent,
                'Accept': 'application/json'
            }
        } );

        if ( !response.ok ) {
            throw new Error( `MusicBrainz API error: ${ response.status } ${ response.statusText }` );
        }

        return response.json();
    }

    /**
     * Search for a recording (song) by artist and track name
     * @param {string} artist - Artist name
     * @param {string} track - Track/song name
     * @returns {Promise<Object|null>} Recording data or null if not found
     */
    async searchRecording ( artist, track ) {
        try {
            // Build the search query - escape special Lucene characters
            const escapedArtist = this.escapeLuceneQuery( artist );
            const escapedTrack = this.escapeLuceneQuery( track );
            const query = `recording:"${ escapedTrack }" AND artist:"${ escapedArtist }"`;

            const data = await this.makeRequest( '/recording', { query, limit: 5 } );

            if ( !data.recordings || data.recordings.length === 0 ) {
                logger.debug( `🎵 [MusicBrainzService] No recordings found for "${ track }" by "${ artist }"` );
                return null;
            }

            // Return the best match (first result, highest score)
            return data.recordings[ 0 ];
        } catch ( error ) {
            logger.error( `🎵 [MusicBrainzService] Error searching recording: ${ error.message }` );
            return null;
        }
    }

    /**
     * Get detailed recording information including releases
     * @param {string} recordingId - MusicBrainz recording ID
     * @returns {Promise<Object|null>} Detailed recording data
     */
    async getRecordingDetails ( recordingId ) {
        try {
            const data = await this.makeRequest( `/recording/${ recordingId }`, {
                inc: 'releases+artist-credits+genres'
            } );
            return data;
        } catch ( error ) {
            logger.error( `🎵 [MusicBrainzService] Error getting recording details: ${ error.message }` );
            return null;
        }
    }

    /**
     * Get release (album) details
     * @param {string} releaseId - MusicBrainz release ID
     * @returns {Promise<Object|null>} Release data
     */
    async getReleaseDetails ( releaseId ) {
        try {
            const data = await this.makeRequest( `/release/${ releaseId }`, {
                inc: 'labels+recordings+release-groups'
            } );
            return data;
        } catch ( error ) {
            logger.error( `🎵 [MusicBrainzService] Error getting release details: ${ error.message }` );
            return null;
        }
    }

    /**
     * Escape special characters for Lucene query syntax
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeLuceneQuery ( str ) {
        // Lucene special characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
        return str.replace( /([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1' );
    }

    /**
     * Find the earliest release date from a list of releases
     * @param {Array} releases - Array of release objects
     * @returns {Object} Object with year and release info
     */
    findEarliestRelease ( releases ) {
        if ( !releases || releases.length === 0 ) {
            return { year: null, release: null };
        }

        let earliest = null;
        let earliestDate = null;

        for ( const release of releases ) {
            const date = release.date || release[ 'first-release-date' ];
            if ( date ) {
                const releaseDate = new Date( date );
                if ( !earliestDate || releaseDate < earliestDate ) {
                    earliestDate = releaseDate;
                    earliest = release;
                }
            }
        }

        return {
            year: earliestDate ? earliestDate.getFullYear() : null,
            date: earliestDate ? earliestDate.toISOString().split( 'T' )[ 0 ] : null,
            release: earliest
        };
    }

    /**
     * Get comprehensive song details by artist and track name
     * This is the main function to be called by the ML service
     * @param {string} artist - Artist name
     * @param {string} track - Track/song name
     * @returns {Promise<Object>} Song details including release date, albums, etc.
     */
    async getSongDetails ( artist, track ) {
        try {
            logger.info( `🎵 [MusicBrainzService] Looking up "${ track }" by "${ artist }"` );

            // Search for the recording
            const recording = await this.searchRecording( artist, track );

            if ( !recording ) {
                return {
                    found: false,
                    error: `No information found for "${ track }" by "${ artist }" in MusicBrainz database`,
                    artist,
                    track
                };
            }

            // Extract basic info from search result
            const result = {
                found: true,
                artist: artist,
                track: track,
                matchedArtist: recording[ 'artist-credit' ]?.[ 0 ]?.name || artist,
                matchedTrack: recording.title || track,
                musicBrainzId: recording.id,
                duration: recording.length ? Math.round( recording.length / 1000 ) : null, // Convert ms to seconds
                releases: []
            };

            // Find earliest release info from the recording's releases
            if ( recording.releases && recording.releases.length > 0 ) {
                const earliest = this.findEarliestRelease( recording.releases );
                result.originalReleaseYear = earliest.year;
                result.originalReleaseDate = earliest.date;

                // Get album names from releases
                result.releases = recording.releases
                    .filter( r => r.title )
                    .map( r => ( {
                        title: r.title,
                        date: r.date,
                        country: r.country,
                        status: r.status
                    } ) )
                    .slice( 0, 5 ); // Limit to 5 releases

                // Set primary album (earliest official release)
                const officialReleases = recording.releases.filter( r => r.status === 'Official' );
                if ( officialReleases.length > 0 ) {
                    const earliestOfficial = this.findEarliestRelease( officialReleases );
                    result.primaryAlbum = earliestOfficial.release?.title;
                } else if ( earliest.release ) {
                    result.primaryAlbum = earliest.release.title;
                }
            }

            // Get additional details if we have a recording ID
            if ( recording.id ) {
                const details = await this.getRecordingDetails( recording.id );
                if ( details ) {
                    // Add genres if available
                    if ( details.genres && details.genres.length > 0 ) {
                        result.genres = details.genres.map( g => g.name );
                    }
                }
            }

            logger.info( `🎵 [MusicBrainzService] Found details for "${ track }": Year ${ result.originalReleaseYear || 'unknown' }, Album: ${ result.primaryAlbum || 'unknown' }` );

            return result;
        } catch ( error ) {
            logger.error( `🎵 [MusicBrainzService] Error getting song details: ${ error.message }` );
            return {
                found: false,
                error: `Error looking up song: ${ error.message }`,
                artist,
                track
            };
        }
    }
}

module.exports = MusicBrainzService;
