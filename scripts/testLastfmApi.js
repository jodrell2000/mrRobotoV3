#!/usr/bin/env node

/**
 * Test Last.fm API Connectivity
 * Usage: 
 *   Artist search:  node scripts/testLastfmApi.js [artist-name]
 *   Track search:   node scripts/testLastfmApi.js --track "track-name" "artist-name"
 * 
 * This script tests Last.fm API connectivity by searching for artists or tracks.
 * Reads LASTFM_API_KEY from .env file.
 * 
 * Examples:
 *   node scripts/testLastfmApi.js "The Beatles"
 *   node scripts/testLastfmApi.js --track "AAAHH MEN!" "Doja Cat"
 *   node scripts/testLastfmApi.js --track "Bohemian Rhapsody" "Queen"
 */

require( 'dotenv' ).config();

const axios = require( 'axios' );

async function testLastfmApi () {
    try {
        // Parse command line arguments
        let searchType = 'artist'; // default
        let param1 = process.argv[ 2 ];
        let param2 = process.argv[ 3 ];

        // Check for --track flag
        if ( param1 === '--track' ) {
            searchType = 'track';
            param1 = param2;
            param2 = process.argv[ 4 ];
        }

        // Validate parameters
        if ( !param1 ) {
            console.log( '🧪 Last.fm API Lookup Tool\n' );
            console.log( 'Usage:' );
            console.log( '  Artist search:  node scripts/testLastfmApi.js [artist-name]' );
            console.log( '  Track search:   node scripts/testLastfmApi.js --track "track-name" "artist-name"\n' );
            console.log( 'Examples:' );
            console.log( '  node scripts/testLastfmApi.js "The Beatles"' );
            console.log( '  node scripts/testLastfmApi.js --track "AAAHH MEN!" "Doja Cat"\n' );
            process.exit( 0 );
        }

        console.log( '\n🧪 Testing Last.fm API Connectivity...\n' );

        // Check if API key is configured
        const apiKey = process.env.LASTFM_API_KEY;
        if ( !apiKey ) {
            console.error( '❌ Error: LASTFM_API_KEY not set in .env file' );
            console.error( 'Please add your Last.fm API key to .env:' );
            console.error( '   LASTFM_API_KEY=your_api_key_here\n' );
            process.exit( 1 );
        }

        // Build search request
        if ( searchType === 'artist' ) {
            await searchArtist( param1, apiKey );
        } else if ( searchType === 'track' ) {
            if ( !param2 ) {
                console.error( '❌ Error: Track search requires both track name and artist name' );
                console.error( 'Usage: node scripts/testLastfmApi.js --track "track-name" "artist-name"\n' );
                process.exit( 1 );
            }
            await searchTrack( param1, param2, apiKey );
        }

        process.exit( 0 );
    } catch ( err ) {
        handleError( err );
        process.exit( 1 );
    }
}

async function searchArtist ( artistName, apiKey ) {
    console.log( `📡 Searching for artist: "${ artistName }"` );
    console.log( `🔑 Using API Key: ${ apiKey.substring( 0, 5 ) }...${ apiKey.substring( apiKey.length - 5 ) }\n` );

    const response = await axios.get( 'https://ws.audioscrobbler.com/2.0/', {
        params: {
            method: 'artist.search',
            artist: artistName,
            api_key: apiKey,
            format: 'json',
            limit: 5
        },
        timeout: 5000
    } );

    const results = response.data?.results?.artistmatches?.artist;

    if ( !results || results.length === 0 ) {
        console.log( `⚠️  No artists found for "${ artistName }"\n` );
        return;
    }

    console.log( `✅ Found ${ results.length } match(es):\n` );

    results.forEach( ( artist, index ) => {
        console.log( `${ index + 1 }. ${ artist.name }` );
        console.log( `   URL: ${ artist.url }` );
        console.log( `   Listeners: ${ artist.listeners || 'N/A' }` );
        if ( artist.mbid ) {
            console.log( `   MusicBrainz ID: ${ artist.mbid }` );
        }
        const images = artist.image?.filter( img => img[ '#text' ] );
        if ( images && images.length > 0 ) {
            console.log( `   Image: ${ images[ images.length - 1 ][ '#text' ] }` );
        }
        console.log();
    } );

    console.log( '✅ Last.fm API is working correctly!\n' );
}

async function searchTrack ( trackName, artistName, apiKey ) {
    console.log( `🎵 Searching for track: "${ trackName }" by "${ artistName }"` );
    console.log( `🔑 Using API Key: ${ apiKey.substring( 0, 5 ) }...${ apiKey.substring( apiKey.length - 5 ) }\n` );

    const response = await axios.get( 'https://ws.audioscrobbler.com/2.0/', {
        params: {
            method: 'track.search',
            track: trackName,
            artist: artistName,
            api_key: apiKey,
            format: 'json',
            limit: 5
        },
        timeout: 5000
    } );

    const results = response.data?.results?.trackmatches?.track;

    if ( !results || results.length === 0 ) {
        console.log( `⚠️  No tracks found for "${ trackName }" by "${ artistName }"\n` );
        return;
    }

    console.log( `✅ Found ${ results.length } match(es):\n` );

    results.forEach( ( track, index ) => {
        console.log( `${ index + 1 }. "${ track.name }" by ${ track.artist }` );
        console.log( `   URL: ${ track.url }` );
        console.log( `   Listeners: ${ track.listeners || 'N/A' }` );
        if ( track.mbid ) {
            console.log( `   MusicBrainz ID: ${ track.mbid }` );
        }
        const images = track.image?.filter( img => img[ '#text' ] );
        if ( images && images.length > 0 ) {
            console.log( `   Image: ${ images[ images.length - 1 ][ '#text' ] }` );
        }
        console.log();
    } );

    // Find track with most listeners
    const trackWithMostListeners = results.reduce( ( prev, current ) => {
        const prevListeners = parseInt( prev.listeners || 0, 10 );
        const currentListeners = parseInt( current.listeners || 0, 10 );
        return currentListeners > prevListeners ? current : prev;
    } );

    console.log( `📊 Getting detailed info for track with most listeners: "${ trackWithMostListeners.name }"\n` );

    // Fetch detailed track info
    try {
        const detailResponse = await axios.get( 'https://ws.audioscrobbler.com/2.0/', {
            params: {
                method: 'track.getInfo',
                track: trackWithMostListeners.name.trim(),
                artist: trackWithMostListeners.artist.trim(),
                api_key: apiKey,
                format: 'json',
                autocorrect: 1
            },
            timeout: 5000
        } );

        const trackInfo = detailResponse.data?.track;
        if ( trackInfo ) {
            console.log( `📝 Detailed Information:\n` );
            console.log( `   Track: ${ trackInfo.name }` );
            if ( trackInfo.mbid ) {
                console.log( `   Track MBID: ${ trackInfo.mbid }` );
            }

            console.log( `   Artist: ${ trackInfo.artist?.name || trackInfo.artist || 'N/A' }` );
            if ( trackInfo.artist?.mbid ) {
                console.log( `   Artist MBID: ${ trackInfo.artist.mbid }` );
            }

            if ( trackInfo.album?.title ) {
                console.log( `   Album: ${ trackInfo.album.title }` );
            }

            if ( trackInfo.duration ) {
                const minutes = Math.floor( parseInt( trackInfo.duration, 10 ) / 1000 / 60 );
                const seconds = Math.floor( ( parseInt( trackInfo.duration, 10 ) / 1000 ) % 60 );
                console.log( `   Duration: ${ minutes }:${ seconds.toString().padStart( 2, '0' ) }` );
            }

            if ( trackInfo.playcount ) {
                console.log( `   Total Play Count: ${ parseInt( trackInfo.playcount, 10 ).toLocaleString() }` );
            }

            if ( trackInfo.listeners ) {
                console.log( `   Total Listeners: ${ parseInt( trackInfo.listeners, 10 ).toLocaleString() }` );
            }

            if ( trackInfo.userplaycount ) {
                console.log( `   Your Play Count: ${ trackInfo.userplaycount }` );
            }

            if ( trackInfo.toptags?.tag && trackInfo.toptags.tag.length > 0 ) {
                const tags = trackInfo.toptags.tag.slice( 0, 5 ).map( t => t.name ).join( ', ' );
                console.log( `   Tags: ${ tags }` );
            }

            // Fetch additional album details from MusicBrainz if we have the track MBID
            if ( trackInfo.mbid ) {
                console.log( `\n📚 Querying MusicBrainz for original album details...` );
                try {
                    const mbDetails = await getMusicBrainzDetails( trackInfo.mbid, trackInfo.name, trackInfo.artist?.name || trackInfo.artist, trackInfo.album?.title );
                    if ( mbDetails ) {
                        if ( mbDetails.albumTitle ) {
                            console.log( `   Original Album: ${ mbDetails.albumTitle }` );
                        }
                        if ( mbDetails.albumMbid ) {
                            console.log( `   Album MBID: ${ mbDetails.albumMbid }` );
                        }
                        if ( mbDetails.releaseDate ) {
                            console.log( `   Release Date: ${ mbDetails.releaseDate }` );
                        }
                        if ( mbDetails.trackPosition ) {
                            console.log( `   Album Position: Track #${ mbDetails.trackPosition }` );
                        }
                    }
                } catch ( mbErr ) {
                    console.error( `   ⚠️  Could not fetch MusicBrainz details: ${ mbErr.message }` );
                }
                console.log();
            }

            if ( trackInfo.wiki?.content ) {
                console.log( `📖 Summary:\n${ trackInfo.wiki.content.split( 'User-contributed text' )[ 0 ].trim() }\n` );
            }
        }
    } catch ( detailErr ) {
        console.error( `⚠️  Could not fetch detailed track info: ${ detailErr.message }` );
    }

    console.log( '✅ Last.fm API is working correctly!\n' );
}

function handleError ( err ) {
    if ( err.code === 'ECONNABORTED' ) {
        console.error( '❌ Request timeout (5 seconds exceeded)' );
    } else if ( err.response?.status === 401 ) {
        console.error( '❌ Authentication failed - Invalid API key' );
    } else if ( err.response?.data?.message ) {
        console.error( `❌ API Error: ${ err.response.data.message }` );
    } else if ( err.message ) {
        console.error( `❌ Error: ${ err.message }` );
    } else {
        console.error( '❌ Unknown error occurred' );
    }

    console.error( '\n💡 Troubleshooting:' );
    console.error( '   1. Verify LASTFM_API_KEY is set in .env' );
    console.error( '   2. Check that your API key is correct at https://www.last.fm/api' );
    console.error( '   3. Ensure you have network connectivity' );
    console.error( '   4. Last.fm API may be temporarily unavailable\n' );
}

async function getMusicBrainzDetails ( recordingMbid, trackName, artistName, albumTitle ) {
    try {
        // Search for the recording in MusicBrainz to find the primary release
        const recordingSearchResponse = await axios.get( `https://musicbrainz.org/ws/2/recording`, {
            params: {
                query: `"${ trackName }" AND artist:"${ artistName }"`,
                limit: 5,
                fmt: 'json'
            },
            timeout: 5000,
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
                timeout: 5000,
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
        throw new Error( `MusicBrainz query failed: ${ err.message }` );
    }
}

testLastfmApi();
