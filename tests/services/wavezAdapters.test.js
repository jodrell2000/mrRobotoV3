const { loadApiAdapter } = require( '../../src/apiAdapters' );
const { loadSocketAdapter } = require( '../../src/socketAdapters' );
const { loadMessagingAdapter } = require( '../../src/messagingAdapters' );
const WavezFmApiAdapter = require( '../../src/apiAdapters/WavezFmApiAdapter.js' );
const WavezFmMessagingAdapter = require( '../../src/messagingAdapters/WavezFmMessagingAdapter.js' );

describe( 'Wavez adapter loader registration', () => {
    const config = {
        WAVEZFM_API_BASE_URL: 'https://api.wavez.fm',
        WAVEZFM_ROOM_ID: '4d36ef70-55c7-4c50-927d-b1394f30fd5e',
        WAVEZFM_ROOM_BOT_TOKEN: 'test-token'
    };

    test( 'loads Wavez API adapter shell', () => {
        const adapter = loadApiAdapter( 'wavezfm', config );

        expect( adapter.constructor.name ).toBe( 'WavezFmApiAdapter' );
        expect( adapter.getGatewayBaseUrl() ).toBe( 'https://api.wavez.fm' );
        expect( adapter.getAuthHeaders() ).toMatchObject( {
            'X-WavezFM-Bot-Token': 'test-token',
            'Content-Type': 'application/json'
        } );
    } );

    test( 'loads Wavez socket adapter shell', () => {
        const adapter = loadSocketAdapter( 'wavezfm', config );

        expect( adapter.constructor.name ).toBe( 'WavezFmSocketAdapter' );
        expect( adapter.isConnected() ).toBe( false );
    } );

    test( 'Wavez socket adapter lifecycle is startup-safe for W2', async () => {
        const adapter = new ( loadSocketAdapter( 'wavezfm', config ).constructor )( config, {
            wavezApi: {
                createRoomBotRealtimeClient: () => ( {
                    connect: jest.fn().mockResolvedValue(),
                    joinRoom: jest.fn(),
                    disconnect: jest.fn(),
                    on: jest.fn()
                } )
            },
            WebSocket: jest.fn()
        } );

        await adapter.connect();
        expect( adapter.isConnected() ).toBe( true );
        expect( adapter.on( 'message_created', jest.fn() ) ).toBeUndefined();
        await expect( adapter.joinRoom() ).resolves.toEqual( {
            state: expect.objectContaining( {
                roomId: '4d36ef70-55c7-4c50-927d-b1394f30fd5e',
                allUsers: [],
                allUserData: {},
                djs: []
            } )
        } );
        await adapter.disconnect();
        expect( adapter.isConnected() ).toBe( false );
    } );

    test( 'Wavez socket adapter connects and forwards realtime listeners for W3', async () => {
        const listeners = {};
        const client = {
            connect: jest.fn().mockResolvedValue(),
            joinRoom: jest.fn(),
            disconnect: jest.fn(),
            on: jest.fn( ( eventName, handler ) => {
                listeners[ eventName ] = handler;
                return jest.fn();
            } )
        };
        const createRoomBotRealtimeClient = jest.fn().mockReturnValue( client );
        const adapter = new ( loadSocketAdapter( 'wavezfm', config ).constructor )( config, {
            wavezApi: { createRoomBotRealtimeClient },
            WebSocket: jest.fn()
        } );
        const messageHandler = jest.fn();
        const reconnectHandler = jest.fn();

        await adapter.connect();
        adapter.on( 'message_created', messageHandler );
        adapter.on( 'reconnect', reconnectHandler );
        await adapter.joinRoom();
        listeners.message_created( { payload: { id: 'message-1' } } );
        listeners.open();

        expect( createRoomBotRealtimeClient ).toHaveBeenCalledWith( expect.objectContaining( {
            baseURL: 'https://api.wavez.fm',
            botToken: 'test-token',
            roomId: '4d36ef70-55c7-4c50-927d-b1394f30fd5e',
            autoReconnect: true,
            logging: false,
            websocketFactory: expect.any( Function )
        } ) );
        expect( client.connect ).toHaveBeenCalled();
        expect( client.joinRoom ).toHaveBeenCalled();
        expect( messageHandler ).toHaveBeenCalledWith( { payload: { id: 'message-1' } } );
        expect( reconnectHandler ).toHaveBeenCalled();
    } );

    test( 'Wavez socket adapter filters room-scoped events', async () => {
        const listeners = {};
        const client = {
            connect: jest.fn().mockResolvedValue(),
            joinRoom: jest.fn(),
            on: jest.fn( ( eventName, handler ) => {
                listeners[ eventName ] = handler;
                return jest.fn();
            } )
        };
        const adapter = new ( loadSocketAdapter( 'wavezfm', config ).constructor )( config, {
            wavezApi: { createRoomBotRealtimeClient: jest.fn().mockReturnValue( client ) },
            WebSocket: jest.fn()
        } );
        const handler = jest.fn();

        await adapter.connect();
        adapter.on( 'public_room_updated', handler );

        listeners.public_room_updated( { payload: { id: 'other-room', slug: 'other-room' } } );
        listeners.public_room_updated( { payload: { id: config.WAVEZFM_ROOM_ID } } );

        expect( handler ).toHaveBeenCalledTimes( 1 );
    } );

    test( 'Wavez socket adapter filters global user updates by room membership', async () => {
        const listeners = {};
        const client = {
            connect: jest.fn().mockResolvedValue(),
            on: jest.fn( ( eventName, handler ) => {
                listeners[ eventName ] = handler;
                return jest.fn();
            } )
        };
        const adapter = new ( loadSocketAdapter( 'wavezfm', config ).constructor )( config, {
            wavezApi: { createRoomBotRealtimeClient: jest.fn().mockReturnValue( client ) },
            WebSocket: jest.fn()
        } );
        const handler = jest.fn();

        await adapter.connect();
        adapter.on( 'user_updated', handler );
        listeners.packet( {
            event: 'room_state_snapshot',
            payload: { users: [ { id: 'room-user' } ] }
        } );
        listeners.user_updated( { payload: { userId: 'outside-user' } } );
        listeners.user_updated( { payload: { userId: 'room-user' } } );

        expect( handler ).toHaveBeenCalledTimes( 1 );
        expect( handler ).toHaveBeenCalledWith( { payload: { userId: 'room-user' } } );
    } );

    test( 'loads Wavez messaging adapter shell', async () => {
        const adapter = loadMessagingAdapter( 'wavezfm', {} );

        expect( adapter.constructor.name ).toBe( 'WavezFmMessagingAdapter' );
        expect( adapter.hasAuthToken() ).toBe( true );
        await expect( adapter.fetchChatMessages() ).resolves.toEqual( [] );
    } );

    test( 'adapter shells reject unsupported operations clearly', async () => {
        const apiAdapter = loadApiAdapter( 'wavezfm', config );
        const socketAdapter = loadSocketAdapter( 'wavezfm', config );
        const messagingAdapter = loadMessagingAdapter( 'wavezfm', {} );

        await expect( apiAdapter.getChatAuthToken() ).rejects.toThrow( 'getChatAuthToken is not supported by the Wavez.fm adapter' );
        await expect( socketAdapter.voteOnSong() ).rejects.toThrow( 'voteOnSong is not supported by the Wavez.fm adapter' );
        await expect( messagingAdapter.sendChatMessage() ).rejects.toThrow( 'sendChatMessage is not supported by the Wavez.fm adapter' );
    } );

    test( 'Wavez API adapter sends public chat over HTTP client', async () => {
        const sendMessage = jest.fn().mockResolvedValue( { data: { message: { id: 'message-1' } } } );
        const createApiClient = jest.fn().mockReturnValue( {
            roomBot: { sendMessage }
        } );
        const adapter = new WavezFmApiAdapter( config, {
            wavezApi: { createApiClient }
        } );

        await expect( adapter.sendChatMessage( 'Hello World!' ) ).resolves.toEqual( { data: { message: { id: 'message-1' } } } );
        expect( createApiClient ).toHaveBeenCalledWith( {
            baseURL: 'https://api.wavez.fm',
            roomBotToken: 'test-token'
        } );
        expect( sendMessage ).toHaveBeenCalledWith( '4d36ef70-55c7-4c50-927d-b1394f30fd5e', {
            content: 'Hello World!'
        } );
    } );

    test( 'Wavez API adapter refreshes room state over HTTP', async () => {
        const getState = jest.fn().mockResolvedValue( { data: { room: { id: 'room-1', slug: 'i-the-80s' } } } );
        const adapter = new WavezFmApiAdapter( config, {
            wavezApi: {
                createApiClient: jest.fn().mockReturnValue( { roomBot: { getState } } )
            }
        } );

        await expect( adapter.getRoomState() ).resolves.toEqual( { data: { room: { id: 'room-1', slug: 'i-the-80s' } } } );
        expect( getState ).toHaveBeenCalledWith( config.WAVEZFM_ROOM_ID );
        expect( config.WAVEZFM_ROOM_SLUG ).toBe( 'i-the-80s' );
    } );

    test( 'Wavez API adapter reads queue status over HTTP', async () => {
        const getQueueStatus = jest.fn().mockResolvedValue( { data: { positions: [] } } );
        const adapter = new WavezFmApiAdapter( config, {
            wavezApi: {
                createApiClient: jest.fn().mockReturnValue( { roomBot: { getQueueStatus } } )
            }
        } );

        await expect( adapter.getQueueStatus() ).resolves.toEqual( { data: { positions: [] } } );
        expect( getQueueStatus ).toHaveBeenCalledWith( config.WAVEZFM_ROOM_ID );
    } );

    test( 'Wavez API adapter looks up user profiles lazily', async () => {
        const getById = jest.fn().mockResolvedValue( { data: { id: 'user-1', displayUsername: 'Jodrell' } } );
        const adapter = new WavezFmApiAdapter( config, {
            wavezApi: {
                createApiClient: jest.fn().mockReturnValue( { user: { getById } } )
            }
        } );

        await expect( adapter.getUserProfile( 'user-1' ) ).resolves.toEqual( { data: { id: 'user-1', displayUsername: 'Jodrell' } } );
        expect( getById ).toHaveBeenCalledWith( 'user-1', { summary: true } );
    } );

    test( 'Wavez API adapter returns present users from normalized state', async () => {
        const adapter = new WavezFmApiAdapter( config );
        const users = [
            { id: 'user-1', nickname: 'Jodrell', isPresent: true },
            { id: 'user-2', nickname: 'Away', isPresent: false }
        ];

        await expect( adapter.getAllPresentUsers( {
            stateService: { getUsers: () => users }
        } ) ).resolves.toEqual( [ users[ 0 ] ] );
    } );

    test( 'normalizes Wavez scope and rate-limit errors', async () => {
        const getState = jest.fn()
            .mockRejectedValueOnce( Object.assign( new Error( 'wrong room' ), { code: 'ROOM_BOT_SCOPE_MISMATCH', status: 403 } ) )
            .mockRejectedValueOnce( Object.assign( new Error( 'slow down' ), { status: 429 } ) );
        const adapter = new WavezFmApiAdapter( config, {
            wavezApi: { createApiClient: jest.fn().mockReturnValue( { roomBot: { getState } } ) }
        } );

        await expect( adapter.getRoomState() ).rejects.toMatchObject( {
            code: 'ROOM_BOT_SCOPE_MISMATCH',
            status: 403,
            retryable: false
        } );
        await expect( adapter.getRoomState() ).rejects.toMatchObject( {
            code: 'RATE_LIMITED',
            status: 429,
            retryable: true
        } );
    } );

    test( 'Wavez messaging adapter delegates public chat to API adapter', async () => {
        const apiAdapter = {
            sendChatMessage: jest.fn().mockResolvedValue( { data: { message: { id: 'message-1' } } } )
        };
        const adapter = new WavezFmMessagingAdapter( { apiAdapter, config } );

        await expect( adapter.sendChatMessage( 'Hello from startup' ) ).resolves.toEqual( { data: { message: { id: 'message-1' } } } );
        expect( apiAdapter.sendChatMessage ).toHaveBeenCalledWith( 'Hello from startup', {
            roomId: '4d36ef70-55c7-4c50-927d-b1394f30fd5e'
        } );
    } );
} );