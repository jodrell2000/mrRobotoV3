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

        // Emit specific djAdded/djRemoved events for position 0 (the decks)
        if ( messageName === 'addedDj' || ( message.statePatch && message.statePatch.some( p => p.op === 'add' && p.path === '/djs/0' ) ) ) {
            const djPatch = message.statePatch?.find( p => p.op === 'add' && p.path === '/djs/0' );
            const userId = djPatch?.value?.uuid;
            const nickname = userId && currentState?.usersById?.[ userId ]?.nickname || userId;
            if ( userId ) {
                events.push( createEvent( 'djAdded', {
                    userId,
                    nickname,
                    position: 0
                }, { ...options, eventKey: `djAdded:${ userId }` } ) );
            }
        }

        if ( messageName === 'removedDj' || ( message.statePatch && message.statePatch.some( p => p.op === 'remove' && p.path === '/djs/0' ) ) ) {
            const djPatch = message.statePatch?.find( p => p.op === 'remove' && p.path === '/djs/0' );
            const userId = djPatch?.value?.uuid || djPatch?.path?.split( '/' )[ 2 ];
            const nickname = userId && currentState?.usersById?.[ userId ]?.nickname || userId;
            if ( userId ) {
                events.push( createEvent( 'djRemoved', {
                    userId,
                    nickname,
                    position: 0
                }, { ...options, eventKey: `djRemoved:${ userId }` } ) );
            }
        }
    }

    if ( messageName === 'userJoined' || userPatch?.op === 'add' ) {
        const userId = paths.find( path => path.startsWith( '/allUserData/' ) )?.split( '/' )[ 2 ];
        const user = userId && currentState?.usersById?.[ userId ];
        events.push( createEvent( 'userJoined', {
            userId,
            user: user || { id: userId } // Fallback to minimal user object if full data not available
        }, { ...options, eventKey: messageName || paths.join( ',' ) } ) );
    }

    if ( messageName === 'userLeft' || userPatch?.op === 'remove' ) {
        events.push( createEvent( 'userLeft', {
            userId: paths.find( path => path.startsWith( '/allUserData/' ) )?.split( '/' )[ 2 ]
        }, { ...options, eventKey: messageName || paths.join( ',' ) } ) );
    }

    if ( paths.some( path => path.startsWith( '/voteCounts/' ) ) ) {
        const voteEvent = { votes: currentState.votes };
        
        // Check for user-specific vote patches and include user info
        const userVotePatch = message.statePatch?.find( p => 
            p.path?.startsWith( '/allUserData/' ) && p.path?.includes( '/songVotes/' ) 
        );
        if ( userVotePatch ) {
            const userId = userVotePatch.path.split( '/' )[ 2 ];
            if ( userId ) {
                voteEvent.userId = userId;
                // Determine vote type from path
                if ( userVotePatch.path.includes( '/likes/' ) ) voteEvent.voteType = 'like';
                else if ( userVotePatch.path.includes( '/dislikes/' ) ) voteEvent.voteType = 'dislike';
                else if ( userVotePatch.path.includes( '/stars/' ) ) voteEvent.voteType = 'star';
                voteEvent.active = userVotePatch.op === 'add' || userVotePatch.op === 'replace';
            }
        }
        
        events.push( createEvent( 'voteChanged', voteEvent, { ...options, eventKey: paths.join( ',' ) } ) );
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
