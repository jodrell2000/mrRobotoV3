class HangFmMessagingAdapter {
    constructor ( { messageService, privateMessageService, openchatApi } ) {
        this.messageService = messageService;
        this.privateMessageService = privateMessageService;
        this.openchatApi = openchatApi;
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
