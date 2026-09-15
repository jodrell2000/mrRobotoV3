/**
 * Updates the stored previous song vote counts from vote patches
 * @param {Object} message - The stateful message containing vote patches
 * @param {Object} services - Services container
 */
function updatePreviousSongVoteCounts ( message, services ) {
  // Only update if we have a stored previous song
  if ( !global.previousPlayedSong ) {
    services.logger.debug( '[votedOnSong] No previous song stored to update vote counts' );
    return;
  }

  const statePatch = message.statePatch || [];
  let updated = false;

  for ( const patch of statePatch ) {
    if ( patch.op === 'replace' ) {
      if ( patch.path === '/voteCounts/likes' ) {
        global.previousPlayedSong.voteCounts = global.previousPlayedSong.voteCounts || {};
        global.previousPlayedSong.voteCounts.likes = patch.value;
        updated = true;
        services.logger.debug( `[votedOnSong] Updated previous song likes to: ${ patch.value }` );
      } else if ( patch.path === '/voteCounts/dislikes' ) {
        global.previousPlayedSong.voteCounts = global.previousPlayedSong.voteCounts || {};
        global.previousPlayedSong.voteCounts.dislikes = patch.value;
        updated = true;
        services.logger.debug( `[votedOnSong] Updated previous song dislikes to: ${ patch.value }` );
      } else if ( patch.path === '/voteCounts/stars' ) {
        global.previousPlayedSong.voteCounts = global.previousPlayedSong.voteCounts || {};
        global.previousPlayedSong.voteCounts.stars = patch.value;
        updated = true;
        services.logger.debug( `[votedOnSong] Updated previous song stars to: ${ patch.value }` );
      }
    }
  }
}

function votedOnSong ( message, state, services ) {
  services.logger.debug( 'votedOnSong handler called' );

  try {
    // Emit normalized voteChanged event if not already emitted via translator
    // (This ensures the normalized handler runs for legacy Hang messages)
    const votes = extractVotesFromMessage( message );
    if ( votes && services.eventDispatcher ) {
      const event = {
        type: 'voteChanged',
        eventId: `voteChanged:${ Date.now() }`,
        occurredAt: new Date().toISOString(),
        source: 'hangfm',
        payload: { votes }
      };
      services.eventDispatcher.dispatch( event, { bot: services.bot, services } );
    }

    // Also run legacy logic for backward compatibility during transition
    updatePreviousSongVoteCounts( message, services );

    if ( services.afkService ) {
      const voteOps = ( message.statePatch || [] ).filter(
        p => /^\/allUserData\/[^/]+\/songVotes\//.test( p.path )
      );
      for ( const op of voteOps ) {
        const uuid = op.path.split( '/' )[ 2 ];
        if ( uuid ) services.afkService.recordActivity( uuid, 'vote' );
      }
    }
  } catch ( error ) {
    services.logger.error( `Error in votedOnSong handler: ${ error.message }` );
  }
}

/**
 * Extracts vote counts from a stateful message's statePatch
 * @param {Object} message - The stateful message containing vote patches
 * @returns {Object|null} Vote counts object or null
 */
function extractVotesFromMessage ( message ) {
  const statePatch = message.statePatch || [];
  const votes = {};
  let hasVotes = false;

  for ( const patch of statePatch ) {
    if ( patch.op === 'replace' ) {
      if ( patch.path === '/voteCounts/likes' ) {
        votes.likes = patch.value;
        hasVotes = true;
      } else if ( patch.path === '/voteCounts/dislikes' ) {
        votes.dislikes = patch.value;
        hasVotes = true;
      } else if ( patch.path === '/voteCounts/stars' ) {
        votes.stars = patch.value;
        hasVotes = true;
      }
    }
  }

  return hasVotes ? votes : null;
}

/**
 * Normalized handler for voteChanged events (works with both Hang and Wavez)
 * Updates global.previousPlayedSong vote counts and records AFK activity
 * @param {Object} event - Normalized voteChanged event with payload.votes and optional payload.userId
 * @param {Object} context - Handler context containing services
 */
async function handleVotedOnSongEvent ( event, context ) {
  const services = context.services;
  if ( !services ) {
    console.error( '[handleVotedOnSongEvent] No services provided in context' );
    return;
  }

  try {
    const votes = event.payload?.votes;
    const userId = event.payload?.userId;
    const voteType = event.payload?.voteType;
    const active = event.payload?.active !== false; // default to true

    if ( !votes ) {
      services.logger?.debug?.( '[handleVotedOnSongEvent] No votes in event payload' );
      return;
    }

    // Framework-agnostic vote field mapping
    const frameworkId = services.frameworkSpecification?.id;
    const isWavez = frameworkId === 'wavezfm';
    
    // Update global.previousPlayedSong vote counts
    if ( global.previousPlayedSong ) {
      global.previousPlayedSong.voteCounts = global.previousPlayedSong.voteCounts || {};
      
      // Map normalized vote types to the storage format
      if ( votes.likes !== undefined ) {
        global.previousPlayedSong.voteCounts.likes = votes.likes || 0;
      }
      if ( votes.dislikes !== undefined ) {
        global.previousPlayedSong.voteCounts.dislikes = votes.dislikes || 0;
      }
      // For Wavez: grabs -> stars for storage compatibility
      // For Hang: stars is already stars
      if ( votes.grabs !== undefined ) {
        global.previousPlayedSong.voteCounts.stars = votes.grabs || 0;
      }
      if ( votes.stars !== undefined ) {
        global.previousPlayedSong.voteCounts.stars = votes.stars || 0;
      }

      services.logger?.debug?.( `[handleVotedOnSongEvent] Updated previous song vote counts: ${ JSON.stringify( global.previousPlayedSong.voteCounts ) }` );
    }

    // Record AFK activity for the user who voted (if userId is available)
    if ( userId && services.afkService && active ) {
      services.afkService.recordActivity( userId, 'vote' );
      services.logger?.debug?.( `[handleVotedOnSongEvent] Recorded vote activity for user: ${ userId }` );
    }

  } catch ( error ) {
    services.logger?.error?.( `[handleVotedOnSongEvent] Error: ${ error.message }` );
    services.logger?.error?.( `[handleVotedOnSongEvent] Stack: ${ error.stack }` );
  }
}

module.exports = votedOnSong;
module.exports.handleVotedOnSongEvent = handleVotedOnSongEvent;
