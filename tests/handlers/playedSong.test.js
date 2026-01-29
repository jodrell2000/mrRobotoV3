const playedSong = require( '../../src/handlers/playedSong' );

jest.useFakeTimers();

describe( 'playedSong handler', () => {
  let services;

  beforeEach( () => {
    // Clear global state
    global.previousPlayedSong = null;

    services = {
      logger: { debug: jest.fn(), error: jest.fn(), info: jest.fn() },
      hangSocketServices: { upVote: jest.fn().mockResolvedValue() },
      hangoutState: {},
      socket: { id: 'socket1' },
      messageService: {
        formatMention: jest.fn().mockImplementation( ( uuid ) => `<@uid:${ uuid }>` ),
        sendGroupMessage: jest.fn().mockResolvedValue()
      },
      dataService: {
        getValue: jest.fn().mockImplementation( ( key ) => {
          if ( key === 'nowPlayingMessage' ) {
            return '{username} is now playing {trackName} by {artistName}';
          }
          if ( key === 'justPlayedMessage' ) {
            return '{username} played {trackName} by {artistName} 👍{likes} 👎{dislikes} ⭐{stars}';
          }
          return null;
        } )
      },
      featuresService: {
        isFeatureEnabled: jest.fn().mockReturnValue( true ) // Default to enabled for existing tests
      }
    };
    global.playedSongTimer = null;
  } );

  afterEach( () => {
    if ( global.playedSongTimer ) {
      clearTimeout( global.playedSongTimer );
      global.playedSongTimer = null;
    }
    jest.clearAllTimers();
  } );

  test( 'starts timer and calls upVote after 90s if nowPlaying is not null', async () => {
    services.hangoutState.nowPlaying = { song: 'test' };
    playedSong( {}, {}, services );
    expect( global.playedSongTimer ).not.toBeNull();
    jest.advanceTimersByTime( 90000 );
    // Wait for async upVote
    await Promise.resolve();
    expect( services.hangSocketServices.upVote ).toHaveBeenCalledWith( services.socket );
  } );

  test( 'cancels existing timer and starts new one if nowPlaying is not null', () => {
    services.hangoutState.nowPlaying = { song: 'test' };
    playedSong( {}, {}, services );
    const firstTimer = global.playedSongTimer;
    playedSong( {}, {}, services );
    expect( global.playedSongTimer ).not.toBe( firstTimer );
  } );

  test( 'cancels timer and does not start new one if nowPlaying is null', () => {
    services.hangoutState.nowPlaying = { song: 'test' };
    playedSong( {}, {}, services );
    expect( global.playedSongTimer ).not.toBeNull();
    services.hangoutState.nowPlaying = null;
    playedSong( {}, {}, services );
    expect( global.playedSongTimer ).toBeNull();
  } );

  test( 'should announce new song when all song info is present', async () => {
    const message = {
      statePatch: [
        {
          op: 'replace',
          path: '/djs/0/uuid',
          value: 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/artistName',
          value: 'Billy Idol'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/trackName',
          value: 'Cradle Of Love'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/songShortId',
          value: 'song-123'
        }
      ]
    };

    services.hangoutState.nowPlaying = { song: 'test' };
    await playedSong( message, {}, services );

    expect( services.messageService.formatMention ).toHaveBeenCalledWith( 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc' );
    expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
      '<@uid:f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc> is now playing Cradle Of Love by Billy Idol',
      { services }
    );
  } );

  test( 'should not announce song when song info is incomplete', async () => {
    const message = {
      statePatch: [
        {
          op: 'replace',
          path: '/djs/0/uuid',
          value: 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/artistName',
          value: 'Billy Idol'
        }
        // Missing trackName
      ]
    };

    services.hangoutState.nowPlaying = { song: 'test' };
    playedSong( message, {}, services );

    // Wait for potential async announcement
    await Promise.resolve();

    expect( services.messageService.sendGroupMessage ).not.toHaveBeenCalled();
  } );

  test( 'should handle announcement errors gracefully', async () => {
    const message = {
      statePatch: [
        {
          op: 'replace',
          path: '/djs/0/uuid',
          value: 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/artistName',
          value: 'Billy Idol'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/trackName',
          value: 'Cradle Of Love'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/songShortId',
          value: 'song-123'
        }
      ]
    };

    services.messageService.sendGroupMessage.mockRejectedValueOnce( new Error( 'Network error' ) );
    services.hangoutState.nowPlaying = { song: 'test' };

    await playedSong( message, {}, services );

    // Wait for async announcement and error handling
    await Promise.resolve();
    await Promise.resolve();

    expect( services.logger.error ).toHaveBeenCalledWith( 'Failed to announce song: Network error' );
    // Timer should still work despite announcement error
    expect( global.playedSongTimer ).not.toBeNull();
  } );

  test( 'should use custom template from dataService', async () => {
    // Override the dataService mock to return a custom template
    services.dataService.getValue.mockImplementation( ( key ) => {
      if ( key === 'nowPlayingMessage' ) {
        return '🎵 {username} just started {trackName} by {artistName} 🎵';
      }
      return null;
    } );

    const message = {
      statePatch: [
        {
          op: 'replace',
          path: '/djs/0/uuid',
          value: 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/artistName',
          value: 'Billy Idol'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/trackName',
          value: 'Cradle Of Love'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/songShortId',
          value: 'song-123'
        }
      ]
    };

    services.hangoutState.nowPlaying = { song: 'test' };
    await playedSong( message, {}, services );

    // Wait for async announcement
    await Promise.resolve();

    expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
      '🎵 <@uid:f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc> just started Cradle Of Love by Billy Idol 🎵',
      { services }
    );
  } );

  test( 'should use default template when dataService returns null', async () => {
    // Override the dataService mock to return null
    services.dataService.getValue.mockReturnValue( null );

    const message = {
      statePatch: [
        {
          op: 'replace',
          path: '/djs/0/uuid',
          value: 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/artistName',
          value: 'Billy Idol'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/trackName',
          value: 'Cradle Of Love'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/songShortId',
          value: 'song-123'
        }
      ]
    };

    services.hangoutState.nowPlaying = { song: 'test' };
    await playedSong( message, {}, services );

    // Wait for async announcement
    await Promise.resolve();

    expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
      '<@uid:f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc> is now playing Cradle Of Love by Billy Idol',
      { services }
    );
  } );

  test( 'should fallback to full state for DJ UUID when not in patch', async () => {
    // Set up full state with DJ UUID but patch without DJ UUID
    services.hangoutState.djs = [
      { uuid: 'a5e09ebd-ceb5-46b6-b962-52754e32840d' }
    ];

    const message = {
      statePatch: [
        // No DJ UUID patch - simulating single DJ scenario
        {
          op: 'replace',
          path: '/nowPlaying/song/artistName',
          value: 'Queen'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/trackName',
          value: 'Another One Bites The Dust (Remastered 2011)'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/songShortId',
          value: 'song-123'
        }
      ]
    };

    services.hangoutState.nowPlaying = { song: 'test' };
    await playedSong( message, {}, services );

    // Wait for async announcement
    await Promise.resolve();

    expect( services.messageService.formatMention ).toHaveBeenCalledWith( 'a5e09ebd-ceb5-46b6-b962-52754e32840d' );
    expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
      '<@uid:a5e09ebd-ceb5-46b6-b962-52754e32840d> is now playing Another One Bites The Dust (Remastered 2011) by Queen',
      { services }
    );
  } );

  test( 'should extract song info from full nowPlaying object replacement', async () => {
    // Set up full state with DJ UUID
    services.hangoutState.djs = [
      { uuid: 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc' }
    ];

    const message = {
      statePatch: [
        {
          op: 'replace',
          path: '/nowPlaying',
          value: {
            song: {
              songId: '28015388',
              crateSongUuid: '765af0f4-6a39-415c-b8fc-f0d4b4312cb6',
              artistName: 'The Cure',
              trackName: 'Killing An Arab (Live)',
              songShortId: 'song-123',
              musicProviders: {
                sevenDigital: '91860310'
              },
              duration: 265
            },
            startTime: 1759778175655,
            endTime: 1759778440655,
            playId: '27272588-f3a8-4a40-bb4e-9cd6b73566e8'
          }
        }
      ]
    };

    services.hangoutState.nowPlaying = { song: 'test' };
    await playedSong( message, {}, services );

    // Wait for async announcement
    await Promise.resolve();

    expect( services.messageService.formatMention ).toHaveBeenCalledWith( 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc' );
    expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
      '<@uid:f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc> is now playing Killing An Arab (Live) by The Cure',
      { services }
    );
  } );

  test( 'should not announce song when nowPlayingMessage feature is disabled', async () => {
    // Mock feature as disabled
    services.featuresService.isFeatureEnabled.mockReturnValue( false );

    const message = {
      statePatch: [
        {
          op: 'replace',
          path: '/djs/0/uuid',
          value: 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/artistName',
          value: 'Billy Idol'
        },
        {
          op: 'replace',
          path: '/nowPlaying/song/trackName',
          value: 'Cradle Of Love'
        }
      ]
    };

    services.hangoutState.nowPlaying = { song: 'test' };
    playedSong( message, {}, services );

    // Wait for potential async announcement
    await Promise.resolve();

    // Should check if feature is enabled
    expect( services.featuresService.isFeatureEnabled ).toHaveBeenCalledWith( 'nowPlayingMessage' );

    // Should not send any messages when feature is disabled
    expect( services.messageService.formatMention ).not.toHaveBeenCalled();
    expect( services.messageService.sendGroupMessage ).not.toHaveBeenCalled();

    // Timer should still work regardless of feature status
    expect( global.playedSongTimer ).not.toBeNull();
  } );

  describe( 'justPlayed functionality', () => {
    beforeEach( () => {
      // Mock previous song in hangout state
      services.hangoutState = {
        nowPlaying: {
          song: {
            artistName: 'Previous Artist',
            trackName: 'Previous Track'
          }
        },
        djs: [ { uuid: 'dj-uuid-123' } ],
        voteCounts: { likes: 5, dislikes: 2, stars: 1 }
      };
    } );

    test( 'should announce just played song when feature is enabled', async () => {
      // Store a previous song that was playing
      global.previousPlayedSong = {
        djUuid: 'dj-uuid-123',
        artistName: 'Previous Artist',
        trackName: 'Previous Track',
        voteCounts: { likes: 5, dislikes: 2, stars: 1 }
      };

      services.featuresService.isFeatureEnabled.mockImplementation( ( feature ) => {
        if ( feature === 'justPlayed' ) return true;
        if ( feature === 'nowPlayingMessage' ) return false; // Disable other announcements for clarity
        return false;
      } );

      services.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'justPlayedMessage' ) {
          return '{username} played {trackName} by {artistName} 👍{likes} 👎{dislikes} ⭐{stars}';
        }
        return null;
      } );

      services.hangoutState = {
        nowPlaying: {
          song: {
            artistName: 'New Artist',
            trackName: 'New Track',
            songShortId: 'song-123'
          }
        },
        djs: [ { uuid: 'new-dj-uuid-456' } ],
        voteCounts: { likes: 3, dislikes: 1, stars: 0 }
      };

      const message = {
        statePatch: [
          { op: 'replace', path: '/nowPlaying', value: { song: { artistName: 'New Artist', trackName: 'New Track', songShortId: 'song-123' } } }
        ]
      };

      await playedSong( message, {}, services );

      // Wait for async announcement
      await Promise.resolve();

      expect( services.messageService.formatMention ).toHaveBeenCalledWith( 'dj-uuid-123' );
      expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
        '<@uid:dj-uuid-123> played Previous Track by Previous Artist 👍5 👎2 ⭐1',
        { services }
      );
    } );

    test( 'should not announce just played song when feature is disabled', async () => {
      services.featuresService.isFeatureEnabled.mockImplementation( ( feature ) => {
        if ( feature === 'justPlayed' ) return false;
        if ( feature === 'nowPlayingMessage' ) return false;
        return false;
      } );

      const message = {
        statePatch: [
          { op: 'replace', path: '/nowPlaying', value: { song: { artistName: 'New Artist', trackName: 'New Track', songShortId: 'song-123' } } }
        ]
      };

      await playedSong( message, {}, services );

      // Should not call any message functions
      expect( services.messageService.formatMention ).not.toHaveBeenCalled();
      expect( services.messageService.sendGroupMessage ).not.toHaveBeenCalled();
    } );

    test( 'should use default template when justPlayedMessage is not configured', async () => {
      // Store a previous song that was playing
      global.previousPlayedSong = {
        djUuid: 'dj-uuid-123',
        artistName: 'Previous Artist',
        trackName: 'Previous Track',
        voteCounts: { likes: 5, dislikes: 2, stars: 1 }
      };

      services.featuresService.isFeatureEnabled.mockImplementation( ( feature ) => {
        if ( feature === 'justPlayed' ) return true;
        if ( feature === 'nowPlayingMessage' ) return false;
        return false;
      } );

      services.dataService.getValue.mockReturnValue( null ); // No custom template

      services.hangoutState = {
        nowPlaying: {
          song: {
            artistName: 'New Artist',
            trackName: 'New Track',
            songShortId: 'song-123'
          }
        },
        djs: [ { uuid: 'new-dj-uuid-456' } ],
        voteCounts: { likes: 3, dislikes: 1, stars: 0 }
      };

      const message = {
        statePatch: [
          { op: 'replace', path: '/nowPlaying', value: { song: { artistName: 'New Artist', trackName: 'New Track', songShortId: 'song-123' } } }
        ]
      };

      await playedSong( message, {}, services );

      expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
        '<@uid:dj-uuid-123> played...\n      Previous Track by Previous Artist\n      Stats: 👍 5 👎 2 ❤️ 1',
        { services }
      );
    } );

    test( 'should handle missing vote counts gracefully', async () => {
      // Store a previous song that was playing (with no vote counts stored)
      global.previousPlayedSong = {
        djUuid: 'dj-uuid-123',
        artistName: 'Previous Artist',
        trackName: 'Previous Track'
        // No voteCounts property - this tests the graceful handling
      };

      services.hangoutState = {
        nowPlaying: {
          song: {
            artistName: 'New Artist',
            trackName: 'New Track',
            songShortId: 'song-123'
          }
        },
        djs: [ { uuid: 'new-dj-uuid-456' } ],
        voteCounts: null // No vote counts in hangout state either
      };

      services.featuresService.isFeatureEnabled.mockImplementation( ( feature ) => {
        if ( feature === 'justPlayed' ) return true;
        if ( feature === 'nowPlayingMessage' ) return false;
        return false;
      } );

      const message = {
        statePatch: [
          { op: 'replace', path: '/nowPlaying', value: { song: { artistName: 'New Artist', trackName: 'New Track', songShortId: 'song-123' } } }
        ]
      };

      await playedSong( message, {}, services );

      expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
        '<@uid:dj-uuid-123> played Previous Track by Previous Artist 👍0 👎0 ⭐0',
        { services }
      );
    } );

    test( 'should not announce just played when no previous song data exists', async () => {
      services.hangoutState.nowPlaying = null; // No previous song
      services.featuresService.isFeatureEnabled.mockImplementation( ( feature ) => {
        if ( feature === 'justPlayed' ) return true;
        if ( feature === 'nowPlayingMessage' ) return false;
        return false;
      } );

      const message = {
        statePatch: [
          { op: 'replace', path: '/nowPlaying', value: { song: { artistName: 'New Artist', trackName: 'New Track', songShortId: 'song-123' } } }
        ]
      };

      await playedSong( message, {}, services );

      // Should not call message functions since there's no previous song
      expect( services.messageService.formatMention ).not.toHaveBeenCalled();
      expect( services.messageService.sendGroupMessage ).not.toHaveBeenCalled();
    } );

    test( 'should not announce just played when song starts playing (same song)', async () => {
      // Set up scenario where the same song is just starting to play
      services.hangoutState = {
        nowPlaying: null, // No song was playing before
        djs: [ { uuid: 'dj-uuid-123' } ],
        voteCounts: { likes: 0, dislikes: 0, stars: 0 }
      };

      services.featuresService.isFeatureEnabled.mockImplementation( ( feature ) => {
        if ( feature === 'justPlayed' ) return true;
        if ( feature === 'nowPlayingMessage' ) return false;
        return false;
      } );

      const message = {
        statePatch: [
          {
            op: 'replace',
            path: '/nowPlaying',
            value: {
              song: {
                artistName: 'The Sundays',
                trackName: "Here's Where The Story Ends",
                songShortId: 'song-123'
              }
            }
          }
        ]
      };

      await playedSong( message, {}, services );

      // Should not announce justPlayed since there was no previous song
      expect( services.messageService.formatMention ).not.toHaveBeenCalled();
      expect( services.messageService.sendGroupMessage ).not.toHaveBeenCalled();
    } );

    test( 'should announce just played when song ends (nowPlaying becomes null)', async () => {
      // Store a previous song that was playing
      global.previousPlayedSong = {
        djUuid: 'dj-uuid-123',
        artistName: 'Previous Artist',
        trackName: 'Previous Track',
        voteCounts: { likes: 5, dislikes: 2, stars: 1 }
      };

      services.hangoutState = {
        nowPlaying: {
          song: {
            artistName: 'Previous Artist',
            trackName: 'Previous Track'
          }
        },
        djs: [ { uuid: 'dj-uuid-123' } ],
        voteCounts: { likes: 5, dislikes: 2, stars: 1 }
      };

      services.featuresService.isFeatureEnabled.mockImplementation( ( feature ) => {
        if ( feature === 'justPlayed' ) return true;
        if ( feature === 'nowPlayingMessage' ) return false;
        return false;
      } );

      const message = {
        statePatch: [
          { op: 'replace', path: '/nowPlaying', value: null } // Song ends
        ]
      };

      await playedSong( message, {}, services );

      expect( services.messageService.formatMention ).toHaveBeenCalledWith( 'dj-uuid-123' );
      expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
        '<@uid:dj-uuid-123> played Previous Track by Previous Artist 👍5 👎2 ⭐1',
        { services }
      );
    } );

    test( 'should announce just played when different song starts playing', async () => {
      // Store a previous song that was playing
      global.previousPlayedSong = {
        djUuid: 'dj-uuid-123',
        artistName: 'Previous Artist',
        trackName: 'Previous Track',
        voteCounts: { likes: 3, dislikes: 1, stars: 0 }
      };

      services.hangoutState = {
        nowPlaying: {
          song: {
            artistName: 'Previous Artist',
            trackName: 'Previous Track'
          }
        },
        djs: [ { uuid: 'dj-uuid-123' } ],
        voteCounts: { likes: 3, dislikes: 1, stars: 0 }
      };

      services.featuresService.isFeatureEnabled.mockImplementation( ( feature ) => {
        if ( feature === 'justPlayed' ) return true;
        if ( feature === 'nowPlayingMessage' ) return false;
        return false;
      } );

      services.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'justPlayedMessage' ) {
          return '{username} just played {trackName} by {artistName} 👍{likes} 👎{dislikes} ⭐{stars}';
        }
        return null;
      } );

      // New song starts playing (different from the stored previous song)
      const message = {
        statePatch: [
          { op: 'replace', path: '/djs/0/uuid', value: 'dj-uuid-456' },
          { op: 'replace', path: '/nowPlaying/song/artistName', value: 'New Artist' },
          { op: 'replace', path: '/nowPlaying/song/trackName', value: 'New Track' },
          { op: 'replace', path: '/nowPlaying/song/songShortId', value: 'song-456' }
        ]
      };

      await playedSong( message, {}, services );

      expect( services.messageService.formatMention ).toHaveBeenCalledWith( 'dj-uuid-123' );
      expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
        '<@uid:dj-uuid-123> just played Previous Track by Previous Artist 👍3 👎1 ⭐0',
        { services }
      );
    } );

    test( 'should announce just played when playId changes (same song played again)', async () => {
      // Set up previous song data
      global.previousPlayedSong = {
        trackName: 'Hanging On The Telephone - Remastered',
        artistName: 'L7',
        djUuid: 'dj-uuid-123',
        playId: 'previous-play-id-123',
        voteCounts: { likes: 2, dislikes: 0, stars: 1 }
      };

      services.hangoutState = {
        nowPlaying: {
          song: {
            artistName: 'L7',
            trackName: 'Hanging On The Telephone - Remastered'
          }
        },
        djs: [ { uuid: 'dj-uuid-123' } ],
        voteCounts: { likes: 2, dislikes: 0, stars: 1 }
      };

      services.featuresService.isFeatureEnabled.mockImplementation( ( feature ) => {
        if ( feature === 'justPlayed' ) return true;
        if ( feature === 'nowPlayingMessage' ) return false;
        return false;
      } );

      services.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'justPlayedMessage' ) {
          return '{username} just played {trackName} by {artistName} 👍{likes} 👎{dislikes} ⭐{stars}';
        }
        return null;
      } );

      // Message with playId change but no song details (like in 000015 log)
      const message = {
        statePatch: [
          { op: 'replace', path: '/nowPlaying/playId', value: '317598a6-57e3-41ac-a22d-099c7a680a52' },
          { op: 'replace', path: '/nowPlaying/endTime', value: 1760265800452 },
          { op: 'replace', path: '/nowPlaying/startTime', value: 1760265671452 },
          { op: 'replace', path: '/nowPlaying/song/crateSongUuid', value: 'c99e0d8a-f2bc-49f6-96c8-f02b3dd5be10' }
        ]
      };

      await playedSong( message, {}, services );

      expect( services.messageService.formatMention ).toHaveBeenCalledWith( 'dj-uuid-123' );
      expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
        '<@uid:dj-uuid-123> just played Hanging On The Telephone - Remastered by L7 👍2 👎0 ⭐1',
        { services }
      );
    } );

    test( 'should announce nowPlaying when playId changes (same song played again)', async () => {
      // Set up hangout state with current song
      services.hangoutState = {
        nowPlaying: {
          song: {
            artistName: 'Test Artist',
            trackName: 'Test Track',
            songShortId: 'song-123'
          }
        },
        djs: [ { uuid: 'dj-uuid-123' } ]
      };

      services.featuresService.isFeatureEnabled.mockImplementation( ( feature ) => {
        if ( feature === 'nowPlayingMessage' ) return true;
        if ( feature === 'justPlayed' ) return false; // Disable to focus on nowPlaying
        return false;
      } );

      services.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'nowPlayingMessage' ) {
          return '{username} is now playing {trackName} by {artistName}';
        }
        return null;
      } );

      // Message with playId change but no song details (same song replayed)
      const message = {
        statePatch: [
          { op: 'replace', path: '/nowPlaying/playId', value: 'new-play-id-456' },
          { op: 'replace', path: '/nowPlaying/startTime', value: 1760265800000 },
          { op: 'replace', path: '/nowPlaying/endTime', value: 1760265920000 }
        ]
      };

      await playedSong( message, {}, services );

      // Should announce nowPlaying using hangout state since no song info in patch
      expect( services.messageService.formatMention ).toHaveBeenCalledWith( 'dj-uuid-123' );
      expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
        '<@uid:dj-uuid-123> is now playing Test Track by Test Artist',
        { services }
      );
    } );
  } );
} );
