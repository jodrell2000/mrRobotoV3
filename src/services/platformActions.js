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

function getErrorMessage ( error ) {
    return error instanceof Error ? error.message : String( error );
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
                error: getErrorMessage( error ),
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
            return execute( 'removeFromDJQueue', 'removeFromDJQueue', async () => {
                if ( services.logger ) services.logger.debug( `[platformActions.removeFromDJQueue] called with userId: "${ userId }"` );
                const result = await services.socketAdapter.removeDj( userId );
                if ( services.logger ) services.logger.debug( `[platformActions.removeFromDJQueue] removeDj returned: ${ JSON.stringify( result ) }` );
                return result;
            } );
        },
        skipTrack () {
            return execute( 'skipTrack', 'skipTrack', () => services.socketAdapter.skipSong() );
        },
        moveInQueue ( userId, position ) {
            return execute( 'moveInQueue', 'moveInQueue', async () => {
                if ( services.logger ) services.logger.debug( `[platformActions.moveInQueue] called with userId: "${ userId }", position: ${ position }` );
                const result = await services.socketAdapter.moveInQueue( userId, position );
                if ( services.logger ) services.logger.debug( `[platformActions.moveInQueue] moveInQueue returned: ${ JSON.stringify( result ) }` );
                return result;
            } );
        },
        updateBotIdentity ( nickname ) {
            return execute( 'botIdentityUpdate', 'updateBotIdentity', () => services.apiAdapter.updateUserNickname( nickname ) );
        },
        getUserProfile ( userId ) {
            return execute( 'userProfiles', 'getUserProfile', () => services.apiAdapter.getUserProfile( userId ) );
        },
        getPresentUsers () {
            return execute( 'userPresence', 'getPresentUsers', () => services.apiAdapter.getAllPresentUsers( services ) );
        },
        updateRoomSettings ( settings ) {
            return execute( 'updateRoomSettings', 'updateRoomSettings', async () => {
                if ( services.logger ) services.logger.debug( `[platformActions.updateRoomSettings] called with settings: ${ JSON.stringify( settings ) }` );
                const result = await services.apiAdapter.updateSettings( settings );
                if ( services.logger ) services.logger.debug( `[platformActions.updateRoomSettings] updateSettings returned: ${ JSON.stringify( result ) }` );
                return result;
            } );
        },
        kickUser ( userId, reason ) {
            return execute( 'kickUser', 'kickUser', async () => {
                if ( services.logger ) services.logger.debug( `[platformActions.kickUser] called with userId: "${ userId }", reason: "${ reason || 'no reason' }"` );
                const result = await services.socketAdapter.kickUser( userId, reason );
                if ( services.logger ) services.logger.debug( `[platformActions.kickUser] kickUser returned: ${ JSON.stringify( result ) }` );
                return result;
            } );
        },
        muteUser ( userId, durationMs ) {
            return execute( 'muteUser', 'muteUser', async () => {
                if ( services.logger ) services.logger.debug( `[platformActions.muteUser] called with userId: "${ userId }", duration: ${ durationMs || 'permanent' }` );
                const result = await services.socketAdapter.muteUser( userId, durationMs );
                if ( services.logger ) services.logger.debug( `[platformActions.muteUser] muteUser returned: ${ JSON.stringify( result ) }` );
                return result;
            } );
        },
        unmuteUser ( userId ) {
            return execute( 'unmuteUser', 'unmuteUser', async () => {
                if ( services.logger ) services.logger.debug( `[platformActions.unmuteUser] called with userId: "${ userId }"` );
                const result = await services.socketAdapter.unmuteUser( userId );
                if ( services.logger ) services.logger.debug( `[platformActions.unmuteUser] unmuteUser returned: ${ JSON.stringify( result ) }` );
                return result;
            } );
        }
    };
}

module.exports = createPlatformActions;
