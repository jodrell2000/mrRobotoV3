const { logger } = require( '../lib/logging.js' );
const axios = require( 'axios' );
const config = require( '../config.js' );
const { buildUrl, makeRequest } = require( '../lib/buildUrl' );
const { v4: uuidv4 } = require( 'uuid' );

// Import retry service - will be injected via function parameters to avoid circular dependencies
let retryService = null;

/**
 * Set the retry service instance (called from serviceContainer after initialization)
 * @param {RetryService} retryServiceInstance - The retry service instance
 */
function setRetryService ( retryServiceInstance ) {
  retryService = retryServiceInstance;
}

const BASE_URL = `https://${ config.COMETCHAT_API_KEY }.apiclient-us.cometchat.io`;

const headers = {
  'Content-Type': 'application/json',
  authtoken: config.COMETCHAT_AUTH_TOKEN,
  appid: config.COMETCHAT_API_KEY,
  dnt: 1,
  origin: 'https://tt.live',
  referer: 'https://tt.live/',
  sdk: 'javascript@3.0.10'
};

const apiClient = axios.create( {
  baseURL: BASE_URL,
  headers
} );

// ===============
// Shared Message Utilities
// ===============

/**
 * Build custom data for CometChat messages
 * @param {string} theMessage - The message text
 * @param {Object} services - Services container
 * @param {string} senderUid - Optional UID of the user who triggered this message
 * @param {string} senderName - Optional name of the user who triggered this message (overrides default bot name)
 * @returns {Promise<Object>} Custom data object
 */
async function buildCustomData ( theMessage, services, senderUid = null, senderName = null, senderAvatarId = null, senderColor = null ) {
  const dataService = services?.dataService;

  const customData = {
    message: theMessage,
    avatarId: senderAvatarId || dataService?.getValue( 'botData.CHAT_AVATAR_ID' ) || 'bot-01',
    userName: senderName || dataService?.getValue( 'botData.CHAT_NAME' ) || 'Bot',
    color: senderColor || `#${ dataService?.getValue( 'botData.CHAT_COLOUR' ) || 'ff9900' }`,
    mentions: [],
    userUuid: config.BOT_UID,
    badges: [ 'VERIFIED', 'STAFF' ],
    id: uuidv4()
  };

  // Store the actual sender if different from bot
  if ( senderUid && senderUid !== config.BOT_UID ) {
    customData.triggeredBy = senderUid;
  }

  return customData;
}

/**
 * Build message payload for CometChat API
 * @param {string} receiver - The receiver ID
 * @param {string} receiverType - The receiver type (user/group)
 * @param {Object} customData - Custom data object
 * @param {string} theMessage - The message text
 * @returns {Promise<Object>} Message payload
 */
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

/**
 * Send a message via CometChat API with retry logic
 * @param {Object} payload - The message payload
 * @returns {Promise<Object>} API response
 */
async function sendMessage ( payload ) {
  const executeRequest = async () => {
    try {
      const response = await axios.post( `${ BASE_URL }/v3.0/messages`, payload, { headers } );
      return response;
    } catch ( error ) {
      logger.error( `[CometChat API] sendMessage error - Status: ${ error.response?.status }, Data: ${ JSON.stringify( error.response?.data, null, 2 ) }` );
      throw error;
    }
  };

  if ( retryService ) {
    return await retryService.executeWithRetry(
      executeRequest,
      { maxRetries: 3 },
      'cometchat-sendMessage'
    );
  } else {
    // Fallback to direct request if retry service not available
    return await executeRequest();
  }
}

/**
 * Join a chat group with retry logic
 * @param {string} roomId - The room ID to join
 * @returns {Promise<Object>} API response
 */
async function joinChatGroup ( roomId ) {
  const executeRequest = async () => {
    const url = `https://${ config.COMETCHAT_API_KEY }.apiclient-us.cometchat.io/v3/groups/${ roomId }/members`;
    // logger.debug( `[CometChat API] joinChatGroup - URL: ${ url }` );

    const requestData = {
      participants: [ config.BOT_UID ],
      participantType: 'user'
    };

    // logger.debug( `[CometChat API] joinChatGroup - Request data: ${ JSON.stringify( requestData ) }` );

    try {
      return await axios.post( url, requestData, { headers } );
    } catch ( error ) {
      // Handle "already joined" as a success case
      if ( error.response?.status === 417 &&
        error.response?.data?.error?.code === 'ERR_ALREADY_JOINED' ) {
        logger.info( `✅ [CometChat API] Bot is already a member of group ${ roomId }` );
        // Return a success response for already joined
        return {
          status: 200,
          data: { message: 'Already joined group', alreadyMember: true }
        };
      }
      // Re-throw other errors for normal retry handling
      throw error;
    }
  };

  if ( retryService ) {
    return await retryService.executeWithRetry(
      executeRequest,
      { maxRetries: 2 }, // Less aggressive for join operations
      'cometchat-joinGroup'
    );
  } else {
    // Fallback to direct request if retry service not available
    return await executeRequest();
  }
}

/**
 * Fetch messages from CometChat API with retry logic
 * @param {string} endpoint - The API endpoint
 * @param {Array} queryParams - Query parameters
 * @returns {Promise<Object>} API response
 */
async function fetchMessages ( endpoint, queryParams = [] ) {
  const executeRequest = async () => {
    let endpointPath = endpoint; // Default to the full endpoint
    let endpointParams = [];

    // Parse endpoint if it contains query parameters
    if ( endpoint.includes( '?' ) ) {
      const [ path, queryString ] = endpoint.split( '?' );
      endpointPath = path;

      // Parse query parameters from endpoint
      const urlParams = new URLSearchParams( queryString );
      endpointParams = Array.from( urlParams.entries() );

      // logger.debug( `🔍 [CometChat API] fetchMessages - Parsed endpoint path: ${ endpointPath }` );
      // logger.debug( `🔍 [CometChat API] fetchMessages - Parsed endpoint params: ${JSON.stringify(endpointParams)}` );
    }

    // Combine endpoint params with additional params
    const allParams = [ ...endpointParams, ...queryParams ];
    // logger.debug( `🔍 [CometChat API] fetchMessages - All combined params: ${JSON.stringify(allParams)}` );

    const url = buildUrl( BASE_URL, [ endpointPath ], allParams );

    // logger.debug( `🔍 [CometChat API] fetchMessages - Final URL: ${ url }` );
    // logger.debug( `🔍 [CometChat API] fetchMessages - Headers: ${JSON.stringify(headers, null, 2)}` );

    const response = await apiClient.get( url );

    // logger.debug( `🔍 [CometChat API] fetchMessages - Response status: ${ response.status }` );
    // logger.debug( `🔍 [CometChat API] fetchMessages - Response data count: ${ response.data?.data?.length || 0 }` );

    // if ( response.data?.data?.length > 0 ) {
    //   const messages = response.data.data;
    //   logger.debug( `🔍 [CometChat API] fetchMessages - First message ID: ${ messages[ 0 ]?.id }` );
    //   logger.debug( `🔍 [CometChat API] fetchMessages - Last message ID: ${ messages[ messages.length - 1 ]?.id }` );
    // } else {
    //   logger.debug( `🔍 [CometChat API] fetchMessages - No messages returned` );
    // }

    return response;
  };

  if ( retryService ) {
    try {
      // Check if circuit breaker is open before attempting request
      if ( retryService.isCircuitOpen && retryService.isCircuitOpen( 'cometchat-fetchMessages' ) ) {
        logger.error( '❌ [CometChat API] fetchMessages - Circuit breaker is OPEN, skipping request' );
        const error = new Error( 'Circuit breaker is OPEN for cometchat-fetchMessages' );
        error.code = 'CIRCUIT_BREAKER_OPEN';
        throw error;
      }

      return await retryService.executeWithRetry(
        executeRequest,
        { maxRetries: 3 },
        'cometchat-fetchMessages'
      );
    } catch ( error ) {
      logger.error( `❌ [CometChat API] fetchMessages - Error: ${ error.message }` );
      logger.error( `❌ [CometChat API] fetchMessages - Error status: ${ error.response?.status }` );
      logger.error( `❌ [CometChat API] fetchMessages - Error response: ${ JSON.stringify( error.response?.data, null, 2 ) }` );
      logger.error( `❌ [CometChat API] fetchMessages - Error stack: ${ error.stack }` );

      // Check if this is an authorization error (user not in group)
      const errorCode = error.response?.data?.error?.code;
      const status = error.response?.status;
      if ( status === 401 && errorCode === 'ERR_GROUP_NOT_JOINED' ) {
        logger.warn( '⚠️ [CometChat API] Bot is no longer a member of the group - triggering reconnect' );
        error.shouldReconnect = true;
      }

      throw error;
    }
  } else {
    // Fallback to direct request if retry service not available
    try {
      return await executeRequest();
    } catch ( error ) {
      logger.error( `❌ [CometChat API] fetchMessages - Error: ${ error.message }` );
      logger.error( `❌ [CometChat API] fetchMessages - Error status: ${ error.response?.status }` );
      logger.error( `❌ [CometChat API] fetchMessages - Error response: ${ JSON.stringify( error.response?.data, null, 2 ) }` );
      logger.error( `❌ [CometChat API] fetchMessages - Error stack: ${ error.stack }` );

      // Check if this is an authorization error (user not in group)
      const errorCode = error.response?.data?.error?.code;
      const status = error.response?.status;
      if ( status === 401 && errorCode === 'ERR_GROUP_NOT_JOINED' ) {
        logger.warn( '⚠️ [CometChat API] Bot is no longer a member of the group - triggering reconnect' );
        error.shouldReconnect = true;
      }

      throw error;
    }
  }
}

/**
 * Mark a conversation as read with retry logic
 * @param {string} conversationUrl - The conversation URL
 * @returns {Promise<Object>} API response
 */
async function markConversationAsRead ( conversationUrl ) {
  const executeRequest = async () => {
    return await axios.post( conversationUrl, {}, { headers } );
  };

  if ( retryService ) {
    return await retryService.executeWithRetry(
      executeRequest,
      { maxRetries: 2 }, // Less critical operation
      'cometchat-markAsRead'
    );
  } else {
    // Fallback to direct request if retry service not available
    return await executeRequest();
  }
}

module.exports = {
  BASE_URL,
  headers,
  apiClient,
  buildCustomData,
  buildPayload,
  sendMessage,
  joinChatGroup,
  fetchMessages,
  markConversationAsRead,
  setRetryService
};
