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
}

module.exports = removedDj;
