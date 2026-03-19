function updatedNextSong ( message, state, services ) {
    services.logger.debug( 'updatedNextSong handler called' );

    if ( !services.afkService || !services.stateService ) return;

    const patch = ( message.statePatch || [] ).find(
        p => /^\/djs\/\d+\/nextSong\//.test( p.path )
    );
    if ( !patch ) return;

    const djIndex = parseInt( patch.path.split( '/' )[ 2 ], 10 );
    const uuid = services.stateService._getDjs()[ djIndex ]?.uuid;

    if ( !uuid ) {
        services.logger.debug( `updatedNextSong handler: no DJ found at index ${ djIndex }` );
        return;
    }

    services.afkService.recordActivity( uuid, 'queue' );
}

module.exports = updatedNextSong;
