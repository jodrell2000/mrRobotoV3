/**
 * HangFmSocketAdapter
 * 
 * Wraps the ttfm-socket SocketClient library to provide a framework-agnostic socket interface.
 * 
 * ⚠️ CRITICAL: This is the ONLY place that imports ttfm-socket
 * 
 * All socket.action() calls and socket method calls are abstracted here.
 * Other adapters (for different sites) will have their own implementation.
 */

const AbstractSocketAdapter = require( './AbstractSocketAdapter' );
const { SocketClient, ServerMessageName, StatefulServerMessageName, StatelessServerMessageName } = require( 'ttfm-socket' );

class HangFmSocketAdapter extends AbstractSocketAdapter {
    constructor ( config ) {
        super();
        this.config = config;
        this.socket = null;
        this.logger = null;
    }

    /**
     * Initialize socket with logger reference
     * Called by serviceContainer before any other methods
     */
    setLogger ( logger ) {
        this.logger = logger;
    }

    /**
     * Establish connection to Hang.fm socket server
     * 
     * @returns {Promise<void>}
     */
    async connect () {
        if ( this.socket ) {
            if ( this.logger ) this.logger.debug( 'Socket already connected' );
            return;
        }

        if ( this.logger ) this.logger.debug( 'Creating SocketClient...' );
        this.socket = new SocketClient( this.config.SOCKET_SERVER_URL );
        if ( this.logger ) this.logger.debug( '✅ SocketClient created' );
    }

    /**
     * Disconnect from the socket server
     * 
     * @returns {Promise<void>}
     */
    async disconnect () {
        if ( !this.socket ) {
            if ( this.logger ) this.logger.debug( 'Socket not connected' );
            return;
        }

        if ( this.logger ) this.logger.debug( 'Disconnecting socket...' );
        try {
            this.socket.disconnect();
            this.socket = null;
            if ( this.logger ) this.logger.debug( '✅ Socket disconnected' );
        } catch ( error ) {
            if ( this.logger ) this.logger.error( `Error disconnecting socket: ${ error.message }` );
            throw error;
        }
    }

    /**
     * Join a room (hangout) on Hang.fm
     * 
     * @param {string} roomId - The hangout UUID
     * @param {string} roomToken - Bearer token for authentication
     * @returns {Promise<Object>} Room state
     */
    async joinRoom ( roomId, roomToken ) {
        if ( !this.socket ) {
            throw new Error( 'Socket not connected. Call connect() first.' );
        }

        if ( this.logger ) this.logger.debug( 'Joining room...' );

        try {
            const connection = await this.socket.joinRoom( roomToken, {
                roomUuid: roomId
            } );

            if ( this.logger ) this.logger.debug( '✅ Room joined successfully' );
            return connection;
        } catch ( error ) {
            if ( this.logger ) this.logger.error( `Failed to join room: ${ error.message }` );
            throw error;
        }
    }

    /**
     * Register an event listener on the socket
     * 
     * Standard events:
     * - 'statefulMessage': State-changing messages
     * - 'statelessMessage': State-neutral messages
     * - 'serverMessage': Server-specific messages
     * - 'reconnect': Reconnection events
     * - 'error': Socket errors
     * 
     * @param {string} eventName - Event name
     * @param {Function} callback - Callback function
     */
    on ( eventName, callback ) {
        if ( !this.socket ) {
            throw new Error( 'Socket not connected. Call connect() first.' );
        }

        this.socket.on( eventName, callback );
    }

    /**
     * Check if socket is currently connected
     * 
     * @returns {boolean} True if socket is connected
     */
    isConnected () {
        return this.socket !== null && this.socket !== undefined;
    }

    /**
     * Vote on a song (up or down)
     * 
     * @param {string} userUuid - User UUID
     * @param {string} voteType - 'up' or 'down'
     * @returns {Promise<Object>} Vote result
     */
    async voteOnSong ( userUuid, voteType ) {
        if ( !this.socket ) {
            throw new Error( 'Socket not connected. Call connect() first.' );
        }

        if ( this.logger ) this.logger.debug( `Voting ${ voteType } on song for user ${ userUuid }` );

        try {
            const result = await this.socket.action(
                StatefulServerMessageName.voteOnSong,
                {
                    roomUuid: this.config.HANGOUT_ID,
                    userUuid: userUuid,
                    voteType: voteType
                }
            );

            if ( this.logger ) this.logger.debug( `✅ Vote ${ voteType } submitted` );
            return result;
        } catch ( error ) {
            if ( this.logger ) this.logger.error( `Failed to vote on song: ${ error.message }` );
            throw error;
        }
    }

    /**
     * Remove a DJ from the booth
     * 
     * @param {string} djUuid - DJ UUID to remove
     * @returns {Promise<Object>} Result
     */
    async removeDj ( djUuid ) {
        if ( !this.socket ) {
            throw new Error( 'Socket not connected. Call connect() first.' );
        }

        if ( this.logger ) this.logger.debug( `Removing DJ ${ djUuid }` );

        try {
            const result = await this.socket.action(
                StatefulServerMessageName.removeDj,
                {
                    roomUuid: this.config.HANGOUT_ID,
                    djUuid: djUuid
                }
            );

            if ( this.logger ) this.logger.debug( `✅ DJ removed` );
            return result;
        } catch ( error ) {
            if ( this.logger ) this.logger.error( `Failed to remove DJ: ${ error.message }` );
            throw error;
        }
    }

    /**
     * Skip the current song
     * 
     * @returns {Promise<Object>} Result
     */
    async skipSong () {
        if ( !this.socket ) {
            throw new Error( 'Socket not connected. Call connect() first.' );
        }

        if ( this.logger ) this.logger.debug( 'Skipping song...' );

        try {
            const result = await this.socket.action(
                StatefulServerMessageName.skipSong,
                {
                    roomUuid: this.config.HANGOUT_ID
                }
            );

            if ( this.logger ) this.logger.debug( '✅ Song skipped' );
            return result;
        } catch ( error ) {
            if ( this.logger ) this.logger.error( `Failed to skip song: ${ error.message }` );
            throw error;
        }
    }

    /**
     * Get the underlying socket instance
     * 
     * ⚠️ WARNING: This should only be used by Hang.fm-specific services (hangSocketServices)
     * Do NOT extract this in other adapters or for new sites
     * 
     * @returns {Object|null} The underlying SocketClient instance or null if not connected
     */
    getSocket () {
        return this.socket;
    }
}

module.exports = HangFmSocketAdapter;
