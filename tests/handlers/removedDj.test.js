'use strict';

const removedDj = require( '../../src/handlers/removedDj' );

describe( 'removedDj handler', () => {
    let services;

    beforeEach( () => {
        services = {
            logger: {
                debug: jest.fn(),
            },
            afkService: {
                recordActivity: jest.fn(),
            },
        };
    } );

    it( 'records leftDecks activity for the UUID found in the audienceUsers add patch', () => {
        const message = {
            statePatch: [
                { op: 'remove', path: '/djs/0' },
                { op: 'add', path: '/audienceUsers/3', value: { uuid: 'user-123', nickname: 'Alice' } },
            ],
        };
        removedDj( message, {}, services );
        expect( services.afkService.recordActivity ).toHaveBeenCalledWith( 'user-123', 'leftDecks' );
    } );

    it( 'logs a debug message after recording activity', () => {
        const message = {
            statePatch: [
                { op: 'remove', path: '/djs/0' },
                { op: 'add', path: '/audienceUsers/0', value: { uuid: 'user-456' } },
            ],
        };
        removedDj( message, {}, services );
        expect( services.logger.debug ).toHaveBeenCalledWith(
            'removedDj handler: recorded leftDecks activity for user-456'
        );
    } );

    it( 'does not throw and logs debug when no audienceUsers add patch is present', () => {
        const message = {
            statePatch: [ { op: 'remove', path: '/djs/0' } ],
        };
        expect( () => removedDj( message, {}, services ) ).not.toThrow();
        expect( services.logger.debug ).toHaveBeenCalledWith( 'removedDj handler: no UUID found in patch' );
        expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
    } );

    it( 'does not throw when statePatch is undefined', () => {
        const message = {};
        expect( () => removedDj( message, {}, services ) ).not.toThrow();
        expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
    } );

    it( 'does not throw when afkService is absent', () => {
        delete services.afkService;
        const message = {
            statePatch: [
                { op: 'remove', path: '/djs/0' },
                { op: 'add', path: '/audienceUsers/0', value: { uuid: 'user-789' } },
            ],
        };
        expect( () => removedDj( message, {}, services ) ).not.toThrow();
    } );

    it( 'ignores non-audienceUsers add patches when searching for UUID', () => {
        const message = {
            statePatch: [
                { op: 'remove', path: '/djs/0' },
                { op: 'add', path: '/someOtherPath', value: { uuid: 'wrong-uuid' } },
            ],
        };
        removedDj( message, {}, services );
        expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
        expect( services.logger.debug ).toHaveBeenCalledWith( 'removedDj handler: no UUID found in patch' );
    } );

    it( 'works with audienceUsers at index > 0', () => {
        const message = {
            statePatch: [
                { op: 'remove', path: '/djs/0' },
                { op: 'add', path: '/audienceUsers/42', value: { uuid: 'user-999' } },
            ],
        };
        removedDj( message, {}, services );
        expect( services.afkService.recordActivity ).toHaveBeenCalledWith( 'user-999', 'leftDecks' );
    } );
} );
