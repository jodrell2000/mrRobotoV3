const framework = {
    id: 'wavezfm',
    displayName: 'Wavez.fm',
    maxChatLength: 255,
    capabilities: {
        chat: { supported: true },
        chatMedia: { supported: true, mode: 'imageUrlInContent' },
        chatHistory: { supported: true, maturity: 'experimental' },
        publicMessages: { supported: true },
        privateMessages: { supported: false },
        realtimeEvents: { supported: true, transport: 'wavezRealtime', maturity: 'experimental' },
        userProfiles: { supported: true, refresh: 'lazy' },
        userPresence: { supported: true },
        djQueueState: { supported: false },
        djQueueManagement: { supported: false },
        removeFromDJQueue: { supported: true },
        skipTrack: { supported: false },
        voting: { supported: false },
        botIdentityUpdate: { supported: false },
        roomSettings: { supported: false },
        ephemeralMessages: { supported: false }
    },
    commandPermissions: {
        owner: 'OWNER',
        host: 'OWNER',
        manager: 'OWNER',
        cohost: 'MODERATOR',
        moderator: 'MODERATOR',
        bouncer: 'MODERATOR',
        user: 'USER',
        unknown: 'USER'
    },
    startup: {
        requiresApiAdapter: true,
        requiresSocketAdapter: true,
        requiresInitialState: true,
        requiresChatAuthToken: false,
        requiresPublicMessagePolling: false,
        requiresPrivateMessagePolling: false,
        messageSource: 'wavezRealtime'
    },
    transports: {
        api: 'wavezHttp',
        realtime: 'wavezRealtime',
        chat: 'wavezHttp'
    },
    formatters: {
        formatMention ( userId, services ) {
            const displayName = services?.stateService?.getUser?.( userId )?.nickname ||
                services?.hangoutState?.usersById?.[ userId ]?.nickname ||
                services?.config?.CHAT_NAME ||
                userId;
            const mentionName = String( displayName ).trim().replace( /\s+/g, ' ' );
            if ( !mentionName ) return '@';
            if ( /[\s"\\]/.test( mentionName ) ) {
                return `@"${ mentionName.replace( /\\/g, '\\\\' ).replace( /"/g, '\\"' ) }"`;
            }
            return `@${ mentionName }`;
        }
    },
    translators: {
        normalizeState: require( './normalizeWavezState.js' ),
        translateEvent: require( './translateWavezEvent.js' ),
        normalizeMessage: require( './normalizeWavezMessage.js' ),
        normalizeOutgoingMessage: require( './normalizeWavezOutgoingMessage.js' )
    },
    requiredConfig: [
        'API_FRAMEWORK',
        'WAVEZFM_API_BASE_URL',
        'WAVEZFM_ROOM_ID',
        'WAVEZFM_ROOM_BOT_TOKEN'
    ],
    validateConfig ( config ) {
        const errors = [];

        for ( const configKey of this.requiredConfig ) {
            if ( !config[ configKey ] ) {
                errors.push( `${ configKey } not set. Configure ${ configKey } for the ${ this.displayName } framework` );
            }
        }

        if ( config.WAVEZFM_API_BASE_URL ) {
            try {
                new URL( config.WAVEZFM_API_BASE_URL );
            } catch {
                errors.push( `WAVEZFM_API_BASE_URL="${ config.WAVEZFM_API_BASE_URL }" is not a valid URL` );
            }
        }

        if ( config.WAVEZFM_ROOM_ID && !this._isValidUuid( config.WAVEZFM_ROOM_ID ) ) {
            errors.push( `WAVEZFM_ROOM_ID="${ config.WAVEZFM_ROOM_ID }" is not a valid UUID` );
        }

        return errors;
    },
    _isValidUuid ( value ) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test( value );
    },
    resolveCommandPermissions ( platformRole ) {
        const normalizedRole = String( platformRole || '' ).trim().toLowerCase();
        return this.commandPermissions[ normalizedRole ] || this.commandPermissions.unknown;
    }
};

module.exports = framework;