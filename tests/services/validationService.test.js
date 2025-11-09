// tests/services/validationService.test.js
jest.mock( 'fs' );
jest.mock( 'axios' );
jest.mock( '../../src/lib/logging.js', () => ( {
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
} ) );

const fs = require( 'fs' );
const axios = require( 'axios' );
const validationService = require( '../../src/services/validationService.js' );
const { logger } = require( '../../src/lib/logging.js' );

describe( 'validationService', () => {
    beforeEach( () => {
        jest.clearAllMocks();
        validationService.state = {
            isValidating: false,
            currentIndex: 0,
            allImages: [],
            results: { checked: 0, dead: [], ok: [] },
            startedAt: null,
            deadImages: {}
        };
        validationService.cache = {};
    } );

    describe( 'loadCache', () => {
        it( 'should load cache from file if exists', () => {
            const mockCache = {
                'https://example.com/img1.jpg': { lastChecked: 123456, status: 'ok', statusCode: 200 }
            };

            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( mockCache ) );

            validationService.loadCache();

            expect( validationService.cache ).toEqual( mockCache );
            expect( logger.debug ).toHaveBeenCalledWith( '✅ Loaded validation cache with 1 entries' );
        } );

        it( 'should create empty cache if file does not exist', () => {
            fs.existsSync.mockReturnValue( false );

            validationService.loadCache();

            expect( validationService.cache ).toEqual( {} );
            expect( logger.debug ).toHaveBeenCalledWith( '📝 No validation cache file found, starting fresh' );
        } );
    } );

    describe( 'saveCache', () => {
        it( 'should save cache to file', async () => {
            validationService.cache = {
                'https://example.com/img.jpg': { lastChecked: 123456, status: 'ok' }
            };

            await validationService.saveCache();

            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );
    } );

    describe( 'extractAllImages', () => {
        it( 'should extract all images from chat data', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                command1: { pictures: [ 'https://ex1.jpg', 'https://ex2.jpg' ] },
                command2: { pictures: [ 'https://ex3.jpg' ] }
            } ) );

            const result = await validationService.extractAllImages();

            expect( result ).toHaveLength( 3 );
            expect( result[ 0 ] ).toEqual( { url: 'https://ex1.jpg', command: 'command1' } );
        } );

        it( 'should handle missing pictures gracefully', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                command1: { messages: [ 'test' ] }
            } ) );

            const result = await validationService.extractAllImages();

            expect( result ).toHaveLength( 0 );
        } );
    } );

    describe( 'getImagesToCheck', () => {
        it( 'should return images not in cache', () => {
            const allImages = [
                { url: 'https://new.jpg', command: 'cmd1' },
                { url: 'https://cached.jpg', command: 'cmd2' }
            ];

            validationService.cache = {
                'https://cached.jpg': { lastChecked: Date.now(), status: 'ok' }
            };

            const result = validationService.getImagesToCheck( allImages );

            expect( result ).toHaveLength( 1 );
            expect( result[ 0 ].url ).toBe( 'https://new.jpg' );
        } );

        it( 'should return expired cached images', () => {
            const oldTimestamp = Date.now() - 31 * 24 * 60 * 60 * 1000; // 31 days ago

            const allImages = [
                { url: 'https://expired.jpg', command: 'cmd1' }
            ];

            validationService.cache = {
                'https://expired.jpg': { lastChecked: oldTimestamp, status: 'ok' }
            };

            const result = validationService.getImagesToCheck( allImages );

            expect( result ).toHaveLength( 1 );
            expect( result[ 0 ].url ).toBe( 'https://expired.jpg' );
        } );

        it( 'should return previously dead images for re-checking', () => {
            const recentTimestamp = Date.now() - 1 * 24 * 60 * 60 * 1000; // 1 day ago (recent)

            const allImages = [
                { url: 'https://dead.jpg', command: 'cmd1' },
                { url: 'https://ok.jpg', command: 'cmd2' }
            ];

            validationService.cache = {
                'https://dead.jpg': { lastChecked: recentTimestamp, status: 'dead' },
                'https://ok.jpg': { lastChecked: recentTimestamp, status: 'ok' }
            };

            const result = validationService.getImagesToCheck( allImages );

            expect( result ).toHaveLength( 1 );
            expect( result[ 0 ].url ).toBe( 'https://dead.jpg' );
        } );

        it( 'should combine unchecked, expired, and dead images', () => {
            const oldTimestamp = Date.now() - 31 * 24 * 60 * 60 * 1000; // 31 days ago
            const recentTimestamp = Date.now() - 1 * 24 * 60 * 60 * 1000; // 1 day ago

            const allImages = [
                { url: 'https://new.jpg', command: 'cmd1' },         // unchecked
                { url: 'https://expired.jpg', command: 'cmd2' },     // expired
                { url: 'https://dead.jpg', command: 'cmd3' },        // dead
                { url: 'https://recent-ok.jpg', command: 'cmd4' }    // recent and ok
            ];

            validationService.cache = {
                'https://expired.jpg': { lastChecked: oldTimestamp, status: 'ok' },
                'https://dead.jpg': { lastChecked: recentTimestamp, status: 'dead' },
                'https://recent-ok.jpg': { lastChecked: recentTimestamp, status: 'ok' }
            };

            const result = validationService.getImagesToCheck( allImages );

            expect( result ).toHaveLength( 3 );
            expect( result.map( img => img.url ) ).toEqual( 
                expect.arrayContaining( [ 'https://new.jpg', 'https://expired.jpg', 'https://dead.jpg' ] )
            );
        } );
    } );

    describe( 'checkImageUrl', () => {
        it( 'should return ok for 200 status', async () => {
            axios.head.mockResolvedValue( { status: 200 } );

            const result = await validationService.checkImageUrl( 'https://example.jpg' );

            expect( result.status ).toBe( 'ok' );
            expect( result.statusCode ).toBe( 200 );
        } );

        it( 'should return dead for 404 status', async () => {
            // Mock HEAD request returning 404
            axios.head.mockResolvedValue( { status: 404 } );
            // Mock GET request also returning 404
            axios.get.mockResolvedValue( { status: 404 } );

            const result = await validationService.checkImageUrl( 'https://dead.jpg' );

            expect( result.status ).toBe( 'dead' );
            expect( result.statusCode ).toBe( 404 );
            
            // Verify both HEAD and GET were called due to fallback logic
            expect( axios.head ).toHaveBeenCalledWith( 'https://dead.jpg', expect.any( Object ) );
            expect( axios.get ).toHaveBeenCalledWith( 'https://dead.jpg', expect.objectContaining( {
                headers: expect.objectContaining( { 'Range': 'bytes=0-1023' } )
            } ) );
        } );

        it( 'should return ok when HEAD fails with 404 but GET succeeds with 206', async () => {
            // Mock HEAD request returning 404 (like Tenor)
            axios.head.mockResolvedValue( { status: 404 } );
            // Mock GET request returning 206 Partial Content (successful fallback)
            axios.get.mockResolvedValue( { status: 206 } );

            const result = await validationService.checkImageUrl( 'https://tenor-like.gif' );

            expect( result.status ).toBe( 'ok' );
            expect( result.statusCode ).toBe( 206 );
            
            // Verify fallback logic was triggered
            expect( axios.head ).toHaveBeenCalledWith( 'https://tenor-like.gif', expect.any( Object ) );
            expect( axios.get ).toHaveBeenCalledWith( 'https://tenor-like.gif', expect.objectContaining( {
                headers: expect.objectContaining( { 'Range': 'bytes=0-1023' } )
            } ) );
        } );

        it( 'should return dead on network error', async () => {
            axios.head.mockRejectedValue( new Error( 'Network error' ) );

            const result = await validationService.checkImageUrl( 'https://example.jpg' );

            expect( result.status ).toBe( 'dead' );
            expect( result.statusCode ).toBe( 0 );
        } );
    } );

    describe( 'startValidation', () => {
        it( 'should start validation if not already running', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                cmd1: { pictures: [ 'https://img.jpg' ] }
            } ) );

            validationService.cache = {}; // No cache, so image needs checking

            const result = await validationService.startValidation();

            expect( result.success ).toBe( true );
            expect( validationService.state.isValidating ).toBe( true );
            expect( validationService.state.allImages ).toHaveLength( 1 );
        } );

        it( 'should not start if already validating', async () => {
            validationService.state.isValidating = true;

            const result = await validationService.startValidation();

            expect( result.success ).toBe( false );
            expect( result.message ).toContain( 'already in progress' );
        } );

        it( 'should report when no images need checking', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                cmd1: { pictures: [ 'https://recent.jpg' ] }
            } ) );

            // Cache recent image
            validationService.cache = {
                'https://recent.jpg': { lastChecked: Date.now(), status: 'ok' }
            };

            const result = await validationService.startValidation();

            expect( result.success ).toBe( true );
            expect( result.message ).toContain( 'checked recently' );
        } );
    } );

    describe( 'processNextImage', () => {
        it( 'should check one image and update results', async () => {
            validationService.state.isValidating = true;
            validationService.state.allImages = [
                { url: 'https://ok.jpg', command: 'cmd1' }
            ];
            validationService.state.currentIndex = 0;

            axios.head.mockResolvedValue( { status: 200 } );
            fs.writeFileSync.mockImplementation( () => { } );

            await validationService.processNextImage();

            expect( validationService.state.results.checked ).toBe( 1 );
            expect( validationService.state.results.ok ).toHaveLength( 1 );
        } );

        it( 'should mark dead images', async () => {
            validationService.state.isValidating = true;
            validationService.state.allImages = [
                { url: 'https://dead.jpg', command: 'cmd1' }
            ];
            validationService.state.currentIndex = 0;

            // Mock both HEAD and GET to return 404 (fallback also fails)
            axios.head.mockResolvedValue( { status: 404 } );
            axios.get.mockResolvedValue( { status: 404 } );
            fs.writeFileSync.mockImplementation( () => { } );

            await validationService.processNextImage();

            expect( validationService.state.results.dead ).toHaveLength( 1 );
            expect( validationService.state.deadImages.cmd1 ).toContain( 'https://dead.jpg' );
        } );
    } );

    describe( 'getStatus', () => {
        it( 'should return not validating status', () => {
            const result = validationService.getStatus();

            expect( result.isValidating ).toBe( false );
        } );

        it( 'should return progress when validating', () => {
            validationService.state.isValidating = true;
            validationService.state.allImages = [ {}, {}, {} ];
            validationService.state.currentIndex = 1;

            const result = validationService.getStatus();

            expect( result.isValidating ).toBe( true );
            expect( result.progress ).toBe( 33 );
        } );
    } );

    describe( 'getReport', () => {
        it( 'should return empty report when no dead images', () => {
            const result = validationService.getReport();

            expect( result.dead ).toEqual( {} );
            expect( result.summary ).toContain( 'No dead images' );
        } );

        it( 'should return dead images grouped by command', () => {
            validationService.state.deadImages = {
                cmd1: [ 'https://dead1.jpg' ],
                cmd2: [ 'https://dead2.jpg', 'https://dead3.jpg' ]
            };

            const result = validationService.getReport();

            expect( result.dead.cmd1 ).toHaveLength( 1 );
            expect( result.dead.cmd2 ).toHaveLength( 2 );
        } );
    } );

    describe( 'removeDeadImages', () => {
        it( 'should remove all dead images from chat data', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {
                cmd1: { pictures: [ 'https://ok.jpg', 'https://dead.jpg' ] }
            } ) );

            validationService.state.deadImages = {
                cmd1: [ 'https://dead.jpg' ]
            };

            const result = await validationService.removeDeadImages();

            expect( result.success ).toBe( true );
            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );
    } );

    describe( 'markImageChecked', () => {
        it( 'should update cache with checked image', async () => {
            await validationService.markImageChecked( 'https://example.jpg' );

            expect( validationService.cache[ 'https://example.jpg' ] ).toEqual( {
                lastChecked: expect.any( Number ),
                status: 'ok',
                statusCode: 200
            } );
        } );
    } );
} );
