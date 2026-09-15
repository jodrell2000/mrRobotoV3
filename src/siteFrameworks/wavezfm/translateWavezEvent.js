function createEvent ( type, payload, packet, config = {} ) {
    const eventId = packet.payload?.trackId
        ? `${ type }:${ packet.payload.trackId }`
        : `${ type }:${ packet.timestamp || Date.now() }`;

    return {
        type,
        eventId,
        roomId: packet.payload?.roomId || config.WAVEZFM_ROOM_ID,
        occurredAt: packet.timestamp || new Date().toISOString(),
        source: 'wavezfm',
        payload
    };
}

function normalizePlayback ( payload = {} ) {
    return {
        djId: payload.djId || payload.currentDjId,
        song: payload.trackId
            ? {
                id: payload.trackId,
                artist: payload.artist,
                title: payload.title,
                providerIds: payload.sourceId ? { [ payload.source ]: payload.sourceId } : {}
            }
            : undefined,
        playId: payload.trackId,
        startedAt: payload.startedAtServerMs
            ? new Date( payload.startedAtServerMs ).toISOString()
            : undefined
    };
}

// Maps Wavez's vote field names (woots/mehs/grabs) to the normalized votes shape.
// vote_updated nests counts under payload.votesSnapshot; votes_snapshot has them at the top level.
function normalizeVotes ( payload = {} ) {
    const votes = payload.votesSnapshot || payload.votes || payload;
    return {
        likes: votes.woots || 0,
        dislikes: votes.mehs || 0,
        grabs: votes.grabs || 0
    };
}

function translateWavezEvent ( packet = {}, context = {} ) {
    const payload = packet.payload || {};
    const events = [];

    if ( packet.event === 'track_ended' ) {
        events.push( createEvent( 'trackEnded', {
            playback: normalizePlayback( payload ),
            playId: payload.trackId,
            dedupeKey: `trackEnded:${ payload.trackId }`
        }, packet, context.config ) );
    }

    if ( packet.event === 'track_started' ) {
        events.push( createEvent( 'trackStarted', {
            playback: normalizePlayback( payload ),
            playId: payload.trackId
        }, packet, context.config ) );
    }

    if ( packet.event === 'vote_updated' || packet.event === 'votes_snapshot' ) {
        const normalizedVotes = normalizeVotes( payload );
        const voteEvent = { votes: normalizedVotes };
        
        // Include user-specific info for vote_updated events
        if ( packet.event === 'vote_updated' && payload.userId && payload.type ) {
            voteEvent.userId = payload.userId;
            // Map Wavez vote types to normalized vote types
            if ( payload.type === 'woot' ) voteEvent.voteType = 'like';
            else if ( payload.type === 'meh' ) voteEvent.voteType = 'dislike';
            else if ( payload.type === 'grab' ) voteEvent.voteType = 'grab';
            voteEvent.active = payload.active !== false; // default to true
        }
        
        events.push( createEvent( 'voteChanged', voteEvent, packet, context.config ) );
    }

    if ( packet.event === 'queue_joined' ) {
        // User joined the DJ queue - emit djAdded if joining at position 0 (the decks)
        if ( payload.publicPosition === 0 ) {
            events.push( createEvent( 'djAdded', {
                userId: payload.userId,
                nickname: payload.displayUsername || payload.username,
                position: 0
            }, packet, context.config ) );
        }
    }

    if ( packet.event === 'queue_left' ) {
        // User left the DJ queue - emit djRemoved if they were at position 0 (the decks)
        if ( payload.publicPosition === 0 ) {
            events.push( createEvent( 'djRemoved', {
                userId: payload.userId,
                nickname: payload.displayUsername || payload.username,
                position: 0
            }, packet, context.config ) );
        }
    }

    if ( packet.event === 'room_state_snapshot' && context.previousState && context.currentState ) {
        const previousPlayId = context.previousState.nowPlaying?.playId;
        const currentPlayId = context.currentState.nowPlaying?.playId;
        if ( previousPlayId && previousPlayId !== currentPlayId ) {
            events.push( createEvent( 'trackEnded', {
                playback: context.previousState.nowPlaying,
                playId: previousPlayId,
                dedupeKey: `trackEnded:${ previousPlayId }`
            }, packet, context.config ) );
        }
        if ( currentPlayId && previousPlayId !== currentPlayId ) {
            events.push( createEvent( 'trackStarted', {
                playback: context.currentState.nowPlaying,
                playId: currentPlayId
            }, packet, context.config ) );
        }
    }

    return events;
}

module.exports = translateWavezEvent;
