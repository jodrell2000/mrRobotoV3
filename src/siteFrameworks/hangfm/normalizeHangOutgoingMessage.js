function normalizeHangOutgoingMessage ( message, options = {} ) {
    const isPrivate = options.visibility === 'private' || Boolean( options.recipientId );

    return {
        id: options.id,
        roomId: options.roomId,
        sender: {
            id: options.senderId,
            nickname: options.senderName
        },
        content: message,
        createdAt: options.createdAt,
        visibility: isPrivate ? 'private' : 'public',
        recipientId: isPrivate ? options.recipientId : undefined,
        replyTo: options.replyTo,
        mentions: options.mentions || [],
        isEphemeral: Boolean( options.isEphemeral )
    };
}

module.exports = normalizeHangOutgoingMessage;
