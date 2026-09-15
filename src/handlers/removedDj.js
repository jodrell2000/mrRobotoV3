function removedDj ( message, state, services ) {
  const audiencePatch = message.statePatch?.find(
    p => p.op === 'add' && /^\/audienceUsers\/\d+$/.test( p.path )
  );
  const uuid = audiencePatch?.value?.uuid;
  if ( !uuid ) {
    services.logger.debug( 'removedDj handler: no UUID found in patch' );
    return;
  }
  if ( services.afkService ) {
    services.afkService.recordActivity( uuid, 'leftDecks' );
  }
  services.logger.debug( `removedDj handler: recorded leftDecks activity for ${ uuid }` );

  // Clear escort flag when user leaves decks
  if ( services.dataService ) {
    try {
      const escortQueue = services.dataService.getValue( 'escortQueue' ) || {};
      if ( escortQueue[ uuid ] ) {
        delete escortQueue[ uuid ];
        services.dataService.setValue( 'escortQueue', escortQueue );
        services.logger.debug( `removedDj handler: cleared escortme flag for ${ uuid }` );
      }
    } catch ( err ) {
      services.logger.error( `removedDj handler: error clearing escort flag for ${ uuid }`, err );
    }
  }

  // Emit normalized djRemoved event for the normalized handler to process
  if ( services.eventDispatcher ) {
    const event = {
      type: 'djRemoved',
      eventId: `djRemoved:${ uuid }`,
      occurredAt: new Date().toISOString(),
      source: 'hangfm',
      payload: {
        userId: uuid
      }
    };
    services.eventDispatcher.dispatch( event, { bot: services.bot, services } );
  }
}

/**
 * Normalized handler for djRemoved events (works with both Hang and Wavez)
 * Records leftDecks activity and clears escort flag for the user
 * @param {Object} event - Normalized djRemoved event with payload.userId
 * @param {Object} context - Handler context containing services
 */
async function handleRemovedDjEvent ( event, context ) {
  const services = context.services;
  if ( !services ) {
    console.error( '[handleRemovedDjEvent] No services provided in context' );
    return;
  }

  try {
    const userId = event.payload?.userId;

    if ( !userId ) {
      services.logger?.debug?.( '[handleRemovedDjEvent] No userId in event payload' );
      return;
    }

    // Record leftDecks activity in AFK monitor
    if ( services.afkService ) {
      services.afkService.recordActivity( userId, 'leftDecks' );
      services.logger?.debug?.( `[handleRemovedDjEvent] Recorded leftDecks activity for ${ userId }` );
    }

    // Clear escort flag when user leaves decks
    if ( services.dataService ) {
      try {
        const escortQueue = services.dataService.getValue( 'escortQueue' ) || {};
        if ( escortQueue[ userId ] ) {
          delete escortQueue[ userId ];
          services.dataService.setValue( 'escortQueue', escortQueue );
          services.logger?.debug?.( `[handleRemovedDjEvent] Cleared escortme flag for ${ userId }` );
        }
      } catch ( err ) {
        services.logger?.error?.( `[handleRemovedDjEvent] Error clearing escort flag for ${ userId }: ${ err.message }` );
      }
    }

  } catch ( error ) {
    services.logger?.error?.( `[handleRemovedDjEvent] Error: ${ error.message }` );
    services.logger?.error?.( `[handleRemovedDjEvent] Stack: ${ error.stack }` );
  }
}

module.exports = removedDj;
module.exports.handleRemovedDjEvent = handleRemovedDjEvent;
