function normalizeWavezMessage ( packet = {}, config = {} ) {
    const payload = packet.payload || packet;
    const senderId = payload.userId;

    return {
        ...packet,
        id: payload.id,
        roomId: payload.roomId || config.WAVEZFM_ROOM_ID,
        sender: {
            id: senderId,
            nickname: payload.displayUsername || payload.username
        },
        // Only roomRole is a valid permission signal for Wavez; never fall back to role or platformRole
        platformRole: payload.roomRole,
        roomRole: payload.roomRole,
        content: payload.content || '',
        createdAt: payload.timestamp || packet.timestamp,
        visibility: payload.channel === 'private' ? 'private' : 'public',
        recipientId: payload.targetUserId || undefined,
        replyTo: payload.replyTo || undefined,
        mentions: payload.mentionTargets || [],
        isEphemeral: Boolean( payload.ephemeral ),
        raw: process.env.NODE_ENV === 'test' || config.SOCKET_MESSAGE_LOG_LEVEL === 'DEBUG'
            ? packet
            : undefined
    };
}

module.exports = normalizeWavezMessage;