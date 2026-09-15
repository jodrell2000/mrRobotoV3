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
        events.push( createEvent( 'voteChanged', {
            votes: normalizeVotes( payload )
        }, packet, context.config ) );
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
