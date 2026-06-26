const BaseProvider = require( './BaseProvider.js' );

/**
 * Mock provider for testing
 * Returns hardcoded responses without making real API calls
 */
class MockProvider extends BaseProvider {
    constructor ( services = {} ) {
        super( 'mock', services.logger || console );
        this.services = services;
        // Mock provider is always available
    }

    isAvailable () {
        return true;
    }

    async verify ( query, options = {} ) {
        // Simulate API delay
        await new Promise( resolve => setTimeout( resolve, 50 ) );

        // Mock data for testing
        const knownArtists = {
            'the beatles': {
                found: true,
                data: {
                    id: 'mock-beatles',
                    name: 'The Beatles',
                    type: 'band',
                    genres: [ 'rock', 'pop' ],
                    members: 4
                }
            },
            'pink floyd': {
                found: true,
                data: {
                    id: 'mock-floyd',
                    name: 'Pink Floyd',
                    type: 'band',
                    genres: [ 'rock', 'progressive' ],
                    members: 5
                }
            },
            'unknown band xyz': {
                found: false,
                error: 'Artist not found in mock database'
            }
        };

        const lowerQuery = query.toLowerCase();
        if ( knownArtists[ lowerQuery ] ) {
            return knownArtists[ lowerQuery ];
        }

        return {
            found: false,
            error: 'Artist not found'
        };
    }
}

module.exports = MockProvider;
