const BaseProvider = require( '../../../src/services/verification/providers/BaseProvider.js' );

describe( 'BaseProvider', () => {
    let mockLogger;

    beforeEach( () => {
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
    } );

    describe( 'constructor', () => {
        it( 'should initialize with name and logger', () => {
            const provider = new BaseProvider( 'test', mockLogger );
            expect( provider.name ).toBe( 'test' );
            expect( provider.logger ).toBe( mockLogger );
        } );
    } );

    describe( 'getProvider', () => {
        it( 'should return the provider name', () => {
            const provider = new BaseProvider( 'myProvider', mockLogger );
            expect( provider.getProvider() ).toBe( 'myProvider' );
        } );
    } );

    describe( 'isAvailable', () => {
        it( 'should throw error when not implemented', () => {
            const provider = new BaseProvider( 'test', mockLogger );
            expect( () => provider.isAvailable() ).toThrow( 'isAvailable() must be implemented by subclass' );
        } );
    } );

    describe( 'verify', () => {
        it( 'should throw error when not implemented', async () => {
            const provider = new BaseProvider( 'test', mockLogger );
            await expect( provider.verify( 'query' ) ).rejects.toThrow( 'verify() must be implemented by subclass' );
        } );
    } );

    describe( 'concrete implementation', () => {
        class ConcreteProvider extends BaseProvider {
            constructor ( services ) {
                super( 'concrete', services.logger || console );
            }

            isAvailable () {
                return true;
            }

            async verify ( query ) {
                return {
                    found: true,
                    data: { name: query }
                };
            }
        }

        it( 'should allow subclass to implement methods', () => {
            const provider = new ConcreteProvider( { logger: mockLogger } );
            expect( provider.isAvailable() ).toBe( true );
        } );

        it( 'should allow subclass verify to be called', async () => {
            const provider = new ConcreteProvider( { logger: mockLogger } );
            const result = await provider.verify( 'The Beatles' );
            expect( result.found ).toBe( true );
            expect( result.data.name ).toBe( 'The Beatles' );
        } );
    } );
} );
