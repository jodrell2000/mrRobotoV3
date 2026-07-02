/**
 * Verification Service
 * Aggregates metadata from Wikipedia, Wikidata, and MusicBrainz
 * Returns verified data summary as structured JSON
 */
class VerificationService {
    constructor ( services = {} ) {
        this.services = services;
        this.logger = services.logger || console;
        this.delayMs = 2000; // Delay between requests to avoid rate limiting (Wikidata recommends 1-2s between requests)
    }

    /**
     * Get user agent dynamically from current config
     * Ensures we always use the current hangout URL or slug
     * Slug should always be available - if not, the bot can't function
     * @returns {string}
     */
    get userAgent () {
        const config = this.services.config;
        let hangoutUrl = config?.HANGOUT_URL;

        // If full URL not available yet, use the slug (which must be present)
        if ( !hangoutUrl ) {
            const slug = config?.HANGOUT_SLUG;
            hangoutUrl = `Hangout.fm ${ slug }`;
        }

        return `mrRoboto/1.4.1 (${ hangoutUrl })`;
    }

    /**
     * Initialize the service
     * @returns {Promise<void>}
     */
    async initialize () {
        try {
            this.logger.info( `✅ [VerificationService] Initialized` );
        } catch ( err ) {
            this.logger.error( `❌ [VerificationService] Initialization failed: ${ err.message }` );
            throw err;
        }
    }

    /**
     * Extract image URL from Wikidata entity
     * @private
     */
    _extractImageUrl ( entity ) {
        if ( !entity?.claims?.P18 || entity.claims.P18.length === 0 ) {
            return undefined;
        }
        const imageFileName = entity.claims.P18[ 0 ]?.mainsnak?.datavalue?.value;
        if ( !imageFileName ) return undefined;
        const encoded = encodeURIComponent( imageFileName );
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${ encoded }`;
    }

    /**
     * Search Wikipedia for artist/track
     * @private
     */
    async _searchWikipedia ( searchTerm ) {
        try {
            let wtf;
            try {
                wtf = require( 'wtf_wikipedia' );
            } catch ( e ) {
                this.logger.debug( '[VerificationService] wtf_wikipedia not installed, skipping Wikipedia search' );
                return { available: false };
            }

            const results = { searches: {} };

            try {
                const page = await wtf.fetch( searchTerm );
                results.searches[ searchTerm ] = {
                    success: true,
                    data: {
                        title: page.title(),
                        categories: page.categories().slice( 0, 5 ),
                        infobox: page.infobox()
                    }
                };
            } catch ( err ) {
                results.searches[ searchTerm ] = {
                    success: false,
                    error: err.message
                };
            }

            return results;
        } catch ( err ) {
            this.logger.debug( `[VerificationService] Wikipedia search error: ${ err.message }` );
            return { searches: {} };
        }
    }

    /**
     * Search Wikidata for artist/track
     * @private
     */
    async _searchWikidata ( searchTerm, filterMusic = true ) {
        try {
            const results = { searches: {} };
            const encodedTerm = encodeURIComponent( searchTerm );
            const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${ encodedTerm }&format=json&language=en`;

            const response = await fetch( searchUrl, {
                headers: { 'User-Agent': this.userAgent }
            } );

            if ( !response.ok ) {
                throw new Error( `Wikidata API error: ${ response.status } ${ response.statusText }` );
            }

            const data = await response.json();

            let filteredResults = data.search || [];

            // Filter for music entities if requested
            if ( filterMusic ) {
                filteredResults = filteredResults.filter( item => {
                    const desc = item.description?.toLowerCase() || '';
                    return !desc.includes( 'film' ) && !desc.includes( 'episode' ) &&
                        ( desc.includes( 'song' ) || desc.includes( 'recording' ) || desc.includes( 'track' ) || desc.includes( 'album' ) );
                } ).slice( 0, 5 );
            }

            results.searches[ searchTerm ] = {
                success: true,
                totalResults: data.search ? data.search.length : 0,
                filteredResults: filteredResults.length,
                data: filteredResults
            };

            // Get detailed data for first result
            if ( filteredResults.length > 0 ) {
                const selectedResult = filteredResults[ 0 ];
                const selectedQid = selectedResult.id;

                // Add delay to avoid rate limiting
                await new Promise( resolve => setTimeout( resolve, this.delayMs ) );

                try {
                    const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${ selectedQid }.json`;
                    const entityResponse = await fetch( entityUrl, {
                        headers: { 'User-Agent': this.userAgent }
                    } );

                    if ( !entityResponse.ok ) {
                        throw new Error( `Entity fetch error: ${ entityResponse.status } ${ entityResponse.statusText }` );
                    }

                    const entityData = await entityResponse.json();
                    const entity = entityData.entities[ selectedQid ];

                    if ( entity && entity.claims ) {
                        const songData = {
                            qid: selectedQid,
                            propertyCount: Object.keys( entity.claims ).length,
                            hasImage: entity.claims.P18 ? true : false,
                            imageUrl: this._extractImageUrl( entity ),
                            publishedIn: undefined,
                            album: undefined
                        };

                        // Check for album relationships
                        let albumQid;
                        let foundVia = '';

                        if ( entity.claims.P4650 ) {
                            const publishedInClaim = entity.claims.P4650[ 0 ];
                            if ( publishedInClaim?.mainsnak?.datavalue?.value?.id ) {
                                albumQid = publishedInClaim.mainsnak.datavalue.value.id;
                                foundVia = 'P4650 (Published In)';
                            }
                        }

                        if ( !albumQid && entity.claims.P361 ) {
                            const partOfClaim = entity.claims.P361[ 0 ];
                            if ( partOfClaim?.mainsnak?.datavalue?.value?.id ) {
                                albumQid = partOfClaim.mainsnak.datavalue.value.id;
                                foundVia = 'P361 (Part Of)';
                            }
                        }

                        if ( albumQid ) {
                            songData.publishedIn = albumQid;

                            await new Promise( resolve => setTimeout( resolve, this.delayMs ) );
                            try {
                                const albumUrl = `https://www.wikidata.org/wiki/Special:EntityData/${ albumQid }.json`;
                                const albumResponse = await fetch( albumUrl, {
                                    headers: { 'User-Agent': this.userAgent }
                                } );

                                if ( !albumResponse.ok ) {
                                    throw new Error( `Album fetch error: ${ albumResponse.status } ${ albumResponse.statusText }` );
                                }

                                const albumData = await albumResponse.json();
                                const album = albumData.entities[ albumQid ];

                                if ( album ) {
                                    const albumImageUrl = this._extractImageUrl( album );
                                    songData.album = {
                                        qid: albumQid,
                                        label: album.labels?.en?.value,
                                        hasImage: album.claims?.P18 ? true : false,
                                        imageUrl: albumImageUrl
                                    };
                                }
                            } catch ( err ) {
                                this.logger.debug( `[VerificationService] Album fetch error: ${ err.message }` );
                            }
                        }

                        results.searches[ searchTerm ].detailedData = songData;
                    }
                } catch ( err ) {
                    this.logger.debug( `[VerificationService] Entity fetch error: ${ err.message }` );
                }
            }

            return results;
        } catch ( err ) {
            this.logger.debug( `[VerificationService] Wikidata search error: ${ err.message }` );
            return { searches: {} };
        }
    }

    /**
     * Search MusicBrainz for recordings and artist
     * @private
     */
    async _searchMusicBrainz ( artist, track ) {
        try {
            const results = { searches: {} };

            // Combined search with Lucene syntax
            try {
                const encodedQuery = encodeURIComponent( `artist:"${ artist }" recording:"${ track }"` );
                const searchUrl = `https://musicbrainz.org/ws/2/recording?query=${ encodedQuery }&fmt=json&limit=5`;
                const response = await fetch( searchUrl, {
                    headers: { 'User-Agent': this.userAgent }
                } );
                if ( !response.ok ) {
                    throw new Error( `MusicBrainz API error: ${ response.status }` );
                }
                const data = await response.json();
                results.searches[ `${ artist } - ${ track }` ] = {
                    success: true,
                    count: data.count || 0,
                    data: data.recordings?.slice( 0, 3 ) || []
                };
            } catch ( err ) {
                results.searches[ `${ artist } - ${ track }` ] = {
                    success: false,
                    error: err.message
                };
            }

            // Artist metadata search
            try {
                const encodedArtist = encodeURIComponent( artist );
                const searchUrl = `https://musicbrainz.org/ws/2/artist?query=${ encodedArtist }&fmt=json&limit=5`;
                const response = await fetch( searchUrl, {
                    headers: { 'User-Agent': this.userAgent }
                } );
                if ( !response.ok ) {
                    throw new Error( `MusicBrainz artist API error: ${ response.status }` );
                }
                const data = await response.json();
                results.searches[ `${ artist } artist` ] = {
                    success: true,
                    count: data[ 'artist-count' ] || 0,
                    data: data.artists?.slice( 0, 3 ) || []
                };
            } catch ( err ) {
                results.searches[ `${ artist } artist` ] = {
                    success: false,
                    error: err.message
                };
            }

            return results;
        } catch ( err ) {
            this.logger.debug( `[VerificationService] MusicBrainz search error: ${ err.message }` );
            return { searches: {} };
        }
    }

    /**
     * Verify artist and track information from combined sources
     * @param {string} query - Query string (supports "artist - track" format or simple query)
     * @param {Object} options - Query options
     *   - artist: Artist name (required if not in "artist - track" format)
     *   - track: Track name (required if not in "artist - track" format)
     * @returns {Promise<Object>} Verified data summary: { found: boolean, data: Object|null, error: string|null }
     */
    async verify ( query, options = {} ) {
        if ( !query || typeof query !== 'string' ) {
            throw new Error( 'Query must be a non-empty string' );
        }

        try {
            let artist = options.artist;
            let track = options.track;

            // Parse "artist - track" format if options not provided
            if ( !artist || !track ) {
                const parts = query.split( ' - ' );
                if ( parts.length === 2 ) {
                    [ artist, track ] = parts.map( p => p.trim() );
                } else {
                    artist = artist || query;
                    track = track || query;
                }
            }

            this.logger.debug( `🔍 [VerificationService] Verifying: ${ artist } - ${ track }` );

            // Run searches sequentially to avoid rate limiting
            const wikipediaResults = await this._searchWikipedia( track );
            await new Promise( resolve => setTimeout( resolve, this.delayMs ) );

            const wikidataTrackResults = await this._searchWikidata( track, true );
            await new Promise( resolve => setTimeout( resolve, this.delayMs ) );

            const wikidataArtistResults = await this._searchWikidata( artist, false );
            await new Promise( resolve => setTimeout( resolve, this.delayMs ) );

            const musicbrainzResults = await this._searchMusicBrainz( artist, track );

            // Build verified data summary
            const verifiedDataSummary = {
                track: {
                    title: track,
                    categories: [],
                    artist: undefined,
                    releaseDate: undefined,
                    wikidata: {
                        qid: undefined,
                        properties: undefined,
                        imageUrl: undefined
                    },
                    album: undefined
                },
                artist: {
                    title: artist,
                    categories: [],
                    founded: undefined,
                    country: undefined,
                    wikidata: {
                        qid: undefined,
                        properties: []
                    }
                }
            };

            // Extract track data from all sources
            if ( wikipediaResults.searches?.[ track ]?.success ) {
                verifiedDataSummary.track.categories = wikipediaResults.searches[ track ].data.categories?.slice( 0, 3 ) || [];
            }

            if ( musicbrainzResults.searches?.[ `${ artist } - ${ track }` ]?.data?.length > 0 ) {
                const mb = musicbrainzResults.searches[ `${ artist } - ${ track }` ].data[ 0 ];
                verifiedDataSummary.track.artist = mb[ 'artist-credit' ]?.[ 0 ]?.artist?.name || artist;
                verifiedDataSummary.track.releaseDate = mb[ 'first-release-date' ];
            }

            if ( wikidataTrackResults.searches?.[ track ]?.detailedData ) {
                const wd = wikidataTrackResults.searches[ track ];
                verifiedDataSummary.track.wikidata.qid = wd.detailedData.qid;
                verifiedDataSummary.track.wikidata.properties = wd.detailedData.propertyCount;
                verifiedDataSummary.track.wikidata.imageUrl = wd.detailedData.imageUrl;
                if ( wd.detailedData.album ) {
                    verifiedDataSummary.track.album = {
                        title: wd.detailedData.album.label,
                        wikidata_id: wd.detailedData.album.qid,
                        imageUrl: wd.detailedData.album.imageUrl
                    };
                }
            }

            // Extract artist data from all sources
            if ( wikipediaResults.searches?.[ artist ]?.success ) {
                verifiedDataSummary.artist.categories = wikipediaResults.searches[ artist ].data.categories?.slice( 0, 3 ) || [];
            }

            if ( musicbrainzResults.searches?.[ `${ artist } artist` ]?.data?.length > 0 ) {
                const mb = musicbrainzResults.searches[ `${ artist } artist` ].data[ 0 ];
                verifiedDataSummary.artist.founded = mb[ 'life-span' ]?.begin;
                verifiedDataSummary.artist.country = mb.country;
            }

            if ( wikidataArtistResults.searches?.[ artist ]?.detailedData ) {
                const wd = wikidataArtistResults.searches[ artist ];
                verifiedDataSummary.artist.wikidata.qid = wd.detailedData.qid;
                verifiedDataSummary.artist.wikidata.properties = wd.detailedData.musicProperties;
            }

            return {
                found: true,
                data: verifiedDataSummary
            };
        } catch ( error ) {
            this.logger.error( `❌ [VerificationService] Verification error: ${ error.message }` );
            return {
                found: false,
                error: error.message
            };
        }
    }
}

module.exports = VerificationService;
