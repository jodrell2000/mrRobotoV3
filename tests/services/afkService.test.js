const AfkService = require( '../../src/services/afkService' );

describe( 'AfkService', () => {
    let afkService;

    beforeEach( () => {
        afkService = new AfkService();
    } );

    describe( 'ACTIVITY_TYPES', () => {
        it( 'should export activity type constants', () => {
            expect( AfkService.ACTIVITY_TYPES ).toEqual( {
                CHAT: 'chat',
                EMOJI: 'emoji',
                JOINED_DECKS: 'joinedDecks',
                LEFT_DECKS: 'leftDecks',
                JOINED_ROOM: 'joinedRoom',
                VOTE: 'vote',
                QUEUE: 'queue',
            } );
        } );
    } );

    describe( 'addUser', () => {
        it( 'should add a new entry with all activity types undefined', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            const snapshot = afkService.getActivitySnapshot();
            expect( snapshot ).toHaveLength( 1 );
            const entry = snapshot[ 0 ];
            expect( entry.uuid ).toBe( 'uuid-1' );
            expect( entry.nickname ).toBe( 'DJ Cool' );
            expect( entry.mostRecent ).toBeUndefined();
            expect( entry.warningLevel ).toBe( 0 );
            expect( entry.activity.chat ).toBeUndefined();
            expect( entry.activity.emoji ).toBeUndefined();
            expect( entry.activity.joinedDecks ).toBeUndefined();
            expect( entry.activity.leftDecks ).toBeUndefined();
            expect( entry.activity.joinedRoom ).toBeUndefined();
        } );

        it( 'should update nickname if the user already exists', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.recordActivity( 'uuid-1', 'chat' );
            afkService.addUser( 'uuid-1', 'DJ Cooler' );
            const entry = afkService.getActivitySnapshot()[ 0 ];
            expect( entry.nickname ).toBe( 'DJ Cooler' );
            expect( entry.activity.chat ).toBeInstanceOf( Date );
        } );

        it( 'should not overwrite existing activity timestamps on duplicate addUser', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.recordActivity( 'uuid-1', 'chat' );
            const before = afkService.getActivitySnapshot()[ 0 ].activity.chat;
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            const after = afkService.getActivitySnapshot()[ 0 ].activity.chat;
            expect( after ).toEqual( before );
        } );
    } );

    describe( 'removeUser', () => {
        it( 'should remove the entry', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.removeUser( 'uuid-1' );
            expect( afkService.getActivitySnapshot() ).toHaveLength( 0 );
        } );

        it( 'should be a no-op for an unknown UUID', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.removeUser( 'uuid-unknown' );
            expect( afkService.getActivitySnapshot() ).toHaveLength( 1 );
        } );
    } );

    describe( 'recordActivity', () => {
        it( 'should stamp the correct activity type', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.recordActivity( 'uuid-1', 'chat' );
            const entry = afkService.getActivitySnapshot()[ 0 ];
            expect( entry.activity.chat ).toBeInstanceOf( Date );
        } );

        it( 'should update mostRecent to match the stamped activity', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.recordActivity( 'uuid-1', 'chat' );
            const entry = afkService.getActivitySnapshot()[ 0 ];
            expect( entry.mostRecent ).toBeInstanceOf( Date );
            expect( entry.mostRecent ).toEqual( entry.activity.chat );
        } );

        it( 'should not affect other activity type timestamps', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.recordActivity( 'uuid-1', 'chat' );
            const entry = afkService.getActivitySnapshot()[ 0 ];
            expect( entry.activity.emoji ).toBeUndefined();
            expect( entry.activity.joinedDecks ).toBeUndefined();
            expect( entry.activity.leftDecks ).toBeUndefined();
            expect( entry.activity.joinedRoom ).toBeUndefined();
        } );

        it( 'should be a no-op for an unknown UUID', () => {
            afkService.recordActivity( 'uuid-unknown', 'chat' );
            expect( afkService.getActivitySnapshot() ).toHaveLength( 0 );
        } );

        it( 'should reset warningLevel to 0', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.activityMap.get( 'uuid-1' ).warningLevel = 2;
            afkService.recordActivity( 'uuid-1', 'chat' );
            expect( afkService.getActivitySnapshot()[ 0 ].warningLevel ).toBe( 0 );
        } );

        it( 'mostRecent should equal the most recently stamped activity timestamp', () => {
            jest.useFakeTimers();
            afkService.addUser( 'uuid-1', 'DJ Cool' );

            jest.setSystemTime( new Date( '2026-01-01T12:00:00Z' ) );
            afkService.recordActivity( 'uuid-1', 'chat' );
            const chatTime = afkService.getActivitySnapshot()[ 0 ].activity.chat;

            jest.setSystemTime( new Date( '2026-01-01T12:05:00Z' ) );
            afkService.recordActivity( 'uuid-1', 'emoji' );
            const emojiTime = afkService.getActivitySnapshot()[ 0 ].activity.emoji;

            const entry = afkService.getActivitySnapshot()[ 0 ];
            expect( entry.mostRecent ).toEqual( emojiTime );
            expect( entry.activity.chat ).toEqual( chatTime );

            jest.useRealTimers();
        } );
    } );

    describe( 'getInactiveUsers', () => {
        it( 'should return users whose mostRecent exceeds the threshold', () => {
            jest.useFakeTimers();
            afkService.addUser( 'uuid-1', 'DJ Cool' );

            jest.setSystemTime( new Date( '2026-01-01T12:00:00Z' ) );
            afkService.recordActivity( 'uuid-1', 'chat' );

            jest.setSystemTime( new Date( '2026-01-01T12:10:00Z' ) );
            const result = afkService.getInactiveUsers( 5 * 60 * 1000 );

            expect( result ).toHaveLength( 1 );
            expect( result[ 0 ].uuid ).toBe( 'uuid-1' );
            expect( result[ 0 ].nickname ).toBe( 'DJ Cool' );
            expect( result[ 0 ].inactiveMs ).toBe( 10 * 60 * 1000 );

            jest.useRealTimers();
        } );

        it( 'should not return users below the threshold', () => {
            jest.useFakeTimers();
            afkService.addUser( 'uuid-1', 'DJ Cool' );

            jest.setSystemTime( new Date( '2026-01-01T12:00:00Z' ) );
            afkService.recordActivity( 'uuid-1', 'chat' );

            jest.setSystemTime( new Date( '2026-01-01T12:03:00Z' ) );
            const result = afkService.getInactiveUsers( 5 * 60 * 1000 );

            expect( result ).toHaveLength( 0 );

            jest.useRealTimers();
        } );

        it( 'should skip users with no mostRecent', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            const result = afkService.getInactiveUsers( 0 );
            expect( result ).toHaveLength( 0 );
        } );

        it( 'should compare against mostRecent, not individual activity types', () => {
            jest.useFakeTimers();
            afkService.addUser( 'uuid-1', 'DJ Cool' );

            jest.setSystemTime( new Date( '2026-01-01T12:00:00Z' ) );
            afkService.recordActivity( 'uuid-1', 'chat' );

            jest.setSystemTime( new Date( '2026-01-01T12:08:00Z' ) );
            afkService.recordActivity( 'uuid-1', 'emoji' );

            jest.setSystemTime( new Date( '2026-01-01T12:10:00Z' ) );
            const result = afkService.getInactiveUsers( 5 * 60 * 1000 );

            expect( result ).toHaveLength( 0 );

            jest.useRealTimers();
        } );
    } );

    describe( 'getActivitySnapshot', () => {
        it( 'should return all entries with the per-type activity breakdown', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.addUser( 'uuid-2', 'DJ Sonic' );
            afkService.recordActivity( 'uuid-1', 'chat' );

            const snapshot = afkService.getActivitySnapshot();
            expect( snapshot ).toHaveLength( 2 );

            const dj1 = snapshot.find( e => e.uuid === 'uuid-1' );
            expect( dj1.activity ).toBeDefined();
            expect( dj1.activity.chat ).toBeInstanceOf( Date );
        } );

        it( 'should return an empty array when no users are tracked', () => {
            expect( afkService.getActivitySnapshot() ).toEqual( [] );
        } );
    } );

    describe( 'clear', () => {
        it( 'should empty the map', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.addUser( 'uuid-2', 'DJ Sonic' );
            afkService.clear();
            expect( afkService.getActivitySnapshot() ).toHaveLength( 0 );
        } );
    } );

    describe( 'setWarningLevel', () => {
        it( 'should set the warningLevel for a known UUID', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.setWarningLevel( 'uuid-1', 2 );
            expect( afkService.getActivitySnapshot()[ 0 ].warningLevel ).toBe( 2 );
        } );

        it( 'should be a no-op for an unknown UUID', () => {
            expect( () => afkService.setWarningLevel( 'uuid-unknown', 1 ) ).not.toThrow();
        } );
    } );

    describe( 'setExempt / clearExempt / isExempt', () => {
        it( 'isExempt returns false for an untracked user', () => {
            expect( afkService.isExempt( 'uuid-ghost' ) ).toBe( false );
        } );

        it( 'setExempt marks a user as exempt', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.setExempt( 'uuid-1' );
            expect( afkService.isExempt( 'uuid-1' ) ).toBe( true );
        } );

        it( 'clearExempt removes the exempt flag', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.setExempt( 'uuid-1' );
            afkService.clearExempt( 'uuid-1' );
            expect( afkService.isExempt( 'uuid-1' ) ).toBe( false );
        } );

        it( 'getActivitySnapshot includes exempted field', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.addUser( 'uuid-2', 'DJ Sonic' );
            afkService.setExempt( 'uuid-1' );

            const snapshot = afkService.getActivitySnapshot();
            const dj1 = snapshot.find( e => e.uuid === 'uuid-1' );
            const dj2 = snapshot.find( e => e.uuid === 'uuid-2' );
            expect( dj1.exempted ).toBe( true );
            expect( dj2.exempted ).toBe( false );
        } );
    } );

    describe( 'resetActivity', () => {
        it( 'resets mostRecent and warningLevel', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.recordActivity( 'uuid-1', 'chat' );
            afkService.setWarningLevel( 'uuid-1', 3 );

            const before = afkService.getActivitySnapshot()[ 0 ].mostRecent;
            afkService.resetActivity( 'uuid-1' );
            const after = afkService.getActivitySnapshot()[ 0 ];

            expect( after.warningLevel ).toBe( 0 );
            expect( after.mostRecent.getTime() ).toBeGreaterThanOrEqual( before.getTime() );
        } );

        it( 'clears the exempt flag on reset', () => {
            afkService.addUser( 'uuid-1', 'DJ Cool' );
            afkService.setExempt( 'uuid-1' );
            afkService.resetActivity( 'uuid-1' );
            expect( afkService.isExempt( 'uuid-1' ) ).toBe( false );
        } );

        it( 'is a no-op for an unknown UUID', () => {
            expect( () => afkService.resetActivity( 'uuid-ghost' ) ).not.toThrow();
        } );
    } );
} );
