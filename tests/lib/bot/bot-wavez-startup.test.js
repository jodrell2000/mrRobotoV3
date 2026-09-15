const { Bot } = require( '../../../src/lib/bot.js' );
const normalizeWavezMessage = require( '../../../src/siteFrameworks/wavezfm/normalizeWavezMessage.js' );
const normalizeWavezState = require( '../../../src/siteFrameworks/wavezfm/normalizeWavezState.js' );
const translateWavezEvent = require( '../../../src/siteFrameworks/wavezfm/translateWavezEvent.js' );

jest.mock( 'fs', () => ( {
    promises: {
        appendFile: jest.fn()
    }
} ) );

describe( 'Bot Wavez W2 startup lifecycle', () => {
    let bot;
    let services;

    beforeEach( () => {
        jest.useFakeTimers();
        services = {
            config: {
                API_FRAMEWORK: 'wavezfm',
                WAVEZFM_ROOM_ID: '4d36ef70-55c7-4c50-927d-b1394f30fd5e',
                SOCKET_MESSAGE_LOG_LEVEL: 'OFF'
            },
            frameworkSpecification: {
                id: 'wavezfm',
                capabilities: {
                    privateMessages: { supported: false }
                },
                startup: {
                    requiresInitialState: true,
                    requiresChatAuthToken: false,
                    requiresPublicMessagePolling: false,
                    requiresPrivateMessagePolling: false
                },
                translators: {
                    normalizeState: normalizeWavezState,
                    translateEvent: translateWavezEvent,
                    normalizeMessage: normalizeWavezMessage
                }
            },
            logger: {
                debug: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
                info: jest.fn()
            },
            socketAdapter: {
                connect: jest.fn().mockResolvedValue(),
                joinRoom: jest.fn().mockResolvedValue( {
                    state: {
                        roomId: '4d36ef70-55c7-4c50-927d-b1394f30fd5e',
                        allUsers: [],
                        allUserData: {},
                        djs: []
                    }
                } ),
                on: jest.fn()
            },
            messagingAdapter: {
                joinRoom: jest.fn().mockResolvedValue( { success: true } )
            },
            messageService: {
                joinChat: jest.fn().mockResolvedValue(),
                returnLatestGroupMessageId: jest.fn().mockResolvedValue( null )
            },
            getState: jest.fn().mockReturnValue( undefined ),
            updateLastMessageId: jest.fn(),
            initializeStateService: jest.fn(),
            platformEventCoordinator: undefined,
            stateService: {
                _getAllUsers: jest.fn().mockReturnValue( [] )
            },
            apiAdapter: {
                getRoomState: jest.fn().mockResolvedValue( {
                    data: {
                        room: { id: 'room-1' },
                        snapshot: { roomId: 'room-1' }
                    }
                } )
            },
            parseCommands: jest.fn().mockResolvedValue( { isCommand: false } ),
            commandService: jest.fn()
        };
        bot = new Bot( 'wavez-test', services );
    } );

    afterEach( () => {
        jest.useRealTimers();
    } );

    test( 'connects without requiring Hang state or CometChat', async () => {
        const connectPromise = bot.connect();
        await jest.advanceTimersByTimeAsync( 1000 );
        await connectPromise;

        expect( services.socketAdapter.connect ).toHaveBeenCalled();
        expect( services.socketAdapter.joinRoom ).toHaveBeenCalled();
        expect( services.initializeStateService ).toHaveBeenCalled();
        expect( services.messageService.joinChat ).not.toHaveBeenCalled();
        expect( services.messageService.returnLatestGroupMessageId ).not.toHaveBeenCalled();
        expect( services.updateLastMessageId ).toHaveBeenCalledWith( undefined, expect.any( Number ) );
        expect( services.logger.debug ).toHaveBeenCalledWith( '✅ Wavez room state hydrated over HTTP' );
        expect( services.logger.debug ).toHaveBeenCalledWith( 'Skipping OpenChat join; selected framework owns chat transport' );
        expect( services.logger.debug ).toHaveBeenCalledWith( expect.stringContaining( 'Skipping public message tracking initialization for selected framework' ) );
        expect( services.logger.debug ).toHaveBeenCalledWith( 'Skipping private message tracking initialization for selected framework' );
    } );

    test( 'processes fresh Wavez messages once and ignores stale or bot messages', async () => {
        const listeners = {};
        services.socketAdapter.on.mockImplementation( ( eventName, handler ) => {
            listeners[ eventName ] = handler;
        } );
        bot.socketAdapter = services.socketAdapter;
        bot.realtimeMessageStartupTimestamp = Date.parse( '2026-09-11T10:00:00.000Z' );
        bot._setupWavezMessageListener();

        const freshMessage = {
            event: 'message_created',
            timestamp: '2026-09-11T10:01:00.000Z',
            payload: {
                id: 'message-fresh',
                roomId: services.config.WAVEZFM_ROOM_ID,
                userId: 'user-1',
                username: 'User One',
                displayUsername: 'User One',
                channel: 'public',
                content: '!ping',
                timestamp: '2026-09-11T10:01:00.000Z'
            }
        };

        await listeners.message_created( freshMessage );
        await listeners.message_created( freshMessage );
        await listeners.message_created( {
            ...freshMessage,
            payload: {
                ...freshMessage.payload,
                id: 'message-old',
                timestamp: '2026-09-11T09:59:00.000Z'
            }
        } );
        await listeners.message_created( {
            ...freshMessage,
            payload: {
                ...freshMessage.payload,
                id: 'message-bot',
                bot: true
            }
        } );

        expect( services.parseCommands ).toHaveBeenCalledTimes( 1 );
        expect( services.parseCommands ).toHaveBeenCalledWith( '!ping', services );
    } );

    test( 'refreshes Wavez room state after realtime reconnect', async () => {
        const reconnectListeners = {};
        services.socketAdapter.on.mockImplementation( ( eventName, handler ) => {
            reconnectListeners[ eventName ] = handler;
        } );
        services.apiAdapter = {
            getRoomState: jest.fn().mockResolvedValue( { data: { room: { id: 'room-1' } } } )
        };
        bot.socketAdapter = services.socketAdapter;
        bot._setupReconnectHandler();

        await reconnectListeners.reconnect();

        expect( services.apiAdapter.getRoomState ).toHaveBeenCalled();
        expect( services.logger.debug ).toHaveBeenCalledWith( '🔄 Wavez state refreshed after reconnect' );
    } );

    test( 'uses room snapshots as a playback transition fallback', async () => {
        const listeners = {};
        services.socketAdapter.on.mockImplementation( ( eventName, handler ) => {
            listeners[ eventName ] = handler;
        } );
        services.stateService = {
            getState: jest.fn().mockReturnValue( {
                nowPlaying: { playId: 'old-track', djId: 'dj-1', song: { title: 'Old' } }
            } ),
            setNormalizedState: jest.fn()
        };
        services.eventDispatcher = { dispatch: jest.fn().mockResolvedValue() };
        bot.socketAdapter = services.socketAdapter;
        bot._previousWavezState = services.stateService.getState();
        bot._setupWavezMessageListener();

        await listeners.room_state_snapshot( {
            event: 'room_state_snapshot',
            timestamp: '2026-09-13T15:06:20.420Z',
            payload: {
                roomId: services.config.WAVEZFM_ROOM_ID,
                roomName: 'Room',
                roomSlug: 'room',
                queue: [],
                playback: {
                    trackId: 'new-track',
                    source: 'youtube',
                    sourceId: 'source-1',
                    title: 'New',
                    artist: 'Artist',
                    djId: 'dj-1',
                    startedAtServerMs: 1789311980420
                },
                votes: { woots: 0, mehs: 0, grabs: 0 }
            }
        } );

        expect( services.eventDispatcher.dispatch ).toHaveBeenCalledWith(
            expect.objectContaining( {
                type: 'trackEnded',
                payload: expect.objectContaining( { playId: 'old-track' } )
            } ),
            expect.any( Object )
        );
        expect( services.eventDispatcher.dispatch ).toHaveBeenCalledWith(
            expect.objectContaining( {
                type: 'trackStarted',
                payload: expect.objectContaining( { playId: 'new-track' } )
            } ),
            expect.any( Object )
        );
        expect( services.stateService.setNormalizedState ).toHaveBeenCalled();
    } );
} );