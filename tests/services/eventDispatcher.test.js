const EventDispatcher = require( '../../src/services/eventDispatcher.js' );

describe( 'EventDispatcher', () => {
    test( 'dispatches the primary handler before subscribers', async () => {
        const calls = [];
        const dispatcher = new EventDispatcher( {} );
        dispatcher.registerHandler( 'trackStarted', async () => calls.push( 'handler' ) );
        dispatcher.subscribe( 'trackStarted', async () => calls.push( 'subscriber' ) );

        await dispatcher.dispatch( { type: 'trackStarted' } );

        expect( calls ).toEqual( [ 'handler', 'subscriber' ] );
    } );

    test( 'isolates subscriber failures from other subscribers', async () => {
        const logger = { error: jest.fn() };
        const calls = [];
        const dispatcher = new EventDispatcher( logger );
        dispatcher.subscribe( 'voteChanged', async () => {
            throw new Error( 'subscriber failed' );
        } );
        dispatcher.subscribe( 'voteChanged', async () => calls.push( 'second subscriber' ) );

        await dispatcher.dispatch( { type: 'voteChanged' } );

        expect( calls ).toEqual( [ 'second subscriber' ] );
        expect( logger.error ).toHaveBeenCalledWith( 'Event subscriber failed for voteChanged: subscriber failed' );
    } );

    test( 'prevents duplicate primary handlers', () => {
        const dispatcher = new EventDispatcher( {} );
        dispatcher.registerHandler( 'userJoined', () => { } );

        expect( () => dispatcher.registerHandler( 'userJoined', () => { } ) )
            .toThrow( 'Handler already registered for event: userJoined' );
    } );
} );
