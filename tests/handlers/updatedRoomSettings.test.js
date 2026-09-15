'use strict';

const updatedRoomSettings = require( '../../src/handlers/updatedRoomSettings' );
const { handleUpdatedRoomSettingsEvent } = require( '../../src/handlers/updatedRoomSettings' );

describe( 'updatedRoomSettings handler', () => {
    let services;

    beforeEach( () => {
        services = {
            logger: {
                debug: jest.fn(),
                info: jest.fn(),
                error: jest.fn()
            },
            stateService: {
                getHangoutName: jest.fn().mockReturnValue( 'Test Room' ),
                getRoomSettings: jest.fn().mockReturnValue( { name: 'Test Room', description: 'Test Description' } )
            },
            eventDispatcher: {
                dispatch: jest.fn()
            }
        };
    } );

    test( 'should handle empty message gracefully', () => {
        expect( () => updatedRoomSettings( {}, {}, services ) ).not.toThrow();
        expect( services.logger.debug ).toHaveBeenCalledWith( 'updatedRoomSettings.js handler called' );
    } );

    test( 'should log room name change when settings/name patch is present', () => {
        const newRoomName = 'New Room Name';
        const message = {
            statePatch: [
                { op: 'replace', path: '/settings/name', value: newRoomName }
            ]
        };
        updatedRoomSettings( message, {}, services );

        expect( services.logger.info ).toHaveBeenCalledWith( `🏠 Room name updated to: "${ newRoomName }"` );
    } );

    test( 'should log other settings changes', () => {
        const message = {
            statePatch: [
                { op: 'replace', path: '/settings/name', value: 'New Name' },
                { op: 'replace', path: '/settings/someOtherSetting', value: 'newValue' }
            ]
        };
        updatedRoomSettings( message, {}, services );

        expect( services.logger.debug ).toHaveBeenCalledWith( 'Other room settings updated: /settings/someOtherSetting' );
    } );

    test( 'should emit normalized event when eventDispatcher is available', () => {
        const message = {
            statePatch: [
                { op: 'replace', path: '/settings/name', value: 'New Name' }
            ]
        };
        updatedRoomSettings( message, {}, services );

        expect( services.eventDispatcher.dispatch ).toHaveBeenCalledWith(
            expect.objectContaining( {
                type: 'roomSettingsChanged',
                source: 'hangfm'
            } ),
            expect.any( Object )
        );
    } );

    test( 'should not throw if eventDispatcher is not available', () => {
        const servicesWithoutDispatcher = { ...services, eventDispatcher: undefined };
        const message = {
            statePatch: [
                { op: 'replace', path: '/settings/name', value: 'New Name' }
            ]
        };
        expect( () => updatedRoomSettings( message, {}, servicesWithoutDispatcher ) ).not.toThrow();
    } );
} );

describe( 'handleUpdatedRoomSettingsEvent (normalized handler)', () => {
    let services;

    beforeEach( () => {
        services = {
            logger: {
                debug: jest.fn(),
                info: jest.fn(),
                error: jest.fn()
            },
            stateService: {
                getHangoutName: jest.fn().mockReturnValue( 'State Room Name' ),
                getRoomSettings: jest.fn()
            },
            frameworkSpecification: { id: 'hangfm' }
        };
    } );

    test( 'should return early if no services in context', async () => {
        const event = { payload: { roomSettings: { name: 'Test' } } };
        const context = {};

        await handleUpdatedRoomSettingsEvent( event, context );
    } );

    test( 'should return early if no roomSettings in payload', async () => {
        const event = { payload: {} };
        const context = { services };

        await handleUpdatedRoomSettingsEvent( event, context );

        expect( services.logger.debug ).toHaveBeenCalledWith( '[handleUpdatedRoomSettingsEvent] No roomSettings in event payload' );
    } );

    test( 'should log room name change when name is present', async () => {
        const event = {
            payload: {
                roomSettings: {
                    name: 'New Room Name',
                    description: 'A description'
                }
            }
        };
        const context = { services };

        await handleUpdatedRoomSettingsEvent( event, context );

        expect( services.logger.info ).toHaveBeenCalledWith( '🏠 Room name updated to: "New Room Name"' );
    } );

    test( 'should log stateService name verification', async () => {
        const event = {
            payload: {
                roomSettings: {
                    name: 'New Room Name'
                }
            }
        };
        const context = { services };

        await handleUpdatedRoomSettingsEvent( event, context );

        expect( services.stateService.getHangoutName ).toHaveBeenCalled();
        expect( services.logger.info ).toHaveBeenCalledWith( '✅ StateService now reads room name as: "State Room Name"' );
    } );

    test( 'should log other settings changes', async () => {
        const event = {
            payload: {
                roomSettings: {
                    name: 'New Name',
                    queueLocked: true,
                    allowExternalMediaEmbeds: false
                }
            }
        };
        const context = { services };

        await handleUpdatedRoomSettingsEvent( event, context );

        expect( services.logger.debug ).toHaveBeenCalledWith( 'Other room settings updated: queueLocked, allowExternalMediaEmbeds' );
    } );

    test( 'should handle missing stateService gracefully', async () => {
        const servicesWithoutStateService = { ...services, stateService: undefined };
        const event = {
            payload: {
                roomSettings: {
                    name: 'New Name'
                }
            }
        };
        const context = { services: servicesWithoutStateService };

        await handleUpdatedRoomSettingsEvent( event, context );

        expect( servicesWithoutStateService.logger.info ).toHaveBeenCalledWith( '🏠 Room name updated to: "New Name"' );
    } );

    test( 'should work for Wavez framework', async () => {
        services.frameworkSpecification.id = 'wavezfm';
        const event = {
            payload: {
                roomSettings: {
                    name: 'Wavez Room Name',
                    description: 'Wavez Description'
                }
            }
        };
        const context = { services };

        await handleUpdatedRoomSettingsEvent( event, context );

        expect( services.logger.info ).toHaveBeenCalledWith( '🏠 Room name updated to: "Wavez Room Name"' );
    } );

    test( 'should not log stateService verification when getHangoutName returns undefined', async () => {
        services.stateService.getHangoutName.mockReturnValue( undefined );
        const event = {
            payload: {
                roomSettings: {
                    name: 'New Name'
                }
            }
        };
        const context = { services };

        await handleUpdatedRoomSettingsEvent( event, context );

        expect( services.logger.info ).toHaveBeenCalledWith( '🏠 Room name updated to: "New Name"' );
        expect( services.logger.info ).not.toHaveBeenCalledWith( expect.stringContaining( 'StateService now reads' ) );
    } );
} );
