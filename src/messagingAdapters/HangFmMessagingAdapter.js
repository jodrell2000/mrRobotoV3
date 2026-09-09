class HangFmMessagingAdapter {
    constructor ( { messageService, privateMessageService, openchatApi } ) {
        this.messageService = messageService;
        this.privateMessageService = privateMessageService;
        this.openchatApi = openchatApi;

        this.setAuthToken = this.setAuthToken.bind( this );
        this.hasAuthToken = this.hasAuthToken.bind( this );
        this.joinRoom = this.joinRoom.bind( this );
        this.leaveRoom = this.leaveRoom.bind( this );
        this.sendChatMessage = this.sendChatMessage.bind( this );
        this.sendPrivateMessage = this.sendPrivateMessage.bind( this );
        this.fetchChatMessages = this.fetchChatMessages.bind( this );
        this.fetchPrivateMessages = this.fetchPrivateMessages.bind( this );
    }

    setAuthToken ( token ) {
        return this.openchatApi.setAuthToken( token );
    }

    hasAuthToken () {
        return this.openchatApi.hasAuthToken();
    }

    joinRoom ( roomId ) {
        return this.messageService.joinChat( roomId );
    }

    leaveRoom ( roomId ) {
        return this.messageService.leaveChat( roomId );
    }

    sendChatMessage ( content, options = {} ) {
        return this.messageService.sendGroupMessage( content, options );
    }

    sendPrivateMessage ( content, recipientId, services ) {
        return this.privateMessageService.sendPrivateMessage( content, recipientId, services );
    }

    fetchChatMessages ( roomId, options ) {
        return this.messageService.fetchGroupMessages( roomId, options );
    }

    fetchPrivateMessages ( userId, options ) {
        return this.privateMessageService.fetchNewPrivateUserMessages( userId, options );
    }
}

module.exports = HangFmMessagingAdapter;
