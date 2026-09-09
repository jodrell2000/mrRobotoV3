function unsupported ( action, source ) {
    return {
        success: false,
        supported: false,
        errorCode: 'CAPABILITY_UNSUPPORTED',
        error: `${ action } is not available on the selected site.`,
        retryable: false,
        source
    };
}

function createPlatformActions ( services ) {
    const source = services.frameworkSpecification?.id || 'unknown';

    const execute = async ( capability, action, operation ) => {
        const capabilityInfo = services.frameworkSpecification?.capabilities?.[ capability ];
        if ( capabilityInfo && !capabilityInfo.supported ) return unsupported( action, source );

        try {
            const data = await operation();
            return { success: true, supported: true, data, retryable: false, source };
        } catch ( error ) {
            return {
                success: false,
                supported: true,
                errorCode: 'TEMPORARY_FAILURE',
                error: error.message,
                retryable: true,
                source
            };
        }
    };

    return {
        voteOnTrack ( voteType ) {
            const adapterVote = voteType === 'up' ? 'upvote' : 'downvote';
            return execute( 'voting', 'voteOnTrack', () => services.socketAdapter.voteOnSong( services.config.BOT_UID, adapterVote ) );
        },
        removeFromDJQueue ( userId ) {
            return execute( 'removeFromDJQueue', 'removeFromDJQueue', () => services.socketAdapter.removeDj( userId ) );
        },
        skipTrack () {
            return execute( 'skipTrack', 'skipTrack', () => services.socketAdapter.skipSong() );
        },
        updateBotIdentity ( nickname ) {
            return execute( 'botIdentityUpdate', 'updateBotIdentity', () => services.apiAdapter.updateUserNickname( nickname ) );
        },
        getUserProfile ( userId ) {
            return execute( 'userProfiles', 'getUserProfile', () => services.apiAdapter.getUserProfile( userId ) );
        },
        getPresentUsers () {
            return execute( 'userPresence', 'getPresentUsers', () => services.apiAdapter.getAllPresentUsers( services ) );
        }
    };
}

module.exports = createPlatformActions;
