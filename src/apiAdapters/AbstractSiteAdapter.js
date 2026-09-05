/**
 * AbstractSiteAdapter
 * 
 * Defines the interface for site-specific API adapters.
 * All API implementations must implement these methods.
 */

class AbstractSiteAdapter {
    /**
     * Get user profile by UUID
     * 
     * @abstract
     * @param {string} userUuid - User UUID
     * @returns {Promise<Object>} User profile data
     */
    async getUserProfile ( userUuid ) {
        throw new Error( 'getUserProfile() must be implemented by subclass' );
    }

    /**
     * Update the bot user's nickname
     * 
     * @abstract
     * @param {string} newNickname - New nickname
     * @returns {Promise<Object>} Update result
     */
    async updateUserNickname ( newNickname ) {
        throw new Error( 'updateUserNickname() must be implemented by subclass' );
    }

    /**
     * Get chat authentication token
     * 
     * Used for authenticating with CometChat or similar chat platform
     * 
     * @abstract
     * @returns {Promise<string>} Authentication token
     */
    async getChatAuthToken () {
        throw new Error( 'getChatAuthToken() must be implemented by subclass' );
    }

    /**
     * Get list of all users currently in the hangout
     * 
     * @abstract
     * @param {Object} services - Services container with stateService
     * @returns {Promise<Array>} List of user objects
     */
    async getAllPresentUsers ( services ) {
        throw new Error( 'getAllPresentUsers() must be implemented by subclass' );
    }

    /**
     * Get the gateway base URL for API calls
     * 
     * @abstract
     * @returns {string} Base URL
     */
    getGatewayBaseUrl () {
        throw new Error( 'getGatewayBaseUrl() must be implemented by subclass' );
    }

    /**
     * Get authentication headers for API calls
     * 
     * @abstract
     * @returns {Object} Headers object with Authorization, Content-Type, etc.
     */
    getAuthHeaders () {
        throw new Error( 'getAuthHeaders() must be implemented by subclass' );
    }
}

module.exports = AbstractSiteAdapter;
