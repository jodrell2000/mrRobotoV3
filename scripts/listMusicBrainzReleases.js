const axios = require( 'axios' );

async function searchReleaseGroup () {
    try {
        // Search for release-group directly
        const res = await axios.get( 'https://musicbrainz.org/ws/2/release-group', {
            params: {
                query: 'artist:Queen AND title:"A Night at the Opera"',
                fmt: 'json',
                limit: 5
            },
            timeout: 5000,
            headers: {
                'User-Agent': 'mrRobotoV3/1.0 (https://github.com/jodrell2000/mrRobotoV3)'
            }
        } );

        console.log( 'RELEASE GROUP SEARCH: artist:Queen AND title:"A Night at the Opera"\n' );
        const groups = res.data[ 'release-groups' ] || [];
        console.log( 'Found: ' + groups.length + '\n' );

        groups.forEach( ( g, i ) => {
            console.log( ( i + 1 ) + '. ' + g.title + ' (' + g[ 'primary-type' ] + ')' );
        } );
    } catch ( e ) {
        console.error( 'Error: ' + e.message );
    }
}

async function searchRecordingDirect () {
    try {
        // Try direct recording search
        const res = await axios.get( 'https://musicbrainz.org/ws/2/recording', {
            params: {
                query: 'artist:Queen AND recording:"Bohemian Rhapsody" AND release:"A Night at the Opera"',
                fmt: 'json',
                limit: 5
            },
            timeout: 5000,
            headers: {
                'User-Agent': 'mrRobotoV3/1.0 (https://github.com/jodrell2000/mrRobotoV3)'
            }
        } );

        console.log( '\nDIRECT RECORDING SEARCH with release filter\n' );
        const recs = res.data.recordings || [];
        console.log( 'Found: ' + recs.length + ' recordings\n' );

        if ( recs.length > 0 ) {
            const rec = recs[ 0 ];
            console.log( 'Recording: ' + rec.title );
            console.log( 'Releases: ' + rec.releases.length + '\n' );
            rec.releases.forEach( ( r, i ) => {
                const title = ( r.title || '?' ).padEnd( 50 );
                const date = ( r.date || 'N/A' ).substring( 0, 10 ).padEnd( 10 );
                console.log( ( i + 1 ) + '. ' + title + ' | ' + date );
            } );
        }
    } catch ( e ) {
        console.error( 'Error: ' + e.message );
    }
}

( async () => {
    await searchReleaseGroup();
    await new Promise( resolve => setTimeout( resolve, 1000 ) );
    await searchRecordingDirect();
} )();
