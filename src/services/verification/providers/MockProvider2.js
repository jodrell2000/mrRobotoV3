const BaseProvider = require( './BaseProvider.js' );

/**
 * Secondary mock provider for testing multiple providers
 * Demonstrates different response patterns than MockProvider
 */
class MockProvider2 extends BaseProvider {
    constructor ( services = {} ) {
        super( 'mock2', services.logger || console );
        this.services = services;
    }

    isAvailable () {
        return true;
    }

    async verify ( query, options = {} ) {
        // Simulate slower API delay
        await new Promise( resolve => setTimeout( resolve, 100 ) );

        // Different mock data
        const knownArtists = {
            'the beatles': {
                found: true,
                data: {
                    id: 'mock2-beatles',
                    name: 'The Beatles',
                    formed: 1960,
                    country: 'United Kingdom'
                }
            },
            'led zeppelin': {
                found: true,
                data: {
                    id: 'mock2-zeppelin',
                    name: 'Led Zeppelin',
                    formed: 1968,
                    country: 'United Kingdom'
                }
            }
        };

        const lowerQuery = query.toLowerCase();
        if ( knownArtists[ lowerQuery ] ) {
            return knownArtists[ lowerQuery ];
        }

        return {
            found: false,
            error: 'No match found'
        };
    }
}

module.exports = MockProvider2;
