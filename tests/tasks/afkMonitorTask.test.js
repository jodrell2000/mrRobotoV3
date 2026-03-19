'use strict';

const { runAfkMonitorTick, TICK_INTERVAL_MS } = require( '../../src/tasks/afkMonitorTask' );
const AfkService = require( '../../src/services/afkService' );

const FIRST_WARNING_MS = 15 * 60 * 1000;
const INTERVAL_MS = 60 * 1000;
const WARN_1_MS = FIRST_WARNING_MS;
const WARN_2_MS = FIRST_WARNING_MS + INTERVAL_MS;
const WARN_3_MS = FIRST_WARNING_MS + 2 * INTERVAL_MS;
const REMOVE_MS = FIRST_WARNING_MS + 3 * INTERVAL_MS;

function makeServices ( { featureEnabled = true, djs = [], snapshot = [], dataValues = {} } = {} ) {
    const afkService = new AfkService();

    // Pre-populate the afkService with snapshot entries
    for ( const entry of snapshot ) {
        afkService.addUser( entry.uuid, entry.nickname );
        if ( entry.mostRecent ) {
            afkService.activityMap.get( entry.uuid ).mostRecent = entry.mostRecent;
        }
        if ( entry.warningLevel !== undefined ) {
            afkService.activityMap.get( entry.uuid ).warningLevel = entry.warningLevel;
        }
        if ( entry.exempted ) {
            afkService.setExempt( entry.uuid );
        }
    }

    return {
        featuresService: {
            isFeatureEnabled: jest.fn().mockReturnValue( featureEnabled ),
        },
        stateService: {
            _getDjs: jest.fn().mockReturnValue( djs ),
        },
        afkService,
        messageService: {
            sendResponse: jest.fn().mockResolvedValue( undefined ),
            formatMention: jest.fn( uuid => `<@uid:${ uuid }>` ),
        },
        dataService: {
            getValue: jest.fn( key => dataValues[ key ] ),
        },
        hangSocketServices: {
            removeDj: jest.fn().mockResolvedValue( undefined ),
        },
        socket: {},
        logger: {
            debug: jest.fn(),
        },
    };
}

describe( 'runAfkMonitorTick', () => {
    beforeEach( () => {
        jest.useFakeTimers();
        jest.setSystemTime( new Date( '2026-01-01T12:00:00Z' ) );
    } );

    afterEach( () => {
        jest.useRealTimers();
    } );

    it( 'exports TICK_INTERVAL_MS as 30 seconds', () => {
        expect( TICK_INTERVAL_MS ).toBe( 30 * 1000 );
    } );

    it( 'returns early when afkMonitor feature is disabled', async () => {
        const services = makeServices( { featureEnabled: false, djs: [ { uuid: 'u1' } ] } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
    } );

    it( 'returns early when stateService is absent', async () => {
        const services = makeServices();
        delete services.stateService;
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
    } );

    it( 'returns early when afkService is absent', async () => {
        const services = makeServices( { djs: [ { uuid: 'u1' } ] } );
        delete services.afkService;
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
    } );

    it( 'returns early when no DJs are on the decks', async () => {
        const services = makeServices( { djs: [] } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
    } );

    it( 'skips a DJ with no entry in the activity map', async () => {
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [], // empty — u1 not tracked
        } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
    } );

    it( 'skips a DJ whose entry has no mostRecent', async () => {
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: undefined } ],
        } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
    } );

    it( 'sends no warning when inactivity is below the first threshold', async () => {
        const lastActive = new Date( Date.now() - ( WARN_1_MS - 1000 ) );
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: lastActive } ],
        } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
    } );

    it( 'sends warning 1 when inactivity reaches the first threshold', async () => {
        const lastActive = new Date( Date.now() - WARN_1_MS );
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: lastActive, warningLevel: 0 } ],
        } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).toHaveBeenCalledTimes( 1 );
        const [ msg ] = services.messageService.sendResponse.mock.calls[ 0 ];
        expect( msg ).toContain( '<@uid:u1>' );
        expect( msg ).toContain( '15 minutes' );
        expect( services.afkService.getActivitySnapshot()[ 0 ].warningLevel ).toBe( 1 );
    } );

    it( 'sends warning 2 when inactivity reaches the second threshold', async () => {
        const lastActive = new Date( Date.now() - WARN_2_MS );
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: lastActive, warningLevel: 1 } ],
        } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).toHaveBeenCalledTimes( 1 );
        const [ msg ] = services.messageService.sendResponse.mock.calls[ 0 ];
        expect( msg ).toContain( 'second AFK warning' );
        expect( services.afkService.getActivitySnapshot()[ 0 ].warningLevel ).toBe( 2 );
    } );

    it( 'sends warning 3 when inactivity reaches the third threshold', async () => {
        const lastActive = new Date( Date.now() - WARN_3_MS );
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: lastActive, warningLevel: 2 } ],
        } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).toHaveBeenCalledTimes( 1 );
        const [ msg ] = services.messageService.sendResponse.mock.calls[ 0 ];
        expect( msg ).toContain( 'third AFK warning' );
        expect( services.afkService.getActivitySnapshot()[ 0 ].warningLevel ).toBe( 3 );
    } );

    it( 'does not resend warning 1 if warningLevel is already 1', async () => {
        const lastActive = new Date( Date.now() - WARN_1_MS );
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: lastActive, warningLevel: 1 } ],
        } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
    } );

    it( 'does not resend a warning level already reached', async () => {
        const lastActive = new Date( Date.now() - WARN_3_MS );
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: lastActive, warningLevel: 3 } ],
        } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
    } );

    it( 'warns multiple DJs independently in the same tick', async () => {
        const lastActive1 = new Date( Date.now() - WARN_1_MS );
        const lastActive2 = new Date( Date.now() - WARN_2_MS );
        const services = makeServices( {
            djs: [ { uuid: 'u1' }, { uuid: 'u2' } ],
            snapshot: [
                { uuid: 'u1', nickname: 'DJ Alpha', mostRecent: lastActive1, warningLevel: 0 },
                { uuid: 'u2', nickname: 'DJ Beta', mostRecent: lastActive2, warningLevel: 1 },
            ],
        } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'uses custom thresholds from dataService', async () => {
        const customFirst = 20 * 60 * 1000;
        const customInterval = 90 * 1000;
        const lastActive = new Date( Date.now() - customFirst );
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: lastActive, warningLevel: 0 } ],
            dataValues: { 'afk.firstWarningMs': customFirst, 'afk.intervalMs': customInterval },
        } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'falls back to uuid as nickname when nickname is absent', async () => {
        const lastActive = new Date( Date.now() - WARN_1_MS );
        const services = makeServices( {
            djs: [ { uuid: 'uuid-no-name' } ],
            snapshot: [ { uuid: 'uuid-no-name', nickname: undefined, mostRecent: lastActive, warningLevel: 0 } ],
        } );
        // Manually unset nickname to test fallback
        services.afkService.activityMap.get( 'uuid-no-name' ).nickname = undefined;
        await runAfkMonitorTick( services );
        const [ msg ] = services.messageService.sendResponse.mock.calls[ 0 ];
        expect( msg ).toContain( 'uuid-no-name' );
    } );

    it( 'skips a DJ who is exempt from AFK monitoring', async () => {
        const lastActive = new Date( Date.now() - WARN_1_MS );
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: lastActive, warningLevel: 0, exempted: true } ],
        } );
        await runAfkMonitorTick( services );
        expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
    } );

    it( 'removes a DJ who has reached the remove threshold', async () => {
        const lastActive = new Date( Date.now() - REMOVE_MS );
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: lastActive, warningLevel: 3 } ],
        } );
        await runAfkMonitorTick( services );
        expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith( services.socket, 'u1' );
        expect( services.messageService.sendResponse ).toHaveBeenCalledTimes( 1 );
        const [ msg ] = services.messageService.sendResponse.mock.calls[ 0 ];
        expect( msg ).toContain( 'DJ Cool' );
        expect( msg ).toMatch( /removed from the decks/i );
    } );

    it( 'sets warningLevel to 4 after removal to prevent repeated removal', async () => {
        const lastActive = new Date( Date.now() - REMOVE_MS );
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: lastActive, warningLevel: 3 } ],
        } );
        await runAfkMonitorTick( services );
        expect( services.afkService.getActivitySnapshot()[ 0 ].warningLevel ).toBe( 4 );
    } );

    it( 'does not remove a DJ still at warning 3 but below remove threshold', async () => {
        const lastActive = new Date( Date.now() - ( REMOVE_MS - 1000 ) );
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: lastActive, warningLevel: 3 } ],
        } );
        await runAfkMonitorTick( services );
        expect( services.hangSocketServices.removeDj ).not.toHaveBeenCalled();
        expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
    } );

    it( 'does not re-remove a DJ with warningLevel above 3', async () => {
        const lastActive = new Date( Date.now() - REMOVE_MS );
        const services = makeServices( {
            djs: [ { uuid: 'u1' } ],
            snapshot: [ { uuid: 'u1', nickname: 'DJ Cool', mostRecent: lastActive, warningLevel: 4 } ],
        } );
        await runAfkMonitorTick( services );
        expect( services.hangSocketServices.removeDj ).not.toHaveBeenCalled();
    } );
} );
