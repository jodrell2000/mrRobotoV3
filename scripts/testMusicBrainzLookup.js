#!/usr/bin/env node

const path = require( 'path' );

// Simple logger for testing
const mockLogger = {
    debug: ( msg ) => console.log( `[DEBUG] ${ msg }` ),
    info: ( msg ) => console.log( `[INFO] ${ msg }` ),
    warn: ( msg ) => console.log( `[WARN] ${ msg }` ),
    error: ( msg ) => console.log( `[ERROR] ${ msg }` )
};

// Load MusicBrainzLookupProvider
const MusicBrainzLookupProvider = require( path.join( __dirname, '../src/services/verification/providers/MusicBrainzLookupProvider' ) );

async function testLookup ( spotifyId, deezer = null, tidal = null, apple = null ) {
    const provider = new MusicBrainzLookupProvider( { logger: mockLogger } );

    const musicProviders = { spotify: spotifyId };
    if ( deezer ) {
        musicProviders.deezer = deezer;
    }
    if ( tidal ) {
        musicProviders.tidal = tidal;
    }
    if ( apple ) {
        musicProviders.apple = apple;
    }

    console.log( `\n🔍 Looking up Spotify ID: ${ spotifyId }` );
    if ( deezer ) console.log( `   Deezer ID: ${ deezer }` );
    if ( tidal ) console.log( `   Tidal ID: ${ tidal }` );
    if ( apple ) console.log( `   Apple ID: ${ apple }` );

    try {
        const result = await provider.verify( '', { musicProviders } );

        if ( result.found ) {
            console.log( '\n✅ FOUND' );
            console.log( `   Track: ${ result.data.name }` );
            console.log( `   Artist: ${ result.data.artist }` );
            if ( result.data.artists.length > 1 ) {
                console.log( `   All Artists: ${ result.data.artists.join( ', ' ) }` );
            }
            console.log( `   Album: ${ result.data.album }` );
            console.log( `   Album Type: ${ result.data.albumType }` );
            console.log( `   Release Date: ${ result.data.releaseDate }` );
            console.log( `   Duration: ${ result.data.duration }s` );
            console.log( `   Track Position: ${ result.data.trackPosition }` );
            console.log( `   MusicBrainz ID: ${ result.data.mbid }` );
            console.log( `   Album MusicBrainz ID: ${ result.data.albumMbid }` );
        } else {
            console.log( '\n❌ NOT FOUND' );
            if ( result.error ) {
                console.log( `   Error: ${ result.error }` );
            }
        }
    } catch ( err ) {
        console.error( `\n💥 ERROR: ${ err.message }` );
    }
}

async function runTests () {
    console.log( '🎵 MusicBrainz URL Lookup Provider Test Script' );
    console.log( '='.repeat( 50 ) );
    console.log( '\n📝 IMPORTANT: MusicBrainz only recognizes Spotify URLs that have been' );
    console.log( '   explicitly linked in their database. Not all Spotify tracks are linked.\n' );
    console.log( '💡 To find linkable tracks:' );
    console.log( '   1. Go to https://musicbrainz.org' );
    console.log( '   2. Search for a track' );
    console.log( '   3. Click "External links" to see if Spotify URL is available' );
    console.log( '   4. Copy the Spotify URL and extract the track ID\n' );
    console.log( '🧪 Testing with provider interface (these may not return data if' );
    console.log( '   the Spotify URLs are not in MusicBrainz database):\n' );

    // Test cases with known Spotify IDs
    // These may or may not return results depending on MusicBrainz database

    // Example 1: Bohemian Rhapsody by Queen
    await testLookup( '4u7EnebtmKWzUH433cf5Qv' );

    // Example 2: Another One Bites the Dust by Queen  
    await testLookup( '55hgBEeIR1DqxiHZ9lbDKJ' );

    // Example 3: Stairway to Heaven by Led Zeppelin
    await testLookup( '04cJiJFW1n5h5EGeVDjXvT' );

    console.log( '\n' + '='.repeat( 50 ) );
    console.log( '✨ Test complete!' );
    console.log( '\n📌 Usage: node scripts/testMusicBrainzLookup.js <spotify-id> [deezer] [tidal] [apple]' );
}

// Allow command-line usage: node testMusicBrainzLookup.js <spotifyId> [deezer] [tidal] [apple]
if ( process.argv.length > 2 ) {
    const spotifyId = process.argv[ 2 ];
    const deezer = process.argv[ 3 ] || null;
    const tidal = process.argv[ 4 ] || null;
    const apple = process.argv[ 5 ] || null;

    testLookup( spotifyId, deezer, tidal, apple ).then( () => {
        process.exit( 0 );
    } ).catch( ( err ) => {
        console.error( err );
        process.exit( 1 );
    } );
} else {
    runTests().then( () => {
        process.exit( 0 );
    } ).catch( ( err ) => {
        console.error( err );
        process.exit( 1 );
    } );
}
