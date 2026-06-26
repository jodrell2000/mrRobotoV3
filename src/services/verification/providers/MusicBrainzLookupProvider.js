const axios = require( 'axios' );
const BaseProvider = require( './BaseProvider' );

/**
 * MusicBrainz provider for track verification via external URLs
 * Uses MusicBrainz's URL lookup endpoint to resolve Spotify/Deezer/etc IDs
 * Requires no authentication, just Rate-Agent header compliance
 */
class MusicBrainzLookupProvider extends BaseProvider {
    constructor ( services = {} ) {
        super( 'musicbrainz', services.logger || console );
        this.services = services;
        this.timeout = 5000;
        this.userAgent = 'mrRobotoV3/1.0 (https://github.com/jodrell2000/mrRobotoV3)';
    }

    isAvailable () {
        // MusicBrainz is always available - no authentication required
        return true;
    }

    /**
     * Verify track via MusicBrainz URL lookup
     * Resolves external music provider IDs (Spotify, Deezer, etc) to MusicBrainz recordings
     * @param {string} query - Track name (not used, URL lookup doesn't need it)
     * @param {Object} options - Query options
     *   - musicProviders: Object with provider IDs (spotify, deezer, tidal, apple, etc)
     * @returns {Promise<Object>} Result: { found: boolean, data: Object|null, error: string|null }
     */
    async verify ( query, options = {} ) {
        try {
            const musicProviders = options.musicProviders || {};

            // Try providers in order of preference (most reliable/detailed first)
            const providers = [
                { name: 'spotify', url: ( id ) => `https://open.spotify.com/track/${ id }` },
                { name: 'deezer', url: ( id ) => `https://www.deezer.com/track/${ id }` },
                { name: 'tidal', url: ( id ) => `https://tidal.com/track/${ id }` },
                { name: 'apple', url: ( id ) => `https://music.apple.com/us/song/${ id }` }
            ];

            let lastError = null;
            for ( const provider of providers ) {
                if ( musicProviders[ provider.name ] ) {
                    const externalUrl = provider.url( musicProviders[ provider.name ] );
                    this.logger.debug( `[MusicBrainzLookup] Looking up ${ provider.name } URL: ${ externalUrl }` );

                    try {
                        const mbData = await this._lookupByUrl( externalUrl );
                        if ( mbData ) {
                            return {
                                found: true,
                                data: mbData
                            };
                        }
                    } catch ( err ) {
                        // Track last error - could be network error or 404
                        lastError = err;
                        this.logger.debug( `[MusicBrainzLookup] ${ provider.name } lookup failed: ${ err.message }` );
                        // Continue to next provider on 404, but if it's a network error, might want to fail
                        if ( err.response?.status !== 404 ) {
                            // For non-404 errors (network, timeout, etc), return the error immediately
                            return {
                                found: false,
                                error: err.message
                            };
                        }
                    }
                }
            }

            return {
                found: false,
                error: lastError?.message || 'No matching MusicBrainz data found for provided music provider IDs'
            };
        } catch ( error ) {
            this.logger.debug( `[MusicBrainzLookup] Error: ${ error.message }` );
            return {
                found: false,
                error: error.message
            };
        }
    }

    /**
     * Look up a track by external URL via MusicBrainz
     * @private
     */
    async _lookupByUrl ( externalUrl ) {
        try {
            const response = await axios.get( 'https://musicbrainz.org/ws/2/url', {
                params: {
                    resource: externalUrl,
                    fmt: 'json',
                    inc: 'release-rels'
                },
                timeout: this.timeout,
                headers: {
                    'User-Agent': this.userAgent
                }
            } );

            const urlData = response.data;

            // Extract recording info from relations
            if ( !urlData.relations || urlData.relations.length === 0 ) {
                return null;
            }

            // Find the recording relationship
            const recordingRel = urlData.relations.find( rel => rel[ 'target-type' ] === 'recording' );
            if ( !recordingRel ) {
                return null;
            }

            const recordingId = recordingRel.target;
            const recording = await this._getRecordingDetails( recordingId );

            if ( !recording ) {
                return null;
            }

            return recording;
        } catch ( error ) {
            if ( error.response?.status === 404 ) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Get detailed recording information from MusicBrainz
     * @private
     */
    async _getRecordingDetails ( recordingId ) {
        try {
            const response = await axios.get( `https://musicbrainz.org/ws/2/recording/${ recordingId }`, {
                params: {
                    fmt: 'json',
                    inc: 'releases+recordings+artists'
                },
                timeout: this.timeout,
                headers: {
                    'User-Agent': this.userAgent
                }
            } );

            const recording = response.data;

            if ( !recording ) {
                return null;
            }

            // Extract artist information
            const artistCredit = recording[ 'artist-credit' ];
            const artists = artistCredit ? artistCredit.map( ac => ac.artist.name ) : [];

            // Find best release (prefer official studio albums)
            let bestRelease = null;
            if ( recording.releases && recording.releases.length > 0 ) {
                bestRelease = this._selectBestRelease( recording.releases );
            }

            // Build response
            const data = {
                type: 'track',
                name: recording.title,
                artist: artists[ 0 ] || null,
                artists: artists,
                mbid: recording.id,
                duration: recording.length ? Math.round( recording.length / 1000 ) : null
            };

            // Add release information if available
            if ( bestRelease ) {
                data.album = bestRelease.title;
                data.albumMbid = bestRelease.id;
                data.releaseDate = bestRelease.date;
                data.albumType = bestRelease[ 'release-group' ]?.[ 'primary-type' ] || null;

                // Get track position
                if ( bestRelease.media && bestRelease.media.length > 0 ) {
                    for ( const medium of bestRelease.media ) {
                        const track = medium.tracks?.find( t => t.recording?.id === recording.id );
                        if ( track ) {
                            data.trackPosition = track.position;
                            break;
                        }
                    }
                }
            }

            return data;
        } catch ( error ) {
            this.logger.debug( `[MusicBrainzLookup] Could not fetch recording details: ${ error.message }` );
            return null;
        }
    }

    /**
     * Select best release (prefer official studio albums)
     * @private
     */
    _selectBestRelease ( releases ) {
        const scored = releases.map( release => {
            let score = 0;

            // Primary type scoring: album > single > compilation > EP > other
            const primaryType = release[ 'release-group' ]?.[ 'primary-type' ];
            if ( primaryType === 'Album' ) score += 1000;
            else if ( primaryType === 'Single' ) score += 500;
            else if ( primaryType === 'Compilation' ) score += 100;
            else if ( primaryType === 'EP' ) score += 200;

            // Status scoring: official > other
            if ( release.status === 'Official' ) score += 100;

            // Prefer earlier dates (original release)
            if ( release.date ) {
                // Subtract a small amount for each year (older = higher score within same status)
                const year = parseInt( release.date.split( '-' )[ 0 ], 10 );
                score += Math.max( 0, 2100 - year );
            }

            return { release, score };
        } );

        scored.sort( ( a, b ) => b.score - a.score );
        return scored[ 0 ]?.release || releases[ 0 ];
    }
}

module.exports = MusicBrainzLookupProvider;
