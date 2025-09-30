const { logger } = require( '../lib/logging.js' );
const axios = require( 'axios' );
const config = require( '../config.js' );
const { buildUrl, makeRequest } = require( '../lib/buildUrl' );
const { v4: uuidv4 } = require( 'uuid' );

const BASE_URL = `https://${ config.COMETCHAT_API_KEY }.apiclient-us.cometchat.io`;

const headers = {
  'Content-Type': 'application/json',
  authtoken: config.COMETCHAT_AUTH_TOKEN,
  appid: config.COMETCHAT_API_KEY,  // Changed from 'appid' to 'apikey'
  onBehalfOf: config.BOT_UID,
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
 * @returns {Promise<Object>} Custom data object
 */
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
 * Send a message via CometChat API
 * @param {Object} payload - The message payload
 * @returns {Promise<Object>} API response
 */
async function sendMessage ( payload ) {
  try {
    const response = await axios.post( `${ BASE_URL }/v3.0/messages`, payload, { headers } );
    return response;
  } catch ( error ) {
    throw error;
  }
}

/**
 * Join a chat group
 * @param {string} roomId - The room ID to join
 * @returns {Promise<Object>} API response
 */
async function joinChatGroup ( roomId ) {
  try {
    const url = `https://${ config.COMETCHAT_API_KEY }.apiclient-us.cometchat.io/v3/groups/${ roomId }/members`;
    logger.debug( `[CometChat API] joinChatGroup - URL: ${ url }` );

    const requestData = {
      participants: [ config.BOT_UID ]
    };
    logger.debug( `[CometChat API] joinChatGroup - Request Data: ${ JSON.stringify( requestData ) }` );

    const response = await makeRequest( url, {
      headers,
      method: 'POST',
      data: requestData
    } );
    logger.debug( `[CometChat API] joinChatGroup - Response Status: ${ response.status }` );

    return response;
  } catch ( error ) {
    throw error;
  }
}

/**
 * Fetch messages from CometChat API
 * @param {string} endpoint - The API endpoint
 * @param {Object|Array} params - Query parameters (object or array of tuples)
 * @returns {Promise<Object>} API response
 */
async function fetchMessages ( endpoint, params = {} ) {
  try {
    logger.debug( `🔍 [CometChat API] fetchMessages - Starting request` );
    logger.debug( `🔍 [CometChat API] fetchMessages - Endpoint: ${ endpoint }` );
    logger.debug( `🔍 [CometChat API] fetchMessages - Raw params: ${JSON.stringify(params)}` );
    
    // Handle both object and array formats for params
    let queryParams;
    if ( Array.isArray( params ) ) {
      queryParams = params;
    } else {
      queryParams = Object.entries( params );
    }

    logger.debug( `🔍 [CometChat API] fetchMessages - Query params: ${JSON.stringify(queryParams)}` );

    // Parse endpoint to separate path and query parameters
    let endpointPath = endpoint;
    let endpointParams = [];
    
    if ( endpoint.includes( '?' ) ) {
      const [ path, queryString ] = endpoint.split( '?' );
      endpointPath = path;
      
      // Parse query string into array of tuples
      const urlParams = new URLSearchParams( queryString );
      endpointParams = Array.from( urlParams.entries() );
      
      logger.debug( `🔍 [CometChat API] fetchMessages - Parsed endpoint path: ${ endpointPath }` );
      logger.debug( `🔍 [CometChat API] fetchMessages - Parsed endpoint params: ${JSON.stringify(endpointParams)}` );
    }
    
    // Combine endpoint params with additional params
    const allParams = [ ...endpointParams, ...queryParams ];
    logger.debug( `🔍 [CometChat API] fetchMessages - All combined params: ${JSON.stringify(allParams)}` );

    const url = buildUrl( BASE_URL, [ endpointPath ], allParams );

    logger.debug( `🔍 [CometChat API] fetchMessages - BASE_URL: ${ BASE_URL }` );
    logger.debug( `🔍 [CometChat API] fetchMessages - Final URL: ${ url }` );
    logger.debug( `🔍 [CometChat API] fetchMessages - Headers: ${JSON.stringify(headers, null, 2)}` );

    const response = await apiClient.get( url );

    logger.debug( `🔍 [CometChat API] fetchMessages - Response status: ${ response.status }` );
    logger.debug( `🔍 [CometChat API] fetchMessages - Response data count: ${ response.data?.data?.length || 0 }` );
    
    if ( response.data?.data?.length > 0 ) {
      const messages = response.data.data;
      logger.debug( `🔍 [CometChat API] fetchMessages - First message ID: ${ messages[ 0 ]?.id }` );
      logger.debug( `🔍 [CometChat API] fetchMessages - Last message ID: ${ messages[ messages.length - 1 ]?.id }` );
    } else {
      logger.debug( `🔍 [CometChat API] fetchMessages - No messages returned` );
    }

    return response;
  } catch ( error ) {
    logger.error( `❌ [CometChat API] fetchMessages - Error: ${ error.message }` );
    logger.error( `❌ [CometChat API] fetchMessages - Error status: ${ error.response?.status }` );
    logger.error( `❌ [CometChat API] fetchMessages - Error response: ${JSON.stringify(error.response?.data, null, 2)}` );
    logger.error( `❌ [CometChat API] fetchMessages - Error stack: ${ error.stack }` );
    throw error;
  }
}

/**
 * Mark a conversation as read
 * @param {string} conversationUrl - The conversation URL
 * @returns {Promise<Object>} API response
 */
async function markConversationAsRead ( conversationUrl ) {
  try {
    const response = await axios.post( conversationUrl, {}, { headers } );
    return response;
  } catch ( error ) {
    throw error;
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
  markConversationAsRead
};
