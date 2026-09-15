function normalizeWavezOutgoingMessage ( content, options = {} ) {
    return {
        content,
        roomId: options.roomId,
        visibility: options.recipientId ? 'private' : 'public',
        recipientId: options.recipientId,
        replyTo: options.replyTo,
        isEphemeral: Boolean( options.isEphemeral )
    };
}

module.exports = normalizeWavezOutgoingMessage;