'use strict';

const removedDj = require( '../../src/handlers/removedDj' );
const { handleRemovedDjEvent } = require( '../../src/handlers/removedDj' );

describe( 'removedDj handler', () => {
    let services;

    beforeEach( () => {
        services = {
            logger: {
                debug: jest.fn(),
                error: jest.fn(),
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

    describe( 'Phase 4: Escort flag cleanup', () => {
        beforeEach( () => {
            services.dataService = {
                getValue: jest.fn().mockReturnValue( {} ),
                setValue: jest.fn(),
            };
        } );

        it( 'should clear escort flag when user with escortme leaves decks', () => {
            const escortQueue = {
                'user-123': {
                    markedAt: Date.now() - 5000,
                    removeAfterCurrent: true,
                },
            };
            services.dataService.getValue.mockReturnValue( escortQueue );

            const message = {
                statePatch: [
                    { op: 'remove', path: '/djs/0' },
                    { op: 'add', path: '/audienceUsers/3', value: { uuid: 'user-123' } },
                ],
            };
            removedDj( message, {}, services );

            expect( services.dataService.getValue ).toHaveBeenCalledWith( 'escortQueue' );
            expect( services.dataService.setValue ).toHaveBeenCalledWith( 'escortQueue', {} );
            expect( services.logger.debug ).toHaveBeenCalledWith(
                'removedDj handler: cleared escortme flag for user-123'
            );
        } );

        it( 'should not call setValue when user has no escort flag', () => {
            const escortQueue = {
                'other-user': {
                    markedAt: Date.now() - 5000,
                    removeAfterCurrent: false,
                },
            };
            services.dataService.getValue.mockReturnValue( escortQueue );

            const message = {
                statePatch: [
                    { op: 'remove', path: '/djs/0' },
                    { op: 'add', path: '/audienceUsers/3', value: { uuid: 'user-456' } },
                ],
            };
            removedDj( message, {}, services );

            expect( services.dataService.getValue ).toHaveBeenCalled();
            expect( services.dataService.setValue ).not.toHaveBeenCalled();
        } );

        it( 'should preserve other users flags when one user leaves', () => {
            const otherUserFlag = {
                markedAt: Date.now() - 10000,
                removeAfterCurrent: false,
            };
            const escortQueue = {
                'user-123': {
                    markedAt: Date.now() - 5000,
                    removeAfterCurrent: true,
                },
                'other-user': otherUserFlag,
            };
            services.dataService.getValue.mockReturnValue( escortQueue );

            const message = {
                statePatch: [
                    { op: 'remove', path: '/djs/0' },
                    { op: 'add', path: '/audienceUsers/3', value: { uuid: 'user-123' } },
                ],
            };
            removedDj( message, {}, services );

            const setValueCall = services.dataService.setValue.mock.calls[ 0 ][ 1 ];
            expect( setValueCall[ 'user-123' ] ).toBeUndefined();
            expect( setValueCall[ 'other-user' ] ).toEqual( otherUserFlag );
        } );

        it( 'should handle empty escortQueue gracefully', () => {
            services.dataService.getValue.mockReturnValue( {} );

            const message = {
                statePatch: [
                    { op: 'remove', path: '/djs/0' },
                    { op: 'add', path: '/audienceUsers/3', value: { uuid: 'user-999' } },
                ],
            };
            removedDj( message, {}, services );

            expect( services.dataService.getValue ).toHaveBeenCalled();
            expect( services.dataService.setValue ).not.toHaveBeenCalled();
        } );

        it( 'should handle dataService.getValue returning null', () => {
            services.dataService.getValue.mockReturnValue( null );

            const message = {
                statePatch: [
                    { op: 'remove', path: '/djs/0' },
                    { op: 'add', path: '/audienceUsers/3', value: { uuid: 'user-123' } },
                ],
            };
            expect( () => removedDj( message, {}, services ) ).not.toThrow();
            expect( services.dataService.setValue ).not.toHaveBeenCalled();
        } );

        it( 'should log error if escort flag clearing fails', () => {
            services.dataService.getValue.mockImplementation( () => {
                throw new Error( 'dataService error' );
            } );

            const message = {
                statePatch: [
                    { op: 'remove', path: '/djs/0' },
                    { op: 'add', path: '/audienceUsers/3', value: { uuid: 'user-123' } },
                ],
            };
            removedDj( message, {}, services );

            expect( services.logger.error ).toHaveBeenCalledWith(
                expect.stringContaining( 'error clearing escort flag' ),
                expect.any( Error )
            );
        } );

        it( 'should not throw when dataService is absent', () => {
            delete services.dataService;

            const message = {
                statePatch: [
                    { op: 'remove', path: '/djs/0' },
                    { op: 'add', path: '/audienceUsers/3', value: { uuid: 'user-123' } },
                ],
            };
            expect( () => removedDj( message, {}, services ) ).not.toThrow();
            expect( services.afkService.recordActivity ).toHaveBeenCalledWith( 'user-123', 'leftDecks' );
        } );
    } );

    describe( 'handleRemovedDjEvent (normalized handler)', () => {
        let services;

        beforeEach( () => {
            services = {
                logger: {
                    debug: jest.fn(),
                    error: jest.fn(),
                },
                afkService: {
                    recordActivity: jest.fn(),
                },
                dataService: {
                    getValue: jest.fn().mockReturnValue( {} ),
                    setValue: jest.fn(),
                },
                frameworkSpecification: { id: 'hangfm' }
            };
        } );

        it( 'should return early if no services in context', async () => {
            const event = { payload: { userId: 'user-123' } };
            const context = {};

            await handleRemovedDjEvent( event, context );
            // Should not throw
        } );

        it( 'should return early if no userId in payload', async () => {
            const event = { payload: {} };
            const context = { services };

            await handleRemovedDjEvent( event, context );

            expect( services.logger.debug ).toHaveBeenCalledWith( '[handleRemovedDjEvent] No userId in event payload' );
            expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
        } );

        it( 'should record leftDecks activity for the user', async () => {
            const event = { payload: { userId: 'user-123' } };
            const context = { services };

            await handleRemovedDjEvent( event, context );

            expect( services.afkService.recordActivity ).toHaveBeenCalledWith( 'user-123', 'leftDecks' );
        } );

        it( 'should clear escort flag when user has escortme enabled', async () => {
            const escortQueue = {
                'user-123': { markedAt: Date.now() - 5000, removeAfterCurrent: true },
                'other-user': { markedAt: Date.now() - 10000, removeAfterCurrent: false }
            };
            services.dataService.getValue.mockReturnValue( escortQueue );

            const event = { payload: { userId: 'user-123' } };
            const context = { services };

            await handleRemovedDjEvent( event, context );

            expect( services.dataService.getValue ).toHaveBeenCalledWith( 'escortQueue' );
            expect( services.dataService.setValue ).toHaveBeenCalledWith( 'escortQueue', { 'other-user': escortQueue[ 'other-user' ] } );
        } );

        it( 'should not call setValue when user has no escort flag', async () => {
            const escortQueue = { 'other-user': { markedAt: Date.now() - 10000 } };
            services.dataService.getValue.mockReturnValue( escortQueue );

            const event = { payload: { userId: 'user-456' } };
            const context = { services };

            await handleRemovedDjEvent( event, context );

            expect( services.dataService.getValue ).toHaveBeenCalled();
            expect( services.dataService.setValue ).not.toHaveBeenCalled();
        } );

        it( 'should handle missing afkService gracefully', async () => {
            const servicesWithoutAfk = { ...services, afkService: undefined };
            const event = { payload: { userId: 'user-123' } };
            const context = { services: servicesWithoutAfk };

            await handleRemovedDjEvent( event, context );

            expect( servicesWithoutAfk.dataService.getValue ).toHaveBeenCalled();
        } );

        it( 'should handle missing dataService gracefully', async () => {
            const servicesWithoutData = { ...services, dataService: undefined };
            const event = { payload: { userId: 'user-123' } };
            const context = { services: servicesWithoutData };

            await handleRemovedDjEvent( event, context );

            expect( servicesWithoutData.afkService.recordActivity ).toHaveBeenCalledWith( 'user-123', 'leftDecks' );
        } );

        it( 'should handle dataService.getValue throwing error', async () => {
            services.dataService.getValue.mockImplementation( () => {
                throw new Error( 'dataService error' );
            } );

            const event = { payload: { userId: 'user-123' } };
            const context = { services };

            await handleRemovedDjEvent( event, context );

            expect( services.logger.error ).toHaveBeenCalledWith(
                '[handleRemovedDjEvent] Error clearing escort flag for user-123: dataService error'
            );
        } );

        it( 'should work for Wavez framework', async () => {
            services.frameworkSpecification.id = 'wavezfm';
            const event = { payload: { userId: 'user-123' } };
            const context = { services };

            await handleRemovedDjEvent( event, context );

            expect( services.afkService.recordActivity ).toHaveBeenCalledWith( 'user-123', 'leftDecks' );
        } );
    } );
} );
