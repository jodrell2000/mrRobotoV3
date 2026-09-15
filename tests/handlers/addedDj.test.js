const addedDj = require( '../../src/handlers/addedDj' );
const { handleAddedDjEvent } = require( '../../src/handlers/addedDj' );

const uuid = 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc';
const nickname = 'DJ Owner';

describe( 'addedDj handler', () => {
    let services;

    const makeMessage = ( patchUuid = uuid ) => ( {
        statePatch: [
            {
                op: 'add',
                path: '/djs/0',
                value: { uuid: patchUuid, tokenRole: 'globalModerator', canDj: true }
            }
        ]
    } );

    beforeEach( () => {
        services = {
            logger: {
                debug: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            },
            stateService: {
                _getCurrentState: jest.fn().mockReturnValue( {
                    allUserData: {
                        [ uuid ]: { userProfile: { nickname } }
                    }
                } )
            },
            afkService: {
                addUser: jest.fn(),
                recordActivity: jest.fn()
            }
        };
    } );

    test( 'should call addUser with uuid and resolved nickname', () => {
        addedDj( makeMessage(), {}, services );
        expect( services.afkService.addUser ).toHaveBeenCalledWith( uuid, nickname );
    } );

    test( 'should record joinedDecks activity', () => {
        addedDj( makeMessage(), {}, services );
        expect( services.afkService.recordActivity ).toHaveBeenCalledWith( uuid, 'joinedDecks' );
    } );

    test( 'should fall back to uuid as nickname when allUserData has no entry', () => {
        services.stateService._getCurrentState.mockReturnValue( { allUserData: {} } );
        addedDj( makeMessage(), {}, services );
        expect( services.afkService.addUser ).toHaveBeenCalledWith( uuid, uuid );
    } );

    test( 'should fall back to uuid as nickname when stateService is absent', () => {
        services.stateService = undefined;
        addedDj( makeMessage(), {}, services );
        expect( services.afkService.addUser ).toHaveBeenCalledWith( uuid, uuid );
    } );

    test( 'should do nothing when no /djs/0 add patch is present', () => {
        const message = {
            statePatch: [
                { op: 'remove', path: '/floorUsers/8' }
            ]
        };
        addedDj( message, {}, services );
        expect( services.afkService.addUser ).not.toHaveBeenCalled();
        expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
        expect( services.logger.debug ).toHaveBeenCalledWith( 'addedDj handler: no UUID found in patch' );
    } );

    test( 'should not throw if afkService is absent', () => {
        services.afkService = undefined;
        expect( () => addedDj( makeMessage(), {}, services ) ).not.toThrow();
    } );

    test( 'should not throw if statePatch is missing', () => {
        expect( () => addedDj( {}, {}, services ) ).not.toThrow();
        expect( services.afkService.addUser ).not.toHaveBeenCalled();
    } );
} );

describe( 'handleAddedDjEvent (normalized handler)', () => {
    let services;

    beforeEach( () => {
        services = {
            logger: {
                debug: jest.fn(),
                error: jest.fn()
            },
            afkService: {
                addUser: jest.fn(),
                recordActivity: jest.fn()
            },
            stateService: {
                getUser: jest.fn()
            },
            frameworkSpecification: { id: 'hangfm' }
        };
    } );

    test( 'should return early if no services in context', async () => {
        const event = { payload: { userId: uuid, nickname } };
        const context = {};

        await handleAddedDjEvent( event, context );
        // Should not throw
    } );

    test( 'should return early if no userId in payload', async () => {
        const event = { payload: { nickname } };
        const context = { services };

        await handleAddedDjEvent( event, context );

        expect( services.logger.debug ).toHaveBeenCalledWith( '[handleAddedDjEvent] No userId in event payload' );
        expect( services.afkService.addUser ).not.toHaveBeenCalled();
    } );

    test( 'should add user to AFK monitor and record joinedDecks activity', async () => {
        const event = { payload: { userId: uuid, nickname } };
        const context = { services };

        await handleAddedDjEvent( event, context );

        expect( services.afkService.addUser ).toHaveBeenCalledWith( uuid, nickname );
        expect( services.afkService.recordActivity ).toHaveBeenCalledWith( uuid, 'joinedDecks' );
    } );

    test( 'should use userId as nickname when nickname not provided', async () => {
        const event = { payload: { userId: uuid } };
        const context = { services };

        await handleAddedDjEvent( event, context );

        expect( services.afkService.addUser ).toHaveBeenCalledWith( uuid, uuid );
    } );

    test( 'should fetch nickname from stateService when not provided', async () => {
        const event = { payload: { userId: uuid } };
        services.stateService.getUser.mockReturnValue( { nickname: 'Fetched Nickname' } );
        const context = { services };

        await handleAddedDjEvent( event, context );

        expect( services.stateService.getUser ).toHaveBeenCalledWith( uuid );
        expect( services.afkService.addUser ).toHaveBeenCalledWith( uuid, 'Fetched Nickname' );
    } );

    test( 'should handle missing stateService gracefully', async () => {
        const servicesWithoutStateService = { ...services, stateService: undefined };
        const event = { payload: { userId: uuid } };
        const context = { services: servicesWithoutStateService };

        await handleAddedDjEvent( event, context );

        expect( servicesWithoutStateService.afkService.addUser ).toHaveBeenCalledWith( uuid, uuid );
    } );

    test( 'should handle missing afkService gracefully', async () => {
        const servicesWithoutAfk = { ...services, afkService: undefined };
        const event = { payload: { userId: uuid, nickname } };
        const context = { services: servicesWithoutAfk };

        await handleAddedDjEvent( event, context );

        // Should not throw
        expect( servicesWithoutAfk.logger.error ).not.toHaveBeenCalled();
    } );

    test( 'should work for Wavez framework', async () => {
        services.frameworkSpecification.id = 'wavezfm';
        const event = { payload: { userId: uuid, nickname } };
        const context = { services };

        await handleAddedDjEvent( event, context );

        expect( services.afkService.addUser ).toHaveBeenCalledWith( uuid, nickname );
        expect( services.afkService.recordActivity ).toHaveBeenCalledWith( uuid, 'joinedDecks' );
    } );
} );
