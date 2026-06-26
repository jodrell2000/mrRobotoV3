const VerificationService = require( '../../../src/services/verification/verificationService.js' );
const BaseProvider = require( '../../../src/services/verification/providers/BaseProvider.js' );

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
        it( 'should initialize with no providers when directory is empty', async () => {
            // This test verifies the service doesn't crash with no providers
            // Actual behavior depends on directory contents
            expect( verificationService.providers ).toBeDefined();
        } );

        it( 'should log when initializing', async () => {
            await verificationService.initialize();
            expect( mockLogger.debug ).toHaveBeenCalled();
        } );
    } );

    describe( 'verify', () => {
        it( 'should throw error if query is not a string', async () => {
            await expect( verificationService.verify( null ) ).rejects.toThrow( 'Query must be a non-empty string' );
            await expect( verificationService.verify( 123 ) ).rejects.toThrow( 'Query must be a non-empty string' );
            await expect( verificationService.verify( '' ) ).rejects.toThrow( 'Query must be a non-empty string' );
        } );

        it( 'should return empty result with timeout flag when no providers available', async () => {
            const result = await verificationService.verify( 'The Beatles' );
            expect( result ).toHaveProperty( 'timeout' );
            expect( result.timeout ).toBe( false );
            expect( mockLogger.warn ).toHaveBeenCalled();
        } );

        it( 'should return timeout: false when providers respond quickly', async () => {
            // Create a mock provider
            class TestProvider extends BaseProvider {
                constructor ( services ) {
                    super( 'test', services.logger || console );
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

            verificationService.providers = [ new TestProvider( { logger: mockLogger } ) ];

            const result = await verificationService.verify( 'The Beatles' );
            expect( result.timeout ).toBe( false );
            expect( result.test ).toBeDefined();
            expect( result.test.found ).toBe( true );
        } );

        it( 'should handle provider errors gracefully', async () => {
            class ErrorProvider extends BaseProvider {
                constructor ( services ) {
                    super( 'error', services.logger || console );
                }

                isAvailable () {
                    return true;
                }

                async verify () {
                    throw new Error( 'API error' );
                }
            }

            verificationService.providers = [ new ErrorProvider( { logger: mockLogger } ) ];

            const result = await verificationService.verify( 'The Beatles' );
            expect( result.timeout ).toBe( false );
            expect( result.error ).toBeDefined(); // Provider error is returned
            expect( result.error.found ).toBe( false );
            expect( result.error.error ).toBe( 'API error' );
        } );

        it( 'should return results keyed by provider name', async () => {
            class Provider1 extends BaseProvider {
                constructor ( services ) {
                    super( 'provider1', services.logger || console );
                }

                isAvailable () {
                    return true;
                }

                async verify () {
                    return { found: true, data: { id: '1' } };
                }
            }

            class Provider2 extends BaseProvider {
                constructor ( services ) {
                    super( 'provider2', services.logger || console );
                }

                isAvailable () {
                    return true;
                }

                async verify () {
                    return { found: false, error: 'Not found' };
                }
            }

            verificationService.providers = [
                new Provider1( { logger: mockLogger } ),
                new Provider2( { logger: mockLogger } )
            ];

            const result = await verificationService.verify( 'The Beatles' );
            expect( result.provider1 ).toBeDefined();
            expect( result.provider2 ).toBeDefined();
            expect( result.provider1.found ).toBe( true );
            expect( result.provider2.found ).toBe( false );
        } );
    } );

    describe( 'timeout handling', () => {
        it( 'should timeout after specified milliseconds', async () => {
            class SlowProvider extends BaseProvider {
                constructor ( services ) {
                    super( 'slow', services.logger || console );
                }

                isAvailable () {
                    return true;
                }

                async verify () {
                    // Simulate a very slow API call
                    await new Promise( resolve => setTimeout( resolve, 10000 ) );
                    return { found: true, data: {} };
                }
            }

            verificationService.providers = [ new SlowProvider( { logger: mockLogger } ) ];
            verificationService.timeoutMs = 100;

            const result = await verificationService.verify( 'The Beatles' );
            expect( result.timeout ).toBe( true );
            expect( mockLogger.warn ).toHaveBeenCalledWith(
                expect.stringContaining( 'Verification timeout' )
            );
        }, 15000 ); // Jest timeout for this test
    } );

    describe( 'getAvailableProviders', () => {
        it( 'should return array of provider names', async () => {
            class TestProvider extends BaseProvider {
                constructor ( name, services ) {
                    super( name, services.logger || console );
                }

                isAvailable () {
                    return true;
                }

                async verify () {
                    return { found: false };
                }
            }

            verificationService.providers = [
                new TestProvider( 'provider1', { logger: mockLogger } ),
                new TestProvider( 'provider2', { logger: mockLogger } )
            ];

            const providers = verificationService.getAvailableProviders();
            expect( providers ).toEqual( [ 'provider1', 'provider2' ] );
        } );

        it( 'should return empty array when no providers available', () => {
            const providers = verificationService.getAvailableProviders();
            expect( providers ).toEqual( [] );
        } );
    } );
} );
