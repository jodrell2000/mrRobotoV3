function normalizeHangMessage ( message = {}, config = {} ) {
    const senderId = message.sender?.uid || message.sender ||
        message.data?.entities?.sender?.entity?.uid ||
        message.data?.metadata?.chatMessage?.userUuid ||
        message.data?.metadata?.message?.customData?.userUuid;
    const content = message.content ?? message.text ?? message.data?.text ?? message.data?.metadata?.chatMessage?.message ?? '';
    const isPrivate = Boolean( message.isPrivateMessage || message.visibility === 'private' );
    const recipientId = message.recipientId || message.recipientUUID;

    return {
        ...message,
        id: message.id,
        roomId: message.roomId || config.HANGOUT_ID,
        sender: {
            id: senderId,
            nickname: message.sender?.nickname || message.senderName
        },
        content,
        createdAt: message.createdAt || message.sentAt || message.updatedAt,
        visibility: isPrivate ? 'private' : 'public',
        recipientId: recipientId || undefined,
        replyTo: message.replyTo,
        mentions: message.mentions || [],
        isEphemeral: Boolean( message.isEphemeral ),
        raw: process.env.NODE_ENV === 'test' || config.SOCKET_MESSAGE_LOG_LEVEL === 'DEBUG'
            ? message
            : undefined
    };
}

module.exports = normalizeHangMessage;
