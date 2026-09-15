function unsupported ( action ) {
    throw new Error( `${ action } is not supported by the Wavez.fm adapter` );
}

class WavezFmMessagingAdapter {
    constructor ( { apiAdapter, config } = {} ) {
        this.apiAdapter = apiAdapter;
        this.config = config;

        this.setAuthToken = this.setAuthToken.bind( this );
        this.hasAuthToken = this.hasAuthToken.bind( this );
        this.joinRoom = this.joinRoom.bind( this );
        this.leaveRoom = this.leaveRoom.bind( this );
        this.sendChatMessage = this.sendChatMessage.bind( this );
        this.sendPrivateMessage = this.sendPrivateMessage.bind( this );
        this.fetchChatMessages = this.fetchChatMessages.bind( this );
        this.fetchPrivateMessages = this.fetchPrivateMessages.bind( this );
    }

    setAuthToken () {
        return undefined;
    }

    hasAuthToken () {
        return true;
    }

    async joinRoom () {
        return { success: true, supported: true };
    }

    async leaveRoom () {
        return { success: true, supported: true };
    }

    async sendChatMessage ( content, options = {} ) {
        if ( !this.apiAdapter || typeof this.apiAdapter.sendChatMessage !== 'function' ) {
            unsupported( 'sendChatMessage' );
        }

        return await this.apiAdapter.sendChatMessage( content, {
            ...options,
            roomId: options.roomId || this.config?.WAVEZFM_ROOM_ID
        } );
    }

    async sendPrivateMessage () {
        unsupported( 'sendPrivateMessage' );
    }

    async fetchChatMessages () {
        return [];
    }

    async fetchPrivateMessages () {
        return [];
    }
}

module.exports = WavezFmMessagingAdapter;