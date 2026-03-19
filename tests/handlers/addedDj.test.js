const addedDj = require( '../../src/handlers/addedDj' );

describe( 'addedDj handler', () => {
    let services;
    const uuid = 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc';
    const nickname = 'DJ Owner';

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
