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
    // services.logger.debug( '[playedOneTimeAnimation] No previous song stored to update vote counts' );
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

    // services.logger.debug( '[playedOneTimeAnimation] Updated previous song vote counts from state' );
  } else {
    // services.logger.debug( '[playedOneTimeAnimation] No vote counts found in hangout state' );
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
    // services.logger.debug( '[playedOneTimeAnimation] No emoji in message' );
    return;
  }

  if ( !isSnagEmoji( emoji ) ) {
    // services.logger.debug( `[playedOneTimeAnimation] Emoji ${ emoji } is not a snag emoji` );
    return;
  }

  // services.logger.info( `[playedOneTimeAnimation] Snag emoji ${ emoji } detected - counting as star vote` );

  // Increment stars in hangout state for currently playing song
  if ( services.hangoutState?.voteCounts ) {
    const currentStars = services.hangoutState.voteCounts.stars || 0;
    services.hangoutState.voteCounts.stars = currentStars + 1;
    services.logger.info( `[playedOneTimeAnimation] Incremented current song stars from ${ currentStars } to ${ services.hangoutState.voteCounts.stars }` );
  } else {
    // services.logger.debug( '[playedOneTimeAnimation] No vote counts in hangout state to update' );
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
  // services.logger.debug( 'playedOneTimeAnimation handler called' );

  try {
    // Emit normalized emojiVote event for the normalized handler to process
    if ( services.eventDispatcher && message.params?.emoji && message.params?.userUuid ) {
      const event = {
        type: 'emojiVote',
        eventId: `emojiVote:${ message.params.userUuid }:${ Date.now() }`,
        occurredAt: new Date().toISOString(),
        source: 'hangfm',
        payload: {
          emoji: message.params.emoji,
          userId: message.params.userUuid
        }
      };
      services.eventDispatcher.dispatch( event, { bot: services.bot, services } );
    }

    // Also run legacy logic for backward compatibility during transition
    // Handle snag emoji as star vote
    handleSnagEmojiVote( message, services );

    // Update previous song vote counts from state (as before)
    updatePreviousSongVoteCountsFromState( services );

    // Record emoji/snag activity in AFK monitor
    if ( message.params?.userUuid && services.afkService ) {
      services.afkService.recordActivity( message.params.userUuid, 'emoji' );
    }
  } catch ( error ) {
    services.logger.error( `Error in playedOneTimeAnimation handler: ${ error.message }` );
  }
}

/**
 * Normalized handler for emoji vote events (works with both Hang and Wavez)
 * Handles snag emoji as star/grab votes using framework-agnostic state access
 * @param {Object} event - Normalized emojiVote event with payload.emoji and payload.userId
 * @param {Object} context - Handler context containing services
 */
async function handlePlayedOneTimeAnimationEvent ( event, context ) {
  const services = context.services;
  if ( !services ) {
    console.error( '[handlePlayedOneTimeAnimationEvent] No services provided in context' );
    return;
  }

  try {
    const emoji = event.payload?.emoji;
    const userId = event.payload?.userId;

    if ( !emoji ) {
      services.logger?.debug?.( '[handlePlayedOneTimeAnimationEvent] No emoji in event payload' );
      return;
    }

    if ( !isSnagEmoji( emoji ) ) {
      services.logger?.debug?.( `[handlePlayedOneTimeAnimationEvent] Emoji ${ emoji } is not a snag emoji` );
      return;
    }

    services.logger?.info?.( `[handlePlayedOneTimeAnimationEvent] Snag emoji ${ emoji } detected - counting as vote` );

    // Determine the vote field name based on framework
    const frameworkId = services.frameworkSpecification?.id;
    const voteField = frameworkId === 'wavezfm' ? 'grabs' : 'stars';

    // Get current votes from stateService
    const currentVotes = services.stateService?.getVotes?.() || { likes: 0, dislikes: 0, stars: 0, grabs: 0 };
    const currentCount = currentVotes[ voteField ] || 0;

    // Increment the appropriate vote count
    const newVotes = { ...currentVotes, [ voteField ]: currentCount + 1 };

    // Update votes via stateService
    if ( services.stateService?.setVotes ) {
      services.stateService.setVotes( newVotes );
      services.logger?.info?.( `[handlePlayedOneTimeAnimationEvent] Incremented current song ${ voteField } from ${ currentCount } to ${ newVotes[ voteField ] }` );
    } else {
      services.logger?.debug?.( '[handlePlayedOneTimeAnimationEvent] stateService.setVotes not available' );
    }

    // Also update stored previous song if it exists
    if ( global.previousPlayedSong?.voteCounts && userId ) {
      const djs = services.stateService?._getDjs?.() || [];
      const currentDj = djs[ 0 ]?.uuid || djs[ 0 ]?.id;

      // Only increment previous song votes if this emoji is from the current DJ playing that song
      if ( currentDj && userId === currentDj ) {
        const previousCount = global.previousPlayedSong.voteCounts[ voteField ] || 0;
        global.previousPlayedSong.voteCounts = {
          ...global.previousPlayedSong.voteCounts,
          [ voteField ]: previousCount + 1
        };
        services.logger?.info?.( `[handlePlayedOneTimeAnimationEvent] Also incremented previous song ${ voteField } from ${ previousCount } to ${ global.previousPlayedSong.voteCounts[ voteField ] }` );
      }
    }

    // Record emoji/snag activity in AFK monitor
    if ( userId && services.afkService ) {
      services.afkService.recordActivity( userId, 'emoji' );
    }

  } catch ( error ) {
    services.logger?.error?.( `[handlePlayedOneTimeAnimationEvent] Error: ${ error.message }` );
    services.logger?.error?.( `[handlePlayedOneTimeAnimationEvent] Stack: ${ error.stack }` );
  }
}

module.exports = playedOneTimeAnimation;
module.exports.handlePlayedOneTimeAnimationEvent = handlePlayedOneTimeAnimationEvent;
