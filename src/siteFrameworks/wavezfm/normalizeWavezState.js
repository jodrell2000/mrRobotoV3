function normalizeUser ( user = {}, fallbackRole = 'user' ) {
    const userId = user.id || user.userId;
    if ( !userId ) return undefined;

    // Only roomRole is a valid permission signal for Wavez; never fall back to role or platformRole/globalRole
    return {
        id: userId,
        nickname: user.displayUsername || user.username || user.nickname || userId,
        platformRole: user.roomRole || fallbackRole,
        isPresent: user.isPresent !== false,
        profile: user
    };
}

function normalizeWavezState ( response = {}, config = {} ) {
    const data = response.data || response;
    const room = data.room || {};
    const snapshot = data.snapshot || {};
    const usersById = {};
    const currentUser = normalizeUser( data.currentUser, data.currentUser?.roomRole || 'user' );

    if ( currentUser ) usersById[ currentUser.id ] = currentUser;

    const users = data.users || snapshot.users || snapshot.people || room.users || [];
    if ( Array.isArray( users ) ) {
        for ( const user of users ) {
            const normalized = normalizeUser( user, user?.roomRole || 'user' );
            if ( normalized ) usersById[ normalized.id ] = normalized;
        }
    }

    const roomId = room.id || snapshot.roomId || config.WAVEZFM_ROOM_ID;
    const roomName = room.name || snapshot.roomName;
    const roomSlug = room.slug || snapshot.roomSlug;
    const roomDescription = room.description || snapshot.roomDescription;
    const queue = Array.isArray( snapshot.queue ) ? snapshot.queue : [];
    const currentDjId = snapshot.playback?.djId || queue[ 0 ];
    const djQueue = queue.map( ( userId, position ) => ( {
        position,
        userId,
        nextSong: snapshot.playback?.nextTrack && position === 0 ? snapshot.playback.nextTrack : undefined,
        isPlaying: userId === currentDjId && position === 0
    } ) );
    const playback = snapshot.playback;
    const nowPlaying = playback
        ? {
            djId: playback.djId || currentDjId,
            song: playback.trackId
                ? {
                    id: playback.trackId,
                    artist: playback.artist,
                    title: playback.title,
                    providerIds: playback.sourceId ? { [ playback.source ]: playback.sourceId } : {}
                }
                : undefined,
            playId: playback.trackId,
            startedAt: playback.startedAtServerMs
                ? new Date( playback.startedAtServerMs ).toISOString()
                : undefined
        }
        : null;
    const votes = snapshot.votes || {};

    return {
        room: {
            id: roomId,
            name: roomName,
            url: roomSlug,
            description: roomDescription
        },
        usersById,
        djQueue,
        nowPlaying,
        votes: {
            likes: votes.woots || 0,
            dislikes: votes.mehs || 0,
            grabs: votes.grabs || 0
        },
        roomSettings: {
            ...room,
            queueLocked: room.queueLocked ?? snapshot.queueLocked
        },
        metadata: {
            source: 'wavezfm',
            updatedAt: new Date().toISOString(),
            bot: data.bot
                ? {
                    id: data.bot.id,
                    name: data.bot.name,
                    permissions: data.bot.permissions || []
                }
                : undefined
        }
    };
}

module.exports = normalizeWavezState;
