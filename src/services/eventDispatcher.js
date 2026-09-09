class EventDispatcher {
    constructor ( logger ) {
        this.logger = logger;
        this.handlers = new Map();
        this.subscribers = new Map();
    }

    registerHandler ( eventType, handler ) {
        if ( this.handlers.has( eventType ) ) {
            throw new Error( `Handler already registered for event: ${ eventType }` );
        }
        this.handlers.set( eventType, handler );
    }

    subscribe ( eventType, subscriber ) {
        if ( !this.subscribers.has( eventType ) ) this.subscribers.set( eventType, new Set() );
        this.subscribers.get( eventType ).add( subscriber );
        return () => this.subscribers.get( eventType )?.delete( subscriber );
    }

    async dispatch ( event, context = {} ) {
        const handler = this.handlers.get( event.type );
        if ( handler ) await handler( event, context );

        const subscribers = this.subscribers.get( event.type ) || [];
        for ( const subscriber of subscribers ) {
            try {
                await subscriber( event, context );
            } catch ( error ) {
                this.logger?.error?.( `Event subscriber failed for ${ event.type }: ${ error.message }` );
            }
        }
    }
}

module.exports = EventDispatcher;
