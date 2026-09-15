// Framework-agnostic justPlayed/nowPlaying chat announcements, driven only by
// normalized trackStarted/trackEnded events (works identically for Hang and Wavez)

function formatTemplate ( template, values ) {
    return Object.entries( values ).reduce(
        ( text, [ key, value ] ) => text.split( `{${ key }}` ).join( value ?? 0 ),
        template
    );
}

/**
 * Announces the just-finished song with vote counts to the public chat
 * @param {Object} event - Normalized trackEnded event
 * @param {Object} services - Services container
 */
async function announceTrackEnded ( event, services ) {
    if ( !services.featuresService.isFeatureEnabled( 'justPlayed' ) ) return;

    const playback = event.payload?.playback;
    const song = playback?.song;
    if ( !playback?.djId || !song?.artist || !song?.title ) return;

    try {
        let messageTemplate = services.dataService.getValue( 'editableMessages.justPlayedMessage' );
        if ( !messageTemplate ) {
            messageTemplate = services.dataService.getValue( 'justPlayedMessage' ) ||
                `{username} played...
      {trackName} by {artistName}
      Stats: 👍 {likes} 👎 {dislikes} ❤️ {stars}`;
        }

        const votes = services.stateService?.getVotes?.() || { likes: 0, dislikes: 0, grabs: 0 };
        const djMention = services.messageService.formatMention( playback.djId, services );

        const announcement = formatTemplate( messageTemplate, {
            username: djMention,
            trackName: song.title,
            artistName: song.artist,
            likes: votes.likes || 0,
            dislikes: votes.dislikes || 0,
            stars: votes.grabs ?? votes.stars ?? 0
        } );

        await services.messageService.sendResponse( announcement, { responseChannel: 'public', services } );
    } catch ( error ) {
        services.logger.error( `[trackAnnouncer] Failed to announce just played song: ${ error.message }` );
    }
}

/**
 * Announces the new song to the public chat
 * @param {Object} event - Normalized trackStarted event
 * @param {Object} services - Services container
 */
async function announceTrackStarted ( event, services ) {
    if ( !services.featuresService.isFeatureEnabled( 'nowPlayingMessage' ) ) return;

    const playback = event.payload?.playback;
    const song = playback?.song;
    if ( !playback?.djId || !song?.artist || !song?.title ) return;

    try {
        let messageTemplate = services.dataService.getValue( 'editableMessages.nowPlayingMessage' );
        if ( !messageTemplate ) {
            messageTemplate = services.dataService.getValue( 'nowPlayingMessage' ) || '{username} is now playing {trackName} by {artistName}';
        }

        const djMention = services.messageService.formatMention( playback.djId, services );

        const announcement = formatTemplate( messageTemplate, {
            username: djMention,
            trackName: song.title,
            artistName: song.artist
        } );

        await services.messageService.sendResponse( announcement, { responseChannel: 'public', services } );
    } catch ( error ) {
        services.logger.error( `[trackAnnouncer] Failed to announce song: ${ error.message }` );
    }
}

module.exports = { announceTrackEnded, announceTrackStarted };
