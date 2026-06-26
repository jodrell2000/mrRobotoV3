jest.mock( 'axios' );

const MusicBrainzLookupProvider = require( '../../../src/services/verification/providers/MusicBrainzLookupProvider' );
const axios = require( 'axios' );

describe( 'MusicBrainzLookupProvider', () => {
    let provider;
    let mockLogger;
    let mockServices;

    beforeEach( () => {
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };

        mockServices = {
            logger: mockLogger
        };

        provider = new MusicBrainzLookupProvider( mockServices );

        jest.clearAllMocks();
    } );

    afterEach( () => {
        jest.clearAllMocks();
    } );

    describe( 'initialization', () => {
        it( 'should create instance with correct name', () => {
            expect( provider.getProvider() ).toBe( 'musicbrainz' );
        } );

        it( 'should implement BaseProvider interface', () => {
            expect( provider.verify ).toBeDefined();
            expect( provider.isAvailable ).toBeDefined();
            expect( provider.getProvider ).toBeDefined();
        } );

        it( 'should always be available (no authentication required)', () => {
            expect( provider.isAvailable() ).toBe( true );
        } );
    } );

    describe( 'URL lookup', () => {
        it( 'should return error when no music providers given', async () => {
            const result = await provider.verify( 'query', {} );
            expect( result.found ).toBe( false );
            expect( result.error ).toContain( 'No matching MusicBrainz data' );
        } );

        it( 'should lookup Spotify URL and return track data', async () => {
            const spotifyId = '4u7EnebtmKWzUH433cf5Qv';

            axios.get
                .mockResolvedValueOnce( {
                    data: {
                        relations: [
                            {
                                'target-type': 'recording',
                                target: 'recording-id-123'
                            }
                        ]
                    }
                } )
                .mockResolvedValueOnce( {
                    data: {
                        id: 'recording-id-123',
                        title: 'Test Track',
                        'artist-credit': [
                            {
                                artist: {
                                    name: 'Test Artist'
                                }
                            }
                        ],
                        length: 240000,
                        releases: [
                            {
                                id: 'release-id',
                                title: 'Test Album',
                                date: '2020-01-15',
                                status: 'Official',
                                'release-group': {
                                    'primary-type': 'Album'
                                },
                                media: [
                                    {
                                        tracks: [
                                            {
                                                position: '3',
                                                recording: {
                                                    id: 'recording-id-123'
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                } );

            const result = await provider.verify( 'Test Track', {
                musicProviders: { spotify: spotifyId }
            } );

            expect( result.found ).toBe( true );
            expect( result.data.name ).toBe( 'Test Track' );
            expect( result.data.artist ).toBe( 'Test Artist' );
            expect( result.data.album ).toBe( 'Test Album' );
            expect( result.data.duration ).toBe( 240 );
            expect( result.data.trackPosition ).toBe( '3' );
        } );

        it( 'should try multiple providers in order', async () => {
            jest.resetAllMocks();
            axios.get
                .mockRejectedValueOnce( { response: { status: 404 } } )
                .mockResolvedValueOnce( {
                    data: {
                        relations: [
                            { 'target-type': 'recording', target: 'rec-id' }
                        ]
                    }
                } )
                .mockResolvedValueOnce( {
                    data: {
                        id: 'rec-id',
                        title: 'Found via Deezer',
                        'artist-credit': [ { artist: { name: 'Artist' } } ],
                        length: 180000,
                        releases: [ {
                            id: 'rel-id',
                            title: 'Album',
                            status: 'Official',
                            'release-group': { 'primary-type': 'Album' }
                        } ]
                    }
                } );

            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'failed-id', deezer: 'deezer-id' }
            } );

            expect( result.found ).toBe( true );
            expect( result.data.name ).toBe( 'Found via Deezer' );
        } );

        it( 'should handle 404 responses gracefully', async () => {
            axios.get.mockRejectedValue( { response: { status: 404 } } );

            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'unknown-id' }
            } );

            expect( result.found ).toBe( false );
        } );

        it( 'should handle network errors', async () => {
            axios.get.mockRejectedValue( new Error( 'Network timeout' ) );

            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'id' }
            } );

            expect( result.found ).toBe( false );
            expect( result.error ).toContain( 'Network timeout' );
        } );
    } );

    describe( 'recording details', () => {
        it( 'should extract multiple artists', async () => {
            axios.get
                .mockResolvedValueOnce( {
                    data: {
                        relations: [
                            { 'target-type': 'recording', target: 'rec-id' }
                        ]
                    }
                } )
                .mockResolvedValueOnce( {
                    data: {
                        id: 'rec-id',
                        title: 'Collaboration',
                        'artist-credit': [
                            { artist: { name: 'Artist A' } },
                            { artist: { name: 'Artist B' } }
                        ],
                        length: 240000,
                        releases: [ {
                            id: 'rel-id',
                            title: 'Album',
                            status: 'Official',
                            'release-group': { 'primary-type': 'Album' }
                        } ]
                    }
                } );

            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'id' }
            } );

            expect( result.data.artist ).toBe( 'Artist A' );
            expect( result.data.artists ).toEqual( [ 'Artist A', 'Artist B' ] );
        } );

        it( 'should handle missing release information', async () => {
            axios.get
                .mockResolvedValueOnce( {
                    data: {
                        relations: [
                            { 'target-type': 'recording', target: 'rec-id' }
                        ]
                    }
                } )
                .mockResolvedValueOnce( {
                    data: {
                        id: 'rec-id',
                        title: 'Track',
                        'artist-credit': [ { artist: { name: 'Artist' } } ],
                        length: 180000,
                        releases: []
                    }
                } );

            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'id' }
            } );

            expect( result.found ).toBe( true );
            expect( result.data.album ).toBeUndefined();
        } );

        it( 'should return null when URL has no recording relations', async () => {
            axios.get.mockResolvedValueOnce( {
                data: {
                    relations: [
                        { 'target-type': 'work', target: 'work-id' }
                    ]
                }
            } );

            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'id' }
            } );

            expect( result.found ).toBe( false );
        } );
    } );

    describe( 'release selection', () => {
        it( 'should prefer studio albums over compilations', async () => {
            axios.get
                .mockResolvedValueOnce( {
                    data: {
                        relations: [
                            { 'target-type': 'recording', target: 'rec-id' }
                        ]
                    }
                } )
                .mockResolvedValueOnce( {
                    data: {
                        id: 'rec-id',
                        title: 'Track',
                        'artist-credit': [ { artist: { name: 'Artist' } } ],
                        length: 180000,
                        releases: [
                            {
                                id: 'compilation-id',
                                title: 'Greatest Hits',
                                status: 'Official',
                                'release-group': { 'primary-type': 'Compilation' }
                            },
                            {
                                id: 'studio-id',
                                title: 'Studio Album',
                                status: 'Official',
                                'release-group': { 'primary-type': 'Album' }
                            }
                        ]
                    }
                } );

            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'id' }
            } );

            expect( result.data.album ).toBe( 'Studio Album' );
        } );

        it( 'should prefer earlier release dates within same type', async () => {
            axios.get
                .mockResolvedValueOnce( {
                    data: {
                        relations: [
                            { 'target-type': 'recording', target: 'rec-id' }
                        ]
                    }
                } )
                .mockResolvedValueOnce( {
                    data: {
                        id: 'rec-id',
                        title: 'Track',
                        'artist-credit': [ { artist: { name: 'Artist' } } ],
                        length: 180000,
                        releases: [
                            {
                                id: 'remaster-id',
                                title: 'Album (Remaster)',
                                date: '2020-06-15',
                                status: 'Official',
                                'release-group': { 'primary-type': 'Album' }
                            },
                            {
                                id: 'original-id',
                                title: 'Album',
                                date: '1995-01-20',
                                status: 'Official',
                                'release-group': { 'primary-type': 'Album' }
                            }
                        ]
                    }
                } );

            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'id' }
            } );

            expect( result.data.album ).toBe( 'Album' );
            expect( result.data.releaseDate ).toBe( '1995-01-20' );
        } );

        it( 'should rank single after album', async () => {
            axios.get
                .mockResolvedValueOnce( {
                    data: {
                        relations: [
                            { 'target-type': 'recording', target: 'rec-id' }
                        ]
                    }
                } )
                .mockResolvedValueOnce( {
                    data: {
                        id: 'rec-id',
                        title: 'Track',
                        'artist-credit': [ { artist: { name: 'Artist' } } ],
                        length: 180000,
                        releases: [
                            {
                                id: 'single-id',
                                title: 'Single Version',
                                status: 'Official',
                                'release-group': { 'primary-type': 'Single' }
                            },
                            {
                                id: 'album-id',
                                title: 'Album Version',
                                status: 'Official',
                                'release-group': { 'primary-type': 'Album' }
                            }
                        ]
                    }
                } );

            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'id' }
            } );

            expect( result.data.album ).toBe( 'Album Version' );
        } );

        it( 'should handle releases without dates', async () => {
            axios.get
                .mockResolvedValueOnce( {
                    data: {
                        relations: [
                            { 'target-type': 'recording', target: 'rec-id' }
                        ]
                    }
                } )
                .mockResolvedValueOnce( {
                    data: {
                        id: 'rec-id',
                        title: 'Track',
                        'artist-credit': [ { artist: { name: 'Artist' } } ],
                        length: 180000,
                        releases: [
                            {
                                id: 'undated-id',
                                title: 'Unknown Date Album',
                                status: 'Official',
                                'release-group': { 'primary-type': 'Album' }
                            }
                        ]
                    }
                } );

            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'id' }
            } );

            expect( result.found ).toBe( true );
            expect( result.data.album ).toBe( 'Unknown Date Album' );
        } );
    } );

    describe( 'error handling', () => {
        it( 'should log errors at debug level', async () => {
            axios.get.mockRejectedValue( new Error( 'Test error' ) );

            await provider.verify( 'query', {
                musicProviders: { spotify: 'id' }
            } );

            expect( mockLogger.debug ).toHaveBeenCalled();
        } );

        it( 'should return error object with message', async () => {
            axios.get.mockRejectedValue( new Error( 'Specific error message' ) );

            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'id' }
            } );

            expect( result.found ).toBe( false );
            expect( result.error ).toContain( 'Specific error message' );
        } );
    } );

    describe( 'supported providers', () => {
        beforeEach( () => {
            axios.get
                .mockResolvedValueOnce( {
                    data: {
                        relations: [
                            { 'target-type': 'recording', target: 'rec-id' }
                        ]
                    }
                } )
                .mockResolvedValueOnce( {
                    data: {
                        id: 'rec-id',
                        title: 'Track',
                        'artist-credit': [ { artist: { name: 'Artist' } } ],
                        length: 180000,
                        releases: [ {
                            id: 'rel-id',
                            title: 'Album',
                            status: 'Official',
                            'release-group': { 'primary-type': 'Album' }
                        } ]
                    }
                } );
        } );

        it( 'should support Spotify IDs', async () => {
            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'spotify-id-123' }
            } );

            expect( result.found ).toBe( true );
            expect( axios.get ).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining( {
                    params: expect.objectContaining( {
                        resource: expect.stringContaining( 'open.spotify.com/track' )
                    } )
                } )
            );
        } );

        it( 'should support Deezer IDs', async () => {
            axios.get
                .mockResolvedValueOnce( {
                    data: {
                        relations: [
                            { 'target-type': 'recording', target: 'rec-id' }
                        ]
                    }
                } )
                .mockResolvedValueOnce( {
                    data: {
                        id: 'rec-id',
                        title: 'Track',
                        'artist-credit': [ { artist: { name: 'Artist' } } ],
                        length: 180000,
                        releases: [ {
                            id: 'rel-id',
                            title: 'Album',
                            status: 'Official',
                            'release-group': { 'primary-type': 'Album' }
                        } ]
                    }
                } );

            const result = await provider.verify( 'query', {
                musicProviders: { deezer: 'deezer-id-456' }
            } );

            expect( result.found ).toBe( true );
            expect( axios.get ).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining( {
                    params: expect.objectContaining( {
                        resource: expect.stringContaining( 'deezer.com/track' )
                    } )
                } )
            );
        } );
    } );

    describe( 'metadata structure', () => {
        beforeEach( () => {
            jest.resetAllMocks();
        } );

        it( 'should return complete metadata object', async () => {
            axios.get
                .mockResolvedValueOnce( {
                    data: {
                        relations: [
                            { 'target-type': 'recording', target: 'rec-mbid' }
                        ]
                    }
                } )
                .mockResolvedValueOnce( {
                    data: {
                        id: 'rec-mbid',
                        title: 'Track Name',
                        'artist-credit': [
                            { artist: { name: 'Primary Artist' } },
                            { artist: { name: 'Featured Artist' } }
                        ],
                        length: 240000,
                        releases: [ {
                            id: 'release-mbid',
                            title: 'Album Title',
                            date: '2020-06-15',
                            status: 'Official',
                            'release-group': { 'primary-type': 'Album' },
                            media: [
                                {
                                    tracks: [ {
                                        position: '5',
                                        recording: { id: 'rec-mbid' }
                                    } ]
                                }
                            ]
                        } ]
                    }
                } );

            const result = await provider.verify( 'query', {
                musicProviders: { spotify: 'id' }
            } );

            expect( result.data ).toEqual( expect.objectContaining( {
                type: 'track',
                name: 'Track Name',
                artist: 'Primary Artist',
                artists: [ 'Primary Artist', 'Featured Artist' ],
                mbid: 'rec-mbid',
                duration: 240,
                album: 'Album Title',
                albumMbid: 'release-mbid',
                releaseDate: '2020-06-15',
                albumType: 'Album',
                trackPosition: '5'
            } ) );
        } );
    } );
} );
