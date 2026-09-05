const { logger } = require( '../lib/logging.js' );

const hangSocketServices = {
  /**
   * Send an upvote for the current song
   * @param {Object} services - The services container with socketAdapter
   */
  upVote: async function ( services ) {
    try {
      if ( !services || !services.socketAdapter ) {
        throw new Error( 'Socket adapter not available - ensure serviceContainer is initialized' );
      }

      logger.debug( `hangSocketServices.upVote: Sending upvote` );

      await services.socketAdapter.voteOnSong( services.config.BOT_UID, 'upvote' );

      logger.debug( `hangSocketServices.upVote: Successfully sent upvote` );
    } catch ( err ) {
      logger.error( `hangSocketServices.upVote: Error sending upvote - ${ err.message }` );
      throw err;
    }
  },

  /**
   * Send a downvote for the current song
   * @param {Object} services - The services container with socketAdapter
   */
  downVote: async function ( services ) {
    try {
      if ( !services || !services.socketAdapter ) {
        throw new Error( 'Socket adapter not available - ensure serviceContainer is initialized' );
      }

      logger.debug( `hangSocketServices.downVote: Sending downvote` );

      await services.socketAdapter.voteOnSong( services.config.BOT_UID, 'downvote' );

      logger.debug( `hangSocketServices.downVote: Successfully sent downvote` );
    } catch ( err ) {
      logger.error( `hangSocketServices.downVote: Error sending downvote - ${ err.message }` );
      throw err;
    }
  },

  /**
   * Remove a DJ from the decks
   * @param {Object} services - The services container with socketAdapter
   * @param {string} djUuid - The UUID of the DJ to remove
   */
  removeDj: async function ( services, djUuid ) {
    try {
      if ( !services || !services.socketAdapter ) {
        throw new Error( 'Socket adapter not available - ensure serviceContainer is initialized' );
      }

      logger.debug( `hangSocketServices.removeDj: Removing DJ ${ djUuid }` );

      await services.socketAdapter.removeDj( djUuid );

      logger.debug( `hangSocketServices.removeDj: Successfully removed DJ ${ djUuid }` );
    } catch ( err ) {
      const message = err instanceof Error ? err.message : String( err );
      logger.error( `hangSocketServices.removeDj: Error removing DJ ${ djUuid } - ${ message }` );
      logger.debug( `hangSocketServices.removeDj: raw error value:`, err );
      throw err instanceof Error ? err : new Error( message );
    }
  },

  /**
   * Skip the current song
   * @param {Object} services - The services container with socketAdapter
   */
  skipSong: async function ( services ) {
    try {
      if ( !services || !services.socketAdapter ) {
        throw new Error( 'Socket adapter not available - ensure serviceContainer is initialized' );
      }

      logger.debug( `hangSocketServices.skipSong: Skipping song` );

      await services.socketAdapter.skipSong();

      logger.debug( `hangSocketServices.skipSong: Successfully skipped song` );
    } catch ( err ) {
      const message = err instanceof Error ? err.message : String( err );
      logger.error( `hangSocketServices.skipSong: Error skipping song - ${ message }` );
      throw err instanceof Error ? err : new Error( message );
    }
  }
};

module.exports = {
  hangSocketServices
};
