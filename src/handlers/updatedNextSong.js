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

/**
 * Normalized handler for nextSongUpdated events
 * Records AFK activity when a DJ updates their next song selection
 * @param {Object} event - Normalized nextSongUpdated event with payload.userId
 * @param {Object} context - Context object with services
 */
function handleUpdatedNextSongEvent ( event, context ) {
    const userId = event.payload?.userId;
    const services = context.services;

    if ( !userId || !services ) {
        services?.logger?.debug?.( 'handleUpdatedNextSongEvent: missing userId or services' );
        return;
    }

    if ( !services.afkService ) {
        services.logger?.debug?.( 'handleUpdatedNextSongEvent: afkService not available' );
        return;
    }

    try {
        services.afkService.recordActivity( userId, 'queue' );
        services.logger?.debug?.( `handleUpdatedNextSongEvent: Recorded queue activity for user ${ userId }` );
    } catch ( error ) {
        services.logger?.error?.( `[handleUpdatedNextSongEvent] Error: ${ error.message }` );
    }
}

module.exports = updatedNextSong;
module.exports.handleUpdatedNextSongEvent = handleUpdatedNextSongEvent;
