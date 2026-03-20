'use strict';

const handleAfkMonitorCommand = require( '../../src/commands/System Admin/handleAfkMonitorCommand' );
const AfkService = require( '../../src/services/afkService' );

function makeAfkService ( entries = [] ) {
    const svc = new AfkService();
    for ( const { uuid, nickname, mostRecent, warningLevel } of entries ) {
        svc.addUser( uuid, nickname );
        if ( mostRecent ) svc.activityMap.get( uuid ).mostRecent = mostRecent;
        if ( warningLevel !== undefined ) svc.activityMap.get( uuid ).warningLevel = warningLevel;
    }
    return svc;
}

function makeServices ( { role = 'owner', afkService, featureEnabled = true, dataValues = {} } = {} ) {
    return {
        stateService: {
            getUserRole: jest.fn().mockReturnValue( role ),
            _getDjs: jest.fn().mockReturnValue( [] ),
        },
        afkService: afkService || makeAfkService(),
        featuresService: {
            isFeatureEnabled: jest.fn().mockReturnValue( featureEnabled ),
        },
        dataService: {
            getValue: jest.fn( key => dataValues[ key ] ),
            setValue: jest.fn(),
        },
        messageService: {
            sendResponse: jest.fn().mockResolvedValue( undefined ),
        },
        logger: { debug: jest.fn() },
    };
}

function makeContext ( sender = 'uuid-owner' ) {
    return { sender, fullMessage: { isPrivateMessage: false } };
}

describe( 'handleAfkMonitorCommand', () => {
    describe( 'metadata', () => {
        it( 'has requiredRole MODERATOR', () => expect( handleAfkMonitorCommand.requiredRole ).toBe( 'MODERATOR' ) );
        it( 'has a description under 50 chars', () => expect( handleAfkMonitorCommand.description.length ).toBeLessThanOrEqual( 50 ) );
        it( 'has an example', () => expect( handleAfkMonitorCommand.example ).toBeTruthy() );
        it( 'is not hidden', () => expect( handleAfkMonitorCommand.hidden ).toBe( false ) );
    } );

    describe( 'feature flag guard', () => {
        it( 'returns error when afkMonitor is disabled', async () => {
            const services = makeServices( { featureEnabled: false } );
            const result = await handleAfkMonitorCommand( { args: 'status', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Feature disabled' );
            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'disabled' ),
                expect.any( Object )
            );
        } );
    } );

    describe( 'permission guard', () => {
        it( 'rejects users below MODERATOR', async () => {
            const services = makeServices( { role: 'user' } );
            const result = await handleAfkMonitorCommand( { args: 'status', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Insufficient permissions' );
        } );
    } );

    describe( 'unknown subcommand', () => {
        it( 'returns usage text', async () => {
            const services = makeServices();
            const result = await handleAfkMonitorCommand( { args: 'blah', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Unknown subcommand' );
            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'afkMonitor status' ),
                expect.any( Object )
            );
        } );

        it( 'returns usage text with no args', async () => {
            const services = makeServices();
            const result = await handleAfkMonitorCommand( { args: '', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
        } );
    } );

    describe( 'status subcommand', () => {
        it( 'reports no DJs when decks are empty', async () => {
            const services = makeServices();
            services.stateService._getDjs.mockReturnValue( [] );
            const result = await handleAfkMonitorCommand( { args: 'status', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( true );
            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'No DJs' ),
                expect.any( Object )
            );
        } );

        it( 'lists DJs with last-activity info', async () => {
            const afkService = makeAfkService( [
                { uuid: 'u1', nickname: 'DJ Cool', mostRecent: new Date( Date.now() - 2 * 60000 ) },
            ] );
            const services = makeServices( { afkService } );
            services.stateService._getDjs.mockReturnValue( [ { uuid: 'u1' } ] );
            const result = await handleAfkMonitorCommand( { args: 'status', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( true );
            const [ msg ] = services.messageService.sendResponse.mock.calls[ 0 ];
            expect( msg ).toContain( 'DJ Cool' );
            expect( msg ).toContain( 'last active:' );
        } );

        it( 'shows (exempt) tag for exempt DJs', async () => {
            const afkService = makeAfkService( [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: new Date() } ] );
            afkService.setExempt( 'u1' );
            const services = makeServices( { afkService } );
            services.stateService._getDjs.mockReturnValue( [ { uuid: 'u1' } ] );
            await handleAfkMonitorCommand( { args: 'status', services, context: makeContext(), responseChannel: 'request' } );
            const [ msg ] = services.messageService.sendResponse.mock.calls[ 0 ];
            expect( msg ).toContain( '(exempt)' );
        } );

        it( 'shows current thresholds from dataService', async () => {
            const services = makeServices( { dataValues: { 'afk.firstWarningMs': 600000, 'afk.intervalMs': 120000 } } );
            services.stateService._getDjs.mockReturnValue( [ { uuid: 'u1' } ] );
            await handleAfkMonitorCommand( { args: 'status', services, context: makeContext(), responseChannel: 'request' } );
            const [ msg ] = services.messageService.sendResponse.mock.calls[ 0 ];
            expect( msg ).toContain( '10' );
            expect( msg ).toContain( '2' );
        } );
    } );

    describe( 'exempt subcommand', () => {
        it( 'rejects non-owners', async () => {
            const services = makeServices( { role: 'moderator' } );
            const result = await handleAfkMonitorCommand( { args: 'exempt DJ Cool', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Insufficient permissions' );
        } );

        it( 'requires a name argument', async () => {
            const services = makeServices();
            const result = await handleAfkMonitorCommand( { args: 'exempt', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Missing name' );
        } );

        it( 'returns error when name not found', async () => {
            const services = makeServices();
            const result = await handleAfkMonitorCommand( { args: 'exempt Nobody', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'User not found' );
        } );

        it( 'exempts a matched user by exact name', async () => {
            const afkService = makeAfkService( [ { uuid: 'u1', nickname: 'DJ Cool' } ] );
            const services = makeServices( { afkService } );
            const result = await handleAfkMonitorCommand( { args: 'exempt DJ Cool', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( true );
            expect( afkService.isExempt( 'u1' ) ).toBe( true );
            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'DJ Cool' ),
                expect.any( Object )
            );
        } );

        it( 'exempts a matched user by partial name', async () => {
            const afkService = makeAfkService( [ { uuid: 'u1', nickname: 'DJ Cool' } ] );
            const services = makeServices( { afkService } );
            await handleAfkMonitorCommand( { args: 'exempt cool', services, context: makeContext(), responseChannel: 'request' } );
            expect( afkService.isExempt( 'u1' ) ).toBe( true );
        } );
    } );

    describe( 'reset subcommand', () => {
        it( 'rejects non-owners', async () => {
            const services = makeServices( { role: 'moderator' } );
            const result = await handleAfkMonitorCommand( { args: 'reset DJ Cool', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Insufficient permissions' );
        } );

        it( 'requires a name argument', async () => {
            const services = makeServices();
            const result = await handleAfkMonitorCommand( { args: 'reset', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Missing name' );
        } );

        it( 'returns error when name not found', async () => {
            const services = makeServices();
            const result = await handleAfkMonitorCommand( { args: 'reset Nobody', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'User not found' );
        } );

        it( 'resets the matched user activity timer', async () => {
            const oldTime = new Date( Date.now() - 20 * 60000 );
            const afkService = makeAfkService( [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: oldTime, warningLevel: 2 } ] );
            const services = makeServices( { afkService } );
            const result = await handleAfkMonitorCommand( { args: 'reset DJ Cool', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( true );
            const snapshot = afkService.getActivitySnapshot()[ 0 ];
            expect( snapshot.mostRecent.getTime() ).toBeGreaterThan( oldTime.getTime() );
            expect( snapshot.warningLevel ).toBe( 0 );
        } );
    } );

    describe( 'set subcommand', () => {
        it( 'rejects non-owners', async () => {
            const services = makeServices( { role: 'moderator' } );
            const result = await handleAfkMonitorCommand( { args: 'set warning 900', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Insufficient permissions' );
        } );

        it( 'rejects unknown setting name', async () => {
            const services = makeServices();
            const result = await handleAfkMonitorCommand( { args: 'set foo 900', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Unknown setting' );
        } );

        it( 'rejects non-numeric value', async () => {
            const services = makeServices();
            const result = await handleAfkMonitorCommand( { args: 'set warning abc', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Invalid value' );
        } );

        it( 'rejects zero or negative values', async () => {
            const services = makeServices();
            const result = await handleAfkMonitorCommand( { args: 'set warning 0', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Invalid value' );
        } );

        it( 'persists warning threshold in milliseconds', async () => {
            const services = makeServices();
            const result = await handleAfkMonitorCommand( { args: 'set warning 600', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( true );
            expect( services.dataService.setValue ).toHaveBeenCalledWith( 'afk.firstWarningMs', 600000 );
        } );

        it( 'persists interval in milliseconds', async () => {
            const services = makeServices();
            const result = await handleAfkMonitorCommand( { args: 'set interval 120', services, context: makeContext(), responseChannel: 'request' } );
            expect( result.success ).toBe( true );
            expect( services.dataService.setValue ).toHaveBeenCalledWith( 'afk.intervalMs', 120000 );
        } );
    } );
} );
