const { logger } = require( '../lib/logging.js' );

const ACTIVITY_TYPES = {
    CHAT: 'chat',
    EMOJI: 'emoji',
    JOINED_DECKS: 'joinedDecks',
    LEFT_DECKS: 'leftDecks',
    JOINED_ROOM: 'joinedRoom',
    VOTE: 'vote',
    QUEUE: 'queue',
};

class AfkService {
    constructor () {
        this.activityMap = new Map();
        this.exemptedUuids = new Set();
        this.pendingRemovalUuids = new Set();
    }

    addUser ( uuid, nickname ) {
        if ( this.activityMap.has( uuid ) ) {
            this.activityMap.get( uuid ).nickname = nickname;
            return;
        }
        this.activityMap.set( uuid, {
            nickname,
            activity: {
                chat: undefined,
                emoji: undefined,
                joinedDecks: undefined,
                leftDecks: undefined,
                joinedRoom: undefined,
                vote: undefined,
                queue: undefined,
            },
            mostRecent: undefined,
            warningLevel: 0,
        } );
    }

    removeUser ( uuid ) {
        this.activityMap.delete( uuid );
    }

    recordActivity ( uuid, activityType ) {
        const entry = this.activityMap.get( uuid );
        if ( !entry ) return;
        const now = new Date();
        entry.activity[ activityType ] = now;
        entry.mostRecent = now;
        entry.warningLevel = 0;
        this.pendingRemovalUuids.delete( uuid );
        logger.debug( `[afkService] activity recorded: ${ entry.nickname || uuid } (${ uuid }) — ${ activityType } at ${ now.toISOString() }` );
    }

    getInactiveUsers ( thresholdMs ) {
        const now = Date.now();
        const result = [];
        for ( const [ uuid, entry ] of this.activityMap ) {
            if ( !entry.mostRecent ) continue;
            const inactiveMs = now - entry.mostRecent.getTime();
            if ( inactiveMs >= thresholdMs ) {
                result.push( { uuid, nickname: entry.nickname, inactiveMs, warningLevel: entry.warningLevel } );
            }
        }
        return result;
    }

    getActivitySnapshot () {
        const result = [];
        for ( const [ uuid, entry ] of this.activityMap ) {
            result.push( { uuid, ...entry, exempted: this.exemptedUuids.has( uuid ), pendingRemoval: this.pendingRemovalUuids.has( uuid ) } );
        }
        return result;
    }

    setPendingRemoval ( uuid ) {
        this.pendingRemovalUuids.add( uuid );
        logger.debug( `[afkService] DJ marked for pending removal after current song: ${ uuid }` );
    }

    clearPendingRemoval ( uuid ) {
        this.pendingRemovalUuids.delete( uuid );
    }

    getPendingRemovals () {
        return Array.from( this.pendingRemovalUuids );
    }

    clear () {
        this.activityMap.clear();
    }

    setWarningLevel ( uuid, level ) {
        const entry = this.activityMap.get( uuid );
        if ( !entry ) return;
        entry.warningLevel = level;
    }

    setExempt ( uuid ) {
        this.exemptedUuids.add( uuid );
        logger.debug( `[afkService] user exempted from AFK monitor: ${ uuid }` );
    }

    clearExempt ( uuid ) {
        this.exemptedUuids.delete( uuid );
    }

    isExempt ( uuid ) {
        return this.exemptedUuids.has( uuid );
    }

    resetActivity ( uuid ) {
        const entry = this.activityMap.get( uuid );
        if ( !entry ) return;
        const now = new Date();
        entry.mostRecent = now;
        entry.warningLevel = 0;
        this.clearExempt( uuid );
        logger.debug( `[afkService] activity reset: ${ entry.nickname || uuid } (${ uuid }) at ${ now.toISOString() }` );
    }
}

AfkService.ACTIVITY_TYPES = ACTIVITY_TYPES;

module.exports = AfkService;
