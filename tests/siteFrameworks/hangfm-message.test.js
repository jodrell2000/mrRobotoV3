const normalizeHangMessage = require( '../../src/siteFrameworks/hangfm/normalizeHangMessage.js' );
const normalizeHangOutgoingMessage = require( '../../src/siteFrameworks/hangfm/normalizeHangOutgoingMessage.js' );

describe( 'Hang.fm message normalization', () => {
    const config = {
        HANGOUT_ID: 'room-1',
        SOCKET_MESSAGE_LOG_LEVEL: 'OFF'
    };

    test( 'normalizes a public OpenChat message', () => {
        const message = normalizeHangMessage( {
            id: 'message-1',
            sender: { uid: 'user-1' },
            data: { text: 'hello' },
            sentAt: 123
        }, config );

        expect( message ).toMatchObject( {
            id: 'message-1',
            roomId: 'room-1',
            content: 'hello',
            createdAt: 123,
            visibility: 'public',
            sender: { id: 'user-1' }
        } );
        expect( message.recipientId ).toBeUndefined();
    } );

    test( 'normalizes one-to-one private messages', () => {
        const message = normalizeHangMessage( {
            id: 'message-2',
            sender: 'user-1',
            text: 'private',
            isPrivateMessage: true,
            recipientUUID: 'bot-1'
        }, config );

        expect( message ).toMatchObject( {
            content: 'private',
            visibility: 'private',
            recipientId: 'bot-1',
            sender: { id: 'user-1' }
        } );
    } );

    test( 'includes raw payload only in test mode', () => {
        const message = { id: 'message-3', sender: 'user-1', text: 'hello' };
        expect( normalizeHangMessage( message, config ).raw ).toBe( message );
    } );

    test( 'normalizes outgoing public and private message intent', () => {
        expect( normalizeHangOutgoingMessage( 'public text', { roomId: 'room-1' } ) )
            .toMatchObject( { content: 'public text', roomId: 'room-1', visibility: 'public' } );
        expect( normalizeHangOutgoingMessage( 'private text', { recipientId: 'user-1' } ) )
            .toMatchObject( { content: 'private text', recipientId: 'user-1', visibility: 'private' } );
    } );
} );
