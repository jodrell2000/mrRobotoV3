const fs = require( 'node:fs' );
const path = require( 'node:path' );
const framework = require( '../../src/siteFrameworks/hangfm/framework.js' );

const sourceRoot = path.join( __dirname, '../../src' );

function getJavaScriptFiles ( directory ) {
    return fs.readdirSync( directory, { withFileTypes: true } ).flatMap( entry => {
        const entryPath = path.join( directory, entry.name );
        if ( entry.isDirectory() ) return getJavaScriptFiles( entryPath );
        return entry.name.endsWith( '.js' ) ? [ entryPath ] : [];
    } );
}

describe( 'framework architecture boundaries', () => {
    test( 'only the Hang socket adapter imports ttfm-socket', () => {
        const importers = getJavaScriptFiles( sourceRoot ).filter( filePath => {
            return fs.readFileSync( filePath, 'utf8' ).includes( "require( 'ttfm-socket' )" );
        } );

        expect( importers ).toEqual( [ path.join( sourceRoot, 'socketAdapters/HangFmSocketAdapter.js' ) ] );
    } );

    test( 'declares capabilities as metadata objects', () => {
        for ( const [ capability, metadata ] of Object.entries( framework.capabilities ) ) {
            expect( metadata ).toEqual( expect.objectContaining( { supported: expect.any( Boolean ) } ) );
            expect( capability ).toEqual( expect.any( String ) );
        }
    } );

    test( 'does not elevate unknown platform roles', () => {
        expect( framework.resolveCommandPermissions( 'new-role' ) ).toBe( 'USER' );
        expect( framework.resolveCommandPermissions( 'owner' ) ).toBe( 'OWNER' );
    } );

    test( 'declares normalized action capabilities', () => {
        expect( framework.capabilities ).toEqual( expect.objectContaining( {
            removeFromDJQueue: expect.objectContaining( { supported: true } ),
            skipTrack: expect.objectContaining( { supported: true } ),
            voting: expect.objectContaining( { supported: true } ),
            botIdentityUpdate: expect.objectContaining( { supported: true } )
        } ) );
    } );
} );
