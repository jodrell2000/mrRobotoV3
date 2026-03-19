const updatedNextSong = require( '../../src/handlers/updatedNextSong' );

describe( 'updatedNextSong handler', () => {
    const uuid = '8074ff02-a3b7-44d2-8c21-c6f2307530f4';
    let services;

    const makeMessage = ( djIndex = 0, op = 'replace' ) => ( {
        statePatch: [
            { op, path: `/visibleDjs/${ djIndex }/nextSong`, value: { songId: '123', artistName: 'U2', trackName: 'One' } },
            { op, path: `/djs/${ djIndex }/nextSong`, value: { songId: '123', artistName: 'U2', trackName: 'One' } }
        ]
    } );

    const makeFieldLevelMessage = ( djIndex = 0 ) => ( {
        statePatch: [
            { op: 'replace', path: `/djs/${ djIndex }/nextSong/songId`, value: '999' },
            { op: 'replace', path: `/djs/${ djIndex }/nextSong/artistName`, value: 'Fatboy Slim' },
            { op: 'replace', path: `/djs/${ djIndex }/nextSong/trackName`, value: 'Right Here, Right Now' }
        ]
    } );

    beforeEach( () => {
        services = {
            logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
            stateService: {
                _getDjs: jest.fn().mockReturnValue( [ { uuid } ] )
            },
            afkService: {
                recordActivity: jest.fn()
            }
        };
    } );

    test( 'records queue activity for the DJ who updated their next song', () => {
        updatedNextSong( makeMessage( 0 ), {}, services );
        expect( services.afkService.recordActivity ).toHaveBeenCalledWith( uuid, 'queue' );
    } );

    test( 'records queue activity when DJ sets a song for the first time (add op)', () => {
        updatedNextSong( makeMessage( 0, 'add' ), {}, services );
        expect( services.afkService.recordActivity ).toHaveBeenCalledWith( uuid, 'queue' );
    } );

    test( 'records queue activity from field-level patches (e.g. song change)', () => {
        updatedNextSong( makeFieldLevelMessage( 0 ), {}, services );
        expect( services.afkService.recordActivity ).toHaveBeenCalledWith( uuid, 'queue' );
    } );

    test( 'resolves the correct DJ when position is non-zero', () => {
        const uuid2 = 'bbbbbbbb-0000-0000-0000-000000000002';
        services.stateService._getDjs.mockReturnValue( [
            { uuid },
            { uuid: uuid2 }
        ] );
        updatedNextSong( makeMessage( 1 ), {}, services );
        expect( services.afkService.recordActivity ).toHaveBeenCalledWith( uuid2, 'queue' );
    } );

    test( 'resolves the correct DJ from field-level patches at non-zero position', () => {
        const uuid2 = 'bbbbbbbb-0000-0000-0000-000000000002';
        services.stateService._getDjs.mockReturnValue( [
            { uuid },
            { uuid: uuid2 }
        ] );
        updatedNextSong( makeFieldLevelMessage( 1 ), {}, services );
        expect( services.afkService.recordActivity ).toHaveBeenCalledWith( uuid2, 'queue' );
    } );

    test( 'logs debug and does not throw when DJ index is out of bounds', () => {
        services.stateService._getDjs.mockReturnValue( [] );
        expect( () => updatedNextSong( makeMessage( 0 ), {}, services ) ).not.toThrow();
        expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
        expect( services.logger.debug ).toHaveBeenCalledWith( 'updatedNextSong handler: no DJ found at index 0' );
    } );

    test( 'does nothing when no /djs/N/ patch is present', () => {
        const message = {
            statePatch: [
                { op: 'replace', path: '/voteCounts/likes', value: 5 }
            ]
        };
        updatedNextSong( message, {}, services );
        expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
    } );

    test( 'does nothing when afkService is absent', () => {
        delete services.afkService;
        expect( () => updatedNextSong( makeMessage( 0 ), {}, services ) ).not.toThrow();
    } );

    test( 'does nothing when stateService is absent', () => {
        delete services.stateService;
        expect( () => updatedNextSong( makeMessage( 0 ), {}, services ) ).not.toThrow();
    } );
} );
