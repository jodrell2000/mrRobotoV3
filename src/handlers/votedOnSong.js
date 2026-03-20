const services = require( '../services/serviceContainer.js' );

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

module.exports = votedOnSong;
