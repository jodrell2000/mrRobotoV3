const HangFmMessagingAdapter = require( '../../src/messagingAdapters/HangFmMessagingAdapter.js' );

describe( 'HangFmMessagingAdapter', () => {
    test( 'delegates chat operations to Hang messaging services', async () => {
        const messageService = {
            joinChat: jest.fn().mockResolvedValue( { joined: true } ),
            leaveChat: jest.fn().mockResolvedValue( { left: true } ),
            sendGroupMessage: jest.fn().mockResolvedValue( { message: 'public' } ),
            fetchGroupMessages: jest.fn().mockResolvedValue( [ 'public' ] )
        };
        const privateMessageService = {
            sendPrivateMessage: jest.fn().mockResolvedValue( { message: 'private' } ),
            fetchNewPrivateUserMessages: jest.fn().mockResolvedValue( [ 'private' ] )
        };
        const openchatApi = {
            setAuthToken: jest.fn(),
            hasAuthToken: jest.fn().mockReturnValue( true )
        };
        const adapter = new HangFmMessagingAdapter( { messageService, privateMessageService, openchatApi } );

        await expect( adapter.joinRoom( 'room-1' ) ).resolves.toEqual( { joined: true } );
        await expect( adapter.leaveRoom( 'room-1' ) ).resolves.toEqual( { left: true } );
        await expect( adapter.sendChatMessage( 'hello' ) ).resolves.toEqual( { message: 'public' } );
        await expect( adapter.sendPrivateMessage( 'secret', 'user-1', {} ) ).resolves.toEqual( { message: 'private' } );
        await expect( adapter.fetchChatMessages( 'room-1', {} ) ).resolves.toEqual( [ 'public' ] );
        await expect( adapter.fetchPrivateMessages( 'user-1', {} ) ).resolves.toEqual( [ 'private' ] );
        adapter.setAuthToken( 'token' );

        expect( openchatApi.setAuthToken ).toHaveBeenCalledWith( 'token' );
    } );
} );
