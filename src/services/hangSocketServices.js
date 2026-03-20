const { logger } = require( '../lib/logging.js' );
const config = require( '../config.js' );

// Action constants for socket actions
const ActionName = {
  voteOnSong: 'voteOnSong',
  removeDj: 'removeDj',
  skipSong: 'skipSong'
};

const hangSocketServices = {
  /**
   * Send an upvote for the current song
   * @param {Object} socket - The socket connection object
   */
  upVote: async function ( socket ) {
    try {
      logger.debug( `hangSocketServices.upVote: Sending upvote for room ${ config.HANGOUT_ID }` );

      await socket.action( ActionName.voteOnSong, {
        roomUuid: config.HANGOUT_ID,
        userUuid: config.BOT_UID,
        songVotes: { like: true }
      } );

      logger.debug( `hangSocketServices.upVote: Successfully sent upvote` );
    } catch ( err ) {
      logger.error( `hangSocketServices.upVote: Error sending upvote - ${ err.message }` );
      throw err;
    }
  },

  /**
   * Send a downvote for the current song
   * @param {Object} socket - The socket connection object
   */
  downVote: async function ( socket ) {
    try {
      logger.debug( `hangSocketServices.downVote: Sending downvote for room ${ config.HANGOUT_ID }` );

      await socket.action( ActionName.voteOnSong, {
        roomUuid: config.HANGOUT_ID,
        userUuid: config.BOT_UID,
        songVotes: { like: false }
      } );

      logger.debug( `hangSocketServices.downVote: Successfully sent downvote` );
    } catch ( err ) {
      logger.error( `hangSocketServices.downVote: Error sending downvote - ${ err.message }` );
      throw err;
    }
  },

  /**
   * Remove a DJ from the decks
   * @param {Object} socket - The socket connection object
   * @param {string} djUuid - The UUID of the DJ to remove
   */
  removeDj: async function ( socket, djUuid ) {
    try {
      logger.debug( `hangSocketServices.removeDj: Removing DJ ${ djUuid } from room ${ config.HANGOUT_ID }` );
      logger.debug( `hangSocketServices.removeDj: userUuid (bot) = ${ config.BOT_UID }` );

      await socket.action( ActionName.removeDj, {
        roomUuid: config.HANGOUT_ID,
        userUuid: config.BOT_UID,
        djUuid
      } );

      logger.debug( `hangSocketServices.removeDj: Successfully removed DJ ${ djUuid }` );
    } catch ( err ) {
      const message = err instanceof Error ? err.message : String( err );
      logger.error( `hangSocketServices.removeDj: Error removing DJ ${ djUuid } - ${ message }` );
      logger.debug( `hangSocketServices.removeDj: raw error value:`, err );
      throw err instanceof Error ? err : new Error( message );
    }
  },

  skipSong: async function ( socket ) {
    try {
      logger.debug( `hangSocketServices.skipSong: Skipping song in room ${ config.HANGOUT_ID }` );

      await socket.action( ActionName.skipSong, {
        roomUuid: config.HANGOUT_ID,
        userUuid: config.BOT_UID
      } );

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
