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

      // Phase 5: Clear escort flag when user disconnects from room
      if ( services.dataService ) {
        try {
          const escortQueue = services.dataService.getValue( 'escortQueue' ) || {};
          if ( escortQueue[ userUUID ] ) {
            delete escortQueue[ userUUID ];
            services.dataService.setValue( 'escortQueue', escortQueue );
            services.logger.debug( `userLeft handler: cleared escortme flag for ${ userUUID }` );
          }
        } catch ( err ) {
          services.logger.error( `userLeft handler: error clearing escort flag for ${ userUUID }`, err );
        }
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

/**
 * Normalized handler for userLeft events (works with both Hang and Wavez)
 * Handles cleanup when a user leaves the room: AFK removal, escort flag cleanup, private message tracking cleanup
 * @param {Object} event - Normalized userLeft event with payload.userId
 * @param {Object} context - Context object with services
 */
async function handleUserLeftEvent ( event, context ) {
  const userId = event.payload?.userId;
  const services = context.services;

  if ( !userId || !services ) {
    services?.logger?.debug?.( 'handleUserLeftEvent: missing userId or services' );
    return;
  }

  try {
    services.logger?.debug?.( `User ${ userId } left the room` );

    // Remove user from AFK monitor
    if ( services.afkService ) {
      services.afkService.removeUser( userId );
    }

    // Clear escort flag when user disconnects from room
    if ( services.dataService ) {
      try {
        const escortQueue = services.dataService.getValue( 'escortQueue' ) || {};
        if ( escortQueue[ userId ] ) {
          delete escortQueue[ userId ];
          services.dataService.setValue( 'escortQueue', escortQueue );
          services.logger?.debug?.( `handleUserLeftEvent: cleared escortme flag for ${ userId }` );
        }
      } catch ( err ) {
        services.logger?.error?.( `handleUserLeftEvent: error clearing escort flag for ${ userId }: ${ err.message }` );
      }
    }

    // Remove private message tracking for the user who left
    if ( services.bot && typeof services.bot.removePrivateMessageTrackingForUser === 'function' ) {
      try {
        await services.bot.removePrivateMessageTrackingForUser( userId );
        services.logger?.debug?.( `✅ Private message tracking removed for user who left: ${ userId }` );
      } catch ( error ) {
        services.logger?.warn?.( `handleUserLeftEvent: Failed to remove private message tracking for user ${ userId }: ${ error.message }` );
      }
    } else {
      services.logger?.debug?.( 'handleUserLeftEvent: Bot instance not available for private message tracking removal' );
    }

    // Update state: remove user from usersById
    if ( services.stateService ) {
      const state = services.stateService.getState();
      if ( state && state.usersById && state.usersById[ userId ] ) {
        delete state.usersById[ userId ];
        services.logger?.debug?.( `handleUserLeftEvent: Removed user ${ userId } from state.usersById` );
      }
    }

  } catch ( error ) {
    services.logger?.error?.( `[handleUserLeftEvent] Error: ${ error.message }` );
  }
}

module.exports = userLeft;
module.exports.handleUserLeftEvent = handleUserLeftEvent;
