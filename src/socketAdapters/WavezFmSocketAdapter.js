const AbstractSocketAdapter = require( './AbstractSocketAdapter' );
const fs = require( 'fs' ).promises;
const path = require( 'path' );

function unsupported ( action ) {
    throw new Error( `${ action } is not supported by the Wavez.fm adapter` );
}

class WavezFmSocketAdapter extends AbstractSocketAdapter {
    constructor ( config, dependencies = {} ) {
        super();
        this.config = config;
        this.dependencies = dependencies;
        this.logger = null;
        this.connected = false;
        this.client = null;
        this.listeners = new Map();
        this.roomUserIds = new Set();
        this.wavezEventLogCounter = 0;
    }

    setLogger ( logger ) {
        this.logger = logger;
    }

    async connect () {
        if ( this.client ) return;

        const wavezApi = this.dependencies.wavezApi || await import( '@wavezfm/api' );
        const WebSocket = this.dependencies.WebSocket || require( 'ws' );
        const websocketFactory = this.dependencies.websocketFactory || ( ( url, protocols ) => new WebSocket( url, protocols ) );

        this.client = wavezApi.createRoomBotRealtimeClient( {
            baseURL: this.config.WAVEZFM_API_BASE_URL || 'https://api.wavez.fm',
            botToken: this.config.WAVEZFM_ROOM_BOT_TOKEN,
            roomId: this.config.WAVEZFM_ROOM_ID,
            autoReconnect: true,
            logging: false,
            websocketFactory
        } );

        this.client.on( 'open', () => {
            if ( this.connected ) this.emit( 'reconnect' );
        } );
        this.client.on( 'packet', packet => {
            this._trackRoomUsers( packet );
            this._captureWavezEvent( packet );
        } );

        await this.client.connect();
        this.connected = true;
        if ( this.logger ) this.logger.info( 'Wavez realtime client connected' );
    }

    async disconnect () {
        if ( this.client ) this.client.disconnect( 1000, 'Bot shutting down' );
        this.client = null;
        this.connected = false;
    }

    async joinRoom () {
        if ( this.client?.joinRoom ) this.client.joinRoom();
        return {
            state: {
                roomId: this.config.WAVEZFM_ROOM_ID,
                allUsers: [],
                allUserData: {},
                djs: [],
                nowPlaying: null,
                voteCounts: { likes: 0, dislikes: 0, stars: 0 },
                settings: {}
            }
        };
    }

    on () {
        const [ eventName, handler ] = arguments;
        if ( eventName === 'reconnect' ) {
            if ( !this.listeners.has( eventName ) ) this.listeners.set( eventName, new Set() );
            this.listeners.get( eventName ).add( handler );
            return () => this.listeners.get( eventName )?.delete( handler );
        }
        if ( !this.client?.on ) return undefined;
        return this.client.on( eventName, packet => {
            if ( !this._isForConfiguredRoom( eventName, packet ) ) return;
            handler( packet );
        } );
    }

    emit ( eventName, payload ) {
        for ( const handler of this.listeners.get( eventName ) || [] ) handler( payload );
    }

    isConnected () {
        return this.connected;
    }

    // Diagnostic helper: reports how many listeners the underlying client has for a given
    // named event, used to confirm/rule out duplicate listener registration as a root cause
    getListenerCount ( eventName ) {
        return typeof this.client?.listenerCount === 'function' ? this.client.listenerCount( eventName ) : undefined;
    }

    _isForConfiguredRoom ( eventName, packet ) {
        const payload = packet?.payload || {};
        if ( eventName === 'user_updated' ) {
            const userId = payload.userId || payload.id;
            return Boolean( userId && this.roomUserIds.has( userId ) );
        }

        const roomId = payload.roomId ||
            ( eventName === 'public_room_updated' ? payload.id : undefined );
        const roomSlug = payload.roomSlug || payload.slug;

        if ( roomId && this.config.WAVEZFM_ROOM_ID && roomId !== this.config.WAVEZFM_ROOM_ID ) return false;
        if ( roomSlug && this.config.WAVEZFM_ROOM_SLUG && roomSlug !== this.config.WAVEZFM_ROOM_SLUG ) return false;
        return true;
    }

    _trackRoomUsers ( packet ) {
        if ( packet?.event !== 'room_state_snapshot' ) return;
        const users = packet.payload?.users;
        if ( !Array.isArray( users ) ) return;
        this.roomUserIds = new Set( users.map( user => user?.id ).filter( Boolean ) );
    }

    // Logs every raw Wavez event name as it arrives, and (when SOCKET_MESSAGE_LOG_LEVEL=DEBUG)
    // captures the full sanitized packet to logs/wavez-events/ for later investigation
    async _captureWavezEvent ( packet ) {
        const eventName = packet?.event || 'unknown';
        if ( !this._isForConfiguredRoom( eventName, packet ) ) return;

        this.logger?.debug?.( `📡 [WavezFmSocketAdapter] event received: ${ eventName }` );

        if ( this.config.SOCKET_MESSAGE_LOG_LEVEL !== 'DEBUG' ) return;

        try {
            const logsDir = path.join( process.cwd(), 'logs', 'wavez-events' );
            await fs.mkdir( logsDir, { recursive: true } );

            this.wavezEventLogCounter++;
            const paddedCounter = String( this.wavezEventLogCounter ).padStart( 6, '0' );
            const timestamp = new Date().toISOString().replace( /[:.]/g, '-' );
            const filePath = path.join( logsDir, `${ timestamp }_${ paddedCounter }_${ eventName }.json` );

            await fs.writeFile( filePath, JSON.stringify( packet, null, 2 ) );
        } catch ( error ) {
            this.logger?.error?.( `Failed to capture Wavez event ${ eventName }: ${ error.message }` );
        }
    }

    async voteOnSong () {
        unsupported( 'voteOnSong' );
    }

    async removeDj () {
        unsupported( 'removeDj' );
    }

    async skipSong () {
        unsupported( 'skipSong' );
    }
}

module.exports = WavezFmSocketAdapter;