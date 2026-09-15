function addedDj ( message, state, services ) {
  services.logger.debug( 'addedDj.js handler called' );

  const djPatch = message.statePatch?.find( p => p.op === 'add' && p.path === '/djs/0' );
  const uuid = djPatch?.value?.uuid;

  if ( !uuid ) {
    services.logger.debug( 'addedDj handler: no UUID found in patch' );
    return;
  }

  const nickname = services.stateService?._getCurrentState()?.allUserData?.[ uuid ]?.userProfile?.nickname || uuid;

  // Emit normalized djAdded event for the normalized handler to process
  if ( services.eventDispatcher ) {
    const event = {
      type: 'djAdded',
      eventId: `djAdded:${ uuid }`,
      occurredAt: new Date().toISOString(),
      source: 'hangfm',
      payload: {
        userId: uuid,
        nickname
      }
    };
    services.eventDispatcher.dispatch( event, { bot: services.bot, services } );
  }

  // Also run legacy logic for backward compatibility during transition
  if ( services.afkService ) {
    services.afkService.addUser( uuid, nickname );
    services.afkService.recordActivity( uuid, 'joinedDecks' );
  }

  services.logger.debug( `addedDj handler: recorded joinedDecks activity for ${ uuid } (${ nickname })` );
}

/**
 * Normalized handler for djAdded events (works with both Hang and Wavez)
 * Adds user to AFK monitor and records joinedDecks activity
 * @param {Object} event - Normalized djAdded event with payload.userId and payload.nickname
 * @param {Object} context - Handler context containing services
 */
async function handleAddedDjEvent ( event, context ) {
  const services = context.services;
  if ( !services ) {
    console.error( '[handleAddedDjEvent] No services provided in context' );
    return;
  }

  try {
    const userId = event.payload?.userId;
    const nickname = event.payload?.nickname || userId;

    if ( !userId ) {
      services.logger?.debug?.( '[handleAddedDjEvent] No userId in event payload' );
      return;
    }

    // Get user info from stateService if nickname not provided
    let resolvedNickname = nickname;
    if ( !resolvedNickname || resolvedNickname === userId ) {
      const user = services.stateService?.getUser?.( userId );
      if ( user ) {
        resolvedNickname = user.nickname || user.profile?.nickname || userId;
      }
    }

    // Add user to AFK monitor and record activity
    if ( services.afkService ) {
      services.afkService.addUser( userId, resolvedNickname );
      services.afkService.recordActivity( userId, 'joinedDecks' );
      services.logger?.debug?.( `[handleAddedDjEvent] Recorded joinedDecks activity for ${ userId } (${ resolvedNickname })` );
    }

  } catch ( error ) {
    services.logger?.error?.( `[handleAddedDjEvent] Error: ${ error.message }` );
    services.logger?.error?.( `[handleAddedDjEvent] Stack: ${ error.stack }` );
  }
}

module.exports = addedDj;
module.exports.handleAddedDjEvent = handleAddedDjEvent;
