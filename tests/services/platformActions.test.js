const createPlatformActions = require( '../../src/services/platformActions.js' );

describe( 'platformActions', () => {
    function makeServices ( overrides = {} ) {
        return {
            config: { BOT_UID: 'bot-1' },
            frameworkSpecification: {
                id: 'hangfm',
                capabilities: {
                    voting: { supported: true },
                    removeFromDJQueue: { supported: true },
                    skipTrack: { supported: true }
                }
            },
            socketAdapter: {
                voteOnSong: jest.fn().mockResolvedValue( { vote: 'up' } ),
                removeDj: jest.fn().mockResolvedValue( { removed: true } ),
                skipSong: jest.fn().mockResolvedValue( { skipped: true } )
            },
            apiAdapter: {
                updateUserNickname: jest.fn().mockResolvedValue( { nickname: 'New Name' } ),
                getUserProfile: jest.fn().mockResolvedValue( { nickname: 'Alex' } ),
                getAllPresentUsers: jest.fn().mockResolvedValue( [ 'user-1' ] )
            },
            ...overrides
        };
    }

    test( 'normalizes Hang actions and delegates to the socket adapter', async () => {
        const services = makeServices();
        const actions = createPlatformActions( services );

        await expect( actions.voteOnTrack( 'up' ) ).resolves.toMatchObject( { success: true, supported: true } );
        await expect( actions.removeFromDJQueue( 'dj-1' ) ).resolves.toMatchObject( { success: true } );
        await expect( actions.skipTrack() ).resolves.toMatchObject( { success: true } );
        expect( services.socketAdapter.voteOnSong ).toHaveBeenCalledWith( 'bot-1', 'upvote' );
        expect( services.socketAdapter.removeDj ).toHaveBeenCalledWith( 'dj-1' );
        expect( services.socketAdapter.skipSong ).toHaveBeenCalled();
        await expect( actions.updateBotIdentity( 'New Name' ) ).resolves.toMatchObject( { success: true } );
        await expect( actions.getUserProfile( 'user-1' ) ).resolves.toMatchObject( { success: true, data: { nickname: 'Alex' } } );
        await expect( actions.getPresentUsers() ).resolves.toMatchObject( { success: true, data: [ 'user-1' ] } );
    } );

    test( 'returns a capability result without calling the adapter', async () => {
        const services = makeServices( {
            frameworkSpecification: {
                id: 'future',
                capabilities: { skipTrack: { supported: false } }
            }
        } );
        const actions = createPlatformActions( services );

        await expect( actions.skipTrack() ).resolves.toMatchObject( {
            success: false,
            supported: false,
            errorCode: 'CAPABILITY_UNSUPPORTED'
        } );
        expect( services.socketAdapter.skipSong ).not.toHaveBeenCalled();
    } );
} );
