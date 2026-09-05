/**
 * AbstractSocketAdapter
 * 
 * Defines the interface for socket adapters.
 * All socket implementations must implement these methods.
 */

class AbstractSocketAdapter {
    /**
     * Establish connection to the socket server
     * 
     * @abstract
     * @returns {Promise<void>}
     */
    async connect () {
        throw new Error( 'connect() must be implemented by subclass' );
    }

    /**
     * Disconnect from the socket server
     * 
     * @abstract
     * @returns {Promise<void>}
     */
    async disconnect () {
        throw new Error( 'disconnect() must be implemented by subclass' );
    }

    /**
     * Join a specific room/hangout
     * 
     * @abstract
     * @param {string} roomId - The room/hangout UUID
     * @param {string} roomToken - Authentication token for the room
     * @returns {Promise<Object>} Room state
     */
    async joinRoom ( roomId, roomToken ) {
        throw new Error( 'joinRoom() must be implemented by subclass' );
    }

    /**
     * Register an event listener
     * 
     * Standard events: 'statefulMessage', 'statelessMessage', 'serverMessage', 'reconnect', 'error'
     * 
     * @abstract
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Function to call when event fires
     */
    on ( eventName, callback ) {
        throw new Error( 'on() must be implemented by subclass' );
    }

    /**
     * Check if socket is currently connected
     * 
     * @abstract
     * @returns {boolean} True if connected
     */
    isConnected () {
        throw new Error( 'isConnected() must be implemented by subclass' );
    }

    /**
     * Vote on a song (up or down)
     * 
     * @abstract
     * @param {string} userUuid - User UUID
     * @param {string} voteType - 'up' or 'down'
     * @returns {Promise<Object>} Vote result
     */
    async voteOnSong ( userUuid, voteType ) {
        throw new Error( 'voteOnSong() must be implemented by subclass' );
    }

    /**
     * Remove a DJ from the booth
     * 
     * @abstract
     * @param {string} djUuid - DJ UUID to remove
     * @returns {Promise<Object>} Result
     */
    async removeDj ( djUuid ) {
        throw new Error( 'removeDj() must be implemented by subclass' );
    }

    /**
     * Skip the current song
     * 
     * @abstract
     * @returns {Promise<Object>} Result
     */
    async skipSong () {
        throw new Error( 'skipSong() must be implemented by subclass' );
    }
}

module.exports = AbstractSocketAdapter;
