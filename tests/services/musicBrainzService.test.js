const MusicBrainzService = require( '../../src/services/musicBrainzService' );

// Mock fetch globally
global.fetch = jest.fn();

describe( 'MusicBrainzService', () => {
    let service;

    beforeEach( () => {
        jest.clearAllMocks();
        service = new MusicBrainzService();
        // Reset the last request time to avoid rate limiting in tests
        service.lastRequestTime = 0;
        // Set a very short rate limit interval for tests
        service.minRequestInterval = 0;
    } );

    describe( 'constructor', () => {
        it( 'should initialize with correct defaults', () => {
            const freshService = new MusicBrainzService();
            expect( freshService.baseUrl ).toBe( 'https://musicbrainz.org/ws/2' );
            expect( freshService.userAgent ).toContain( 'MrRobotoBot' );
            expect( freshService.minRequestInterval ).toBe( 1100 );
        } );

        it( 'should use provided bot name in User-Agent', () => {
            const customService = new MusicBrainzService( 'MyCustomBot' );
            expect( customService.userAgent ).toBe( 'MyCustomBot/1.0 (https://github.com/jodrell2000/mrRobotoV3)' );
        } );

        it( 'should sanitize special characters from bot name', () => {
            const customService = new MusicBrainzService( 'My Bot! @#$%' );
            expect( customService.userAgent ).toBe( 'MyBot/1.0 (https://github.com/jodrell2000/mrRobotoV3)' );
        } );

        it( 'should fall back to MrRobotoBot if no name provided', () => {
            const defaultService = new MusicBrainzService( null );
            expect( defaultService.userAgent ).toContain( 'MrRobotoBot' );
        } );
    } );

    describe( 'escapeLuceneQuery', () => {
        it( 'should escape special Lucene characters', () => {
            expect( service.escapeLuceneQuery( 'test+query' ) ).toBe( 'test\\+query' );
            expect( service.escapeLuceneQuery( 'AC/DC' ) ).toBe( 'AC\\/DC' );
            expect( service.escapeLuceneQuery( 'test:query' ) ).toBe( 'test\\:query' );
            expect( service.escapeLuceneQuery( 'test (band)' ) ).toBe( 'test \\(band\\)' );
        } );

        it( 'should handle strings without special characters', () => {
            expect( service.escapeLuceneQuery( 'The Beatles' ) ).toBe( 'The Beatles' );
            expect( service.escapeLuceneQuery( 'Hey Jude' ) ).toBe( 'Hey Jude' );
        } );
    } );

    describe( 'findEarliestRelease', () => {
        it( 'should find the earliest release date', () => {
            const releases = [
                { title: 'Album 2', date: '1970-01-01' },
                { title: 'Album 1', date: '1968-08-26' },
                { title: 'Album 3', date: '1975-05-15' }
            ];

            const result = service.findEarliestRelease( releases );

            expect( result.year ).toBe( 1968 );
            expect( result.date ).toBe( '1968-08-26' );
            expect( result.release.title ).toBe( 'Album 1' );
        } );

        it( 'should handle releases without dates', () => {
            const releases = [
                { title: 'Album 1' },
                { title: 'Album 2', date: '1970-01-01' }
            ];

            const result = service.findEarliestRelease( releases );

            expect( result.year ).toBe( 1970 );
            expect( result.release.title ).toBe( 'Album 2' );
        } );

        it( 'should return null values for empty releases', () => {
            const result = service.findEarliestRelease( [] );

            expect( result.year ).toBeNull();
            expect( result.release ).toBeNull();
        } );

        it( 'should return null values for null/undefined input', () => {
            expect( service.findEarliestRelease( null ).year ).toBeNull();
            expect( service.findEarliestRelease( undefined ).year ).toBeNull();
        } );
    } );

    describe( 'makeRequest', () => {
        it( 'should make a request with correct headers and URL', async () => {
            const mockResponse = { recordings: [] };
            global.fetch.mockResolvedValue( {
                ok: true,
                json: () => Promise.resolve( mockResponse )
            } );

            await service.makeRequest( '/recording', { query: 'test' } );

            expect( global.fetch ).toHaveBeenCalledWith(
                expect.stringContaining( 'https://musicbrainz.org/ws/2/recording' ),
                expect.objectContaining( {
                    headers: expect.objectContaining( {
                        'User-Agent': expect.stringContaining( 'MrRobotoBot' ),
                        'Accept': 'application/json'
                    } )
                } )
            );
        } );

        it( 'should include fmt=json in the URL', async () => {
            global.fetch.mockResolvedValue( {
                ok: true,
                json: () => Promise.resolve( {} )
            } );

            await service.makeRequest( '/recording', {} );

            const callUrl = global.fetch.mock.calls[ 0 ][ 0 ];
            expect( callUrl ).toContain( 'fmt=json' );
        } );

        it( 'should throw error on non-ok response', async () => {
            global.fetch.mockResolvedValue( {
                ok: false,
                status: 503,
                statusText: 'Service Unavailable'
            } );

            await expect( service.makeRequest( '/recording', {} ) )
                .rejects
                .toThrow( 'MusicBrainz API error: 503 Service Unavailable' );
        } );
    } );

    describe( 'searchRecording', () => {
        it( 'should search for a recording and return the first match', async () => {
            const mockRecording = {
                id: 'test-id',
                title: 'Hey Jude',
                'artist-credit': [ { name: 'The Beatles' } ]
            };

            global.fetch.mockResolvedValue( {
                ok: true,
                json: () => Promise.resolve( { recordings: [ mockRecording ] } )
            } );

            const result = await service.searchRecording( 'The Beatles', 'Hey Jude' );

            expect( result ).toEqual( mockRecording );
        } );

        it( 'should return null when no recordings found', async () => {
            global.fetch.mockResolvedValue( {
                ok: true,
                json: () => Promise.resolve( { recordings: [] } )
            } );

            const result = await service.searchRecording( 'Unknown Artist', 'Unknown Song' );

            expect( result ).toBeNull();
        } );

        it( 'should return null on error', async () => {
            global.fetch.mockRejectedValue( new Error( 'Network error' ) );

            const result = await service.searchRecording( 'The Beatles', 'Hey Jude' );

            expect( result ).toBeNull();
        } );
    } );

    describe( 'getSongDetails', () => {
        it( 'should return song details with release info', async () => {
            const mockRecording = {
                id: 'recording-123',
                title: 'Hey Jude',
                length: 431000, // 431 seconds in ms
                'artist-credit': [ { name: 'The Beatles' } ],
                releases: [
                    { title: 'Hey Jude', date: '1968-08-26', status: 'Official', country: 'GB' },
                    { title: '1', date: '2000-11-13', status: 'Official', country: 'XW' }
                ]
            };

            // First call for searchRecording
            global.fetch.mockResolvedValueOnce( {
                ok: true,
                json: () => Promise.resolve( { recordings: [ mockRecording ] } )
            } );

            // Second call for getRecordingDetails
            global.fetch.mockResolvedValueOnce( {
                ok: true,
                json: () => Promise.resolve( {
                    ...mockRecording,
                    genres: [ { name: 'rock' }, { name: 'pop' } ]
                } )
            } );

            const result = await service.getSongDetails( 'The Beatles', 'Hey Jude' );

            expect( result.found ).toBe( true );
            expect( result.matchedTrack ).toBe( 'Hey Jude' );
            expect( result.matchedArtist ).toBe( 'The Beatles' );
            expect( result.originalReleaseYear ).toBe( 1968 );
            expect( result.primaryAlbum ).toBe( 'Hey Jude' );
            expect( result.duration ).toBe( 431 );
            expect( result.genres ).toEqual( [ 'rock', 'pop' ] );
        } );

        it( 'should return not found when recording does not exist', async () => {
            global.fetch.mockResolvedValue( {
                ok: true,
                json: () => Promise.resolve( { recordings: [] } )
            } );

            const result = await service.getSongDetails( 'Unknown Artist', 'Unknown Song' );

            expect( result.found ).toBe( false );
            expect( result.error ).toContain( 'No information found' );
        } );

        it( 'should handle API errors gracefully by returning not found', async () => {
            // searchRecording catches errors and returns null, so getSongDetails sees it as "not found"
            global.fetch.mockRejectedValueOnce( new Error( 'API unavailable' ) );

            const result = await service.getSongDetails( 'The Beatles', 'Hey Jude' );

            expect( result.found ).toBe( false );
            expect( result.error ).toContain( 'No information found' );
        } );

        it( 'should handle recordings without releases', async () => {
            const mockRecording = {
                id: 'recording-123',
                title: 'Some Song',
                'artist-credit': [ { name: 'Some Artist' } ],
                releases: []
            };

            global.fetch.mockResolvedValueOnce( {
                ok: true,
                json: () => Promise.resolve( { recordings: [ mockRecording ] } )
            } );

            global.fetch.mockResolvedValueOnce( {
                ok: true,
                json: () => Promise.resolve( mockRecording )
            } );

            const result = await service.getSongDetails( 'Some Artist', 'Some Song' );

            expect( result.found ).toBe( true );
            expect( result.originalReleaseYear ).toBeUndefined();
            expect( result.primaryAlbum ).toBeUndefined();
        } );
    } );

    describe( 'rate limiting', () => {
        it( 'should enforce minimum time between requests', async () => {
            jest.useFakeTimers();

            const rateLimitedService = new MusicBrainzService();

            global.fetch.mockResolvedValue( {
                ok: true,
                json: () => Promise.resolve( { recordings: [] } )
            } );

            // Set last request time to now
            rateLimitedService.lastRequestTime = Date.now();

            // Start the request (which should wait)
            const requestPromise = rateLimitedService.makeRequest( '/recording', {} );

            // Verify the request hasn't been made yet (waiting for rate limit)
            expect( global.fetch ).not.toHaveBeenCalled();

            // Fast-forward time past the rate limit
            jest.advanceTimersByTime( 1200 );

            await requestPromise;

            // Now the request should have been made
            expect( global.fetch ).toHaveBeenCalledTimes( 1 );

            jest.useRealTimers();
        } );
    } );
} );
