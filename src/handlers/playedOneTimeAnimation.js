const services = require( '../services/serviceContainer.js' );

/**
 * Checks if an emoji is a snag emoji that should count as a star
 * @param {string} emoji - The emoji to check
 * @returns {boolean} True if it's a snag emoji
 */
function isSnagEmoji ( emoji ) {
  const snagEmojis = [ '💜', '⭐️' ];
  return snagEmojis.includes( emoji );
}

/**
 * Updates the stored previous song vote counts from the current hangout state
 * @param {Object} services - Services container
 */
function updatePreviousSongVoteCountsFromState ( services ) {
  // Only update if we have a stored previous song
  if ( !global.previousPlayedSong ) {
    services.logger.debug( '[playedOneTimeAnimation] No previous song stored to update vote counts' );
    return;
  }

  // Get current vote counts from hangout state
  const voteCounts = services.hangoutState?.voteCounts;
  if ( voteCounts ) {
    global.previousPlayedSong.voteCounts = {
      likes: voteCounts.likes || 0,
      dislikes: voteCounts.dislikes || 0,
      stars: voteCounts.stars || 0
    };

    services.logger.debug( '[playedOneTimeAnimation] Updated previous song vote counts from state' );
  } else {
    services.logger.debug( '[playedOneTimeAnimation] No vote counts found in hangout state' );
  }
}

/**
 * Handles snag emoji as a star vote by incrementing the star count
 * @param {Object} message - The message containing emoji info
 * @param {Object} services - Services container
 */
function handleSnagEmojiVote ( message, services ) {
  const emoji = message.params?.emoji;

  if ( !emoji ) {
    services.logger.debug( '[playedOneTimeAnimation] No emoji in message' );
    return;
  }

  if ( !isSnagEmoji( emoji ) ) {
    services.logger.debug( `[playedOneTimeAnimation] Emoji ${ emoji } is not a snag emoji` );
    return;
  }

  services.logger.info( `[playedOneTimeAnimation] Snag emoji ${ emoji } detected - counting as star vote` );

  // Increment stars in hangout state for currently playing song
  if ( services.hangoutState?.voteCounts ) {
    const currentStars = services.hangoutState.voteCounts.stars || 0;
    services.hangoutState.voteCounts.stars = currentStars + 1;
    services.logger.info( `[playedOneTimeAnimation] Incremented current song stars from ${ currentStars } to ${ services.hangoutState.voteCounts.stars }` );
  } else {
    services.logger.debug( '[playedOneTimeAnimation] No vote counts in hangout state to update' );
  }

  // Also update stored previous song if it's the same song (in case this is still the "previous" song)
  if ( global.previousPlayedSong?.voteCounts ) {
    const userUuid = message.params?.userUuid;
    const currentDj = services.hangoutState?.djs?.[ 0 ]?.uuid;

    // Only increment previous song stars if this snag is from the current DJ playing that song
    if ( userUuid && currentDj && userUuid === currentDj ) {
      const previousStars = global.previousPlayedSong.voteCounts.stars || 0;
      global.previousPlayedSong.voteCounts.stars = previousStars + 1;
      services.logger.info( `[playedOneTimeAnimation] Also incremented previous song stars from ${ previousStars } to ${ global.previousPlayedSong.voteCounts.stars }` );
    }
  }
}

function playedOneTimeAnimation ( message, state, services ) {
  services.logger.debug( 'playedOneTimeAnimation handler called' );

  try {
    // Handle snag emoji as star vote
    handleSnagEmojiVote( message, services );

    // Update previous song vote counts from state (as before)
    updatePreviousSongVoteCountsFromState( services );
  } catch ( error ) {
    services.logger.error( `Error in playedOneTimeAnimation handler: ${ error.message }` );
  }
}

module.exports = playedOneTimeAnimation;
