const AbstractSiteAdapter = require( './AbstractSiteAdapter' );
const normalizeWavezError = require( '../siteFrameworks/wavezfm/normalizeWavezError.js' );

function unsupported ( action ) {
    throw new Error( `${ action } is not supported by the Wavez.fm adapter` );
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
            return await client.user.getById( userId, { summary: true } );
        } catch ( error ) {
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
        const normalizedUsers = services?.stateService?.getUsers?.();
        if ( Array.isArray( normalizedUsers ) && normalizedUsers.length > 0 ) {
            return normalizedUsers.filter( user => user.isPresent !== false );
        }

        const stateResponse = await this.getRoomState();
        const users = stateResponse?.data?.snapshot?.users || stateResponse?.snapshot?.users || [];
        return Array.isArray( users ) ? users.filter( user => user.isInRoom !== false ) : [];
    }

    async sendChatMessage ( content, options = {} ) {
        if ( !content || typeof content !== 'string' ) {
            throw new Error( 'content must be a non-empty string' );
        }

        const client = await this.getClient();
        const payload = {
            content
        };

        if ( options.replyTo ) payload.replyTo = options.replyTo;
        if ( options.isEphemeral ) payload.ephemeral = true;
        if ( options.targetUserId ) payload.targetUserId = options.targetUserId;
        if ( options.targetUserIds ) payload.targetUserIds = options.targetUserIds;

        if ( this.logger ) this.logger.debug( 'Sending Wavez public chat message' );

        try {
            return await client.roomBot.sendMessage( this.config.WAVEZFM_ROOM_ID, payload );
        } catch ( error ) {
            throw normalizeWavezError( error );
        }
    }

    async getRoomState () {
        const client = await this.getClient();
        try {
            const response = await client.roomBot.getState( this.config.WAVEZFM_ROOM_ID );
            const data = response?.data || response;
            const roomSlug = data?.room?.slug || data?.snapshot?.roomSlug;
            if ( roomSlug ) this.config.WAVEZFM_ROOM_SLUG = roomSlug;
            return response;
        } catch ( error ) {
            throw normalizeWavezError( error );
        }
    }

    async getQueueStatus () {
        const client = await this.getClient();
        try {
            return await client.roomBot.getQueueStatus( this.config.WAVEZFM_ROOM_ID );
        } catch ( error ) {
            throw normalizeWavezError( error );
        }
    }

    async getClient () {
        if ( this.client ) return this.client;

        const wavezApi = this.dependencies.wavezApi || await import( '@wavezfm/api' );
        this.client = wavezApi.createApiClient( {
            baseURL: this.config.WAVEZFM_API_BASE_URL || 'https://api.wavez.fm',
            roomBotToken: this.config.WAVEZFM_ROOM_BOT_TOKEN
        } );

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