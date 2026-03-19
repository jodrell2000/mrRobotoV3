function addedDj ( message, state, services ) {
  services.logger.debug( 'addedDj.js handler called' );

  const djPatch = message.statePatch?.find( p => p.op === 'add' && p.path === '/djs/0' );
  const uuid = djPatch?.value?.uuid;

  if ( !uuid ) {
    services.logger.debug( 'addedDj handler: no UUID found in patch' );
    return;
  }

  const nickname = services.stateService?._getCurrentState()?.allUserData?.[ uuid ]?.userProfile?.nickname || uuid;

  if ( services.afkService ) {
    services.afkService.addUser( uuid, nickname );
    services.afkService.recordActivity( uuid, 'joinedDecks' );
  }

  services.logger.debug( `addedDj handler: recorded joinedDecks activity for ${ uuid } (${ nickname })` );
}

module.exports = addedDj;
