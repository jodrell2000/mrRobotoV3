const axios = require( 'axios' );
const config = require( '../config.js' );
const { buildUrl, makeRequest } = require( '../lib/buildUrl' );

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

    const requestData = {
      participants: [ config.BOT_UID ]
    };

    const response = await makeRequest( url, {
      headers,
      method: 'POST',
      data: requestData
    } );

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
    // Handle both object and array formats for params
    let queryParams;
    if ( Array.isArray( params ) ) {
      queryParams = params;
    } else {
      queryParams = Object.entries( params );
    }

    const url = buildUrl( BASE_URL, [ endpoint ], queryParams );

    // Debug logging for request details
    console.log( `[CometChat API] fetchMessages - Endpoint: ${ endpoint }` );
    console.log( `[CometChat API] fetchMessages - Raw params:`, params );
    console.log( `[CometChat API] fetchMessages - Query params:`, queryParams );
    console.log( `[CometChat API] fetchMessages - Final URL: ${ url }` );

    const response = await apiClient.get( url );

    // Debug logging for response details
    console.log( `[CometChat API] fetchMessages - Response status: ${ response.status }` );
    console.log( `[CometChat API] fetchMessages - Response data count: ${ response.data?.data?.length || 0 }` );

    if ( response.data?.data?.length > 0 ) {
      const messages = response.data.data;
      console.log( `[CometChat API] fetchMessages - First message ID: ${ messages[ 0 ]?.id }` );
      console.log( `[CometChat API] fetchMessages - Last message ID: ${ messages[ messages.length - 1 ]?.id }` );
      console.log( `[CometChat API] fetchMessages - Message IDs: ${ messages.map( m => m.id ).join( ', ' ) }` );
    } else {
      console.log( `[CometChat API] fetchMessages - No messages returned` );
    }

    return response;
  } catch ( error ) {
    console.error( `[CometChat API] fetchMessages - Error: ${ error.message }` );
    console.error( `[CometChat API] fetchMessages - Error details:`, error.response?.data || error );
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
  sendMessage,
  joinChatGroup,
  fetchMessages,
  markConversationAsRead
};
