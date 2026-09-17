const AbstractSiteAdapter = require( './AbstractSiteAdapter' );
const normalizeWavezError = require( '../siteFrameworks/wavezfm/normalizeWavezError.js' );

function unsupported ( action ) {
    throw new Error( `${ action } is not supported by the Wavez.fm adapter` );
}

/**
 * Split a long message into chunks that fit within the character limit
 * Splits intelligently around word boundaries to preserve readability
 * @param {string} content - The message content to split
 * @param {number} maxLength - Maximum characters per chunk (default 255 for Wavez)
 * @returns {string[]} Array of message chunks
 */
function splitMessageIntoChunks ( content, maxLength = 255 ) {
    if ( content.length <= maxLength ) {
        return [ content ];
    }

    const chunks = [];
    let currentChunk = '';

    const words = content.split( ' ' );
    for ( const word of words ) {
        // If adding this word would exceed the limit
        if ( currentChunk.length + word.length + 1 > maxLength ) {
            // If we have content in current chunk, save it
            if ( currentChunk ) {
                chunks.push( currentChunk.trim() );
                currentChunk = '';
            }
            // If the word itself is longer than maxLength, we have to break it
            if ( word.length > maxLength ) {
                // For very long words, split them with a hyphen
                let remaining = word;
                while ( remaining.length > maxLength ) {
                    chunks.push( remaining.substring( 0, maxLength - 1 ) + '-' );
                    remaining = remaining.substring( maxLength - 1 );
                }
                currentChunk = remaining + ' ';
            } else {
                currentChunk = word + ' ';
            }
        } else {
            currentChunk += word + ' ';
        }
    }

    // Add any remaining content
    if ( currentChunk.trim() ) {
        chunks.push( currentChunk.trim() );
    }

    return chunks;
}

/**
 * Log the raw HTTP request details
 * @param {Object} logger - Logger instance
 * @param {string} method - HTTP method (GET, POST, DELETE, etc.)
 * @param {string} endpoint - Full URL endpoint
 * @param {Object} headers - Request headers
 * @param {*} data - Request body/payload
 */
function logRawRequest ( logger, method, endpoint, headers, data ) {
    if ( !logger ) return;

    logger.info( `[WavezFmApiAdapter] RAW HTTP REQUEST` );
    logger.info( `  Method: ${ method }` );
    logger.info( `  Endpoint: ${ endpoint }` );

    if ( headers ) {
        const sanitizedHeaders = {};
        for ( const [ key, value ] of Object.entries( headers ) ) {
            if ( key.toLowerCase().includes( 'token' ) || key.toLowerCase().includes( 'auth' ) ) {
                sanitizedHeaders[ key ] = '[REDACTED - ' + String( value ).length + ' chars]';
            } else {
                sanitizedHeaders[ key ] = value;
            }
        }
        logger.info( `  Headers: ${ JSON.stringify( sanitizedHeaders, null, 2 ) }` );
    }

    if ( data ) {
        logger.info( `  Body: ${ typeof data === 'string' ? data : JSON.stringify( data, null, 2 ) }` );
    }
}

class WavezFmApiAdapter extends AbstractSiteAdapter {
    constructor ( config, dependencies = {} ) {
        super();
        this.config = config;
        this.dependencies = dependencies;
        this.logger = null;
        this.client = null;
    }

    setLogger ( logger ) {
        this.logger = logger;
    }

    async getUserProfile ( userId ) {
        if ( !userId || typeof userId !== 'string' ) {
            throw new Error( 'userId must be a non-empty string' );
        }

        const client = await this.getClient();
        try {
            if ( this.logger ) {
                this.logger.debug( `[WavezFmApiAdapter.getUserProfile] REQUEST: client.user.getById(userId: "${ userId }", { summary: true })` );
            }

            const result = await client.user.getById( userId, { summary: true } );

            if ( this.logger ) {
                this.logger.debug( `[WavezFmApiAdapter.getUserProfile] RESPONSE: ${ JSON.stringify( result, null, 2 ) }` );
            }

            return result;
        } catch ( error ) {
            if ( this.logger ) {
                this.logger.error( `[WavezFmApiAdapter.getUserProfile] API ERROR` );
                this.logger.error( `  Method: client.user.getById` );
                this.logger.error( `  Parameters: userId="${ userId }", { summary: true }` );
                this.logger.error( `  Message: ${ error.message }` );
                this.logger.error( `  Code: ${ error.code }` );
                this.logger.error( `  Status: ${ error.status }` );
                this.logger.error( `  Full Error: ${ JSON.stringify( error, null, 2 ) }` );
            }
            throw normalizeWavezError( error );
        }
    }

    async updateUserNickname () {
        unsupported( 'updateUserNickname' );
    }

    async getChatAuthToken () {
        unsupported( 'getChatAuthToken' );
    }

    async getAllPresentUsers ( services ) {
        if ( this.logger ) {
            this.logger.debug( `[WavezFmApiAdapter.getAllPresentUsers] REQUEST` );
            this.logger.debug( `  Checking stateService.getUsers() first` );
        }

        const normalizedUsers = services?.stateService?.getUsers?.();
        if ( Array.isArray( normalizedUsers ) && normalizedUsers.length > 0 ) {
            const result = normalizedUsers.filter( user => user.isPresent !== false );
            if ( this.logger ) {
                this.logger.debug( `[WavezFmApiAdapter.getAllPresentUsers] Using stateService - found ${ result.length } present users` );
            }
            return result;
        }

        if ( this.logger ) {
            this.logger.debug( `[WavezFmApiAdapter.getAllPresentUsers] Falling back to getRoomState()` );
        }

        const stateResponse = await this.getRoomState();
        const users = stateResponse?.data?.snapshot?.users || stateResponse?.snapshot?.users || [];
        const result = Array.isArray( users ) ? users.filter( user => user.isInRoom !== false ) : [];

        if ( this.logger ) {
            this.logger.debug( `[WavezFmApiAdapter.getAllPresentUsers] Found ${ result.length } present users from room state` );
        }

        return result;
    }

    async sendChatMessage ( content, options = {} ) {
        if ( !content || typeof content !== 'string' ) {
            throw new Error( 'content must be a non-empty string' );
        }

        // Wavez.fm has a 255 character limit per message
        const WAVEZ_MAX_MESSAGE_LENGTH = 255;
        const chunks = splitMessageIntoChunks( content, WAVEZ_MAX_MESSAGE_LENGTH );

        const client = await this.getClient();

        if ( this.logger ) {
            this.logger.info( `[WavezFmApiAdapter.sendChatMessage] SDK CALL` );
            this.logger.info( `  Method: client.roomBot.sendMessage` );
            this.logger.info( `  RoomId: ${ this.config.WAVEZFM_ROOM_ID }` );
            this.logger.info( `  Original Content Length: ${ content.length } characters` );
            this.logger.info( `  Wavez Max Length: ${ WAVEZ_MAX_MESSAGE_LENGTH } characters` );
            if ( chunks.length > 1 ) {
                this.logger.info( `  ⚠️  Message split into ${ chunks.length } chunks` );
                chunks.forEach( ( chunk, idx ) => {
                    this.logger.info( `    Chunk ${ idx + 1 } (${ chunk.length } chars): ${ chunk.substring( 0, 50 ) }${ chunk.length > 50 ? '...' : '' }` );
                } );
            }
        }

        // Send all chunks with a small delay between them to ensure order
        const CHUNK_DELAY_MS = 200; // Small delay to ensure chunks appear in order
        let lastResult = null;

        for ( let i = 0; i < chunks.length; i++ ) {
            const chunk = chunks[ i ];
            const isLastChunk = i === chunks.length - 1;

            // Only add replyTo to the first chunk
            const payload = {
                content: chunk
            };

            if ( i === 0 ) {
                if ( options.replyTo ) payload.replyTo = options.replyTo;
                if ( options.isEphemeral ) payload.ephemeral = true;
                if ( options.targetUserId ) payload.targetUserId = options.targetUserId;
                if ( options.targetUserIds ) payload.targetUserIds = options.targetUserIds;
            }

            if ( this.logger ) {
                if ( chunks.length > 1 ) {
                    this.logger.info( `[WavezFmApiAdapter.sendChatMessage] Sending chunk ${ i + 1 }/${ chunks.length }` );
                }
                this.logger.info( `  Payload: ${ JSON.stringify( payload, null, 2 ) }` );
                this.logger.info( `  Content Length: ${ chunk.length } characters` );

                // Log the expected HTTP request
                const baseURL = this.config.WAVEZFM_API_BASE_URL || 'https://api.wavez.fm';
                const expectedEndpoint = `${ baseURL }/rooms/${ this.config.WAVEZFM_ROOM_ID }/messages`;
                const expectedHeaders = {
                    'Authorization': `Bearer ${ this.config.WAVEZFM_ROOM_BOT_TOKEN ? '[REDACTED - ' + this.config.WAVEZFM_ROOM_BOT_TOKEN.length + ' chars]' : 'NOT SET' }`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                };

                logRawRequest( this.logger, 'POST', expectedEndpoint, expectedHeaders, payload );
            }

            try {
                lastResult = await client.roomBot.sendMessage( this.config.WAVEZFM_ROOM_ID, payload );

                if ( this.logger ) {
                    this.logger.info( `[WavezFmApiAdapter.sendChatMessage] Chunk ${ i + 1 }/${ chunks.length } sent successfully` );
                }

                // Add delay before sending next chunk (except for the last one)
                if ( !isLastChunk && chunks.length > 1 ) {
                    if ( this.logger ) {
                        this.logger.debug( `[WavezFmApiAdapter.sendChatMessage] Waiting ${ CHUNK_DELAY_MS }ms before sending next chunk...` );
                    }
                    await new Promise( resolve => setTimeout( resolve, CHUNK_DELAY_MS ) );
                }
            } catch ( error ) {
                if ( this.logger ) {
                    this.logger.error( `[WavezFmApiAdapter.sendChatMessage] FAILURE on chunk ${ i + 1 }/${ chunks.length }` );
                    this.logger.error( `  Method: client.roomBot.sendMessage` );
                    this.logger.error( `  RoomId: ${ this.config.WAVEZFM_ROOM_ID }` );
                    this.logger.error( `  Payload: ${ JSON.stringify( payload, null, 2 ) }` );
                    this.logger.error( `  Content Length: ${ chunk.length } characters` );
                    this.logger.error( `  Error Message: ${ error.message }` );
                    this.logger.error( `  Error Code: ${ error.code }` );
                    this.logger.error( `  Error Status: ${ error.status }` );
                    this.logger.error( `  Full Error Object: ${ JSON.stringify( error, null, 2 ) }` );

                    // Log details from the HTTP error response
                    if ( error.response ) {
                        this.logger.error( `  HTTP Status: ${ error.response.status }` );
                        this.logger.error( `  HTTP Headers: ${ JSON.stringify( error.response.headers, null, 2 ) }` );
                        this.logger.error( `  HTTP Body: ${ JSON.stringify( error.response.data, null, 2 ) }` );
                    }
                }
                throw normalizeWavezError( error );
            }
        }

        if ( this.logger && chunks.length > 1 ) {
            this.logger.info( `[WavezFmApiAdapter.sendChatMessage] All ${ chunks.length } chunks sent successfully` );
        }

        return lastResult;
    }

    async getRoomState () {
        const client = await this.getClient();
        try {
            if ( this.logger ) {
                this.logger.debug( `[WavezFmApiAdapter.getRoomState] REQUEST` );
                this.logger.debug( `  Method: client.roomBot.getState` );
                this.logger.debug( `  RoomId: ${ this.config.WAVEZFM_ROOM_ID }` );
            }

            const response = await client.roomBot.getState( this.config.WAVEZFM_ROOM_ID );

            if ( this.logger ) {
                this.logger.debug( `[WavezFmApiAdapter.getRoomState] RESPONSE: ${ JSON.stringify( response, null, 2 ) }` );
            }

            const data = response?.data || response;
            const roomSlug = data?.room?.slug || data?.snapshot?.roomSlug;
            if ( roomSlug ) this.config.WAVEZFM_ROOM_SLUG = roomSlug;
            return response;
        } catch ( error ) {
            if ( this.logger ) {
                this.logger.error( `[WavezFmApiAdapter.getRoomState] API ERROR` );
                this.logger.error( `  Method: client.roomBot.getState` );
                this.logger.error( `  RoomId: ${ this.config.WAVEZFM_ROOM_ID }` );
                this.logger.error( `  Message: ${ error.message }` );
                this.logger.error( `  Code: ${ error.code }` );
                this.logger.error( `  Status: ${ error.status }` );
                this.logger.error( `  Full Error: ${ JSON.stringify( error, null, 2 ) }` );
            }
            throw normalizeWavezError( error );
        }
    }

    async getQueueStatus () {
        const client = await this.getClient();
        try {
            if ( this.logger ) {
                this.logger.debug( `[WavezFmApiAdapter.getQueueStatus] REQUEST` );
                this.logger.debug( `  Method: client.roomBot.getQueueStatus` );
                this.logger.debug( `  RoomId: ${ this.config.WAVEZFM_ROOM_ID }` );
            }

            const result = await client.roomBot.getQueueStatus( this.config.WAVEZFM_ROOM_ID );

            if ( this.logger ) {
                this.logger.debug( `[WavezFmApiAdapter.getQueueStatus] RESPONSE: ${ JSON.stringify( result, null, 2 ) }` );
            }

            return result;
        } catch ( error ) {
            if ( this.logger ) {
                this.logger.error( `[WavezFmApiAdapter.getQueueStatus] API ERROR` );
                this.logger.error( `  Method: client.roomBot.getQueueStatus` );
                this.logger.error( `  RoomId: ${ this.config.WAVEZFM_ROOM_ID }` );
                this.logger.error( `  Message: ${ error.message }` );
                this.logger.error( `  Code: ${ error.code }` );
                this.logger.error( `  Status: ${ error.status }` );
                this.logger.error( `  Full Error: ${ JSON.stringify( error, null, 2 ) }` );
            }
            throw normalizeWavezError( error );
        }
    }

    async removeFromQueue ( userId ) {
        if ( !userId || typeof userId !== 'string' ) {
            throw new Error( 'userId must be a non-empty string' );
        }

        const client = await this.getClient();
        try {
            const roomId = this.config.WAVEZFM_ROOM_ID;
            const queueAccessBlocked = true;

            if ( this.logger ) {
                this.logger.info( `[WavezFmApiAdapter.removeFromQueue] SDK CALL` );
                this.logger.info( `  Method: client.roomBot.setQueueAccess` );
                this.logger.info( `  Parameters: roomId="${ roomId }", userId="${ userId }", queueAccessBlocked=${ queueAccessBlocked }` );

                // Log the expected HTTP request that will be generated
                const baseURL = this.config.WAVEZFM_API_BASE_URL || 'https://api.wavez.fm';
                const expectedEndpoint = `${ baseURL }/rooms/${ roomId }/queue/access`;
                const expectedHeaders = {
                    'Authorization': `Bearer ${ this.config.WAVEZFM_ROOM_BOT_TOKEN ? '[REDACTED - ' + this.config.WAVEZFM_ROOM_BOT_TOKEN.length + ' chars]' : 'NOT SET' }`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                };
                const expectedBody = JSON.stringify( { userId, queueAccessBlocked } );

                logRawRequest( this.logger, 'POST', expectedEndpoint, expectedHeaders, expectedBody );
            }

            const result = await client.roomBot.setQueueAccess( roomId, userId, queueAccessBlocked );

            if ( this.logger ) {
                this.logger.info( `[WavezFmApiAdapter.removeFromQueue] SUCCESS - Response: ${ JSON.stringify( result, null, 2 ) }` );
            }

            return result;
        } catch ( error ) {
            if ( this.logger ) {
                this.logger.error( `[WavezFmApiAdapter.removeFromQueue] FAILURE` );
                this.logger.error( `  Method: client.roomBot.setQueueAccess` );
                this.logger.error( `  Parameters: roomId="${ this.config.WAVEZFM_ROOM_ID }", userId="${ userId }", queueAccessBlocked=true` );
                this.logger.error( `  Error Message: ${ error.message }` );
                this.logger.error( `  Error Code: ${ error.code }` );
                this.logger.error( `  Error Status: ${ error.status }` );
                this.logger.error( `  Full Error Object: ${ JSON.stringify( error, null, 2 ) }` );

                // Log details from the HTTP error response
                if ( error.response ) {
                    this.logger.error( `  HTTP Status: ${ error.response.status }` );
                    this.logger.error( `  HTTP Headers: ${ JSON.stringify( error.response.headers, null, 2 ) }` );
                    this.logger.error( `  HTTP Body: ${ JSON.stringify( error.response.data, null, 2 ) }` );
                }
            }
            throw normalizeWavezError( error );
        }
    }

    async getClient () {
        if ( this.client ) return this.client;

        const baseURL = this.config.WAVEZFM_API_BASE_URL || 'https://api.wavez.fm';
        const roomBotToken = this.config.WAVEZFM_ROOM_BOT_TOKEN;

        if ( this.logger ) {
            this.logger.info( `[WavezFmApiAdapter.getClient] INITIALIZING API CLIENT` );
            this.logger.info( `  Base URL: ${ baseURL }` );
            this.logger.info( `  Room Bot Token: ${ roomBotToken ? '[REDACTED - ' + roomBotToken.length + ' chars]' : 'NOT SET' }` );
        }

        const wavezApi = this.dependencies.wavezApi || await import( '@wavezfm/api' );
        this.client = wavezApi.createApiClient( {
            baseURL,
            roomBotToken
        } );

        // Hook into the underlying axios instance if available for raw request logging
        if ( this.client && this.logger ) {
            try {
                // Try to access the underlying axios instance
                const axiosInstance = this.client.axios || this.client.http || this.client.api;

                if ( axiosInstance && axiosInstance.interceptors ) {
                    // Request interceptor - log the RAW request before it's sent
                    axiosInstance.interceptors.request.use?.( ( config ) => {
                        const url = config.url || config.baseURL + config.endpoint || '';
                        const method = ( config.method || 'GET' ).toUpperCase();
                        const headers = config.headers || {};
                        const data = config.data;

                        logRawRequest( this.logger, method, url, headers, data );

                        return config;
                    }, ( error ) => {
                        this.logger.error( `[WavezFmApiAdapter] Request interceptor error: ${ error.message }` );
                        return Promise.reject( error );
                    } );

                    // Response interceptor
                    axiosInstance.interceptors.response.use?.( ( response ) => {
                        this.logger.debug( `[WavezFmApiAdapter] HTTP Response received with status ${ response.status }` );
                        return response;
                    }, ( error ) => {
                        this.logger.error( `[WavezFmApiAdapter] HTTP Response error: Status ${ error.response?.status }, Data: ${ JSON.stringify( error.response?.data ) }` );
                        return Promise.reject( error );
                    } );
                } else if ( this.client.interceptors ) {
                    // Client-level interceptors (if direct support exists)
                    this.client.interceptors.request.use?.( ( config ) => {
                        logRawRequest( this.logger, config.method || 'GET', config.url || '', config.headers, config.data );
                        return config;
                    } );
                }
            } catch ( err ) {
                // Interceptor setup failed, but client is still usable
                this.logger.debug( `[WavezFmApiAdapter.getClient] Could not set up request interceptors: ${ err.message }` );
            }
        }

        return this.client;
    }

    getGatewayBaseUrl () {
        return this.config.WAVEZFM_API_BASE_URL;
    }

    getAuthHeaders () {
        return {
            'X-WavezFM-Bot-Token': this.config.WAVEZFM_ROOM_BOT_TOKEN,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }
}

module.exports = WavezFmApiAdapter;