const { ServerMessageName, SocketClient, StatefulServerMessageName, StatelessServerMessageName } = require( 'ttfm-socket' );
const { applyPatch } = require( 'fast-json-patch' );
const fs = require( 'fs' ).promises;
const path = require( 'path' );

class Bot {
  constructor ( slug, services ) {
    this.services = services;
    this.lastMessageIDs = {}
    this.lastPrivateMessageTracking = {}; // Enhanced tracking: { userId: { lastMessageId, lastTimestamp } }
    this.socketLogCounter = 0; // Counter for debug mode logging
    this.deferredPatches = []; // Store patches that arrive before state is available
    this.isProcessingPublicMessages = false; // Flag to prevent concurrent public message processing
    this.isProcessingPrivateMessages = false; // Flag to prevent concurrent private message processing
    // Dynamic backoff state for public messages
    this.publicMessageInterval = 1000; // Start at 1 second
    this.publicMessageBackoffStep = 1000; // Increase by 1 second each timeout
    this.publicMessageMaxInterval = 10000; // Max 10 seconds

    // Per-user backoff state for private messages (parallel fetching)
    // Structure: { [userUUID]: { interval: 1000, backoffStep: 1000, maxInterval: 10000 } }
    this.privateMessageUserIntervals = {};

    // Initialize global state for playedSong handler
    if ( !global.previousPlayedSong ) global.previousPlayedSong = null;
    if ( !global.playedSongTimer ) global.playedSongTimer = null;
  }

  // ========================================================
  // Socket Message File Logging Helper
  // ========================================================

  async _writeSocketMessagesToLogFile ( filename, data ) {
    const logLevel = this.services.config.SOCKET_MESSAGE_LOG_LEVEL;

    // If logging is OFF, don't log anything
    if ( logLevel === 'OFF' ) {
      return;
    }

    try {
      const logsDir = path.join( process.cwd(), 'logs' );
      let filePath;

      if ( logLevel === 'DEBUG' ) {
        // In DEBUG mode, each message gets its own numbered file with message name
        this.socketLogCounter++;
        const baseFilename = filename.replace( '.log', '' );
        const paddedCounter = String( this.socketLogCounter ).padStart( 6, '0' );

        // Extract message name from data
        let messageName = '';
        if ( data && typeof data === 'object' ) {
          // For different message types, the name might be in different places
          messageName = data.name || ( data.message && data.message.name ) || '';
        }

        let debugFilename;
        if ( messageName ) {
          debugFilename = `${ paddedCounter }_${ baseFilename }_${ messageName }.log`;
        } else {
          debugFilename = `${ paddedCounter }_${ baseFilename }.log`;
        }

        filePath = path.join( logsDir, debugFilename );
      } else {
        // In ON mode, use the original filename
        filePath = path.join( logsDir, filename );
      }

      const timestamp = new Date().toISOString();
      const logEntry = `${ timestamp }: ${ JSON.stringify( data, null, 2 ) }\n`;

      await fs.appendFile( filePath, logEntry );
    } catch ( error ) {
      this.services.logger.error( `Failed to write to log file ${ filename }: ${ error.message }` );
    }
  }

  // ========================================================
  // Main Connection Flow
  // ========================================================

  async connect () {
    // Data is already loaded and available in serviceContainer as services.data
    this.services.logger.debug( 'Using data loaded in serviceContainer' );

    // Create hangout URL and store in config for use by services like VerificationService
    this._createHangoutUrl();

    // First create the socket connection
    await this._createSocketConnection();

    // CRITICAL: Add a small delay to ensure socket is fully initialized
    this.services.logger.debug( 'Allowing socket initialization to complete...' );
    await new Promise( resolve => setTimeout( resolve, 250 ) );

    this.services.logger.debug( 'Setting up listeners...' );
    this._setupErrorListener();
    this._setupStatefulMessageListener();
    this._setupStatelessMessageListener();
    this._setupServerMessageListener();

    // CRITICAL: Add another delay to ensure all listeners are registered
    this.services.logger.debug( 'Ensuring all listeners are registered...' );
    await new Promise( resolve => setTimeout( resolve, 250 ) );

    // Join room and wait for initial state to be available
    await this._joinSocketRoom();

    // Join CometChat after socket connection is established
    await this._joinCometChat();

    // Initialize lastMessageIDs from service container state AFTER connections are established
    await this._initializeMessageTracking();

    // Finally set up reconnect handler
    this._setupReconnectHandler();
  }

  // ========================================================
  // Hangout URL Creation
  // ========================================================

  _createHangoutUrl () {
    try {
      const { HANGOUT_ID, HANGOUT_SLUG, HANGOUT_LANGUAGE } = this.services.config;
      
      if ( !HANGOUT_ID ) {
        this.services.logger.warn( '⚠️ [Bot] HANGOUT_ID not configured' );
        return;
      }

      let hangoutUrl;
      if ( HANGOUT_SLUG && HANGOUT_LANGUAGE ) {
        // Use full hang.fm URL format with slug and language
        hangoutUrl = `https://hang.fm/${ HANGOUT_LANGUAGE }/${ HANGOUT_SLUG }`;
      } else if ( HANGOUT_SLUG ) {
        // Use URL without language code
        hangoutUrl = `https://hang.fm/${ HANGOUT_SLUG }`;
      } else {
        // Fallback to using just the hangout ID
        hangoutUrl = `https://hang.fm/hangouts/${ HANGOUT_ID }`;
      }

      // Store in config for use by other services
      this.services.config.HANGOUT_URL = hangoutUrl;
      this.services.logger.info( `✅ [Bot] Hangout URL: ${ hangoutUrl }` );
    } catch ( error ) {
      this.services.logger.error( `❌ [Bot] Error creating hangout URL: ${ error.message }` );
    }
  }

  // ========================================================
  // Deferred Patch Handling
  // ========================================================

  async _applyDeferredPatches () {
    if ( this.deferredPatches.length === 0 ) {
      return;
    }

    // this.services.logger.debug( `Applying ${ this.deferredPatches.length } deferred patches...` );

    for ( const deferredPatch of this.deferredPatches ) {
      try {
        await this._applyStatePatch( deferredPatch.message, deferredPatch.statePatch );
      } catch ( error ) {
        this.services.logger.error( `Failed to apply deferred patch for ${ deferredPatch.message.name }: ${ error.message }` );
      }
    }

    // Clear deferred patches after applying
    this.deferredPatches = [];
    // this.services.logger.debug( 'All deferred patches applied and cleared' );
  }

  async _applyStatePatch ( message, statePatch ) {
    // Validate that we have state before applying patches
    if ( !this.state ) {
      throw new Error( 'Cannot apply patch - state not available' );
    }

    const validOperations = statePatch.filter( operation => {
      try {
        // For remove operations, check if the path exists
        if ( operation.op === 'remove' ) {
          const pathParts = operation.path.split( '/' ).slice( 1 ); // Remove empty first element
          let current = this.state;

          // Traverse the path to see if it exists
          for ( const part of pathParts ) {
            if ( current && typeof current === 'object' && part in current ) {
              current = current[ part ];
            } else {
              // this.services.logger.debug( `Skipping remove operation - path does not exist: ${ operation.path }` );
              return false; // Skip this operation
            }
          }
        }
        return true; // Operation is valid
      } catch ( validateError ) {
        // this.services.logger.debug( `Skipping invalid operation: ${ JSON.stringify( operation ) } - ${ validateError.message }` );
        return false;
      }
    } );

    // Only apply if we have valid operations
    if ( validOperations.length > 0 ) {
      const patchResult = applyPatch(
        this.state,
        validOperations,
        true,  // validate operation
        false  // mutate document
      );

      // Update the bot's state with the patched state
      this.state = patchResult.newDocument;
      this.services.hangoutState = patchResult.newDocument;

      // this.services.logger.debug( `State updated via patch for message: ${ message.name }` );
      // this.services.logger.debug( `Applied ${ validOperations.length } patch operations` );

      if ( validOperations.length < statePatch.length ) {
        // this.services.logger.debug( `Skipped ${ statePatch.length - validOperations.length } invalid operations` );
      }
    } else {
      // this.services.logger.debug( `No valid operations to apply for message: ${ message.name }` );
    }
  }

  // ========================================================
  // Connection Helper Functions
  // ========================================================

  async _initializeStateServiceSafely () {
    // Validate that state is properly set up before initializing StateService
    if ( !this.services.hangoutState ) {
      throw new Error( 'hangoutState is not set - state initialization failed' );
    }

    // Additional validation to ensure state contains expected structure
    const stateKeys = Object.keys( this.services.hangoutState );
    this.services.logger.debug( `State keys available: ${ stateKeys.join( ', ' ) }` );

    if ( stateKeys.length === 0 ) {
      throw new Error( 'hangoutState is empty - no state data received from socket' );
    }

    // Log state structure for debugging
    this.services.logger.debug( `State structure: allUserData=${ !!this.services.hangoutState.allUserData }, allUsers=${ !!this.services.hangoutState.allUsers }` );

    // Now initialize the state service
    await this.services.initializeStateService();
    this.services.logger.debug( 'StateService initialized successfully with validated state' );
  }

  _seedAfkServiceFromState () {
    if ( !this.services.afkService || !this.services.stateService ) return;

    const allUserData = this.services.hangoutState?.allUserData || {};
    const djUuids = new Set( ( this.services.stateService._getDjs() || [] ).map( d => d.uuid ) );

    for ( const [ uuid, userData ] of Object.entries( allUserData ) ) {
      const nickname = userData?.userProfile?.nickname || uuid;
      this.services.afkService.addUser( uuid, nickname );
      if ( djUuids.has( uuid ) ) {
        this.services.afkService.recordActivity( uuid, 'joinedDecks' );
      } else {
        this.services.afkService.recordActivity( uuid, 'joinedRoom' );
      }
    }

    this.services.logger.debug(
      `Seeded afkService with ${ Object.keys( allUserData ).length } users (${ djUuids.size } DJs) from initial state`
    );
  }

  async _initializeMessageTracking () {
    // Initialize lastMessageIDs from service container state
    const lastMessageId = this.services.getState( 'lastMessageId' );
    const lastMessageTimestamp = this.services.getState( 'lastMessageTimestamp' );

    if ( lastMessageId ) {
      this.lastMessageIDs.id = lastMessageId;
      this.lastMessageIDs.fromTimestamp = lastMessageTimestamp;
      this.services.logger.debug( `Initialized message tracking with ID: ${ lastMessageId }, timestamp: ${ lastMessageTimestamp }` );
    } else {
      this.services.logger.debug( 'No previous message ID found, will fetch from latest messages' );

      // Try to get the latest message ID to establish a baseline using the correct API function
      try {
        const latestMessageId = await this.services.messageService.returnLatestGroupMessageId();
        if ( latestMessageId ) {
          this.lastMessageIDs.id = latestMessageId;
          // Don't set fromTimestamp on initial fetch - let it be undefined so we get latest batch as baseline
          this.services.updateLastMessageId( latestMessageId, undefined );
          this.services.logger.debug( `Initialized tracking with latest message ID: ${ latestMessageId }` );
        } else {
          this.services.logger.debug( 'No messages found to establish baseline, starting fresh' );
        }
      } catch ( error ) {
        this.services.logger.warn( `Could not fetch latest message ID: ${ error.message }` );
      }
    }

    // Initialize private message tracking per user
    this.lastPrivateMessageTracking = this.services.getState( 'lastPrivateMessageTracking' ) || {};

    // Normalize any existing timestamps that might be in inconsistent format
    for ( const [ userUUID, tracking ] of Object.entries( this.lastPrivateMessageTracking ) ) {
      if ( tracking && tracking.lastTimestamp ) {
        const normalizedTimestamp = this._normalizeTimestamp( tracking.lastTimestamp );
        if ( normalizedTimestamp !== tracking.lastTimestamp ) {
          this.services.logger.debug( `🔧 [Bot] Normalizing timestamp for user ${ userUUID }: ${ tracking.lastTimestamp } -> ${ normalizedTimestamp }` );
          tracking.lastTimestamp = normalizedTimestamp;
        }
      }
    }

    // Debug: Show what was loaded from persistence
    const persistedUserCount = Object.keys( this.lastPrivateMessageTracking ).length;
    this.services.logger.debug( `🔄 [Bot] Loaded private message tracking state from persistence: ${ persistedUserCount } users tracked` );
    // if ( persistedUserCount > 0 ) {
    //   for ( const [userUUID, tracking] of Object.entries( this.lastPrivateMessageTracking ) ) {
    //     this.services.logger.debug( `   👤 ${userUUID}: LastMsgID=${tracking.lastMessageId}, LastTimestamp=${tracking.lastTimestamp}` );
    //   }
    // } else {
    //   this.services.logger.debug( `   📝 No previous tracking state found - starting fresh` );
    // }

    // Initialize enhanced private message tracking for all current users in the hangout
    await this._initializePrivateMessageTrackingForAllUsers();
  }

  async _initializePrivateMessageTrackingForAllUsers () {
    try {
      // Get all users currently in the hangout
      const allUsers = this.services.stateService._getAllUsers();
      this.services.logger.debug( `Initializing private message tracking for ${ allUsers.length } users in hangout` );

      for ( const user of allUsers ) {
        const userUUID = user.uuid;

        // Skip bot's own messages
        if ( userUUID === this.services.config.BOT_UID ) {
          continue;
        }

        // Only initialize if we don't already have tracking for this user
        if ( !this.lastPrivateMessageTracking[ userUUID ] ) {
          try {
            const lastMessageId = await this.services.privateMessageService.returnLastUserMessage( userUUID );
            if ( lastMessageId ) {
              this.lastPrivateMessageTracking[ userUUID ] = {
                lastMessageId: lastMessageId,
                lastTimestamp: Math.floor( Date.now() / 1000 ) // Current timestamp in seconds as fallback
              };
              this.services.logger.debug( `Initialized private message tracking for user ${ userUUID }: ${ lastMessageId }` );
            } else {
              // Set to null to indicate we've checked but found no messages
              this.lastPrivateMessageTracking[ userUUID ] = {
                lastMessageId: null,
                lastTimestamp: null
              };
              this.services.logger.debug( `No previous private messages found for user ${ userUUID }` );
            }
          } catch ( error ) {
            this.services.logger.warn( `Failed to initialize private message tracking for user ${ userUUID }: ${ error.message }` );
            // Set to null to indicate initialization was attempted
            this.lastPrivateMessageTracking[ userUUID ] = {
              lastMessageId: null,
              lastTimestamp: null
            };
          }
        } else {
          this.services.logger.debug( `Private message tracking already exists for user ${ userUUID }: ${ JSON.stringify( this.lastPrivateMessageTracking[ userUUID ] ) }` );
        }
      }

      // Persist the updated tracking state
      this.services.setState( 'lastPrivateMessageTracking', this.lastPrivateMessageTracking );
      this.services.logger.debug( `Private message tracking initialized for ${ Object.keys( this.lastPrivateMessageTracking ).length } users` );

    } catch ( error ) {
      this.services.logger.error( `Error initializing private message tracking for all users: ${ error.message }` );
    }
  }

  async _initializePrivateMessageTrackingForUser ( userUUID, setTimestampToNow = false ) {
    try {
      // Skip bot's own messages
      if ( userUUID === this.services.config.BOT_UID ) {
        return;
      }

      // Only initialize if we don't already have tracking for this user
      if ( !this.lastPrivateMessageTracking[ userUUID ] ) {
        try {
          if ( setTimestampToNow ) {
            // For new users joining the room, set timestamp to now to avoid processing old messages
            const currentTimestamp = Math.floor( Date.now() / 1000 );
            this.lastPrivateMessageTracking[ userUUID ] = {
              lastMessageId: null,
              lastTimestamp: currentTimestamp
            };
            this.services.logger.debug( `Set private message tracking for new user ${ userUUID } to current time: ${ currentTimestamp }` );
          } else {
            // Original behavior: fetch last message from history
            const messageTracking = await this.services.privateMessageService.returnLastUserMessageTracking( userUUID );
            if ( messageTracking ) {
              const normalizedTimestamp = this._normalizeTimestamp( messageTracking.lastTimestamp );
              this.lastPrivateMessageTracking[ userUUID ] = {
                lastMessageId: messageTracking.lastMessageId,
                lastTimestamp: normalizedTimestamp
              };
              if ( normalizedTimestamp !== messageTracking.lastTimestamp ) {
                this.services.logger.debug( `🔧 [_initializePrivateMessageTrackingForUser] Normalized timestamp for user ${ userUUID }: ${ messageTracking.lastTimestamp } -> ${ normalizedTimestamp }` );
              }
              this.services.logger.debug( `Initialized private message tracking for user ${ userUUID }: { lastMessageId: ${ messageTracking.lastMessageId }, lastTimestamp: ${ normalizedTimestamp } }` );
            } else {
              // Set to null to indicate we've checked but found no messages
              this.lastPrivateMessageTracking[ userUUID ] = {
                lastMessageId: null,
                lastTimestamp: null
              };
              this.services.logger.debug( `No previous private messages found for new user ${ userUUID }` );
            }
          }

          // Persist the updated tracking state
          this.services.setState( 'lastPrivateMessageTracking', this.lastPrivateMessageTracking );

        } catch ( error ) {
          this.services.logger.warn( `Failed to initialize private message tracking for new user ${ userUUID }: ${ error.message }` );
          // Set to null to indicate initialization was attempted
          this.lastPrivateMessageTracking[ userUUID ] = {
            lastMessageId: null,
            lastTimestamp: null
          };
          this.services.setState( 'lastPrivateMessageTracking', this.lastPrivateMessageTracking );
        }
      } else {
        this.services.logger.debug( `Private message tracking already exists for user ${ userUUID }: ${ JSON.stringify( this.lastPrivateMessageTracking[ userUUID ] ) }` );
      }

    } catch ( error ) {
      this.services.logger.error( `Error initializing private message tracking for user ${ userUUID }: ${ error.message }` );
    }
  }

  async _joinCometChat () {
    this.services.logger.debug( 'Joining the chat...' );
    try {
      const result = await this.services.messageService.joinChat( this.services.config.HANGOUT_ID );

      // Check if this was an "already joined" success case
      if ( result?.data?.alreadyMember ) {
        this.services.logger.debug( '✅ Already a member of CometChat group' );
      } else {
        this.services.logger.debug( '✅ Successfully joined CometChat group' );
      }
    } catch ( error ) {
      this.services.logger.error( `❌ Error joining CometChat group: ${ error.message }` );
      this.services.logger.warn( '⚠️ Continuing without CometChat group membership - some features may not work' );
      // Don't throw - allow bot to continue with limited functionality
    }
  }

  async _createSocketConnection () {
    this.services.logger.debug( 'Creating SocketClient...' );
    this.socket = new SocketClient( 'https://socket.prod.tt.fm' );
    this.services.logger.debug( '✅ SocketClient created' );
    this.services.socket = this.socket; // Register socket to serviceContainer
    this.services.logger.debug( 'Socket registered to serviceContainer' );
  }

  async _joinSocketRoom () {
    this.services.logger.debug( 'Joining room...' );

    try {
      // Set a flag to indicate we're in the middle of initial connection
      this._isInitialConnection = true;

      const connection = await this._joinRoomWithTimeout();
      this.services.logger.debug( '✅ Room joined successfully, setting up state...' );

      // CRITICAL: Set state immediately to prevent race conditions
      this.state = connection.state;
      this.services.hangoutState = connection.state;

      // Initialize global.previousPlayedSong with currently playing song from initial state
      if ( connection.state?.nowPlaying?.song && connection.state?.djs?.length > 0 ) {
        const currentSong = connection.state.nowPlaying.song;
        const currentDJ = connection.state.djs[ 0 ]; // First DJ is typically the current one
        const currentVoteCounts = connection.state.voteCounts || { likes: 0, dislikes: 0, stars: 0 };

        global.previousPlayedSong = {
          djUuid: currentDJ.uuid,
          artistName: currentSong.artistName,
          trackName: currentSong.trackName,
          voteCounts: { ...currentVoteCounts }
        };

        this.services.logger.debug( '[bot] Initialized global.previousPlayedSong from initial state:', {
          djUuid: currentDJ.uuid,
          trackName: currentSong.trackName,
          artistName: currentSong.artistName,
          voteCounts: currentVoteCounts
        } );
      } else {
        this.services.logger.debug( '[bot] No currently playing song in initial state - global.previousPlayedSong not initialized' );
      }

      // Apply any deferred patches that arrived during room join
      await this._applyDeferredPatches();

      // Clear the initial connection flag
      this._isInitialConnection = false;

      // Add a delay to ensure the state is fully propagated and any immediate
      // stateful messages during connection are processed
      this.services.logger.debug( 'Allowing state propagation and initial message processing...' );
      await new Promise( resolve => setTimeout( resolve, 500 ) );

      // Initialize the state service with validation
      try {
        await this._initializeStateServiceSafely();
      } catch ( stateError ) {
        this.services.logger.error( `❌ Failed to initialize state service: ${ stateError.message }` );
        throw stateError;
      }

      // Seed afkService from initial room state — handles users/DJs already
      // present when the bot (re)starts, since no addedDj/userJoined events
      // fire for them during the join callback
      this._seedAfkServiceFromState();

      // Log initial state if DEBUG logging is enabled
      if ( this.services.config.SOCKET_MESSAGE_LOG_LEVEL === 'DEBUG' ) {
        try {
          const logsDir = path.join( process.cwd(), 'logs' );
          const initialStateFile = path.join( logsDir, '000000_initialState.log' );
          const timestamp = new Date().toISOString();
          const logEntry = `${ timestamp }: ${ JSON.stringify( this.services.hangoutState, null, 2 ) }\n`;

          await fs.appendFile( initialStateFile, logEntry );
          this.services.logger.debug( 'Initial state logged to 000000_initialState.log' );
        } catch ( logError ) {
          this.services.logger.error( `Failed to log initial state: ${ logError.message }` );
        }
      }
    } catch ( joinError ) {
      // Clear the initial connection flag on error
      this._isInitialConnection = false;
      this.services.logger.error( `❌ Failed to join room: ${ joinError }` );
      throw joinError;
    }
  }

  async _joinRoomWithTimeout () {
    const timeoutMs = 1000 * 60; // 60 seconds

    return Promise.race( [
      this.socket.joinRoom( this.services.config.BOT_USER_TOKEN, {
        roomUuid: this.services.config.HANGOUT_ID
      } ),
      new Promise( ( _, reject ) =>
        setTimeout( () => reject( new Error( `Socket join room timeout after ${ timeoutMs / 1000 } seconds` ) ), timeoutMs )
      )
    ] );
  }

  _setupReconnectHandler () {
    this.services.logger.debug( '✅ Setting up reconnect handler...' );

    this.socket.on( "reconnect", async () => {
      this.services.logger.debug( '🔄 Reconnecting to room...' );
      try {
        const { state } = await this.socket.joinRoom( this.services.config.BOT_USER_TOKEN, {
          roomUuid: this.services.config.HANGOUT_ID
        } );
        this.state = state;
        this.services.hangoutState = state;
        this.services.logger.debug( '🔄 Reconnected successfully' );
      } catch ( error ) {
        this.services.logger.error( `❌ Reconnection failed: ${ error }` );
      }
    } );
  }

  // ========================================================
  // Listener Configuration
  // ========================================================

  configureListeners () {
    // This method is kept for backwards compatibility
    // In the new flow, listeners are set up individually after state is available
    this._setupStatefulMessageListener();
    this._setupStatelessMessageListener();
    this._setupServerMessageListener();
    this._setupErrorListener();
  }

  _setupStatefulMessageListener () {
    this.socket.on( 'statefulMessage', async ( message ) => {
      // this.services.logger.debug( `statefulMessage - ${ message.name }` );

      // Log payload to file
      await this._writeSocketMessagesToLogFile( 'statefulMessage.log', message );

      // Apply state patch to update current state
      if ( message.statePatch ) {
        // During initial connection, we might not have state yet
        if ( this.state && !this._isInitialConnection ) {
          // State is available and we're not in initial connection - apply immediately
          try {
            await this._applyStatePatch( message, message.statePatch );
          } catch ( error ) {
            // Format the error message to include important details but exclude the tree
            let errorMsg = error.message;
            const messageParts = error.message.split( '\ntree:' );
            errorMsg = messageParts[ 0 ];  // Take everything before 'tree:'
            this.services.logger.error( `Failed to apply state patch for ${ message.name }: ${ errorMsg }` );
            // Continue execution even if patch fails to avoid breaking the bot
          }
        } else if ( this._isInitialConnection ) {
          // State not available yet during initial connection - defer the patch
          this.services.logger.debug( `Deferring state patch for ${ message.name } until state is available` );
          this.deferredPatches.push( { message, statePatch: message.statePatch } );
        } else {
          // Not in initial connection but no state available - this is unusual, warn about it
          this.services.logger.warn( `Received state patch but no current state available for message: ${ message.name }` );
        }
      } else {
        this.services.logger.debug( `No state patch provided for message: ${ message.name }` );
      }

      // Handler logic based on message.name
      try {
        const handlers = require( '../handlers' );
        const handlerFn = handlers[ message.name ];
        if ( typeof handlerFn === 'function' ) {
          this.services.logger.debug( `Calling handler for statefulMessage: ${ message.name }` );
          await handlerFn( message, this.state, this.services );
        } else {
          this.services.logger.debug( `No handler found for statefulMessage: ${ message.name }` );
        }
      } catch ( err ) {
        this.services.logger.error( `Error calling handler for statefulMessage ${ message.name }: ${ err.message }` );
      }
    } );
  }

  _setupStatelessMessageListener () {
    this.socket.on( "statelessMessage", async ( payload ) => {
      this.services.logger.debug( `statelessMessage - ${ payload.name }` );

      // Log payload to file
      await this._writeSocketMessagesToLogFile( 'statelessMessage.log', payload );

      // TODO: Add specific handler logic based on payload.name
    } );
  }

  _setupServerMessageListener () {
    this.socket.on( "serverMessage", async ( payload ) => {
      // this.services.logger.debug( `serverMessage - ${ payload.message.name }` );

      // Log payload to file
      await this._writeSocketMessagesToLogFile( 'serverMessage.log', payload );

      // Handle specific message types
      try {
        // Only handle certain message types via serverMessage - others should be handled by statefulMessage only
        const serverMessageOnlyHandlers = [ 'playedOneTimeAnimation' ];

        if ( serverMessageOnlyHandlers.includes( payload.message.name ) ) {
          const handlers = require( '../handlers' );
          const handlerFn = handlers[ payload.message.name ];
          if ( typeof handlerFn === 'function' ) {
            // this.services.logger.debug( `Calling handler for serverMessage: ${ payload.message.name }` );
            await handlerFn( payload.message, this.state, this.services );
          } else {
            // this.services.logger.debug( `No handler found for serverMessage: ${ payload.message.name }` );
          }
        } else {
          // this.services.logger.debug( `Skipping serverMessage handler for ${ payload.message.name } - handled by statefulMessage only` );
        }
      } catch ( err ) {
        this.services.logger.error( `Error calling handler for serverMessage ${ payload.message.name }: ${ err.message }` );
      }
    } );
  }

  _setupErrorListener () {
    this.socket.on( "error", async ( message ) => {
      this.services.logger.debug( `Socket error: ${ message }` );

      // Log message to file
      await this._writeSocketMessagesToLogFile( 'socketError.log', { error: message, timestamp: new Date().toISOString() } );

      // TODO: Add specific error handling logic
    } );
  }

  // ========================================================
  // Message Processing
  // ========================================================

  async processNewPublicMessages () {
    // Prevent concurrent processing
    if ( this.isProcessingPublicMessages ) {
      this.services.logger.debug( `🔄 [processNewPublicMessages] Already processing, skipping this interval` );
      return;
    }

    this.isProcessingPublicMessages = true;
    const startTime = Date.now();
    let timedOut = false;

    const serviceLastMessageId = this.services.getState( 'lastMessageId' );
    const localLastMessageId = this.lastMessageIDs?.id;
    const effectiveLastMessageId = serviceLastMessageId || localLastMessageId;
    this.services.logger.debug( `🔄 [processNewPublicMessages] Interval: ${ this.publicMessageInterval }ms, LastMsgID: ${ effectiveLastMessageId || 'none' }` );

    try {
      // Dynamic timeout based on current interval (90% of interval)
      const timeout = Math.floor( this.publicMessageInterval * 0.9 );
      const messages = await Promise.race( [
        this._fetchNewMessages(),
        new Promise( ( _, reject ) =>
          setTimeout( () => {
            timedOut = true;
            reject( new Error( `Message fetch timeout after ${ timeout }ms` ) );
          }, timeout )
        )
      ] );

      const fetchDuration = Date.now() - startTime;

      // Success! Reset interval to 1 second
      if ( this.publicMessageInterval !== 1000 ) {
        this.services.logger.info( `✅ [processNewPublicMessages] Reset interval from ${ this.publicMessageInterval }ms to 1000ms` );
        this.publicMessageInterval = 1000;
      }

      if ( fetchDuration > timeout * 0.8 ) {
        this.services.logger.warn( `⚠️ [processNewPublicMessages] Slow fetch: ${ fetchDuration }ms` );
      }

      if ( !messages?.length ) {
        this.services.logger.debug( `🔄 [processNewPublicMessages] No messages returned` );
        return; // No new messages to process
      }

      this.services.logger.info( `📨 [processNewPublicMessages] Processing ${ messages.length } command message(s)` );

      await this._processMessageBatch( messages );
    } catch ( error ) {
      const fetchDuration = Date.now() - startTime;
      // More defensive error handling
      const errorMessage = error && typeof error === 'object'
        ? ( error.message || error.toString() || 'Unknown error object' )
        : ( error || 'Unknown error' );

      // Check if this was a timeout (backoff logic)
      if ( timedOut ) {
        const oldInterval = this.publicMessageInterval;
        this.publicMessageInterval = Math.min(
          this.publicMessageInterval + this.publicMessageBackoffStep,
          this.publicMessageMaxInterval
        );
        this.services.logger.warn( `⏰ [processNewPublicMessages] Timeout after ${ fetchDuration }ms! Increasing interval from ${ oldInterval }ms to ${ this.publicMessageInterval }ms` );
      } else {
        this.services.logger.error( `❌ Error in processNewPublicMessages after ${ fetchDuration }ms: ${ errorMessage }` );
      }

      // DEBUG: More error details
      if ( error && error.stack ) {
        this.services.logger.debug( `Error stack: ${ error.stack }` );
      }

      // Check if this error requires a reconnect (e.g., bot kicked from group)
      if ( error && error.shouldReconnect ) {
        this.services.logger.warn( '🔄 Initiating reconnect due to authorization error' );
        try {
          this.socket.disconnect();
          this.socket.connect();
        } catch ( reconnectError ) {
          this.services.logger.error( `Failed to initiate reconnect: ${ reconnectError.message }` );
        }
      }
    } finally {
      this.isProcessingPublicMessages = false;
    }
  }

  async processNewPrivateMessages () {
    // Prevent concurrent processing
    if ( this.isProcessingPrivateMessages ) {
      // this.services.logger.debug( `🔄 [processNewPrivateMessages] Already processing, skipping this interval` );
      return;
    }

    this.isProcessingPrivateMessages = true;
    const processStartTime = Date.now();

    try {
      // this.services.logger.debug( `🔄 [processNewPrivateMessages] Starting private message check...` );

      // No overall timeout - let individual per-user timeouts handle backoff independently
      // Each user escalates their interval up to 10 seconds based on their own performance
      const messages = await this._fetchNewPrivateMessages();

      const processDuration = Date.now() - processStartTime;

      if ( !messages?.length ) {
        // this.services.logger.debug( `🔄 [processNewPrivateMessages] No new private messages found (${ processDuration }ms)` );
        return; // No new messages to process
      }

      // this.services.logger.debug( `🔄 [processNewPrivateMessages] Processing ${ messages.length } new private messages (fetch took ${ processDuration }ms)` );
      await this._processMessageBatch( messages );

      const totalDuration = Date.now() - processStartTime;
      // this.services.logger.debug( `✅ [processNewPrivateMessages] Completed processing in ${ totalDuration }ms` );
    } catch ( error ) {
      const processDuration = Date.now() - processStartTime;
      // More defensive error handling
      const errorMessage = error && typeof error === 'object'
        ? ( error.message || error.toString() || 'Unknown error object' )
        : ( error || 'Unknown error' );

      this.services.logger.error( `Error in processNewPrivateMessages after ${ processDuration }ms: ${ errorMessage }` );

      if ( error && error.stack ) {
        this.services.logger.error( `Error stack: ${ error.stack }` );
      }
    } finally {
      this.isProcessingPrivateMessages = false;
    }
  }

  async _fetchNewMessages () {
    this.services.logger.debug( `📨 [_fetchNewMessages] Fetching new messages` );

    // Fetch ALL messages (not pre-filtered) so we can record AFK activity for
    // regular chat messages before filtering down to commands for processing.
    const allMessages = await this.services.messageService.fetchGroupMessages( this.services.config.HANGOUT_ID, {
      lastID: this.lastMessageIDs.id,
      fromTimestamp: this.lastMessageIDs.fromTimestamp,
      filterCommands: false,
      services: this.services
    } );

    // Update tracking with highest message received (not just processed)
    // This ensures pagination moves forward even if no commands are found
    if ( allMessages?.length > 0 ) {
      const highestReceived = Math.max( ...allMessages.map( m => parseInt( m.id ) ) );
      const highestTimestamp = Math.max( ...allMessages.map( m => m.updatedAt || 0 ) );
      this.lastMessageIDs.id = highestReceived;
      this.lastMessageIDs.fromTimestamp = highestTimestamp;
      this.services.updateLastMessageId( highestReceived, highestTimestamp );
    }

    if ( allMessages?.length && this.services.afkService ) {
      for ( const msg of allMessages ) {
        const chatUuid = msg.data?.metadata?.chatMessage?.userUuid || msg.sender;
        if ( chatUuid ) {
          this.services.afkService.recordActivity( chatUuid, 'chat' );
        }
      }
    }

    // Return only command messages for the processing pipeline
    const commandMessages = this.services.messageService.filterMessagesForCommands( allMessages || [] );
    this.services.logger.debug( `📨 [_fetchNewMessages] Raw: ${ allMessages?.length || 0 }, Filtered commands: ${ commandMessages?.length || 0 }` );
    return commandMessages;
  }

  async _fetchNewPrivateMessages () {
    const fetchStartTime = Date.now();
    try {
      // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Starting parallel private message fetch` );

      // Get all users currently in the hangout
      const allUsers = this.services.stateService._getAllUsers();
      // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Found ${ allUsers.length } users in hangout` );

      // Filter valid users and create parallel fetch promises
      const validUsers = allUsers.filter( user => {
        const userUUID = user.uuid;
        if ( userUUID === this.services.config.BOT_UID ) {
          return false; // Skip bot
        }
        if ( !userUUID || userUUID === '' || typeof userUUID !== 'string' ) {
          return false; // Skip invalid UUIDs
        }
        return true;
      } );

      // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Fetching from ${ validUsers.length } valid users in parallel` );

      // Show current per-user backoff state
      // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Per-user backoff state:` );
      for ( const user of validUsers ) {
        const userUUID = user.uuid;
        const userState = this.privateMessageUserIntervals[ userUUID ] || { interval: 1000 };
        // this.services.logger.debug( `   👤 User: ${ userUUID } (${ user.nickname || 'No nickname' }) -> Current interval: ${ userState.interval }ms` );
      }

      // Fetch from all users in PARALLEL with individual timeouts
      const fetchPromises = validUsers.map( user => this._fetchPrivateMessagesForUser( user ) );
      const results = await Promise.allSettled( fetchPromises );

      // Collect all successful messages from all users
      const allPrivateMessages = [];
      results.forEach( ( result, index ) => {
        const user = validUsers[ index ];
        if ( result.status === 'fulfilled' && result.value?.length > 0 ) {
          allPrivateMessages.push( ...result.value );
          // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Collected ${ result.value.length } messages from user ${ user.uuid }` );
        } else if ( result.status === 'rejected' ) {
          this.services.logger.warn( `⚠️ [_fetchNewPrivateMessages] User ${ user.uuid } fetch failed: ${ result.reason?.message || result.reason }` );
        }
      } );

      // Sort all messages by sentAt timestamp to process them in chronological order
      allPrivateMessages.sort( ( a, b ) => a.sentAt - b.sentAt );

      const fetchDuration = Date.now() - fetchStartTime;
      // this.services.logger.debug( `✅ [_fetchNewPrivateMessages] Completed parallel fetch in ${ fetchDuration }ms - Total messages found: ${ allPrivateMessages.length }` );

      return allPrivateMessages;

    } catch ( error ) {
      const fetchDuration = Date.now() - fetchStartTime;
      this.services.logger.error( `❌ [_fetchNewPrivateMessages] Error in _fetchNewPrivateMessages after ${ fetchDuration }ms: ${ error.message }` );
      this.services.logger.error( `❌ [_fetchNewPrivateMessages] Error stack: ${ error.stack }` );
      return [];
    }
  }

  /**
   * Fetch private messages for a single user with per-user timeout and backoff
   * Each user maintains its own interval state for independent retry logic
   */
  async _fetchPrivateMessagesForUser ( user ) {
    const userUUID = user.uuid;
    const userStartTime = Date.now();

    try {
      // Initialize per-user interval tracking if needed
      if ( !this.privateMessageUserIntervals[ userUUID ] ) {
        this.privateMessageUserIntervals[ userUUID ] = {
          interval: 1000,        // Start at 1 second (like public messages)
          backoffStep: 1000,     // Increase by 1 second per timeout
          maxInterval: 10000     // Max 10 seconds
        };
      }

      const userState = this.privateMessageUserIntervals[ userUUID ];
      const timeout = Math.floor( userState.interval * 0.9 ); // 90% of interval

      // this.services.logger.debug( `🔍 [_fetchPrivateMessagesForUser] [${ userUUID }] Starting fetch with ${ timeout }ms timeout (interval: ${ userState.interval }ms)` );

      // Fetch messages for this user with per-user timeout
      let timeoutId;
      const userMessages = await Promise.race( [
        this._fetchMessagesBatchForUser( userUUID ),
        new Promise( ( _, reject ) => {
          timeoutId = setTimeout( () => {
            // this.services.logger.warn( `⏰ [_fetchPrivateMessagesForUser] [${ userUUID }] Timeout after ${ timeout }ms` );
            reject( new Error( `PRIVATE_MESSAGE_TIMEOUT: Fetch timeout after ${ timeout }ms` ) );
          }, timeout );
        } )
      ] );

      // Cancel timeout since fetch won
      clearTimeout( timeoutId );

      // Success! Reset interval to 1 second
      if ( userState.interval !== 1000 ) {
        // this.services.logger.debug( `✅ [_fetchPrivateMessagesForUser] [${ userUUID }] Fetch successful, resetting interval from ${ userState.interval }ms to 1000ms` );
        userState.interval = 1000;
      }

      const userDuration = Date.now() - userStartTime;
      // this.services.logger.debug( `✅ [_fetchPrivateMessagesForUser] [${ userUUID }] Completed in ${ userDuration }ms - Found ${ userMessages ? userMessages.length : 0 } messages` );

      return userMessages || [];

    } catch ( error ) {
      const userDuration = Date.now() - userStartTime;
      const userState = this.privateMessageUserIntervals[ userUUID ];

      // this.services.logger.debug( `[DEBUG] Error caught. Message: "${ error.message }", Includes PRIVATE_MESSAGE_TIMEOUT: ${ error.message.includes( 'PRIVATE_MESSAGE_TIMEOUT' ) }` );

      // Timeout - apply backoff to this user's interval
      if ( error.message.includes( 'PRIVATE_MESSAGE_TIMEOUT' ) ) {
        const oldInterval = userState.interval;
        userState.interval = Math.min(
          userState.interval + userState.backoffStep,
          userState.maxInterval
        );
        // this.services.logger.warn( `⏰ [_fetchPrivateMessagesForUser] [${ userUUID }] Timeout after ${ userDuration }ms! Increased interval from ${ oldInterval }ms to ${ userState.interval }ms` );
      } else {
        this.services.logger.error( `❌ [_fetchPrivateMessagesForUser] [${ userUUID }] Error after ${ userDuration }ms: ${ error.message }` );
      }

      return [];
    }
  }

  /**
   * Fetch and transform messages for a single user
   */
  async _fetchMessagesBatchForUser ( userUUID ) {
    try {
      // Get the last processed message tracking for this user
      const userTracking = this.lastPrivateMessageTracking[ userUUID ];

      // Build options for fetchNewPrivateUserMessages
      const options = {
        lastMessageId: userTracking?.lastMessageId,
        lastTimestamp: userTracking?.lastTimestamp,
        logLastMessage: false,
        returnData: true
      };

      // Fetch new messages from the API
      const userMessages = await this.services.privateMessageService.fetchNewPrivateUserMessages( userUUID, options );

      if ( !userMessages || userMessages.length === 0 ) {
        return [];
      }

      // Transform messages to match the structure expected by _processMessageBatch
      const transformedMessages = userMessages.map( ( msg ) => {
        return {
          id: msg.id,
          sentAt: msg.sentAt,
          sender: msg.sender,
          data: {
            metadata: {
              chatMessage: {
                message: msg.text,
                userUuid: msg.sender
              }
            }
          },
          // Add metadata to distinguish private messages
          isPrivateMessage: true,
          recipientUUID: userUUID
        };
      } );

      // this.services.logger.debug( `🔍 [_fetchMessagesBatchForUser] [${ userUUID }] Transformed ${ transformedMessages.length } messages` );

      return transformedMessages;

    } catch ( error ) {
      this.services.logger.error( `❌ [_fetchMessagesBatchForUser] [${ userUUID }] Error: ${ error.message }` );
      throw error; // Let caller handle the error
    }
  }

  async _processMessageBatch ( messages ) {
    for ( const message of messages ) {
      await this._processSingleMessage( message );
    }
  }

  async _processSingleMessage ( message ) {
    // Check for duplicate processing (additional safety check)
    if ( message.isPrivateMessage ) {
      const sender = message.sender?.uid || message.sender || '';

      // Silently ignore messages from unknown/invalid users
      if ( !sender || sender === '' ) {
        return;
      }

      const userTracking = this.lastPrivateMessageTracking[ sender ];

      if ( userTracking && userTracking.lastMessageId === message.id ) {
        // Silently skip duplicate messages
        return;
      }
    }

    this._updateMessageTracking( message );

    const chatMessage = this._extractChatMessage( message );
    if ( !chatMessage ) {
      return;
    }

    // Extract sender UUID - handle both direct string and object with uid property
    const sender = message?.sender?.uid || message?.sender || '';

    if ( this._shouldIgnoreMessage( sender ) ) {
      return;
    }

    await this._handleMessage( chatMessage, sender, message );
  }

  _updateMessageTracking ( message ) {
    const previousId = this.lastMessageIDs.id;

    // Handle private message tracking
    if ( message.isPrivateMessage ) {
      // Update private message tracking for the sender
      const sender = message.sender?.uid || message.sender || '';
      if ( sender ) {
        const normalizedTimestamp = this._normalizeTimestamp( message.sentAt );

        this.lastPrivateMessageTracking[ sender ] = {
          lastMessageId: message.id,
          lastTimestamp: normalizedTimestamp
        };

        // Persist private message tracking to service container
        try {
          this.services.setState( 'lastPrivateMessageTracking', this.lastPrivateMessageTracking );
        } catch ( error ) {
          this.services.logger.error( `❌ [_updateMessageTracking] Failed to persist private message tracking state for user ${ sender }: ${ error.message }` );
        }
      }
      // Note: If sender is empty, message is silently ignored in _processSingleMessage
    } else {
      // Handle public message tracking (existing logic)
      this.lastMessageIDs.id = message.id;
      this.lastMessageIDs.fromTimestamp = message.updatedAt;
      this.services.updateLastMessageId( message.id, message.updatedAt );

      this.services.logger.debug( `💾 [_updateMessageTracking] Public message ID: ${ previousId } → ${ message.id }, timestamp: ${ message.updatedAt }` );
    }
  }

  _extractChatMessage ( message ) {
    const messageText = message?.data?.metadata?.chatMessage?.message ?? ''
    // this.services.logger.debug( `[_extractChatMessage] Chat: ${ messageText }` );
    return messageText
  }

  _shouldIgnoreMessage ( sender ) {
    const ignoredSenders = [
      this.services.config.BOT_UID,
      // this.services.config.CHAT_REPLY_ID // Not defined in .env file
    ].filter( Boolean ); // Remove any undefined values

    return ignoredSenders.includes( sender );
  }

  async _handleMessage ( chatMessage, sender, fullMessage ) {
    // this.services.logger.debug( `[_handleMessage] Chat: ${ chatMessage }` );
    try {
      // Check if parseCommands exists and is a function
      if ( typeof this.services.parseCommands === 'function' ) {
        const parseResult = await this.services.parseCommands( chatMessage, this.services );
        // this.services.logger.debug( `[_handleMessage] parseCommands result: ${ JSON.stringify( parseResult ) }` );

        // If it's a command, process it with commandService
        if ( parseResult && parseResult.isCommand ) {
          this.services.logger.debug( `[_handleMessage] Command detected: "${ parseResult.command }" with remainder: "${ parseResult.remainder }"` );

          // Check if commandService exists and is a function
          if ( typeof this.services.commandService === 'function' ) {
            const context = {
              sender,
              fullMessage,
              chatMessage
            };

            const commandResult = await this.services.commandService(
              parseResult.command,
              parseResult.remainder,
              this.services,
              context
            );

            this.services.logger.debug( `[_handleMessage] Command processed: ${ JSON.stringify( commandResult ) }` );
          } else {
            this.services.logger.warn( `[_handleMessage] commandService is not available: ${ typeof this.services.commandService }` );
          }
        }
      } else {
        this.services.logger.warn( `[_handleMessage] parseCommands is not a function: ${ typeof this.services.parseCommands }` );
      }

      // TODO: Add additional message handling logic here
      // - Non-command message processing
      // - Context management

      // AFK activity for chat is recorded upstream in _fetchNewMessages on the
      // full (unfiltered) message list, so all messages including non-commands are covered.
    } catch ( error ) {
      // More defensive error handling
      const errorMessage = error && typeof error === 'object'
        ? ( error.message || error.toString() || 'Unknown error object' )
        : ( error || 'Unknown error' );

      this.services.logger.error( `Error in _handleMessage: ${ errorMessage }` );

      if ( error && error.stack ) {
        this.services.logger.error( `Error stack: ${ error.stack }` );
      }

      throw error; // Re-throw so processNewPublicMessages can catch it
    }
  }

  // ========================================================
  // Public Methods for Handler Access
  // ========================================================

  async initializePrivateMessageTrackingForUser ( userUUID, setTimestampToNow = false ) {
    return await this._initializePrivateMessageTrackingForUser( userUUID, setTimestampToNow );
  }

  async removePrivateMessageTrackingForUser ( userUUID ) {
    try {
      // Skip bot's own messages
      if ( userUUID === this.services.config.BOT_UID ) {
        return;
      }

      // Remove tracking for this user if it exists
      if ( this.lastPrivateMessageTracking[ userUUID ] ) {
        delete this.lastPrivateMessageTracking[ userUUID ];

        // Persist the updated tracking state
        this.services.setState( 'lastPrivateMessageTracking', this.lastPrivateMessageTracking );

        // this.services.logger.debug( `✅ Removed private message tracking for user: ${ userUUID }` );
      } else {
        // this.services.logger.debug( `No private message tracking found for user: ${ userUUID }` );
      }
    } catch ( error ) {
      this.services.logger.error( `Error removing private message tracking for user ${ userUUID }: ${ error.message }` );
    }
  }

  // ========================================================
  // Utility Methods
  // ========================================================

  /**
   * Ensure timestamps are in seconds (no conversion needed)
   * CometChat consistently uses seconds, so we just pass them through
   * @param {number} timestamp - Timestamp from CometChat (in seconds)
   * @returns {number} Timestamp in seconds
   */
  _normalizeTimestamp ( timestamp ) {
    if ( !timestamp ) return null;
    // CometChat uses seconds consistently, no conversion needed
    return parseInt( timestamp );
  }

  getConnectionStatus () {
    return {
      isConnected: !!this.socket,
      hasState: !!this.state,
      lastMessageId: this.lastMessageIDs?.id,
      lastTimestamp: this.lastMessageIDs?.fromTimestamp
    };
  }

  async disconnect () {
    this.services.logger.debug( 'Disconnecting bot...' );

    // Save private message tracking state before disconnecting
    if ( this.lastPrivateMessageTracking && Object.keys( this.lastPrivateMessageTracking ).length > 0 ) {
      this.services.setState( 'lastPrivateMessageTracking', this.lastPrivateMessageTracking );
      // this.services.logger.debug( 'Saved private message tracking state' );
    }

    if ( this.socket ) {
      // TODO: Add proper socket cleanup
      this.socket = null;
    }

    this.state = null;
    this.services.hangoutState = null;

    // Clear global playedSong state on disconnect
    global.previousPlayedSong = null;
    global.playedSongTimer = null;

    this.services.logger.debug( '✅ Bot disconnected' );
  }
}

module.exports = { Bot };
