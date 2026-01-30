jest.mock( 'node:fs', () => ( {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
} ) );

jest.mock( '../../src/lib/logging', () => ( {
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
} ) );

const fs = require( 'node:fs' );
const textUtils = require( '../../src/lib/textUtils' );

describe( 'textUtils', () => {
    beforeEach( () => {
        jest.clearAllMocks();
        textUtils.clearCache();

        // Default mock: file exists with some mappings
        fs.existsSync.mockReturnValue( true );
        fs.readFileSync.mockReturnValue( JSON.stringify( {
            'ᕼ': 'H',
            'ᖇ': 'R',
            'ᗯ': 'W',
            'ᗷ': 'B',
            'ᗩ': 'A',
            'ᑕ': 'C',
            'ᔕ': 'S',
            'ᗪ': 'D',
            'ᑌ': 'U',
            'ᑎ': 'N'
        } ) );
        fs.writeFileSync.mockReturnValue( undefined );
    } );

    afterEach( () => {
        textUtils.clearCache();
    } );

    describe( 'loadMappings', () => {
        it( 'should load mappings from file', () => {
            const mappings = textUtils.loadMappings();

            expect( fs.existsSync ).toHaveBeenCalled();
            expect( fs.readFileSync ).toHaveBeenCalled();
            expect( mappings ).toEqual( expect.objectContaining( { 'ᕼ': 'H' } ) );
        } );

        it( 'should return cached mappings on subsequent calls', () => {
            textUtils.loadMappings();
            textUtils.loadMappings();

            // Should only read once due to caching
            expect( fs.readFileSync ).toHaveBeenCalledTimes( 1 );
        } );

        it( 'should force reload when forceReload is true', () => {
            textUtils.loadMappings();
            textUtils.loadMappings( true );

            expect( fs.readFileSync ).toHaveBeenCalledTimes( 2 );
        } );

        it( 'should return empty object if file does not exist', () => {
            fs.existsSync.mockReturnValue( false );

            const mappings = textUtils.loadMappings();

            expect( mappings ).toEqual( {} );
        } );

        it( 'should return empty object on read error', () => {
            fs.readFileSync.mockImplementation( () => {
                throw new Error( 'Read error' );
            } );

            const mappings = textUtils.loadMappings();

            expect( mappings ).toEqual( {} );
        } );

        it( 'should return empty object on JSON parse error', () => {
            fs.readFileSync.mockReturnValue( 'invalid json' );

            const mappings = textUtils.loadMappings();

            expect( mappings ).toEqual( {} );
        } );
    } );

    describe( 'normalizeText', () => {
        it( 'should normalize Canadian Aboriginal Syllabics to ASCII', () => {
            const result = textUtils.normalizeText( 'TᕼᖇOᗯᗷᗩᑕK TᕼᑌᖇᔕᗪᗩY' );

            expect( result ).toBe( 'THROWBACK THURSDAY' );
        } );

        it( 'should apply NFKD normalization for mathematical symbols', () => {
            // NFKD should convert these even without custom mappings
            textUtils.clearCache();
            fs.readFileSync.mockReturnValue( '{}' );

            const result = textUtils.normalizeText( '𝔻𝔸ℕℂ𝔼' );

            // NFKD converts these mathematical double-struck letters to ASCII
            expect( result ).toBe( 'DANCE' );
        } );

        it( 'should handle mixed regular and special characters', () => {
            const result = textUtils.normalizeText( 'ᕼello World' );

            expect( result ).toBe( 'Hello World' );
        } );

        it( 'should pass through text with no special characters unchanged', () => {
            const result = textUtils.normalizeText( 'Hello World' );

            expect( result ).toBe( 'Hello World' );
        } );

        it( 'should preserve emojis', () => {
            const result = textUtils.normalizeText( '💃 Dance 🕺' );

            expect( result ).toContain( '💃' );
            expect( result ).toContain( '🕺' );
            expect( result ).toContain( 'Dance' );
        } );

        it( 'should handle null input', () => {
            const result = textUtils.normalizeText( null );

            expect( result ).toBeNull();
        } );

        it( 'should handle undefined input', () => {
            const result = textUtils.normalizeText( undefined );

            expect( result ).toBeUndefined();
        } );

        it( 'should handle empty string', () => {
            const result = textUtils.normalizeText( '' );

            expect( result ).toBe( '' );
        } );

        it( 'should handle non-string input', () => {
            const result = textUtils.normalizeText( 123 );

            expect( result ).toBe( 123 );
        } );
    } );

    describe( 'addMapping', () => {
        it( 'should add a new mapping', () => {
            const result = textUtils.addMapping( 'ᘔ', 'Z' );

            expect( result.success ).toBe( true );
            expect( result.message ).toContain( 'Added' );
            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );

        it( 'should update an existing mapping', () => {
            // First load mappings so cache is populated
            textUtils.loadMappings();
            const result = textUtils.addMapping( 'ᕼ', 'X' );

            expect( result.success ).toBe( true );
            expect( result.message ).toContain( 'Updated' );
        } );

        it( 'should fail with empty fancy character', () => {
            const result = textUtils.addMapping( '', 'A' );

            expect( result.success ).toBe( false );
            expect( result.message ).toContain( 'Fancy character is required' );
        } );

        it( 'should fail with empty ASCII character', () => {
            const result = textUtils.addMapping( 'ᘔ', '' );

            expect( result.success ).toBe( false );
            expect( result.message ).toContain( 'ASCII character is required' );
        } );

        it( 'should fail with non-ASCII replacement character', () => {
            const result = textUtils.addMapping( 'ᘔ', 'ᕼ' );

            expect( result.success ).toBe( false );
            expect( result.message ).toContain( 'Invalid replacement character' );
        } );

        it( 'should accept valid ASCII characters', () => {
            // Load mappings first
            textUtils.loadMappings();

            const result = textUtils.addMapping( 'ᘔ', 'Z' );

            expect( result.success ).toBe( true );
            expect( result.message ).toContain( 'Added' );
        } );

        it( 'should handle save failure', () => {
            fs.writeFileSync.mockImplementation( () => {
                throw new Error( 'Write error' );
            } );

            const result = textUtils.addMapping( 'ᘔ', 'Z' );

            expect( result.success ).toBe( false );
            expect( result.message ).toContain( 'Failed to save' );
        } );
    } );

    describe( 'removeMapping', () => {
        it( 'should remove an existing mapping', () => {
            // First load mappings so cache is populated with ᕼ
            textUtils.loadMappings();
            const result = textUtils.removeMapping( 'ᕼ' );

            expect( result.success ).toBe( true );
            expect( result.message ).toContain( 'Removed' );
        } );

        it( 'should fail when mapping does not exist', () => {
            textUtils.loadMappings();
            const result = textUtils.removeMapping( 'ᘔ' );

            expect( result.success ).toBe( false );
            expect( result.message ).toContain( 'No mapping found' );
        } );

        it( 'should fail with empty character', () => {
            const result = textUtils.removeMapping( '' );

            expect( result.success ).toBe( false );
            expect( result.message ).toContain( 'Character is required' );
        } );
    } );

    describe( 'getMappings', () => {
        it( 'should return all current mappings', () => {
            const mappings = textUtils.getMappings();

            expect( mappings ).toHaveProperty( 'ᕼ', 'H' );
            expect( typeof mappings ).toBe( 'object' );
        } );
    } );

    describe( 'clearCache', () => {
        it( 'should clear the cached mappings', () => {
            textUtils.loadMappings();
            expect( fs.readFileSync ).toHaveBeenCalledTimes( 1 );

            textUtils.clearCache();
            textUtils.loadMappings();

            expect( fs.readFileSync ).toHaveBeenCalledTimes( 2 );
        } );
    } );
} );
