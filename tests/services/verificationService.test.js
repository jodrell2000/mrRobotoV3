const VerificationService = require( '../../src/services/verificationService.js' );

describe( 'VerificationService', () => {
    let verificationService;
    let mockLogger;

    beforeEach( () => {
        // Mock logger
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };

        // Create service with mocked logger
        verificationService = new VerificationService( { logger: mockLogger } );
    } );

    describe( 'initialization', () => {
        it( 'should initialize successfully', async () => {
            await verificationService.initialize();
            expect( mockLogger.info ).toHaveBeenCalledWith( expect.stringContaining( 'Initialized' ) );
        } );

        it( 'should have default configuration', () => {
            expect( verificationService.userAgent ).toBe( 'mrRoboto/1.4.1 (contact@example.com)' );
            expect( verificationService.delayMs ).toBe( 500 );
        } );
    } );

    describe( 'verify method', () => {
        it( 'should throw error if query is not a string', async () => {
            await expect( verificationService.verify( null ) ).rejects.toThrow( 'Query must be a non-empty string' );
            await expect( verificationService.verify( 123 ) ).rejects.toThrow( 'Query must be a non-empty string' );
            await expect( verificationService.verify( '' ) ).rejects.toThrow( 'Query must be a non-empty string' );
        } );

        it( 'should parse artist - track format', async () => {
            // Mock the private search methods
            jest.spyOn( verificationService, '_searchWikipedia' ).mockResolvedValueOnce( { searches: {} } );
            jest.spyOn( verificationService, '_searchWikidata' ).mockResolvedValueOnce( { searches: {} } );
            jest.spyOn( verificationService, '_searchMusicBrainz' ).mockResolvedValueOnce( { searches: {} } );

            const result = await verificationService.verify( 'The Beatles - Hey Jude' );

            // Verify that the service attempted to search
            expect( mockLogger.debug ).toHaveBeenCalledWith( expect.stringContaining( 'The Beatles - Hey Jude' ) );
            expect( result ).toHaveProperty( 'found' );
            expect( result ).toHaveProperty( 'data' );
        } );

        it( 'should accept artist and track as options', async () => {
            // Mock the private search methods
            jest.spyOn( verificationService, '_searchWikipedia' ).mockResolvedValueOnce( { searches: {} } );
            jest.spyOn( verificationService, '_searchWikidata' ).mockResolvedValueOnce( { searches: {} } );
            jest.spyOn( verificationService, '_searchMusicBrainz' ).mockResolvedValueOnce( { searches: {} } );

            const result = await verificationService.verify( 'query', {
                artist: 'Pink Floyd',
                track: 'Wish You Were Here'
            } );

            expect( mockLogger.debug ).toHaveBeenCalledWith( expect.stringContaining( 'Pink Floyd - Wish You Were Here' ) );
            expect( result.found ).toBe( true );
        } );

        it( 'should return found: true when searches complete', async () => {
            // Mock the private search methods
            jest.spyOn( verificationService, '_searchWikipedia' ).mockResolvedValueOnce( { searches: {} } );
            jest.spyOn( verificationService, '_searchWikidata' ).mockResolvedValueOnce( { searches: {} } );
            jest.spyOn( verificationService, '_searchMusicBrainz' ).mockResolvedValueOnce( { searches: {} } );

            const result = await verificationService.verify( 'Test Artist - Test Track' );

            expect( result.found ).toBe( true );
            expect( result.data ).toBeDefined();
            expect( result.data ).toHaveProperty( 'track' );
            expect( result.data ).toHaveProperty( 'artist' );
        } );

        it( 'should return error object on failure', async () => {
            jest.spyOn( verificationService, '_searchWikipedia' ).mockRejectedValueOnce( new Error( 'API error' ) );

            const result = await verificationService.verify( 'Test Artist - Test Track' );

            expect( result.found ).toBe( false );
            expect( result.error ).toBeDefined();
            expect( mockLogger.error ).toHaveBeenCalled();
        } );

        it( 'should return structured verified data', async () => {
            // Mock the private search methods
            jest.spyOn( verificationService, '_searchWikipedia' ).mockResolvedValueOnce( { searches: {} } );
            jest.spyOn( verificationService, '_searchWikidata' ).mockResolvedValueOnce( { searches: {} } );
            jest.spyOn( verificationService, '_searchMusicBrainz' ).mockResolvedValueOnce( { searches: {} } );

            const result = await verificationService.verify( 'Test Artist - Test Track' );

            expect( result.data.track ).toBeDefined();
            expect( result.data.track.title ).toBe( 'Test Track' );
            expect( result.data.track.categories ).toBeDefined();
            expect( result.data.track.wikidata ).toBeDefined();
            expect( result.data.track.album ).toBeUndefined();

            expect( result.data.artist ).toBeDefined();
            expect( result.data.artist.title ).toBe( 'Test Artist' );
            expect( result.data.artist.categories ).toBeDefined();
            expect( result.data.artist.wikidata ).toBeDefined();
        } );
    } );

    describe( '_extractImageUrl', () => {
        it( 'should extract image URL from Wikidata entity with P18', () => {
            const entity = {
                claims: {
                    P18: [ {
                        mainsnak: {
                            datavalue: {
                                value: 'Test_Image.jpg'
                            }
                        }
                    } ]
                }
            };

            const url = verificationService._extractImageUrl( entity );

            expect( url ).toContain( 'commons.wikimedia.org' );
            expect( url ).toContain( 'Test_Image.jpg' );
            expect( url ).toContain( 'Special:FilePath' );
        } );

        it( 'should return undefined if no P18 claim', () => {
            const entity = { claims: {} };
            const url = verificationService._extractImageUrl( entity );

            expect( url ).toBeUndefined();
        } );

        it( 'should return undefined if P18 array is empty', () => {
            const entity = {
                claims: {
                    P18: []
                }
            };
            const url = verificationService._extractImageUrl( entity );

            expect( url ).toBeUndefined();
        } );

        it( 'should return undefined if entity is undefined', () => {
            const url = verificationService._extractImageUrl( undefined );

            expect( url ).toBeUndefined();
        } );

        it( 'should properly encode special characters in filenames', () => {
            const entity = {
                claims: {
                    P18: [ {
                        mainsnak: {
                            datavalue: {
                                value: 'File with spaces & special.jpg'
                            }
                        }
                    } ]
                }
            };

            const url = verificationService._extractImageUrl( entity );

            expect( url ).toContain( encodeURIComponent( 'File with spaces & special.jpg' ) );
        } );
    } );

    describe( '_searchWikipedia', () => {
        it( 'should handle missing wtf_wikipedia gracefully', async () => {
            // This will be handled at runtime if module is not installed
            const result = await verificationService._searchWikipedia( 'Test Track' );

            expect( result ).toHaveProperty( 'searches' );
            expect( typeof result.searches ).toBe( 'object' );
        } );

        it( 'should have correct method signature', () => {
            expect( typeof verificationService._searchWikipedia ).toBe( 'function' );
        } );
    } );

    describe( '_searchWikidata', () => {
        it( 'should have correct method signature', () => {
            expect( typeof verificationService._searchWikidata ).toBe( 'function' );
        } );

        it( 'should accept filterMusic parameter', async () => {
            const result = await verificationService._searchWikidata( 'Test Query', true );

            expect( result ).toHaveProperty( 'searches' );
        } );
    } );

    describe( '_searchMusicBrainz', () => {
        it( 'should have correct method signature', () => {
            expect( typeof verificationService._searchMusicBrainz ).toBe( 'function' );
        } );

        it( 'should accept artist and track parameters', async () => {
            const result = await verificationService._searchMusicBrainz( 'Test Artist', 'Test Track' );

            expect( result ).toHaveProperty( 'searches' );
        } );
    } );

    describe( 'error handling', () => {
        it( 'should catch and log search errors', async () => {
            jest.spyOn( verificationService, '_searchWikipedia' ).mockRejectedValueOnce( new Error( 'Connection error' ) );

            const result = await verificationService.verify( 'Test Artist - Test Track' );

            expect( result.found ).toBe( false );
            expect( result.error ).toBe( 'Connection error' );
        } );

        it( 'should have logger available', () => {
            expect( verificationService.logger ).toBeDefined();
            expect( verificationService.logger.debug ).toBeDefined();
            expect( verificationService.logger.info ).toBeDefined();
            expect( verificationService.logger.warn ).toBeDefined();
            expect( verificationService.logger.error ).toBeDefined();
        } );
    } );

    describe( 'configuration', () => {
        it( 'should use provided services', () => {
            const customLogger = {
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            };

            const service = new VerificationService( { logger: customLogger } );

            expect( service.logger ).toBe( customLogger );
        } );

        it( 'should have default logger if none provided', () => {
            const service = new VerificationService( {} );

            expect( service.logger ).toBeDefined();
            expect( service.logger ).toBe( console );
        } );

        it( 'should accept custom userAgent', () => {
            const customUA = 'CustomBot/1.0';
            const service = new VerificationService( { logger: mockLogger } );
            service.userAgent = customUA;

            expect( service.userAgent ).toBe( customUA );
        } );

        it( 'should have configurable delay', () => {
            const service = new VerificationService( { logger: mockLogger } );

            expect( service.delayMs ).toBe( 500 );

            service.delayMs = 1000;
            expect( service.delayMs ).toBe( 1000 );
        } );
    } );
} );
