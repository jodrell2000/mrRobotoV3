function normalizeUser ( userId, user, detailedUser ) {
    const profile = detailedUser?.userProfile || detailedUser?.profile;
    const source = user || {};

    return {
        id: userId,
        nickname: profile?.nickname || source.nickname || userId,
        platformRole: source.highestRole || source.role || detailedUser?.highestRole || 'user',
        isPresent: true,
        profile: profile || undefined
    };
}

function normalizeSong ( song ) {
    if ( !song ) return undefined;

    return {
        id: song.songShortId || song.shortId || song.id,
        artist: song.artistName || song.artist,
        title: song.trackName || song.title,
        providerIds: {
            sevenDigital: song.musicProviders?.sevenDigital,
            spotify: song.musicProviders?.spotify,
            apple: song.musicProviders?.apple,
            youtube: song.musicProviders?.youtube
        }
    };
}

function normalizeHangState ( state = {}, config = {} ) {
    const allUsers = Array.isArray( state.allUsers ) ? state.allUsers : [];
    const allUserData = state.allUserData && typeof state.allUserData === 'object'
        ? state.allUserData
        : {};
    const usersById = {};

    allUsers.forEach( user => {
        if ( user?.uuid ) usersById[ user.uuid ] = normalizeUser( user.uuid, user, allUserData[ user.uuid ] );
    } );

    Object.entries( allUserData ).forEach( ( [ userId, detailedUser ] ) => {
        if ( !usersById[ userId ] ) usersById[ userId ] = normalizeUser( userId, undefined, detailedUser );
    } );

    const djQueue = ( Array.isArray( state.djs ) ? state.djs : [] ).map( ( dj, position ) => ( {
        position,
        userId: dj.uuid,
        nextSong: dj.nextSong,
        isPlaying: position === 0
    } ) );

    const nowPlaying = state.nowPlaying
        ? {
            djId: djQueue[ 0 ]?.userId,
            song: normalizeSong( state.nowPlaying.song ),
            playId: state.nowPlaying.playId,
            startedAt: state.nowPlaying.startedAt || state.nowPlaying.startTime
        }
        : null;

    const settings = state.settings && typeof state.settings === 'object' ? state.settings : {};
    const roomUrl = settings.url || settings.slug || state.hangoutSlug || config.HANGOUT_SLUG;

    return {
        room: {
            id: state.id || state.roomId || config.HANGOUT_ID,
            name: settings.name,
            url: roomUrl,
            description: settings.description
        },
        usersById,
        djQueue,
        nowPlaying,
        votes: {
            likes: state.voteCounts?.likes || 0,
            dislikes: state.voteCounts?.dislikes || 0,
            grabs: state.voteCounts?.stars || 0
        },
        roomSettings: { ...settings },
        metadata: {
            source: 'hangfm',
            updatedAt: new Date().toISOString()
        }
    };
}

module.exports = normalizeHangState;
