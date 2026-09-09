const normalizeHangState = require( './normalizeHangState.js' );

function createEvent ( type, payload, options ) {
    const event = {
        type,
        eventId: options.eventId || `${ type }:${ options.eventKey || Date.now() }`,
        roomId: options.roomId,
        occurredAt: options.occurredAt || new Date().toISOString(),
        source: 'hangfm',
        payload
    };

    if ( options.includeRaw ) event.raw = options.raw;
    return event;
}

function getPatchPaths ( message ) {
    return Array.isArray( message?.statePatch ) ? message.statePatch.map( patch => patch.path ) : [];
}

function getUserPatch ( message ) {
    return message?.statePatch?.find( patch => {
        return patch.path?.startsWith( '/allUserData/' ) && patch.path.split( '/' ).length === 3;
    } );
}

function translatePlaybackEvents ( message, previousState, currentState, options ) {
    const events = [];
    const previousNowPlaying = previousState?.nowPlaying || null;
    const currentNowPlaying = currentState?.nowPlaying || null;
    const previousPlayId = previousNowPlaying?.playId;
    const currentPlayId = currentNowPlaying?.playId;
    const playbackReplaced = previousNowPlaying && currentNowPlaying && previousPlayId !== currentPlayId;
    const playbackEnded = previousNowPlaying && ( !currentNowPlaying || playbackReplaced );
    const playbackStarted = currentNowPlaying && ( !previousNowPlaying || playbackReplaced );

    if ( playbackEnded ) {
        events.push( createEvent( 'trackEnded', {
            playback: previousNowPlaying,
            playId: previousPlayId,
            dedupeKey: `trackEnded:${ previousPlayId || previousNowPlaying.startedAt || 'unknown' }`
        }, { ...options, eventKey: previousPlayId || previousNowPlaying.startedAt } ) );
    }

    if ( playbackStarted ) {
        events.push( createEvent( 'trackStarted', {
            playback: currentNowPlaying,
            playId: currentPlayId
        }, { ...options, eventKey: currentPlayId || currentNowPlaying.startedAt } ) );
    }

    if ( !playbackReplaced && currentNowPlaying && previousNowPlaying && currentPlayId === previousPlayId ) {
        const paths = getPatchPaths( message );
        if ( paths.some( path => path.startsWith( '/nowPlaying/song/' ) ) ) {
            events.push( createEvent( 'trackMetadataUpdated', {
                playback: currentNowPlaying,
                playId: currentPlayId
            }, { ...options, eventKey: `${ currentPlayId || 'current' }:metadata` } ) );
        }
    }

    return events;
}

function translateHangEvent ( message, context = {} ) {
    const options = {
        roomId: context.roomId,
        occurredAt: context.occurredAt,
        includeRaw: context.includeRaw,
        raw: message
    };
    const previousState = context.previousState;
    const currentState = context.currentState || normalizeHangState( previousState, context.config );
    const events = [];
    const paths = getPatchPaths( message );
    const messageName = message?.name;
    const userPatch = getUserPatch( message );

    if ( context.initialState && context.currentState ) {
        events.push( createEvent( 'roomStateReceived', {
            state: currentState
        }, { ...options, eventKey: 'initial' } ) );
    }

    if ( messageName === 'addedDj' || messageName === 'removedDj' || paths.some( path => path.startsWith( '/djs/' ) ) ) {
        events.push( createEvent( 'djQueueChanged', {
            djQueue: currentState.djQueue,
            reason: messageName || 'statePatch'
        }, { ...options, eventKey: messageName || paths.join( ',' ) } ) );
    }

    if ( messageName === 'userJoined' || userPatch?.op === 'add' ) {
        events.push( createEvent( 'userJoined', {
            userId: paths.find( path => path.startsWith( '/allUserData/' ) )?.split( '/' )[ 2 ]
        }, { ...options, eventKey: messageName || paths.join( ',' ) } ) );
    }

    if ( messageName === 'userLeft' || userPatch?.op === 'remove' ) {
        events.push( createEvent( 'userLeft', {
            userId: paths.find( path => path.startsWith( '/allUserData/' ) )?.split( '/' )[ 2 ]
        }, { ...options, eventKey: messageName || paths.join( ',' ) } ) );
    }

    if ( paths.some( path => path.startsWith( '/voteCounts/' ) ) ) {
        events.push( createEvent( 'voteChanged', {
            votes: currentState.votes
        }, { ...options, eventKey: paths.join( ',' ) } ) );
    }

    if ( paths.some( path => path.startsWith( '/settings/' ) ) ) {
        events.push( createEvent( 'roomSettingsChanged', {
            roomSettings: currentState.roomSettings
        }, { ...options, eventKey: paths.join( ',' ) } ) );
    }

    events.push( ...translatePlaybackEvents( message, previousState, currentState, options ) );
    return events;
}

module.exports = translateHangEvent;
