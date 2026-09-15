jest.mock( '../../src/config.js', () => ( {} ) );

const handleDebugCommand = require( '../../src/commands/System Admin/handleDebugCommand.js' );

describe( 'handleDebugCommand framework status', () => {
    test( 'reports Wavez configuration without Hang-only fields', async () => {
        const sendResponse = jest.fn().mockResolvedValue( {} );
        const services = {
            config: {
                API_FRAMEWORK: 'wavezfm',
                WAVEZFM_ROOM_ID: 'room-1',
                WAVEZFM_API_BASE_URL: 'https://api.wavez.fm',
                WAVEZFM_ROOM_BOT_TOKEN: 'token'
            },
            frameworkSpecification: {
                displayName: 'Wavez.fm',
                startup: { requiresInitialState: false }
            },
            bot: {
                isProcessingPublicMessages: false,
                isProcessingPrivateMessages: false,
                lastMessageIDs: {}
            },
            socketAdapter: { isConnected: () => true },
            messageService: { sendResponse },
            messagingAdapter: { sendChatMessage: jest.fn() },
            retryService: { getAllCircuitStatuses: () => ( {} ) },
            commandService: {},
            dataService: {},
            getState: jest.fn()
        };

        const result = await handleDebugCommand( {
            services,
            context: {},
            responseChannel: 'request'
        } );
        const response = result.response;

        expect( response ).toContain( 'Framework: Wavez.fm' );
        expect( response ).toContain( 'Room state: not required' );
        expect( response ).toContain( 'Room ID: set' );
        expect( response ).not.toContain( 'Hangout ID:' );
        expect( response ).not.toContain( 'CometChat API Key:' );
        expect( response.length ).toBeLessThan( 500 );
        expect( sendResponse ).toHaveBeenCalled();
    } );
} );
