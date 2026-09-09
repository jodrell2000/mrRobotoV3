jest.mock( 'ttfm-socket', () => ( {
    ActionName: {
        removeDj: 'removeDj',
        skipSong: 'skipSong',
        voteOnSong: 'voteOnSong'
    },
    SocketClient: jest.fn()
} ) );

const HangFmSocketAdapter = require( '../../src/socketAdapters/HangFmSocketAdapter' );

describe( 'HangFmSocketAdapter actions', () => {
    let adapter;
    let socket;
    let logger;

    beforeEach( () => {
        socket = {
            action: jest.fn().mockResolvedValue( { ok: true } )
        };
        logger = {
            debug: jest.fn(),
            error: jest.fn()
        };
        adapter = new HangFmSocketAdapter( {
            HANGOUT_ID: 'room-1',
            BOT_UID: 'bot-1',
            SOCKET_SERVER_URL: 'https://socket.example.test'
        } );
        adapter.socket = socket;
        adapter.setLogger( logger );
    } );

    test( 'voteOnSong sends Hang songVotes payload', async () => {
        await adapter.voteOnSong( 'bot-1', 'upvote' );

        expect( socket.action ).toHaveBeenCalledWith( 'voteOnSong', {
            roomUuid: 'room-1',
            userUuid: 'bot-1',
            songVotes: { like: true }
        } );
    } );

    test( 'voteOnSong supports downvote payload', async () => {
        await adapter.voteOnSong( 'bot-1', 'downvote' );

        expect( socket.action ).toHaveBeenCalledWith( 'voteOnSong', {
            roomUuid: 'room-1',
            userUuid: 'bot-1',
            songVotes: { like: false }
        } );
    } );

    test( 'removeDj sends action name with acting user and target DJ', async () => {
        await adapter.removeDj( 'dj-1' );

        expect( socket.action ).toHaveBeenCalledWith( 'removeDj', {
            roomUuid: 'room-1',
            userUuid: 'bot-1',
            djUuid: 'dj-1'
        } );
    } );

    test( 'skipSong sends action name with acting user', async () => {
        await adapter.skipSong();

        expect( socket.action ).toHaveBeenCalledWith( 'skipSong', {
            roomUuid: 'room-1',
            userUuid: 'bot-1'
        } );
    } );

    test( 'logs string socket rejections without losing the message', async () => {
        socket.action.mockRejectedValueOnce( 'unknown action or invalid apiVersion' );

        await expect( adapter.removeDj( 'dj-1' ) ).rejects.toBe( 'unknown action or invalid apiVersion' );

        expect( logger.error ).toHaveBeenCalledWith( 'Failed to remove DJ: unknown action or invalid apiVersion' );
    } );
} );