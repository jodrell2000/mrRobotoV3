const framework = require( '../../src/siteFrameworks/wavezfm/framework.js' );
const normalizeWavezMessage = require( '../../src/siteFrameworks/wavezfm/normalizeWavezMessage.js' );
const normalizeWavezOutgoingMessage = require( '../../src/siteFrameworks/wavezfm/normalizeWavezOutgoingMessage.js' );
const { loadFramework } = require( '../../src/siteFrameworks' );

describe( 'Wavez.fm W1 framework', () => {
    const validConfig = {
        API_FRAMEWORK: 'wavezfm',
        WAVEZFM_API_BASE_URL: 'https://api.wavez.fm',
        WAVEZFM_ROOM_ID: '4d36ef70-55c7-4c50-927d-b1394f30fd5e',
        WAVEZFM_ROOM_BOT_TOKEN: 'test-token'
    };

    test( 'is registered as a loadable framework', () => {
        expect( loadFramework( 'wavezfm' ) ).toBe( framework );
    } );

    test( 'declares only public chat capability for the initial slice', () => {
        expect( framework.capabilities ).toEqual( expect.objectContaining( {
            chat: expect.objectContaining( { supported: true } ),
            chatHistory: expect.objectContaining( { supported: true } ),
            publicMessages: expect.objectContaining( { supported: true } ),
            realtimeEvents: expect.objectContaining( { supported: true } ),
            chatMedia: expect.objectContaining( { supported: true, mode: 'imageUrlInContent' } ),
            privateMessages: expect.objectContaining( { supported: false } ),
            userProfiles: expect.objectContaining( { supported: true, refresh: 'lazy' } ),
            userPresence: expect.objectContaining( { supported: true } ),
            djQueueState: expect.objectContaining( { supported: false } ),
            djQueueManagement: expect.objectContaining( { supported: false } ),
            removeFromDJQueue: expect.objectContaining( { supported: true } ),
            skipTrack: expect.objectContaining( { supported: false } ),
            voting: expect.objectContaining( { supported: false } ),
            botIdentityUpdate: expect.objectContaining( { supported: false } ),
            roomSettings: expect.objectContaining( { supported: false } ),
            ephemeralMessages: expect.objectContaining( { supported: false } )
        } ) );
    } );

    test( 'requires Wavez configuration but no Hang credentials', () => {
        expect( framework.validateConfig( validConfig ) ).toEqual( [] );
        expect( framework.validateConfig( {
            ...validConfig,
            WAVEZFM_ROOM_ID: undefined
        } ) ).toContain( 'WAVEZFM_ROOM_ID not set. Configure WAVEZFM_ROOM_ID for the Wavez.fm framework' );
    } );

    test( 'validates Wavez room ID and API URL', () => {
        expect( framework.validateConfig( {
            ...validConfig,
            WAVEZFM_API_BASE_URL: 'not-a-url',
            WAVEZFM_ROOM_ID: 'room-slug'
        } ) ).toEqual( expect.arrayContaining( [
            'WAVEZFM_API_BASE_URL="not-a-url" is not a valid URL',
            'WAVEZFM_ROOM_ID="room-slug" is not a valid UUID'
        ] ) );
    } );

    test( 'does not elevate unknown Wavez roles', () => {
        expect( framework.resolveCommandPermissions( 'host' ) ).toBe( 'OWNER' );
        expect( framework.resolveCommandPermissions( 'manager' ) ).toBe( 'OWNER' );
        expect( framework.resolveCommandPermissions( 'cohost' ) ).toBe( 'MODERATOR' );
        expect( framework.resolveCommandPermissions( 'new-role' ) ).toBe( 'USER' );
    } );

    test( 'formats Wavez mentions using display names', () => {
        const services = {
            config: { CHAT_NAME: 'Fallback Bot' },
            stateService: {
                getUser: jest.fn().mockReturnValue( { nickname: 'I ❤️ the 80s Bot' } )
            }
        };

        expect( framework.formatters.formatMention( 'user-1', services ) ).toBe( '@"I ❤️ the 80s Bot"' );
        expect( framework.formatters.formatMention( 'user-2', {
            config: { CHAT_NAME: 'MrsRoboto' }
        } ) ).toBe( '@MrsRoboto' );
    } );
} );

describe( 'Wavez.fm W1 message normalization', () => {
    test( 'normalizes realtime message_created payloads', () => {
        const packet = {
            event: 'message_created',
            timestamp: '2026-09-10T17:36:36.286Z',
            payload: {
                id: 'message-1',
                roomId: 'room-1',
                userId: 'user-1',
                username: 'Jodrell',
                displayUsername: 'Jodrell',
                channel: 'public',
                content: '!ping-test',
                timestamp: '2026-09-10T17:36:36.286Z',
                mentionTargets: []
            }
        };

        expect( normalizeWavezMessage( packet, { WAVEZFM_ROOM_ID: 'room-1' } ) ).toMatchObject( {
            id: 'message-1',
            roomId: 'room-1',
            sender: { id: 'user-1', nickname: 'Jodrell' },
            content: '!ping-test',
            createdAt: '2026-09-10T17:36:36.286Z',
            visibility: 'public'
        } );
    } );

    test( 'normalizes outgoing public message intent', () => {
        expect( normalizeWavezOutgoingMessage( 'Hello World!', { roomId: 'room-1' } ) ).toEqual( {
            content: 'Hello World!',
            roomId: 'room-1',
            visibility: 'public',
            recipientId: undefined,
            replyTo: undefined,
            isEphemeral: false
        } );
    } );
} );