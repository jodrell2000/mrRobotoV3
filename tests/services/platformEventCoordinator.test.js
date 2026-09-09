const PlatformEventCoordinator = require( '../../src/services/platformEventCoordinator.js' );

describe( 'PlatformEventCoordinator', () => {
    test( 'dispatches normalized events and deduplicates track endings', async () => {
        const dispatched = [];
        const services = {
            config: { HANGOUT_ID: 'room-1', SOCKET_MESSAGE_LOG_LEVEL: 'OFF' }
        };
        const dispatcher = {
            dispatch: jest.fn( async event => dispatched.push( event ) )
        };
        const framework = {
            translators: {
                translateEvent: jest.fn().mockReturnValue( [
                    { type: 'trackEnded', payload: { playId: 'play-1' } }
                ] )
            }
        };
        const coordinator = new PlatformEventCoordinator( { framework, dispatcher, services } );

        await coordinator.dispatchHangMessage( { name: 'playedSong' }, { currentState: {} } );
        await coordinator.dispatchHangMessage( { name: 'playedSong' }, { currentState: {} } );

        expect( dispatched ).toHaveLength( 1 );
        expect( dispatched[ 0 ].payload.playId ).toBe( 'play-1' );
    } );

    test( 'dispatches a complete room state through the translator', async () => {
        const dispatcher = { dispatch: jest.fn() };
        const services = {
            config: { HANGOUT_ID: 'room-1', SOCKET_MESSAGE_LOG_LEVEL: 'OFF' }
        };
        const framework = {
            translators: {
                translateEvent: jest.fn().mockReturnValue( [ { type: 'roomStateReceived', payload: { state: {} } } ] )
            }
        };
        const coordinator = new PlatformEventCoordinator( { framework, dispatcher, services } );

        await coordinator.dispatchRoomState( { room: { id: 'room-1' } } );

        expect( dispatcher.dispatch ).toHaveBeenCalledWith(
            expect.objectContaining( { type: 'roomStateReceived' } ),
            expect.objectContaining( { services } )
        );
    } );
} );
