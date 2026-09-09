class PlatformEventCoordinator {
    constructor ( { framework, dispatcher, services, logger } ) {
        this.framework = framework;
        this.dispatcher = dispatcher;
        this.services = services;
        this.logger = logger;
        this.endedPlaybackIds = new Set();
    }

    _includeRawPayloads () {
        return process.env.NODE_ENV === 'test' || this.services.config.SOCKET_MESSAGE_LOG_LEVEL === 'DEBUG';
    }

    _getEvents ( message, previousState, currentState, options = {} ) {
        const translateEvent = this.framework?.translators?.translateEvent;
        if ( !translateEvent ) return [];

        return translateEvent( message, {
            previousState,
            currentState,
            roomId: currentState?.room?.id || this.services.config.HANGOUT_ID,
            config: this.services.config,
            includeRaw: this._includeRawPayloads(),
            initialState: options.initialState,
            occurredAt: options.occurredAt
        } );
    }

    _deduplicateEvents ( events ) {
        return events.filter( event => {
            if ( event.type !== 'trackEnded' ) return true;
            const playbackId = event.payload?.playId || event.payload?.dedupeKey;
            if ( !playbackId || this.endedPlaybackIds.has( playbackId ) ) return !playbackId;
            this.endedPlaybackIds.add( playbackId );
            return true;
        } );
    }

    async dispatchHangMessage ( message, { previousState, currentState, initialState = false } = {} ) {
        const events = this._deduplicateEvents( this._getEvents( message, previousState, currentState, { initialState } ) );

        for ( const event of events ) {
            await this.dispatcher.dispatch( event, {
                bot: this.services.bot,
                services: this.services
            } );
        }

        if ( message?.name && message.name !== 'roomStateReceived' ) {
            await this._dispatchLegacyHandler( message );
        }

        return events;
    }

    async _dispatchLegacyHandler ( message ) {
        try {
            const handlers = require( '../handlers' );
            const handlerFn = handlers[ message.name ];
            if ( typeof handlerFn === 'function' ) {
                await handlerFn( message, this.services.bot?.state, this.services );
            }
        } catch ( error ) {
            this.logger?.error?.( `Error calling legacy handler for ${ message.name }: ${ error.message }` );
        }
    }

    async dispatchRoomState ( currentState, previousState ) {
        return this.dispatchHangMessage( { name: 'roomStateReceived' }, {
            previousState,
            currentState,
            initialState: true
        } );
    }
}

module.exports = PlatformEventCoordinator;
