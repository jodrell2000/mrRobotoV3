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

  // Phase 4: Clear escort flag when user leaves decks
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
}

module.exports = removedDj;
