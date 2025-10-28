// src/services/groupMessageService.js
const { v4: uuidv4 } = require( 'uuid' );
const cometchatApi = require( './cometchatApi.js' );
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

// buildCustomData and buildPayload are now imported from cometchatApi

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
    // Helper functions (exported for testing) - now from cometchatApi
    buildCustomData: cometchatApi.buildCustomData,
    buildPayload: cometchatApi.buildPayload,
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
            const response = await cometchatApi.joinChatGroup( roomId );
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
     * Send a group message
     * @param {string|Object} theMessage - Message text or options object
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response object
     */
    sendGroupMessage: async function ( theMessage, options = {} ) {
        try {
            let message, room, images, mentions, receiverType;

            if ( typeof theMessage === 'object' && theMessage.hasOwnProperty( 'message' ) ) {
                message = theMessage.message;
                room = theMessage.room || config.HANGOUT_ID;
                images = theMessage.images || null;
                mentions = theMessage.mentions || null;
                receiverType = theMessage.receiverType || RECEIVER_TYPE.GROUP;
            } else if ( typeof theMessage === 'object' ) {
                // Object without message property is invalid
                throw new Error( 'Message content is required' );
            } else {
                message = theMessage;
                room = options.room || config.HANGOUT_ID;
                images = options.images || null;
                mentions = options.mentions || null;
                receiverType = options.receiverType || RECEIVER_TYPE.GROUP;
            }

            if ( !message ) {
                throw new Error( 'Message content is required' );
            }

            const customData = await cometchatApi.buildCustomData( message, options.services || {} );

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

            const payload = await cometchatApi.buildPayload( room, receiverType, customData, message );

            const response = await cometchatApi.sendMessage( payload );

            logger.debug( `✅ Group message sent successfully: ${ JSON.stringify( {
                message: message,
                room: room,
                receiverType: receiverType,
                hasImages: !!images,
                hasMentions: !!mentions,
                responseId: response.data?.data?.id
            } ) }` );

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
     * @returns {Promise<Object>} Response object
     */
    sendGroupPictureMessage: async function ( message, imageUrl, services ) {
        try {
            const response = await this.sendGroupMessage( {
                message: message,
                images: [ imageUrl ],
                services: services
            } );

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

            // Debug: Log input parameters
            // logger.debug( `[GroupMessage] fetchGroupMessages called with:` );
            // logger.debug( `[GroupMessage] - roomId: ${ roomId } (target: ${ targetRoomId })` );
            // logger.debug( `[GroupMessage] - options.lastID: ${ lastID }` );
            // logger.debug( `[GroupMessage] - options.fromTimestamp: ${ fromTimestamp }` );
            // logger.debug( `[GroupMessage] - options.limit: ${ limit }` );
            // logger.debug( `[GroupMessage] - options.filterCommands: ${ filterCommands }` );

            const params = [];
            const messageId = lastID || this.getLatestGroupMessageId();

            // Debug: Log message ID resolution
            // logger.debug( `[GroupMessage] - getLatestGroupMessageId(): ${ this.getLatestGroupMessageId() }` );
            // logger.debug( `[GroupMessage] - resolved messageId: ${ messageId }` );

            if ( messageId ) {
                params.push( [ 'id', messageId ] );
                // logger.debug( `[GroupMessage] - Added id parameter: ${ messageId }` );
            } else {
                // logger.debug( `[GroupMessage] - No messageId available, fetching latest messages` );
            }

            if ( fromTimestamp ) {
                params.push( [ 'updatedAt', fromTimestamp ] );
                // logger.debug( `[GroupMessage] - Added updatedAt parameter: ${ fromTimestamp }` );
            }

            if ( limit !== 50 ) {
                params.push( [ 'per_page', limit ] );
                // logger.debug( `[GroupMessage] - Added per_page parameter: ${ limit }` );
            }

            // Debug: Log final parameters
            // logger.debug( `[GroupMessage] - Final params array:`, params );

            const messages = await this.fetchGroupMessagesRaw( targetRoomId, params, services );

            if ( !messages || messages.length === 0 ) {
                // logger.debug( 'No group messages found' );
                return [];
            }

            let filteredMessages = messages;

            if ( filterCommands ) {
                filteredMessages = this.filterMessagesForCommands( messages );
            }

            const formattedMessages = filteredMessages.map( msg => {
                const text = msg.data?.text || '[No Text]';

                // Debug: Log sender extraction for each message
                // logger.debug( `Message ${ msg.id } sender field: ${ JSON.stringify( msg.sender ) }` );
                // logger.debug( `Message ${ msg.id } sender?.uid: ${ JSON.stringify( msg.sender?.uid ) }` );

                // Extract sender UUID from nested structure
                const senderFromData = msg.data?.entities?.sender?.entity?.uid;
                const senderFromChatMessage = msg.data?.metadata?.chatMessage?.userUuid;
                const senderFromCustomData = msg.data?.metadata?.message?.customData?.userUuid;

                // logger.debug( `Message ${ msg.id } data.entities.sender.entity.uid: "${ senderFromData }"` );
                // logger.debug( `Message ${ msg.id } data.metadata.chatMessage.userUuid: "${ senderFromChatMessage }"` );
                // logger.debug( `Message ${ msg.id } data.metadata.message.customData.userUuid: "${ senderFromCustomData }"` );

                // Try multiple extraction paths in order of preference
                const extractedSender = msg.sender?.uid || senderFromData || senderFromChatMessage || senderFromCustomData || 'Unknown';
                // logger.debug( `Message ${ msg.id } final sender: "${ extractedSender }"` );

                return {
                    id: msg.id,
                    text: text,
                    sender: extractedSender,
                    sentAt: msg.sentAt,
                    updatedAt: msg.updatedAt,
                    data: msg.data // Include original data for backward compatibility
                };
            } );

            // Debug: Log final results
            // logger.debug( `[GroupMessage] - Raw messages count: ${ messages?.length || 0 }` );
            // logger.debug( `[GroupMessage] - Filtered messages count: ${ filteredMessages?.length || 0 }` );
            // logger.debug( `[GroupMessage] - Final formatted messages count: ${ formattedMessages?.length || 0 }` );

            // if ( formattedMessages?.length > 0 ) {
            //     logger.debug( `[GroupMessage] - Returning message IDs: ${ formattedMessages.map( m => m.id ).join( ', ' ) }` );
            //     logger.debug( `[GroupMessage] - First message timestamp: ${ formattedMessages[ 0 ]?.sentAt }` );
            //     logger.debug( `[GroupMessage] - Last message timestamp: ${ formattedMessages[ formattedMessages.length - 1 ]?.sentAt }` );
            // } else {
            //     logger.debug( `[GroupMessage] - No messages being returned` );
            // }

            return formattedMessages;

        } catch ( err ) {
            logger.error( `❌ Error fetching group messages: ${ err.message }` );
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


            // Use cometchatApi.fetchMessages with the correct endpoint format
            const response = await cometchatApi.fetchMessages( `v3.0/groups/${ roomId }/messages`, finalParams );

            // Debug: Log the response
            // logger.debug( `[GroupMessageRaw] Response status: ${ response.status }` );
            // logger.debug( `[GroupMessageRaw] Response data count: ${ response.data?.data?.length || 0 }` );

            const messages = response.data?.data || [];

            // Debug: Log services parameter
            // logger.debug( `[GroupMessageRaw] Services parameter:`, {
            //     hasServices: !!services,
            //     hasUpdateMethod: !!( services && services.updateLastMessageId ),
            //     messagesCount: messages.length
            // } );

            // Update lastMessageId with the last message ID if we have messages
            if ( messages.length > 0 && services.updateLastMessageId ) {
                const lastMessage = messages[ messages.length - 1 ];
                if ( lastMessage && lastMessage.id ) {
                    // logger.debug( `[GroupMessageRaw] About to update lastMessageId from current value to: ${ lastMessage.id }` );
                    services.updateLastMessageId( lastMessage.id );
                    // logger.debug( `[GroupMessageRaw] Updated lastMessageId to: ${ lastMessage.id }` );

                    // Verify the update worked
                    const verifyId = services.getState ? services.getState( 'lastMessageId' ) : 'getState not available';
                    // logger.debug( `[GroupMessageRaw] Verification - getState('lastMessageId'): ${ verifyId }` );
                } else {
                    // logger.debug( `[GroupMessageRaw] No valid lastMessage.id found. lastMessage:`, lastMessage );
                }
            } else {
                // logger.debug( `[GroupMessageRaw] Not updating lastMessageId because:`, {
                //     hasMessages: messages.length > 0,
                //     hasServices: !!services,
                //     hasUpdateMethod: !!(services && services.updateLastMessageId)
                // });
            }

            return messages;
        } catch ( err ) {
            logger.error( `❌ Error in fetchGroupMessagesRaw: ${ JSON.stringify( {
                message: err?.message || 'Unknown error',
                status: err?.response?.status,
                statusText: err?.response?.statusText,
                url: err?.config?.url,
                responseData: err?.response?.data
            } ) }` );
            return [];
        }
    }
};

module.exports = groupMessageService;
