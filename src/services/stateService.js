/**
 * Service to access hangout state information
 */
class StateService {
    constructor ( hangoutState, services, normalizedState ) {
        // Store both the initial state and services reference
        this.hangoutState = hangoutState;
        this.services = services;
        this.normalizedState = normalizedState;
        this.profileCache = normalizedState?.usersById || {};
    }

    setNormalizedState ( normalizedState ) {
        this.normalizedState = normalizedState;
        if ( normalizedState?.usersById ) {
            const previousCache = this.profileCache;
            this.profileCache = Object.fromEntries( Object.entries( normalizedState.usersById ).map( ( [ userId, user ] ) => [
                userId,
                {
                    ...user,
                    profile: user.profile || previousCache[ userId ]?.profile,
                    profileStale: previousCache[ userId ]?.profileStale || false,
                    profileFetchedAt: previousCache[ userId ]?.profileFetchedAt
                }
            ] ) );
        }
    }

    setPlatformState ( platformState, normalizeState, config ) {
        this.hangoutState = platformState;
        this.services.hangoutState = platformState;
        if ( normalizeState ) {
            this.setNormalizedState( normalizeState( platformState, config ) );
        }
        return this.normalizedState;
    }

    getState () {
        return this.normalizedState || this._getCurrentState();
    }

    getRoom () {
        return this.getState()?.room || {};
    }

    getUsers () {
        if ( this.normalizedState?.usersById ) {
            return Object.values( this.normalizedState.usersById );
        }
        return this._getAllUsers();
    }

    getUser ( userId ) {
        if ( this.normalizedState?.usersById ) {
            return this.normalizedState.usersById[ userId ];
        }
        return this._getAllUsers().find( user => user.uuid === userId );
    }

    getDjQueue () {
        if ( this.normalizedState ) return this.normalizedState.djQueue || [];
        return this._getDjs();
    }

    getCurrentDj () {
        return this.getDjQueue()[ 0 ];
    }

    getDjQueueEntry ( userId ) {
        return this.getDjQueue().find( entry => entry.userId === userId || entry.uuid === userId );
    }

    getNowPlaying () {
        if ( this.normalizedState ) return this.normalizedState.nowPlaying;
        return this._getNowPlaying();
    }

    getVotes () {
        if ( this.normalizedState ) return this.normalizedState.votes || { likes: 0, dislikes: 0, grabs: 0 };
        const votes = this.getVoteCounts();
        return { likes: votes.likes || 0, dislikes: votes.dislikes || 0, grabs: votes.grabs ?? votes.stars ?? 0 };
    }

    getRoomSettings () {
        if ( this.normalizedState ) return this.normalizedState.roomSettings || {};
        return this._getSettings();
    }

    async getUserProfile ( userId, { refresh = false } = {} ) {
        const cachedUser = this.profileCache[ userId ];
        const cachedProfile = cachedUser?.profile;
        if ( cachedProfile && !refresh && !cachedUser.profileStale ) return cachedProfile;

        if ( !this.services?.apiAdapter?.getUserProfile ) {
            return cachedProfile;
        }

        try {
            const profile = await this.services.apiAdapter.getUserProfile( userId );
            const normalizedProfile = profile?.userProfile || profile?.data || profile;
            this.profileCache[ userId ] = {
                ...( this.profileCache[ userId ] || { id: userId, nickname: userId, platformRole: 'user', isPresent: true } ),
                profile: normalizedProfile,
                nickname: normalizedProfile?.nickname || cachedUser?.nickname || userId,
                profileStale: false,
                profileFetchedAt: new Date().toISOString()
            };
            return normalizedProfile;
        } catch ( error ) {
            if ( cachedUser ) cachedUser.profileStale = true;
            this.services?.logger?.warn?.( `Profile refresh failed for ${ userId }: ${ error.message }` );
            return cachedProfile;
        }
    }

    /**
     * Get the current hangout state (prefer services reference if available)
     * @returns {Object} Current hangout state
     * @private
     */
    _getCurrentState () {
        // Use services.hangoutState if available (for live updates), 
        // otherwise fall back to constructor hangoutState
        return ( this.services?.hangoutState ) || this.hangoutState;
    }

    /**
     * Returns current vote counts
     * @returns {Object} Object containing likes, dislikes, and stars counts
     */
    getVoteCounts () {
        if ( this.normalizedState ) {
            const votes = this.normalizedState.votes || {};
            return { likes: votes.likes || 0, dislikes: votes.dislikes || 0, stars: votes.grabs || 0 };
        }
        const state = this._getCurrentState();
        return state.voteCounts || { likes: 0, dislikes: 0, stars: 0 };
    }

    /**
     * Returns the role of a specific user
     * @param {string} uuid - The UUID of the user to get the role for
     * @returns {string} One of "owner", "moderator", "coOwner", or "user"
     * @throws {Error} If the user is not found in the room
     */
    getUserRole ( uuid ) {
        if ( this.normalizedState ) {
            const user = this.getUser( uuid );
            if ( !user ) throw new Error( `User with ID ${ uuid } not found in the room` );
            return user.platformRole || 'user';
        }
        const allUsers = this._getAllUsers();
        const user = allUsers.find( u => u.uuid === uuid );
        if ( !user ) {
            throw new Error( `User with UUID ${ uuid } not found in the room` );
        }
        return user.highestRole || "user";
    }

    /**
     * Returns the name of the hangout
     * @returns {string} The name of the hangout, or 'Our Hangout' if not set
     */
    getHangoutName () {
        if ( this.normalizedState ) {
            return this.normalizedState.room?.name || 'our Hangout';
        }
        const state = this._getCurrentState();
        const settings = state.settings || {};
        return settings.name || 'our Hangout';
    }

    /**
     * Returns information about all users in the room
     * @returns {Array} Array of user objects with uuid, tokenRole, canDj, and highestRole
     * @private
     */
    _getAllUsers () {
        const state = this._getCurrentState();
        return state.allUsers || [];
    }

    /**
     * Returns information about current DJs
     * @returns {Array} Array of DJ objects
     * @private
     */
    _getDjs () {
        const state = this._getCurrentState();
        return state.djs || [];
    }

    /**
     * Returns information about the currently playing song
     * @returns {Object} Object containing song details and timing information
     * @private
     */
    _getNowPlaying () {
        const state = this._getCurrentState();
        return state.nowPlaying || null;
    }

    /**
     * Returns room settings
     * @returns {Object} Room settings including name, description, rules, etc.
     * @private
     */
    _getSettings () {
        if ( this.normalizedState ) return this.normalizedState.roomSettings || {};
        const state = this._getCurrentState();
        return state.settings || {};
    }

    /**
     * Returns the current vibe meter value
     * @returns {number} Current vibe meter value
     * @private
     */
    _getVibeMeter () {
        const state = this._getCurrentState();
        return state.vibeMeter || 0;
    }

    /**
     * Returns all user data including profiles and positions
     * @returns {Object} Object containing detailed user data
     * @private
     */
    _getAllUserData () {
        const state = this._getCurrentState();
        return state.allUserData || {};
    }
}

module.exports = StateService;
