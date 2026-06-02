// src/services/privateMessageService.js
const { v4: uuidv4 } = require( 'uuid' );
const openchatApi = require( './openchatApi.js' );
const config = require( '../config.js' );
const { logger } = require( '../lib/logging.js' );
const { buildUrl, makeRequest } = require( '../lib/buildUrl' );

// Constants
const RECEIVER_TYPE = {
    USER: "user"
};

// ===============
// Helper functions
// ===============

// buildCustomData and buildPayload are now imported from openchatApi

// ===============
// Private Message Service
// ===============

const privateMessageService = {
    // Helper functions (exported for testing) - now from openchatApi
    buildCustomData: openchatApi.buildCustomData,
    buildPayload: openchatApi.buildPayload,

    /**
     * Send a private message to a user
     * @param {string} theMessage - The message text
     * @param {string} receiver - The receiver's user ID
     * @param {Object} services - Required services container
     * @returns {Promise<void>}
     */
    sendPrivateMessage: async function ( theMessage, receiver, services ) {
        try {
            const customData = await openchatApi.buildCustomData( theMessage, services );
            const payload = await openchatApi.buildPayload( receiver, RECEIVER_TYPE.USER, customData, theMessage );
            const response = await openchatApi.sendMessage( payload );
            // logger.debug( `✅ Private message sent: ${ JSON.stringify( response.data, null, 2 ) }` );
        } catch ( err ) {
            logger.error( `❌ Failed to send private message: ${ err.response?.data || err.message }` );
        }
    },

    /**
     * Get the last message from a specific user
     * @param {string} userID - The user ID
     * @returns {Promise<string|null>} Message ID or null
     */
    returnLastUserMessage: async function ( userID ) {
        // logger.debug( `🔍 [returnLastUserMessage] Starting fetch for user: ${userID}` );

        try {
            // Use general messages endpoint with sender filtering for private conversations
            const endpoint = `v3.0/messages?limit=1&receiverType=user&sender=${ userID }`;
            // logger.debug( `🔍 [returnLastUserMessage] Calling endpoint: ${endpoint}` );

            const response = await openchatApi.fetchMessages( endpoint );

            // logger.debug( `🔍 [returnLastUserMessage] Response received - status: ${response?.status}` );
            // logger.debug( `🔍 [returnLastUserMessage] - Response.data.data length: ${Array.isArray(response?.data?.data) ? response.data.data.length : 'not an array'}` );

            if ( !response?.data?.data || !Array.isArray( response.data.data ) ) {
                // logger.debug( `🔍 [returnLastUserMessage] Malformed response data, returning null` );
                return null;
            }

            if ( response.data.data.length > 0 ) {
                const lastMessage = response.data.data[ 0 ];
                // logger.debug( `🔍 [returnLastUserMessage] Found last message: ${JSON.stringify(lastMessage, null, 2)}` );
                // logger.debug( `🔍 [returnLastUserMessage] Returning message ID: ${lastMessage.id}` );
                return lastMessage.id;
            }

            // logger.debug( `🔍 [returnLastUserMessage] No messages found, returning null` );
            return null;
        } catch ( err ) {
            logger.error( `❌ [returnLastUserMessage] Error getting last user message: ${ err.message }` );
            logger.error( `❌ [returnLastUserMessage] Error stack: ${ err.stack }` );
            return null;
        }
    },

    /**
     * Get the last message tracking info (ID and timestamp) from a specific user
     * @param {string} userID - The user ID
     * @returns {Promise<{lastMessageId: string, lastTimestamp: number}|null>} Message tracking info or null
     */
    returnLastUserMessageTracking: async function ( userID ) {
        // logger.debug( `🔍 [returnLastUserMessageTracking] Starting fetch for user: ${userID}` );

        try {
            // Use general messages endpoint with sender filtering for private conversations
            const endpoint = `v3.0/messages?limit=1&receiverType=user&sender=${ userID }`;
            // logger.debug( `🔍 [returnLastUserMessageTracking] Calling endpoint: ${endpoint}` );

            const response = await openchatApi.fetchMessages( endpoint );

            // logger.debug( `🔍 [returnLastUserMessageTracking] Response received - status: ${response?.status}` );
            // logger.debug( `🔍 [returnLastUserMessageTracking] - Response.data.data length: ${Array.isArray(response?.data?.data) ? response.data.data.length : 'not an array'}` );

            if ( !response?.data?.data || !Array.isArray( response.data.data ) ) {
                // logger.debug( `🔍 [returnLastUserMessageTracking] Malformed response data, returning null` );
                return null;
            }

            if ( response.data.data.length > 0 ) {
                const lastMessage = response.data.data[ 0 ];
                const tracking = {
                    lastMessageId: lastMessage.id,
                    lastTimestamp: lastMessage.sentAt
                };
                // logger.debug( `🔍 [returnLastUserMessageTracking] Found last message tracking: ${JSON.stringify(tracking, null, 2)}` );
                return tracking;
            }

            // logger.debug( `🔍 [returnLastUserMessageTracking] No messages found, returning null` );
            return null;
        } catch ( err ) {
            logger.error( `❌ [returnLastUserMessageTracking] Error getting last user message tracking: ${ err.message }` );
            logger.error( `❌ [returnLastUserMessageTracking] Error stack: ${ err.stack }` );
            return null;
        }
    },

    /**
     * Mark all private messages from a user as read
     * @param {string} userID - The user ID
     * @returns {Promise<void>}
     */
    markAllPrivateUserMessagesAsRead: async function ( userID ) {
        try {
            const lastMessageId = await this.returnLastUserMessage( userID );

            if ( lastMessageId ) {
                await this.markMessageAsInterracted( lastMessageId );
                // logger.debug( `✅ Marked messages as read for user: ${ userID }` );
            } else {
                // logger.debug( `No unread messages found for user ${ userID }` );
            }
        } catch ( err ) {
            logger.error( `❌ Error marking all private user messages as read for user ${ userID }: ${ err.message }` );
        }
    },

    /**
     * Mark a specific message as interacted/read, or mark entire conversation as read
     * @param {string} [lastMessageID] - The message ID to mark as read (optional)
     * @returns {Promise<void>}
     */
    markMessageAsInterracted: async function ( lastMessageID ) {
        try {
            if ( lastMessageID ) {
                // Mark specific message as read
                const conversationUrl = `${ openchatApi.BASE_URL }/v3/messages/${ lastMessageID }/interactions`;
                await openchatApi.markConversationAsRead( conversationUrl );
                // logger.debug( `✅ Message marked as read: ${ lastMessageID }` );
            } else {
                // Mark entire conversation as read
                const conversationUrl = `${ openchatApi.BASE_URL }/v3/users/${ config.COMETCHAT_RECEIVER_UID }/conversation/read`;
                await openchatApi.markConversationAsRead( conversationUrl );
                // logger.debug( `✅ Conversation marked as read for user: ${ config.COMETCHAT_RECEIVER_UID }` );
            }
        } catch ( err ) {
            logger.error( `❌ Error marking message as read: ${ err.response?.data || err.message }` );
            throw err;
        }
    },

    /**
     * Fetch only new private messages from a specific user since the last processed message
     * @param {string} userUUID - The user UUID
     * @param {Object} [options] - Optional configuration
     * @param {string} [options.lastMessageId] - The ID of the last processed message
     * @param {number} [options.lastTimestamp] - The timestamp of the last processed message
     * @param {boolean} [options.logLastMessage=false] - Whether to log the last message details
     * @param {boolean} [options.returnData=true] - Whether to return the message data array
     * @returns {Promise<Array>} Array of simplified messages (empty if returnData=false)
     */
    fetchNewPrivateUserMessages: async function ( userUUID, options = {} ) {
        const { lastMessageId, lastTimestamp, logLastMessage = false, returnData = true } = options;

        // logger.debug( `🔍 [fetchNewPrivateUserMessages] Starting fetch for user: ${userUUID}` );
        // logger.debug( `🔍 [fetchNewPrivateUserMessages] Options: ${JSON.stringify(options)}` );

        try {
            // Use general messages endpoint with sender filtering for private conversations
            // This approach uses the 'sender' parameter with onBehalfOf header to filter messages 
            // from common conversations between the bot and the specified user
            let endpoint = `v3.0/messages?limit=100&receiverType=user&sender=${ userUUID }`;
            endpoint += `&hideMessagesFromBlockedUsers=0&unread=0&withTags=0&undelivered=0&hideDeleted=0`;

            // Use timestamp filtering for more reliable filtering
            if ( lastTimestamp ) {
                // Convert to seconds if it's in milliseconds and add 1 second to exclude the last message
                const timestamp = lastTimestamp > 9999999999 ? Math.floor( lastTimestamp / 1000 ) : lastTimestamp;
                const filterTimestamp = timestamp + 1;
                endpoint += `&fromTimestamp=${ filterTimestamp }`;
                // logger.debug( `🔍 [fetchNewPrivateUserMessages] Using timestamp filter: ${filterTimestamp} (original: ${timestamp})` );
            }
            // Only use message ID as fallback info for debugging
            if ( lastMessageId ) {
                // logger.debug( `🔍 [fetchNewPrivateUserMessages] Last message ID for reference: ${lastMessageId}` );
            }

            // logger.debug( `🔍 [fetchNewPrivateUserMessages] Calling endpoint: ${endpoint}` );

            const response = await openchatApi.fetchMessages( endpoint );

            // logger.debug( `🔍 [fetchNewPrivateUserMessages] Response received - status: ${response?.status}` );
            // logger.debug( `🔍 [fetchNewPrivateUserMessages] - Response.data.data length: ${Array.isArray(response?.data?.data) ? response.data.data.length : 'not an array'}` );

            if ( !response?.data || !Array.isArray( response.data.data ) ) {
                // logger.debug( `🔍 [fetchNewPrivateUserMessages] No valid data array found in response` );
                if ( logLastMessage ) {
                    // logger.debug( '📥 No new private messages found.' );
                }
                return [];
            }

            const messages = response.data.data;
            // logger.debug( `🔍 [fetchNewPrivateUserMessages] Found ${messages.length} total messages from API` );

            // Client-side filtering to ensure we don't process old messages
            let filteredMessages = messages;

            if ( lastMessageId ) {
                // Filter out messages with ID <= lastMessageId
                filteredMessages = messages.filter( msg => parseInt( msg.id ) > parseInt( lastMessageId ) );
                // logger.debug( `🔍 [fetchNewPrivateUserMessages] After message ID filtering (>${lastMessageId}): ${filteredMessages.length} messages` );
            }

            if ( lastTimestamp && filteredMessages.length > 0 ) {
                // Further filter by timestamp as additional safety
                // logger.debug( `🔍 [fetchNewPrivateUserMessages] Before timestamp filtering: ${filteredMessages.length} messages` );
                // filteredMessages.forEach( (msg, idx) => {
                //     logger.debug( `🔍 [fetchNewPrivateUserMessages] Message ${idx} timestamp: ${msg.sentAt} vs lastTimestamp: ${lastTimestamp}` );
                // });

                // Normalize timestamps to same precision for comparison
                // CometChat sometimes returns seconds, sometimes milliseconds
                const normalizeTimestamp = ( ts ) => {
                    // If timestamp looks like seconds (< 10 digits), convert to milliseconds
                    return ts < 9999999999 ? ts * 1000 : ts;
                };

                const normalizedLastTimestamp = normalizeTimestamp( lastTimestamp );
                filteredMessages = filteredMessages.filter( msg => {
                    const normalizedMsgTimestamp = normalizeTimestamp( msg.sentAt );
                    // logger.debug( `🔍 [fetchNewPrivateUserMessages] Comparing normalized: ${normalizedMsgTimestamp} > ${normalizedLastTimestamp}` );
                    return normalizedMsgTimestamp > normalizedLastTimestamp;
                } );
                // logger.debug( `🔍 [fetchNewPrivateUserMessages] After timestamp filtering (>${lastTimestamp}): ${filteredMessages.length} messages` );
            }

            // logger.debug( `🔍 [fetchNewPrivateUserMessages] Final filtered message count: ${filteredMessages.length}` );

            // Log the last message if requested
            if ( logLastMessage && filteredMessages.length > 0 ) {
                const lastMessage = filteredMessages[ 0 ]; // Messages are typically in reverse chronological order
                const text = lastMessage.data?.text || '[No Text]';
                const sender = lastMessage.sender?.uid || lastMessage.sender || 'Unknown';
                // logger.debug( `📥 New private message from ${ sender }: ${ text }` );
            }

            // Return data if requested
            if ( !returnData ) {
                // logger.debug( `🔍 [fetchNewPrivateUserMessages] returnData=false, returning empty array` );
                return [];
            }

            const simplifiedMessages = filteredMessages.map( ( msg, index ) => {
                // logger.debug( `🔍 [fetchNewPrivateUserMessages] Processing message ${index}: ${JSON.stringify(msg, null, 2)}` );

                const customData = msg.data?.metadata?.chatMessage;

                // Extract sender UUID from nested structure (same as groupMessageService)
                const senderFromData = msg.data?.entities?.sender?.entity?.uid;
                const senderFromChatMessage = msg.data?.metadata?.chatMessage?.userUuid;
                const senderFromCustomData = msg.data?.metadata?.message?.customData?.userUuid;
                const extractedSender = msg.sender?.uid || senderFromData || senderFromChatMessage || senderFromCustomData || 'Unknown';

                const simplified = {
                    id: msg.id,
                    text: msg.data?.text || '[No content]',
                    sender: extractedSender,
                    sentAt: msg.sentAt,
                    customData: customData || null
                };

                // logger.debug( `🔍 [fetchNewPrivateUserMessages] Simplified message ${index}: ${JSON.stringify(simplified, null, 2)}` );
                return simplified;
            } );

            // logger.debug( `🔍 [fetchNewPrivateUserMessages] Returning ${simplifiedMessages.length} simplified messages` );
            return simplifiedMessages;
        } catch ( err ) {
            logger.error( `❌ [fetchNewPrivateUserMessages] Error fetching new private messages: ${ err.message }` );
            logger.error( `❌ [fetchNewPrivateUserMessages] Error stack: ${ err.stack }` );
            return [];
        }
    },

    /**
     * Fetch all private messages from a specific user with optional logging
     * @param {string} userUUID - The user UUID
     * @param {Object} [options] - Optional configuration
     * @param {boolean} [options.logLastMessage=false] - Whether to log the last message details
     * @param {boolean} [options.returnData=true] - Whether to return the message data array
     * @returns {Promise<Array>} Array of simplified messages (empty if returnData=false)
     */
    fetchAllPrivateUserMessages: async function ( userUUID, options = {} ) {
        const { logLastMessage = false, returnData = true } = options;

        // logger.debug( `🔍 [fetchAllPrivateUserMessages] Starting fetch for user: ${userUUID}` );
        // logger.debug( `🔍 [fetchAllPrivateUserMessages] Options: ${JSON.stringify(options)}` );

        try {
            // Use the correct CometChat REST API endpoint for fetching messages
            // This fetches messages where the sender is the specified user and receiver type is 'user'
            const endpoint = `v3/messages?receiverType=user&sender=${ userUUID }&limit=100`;
            // logger.debug( `🔍 [fetchAllPrivateUserMessages] Calling endpoint: ${endpoint}` );

            const response = await openchatApi.fetchMessages( endpoint );

            // logger.debug( `🔍 [fetchAllPrivateUserMessages] Response received - status: ${response?.status}` );
            // logger.debug( `🔍 [fetchAllPrivateUserMessages] - Response.data type: ${typeof response?.data}` );
            // logger.debug( `🔍 [fetchAllPrivateUserMessages] - Response.data.data length: ${Array.isArray(response?.data?.data) ? response.data.data.length : 'not an array'}` );

            if ( !response?.data || !Array.isArray( response.data.data ) ) {
                // logger.debug( `🔍 [fetchAllPrivateUserMessages] No valid data array found in response` );
                if ( logLastMessage ) {
                    // logger.debug( '📥 No private messages found.' );
                }
                return [];
            }

            const messages = response.data.data;
            // logger.debug( `🔍 [fetchAllPrivateUserMessages] Found ${messages.length} messages` );

            // Log the last message if requested
            if ( logLastMessage ) {
                if ( messages.length > 0 ) {
                    const lastMessage = messages[ 0 ]; // Messages are typically in reverse chronological order
                    const text = lastMessage.data?.text || '[No Text]';
                    const sender = lastMessage.sender?.uid || lastMessage.sender || 'Unknown';
                    // logger.debug( `📥 Private message from ${ sender }: ${ text }` );
                } else {
                    // logger.debug( '📥 No private messages found.' );
                }
            }

            // Return data if requested
            if ( !returnData ) {
                // logger.debug( `🔍 [fetchAllPrivateUserMessages] returnData=false, returning empty array` );
                return [];
            }

            const simplifiedMessages = messages.map( ( msg, index ) => {
                // logger.debug( `🔍 [fetchAllPrivateUserMessages] Processing message ${index}: ${JSON.stringify(msg, null, 2)}` );

                const customData = msg.data?.metadata?.chatMessage;

                // Extract sender UUID from nested structure (same as groupMessageService)
                const senderFromData = msg.data?.entities?.sender?.entity?.uid;
                const senderFromChatMessage = msg.data?.metadata?.chatMessage?.userUuid;
                const senderFromCustomData = msg.data?.metadata?.message?.customData?.userUuid;
                const extractedSender = msg.sender?.uid || senderFromData || senderFromChatMessage || senderFromCustomData || 'Unknown';

                const simplified = {
                    id: msg.id,
                    text: msg.data?.text || '[No content]',
                    sender: extractedSender,
                    sentAt: msg.sentAt,
                    customData: customData || null
                };

                // logger.debug( `🔍 [fetchAllPrivateUserMessages] Simplified message ${index}: ${JSON.stringify(simplified, null, 2)}` );
                return simplified;
            } );

            // logger.debug( `🔍 [fetchAllPrivateUserMessages] Returning ${simplifiedMessages.length} simplified messages` );
            return simplifiedMessages;
        } catch ( err ) {
            logger.error( `❌ [fetchAllPrivateUserMessages] Error fetching private messages: ${ err.message }` );
            logger.error( `❌ [fetchAllPrivateUserMessages] Error stack: ${ err.stack }` );
            return [];
        }
    }
};

module.exports = privateMessageService;
