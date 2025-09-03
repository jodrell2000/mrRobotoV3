// src/services/privateMessageService.js
const { v4: uuidv4 } = require( 'uuid' );
const cometchatApi = require( './cometchatApi.js' );
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

async function buildCustomData ( theMessage, services ) {
    if ( services.dataService ) {
        if ( services.dataService.getAllData ) {
            const data = services.dataService.getAllData();
        }
    }
    return {
        message: theMessage,
        avatarId: services.dataService?.getValue( 'botData.CHAT_AVATAR_ID' ),
        userName: services.dataService?.getValue( 'botData.CHAT_NAME' ),
        color: `#${ services.dataService?.getValue( 'botData.CHAT_COLOUR' ) }`,
        mentions: [],
        userUuid: config.BOT_UID,
        badges: [ 'VERIFIED', 'STAFF' ],
        id: uuidv4()
    };
}

async function buildPayload ( receiver, receiverType, customData, theMessage ) {
    return {
        receiver: receiver,
        receiverType: receiverType,
        category: 'message',
        type: 'text',
        data: {
            text: theMessage,
            metadata: {
                chatMessage: customData
            }
        }
    };
}

// ===============
// Private Message Service
// ===============

const privateMessageService = {
    // Helper functions (exported for testing)
    buildCustomData,
    buildPayload,

    /**
     * Send a private message to a user
     * @param {string} theMessage - The message text
     * @param {string} receiver - The receiver's user ID
     * @param {Object} services - Services container
     * @returns {Promise<void>}
     */
    sendPrivateMessage: async function ( theMessage, receiver, services = {} ) {
        try {
            const customData = await this.buildCustomData( theMessage, services );
            const payload = await this.buildPayload( receiver, RECEIVER_TYPE.USER, customData, theMessage );
            const response = await cometchatApi.sendMessage( payload );
            logger.debug( `✅ Private message sent: ${ JSON.stringify( response.data, null, 2 ) }` );
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
        try {
            const endpoint = `v3/users/${ config.BOT_UID }/conversations/${ userID }/messages`;
            const params = [ [ 'unread', 'true' ] ];

            const response = await cometchatApi.fetchMessages( endpoint, params );

            if ( response?.data?.length > 0 ) {
                const lastMessage = response.data[ 0 ];
                return lastMessage.id;
            }

            return null;
        } catch ( err ) {
            logger.error( `❌ Error getting last user message: ${ err.message }` );
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
                logger.debug( `✅ Marked messages as read for user: ${ userID }` );
            } else {
                logger.debug( `No unread messages found for user ${ userID }` );
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
                const conversationUrl = `${ cometchatApi.BASE_URL }/v3/messages/${ lastMessageID }/interactions`;
                await cometchatApi.markConversationAsRead( conversationUrl );
                logger.debug( `✅ Message marked as read: ${ lastMessageID }` );
            } else {
                // Mark entire conversation as read
                const conversationUrl = `${ cometchatApi.BASE_URL }/v3/users/${ config.COMETCHAT_RECEIVER_UID }/conversation/read`;
                await cometchatApi.markConversationAsRead( conversationUrl );
                logger.debug( `✅ Conversation marked as read for user: ${ config.COMETCHAT_RECEIVER_UID }` );
            }
        } catch ( err ) {
            logger.error( `❌ Error marking message as read: ${ err.response?.data || err.message }` );
            throw err;
        }
    },

    /**
     * Fetch all private messages from a specific user
     * @param {string} userUUID - The user UUID
     * @returns {Promise<Array>} Array of simplified messages
     */
    fetchAllPrivateUserMessages: async function ( userUUID ) {
        try {
            const endpoint = `v3/users/${ config.BOT_UID }/conversations/${ userUUID }/messages`;
            const response = await cometchatApi.fetchMessages( endpoint );

            if ( !response?.data || !Array.isArray( response.data ) ) {
                return [];
            }

            const messages = response.data;
            const simplifiedMessages = messages.map( msg => {
                const customData = msg.data?.metadata?.chatMessage;

                // Extract sender UUID from nested structure (same as groupMessageService)
                const senderFromData = msg.data?.entities?.sender?.entity?.uid;
                const senderFromChatMessage = msg.data?.metadata?.chatMessage?.userUuid;
                const senderFromCustomData = msg.data?.metadata?.message?.customData?.userUuid;
                const extractedSender = msg.sender?.uid || senderFromData || senderFromChatMessage || senderFromCustomData || 'Unknown';

                return {
                    id: msg.id,
                    text: msg.data?.text || '[No content]',
                    sender: extractedSender,
                    sentAt: msg.sentAt,
                    customData: customData || null
                };
            } );

            return simplifiedMessages;
        } catch ( err ) {
            logger.error( `❌ Error fetching private messages: ${ err.message }` );
            return [];
        }
    },

    /**
     * Fetch private messages from all present users (excluding bot)
     * @param {Object} services - Services container
     * @returns {Promise<Array>} Array of messages
     */
    fetchPrivateMessagesForPresentUsers: async function ( services ) {
        try {
            // Use hangUserService from the service container
            const hangUserService = services?.hangUserService;

            if ( !hangUserService || typeof hangUserService.getAllPresentUsers !== 'function' ) {
                logger.error( 'fetchPrivateMessagesForPresentUsers: hangUserService not available in services container' );
                return [];
            }

            // Get all users currently in the hangout
            const allUserUUIDs = hangUserService.getAllPresentUsers( services );

            if ( !Array.isArray( allUserUUIDs ) || allUserUUIDs.length === 0 ) {
                logger.debug( 'fetchPrivateMessagesForPresentUsers: No users found in hangout' );
                return [];
            }

            // Filter out the bot's own UUID
            const otherUserUUIDs = allUserUUIDs.filter( uuid => uuid !== config.BOT_UID );

            if ( otherUserUUIDs.length === 0 ) {
                logger.debug( 'fetchPrivateMessagesForPresentUsers: No other users found (only bot in hangout)' );
                return [];
            }

            logger.debug( `fetchPrivateMessagesForPresentUsers: Fetching messages for ${ otherUserUUIDs.length } users` );

            // Fetch private messages from all present users (excluding the bot)
            const allMessages = [];
            for ( const userUUID of otherUserUUIDs ) {
                try {
                    const userMessages = await this.fetchAllPrivateUserMessages( userUUID );
                    if ( Array.isArray( userMessages ) && userMessages.length > 0 ) {
                        // Add user UUID to each message for context
                        const messagesWithUser = userMessages.map( msg => ( {
                            ...msg,
                            userUUID: userUUID
                        } ) );
                        allMessages.push( ...messagesWithUser );
                    }
                } catch ( err ) {
                    logger.error( `fetchPrivateMessagesForPresentUsers: Error fetching messages for user ${ userUUID }: ${ err.message }` );
                    // Continue with other users even if one fails
                }
            }

            logger.debug( `fetchPrivateMessagesForPresentUsers: Found ${ allMessages.length } total private messages from ${ otherUserUUIDs.length } users` );
            return allMessages;

        } catch ( err ) {
            logger.error( `❌ Error in fetchPrivateMessagesForPresentUsers: ${ err.message }` );
            return [];
        }
    },

    /**
     * Fetch private messages for a specific UUID and log last message details
     * @param {string} userUUID - The user UUID
     * @returns {Promise<void|Array>} Undefined normally, array if command message
     */
    fetchPrivateMessagesForUUID: async function ( userUUID ) {
        try {
            const { buildUrl } = require( '../lib/buildUrl' );
            const url = buildUrl( cometchatApi.BASE_URL, [
                'v3',
                'users',
                userUUID,
                'conversation'
            ], [
                [ 'conversationType', 'user' ],
                [ 'limit', 50 ],
                [ 'uid', config.BOT_UID ]
            ] );

            const res = await cometchatApi.apiClient.get( url );
            const msg = res.data.data.lastMessage;
            if ( msg ) {
                const text = msg.data?.text || '[No Text]';
                logger.debug( '📥 Private message from ' + msg.sender + ': ' + text );

                // Commented out return functionality as per old implementation
                // if (msg.data?.text?.startsWith(config.COMMAND_SWITCH)) {
                //   return [msg]; // Return an array for consistency
                // }
            } else {
                logger.debug( '📥 No private messages found.' );
            }
        } catch ( err ) {
            logger.error( `❌ Error fetching private messages: ${ err.message }` );
        }
    }
};

module.exports = privateMessageService;
