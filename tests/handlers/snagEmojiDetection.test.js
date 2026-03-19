const playedOneTimeAnimation = require( '../../src/handlers/playedOneTimeAnimation' );

describe( 'Snag emoji detection', () => {
  test( 'should detect snag emojis correctly', () => {
    const snagEmojis = [ '💜', '⭐️' ];
    const nonSnagEmojis = [ '😀', '��', '🎵', '🎶', '🔥', '👍', '👎', '🌟', '❤️', '💙' ];

    let services = {
      logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
      hangoutState: {
        voteCounts: { likes: 0, dislikes: 0, stars: 0 },
        djs: [ { uuid: 'test-dj' } ]
      }
    };

    // Test snag emojis - each should increment stars
    snagEmojis.forEach( ( emoji, index ) => {
      services.hangoutState.voteCounts.stars = index; // Reset to index

      const message = {
        name: 'playedOneTimeAnimation',
        params: {
          userUuid: 'test-dj',
          animation: 'emoji',
          emoji: emoji
        }
      };

      playedOneTimeAnimation( message, {}, services );

      expect( services.hangoutState.voteCounts.stars ).toBe( index + 1 );
    } );

    // Test non-snag emojis - none should increment stars
    nonSnagEmojis.forEach( ( emoji ) => {
      services.hangoutState.voteCounts.stars = 10; // Reset

      const message = {
        name: 'playedOneTimeAnimation',
        params: {
          userUuid: 'test-dj',
          animation: 'emoji',
          emoji: emoji
        }
      };

      playedOneTimeAnimation( message, {}, services );

      expect( services.hangoutState.voteCounts.stars ).toBe( 10 ); // Unchanged
    } );
  } );
} );
