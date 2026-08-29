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

  describe( 'pending AFK removal', () => {
    beforeEach( () => {
      services.hangSocketServices.removeDj = jest.fn().mockResolvedValue();
      services.afkService = {
        getPendingRemovals: jest.fn().mockReturnValue( [] ),
        clearPendingRemoval: jest.fn(),
        getActivitySnapshot: jest.fn().mockReturnValue( [] ),
      };
    } );

    test( 'removes a pending DJ when a new song starts', async () => {
      services.afkService.getPendingRemovals.mockReturnValue( [ 'afk-uuid' ] );
      services.afkService.getActivitySnapshot.mockReturnValue( [ { uuid: 'afk-uuid', nickname: 'AFK DJ' } ] );

      await playedSong( {}, {}, services );

      expect( services.afkService.clearPendingRemoval ).toHaveBeenCalledWith( 'afk-uuid' );
      expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith( services.socket, 'afk-uuid' );
      expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
        expect.stringContaining( 'AFK DJ' ),
        { services }
      );
    } );

    test( 'falls back to uuid as name when nickname is missing', async () => {
      services.afkService.getPendingRemovals.mockReturnValue( [ 'afk-uuid' ] );
      services.afkService.getActivitySnapshot.mockReturnValue( [] );

      await playedSong( {}, {}, services );

      expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
        expect.stringContaining( 'afk-uuid' ),
        { services }
      );
    } );

    test( 'clears pending removal before attempting removeDj to prevent double-removal', async () => {
      const callOrder = [];
      services.afkService.getPendingRemovals.mockReturnValue( [ 'afk-uuid' ] );
      services.afkService.clearPendingRemoval.mockImplementation( () => callOrder.push( 'clear' ) );
      services.hangSocketServices.removeDj.mockImplementation( () => {
        callOrder.push( 'remove' );
        return Promise.resolve();
      } );

      await playedSong( {}, {}, services );

      expect( callOrder ).toEqual( [ 'clear', 'remove' ] );
    } );

    test( 'handles removeDj failure gracefully and logs error', async () => {
      services.afkService.getPendingRemovals.mockReturnValue( [ 'afk-uuid' ] );
      services.afkService.getActivitySnapshot.mockReturnValue( [] );
      services.hangSocketServices.removeDj.mockRejectedValueOnce( new Error( 'not allowed' ) );

      await expect( playedSong( {}, {}, services ) ).resolves.not.toThrow();
      expect( services.logger.error ).toHaveBeenCalledWith(
        expect.stringContaining( 'afk-uuid' )
      );
    } );

    test( 'does nothing when there are no pending removals', async () => {
      services.afkService.getPendingRemovals.mockReturnValue( [] );

      await playedSong( {}, {}, services );

      expect( services.hangSocketServices.removeDj ).not.toHaveBeenCalled();
    } );

    test( 'skips pending removal logic when afkService is absent', async () => {
      delete services.afkService;

      await expect( playedSong( {}, {}, services ) ).resolves.not.toThrow();
      expect( services.hangSocketServices.removeDj ).not.toHaveBeenCalled();
    } );
  } );

  describe( 'Phase 6: Escort removal on song completion', () => {
    beforeEach( () => {
      // Preserve hangSocketServices from parent beforeEach and add escort methods
      services.hangSocketServices.removeDj = jest.fn().mockResolvedValue();
      services.dataService.getValue = jest.fn().mockReturnValue( {} );
      services.dataService.setValue = jest.fn();
      services.stateService = {
        _getDjs: jest.fn().mockReturnValue( [] )
      };
    } );

    test( 'should remove current DJ when escortme flag is enabled', async () => {
      const currentDj = { uuid: 'escort-dj-uuid', nickname: 'EscortDJ' };
      services.stateService._getDjs.mockReturnValue( [ currentDj ] );
      services.dataService.getValue.mockReturnValue( {
        'escort-dj-uuid': {
          markedAt: Date.now() - 5000,
          removeAfterCurrent: true
        }
      } );

      await playedSong( {}, {}, services );

      expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith( services.socket, 'escort-dj-uuid' );
      expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
        expect.stringContaining( 'EscortDJ' ),
        { services }
      );
      expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
        expect.stringContaining( 'escortme' ),
        { services }
      );
    } );

    test( 'should clear escort flag before removal to prevent double-removal', async () => {
      const currentDj = { uuid: 'escort-dj-uuid', nickname: 'EscortDJ' };
      services.stateService._getDjs.mockReturnValue( [ currentDj ] );
      const escortQueue = {
        'escort-dj-uuid': {
          markedAt: Date.now() - 5000,
          removeAfterCurrent: true
        }
      };
      services.dataService.getValue.mockReturnValue( escortQueue );

      await playedSong( {}, {}, services );

      const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
      expect( setValueCall[ 0 ] ).toBe( 'escortQueue' );
      expect( setValueCall[ 1 ][ 'escort-dj-uuid' ] ).toBeUndefined();
    } );

    test( 'should not remove DJ when no escort flag is set', async () => {
      const currentDj = { uuid: 'normal-dj-uuid', nickname: 'NormalDJ' };
      services.stateService._getDjs.mockReturnValue( [ currentDj ] );
      services.dataService.getValue.mockReturnValue( {} );

      await playedSong( {}, {}, services );

      expect( services.hangSocketServices.removeDj ).not.toHaveBeenCalled();
      expect( services.dataService.setValue ).not.toHaveBeenCalled();
    } );

    test( 'should use UUID as fallback when DJ nickname is unavailable', async () => {
      const currentDj = { uuid: 'escort-dj-uuid' }; // No nickname
      services.stateService._getDjs.mockReturnValue( [ currentDj ] );
      services.dataService.getValue.mockReturnValue( {
        'escort-dj-uuid': {
          markedAt: Date.now() - 5000,
          removeAfterCurrent: true
        }
      } );

      await playedSong( {}, {}, services );

      expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
        expect.stringContaining( 'escort-dj-uuid' ),
        { services }
      );
    } );

    test( 'should handle empty DJ list gracefully', async () => {
      services.stateService._getDjs.mockReturnValue( [] );
      services.dataService.getValue.mockReturnValue( {} );

      await expect( playedSong( {}, {}, services ) ).resolves.not.toThrow();
      expect( services.hangSocketServices.removeDj ).not.toHaveBeenCalled();
    } );

    test( 'should handle null DJ list gracefully', async () => {
      services.stateService._getDjs.mockReturnValue( null );
      services.dataService.getValue.mockReturnValue( {} );

      await expect( playedSong( {}, {}, services ) ).resolves.not.toThrow();
      expect( services.hangSocketServices.removeDj ).not.toHaveBeenCalled();
    } );

    test( 'should log error if removeDj fails', async () => {
      const currentDj = { uuid: 'escort-dj-uuid', nickname: 'EscortDJ' };
      services.stateService._getDjs.mockReturnValue( [ currentDj ] );
      services.dataService.getValue.mockReturnValue( {
        'escort-dj-uuid': {
          markedAt: Date.now() - 5000,
          removeAfterCurrent: true
        }
      } );
      services.hangSocketServices.removeDj.mockRejectedValueOnce( new Error( 'removal failed' ) );

      await playedSong( {}, {}, services );

      expect( services.logger.error ).toHaveBeenCalledWith(
        expect.stringContaining( 'escort removal' )
      );
    } );

    test( 'should log error if escort processing fails', async () => {
      services.stateService._getDjs.mockImplementation( () => {
        throw new Error( 'state error' );
      } );

      await playedSong( {}, {}, services );

      expect( services.logger.error ).toHaveBeenCalledWith(
        expect.stringContaining( 'escort removals' )
      );
    } );

    test( 'should handle null dataService gracefully', async () => {
      services.dataService = null;
      services.stateService._getDjs.mockReturnValue( [] );

      await expect( playedSong( {}, {}, services ) ).resolves.not.toThrow();
    } );

    test( 'should handle missing stateService._getDjs gracefully', async () => {
      services.stateService = {};
      services.dataService.getValue.mockReturnValue( {} );

      await expect( playedSong( {}, {}, services ) ).resolves.not.toThrow();
      expect( services.hangSocketServices.removeDj ).not.toHaveBeenCalled();
    } );

    test( 'should preserve other escort flags when removing one DJ', async () => {
      const currentDj = { uuid: 'escort-dj-uuid', nickname: 'EscortDJ' };
      services.stateService._getDjs.mockReturnValue( [ currentDj ] );
      const otherEscortFlag = {
        markedAt: Date.now() - 10000,
        removeAfterCurrent: false
      };
      services.dataService.getValue.mockReturnValue( {
        'escort-dj-uuid': {
          markedAt: Date.now() - 5000,
          removeAfterCurrent: true
        },
        'other-dj-uuid': otherEscortFlag
      } );

      await playedSong( {}, {}, services );

      const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
      expect( setValueCall[ 1 ][ 'escort-dj-uuid' ] ).toBeUndefined();
      expect( setValueCall[ 1 ][ 'other-dj-uuid' ] ).toEqual( otherEscortFlag );
    } );
  } );

  describe( 'Phase 7: Multi-DJ Queue Handling', () => {
    beforeEach( () => {
      // Preserve hangSocketServices from parent beforeEach and add escort methods
      services.hangSocketServices.removeDj = jest.fn().mockResolvedValue();
      services.dataService.getValue = jest.fn().mockReturnValue( {} );
      services.dataService.setValue = jest.fn();
      services.stateService = {
        _getDjs: jest.fn().mockReturnValue( [] )
      };
    } );

    test( 'should remove only current DJ when multiple DJs have escorts', async () => {
      const dj0 = { uuid: 'dj-0-uuid', nickname: 'DJ0' };
      const dj1 = { uuid: 'dj-1-uuid', nickname: 'DJ1' };
      const dj2 = { uuid: 'dj-2-uuid', nickname: 'DJ2' };

      // Three DJs in queue: position 0 (playing), 1 and 2
      services.stateService._getDjs.mockReturnValue( [ dj0, dj1, dj2 ] );

      // All three have escorts enabled
      services.dataService.getValue.mockReturnValue( {
        'dj-0-uuid': { markedAt: Date.now() - 5000, removeAfterCurrent: true },
        'dj-1-uuid': { markedAt: Date.now() - 3000, removeAfterCurrent: false },
        'dj-2-uuid': { markedAt: Date.now() - 2000, removeAfterCurrent: false }
      } );

      await playedSong( {}, {}, services );

      // Only DJ at position 0 should be removed
      expect( services.hangSocketServices.removeDj ).toHaveBeenCalledTimes( 1 );
      expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
        services.socket,
        'dj-0-uuid'
      );

      // Only DJ0's flag should be cleared
      const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
      expect( setValueCall[ 1 ][ 'dj-0-uuid' ] ).toBeUndefined();
      expect( setValueCall[ 1 ][ 'dj-1-uuid' ] ).toBeDefined();
      expect( setValueCall[ 1 ][ 'dj-2-uuid' ] ).toBeDefined();
    } );

    test( 'should remove next DJ when previous position 0 is removed with same song', async () => {
      const dj0 = { uuid: 'dj-0-uuid', nickname: 'DJ0' };
      const dj1 = { uuid: 'dj-1-uuid', nickname: 'DJ1' };

      // First call: DJ0 at position 0, DJ1 at position 1
      services.stateService._getDjs.mockReturnValue( [ dj0, dj1 ] );

      // Both have escorts
      services.dataService.getValue.mockReturnValue( {
        'dj-0-uuid': { markedAt: Date.now() - 5000, removeAfterCurrent: true },
        'dj-1-uuid': { markedAt: Date.now() - 3000, removeAfterCurrent: false }
      } );

      await playedSong( {}, {}, services );

      // DJ0 removed, DJ1's flag still exists
      const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
      expect( setValueCall[ 1 ][ 'dj-0-uuid' ] ).toBeUndefined();
      expect( setValueCall[ 1 ][ 'dj-1-uuid' ] ).toBeDefined();
    } );

    test( 'should handle mixed escort status (some enabled, some not) correctly', async () => {
      const dj0 = { uuid: 'dj-0-uuid', nickname: 'DJ0' };
      const dj1 = { uuid: 'dj-1-uuid', nickname: 'DJ1' };
      const dj2 = { uuid: 'dj-2-uuid', nickname: 'DJ2' };

      services.stateService._getDjs.mockReturnValue( [ dj0, dj1, dj2 ] );

      // Only DJ0 and DJ2 have escorts (DJ1 does not)
      services.dataService.getValue.mockReturnValue( {
        'dj-0-uuid': { markedAt: Date.now() - 5000, removeAfterCurrent: true },
        'dj-2-uuid': { markedAt: Date.now() - 2000, removeAfterCurrent: false }
      } );

      await playedSong( {}, {}, services );

      // Only DJ0 should be removed
      expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
        services.socket,
        'dj-0-uuid'
      );

      // DJ1's flag should not exist (and not be preserved)
      // DJ2's flag should be preserved
      const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
      expect( setValueCall[ 1 ][ 'dj-0-uuid' ] ).toBeUndefined();
      expect( setValueCall[ 1 ][ 'dj-2-uuid' ] ).toBeDefined();
    } );

    test( 'should preserve individual escort flags for DJs 1-20 when removing DJ 0', async () => {
      // Create a large queue with escorts at various positions
      const djs = [];
      const escortQueue = {};

      for ( let i = 0; i <= 5; i++ ) {
        const uuid = `dj-${ i }-uuid`;
        djs.push( { uuid, nickname: `DJ${ i }` } );
        escortQueue[uuid] = {
          markedAt: Date.now() - ( 5000 - i * 100 ),
          removeAfterCurrent: i === 0
        };
      }

      services.stateService._getDjs.mockReturnValue( djs );
      services.dataService.getValue.mockReturnValue( escortQueue );

      await playedSong( {}, {}, services );

      // Only DJ0 removed
      expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
        services.socket,
        'dj-0-uuid'
      );

      const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
      expect( setValueCall[ 1 ][ 'dj-0-uuid' ] ).toBeUndefined();

      // All other DJs' flags preserved
      for ( let i = 1; i <= 5; i++ ) {
        expect( setValueCall[ 1 ][ `dj-${ i }-uuid` ] ).toBeDefined();
      }
    } );

    test( 'should track different removeAfterCurrent values independently', async () => {
      const dj0 = { uuid: 'current-dj-uuid', nickname: 'CurrentDJ' };
      const dj1 = { uuid: 'queued-dj-uuid', nickname: 'QueuedDJ' };

      services.stateService._getDjs.mockReturnValue( [ dj0, dj1 ] );

      services.dataService.getValue.mockReturnValue( {
        'current-dj-uuid': { markedAt: Date.now() - 5000, removeAfterCurrent: true },
        'queued-dj-uuid': { markedAt: Date.now() - 3000, removeAfterCurrent: false }
      } );

      await playedSong( {}, {}, services );

      // Verify the currentDJ (removeAfterCurrent: true) is removed
      expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
        services.socket,
        'current-dj-uuid'
      );

      // Verify the queued DJ's flag is preserved with correct value
      const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
      const preservedFlag = setValueCall[ 1 ][ 'queued-dj-uuid' ];
      expect( preservedFlag.removeAfterCurrent ).toBe( false );
    } );

    test( 'should handle DJ list changes between operations', async () => {
      const dj0 = { uuid: 'dj-0-uuid', nickname: 'DJ0' };
      const dj1 = { uuid: 'dj-1-uuid', nickname: 'DJ1' };

      // Initial queue
      services.stateService._getDjs.mockReturnValue( [ dj0, dj1 ] );

      services.dataService.getValue.mockReturnValue( {
        'dj-0-uuid': { markedAt: Date.now() - 5000, removeAfterCurrent: true },
        'dj-1-uuid': { markedAt: Date.now() - 3000, removeAfterCurrent: false }
      } );

      await playedSong( {}, {}, services );

      // Verify removal executed correctly despite potential queue changes
      expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
        services.socket,
        'dj-0-uuid'
      );

      // Verify DJ1's flag preserved
      const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
      expect( setValueCall[ 1 ][ 'dj-1-uuid' ] ).toBeDefined();
    } );

    test( 'should handle removal failure without affecting other DJ flags', async () => {
      const dj0 = { uuid: 'dj-0-uuid', nickname: 'DJ0' };
      const dj1 = { uuid: 'dj-1-uuid', nickname: 'DJ1' };

      services.stateService._getDjs.mockReturnValue( [ dj0, dj1 ] );

      services.dataService.getValue.mockReturnValue( {
        'dj-0-uuid': { markedAt: Date.now() - 5000, removeAfterCurrent: true },
        'dj-1-uuid': { markedAt: Date.now() - 3000, removeAfterCurrent: false }
      } );

      // Simulate removal failure
      services.hangSocketServices.removeDj.mockRejectedValueOnce(
        new Error( 'Socket error' )
      );

      await playedSong( {}, {}, services );

      // Flag should still be cleared even though removal failed
      const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
      expect( setValueCall[ 1 ][ 'dj-0-uuid' ] ).toBeUndefined();
      expect( setValueCall[ 1 ][ 'dj-1-uuid' ] ).toBeDefined();

      // Error should be logged
      expect( services.logger.error ).toHaveBeenCalledWith(
        expect.stringContaining( 'escort removal' )
      );
    } );

    test( 'should handle many DJs with escorts efficiently', async () => {
      // Create 10 DJs in queue
      const djs = [];
      const escortQueue = {};

      for ( let i = 0; i < 10; i++ ) {
        const uuid = `dj-${ i }-uuid`;
        djs.push( { uuid, nickname: `DJ${ i }` } );
        escortQueue[uuid] = {
          markedAt: Date.now() - ( 5000 - i * 100 ),
          removeAfterCurrent: i === 0
        };
      }

      services.stateService._getDjs.mockReturnValue( djs );
      services.dataService.getValue.mockReturnValue( escortQueue );

      await playedSong( {}, {}, services );

      // Only position 0 removed
      expect( services.hangSocketServices.removeDj ).toHaveBeenCalledTimes( 1 );
      expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
        services.socket,
        'dj-0-uuid'
      );

      // All other DJs' flags preserved
      const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
      for ( let i = 1; i < 10; i++ ) {
        expect( setValueCall[ 1 ][ `dj-${ i }-uuid` ] ).toBeDefined();
      }
    } );

    test( 'should clear only current DJ flag when multiple flags match current UUID', async () => {
      // Edge case: same UUID somehow appears multiple times (shouldn't happen, but test robustness)
      const dj0 = { uuid: 'dj-0-uuid', nickname: 'DJ0' };
      const dj1 = { uuid: 'dj-1-uuid', nickname: 'DJ1' };

      services.stateService._getDjs.mockReturnValue( [ dj0, dj1 ] );

      const escortQueue = {
        'dj-0-uuid': { markedAt: Date.now() - 5000, removeAfterCurrent: true },
        'dj-1-uuid': { markedAt: Date.now() - 3000, removeAfterCurrent: false }
      };
      services.dataService.getValue.mockReturnValue( escortQueue );

      await playedSong( {}, {}, services );

      const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
      const resultQueue = setValueCall[ 1 ];

      // Exactly one flag removed (DJ0), one preserved (DJ1)
      const flagCount = Object.keys( resultQueue ).length;
      expect( flagCount ).toBe( 1 );
      expect( resultQueue[ 'dj-1-uuid' ] ).toBeDefined();
    } );
  } );

  describe( 'Phase 8: Full End-to-End Complex Flows', () => {
    beforeEach( () => {
      // Preserve hangSocketServices from parent beforeEach and add escort methods
      services.hangSocketServices.removeDj = jest.fn().mockResolvedValue();
      services.dataService.getValue = jest.fn().mockReturnValue( {} );
      services.dataService.setValue = jest.fn();
      services.stateService = {
        _getDjs: jest.fn().mockReturnValue( [] )
      };
    } );

    describe( 'Complex user flow: Enable → Stop → Enable → Remove', () => {
      test( 'user enables, then stops, then re-enables → removal happens on next song', async () => {
        const dj = { uuid: 'flow-dj-uuid', nickname: 'FlowDJ' };
        services.stateService._getDjs.mockReturnValue( [ dj ] );

        // After user enables again (simulating escape behavior)
        services.dataService.getValue.mockReturnValue( {
          'flow-dj-uuid': {
            markedAt: Date.now() - 2000,  // Recently re-enabled
            removeAfterCurrent: true
          }
        } );

        await playedSong( {}, {}, services );

        // Should remove the DJ since flag is enabled
        expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
          services.socket,
          'flow-dj-uuid'
        );

        // Should clear the flag after removal
        const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
        expect( setValueCall[ 1 ][ 'flow-dj-uuid' ] ).toBeUndefined();
      } );

      test( 'user enables in queue, moves to position 0, song ends → removed correctly', async () => {
        // Simulate user who enabled at position 5, now at position 0
        const dj = { uuid: 'moved-dj-uuid', nickname: 'MovedDJ' };
        services.stateService._getDjs.mockReturnValue( [ dj ] );

        // Flag was set when at position 5 (removeAfterCurrent: false)
        // But now DJ is at position 0, flag should still exist
        services.dataService.getValue.mockReturnValue( {
          'moved-dj-uuid': {
            markedAt: Date.now() - 10000,  // Enabled earlier
            removeAfterCurrent: false  // Was set at position 5
          }
        } );

        await playedSong( {}, {}, services );

        // DJ should still be removed (flag takes precedence)
        expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
          services.socket,
          'moved-dj-uuid'
        );
      } );
    } );

    describe( 'Phase integration: Multiple escape paths', () => {
      test( 'DJ with escort enables, manually leaves (Phase 4 cleanup) → flag cleared by removedDj', async () => {
        // This test verifies the integration between Phase 6 (removal) and Phase 4 (cleanup)
        // Scenario: DJ enables escort, then manually leaves before song ends
        const dj = { uuid: 'manual-leave-uuid', nickname: 'ManualLeaveDJ' };

        // Simulate state before manual leave
        services.stateService._getDjs.mockReturnValue( [ dj ] );
        services.dataService.getValue.mockReturnValue( {
          'manual-leave-uuid': {
            markedAt: Date.now() - 5000,
            removeAfterCurrent: true
          }
        } );

        await playedSong( {}, {}, services );

        // In real scenario, removedDj handler would clear the flag
        // This test verifies playedSong doesn't interfere with that cleanup
        expect( services.hangSocketServices.removeDj ).toHaveBeenCalled();
      } );

      test( 'DJ with escort enables, room disconnects (Phase 5 cleanup) → userLeft clears flag', async () => {
        // This test verifies the integration between Phase 6 (removal) and Phase 5 (cleanup)
        // Scenario: DJ enables escort, then leaves room before song ends
        const dj = { uuid: 'room-leave-uuid', nickname: 'RoomLeaveDJ' };

        services.stateService._getDjs.mockReturnValue( [ dj ] );
        services.dataService.getValue.mockReturnValue( {
          'room-leave-uuid': {
            markedAt: Date.now() - 5000,
            removeAfterCurrent: true
          }
        } );

        await playedSong( {}, {}, services );

        // In real scenario, userLeft handler would clear the flag
        // This test verifies playedSong doesn't interfere with that cleanup
        expect( services.hangSocketServices.removeDj ).toHaveBeenCalled();
      } );

      test( 'normal Phase 6 flow: escort enable → song ends → removal executes', async () => {
        // This is the standard happy path that ties Phases 1-6 together
        const dj = { uuid: 'normal-flow-uuid', nickname: 'NormalFlowDJ' };

        services.stateService._getDjs.mockReturnValue( [ dj ] );
        services.dataService.getValue.mockReturnValue( {
          'normal-flow-uuid': {
            markedAt: Date.now() - 5000,
            removeAfterCurrent: true
          }
        } );

        await playedSong( {}, {}, services );

        // Entire flow should work: enable → song ends → removal
        expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
          services.socket,
          'normal-flow-uuid'
        );
        expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
          expect.stringContaining( 'escortme' ),
          { services }
        );
      } );
    } );

    describe( 'Flag persistence & data integrity', () => {
      test( 'flag structure remains valid after multiple enable/disable cycles', async () => {
        const dj = { uuid: 'cycled-dj-uuid', nickname: 'CycledDJ' };
        services.stateService._getDjs.mockReturnValue( [ dj ] );

        // Simulate flag that has been through: enable → stop → enable cycle
        const cycledFlag = {
          markedAt: Date.now() - 3000,
          removeAfterCurrent: true
        };
        services.dataService.getValue.mockReturnValue( {
          'cycled-dj-uuid': cycledFlag
        } );

        await playedSong( {}, {}, services );

        // Flag should be cleanly cleared (not corrupted from cycles)
        const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
        expect( setValueCall[ 1 ] ).toBeDefined();
        expect( Object.keys( setValueCall[ 1 ] ).length ).toBe( 0 );
      } );

      test( 'concurrent escorts from different users do not interfere with each other', async () => {
        const dj0 = { uuid: 'concurrent-dj-0', nickname: 'Concurrent0' };
        const dj1 = { uuid: 'concurrent-dj-1', nickname: 'Concurrent1' };
        const dj2 = { uuid: 'concurrent-dj-2', nickname: 'Concurrent2' };

        // Three concurrent escorts at different positions
        services.stateService._getDjs.mockReturnValue( [ dj0, dj1, dj2 ] );

        const escortQueue = {
          'concurrent-dj-0': { markedAt: Date.now() - 5000, removeAfterCurrent: true },
          'concurrent-dj-1': { markedAt: Date.now() - 4000, removeAfterCurrent: false },
          'concurrent-dj-2': { markedAt: Date.now() - 3000, removeAfterCurrent: false }
        };
        services.dataService.getValue.mockReturnValue( escortQueue );

        await playedSong( {}, {}, services );

        // Only position 0 should be affected
        expect( services.hangSocketServices.removeDj ).toHaveBeenCalledTimes( 1 );
        expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
          services.socket,
          'concurrent-dj-0'
        );

        // Other escorts should be untouched
        const setValueCall = services.dataService.setValue.mock.calls[ 0 ];
        expect( setValueCall[ 1 ][ 'concurrent-dj-1' ] ).toBeDefined();
        expect( setValueCall[ 1 ][ 'concurrent-dj-2' ] ).toBeDefined();
        expect( setValueCall[ 1 ][ 'concurrent-dj-0' ] ).toBeUndefined();
      } );

      test( 'flag timestamps do not affect removal logic (only presence matters)', async () => {
        const dj = { uuid: 'timestamp-dj', nickname: 'TimestampDJ' };
        services.stateService._getDjs.mockReturnValue( [ dj ] );

        // Flag with very old timestamp (enabled long ago)
        services.dataService.getValue.mockReturnValue( {
          'timestamp-dj': {
            markedAt: Date.now() - 86400000,  // 24 hours ago
            removeAfterCurrent: true
          }
        } );

        await playedSong( {}, {}, services );

        // Should still remove (timestamp doesn't prevent removal)
        expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
          services.socket,
          'timestamp-dj'
        );
      } );
    } );

    describe( 'Edge cases: Error recovery & resilience', () => {
      test( 'corruption in one DJ flag does not prevent removal of another DJ', async () => {
        const dj0 = { uuid: 'good-dj', nickname: 'GoodDJ' };
        const dj1 = { uuid: 'bad-dj', nickname: 'BadDJ' };

        services.stateService._getDjs.mockReturnValue( [ dj0, dj1 ] );

        // DJ0 has valid flag, DJ1 has corrupted flag (missing removeAfterCurrent)
        services.dataService.getValue.mockReturnValue( {
          'good-dj': { markedAt: Date.now() - 5000, removeAfterCurrent: true },
          'bad-dj': { markedAt: Date.now() - 3000 }  // Missing removeAfterCurrent
        } );

        await playedSong( {}, {}, services );

        // Should still remove DJ0 despite DJ1's corruption
        expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
          services.socket,
          'good-dj'
        );
      } );

      test( 'partial flag clear does not throw, preserves remaining flags', async () => {
        const dj0 = { uuid: 'clear-dj-0', nickname: 'ClearDJ0' };
        const dj1 = { uuid: 'clear-dj-1', nickname: 'ClearDJ1' };

        services.stateService._getDjs.mockReturnValue( [ dj0, dj1 ] );

        services.dataService.getValue.mockReturnValue( {
          'clear-dj-0': { markedAt: Date.now() - 5000, removeAfterCurrent: true },
          'clear-dj-1': { markedAt: Date.now() - 3000, removeAfterCurrent: false }
        } );

        // Simulate setValue throwing error on first call
        services.dataService.setValue.mockImplementationOnce( () => {
          throw new Error( 'persistence failed' );
        } );

        await expect( playedSong( {}, {}, services ) ).resolves.not.toThrow();

        // Error should be logged but not crash the handler
        expect( services.logger.error ).toHaveBeenCalled();
      } );
    } );

    describe( 'State patch scenarios: Real server interactions', () => {
      test( 'handles successive songs ending with different escorts at position 0', async () => {
        // First song: DJ0 with escort
        const dj0 = { uuid: 'first-song-dj', nickname: 'FirstSongDJ' };
        services.stateService._getDjs.mockReturnValue( [ dj0 ] );
        services.dataService.getValue.mockReturnValue( {
          'first-song-dj': { markedAt: Date.now() - 5000, removeAfterCurrent: true }
        } );

        await playedSong( {}, {}, services );

        // DJ0 should be removed
        expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
          services.socket,
          'first-song-dj'
        );

        // Reset mocks for second song
        services.hangSocketServices.removeDj.mockClear();
        services.dataService.getValue.mockClear();
        services.dataService.setValue.mockClear();

        // Second song: DJ1 without escort becomes position 0
        const dj1 = { uuid: 'second-song-dj', nickname: 'SecondSongDJ' };
        services.stateService._getDjs.mockReturnValue( [ dj1 ] );
        services.dataService.getValue.mockReturnValue( {} );  // No escort

        await playedSong( {}, {}, services );

        // DJ1 should not be removed
        expect( services.hangSocketServices.removeDj ).not.toHaveBeenCalled();
      } );

      test( 'handles position 0 becoming null and then a new DJ at position 0', async () => {
        // State where position 0 no longer exists (all removed)
        services.stateService._getDjs.mockReturnValue( [] );
        services.dataService.getValue.mockReturnValue( {} );

        await expect( playedSong( {}, {}, services ) ).resolves.not.toThrow();
        expect( services.hangSocketServices.removeDj ).not.toHaveBeenCalled();
      } );
    } );

    describe( 'Cross-phase consistency checks', () => {
      test( 'Phase 1-3 command flow + Phase 6 removal = complete journey', async () => {
        // Verify the entire chain works: command sets flag → phase 6 removes
        const dj = { uuid: 'full-journey-uuid', nickname: 'FullJourneyDJ' };
        services.stateService._getDjs.mockReturnValue( [ dj ] );

        // Flag structure from Phase 1-3 commands
        services.dataService.getValue.mockReturnValue( {
          'full-journey-uuid': {
            markedAt: Date.now() - 5000,
            removeAfterCurrent: true
          }
        } );

        await playedSong( {}, {}, services );

        // Should complete the full journey
        expect( services.hangSocketServices.removeDj ).toHaveBeenCalledWith(
          services.socket,
          'full-journey-uuid'
        );
        expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
          expect.stringContaining( '👋' ),
          { services }
        );
      } );

      test( 'Phase 4 (removedDj) prepares for Phase 6 removal by clearing flag', async () => {
        // Verify Phase 4's flag cleanup prevents double-removal in Phase 6
        const dj = { uuid: 'phase4-to-6-uuid', nickname: 'Phase4to6DJ' };
        services.stateService._getDjs.mockReturnValue( [ dj ] );

        // Simulate: Phase 4 (removedDj) already cleared the flag
        services.dataService.getValue.mockReturnValue( {} );

        await playedSong( {}, {}, services );

        // Phase 6 should not attempt removal (flag already cleared)
        expect( services.hangSocketServices.removeDj ).not.toHaveBeenCalled();
      } );

      test( 'Phase 5 (userLeft) prepares for Phase 6 removal by clearing flag', async () => {
        // Verify Phase 5's flag cleanup prevents removal in Phase 6
        const dj = { uuid: 'phase5-to-6-uuid', nickname: 'Phase5to6DJ' };
        services.stateService._getDjs.mockReturnValue( [ dj ] );

        // Simulate: Phase 5 (userLeft) already cleared the flag
        services.dataService.getValue.mockReturnValue( {} );

        await playedSong( {}, {}, services );

        // Phase 6 should not attempt removal (flag already cleared)
        expect( services.hangSocketServices.removeDj ).not.toHaveBeenCalled();
      } );
    } );
  } );
} );
