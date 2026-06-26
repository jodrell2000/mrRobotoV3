const BaseProvider = require( './BaseProvider.js' );
const axios = require( 'axios' );

/**
 * Last.fm provider for artist and track verification
 * Uses Last.fm's public API to search for and validate artist/track information
 */
class LastfmProvider extends BaseProvider {
    constructor ( services = {} ) {
        super( 'lastfm', services.logger || console );
        this.services = services;
        this.apiKey = process.env.LASTFM_API_KEY;
        this.baseUrl = 'https://ws.audioscrobbler.com/2.0/';
        this.timeout = 3000; // 3 second timeout per request
    }

    isAvailable () {
        return !!this.apiKey;
    }

    /**
     * Verify artist or track information via Last.fm API
     * @param {string} query - Artist name or track name to search for
     * @param {Object} options - Query options
     *   - type: 'artist' (default) or 'track'
     *   - artist: (required for track searches) Artist name
     * @returns {Promise<Object>} Result: { found: boolean, data: Object|null, error: string|null }
     */
    async verify ( query, options = {} ) {
        try {
            if ( !query || query.trim().length === 0 ) {
                return {
                    found: false,
                    error: 'Query cannot be empty'
                };
            }

            const queryType = options.type || 'artist';

            if ( queryType === 'track' ) {
                return this._verifyTrack( query, options );
            } else {
                return this._verifyArtist( query, options );
            }
        } catch ( err ) {
            if ( err.code === 'ECONNABORTED' ) {
                return {
                    found: false,
                    error: `Request timeout: ${ this.timeout }ms`
                };
            }

            this.logger.debug( `[LastfmProvider] Error: ${ err.message }` );
            return {
                found: false,
                error: `Last.fm API error: ${ err.message }`
            };
        }
    }

    /**
     * Verify artist via Last.fm API
     * @private
     */
    async _verifyArtist ( query ) {
        const response = await axios.get( this.baseUrl, {
            params: {
                method: 'artist.search',
                artist: query.trim(),
                api_key: this.apiKey,
                format: 'json',
                limit: 5 // Get top 5 results
            },
            timeout: this.timeout
        } );

        const results = response.data?.results?.artistmatches?.artist;
        if ( !results || results.length === 0 ) {
            return {
                found: false,
                error: 'Artist not found on Last.fm'
            };
        }

        // Return the best match (first result)
        const bestMatch = results[ 0 ];
        return {
            found: true,
            data: {
                type: 'artist',
                name: bestMatch.name,
                mbid: bestMatch.mbid, // MusicBrainz ID if available
                url: bestMatch.url,
                image: bestMatch.image?.[ bestMatch.image.length - 1 ]?.[ '#text' ] || null, // Largest image
                listeners: parseInt( bestMatch.listeners || 0, 10 ),
                matches: results.length // How many matches found
            }
        };
    }

    /**
     * Verify track via Last.fm API
     * @private
     */
    async _verifyTrack ( trackName, options ) {
        const artistName = options.artist?.trim();
        if ( !artistName ) {
            return {
                found: false,
                error: 'Artist name required for track verification'
            };
        }

        const response = await axios.get( this.baseUrl, {
            params: {
                method: 'track.search',
                track: trackName.trim(),
                artist: artistName,
                api_key: this.apiKey,
                format: 'json',
                limit: 5 // Get top 5 results
            },
            timeout: this.timeout
        } );

        const results = response.data?.results?.trackmatches?.track;
        if ( !results || results.length === 0 ) {
            return {
                found: false,
                error: 'Track not found on Last.fm'
            };
        }

        // Return the best match (first result)
        const bestMatch = results[ 0 ];

        // Try to get detailed track info to get album and release date
        let detailedData = null;
        try {
            const detailResponse = await axios.get( this.baseUrl, {
                params: {
                    method: 'track.getInfo',
                    track: bestMatch.name.trim(),
                    artist: bestMatch.artist.trim(),
                    api_key: this.apiKey,
                    format: 'json',
                    autocorrect: 1 // Auto-correct spelling if needed
                },
                timeout: this.timeout
            } );

            const trackInfo = detailResponse.data?.track;
            if ( trackInfo ) {
                detailedData = {
                    album: trackInfo.album?.title || null,
                    duration: trackInfo.duration ? parseInt( trackInfo.duration, 10 ) : null,
                    playCount: trackInfo.playcount ? parseInt( trackInfo.playcount, 10 ) : null,
                    listeners: trackInfo.listeners ? parseInt( trackInfo.listeners, 10 ) : null,
                    tags: trackInfo.toptags?.tag?.slice( 0, 5 ).map( t => t.name ) || []
                };

                // Fetch extended album metadata from MusicBrainz
                if ( trackInfo.album?.title ) {
                    const mbDetails = await this._getMusicBrainzDetails( bestMatch.name, bestMatch.artist, trackInfo.album.title );
                    if ( mbDetails ) {
                        detailedData = { ...detailedData, ...mbDetails };
                    }
                }
            }
        } catch ( detailErr ) {
            // If detailed info fails, continue with basic info
            this.logger.debug( `[LastfmProvider] Could not fetch track details: ${ detailErr.message }` );
        }

        return {
            found: true,
            data: {
                type: 'track',
                name: bestMatch.name,
                artist: bestMatch.artist,
                mbid: bestMatch.mbid || null, // MusicBrainz ID if available
                url: bestMatch.url,
                image: bestMatch.image?.[ bestMatch.image.length - 1 ]?.[ '#text' ] || null, // Largest image
                listeners: parseInt( bestMatch.listeners || 0, 10 ),
                matches: results.length, // How many matches found
                ...( detailedData || {} ) // Include detailed data if available
            }
        };
    }

    /**
     * Fetch album details from MusicBrainz
     * Searches for the track recording and uses its primary release group
     * to find the original studio album (avoiding compilations/greatest hits)
     * @private
     */
    async _getMusicBrainzDetails ( trackName, artistName, albumTitle ) {
        try {
            // Search for the recording in MusicBrainz to find the primary release
            const recordingSearchResponse = await axios.get( `https://musicbrainz.org/ws/2/recording`, {
                params: {
                    query: `"${ trackName }" AND artist:"${ artistName }"`,
                    limit: 5,
                    fmt: 'json'
                },
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'mrRobotoV3/1.0 (https://github.com/jodrell2000/mrRobotoV3)'
                }
            } );

            const recordings = recordingSearchResponse.data?.recordings;
            if ( !recordings || recordings.length === 0 ) {
                return null;
            }

            // Find a recording that matches our track
            const recording = recordings[ 0 ];
            if ( !recording.releases || recording.releases.length === 0 ) {
                return null;
            }

            // Prefer official studio album releases over compilations
            // Sort by: status (official first), then date (earliest first)
            const sortedReleases = recording.releases.sort( ( a, b ) => {
                const aIsOfficial = a.status === 'Official' ? 0 : 1;
                const bIsOfficial = b.status === 'Official' ? 0 : 1;
                if ( aIsOfficial !== bIsOfficial ) {
                    return aIsOfficial - bIsOfficial;
                }
                // For releases with same status, prefer earlier dates
                const aDate = a.date || '9999-12-31';
                const bDate = b.date || '9999-12-31';
                return aDate.localeCompare( bDate );
            } );

            const release = sortedReleases[ 0 ];
            const details = {};

            if ( release.id ) {
                details.albumMbid = release.id;
            }

            if ( release.date ) {
                details.releaseDate = release.date;
            }

            if ( release.title ) {
                details.albumTitle = release.title;
            }

            // Fetch the release with track information to get position
            if ( release.id ) {
                const detailResponse = await axios.get( `https://musicbrainz.org/ws/2/release/${ release.id }`, {
                    params: {
                        inc: 'recordings',
                        fmt: 'json'
                    },
                    timeout: this.timeout,
                    headers: {
                        'User-Agent': 'mrRobotoV3/1.0 (https://github.com/jodrell2000/mrRobotoV3)'
                    }
                } );

                const fullRelease = detailResponse.data;
                if ( fullRelease.media ) {
                    for ( const medium of fullRelease.media ) {
                        if ( medium.tracks ) {
                            for ( const track of medium.tracks ) {
                                // Match by track title (case insensitive)
                                if ( track.title && track.title.toLowerCase() === trackName.toLowerCase() ) {
                                    details.trackPosition = track.position;
                                    break;
                                }
                            }
                            if ( details.trackPosition ) break;
                        }
                    }
                }
            }

            return details;
        } catch ( err ) {
            this.logger.debug( `[LastfmProvider] MusicBrainz query failed: ${ err.message }` );
            return null;
        }
    }
}

module.exports = LastfmProvider;
