const updatedNextSong = require( '../../src/handlers/updatedNextSong' );

describe( 'updatedNextSong handler', () => {
    const uuid = '8074ff02-a3b7-44d2-8c21-c6f2307530f4';
    const uuid2 = 'bbbbbbbb-0000-0000-0000-000000000002';
    let services;

    // Automatic song advance: server replaces the whole nextSong object
    const makeAutoAdvanceMessage = ( djIndex = 0 ) => ( {
        statePatch: [
            { op: 'replace', path: `/visibleDjs/${ djIndex }/nextSong`, value: { songId: '123', artistName: 'U2', trackName: 'One' } },
            { op: 'replace', path: `/djs/${ djIndex }/nextSong`, value: { songId: '123', artistName: 'U2', trackName: 'One' } }
        ]
    } );

    // Manual queue update: server patches individual sub-fields within nextSong
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

    describe( 'manual queue update (field-level patches)', () => {
        test( 'records queue activity for the DJ', () => {
            updatedNextSong( makeFieldLevelMessage( 0 ), {}, services );
            expect( services.afkService.recordActivity ).toHaveBeenCalledWith( uuid, 'queue' );
        } );

        test( 'resolves the correct DJ at non-zero position', () => {
            services.stateService._getDjs.mockReturnValue( [ { uuid }, { uuid: uuid2 } ] );
            updatedNextSong( makeFieldLevelMessage( 1 ), {}, services );
            expect( services.afkService.recordActivity ).toHaveBeenCalledWith( uuid2, 'queue' );
        } );

        test( 'records activity when there is only one DJ on the decks', () => {
            services.stateService._getDjs.mockReturnValue( [ { uuid } ] );
            updatedNextSong( makeFieldLevelMessage( 0 ), {}, services );
            expect( services.afkService.recordActivity ).toHaveBeenCalledWith( uuid, 'queue' );
        } );

        test( 'logs debug and does not throw when DJ index is out of bounds', () => {
            services.stateService._getDjs.mockReturnValue( [] );
            expect( () => updatedNextSong( makeFieldLevelMessage( 0 ), {}, services ) ).not.toThrow();
            expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
            expect( services.logger.debug ).toHaveBeenCalledWith( 'updatedNextSong handler: no DJ found at index 0' );
        } );
    } );

    describe( 'automatic song advance (whole-object replace)', () => {
        test( 'does not record queue activity', () => {
            updatedNextSong( makeAutoAdvanceMessage( 0 ), {}, services );
            expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
        } );

        test( 'does not record activity even with multiple DJs', () => {
            services.stateService._getDjs.mockReturnValue( [ { uuid }, { uuid: uuid2 } ] );
            updatedNextSong( makeAutoAdvanceMessage( 0 ), {}, services );
            expect( services.afkService.recordActivity ).not.toHaveBeenCalled();
        } );
    } );

    test( 'does nothing when no /djs/N/nextSong/ patch is present', () => {
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
        expect( () => updatedNextSong( makeFieldLevelMessage( 0 ), {}, services ) ).not.toThrow();
    } );

    test( 'does nothing when stateService is absent', () => {
        delete services.stateService;
        expect( () => updatedNextSong( makeFieldLevelMessage( 0 ), {}, services ) ).not.toThrow();
    } );
} );
