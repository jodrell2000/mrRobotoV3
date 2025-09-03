// src/services/messageService.js
const { v4: uuidv4 } = require( 'uuid' );
const axios = require( 'axios' );
const { buildUrl, makeRequest } = require( '../lib/buildUrl' );
const cometchatApi = require( './cometchatApi.js' );
const config = require( '../config.js' );
const { logger } = require( '../lib/logging.js' );

// variables
const RECEIVER_TYPE = {
  USER: "user",
  GROUP: "group"
};

let latestGroupMessageId = null;

// ===============

// Helper functions

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
  return messages.filter( msg => {
    const text = msg?.data?.text;
    return text && text.startsWith( commandSwitch );
  } );
}

async function buildCustomData ( theMessage, services ) {
  // Log only necessary service properties to avoid circular references
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
    mentions: [], // Will be populated by sendGroupMessage if provided
    userUuid: config.BOT_UID, // Standardized to BOT_UID
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

// exported functions

const messageService = {
  buildCustomData,
  buildPayload,
  getLatestGroupMessageId,
  setLatestGroupMessageId,
  filterMessagesForCommands,

  joinChat: async function ( roomId ) {
    try {
      // Build the correct members endpoint URL directly
      const url = `https://${ config.COMETCHAT_API_KEY }.apiclient-us.cometchat.io/v3/groups/${ roomId }/members`;
      // logger.debug(`Join chat URL is: ${url}`);

      // Include the participants data as required by the API
      const requestData = {
        participants: [ config.BOT_UID ]
      };

      const response = await makeRequest( url, {
        headers: cometchatApi.headers,
        method: 'POST',
        data: requestData
      } );

      // if (response) {
      //   logger.debug(`✅ Successfully joined chat: ${JSON.stringify(response, null, 2)}`);
      // } else {
      //   logger.debug('✅ Successfully joined chat: Response was undefined (request may have succeeded but no data returned)');
      // }
      return response;
    } catch ( error ) {
      // Check if the error is "already joined" which we can treat as success
      if ( error.message && error.message.includes( 'ERR_ALREADY_JOINED' ) ) {
        logger.debug( '✅ User already joined chat group - continuing' );
        return { success: true, alreadyJoined: true };
      }

      logger.error( `❌ Error joining chat: ${ error.message }` );
      throw error;
    }
  },

  sendPrivateMessage: async function ( theMessage, receiver, services = {} ) {
    try {
      const customData = await this.buildCustomData( theMessage, services );
      const payload = await this.buildPayload( receiver, RECEIVER_TYPE.USER, customData, theMessage );
      const response = await axios.post( `${ cometchatApi.BASE_URL }/v3.0/messages`, payload, { headers: cometchatApi.headers } );
      logger.debug( `✅ Private message sent: ${ JSON.stringify( response.data, null, 2 ) }` );
    } catch ( err ) {
      logger.error( `❌ Failed to send private message: ${ err.response?.data || err.message }` );
    }
  },

  sendGroupMessage: async function ( theMessage, options = {} ) {
    try {
      // Handle both string messages and options object (for postMessage compatibility)
      let message, room, images, mentions, receiverType;

      if ( typeof theMessage === 'object' && theMessage.message ) {
        // Called with options object (postMessage style): sendGroupMessage({message: "text", room: "id", ...})
        message = theMessage.message;
        room = theMessage.room || config.HANGOUT_ID;
        images = theMessage.images || null;
        mentions = theMessage.mentions || null;
        receiverType = theMessage.receiverType || RECEIVER_TYPE.GROUP;
      } else {
        // Called with string message (traditional style): sendGroupMessage("text", {room: "id", ...})
        message = theMessage;
        room = options.room || config.HANGOUT_ID;
        images = options.images || null;
        mentions = options.mentions || null;
        receiverType = options.receiverType || RECEIVER_TYPE.GROUP;
      }

      // Validation
      if ( !message ) {
        throw new Error( 'Message content is required' );
      }

      const customData = await this.buildCustomData( message, options.services || {} );

      // Add images if provided
      if ( images ) {
        customData.imageUrls = images;
      }

      // Add mentions if provided
      if ( mentions ) {
        customData.mentions = mentions.map( mention => ( {
          start: mention.position,
          userNickname: mention.nickname,
          userUuid: mention.userId
        } ) );
      }

      const payload = await this.buildPayload( room, receiverType, customData, message );

      const response = await axios.post( `${ cometchatApi.BASE_URL }/v3.0/messages`, payload, {
        headers: cometchatApi.headers
      } );

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
      // Log error details separately to avoid circular structure issues
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

  sendGroupPictureMessage: async function ( message, imageUrl, services = {} ) {
    try {
      // Call sendGroupMessage with both message and image URL
      const response = await this.sendGroupMessage( {
        message: message,
        images: [ imageUrl ],  // Wrap single image URL in array as expected by sendGroupMessage
        services: services
      } );

      return response;
    } catch ( err ) {
      logger.error( `❌ Failed to send group picture message: ${ err.message }` );
      throw err;
    }
  },

  markMessageAsInterracted: async function ( lastMessageID ) {
    // PATCH /v3/messages/:id/interacted

    try {
      const url = `${ cometchatApi.BASE_URL }/v3/messages/${ lastMessageID }/interacted`;
      const headers = {
        ...cometchatApi.headers,
        'accept': 'application/json',
        'content-type': 'application/json'
      };
      const data = {
        interactions: [ lastMessageID ]
      };

      logger.debug( `Attempting to mark message as interacted. ID: ${ lastMessageID }, URL: ${ url }, Payload: ${ JSON.stringify( data ) }, Request Headers: ${ JSON.stringify( headers ) }` );
      const response = await axios.patch( url, data, { headers } );
      logger.debug( `✅ Marked message as interacted: ${ JSON.stringify( response.data, null, 2 ) }` );
      logger.debug( `Response status: ${ response.status }` );
      logger.debug( `Response headers: ${ JSON.stringify( response.headers ) }` );
    } catch ( err ) {
      logger.error( `❌ Error marking message as interacted for ID ${ lastMessageID }: ${ err.response?.data || err.message }` );
      logger.error( `Full error object: ${ JSON.stringify( err, Object.getOwnPropertyNames( err ) ) }` );
      if ( err.response ) {
        logger.error( `Full error response: ${ JSON.stringify( err.response, null, 2 ) }` );
        logger.error( `Response status: ${ err.response.status }` );
        logger.error( `Response headers: ${ JSON.stringify( err.response.headers ) }` );
      }
    }
  },


  // Returns the last message ID for a user (from fetchAllPrivateUserMessages)
  returnLastUserMessage: async function ( userID ) {
    try {
      const url = buildUrl( cometchatApi.BASE_URL, [
        'v3', 'users', userID, 'messages'
      ], [
        [ 'limit', 1 ],
        [ 'unread', true ],
        [ 'uid', config.BOT_UID ]
      ] );
      const res = await cometchatApi.apiClient.get( url );
      if ( res.data && res.data.data && Array.isArray( res.data.data ) && res.data.data.length > 0 ) {
        return res.data.data[ 0 ].id;
      }
      return null;
    } catch ( err ) {
      logger.error( `❌ Error fetching last user message: ${ err.message }` );
      return null;
    }
  },

  // Marks the last private user message as read
  markAllPrivateUserMessagesAsRead: async function ( userID ) {
    try {
      // logger.debug(`markAllPrivateUserMessagesAsRead called for userID: ${userID}`);
      const lastMsgId = await this.returnLastUserMessage( userID );
      // logger.debug(`Last unread message ID for user ${userID}: ${lastMsgId}`);
      if ( lastMsgId ) {
        await this.markMessageAsInterracted( lastMsgId );
        // logger.debug(`✅ Marked last private message (${lastMsgId}) as read for user ${userID}`);
      } else {
        logger.debug( `No unread messages found for user ${ userID }` );
      }
    } catch ( err ) {
      logger.error( `❌ Error marking all private user messages as read for user ${ userID }: ${ err.message }` );
    }
  },

  fetchAllPrivateUserMessages: async function ( userUUID ) {
    // https://api-explorer.cometchat.com/reference/user-list-user-messages
    try {
      const url = buildUrl( cometchatApi.BASE_URL, [
        'v3',
        'users',
        userUUID,
        'messages'
      ], [
        [ 'limit', 50 ],
        [ 'unread', true ],
        [ 'uid', config.BOT_UID ]
      ] );

      const res = await cometchatApi.apiClient.get( url );

      // Extract only the fields we need from each message
      if ( res.data && res.data.data && Array.isArray( res.data.data ) ) {
        const messages = res.data.data;
        const simplifiedMessages = messages.map( msg => {
          // Extract message content safely (with fallbacks if structure is different)
          const messageContent = msg.data && msg.data.customData && msg.data.customData.message
            ? msg.data.customData.message
            : ( msg.data && msg.data.text ) ? msg.data.text : '[No message content]';

          return {
            id: msg.id,
            message: messageContent,
            readAt: msg.readAt ? new Date( msg.readAt * 1000 ).toISOString() : 'unread',
            sender: msg.sender // add sender for reply
          };
        } );
        return simplifiedMessages;
      } else {
        // logger.debug('No messages found or unexpected response format');
        return [];
      }
    } catch ( err ) {
      logger.error( `❌ Error fetching all messages: ${ err.message }` );
      return [];
    }
  },

  fetchPrivateMessagesForPresentUsers: async function ( services ) {
    try {
      // Use hangUserService from the service container
      const hangUserService = services.hangUserService;
      
      if (!hangUserService || typeof hangUserService.getAllPresentUsers !== 'function') {
        logger.error('fetchPrivateMessagesForPresentUsers: hangUserService not available in services container');
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

  fetchPrivateMessagesForUUID: async function ( userUUID ) {
    try {
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
      logger.debug( `fetchPrivateMessages res:${ JSON.stringify( res.data.data, null, 2 ) }` )
      const msg = res.data.data.lastMessage;
      if ( msg ) {
        logger.debug( `📥 Private message from ${ msg.sender }: ${ msg.data?.text || '[No Text]' }, ID: ${ msg.id }, Sender: ${ msg.sender }` );
        // if (msg.data?.text?.startsWith(config.COMMAND_SWITCH)) {
        //   return [msg]; // Return an array for consistency
        // }
      } else {
        logger.debug( '📥 No private messages found.' );
      }
    } catch ( err ) {
      logger.error( `❌ Error fetching private messages: ${ err.message }` );
    }
  },

  fetchGroupMessages: async function ( roomId = null, options = {} ) {
    const config = require( '../config.js' );
    try {
      const {
        fromTimestamp = null,
        lastID = null,
        filterCommands = true,
        limit = 50
      } = options;

      const targetRoomId = roomId || config.HANGOUT_ID;
      const latestMessageId = getLatestGroupMessageId();

      // Build parameters array
      const params = [];
      if ( lastID || latestMessageId ) {
        params.push( [ 'id', lastID || latestMessageId ] );
      }
      if ( fromTimestamp ) {
        params.push( [ 'sentAt', fromTimestamp ] );
      }
      if ( limit !== 50 ) {
        params.push( [ 'per_page', limit ] );
      }

      const messages = await this.fetchGroupMessagesRaw( targetRoomId, params );

      if ( !Array.isArray( messages ) ) {
        return [];
      }

      // Filter for command messages only if requested
      const filteredMessages = filterCommands ? filterMessagesForCommands( messages ) : messages;

      // if (filteredMessages.length > 0) {
      //   logger.debug(`📥 Group ${filterCommands ? 'command ' : ''}messages: ${JSON.stringify(filteredMessages)}`);
      // }

      return filteredMessages;
    } catch ( err ) {
      logger.error( `❌ Error fetching group messages: ${ err.message }` );
      return [];
    }
  },

  fetchGroupMessagesRaw: async function ( roomId, params = [] ) {
    const messageLimit = 50; // Default message limit
    const defaultParams = [
      [ 'per_page', messageLimit ],
      [ 'hideMessagesFromBlockedUsers', 0 ],
      [ 'unread', 0 ],
      [ 'withTags', 0 ],
      [ 'undelivered', 1 ],
      [ 'hideDeleted', 0 ],
      [ 'affix', 'append' ],
    ];

    try {
      const finalParams = [ ...defaultParams, ...params ];

      const url = buildUrl( cometchatApi.BASE_URL, [
        'v3.0',
        'groups',
        roomId,
        'messages'
      ], finalParams );

      // logger.debug(`Making API request to: ${url}`);

      const res = await cometchatApi.apiClient.get( url );
      return res.data?.data || [];
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
  },

  // Mark User Conversation As Read endpoint
  markMessageAsInterracted: async function () {
    try {
      const url = `${ cometchatApi.BASE_URL }/v3/users/${ config.COMETCHAT_RECEIVER_UID }/conversation/read`;
      const headers = {
        ...cometchatApi.headers,
        'accept': 'application/json',
        'content-type': 'application/json'
      };
      // logger.debug(`Attempting to mark conversation as read. UserID: ${config.COMETCHAT_RECEIVER_UID}, URL: ${url}, Request Headers: ${JSON.stringify(headers)}`);
      const response = await axios.post( url, {}, { headers } );
      // logger.debug(`✅ Marked conversation as read: ${JSON.stringify(response.data, null, 2)}`);
      // logger.debug(`Response status: ${response.status}`);
      // logger.debug(`Response headers: ${JSON.stringify(response.headers)}`);
    } catch ( err ) {
      logger.error( `❌ Error marking conversation as read for user ${ config.COMETCHAT_RECEIVER_UID }: ${ err.response?.data || err.message }` );
      logger.error( `Full error object: ${ JSON.stringify( err, Object.getOwnPropertyNames( err ) ) }` );
      if ( err.response ) {
        logger.error( `Full error response: ${ JSON.stringify( err.response, null, 2 ) }` );
        logger.error( `Response status: ${ err.response.status }` );
        logger.error( `Response headers: ${ JSON.stringify( err.response.headers ) }` );
      }
    }
  },

  returnLatestGroupMessageId: async function () {
    const MAX_LOOKBACK_MINUTES = 10;
    const now = Math.floor( Date.now() / 1000 );

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

      try {
        const res = await cometchatApi.apiClient.get( url );
        const messages = res.data?.data;

        if ( Array.isArray( messages ) && messages.length > 0 ) {
          const latest = messages[ 0 ];
          logger.debug( `✅ Found message: ID ${ latest.id } at sentAt ${ latest.sentAt } (lookback ${ i }m)` );
          return latest.id;
        }
        logger.debug( `🔍 No messages at ${ lookbackTimestamp } (${ i } min ago)` );
      } catch ( err ) {
        logger.error( `❌ Error fetching messages at lookback ${ i }m: ${ err.message }` );
        return null;
      }
    }

    logger.warn( '⚠️ No messages found in lookback window' );
    return null;
  },

  listGroupMembers: async function () {
    logger.debug( `Starting listGroupMembers` )

    let allMembers = [];
    let currentPage = 1;
    let hasMorePages = true;

    try {
      while ( hasMorePages ) {
        const url = buildUrl( cometchatApi.BASE_URL, [
          'v3.0',
          'groups',
          config.HANGOUT_ID,
          'members'
        ], [
          [ 'perPage', 100 ],
          [ 'uid', config.BOT_UID ],
          [ 'page', currentPage ],
          [ 'status', 'available' ]
        ] );

        logger.debug( `Fetching page ${ currentPage } of group members` );
        const res = await cometchatApi.apiClient.get( url );

        if ( res.data && res.data.data && Array.isArray( res.data.data ) ) {
          // Add this page's members to the collection
          allMembers = allMembers.concat( res.data.data );

          // Check if we need to fetch more pages
          const meta = res.data.meta;
          const count = meta?.pagination?.count || res.data.data.length;

          logger.debug( `Page ${ currentPage }: Found ${ res.data.data.length } members, total so far: ${ allMembers.length }` );

          // Continue if we got 100 members (full page) or if pagination indicates more pages
          if ( count >= 100 && meta?.pagination?.current_page < meta?.pagination?.total_pages ) {
            currentPage++;
          } else {
            hasMorePages = false;
          }
        } else {
          logger.debug( `No members found on page ${ currentPage } or unexpected response format` );
          hasMorePages = false;
        }
      }

      // Process all collected members
      if ( allMembers.length > 0 ) {
        const simplifiedMembers = allMembers.map( member => ( {
          name: member.name,
          uid: member.uid,
          conversationId: member.conversationId
        } ) );

        simplifiedMembers.forEach( member => {
          logger.debug( `- ${ member.name } (${ member.uid }): ${ member.conversationId }` );
        } );
        logger.debug( `Group members (${ simplifiedMembers.length } total):` );

        return { data: allMembers, totalCount: allMembers.length };
      } else {
        logger.debug( 'No members found' );
        return { data: [], totalCount: 0 };
      }

    } catch ( err ) {
      logger.error( `❌ Error fetching group members: ${ err.message }` );
      return null;
    }
  }
};

module.exports = {
  messageService
};
