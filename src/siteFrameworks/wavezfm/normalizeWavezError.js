function normalizeWavezError ( error ) {
    const status = error?.status || error?.response?.status;
    const code = error?.code || error?.details?.code || error?.response?.data?.code;
    const message = error?.message || String( error );
    const lowerMessage = message.toLowerCase();
    const nonRetryableCodes = [
        'ROOM_BOT_SCOPE_MISMATCH',
        'ROOM_BOT_PERMISSION_DENIED',
        'ROOM_BOT_FORBIDDEN',
        'ROOM_BOT_TOKEN_REQUIRED',
        'ROOM_BOT_INVALID'
    ];
    const retryable = status === 408 || status === 429 || status >= 500 ||
        lowerMessage.includes( 'timeout' ) || lowerMessage.includes( 'disconnected' );
    const normalized = new Error( message );

    normalized.code = code || ( status === 429 ? 'RATE_LIMITED' : 'WAVEZ_REQUEST_FAILED' );
    normalized.status = status;
    normalized.retryable = nonRetryableCodes.includes( normalized.code ) ? false : retryable;
    return normalized;
}

module.exports = normalizeWavezError;