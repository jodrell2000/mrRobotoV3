jest.mock( '../../src/socketAdapters', () => ( {
    loadSocketAdapter: jest.fn( () => ( { name: 'hang-socket' } ) )
} ) );

jest.mock( '../../src/apiAdapters', () => ( {
    loadApiAdapter: jest.fn( () => ( { name: 'hang-api' } ) )
} ) );

jest.mock( '../../src/messagingAdapters', () => ( {
    loadMessagingAdapter: jest.fn( () => ( { name: 'hang-messaging' } ) )
} ) );

const AdapterService = require( '../../src/services/AdapterService.js' );
const { loadSocketAdapter } = require( '../../src/socketAdapters' );
const { loadApiAdapter } = require( '../../src/apiAdapters' );
const { loadFramework } = require( '../../src/siteFrameworks' );

const validConfig = {
    API_FRAMEWORK: 'hangfm',
    SOCKET_SERVER_URL: 'https://socket.prod.tt.fm',
    BOT_USER_TOKEN: 'bot-token',
    TTFM_GATEWAY_BASE_URL: 'https://gateway.tt.fm',
    HANGOUT_ID: 'fc0c1a01-83d6-49ad-9050-4379431a015e',
    BOT_UID: 'f3efc54f-1090-4a83-b5e4-73328eb649d1'
};

const validWavezConfig = {
    API_FRAMEWORK: 'wavezfm',
    WAVEZFM_API_BASE_URL: 'https://api.wavez.fm',
    WAVEZFM_ROOM_ID: '4d36ef70-55c7-4c50-927d-b1394f30fd5e',
    WAVEZFM_ROOM_BOT_TOKEN: 'test-token'
};

describe( 'AdapterService H2 framework integration', () => {
    const logger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    };

    beforeEach( () => {
        jest.clearAllMocks();
    } );

    test( 'loads the selected framework and both adapters', async () => {
        const service = new AdapterService( validConfig, logger );

        await service.initialize();

        expect( service.getFramework() ).toBe( 'hangfm' );
        expect( service.getFrameworkSpecification().capabilities.removeFromDJQueue ).toEqual(
            expect.objectContaining( { supported: true } )
        );
        expect( loadSocketAdapter ).toHaveBeenCalledWith( 'hangfm', validConfig );
        expect( loadApiAdapter ).toHaveBeenCalledWith( 'hangfm', validConfig, expect.any( Object ) );
    } );

    test( 'rejects an unknown framework before loading adapters', async () => {
        const service = new AdapterService( { ...validConfig, API_FRAMEWORK: 'unknown' }, logger );

        await expect( service.initialize() ).rejects.toThrow( 'Site framework not found' );
        expect( loadSocketAdapter ).not.toHaveBeenCalled();
        expect( loadApiAdapter ).not.toHaveBeenCalled();
    } );

    test( 'requires an explicit framework selection', async () => {
        const service = new AdapterService( { ...validConfig, API_FRAMEWORK: undefined }, logger );

        await expect( service.initialize() ).rejects.toThrow( 'API_FRAMEWORK not set' );
        expect( loadSocketAdapter ).not.toHaveBeenCalled();
        expect( loadApiAdapter ).not.toHaveBeenCalled();
    } );

    test( 'loads Wavez when selected without requiring Hang credentials', async () => {
        const service = new AdapterService( validWavezConfig, logger );

        await service.initialize();

        expect( service.getFramework() ).toBe( 'wavezfm' );
        expect( service.getFrameworkSpecification().capabilities.publicMessages ).toEqual(
            expect.objectContaining( { supported: true } )
        );
        expect( service.getFrameworkSpecification().capabilities.voting ).toEqual(
            expect.objectContaining( { supported: false } )
        );
        expect( loadSocketAdapter ).toHaveBeenCalledWith( 'wavezfm', validWavezConfig );
        expect( loadApiAdapter ).toHaveBeenCalledWith( 'wavezfm', validWavezConfig, expect.any( Object ) );
        expect( validWavezConfig.COMMAND_SWITCH ).toBe( '!' );
    } );

    test( 'rejects missing Wavez configuration when Wavez is selected', async () => {
        const service = new AdapterService( { ...validWavezConfig, WAVEZFM_ROOM_BOT_TOKEN: undefined }, logger );

        await expect( service.initialize() ).rejects.toThrow( 'WAVEZFM_ROOM_BOT_TOKEN not set' );
        expect( loadSocketAdapter ).not.toHaveBeenCalled();
        expect( loadApiAdapter ).not.toHaveBeenCalled();
    } );

    test( 'uses USER for unknown platform roles', () => {
        const framework = loadFramework( 'hangfm' );

        expect( framework.resolveCommandPermissions( 'newRole' ) ).toBe( 'USER' );
        expect( framework.resolveCommandPermissions( 'owner' ) ).toBe( 'OWNER' );
    } );
} );