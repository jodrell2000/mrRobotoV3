// src/services/messageService.js
// Unified message service that combines group and private messaging functionality

const groupMessageService = require( './groupMessageService.js' );
const privateMessageService = require( './privateMessageService.js' );
const cometchatApi = require( './cometchatApi.js' );
const { buildUrl } = require( '../lib/buildUrl.js' );
const { logger } = require( '../lib/logging.js' );

// ===============
// Unified Message Service
// ===============

const messageService = {
  // ===============
  // Utility Functions
  // ===============

  /**
   * Creates a properly formatted mention string for a user UUID
   * @param {string} userUuid - The UUID of the user to mention
   * @returns {string} Formatted mention string
   */
  formatMention: function ( userUuid ) {
    if ( !userUuid ) {
      throw new Error( 'userUuid is required for formatting mentions' );
    }
    return `<@uid:${ userUuid }>`;
  },

  // ===============
  // Group Message Functions
  // ===============

  // Direct exports from groupMessageService
  joinChat: groupMessageService.joinChat,
  sendGroupMessage: groupMessageService.sendGroupMessage,
  sendGroupPictureMessage: groupMessageService.sendGroupPictureMessage,
  fetchGroupMessages: groupMessageService.fetchGroupMessages,
  fetchGroupMessagesRaw: groupMessageService.fetchGroupMessagesRaw,
  getLatestGroupMessageId: groupMessageService.getLatestGroupMessageId,
  setLatestGroupMessageId: groupMessageService.setLatestGroupMessageId,

  // ===============
  // Private Message Functions
  // ===============

  // Direct exports from privateMessageService
  sendPrivateMessage: privateMessageService.sendPrivateMessage,
  returnLastUserMessage: privateMessageService.returnLastUserMessage,
  markAllPrivateUserMessagesAsRead: privateMessageService.markAllPrivateUserMessagesAsRead,
  markMessageAsInterracted: privateMessageService.markMessageAsInterracted,
  fetchAllPrivateUserMessages: privateMessageService.fetchAllPrivateUserMessages,
  fetchNewPrivateUserMessages: privateMessageService.fetchNewPrivateUserMessages,
  returnLastUserMessageTracking: privateMessageService.returnLastUserMessageTracking,

  // ===============
  // Helper Functions (for backward compatibility)
  // ===============

  buildCustomData: groupMessageService.buildCustomData,
  buildPayload: groupMessageService.buildPayload,
  filterMessagesForCommands: groupMessageService.filterMessagesForCommands,

  // ===============
  // Additional Message Functions (if needed)
  // ===============

  /**
   * Send a response message based on responseChannel setting
   * @param {string} message - The message to send
   * @param {Object} options - Response options
   * @param {string} options.responseChannel - Either 'public' or 'request'
   * @param {boolean} options.isPrivateMessage - Whether the original message was private
   * @param {string} options.sender - The sender UUID for private responses
   * @param {Object} options.services - Service container
   * @param {string} options.senderUid - Optional UID of the user who triggered this message
   * @param {string} options.senderName - Optional name of the user who triggered this message
   * @returns {Promise<Object>} Response result
   */
  sendResponse: async function ( message, options = {} ) {
    const { responseChannel = 'request', isPrivateMessage = false, sender, services, senderUid = null, senderName = null, senderAvatarId = null, senderColor = null } = options;

    const logger = require( '../lib/logging.js' ).logger;

    // If responseChannel is 'public', always send to group chat
    if ( responseChannel === 'public' ) {
      return await this.sendGroupMessage( message, { services, senderUid, senderName, senderAvatarId, senderColor } );
    }

    // If responseChannel is 'request', send back to the same channel as the request
    if ( responseChannel === 'request' ) {
      if ( isPrivateMessage && sender ) {
        // Original was private, send private response
        return await this.sendPrivateMessage( message, sender, services );
      } else {
        // Original was public, send public response
        return await this.sendGroupMessage( message, { services, senderUid, senderName, senderAvatarId, senderColor } );
      }
    }

    // Default fallback to group message
    return await this.sendGroupMessage( message, { services, senderUid, senderName, senderAvatarId, senderColor } );
  },

  /**
   * Get the latest group message ID with lookback functionality
   * @returns {Promise<string|null>} Latest message ID
   */
  returnLatestGroupMessageId: async function () {
    const MAX_LOOKBACK_MINUTES = 10;
    const now = Math.floor( Date.now() / 1000 );
    const config = require( '../config.js' );

    for ( let i = 0; i <= MAX_LOOKBACK_MINUTES; i++ ) {
      const lookbackTimestamp = now - i * 60;

      const url = buildUrl( cometchatApi.BASE_URL, [
        'v3.0', 'groups', config.HANGOUT_ID, 'messages'
      ], [
        [ 'per_page', 1 ],
        [ 'hideMessagesFromBlockedUsers', 0 ],
        [ 'unread', 0 ],
        [ 'undelivered', 0 ],
        [ 'withTags', 0 ],
        [ 'hideDeleted', 0 ],
        [ 'affix', 'append' ],
        [ 'updatedAt', lookbackTimestamp ]
      ] );

      // logger.debug( `[messageService] returnLatestGroupMessageId - url: ${ url }` );
      try {
        const res = await cometchatApi.apiClient.get( url );
        const messages = res.data?.data;

        if ( Array.isArray( messages ) && messages.length > 0 ) {
          const latest = messages[ 0 ];
          // logger.debug( `✅ Found message: ID ${ latest.id } at sentAt ${ latest.sentAt } (lookback ${ i }m)` );
          return latest.id;
        }
        // logger.debug( `🔍 No messages at ${ lookbackTimestamp } (${ i } min ago)` );
      } catch ( err ) {
        logger.error( `❌ Error fetching messages at lookback ${ i }m: ${ err.message }` );
        return null;
      }
    }

    logger.warn( '⚠️ No messages found in lookback window' );
    return null;
  }
}

module.exports = { messageService };
