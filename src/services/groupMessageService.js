// src/services/groupMessageService.js
const { v4: uuidv4 } = require( 'uuid' );
const openchatApi = require( './openchatApi.js' );
const config = require( '../config.js' );
const { logger } = require( '../lib/logging.js' );
const { buildUrl, makeRequest } = require( '../lib/buildUrl' );

// Constants
const RECEIVER_TYPE = {
    GROUP: "group"
};

let latestGroupMessageId = null;

// ===============
// Helper functions
// ===============

// buildCustomData and buildPayload are now imported from openchatApi

function setLatestGroupMessageId ( id ) {
    latestGroupMessageId = id;
}

function getLatestGroupMessageId () {
    return latestGroupMessageId;
}

function filterMessagesForCommands ( messages ) {
    if ( !Array.isArray( messages ) ) {
        return [];
    }

    const commandSwitch = process.env.COMMAND_SWITCH || config.COMMAND_SWITCH;
    return messages.filter( message => {
        const text = message?.data?.text;
        return text && text.startsWith( commandSwitch );
    } );
}

// ===============
// Group Message Service
// ===============

const groupMessageService = {
    // Helper functions (exported for testing) - now from openchatApi
    buildCustomData: openchatApi.buildCustomData,
    buildPayload: openchatApi.buildPayload,
    getLatestGroupMessageId,
    setLatestGroupMessageId,
    filterMessagesForCommands,

    /**
     * Join a chat group
     * @param {string} roomId - The room ID to join
     * @returns {Promise<Object>} Response object
     */
    joinChat: async function ( roomId ) {
        try {
            const response = await openchatApi.joinChatGroup( roomId );
            return response;
        } catch ( error ) {
            if ( error.message && error.message.includes( 'ERR_ALREADY_JOINED' ) ) {
                logger.debug( '✅ User already joined chat group - continuing' );
                return { success: true, alreadyJoined: true };
            }

            logger.error( `❌ Error joining chat: ${ error.message }` );
            throw error;
        }
    },

    /**
     * Leave a chat group
     * @param {string} roomId - The room ID to leave
     * @returns {Promise<Object>} Response object
     */
    leaveChat: async function ( roomId ) {
        try {
            const response = await openchatApi.leaveChatGroup( roomId );
            return response;
        } catch ( error ) {
            logger.error( `❌ Error leaving chat: ${ error.message }` );
            throw error;
        }
    },

    /**
     * Send a group message
     * @param {string|Object} theMessage - Message text or options object
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response object
     */
    sendGroupMessage: async function ( theMessage, options = {} ) {
        try {
            let message, room, images, mentions, receiverType, senderUid, senderName, senderAvatarId, senderColor;

            if ( typeof theMessage === 'object' && theMessage.hasOwnProperty( 'message' ) ) {
                message = theMessage.message;
                room = theMessage.room || config.HANGOUT_ID;
                images = theMessage.images || null;
                mentions = theMessage.mentions || null;
                receiverType = theMessage.receiverType || RECEIVER_TYPE.GROUP;
                senderUid = theMessage.senderUid || null;
                senderName = theMessage.senderName || null;
                senderAvatarId = theMessage.senderAvatarId || null;
                senderColor = theMessage.senderColor || null;
            } else if ( typeof theMessage === 'object' ) {
                // Object without message property is invalid
                throw new Error( 'Message content is required' );
            } else {
                message = theMessage;
                room = options.room || config.HANGOUT_ID;
                images = options.images || null;
                mentions = options.mentions || null;
                receiverType = options.receiverType || RECEIVER_TYPE.GROUP;
                senderUid = options.senderUid || null;
                senderName = options.senderName || null;
                senderAvatarId = options.senderAvatarId || null;
                senderColor = options.senderColor || null;
            }

            if ( !message ) {
                throw new Error( 'Message content is required' );
            }

            const customData = await openchatApi.buildCustomData( message, options.services || {}, senderUid, senderName, senderAvatarId, senderColor );

            if ( images ) {
                customData.imageUrls = images;
            }

            if ( mentions ) {
                customData.mentions = mentions.map( mention => ( {
                    start: mention.position,
                    userNickname: mention.nickname,
                    userUuid: mention.userId
                } ) );
            }

            const payload = await openchatApi.buildPayload( room, receiverType, customData, message );

            const response = await openchatApi.sendMessage( payload );

            return {
                message: message,
                messageResponse: response.data
            };

        } catch ( err ) {
            logger.error( `❌ Failed to send group message: ${ typeof theMessage === 'object' ? theMessage.message : theMessage }` );
            if ( err.response?.data ) {
                logger.error( `Error response data: ${ err.response.data }` );
            }
            if ( err.message ) {
                logger.error( `Error message: ${ err.message }` );
            }
            if ( err.response?.status ) {
                logger.error( `Error status: ${ err.response.status }` );
            }

            return {
                message: typeof theMessage === 'object' ? theMessage.message : theMessage,
                error: err.response?.data || err.message || "Unknown error"
            };
        }
    },

    /**
     * Send a group message with picture
     * @param {string} message - The message text
     * @param {string} imageUrl - The image URL
     * @param {Object} services - Services container
     * @param {string} senderUid - Optional UID of the user who triggered this message
     * @param {string} senderName - Optional name of the user who triggered this message
     * @returns {Promise<Object>} Response object
     */
    sendGroupPictureMessage: async function ( message, imageUrl, services, senderUid = null, senderName = null, senderAvatarId = null, senderColor = null ) {
        try {
            const messageOptions = {
                message: message,
                images: [ imageUrl ],
                services: services,
                senderUid: senderUid,
                senderName: senderName,
                senderAvatarId: senderAvatarId,
                senderColor: senderColor
            };

            const response = await this.sendGroupMessage( messageOptions );

            return response;
        } catch ( err ) {
            logger.error( `❌ Failed to send group picture message: ${ err.message }` );
            throw err;
        }
    },

    /**
     * Fetch group messages
     * @param {string} roomId - Room ID (optional, defaults to HANGOUT_ID)
     * @param {Object} options - Fetch options
     * @returns {Promise<Array>} Array of messages
     */
    fetchGroupMessages: async function ( roomId = null, options = {} ) {
        try {
            const targetRoomId = roomId || config.HANGOUT_ID;
            const { lastID, limit = 50, filterCommands = true, fromTimestamp, services } = options;

            // Log input parameters
            logger.info( `📡 [fetchGroupMessages] Called with:
              - roomId: ${ roomId } (target: ${ targetRoomId })
              - lastID: ${ lastID || 'not set' }
              - fromTimestamp: ${ fromTimestamp || 'not set' }
              - limit: ${ limit }
              - filterCommands: ${ filterCommands }` );

            const params = [];
            const messageId = lastID || this.getLatestGroupMessageId();

            // Log message ID resolution
            logger.debug( `📡 [fetchGroupMessages] Message ID resolution:
              - getLatestGroupMessageId(): ${ this.getLatestGroupMessageId() }
              - resolved messageId to use: ${ messageId || 'none' }` );

            if ( messageId ) {
                params.push( [ 'id', messageId ] );
                logger.debug( `📡 [fetchGroupMessages] Added id parameter: ${ messageId }` );
            } else {
                logger.debug( `📡 [fetchGroupMessages] No messageId available, will fetch latest messages` );
            }

            if ( fromTimestamp ) {
                params.push( [ 'updatedAt', fromTimestamp ] );
                logger.debug( `📡 [fetchGroupMessages] Added updatedAt parameter: ${ fromTimestamp }` );
            }

            if ( limit !== 50 ) {
                params.push( [ 'per_page', limit ] );
                logger.debug( `📡 [fetchGroupMessages] Added per_page parameter: ${ limit }` );
            }

            // Log final parameters array
            logger.info( `📡 [fetchGroupMessages] Final API params (${ params.length } total):
              - ${ params.map( p => `${ p[ 0 ] }=${ p[ 1 ] }` ).join( '\n              - ' ) || 'no params' }` );

            const messages = await this.fetchGroupMessagesRaw( targetRoomId, params, services );

            // Log raw response from API
            logger.info( `📡 [fetchGroupMessages] Raw API response: ${ messages?.length || 0 } messages returned` );
            if ( messages?.length ) {
                logger.debug( `📡 [fetchGroupMessages] Message details:
                  - IDs: ${ messages.map( m => m.id ).join( ', ' ) }
                  - Senders: ${ messages.map( m => m.sender?.uid || m.sender || 'unknown' ).join( ', ' ) }
                  - Timestamps: ${ messages.map( m => m.sentAt ).join( ', ' ) }` );
            }

            if ( !messages || messages.length === 0 ) {
                logger.debug( `📡 [fetchGroupMessages] No messages in response, returning empty array` );
                return [];
            }

            let filteredMessages = messages;

            if ( filterCommands ) {
                filteredMessages = this.filterMessagesForCommands( messages );
                logger.info( `📡 [fetchGroupMessages] Filtered for commands: ${ messages.length } → ${ filteredMessages.length } messages` );
                if ( filteredMessages?.length ) {
                    logger.debug( `📡 [fetchGroupMessages] Command message IDs: ${ filteredMessages.map( m => m.id ).join( ', ' ) }` );
                }
            } else {
                logger.debug( `📡 [fetchGroupMessages] Not filtering (filterCommands=false)` );
            }

            const formattedMessages = filteredMessages.map( msg => {
                const text = msg.data?.text || '[No Text]';

                // Extract sender UUID from nested structure
                const senderFromData = msg.data?.entities?.sender?.entity?.uid;
                const senderFromChatMessage = msg.data?.metadata?.chatMessage?.userUuid;
                const senderFromCustomData = msg.data?.metadata?.message?.customData?.userUuid;

                // Try multiple extraction paths in order of preference
                const extractedSender = msg.sender?.uid || senderFromData || senderFromChatMessage || senderFromCustomData || 'Unknown';

                return {
                    id: msg.id,
                    text: text,
                    sender: extractedSender,
                    sentAt: msg.sentAt,
                    updatedAt: msg.updatedAt,
                    data: msg.data // Include original data for backward compatibility
                };
            } );

            // Log final results
            logger.info( `📡 [fetchGroupMessages] Final results:
              - Raw messages: ${ messages?.length || 0 }
              - After command filter: ${ filteredMessages?.length || 0 }
              - After formatting: ${ formattedMessages?.length || 0 }
              ${ formattedMessages?.length > 0 ? `- Returning message IDs: ${ formattedMessages.map( m => m.id ).join( ', ' ) }` : '- No messages to return' }` );

            return formattedMessages;

        } catch ( err ) {
            logger.error( `❌ Error fetching group messages: ${ err.message }` );
            logger.debug( `Error details: ${ err.stack }` );
            return [];
        }
    },

    /**
     * Fetch raw group messages (unprocessed)
     * @param {string} roomId - Room ID
     * @param {Array} params - URL parameters
     * @param {Object} services - Services container for state management
     * @returns {Promise<Array>} Raw message array
     */
    fetchGroupMessagesRaw: async function ( roomId, params = [], services ) {
        const messageLimit = 50; // Default message limit
        const defaultParams = [
            [ 'per_page', messageLimit ],
            [ 'hideMessagesFromBlockedUsers', 0 ],
            [ 'unread', 0 ],
            [ 'withTags', 0 ],
            [ 'undelivered', 0 ],
            [ 'hideDeleted', 0 ],
            [ 'affix', 'append' ],
        ];

        try {
            const finalParams = [ ...defaultParams, ...params ];

            // Log API request details
            logger.info( `🔌 [fetchGroupMessagesRaw] Making API request:
              - Endpoint: v3.0/groups/${ roomId }/messages
              - Total params: ${ finalParams.length }
              - Params: ${ finalParams.map( p => `${ p[ 0 ] }=${ p[ 1 ] }` ).join( ', ' ) }` );

            // Use openchatApi.fetchMessages with the correct endpoint format
            const response = await openchatApi.fetchMessages( `v3.0/groups/${ roomId }/messages`, finalParams );

            // Log API response details
            const messagesCount = response.data?.data?.length || 0;
            logger.info( `🔌 [fetchGroupMessagesRaw] API response received:
              - Status: ${ response.status }
              - Messages in response: ${ messagesCount }
              - Has data.data: ${ !!response.data?.data }
              ${ messagesCount > 0 ? `- Message IDs: ${ response.data.data.map( m => m.id ).join( ', ' ) }` : '' }
              ${ messagesCount > 0 ? `- Timestamps: ${ response.data.data.map( m => m.sentAt ).join( ', ' ) }` : '' }` );

            const messages = response.data?.data || [];

            // Update lastMessageId with the last message ID if we have messages
            if ( messages.length > 0 && services && services.updateLastMessageId ) {
                const lastMessage = messages[ messages.length - 1 ];
                if ( lastMessage && lastMessage.id ) {
                    logger.debug( `💾 [fetchGroupMessagesRaw] Updating service state lastMessageId:
                      - Previous value: unknown
                      - New value: ${ lastMessage.id }
                      - From message: ${ lastMessage.id } (sentAt: ${ lastMessage.sentAt })` );
                    services.updateLastMessageId( lastMessage.id );

                    // Verify the update worked
                    const verifyId = services.getState ? services.getState( 'lastMessageId' ) : 'getState not available';
                    logger.debug( `💾 [fetchGroupMessagesRaw] Verification - getState('lastMessageId'): ${ verifyId }` );
                } else {
                    logger.warn( `⚠️ [fetchGroupMessagesRaw] Could not extract ID from last message. lastMessage: ${ JSON.stringify( lastMessage ) }` );
                }
            } else {
                logger.debug( `💾 [fetchGroupMessagesRaw] Skipping lastMessageId update:
                  - Has messages: ${ messages.length > 0 }
                  - Has services: ${ !!services }
                  - Has updateLastMessageId method: ${ !!( services && services.updateLastMessageId ) }` );
            }

            return messages;
        } catch ( err ) {
            logger.error( `❌ Error in fetchGroupMessagesRaw: ${ JSON.stringify( {
                message: err?.message || 'Unknown error',
                status: err?.response?.status,
                statusText: err?.response?.statusText,
                url: err?.config?.url,
                responseData: err?.response?.data
            }, null, 2 ) }` );
            logger.debug( `Error stack: ${ err?.stack }` );
            return [];
        }
    }
};

module.exports = groupMessageService;
