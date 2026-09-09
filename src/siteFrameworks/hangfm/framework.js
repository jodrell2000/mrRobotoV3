const framework = {
    id: 'hangfm',
    displayName: 'Hang.fm',
    capabilities: {
        chat: { supported: true },
        chatHistory: { supported: true },
        publicMessages: { supported: true },
        privateMessages: { supported: true, groupMessages: false },
        realtimeEvents: { supported: true, transport: 'ttfmSocket' },
        userProfiles: { supported: true, refresh: 'lazy' },
        userPresence: { supported: true },
        djQueueState: { supported: true },
        djQueueManagement: { supported: true },
        removeFromDJQueue: { supported: true, requiredRole: 'MODERATOR' },
        skipTrack: { supported: true, requiredRole: 'MODERATOR' },
        voting: { supported: true, modes: [ 'up', 'down' ] },
        botIdentityUpdate: { supported: true },
        roomSettings: { supported: true },
        ephemeralMessages: { supported: false }
    },
    commandPermissions: {
        owner: 'OWNER',
        coOwner: 'OWNER',
        moderator: 'MODERATOR',
        user: 'USER',
        unknown: 'USER'
    },
    startup: {
        requiresApiAdapter: true,
        requiresSocketAdapter: true,
        requiresInitialState: true,
        requiresChatAuthToken: true,
        requiresPublicMessagePolling: true,
        requiresPrivateMessagePolling: true,
        messageSource: 'openchatPolling'
    },
    transports: {
        api: 'hangGateway',
        realtime: 'ttfmSocket',
        chat: 'openchat'
    },
    translators: {
        normalizeState: require( './normalizeHangState.js' ),
        translateEvent: require( './translateHangEvent.js' ),
        normalizeMessage: require( './normalizeHangMessage.js' ),
        normalizeOutgoingMessage: require( './normalizeHangOutgoingMessage.js' )
    },
    state: {
        applyPatch: require( './applyHangStatePatch.js' )
    },
    requiredConfig: [
        'API_FRAMEWORK',
        'SOCKET_SERVER_URL',
        'BOT_USER_TOKEN',
        'TTFM_GATEWAY_BASE_URL',
        'HANGOUT_ID',
        'BOT_UID'
    ],
    validateConfig ( config ) {
        const errors = [];

        for ( const configKey of this.requiredConfig ) {
            if ( !config[ configKey ] ) {
                errors.push( `${ configKey } not set. Configure ${ configKey } for the ${ this.displayName } framework` );
            }
        }

        for ( const configKey of [ 'SOCKET_SERVER_URL', 'TTFM_GATEWAY_BASE_URL' ] ) {
            if ( config[ configKey ] ) {
                try {
                    new URL( config[ configKey ] );
                } catch {
                    errors.push( `${ configKey }="${ config[ configKey ] }" is not a valid URL` );
                }
            }
        }

        for ( const configKey of [ 'HANGOUT_ID', 'BOT_UID' ] ) {
            if ( config[ configKey ] && !this._isValidUuid( config[ configKey ] ) ) {
                errors.push( `${ configKey }="${ config[ configKey ] }" is not a valid UUID` );
            }
        }

        return errors;
    },
    _isValidUuid ( value ) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test( value );
    },
    resolveCommandPermissions ( platformRole ) {
        return this.commandPermissions[ platformRole ] || this.commandPermissions.unknown;
    }
};

module.exports = framework;
