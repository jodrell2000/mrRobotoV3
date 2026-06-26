const MockProvider = require( '../../../src/services/verification/providers/MockProvider.js' );

describe( 'MockProvider', () => {
    let mockLogger;
    let provider;

    beforeEach( () => {
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
        provider = new MockProvider( { logger: mockLogger } );
    } );

    describe( 'initialization', () => {
        it( 'should initialize with correct name', () => {
            expect( provider.getProvider() ).toBe( 'mock' );
        } );

        it( 'should always be available', () => {
            expect( provider.isAvailable() ).toBe( true );
        } );
    } );

    describe( 'verify', () => {
        it( 'should find known artists', async () => {
            const result = await provider.verify( 'The Beatles' );
            expect( result.found ).toBe( true );
            expect( result.data.name ).toBe( 'The Beatles' );
            expect( result.data.id ).toBe( 'mock-beatles' );
            expect( result.data.genres ).toContain( 'rock' );
        } );

        it( 'should handle case-insensitive queries', async () => {
            const result = await provider.verify( 'the beatles' );
            expect( result.found ).toBe( true );
            expect( result.data.name ).toBe( 'The Beatles' );
        } );

        it( 'should return false for unknown artists', async () => {
            const result = await provider.verify( 'Totally Unknown Artist' );
            expect( result.found ).toBe( false );
            expect( result.error ).toBe( 'Artist not found' );
        } );

        it( 'should find Pink Floyd', async () => {
            const result = await provider.verify( 'pink floyd' );
            expect( result.found ).toBe( true );
            expect( result.data.id ).toBe( 'mock-floyd' );
        } );

        it( 'should handle unknown artist in database', async () => {
            const result = await provider.verify( 'unknown band xyz' );
            expect( result.found ).toBe( false );
            expect( result.error ).toBe( 'Artist not found in mock database' );
        } );

        it( 'should simulate API delay', async () => {
            const startTime = Date.now();
            await provider.verify( 'The Beatles' );
            const elapsed = Date.now() - startTime;
            expect( elapsed ).toBeGreaterThanOrEqual( 50 );
        } );

        it( 'should accept options parameter', async () => {
            const result = await provider.verify( 'The Beatles', { type: 'band' } );
            expect( result.found ).toBe( true );
        } );
    } );
} );
