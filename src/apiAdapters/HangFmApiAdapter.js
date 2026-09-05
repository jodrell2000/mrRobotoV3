/**
 * HangFmApiAdapter
 * 
 * Implements the AbstractSiteAdapter for Hang.fm REST API.
 * Handles all HTTP requests to Hang.fm's gateway API.
 * 
 * This adapter is Hang.fm specific. New sites will have their own HangFmApiAdapter.
 */

const AbstractSiteAdapter = require( './AbstractSiteAdapter' );
const { makeRequest } = require( '../lib/buildUrl' );

class HangFmApiAdapter extends AbstractSiteAdapter {
    constructor ( config ) {
        super();
        this.config = config;
        this.logger = null;
    }

    /**
     * Initialize adapter with logger reference
     * Called by serviceContainer before any other methods
     */
    setLogger ( logger ) {
        this.logger = logger;
    }

    /**
     * Get user profile by UUID
     * 
     * @param {string} userUuid - User UUID
     * @returns {Promise<Object>} User profile data
     */
    async getUserProfile ( userUuid ) {
        if ( !userUuid || typeof userUuid !== 'string' ) {
            throw new Error( 'userUuid must be a non-empty string' );
        }

        const path = `/api/user-service/profile/${ encodeURIComponent( userUuid ) }`;
        const url = `${ this.config.TTFM_GATEWAY_BASE_URL }${ path }`;

        if ( this.logger ) this.logger.debug( `Fetching user profile for UUID: ${ userUuid }` );

        try {
            const response = await makeRequest(
                url,
                { method: 'GET' },
                this.getAuthHeaders()
            );

            if ( this.logger ) {
                const hasNickname = response?.nickname || response?.data?.nickname;
                this.logger.debug(
                    `User profile fetched. Has nickname: ${ hasNickname }, Keys: ${ Object.keys( response || {} ).join( ', ' ) }`
                );
            }

            return response;
        } catch ( error ) {
            if ( this.logger ) this.logger.error( `Failed to fetch user profile: ${ error.message }` );
            throw new Error( `Unable to fetch user profile for UUID ${ userUuid }: ${ error.message }` );
        }
    }

    /**
     * Update the bot user's nickname
     * 
     * @param {string} newNickname - New nickname
     * @returns {Promise<Object>} Update result
     */
    async updateUserNickname ( newNickname ) {
        if ( !newNickname || typeof newNickname !== 'string' ) {
            throw new Error( 'newNickname must be a non-empty string' );
        }

        const url = `${ this.config.TTFM_GATEWAY_BASE_URL }/api/user-service/users/profile`;
        const payload = {
            nickname: newNickname
        };

        if ( this.logger ) this.logger.debug( `Updating nickname to: "${ newNickname }"` );

        try {
            const response = await makeRequest(
                url,
                {
                    method: 'POST',
                    data: payload
                },
                this.getAuthHeaders()
            );

            if ( this.logger ) this.logger.debug( `✅ Nickname successfully updated` );
            return response;
        } catch ( error ) {
            if ( this.logger ) this.logger.error( `Failed to update nickname: ${ error.message }` );
            throw new Error( `Failed to update nickname: ${ error.message }` );
        }
    }

    /**
     * Get chat authentication token (CometChat)
     * 
     * @returns {Promise<string>} Authentication token
     */
    async getChatAuthToken () {
        const url = `${ this.config.TTFM_GATEWAY_BASE_URL }/api/user-service/comet-chat/user-token`;

        if ( this.logger ) this.logger.debug( '🔑 Fetching CometChat auth token...' );

        try {
            const response = await makeRequest(
                url,
                { method: 'GET' },
                this.getAuthHeaders()
            );

            if ( !response || !response.cometAuthToken ) {
                throw new Error( 'Invalid response: missing cometAuthToken field' );
            }

            if ( this.logger ) this.logger.info( '✅ CometChat auth token fetched successfully' );
            return response.cometAuthToken;
        } catch ( error ) {
            if ( this.logger ) this.logger.error( `Failed to fetch CometChat token: ${ error.message }` );
            throw new Error( `CometChat token fetch failed: ${ error.message }` );
        }
    }

    /**
     * Get list of all users currently in the hangout
     * 
     * Hang.fm provides this through the state service
     * 
     * @param {Object} services - Services container with hangoutState
     * @returns {Promise<Array>} List of user UUIDs
     */
    async getAllPresentUsers ( services ) {
        if ( !services || !services.hangoutState ) {
            if ( this.logger ) this.logger.debug( 'hangoutState service not available' );
            return [];
        }

        try {
            const currentState = services.hangoutState.getCurrentState?.() || services.hangoutState;

            if ( !currentState || !currentState.allUsers || !Array.isArray( currentState.allUsers ) ) {
                if ( this.logger ) this.logger.debug( 'allUsers not found in current state' );
                return [];
            }

            const userUuids = currentState.allUsers
                .map( user => user.uuid )
                .filter( uuid => uuid );

            if ( this.logger ) this.logger.debug( `Found ${ userUuids.length } users currently in hangout` );
            return userUuids;
        } catch ( error ) {
            if ( this.logger ) this.logger.error( `Error getting present users: ${ error.message }` );
            return [];
        }
    }

    /**
     * Get the gateway base URL for API calls
     * 
     * @returns {string} Base URL
     */
    getGatewayBaseUrl () {
        return this.config.TTFM_GATEWAY_BASE_URL;
    }

    /**
     * Get authentication headers for API calls
     * 
     * @returns {Object} Headers object with Authorization, Content-Type, etc.
     */
    getAuthHeaders () {
        return {
            'Authorization': `Bearer ${ this.config.BOT_USER_TOKEN }`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }
}

module.exports = HangFmApiAdapter;
