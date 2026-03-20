/**
 * Handler for when a user leaves the hangout
 * @param {Object} message - The stateful message containing user data
 * @param {Object} state - The current hangout state
 * @param {Object} services - Services container
 */
async function userLeft ( message, state, services ) {
  services.logger.debug( 'userLeft.js handler called' );

  try {
    // Check if state is available - during shutdown, state might not be set
    if ( !state || !services.stateService ) {
      services.logger.debug( 'State not available, skipping userLeft processing' );
      return;
    }

    // Look for the patch operation that removes user data
    const userDataRemovePatch = message.statePatch?.find( patch =>
      patch.op === 'remove' &&
      patch.path.startsWith( '/allUserData/' )
    );

    if ( userDataRemovePatch ) {
      const userUUID = userDataRemovePatch.path.split( '/' )[ 2 ]; // Extract UUID from path like /allUserData/uuid

      if ( !userUUID ) {
        services.logger.warn( 'No user UUID found in remove patch path' );
        return;
      }

      services.logger.debug( `User ${ userUUID } left the hangout` );

      // Remove user from AFK monitor
      if ( services.afkService ) {
        services.afkService.removeUser( userUUID );
      }

      // Remove private message tracking for the user who left
      if ( services.bot && typeof services.bot.removePrivateMessageTrackingForUser === 'function' ) {
        try {
          await services.bot.removePrivateMessageTrackingForUser( userUUID );
          services.logger.debug( `✅ Private message tracking removed for user who left: ${ userUUID }` );
        } catch ( error ) {
          services.logger.warn( `Failed to remove private message tracking for user ${ userUUID }: ${ error.message }` );
        }
      } else {
        services.logger.debug( 'Bot instance not available for private message tracking removal' );
      }
    } else {
      services.logger.debug( 'No user data remove patch found in userLeft message' );
    }
  } catch ( error ) {
    services.logger.error( `Error processing userLeft message: ${ error.message }` );
  }
}

module.exports = userLeft;
