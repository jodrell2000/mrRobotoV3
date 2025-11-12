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
  // Deferred Patch Handling
  // ========================================================

  async _applyDeferredPatches () {
    if ( this.deferredPatches.length === 0 ) {
      return;
    }

    this.services.logger.debug( `Applying ${ this.deferredPatches.length } deferred patches...` );

    for ( const deferredPatch of this.deferredPatches ) {
      try {
        await this._applyStatePatch( deferredPatch.message, deferredPatch.statePatch );
      } catch ( error ) {
        this.services.logger.error( `Failed to apply deferred patch for ${ deferredPatch.message.name }: ${ error.message }` );
      }
    }

    // Clear deferred patches after applying
    this.deferredPatches = [];
    this.services.logger.debug( 'All deferred patches applied and cleared' );
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
              this.services.logger.debug( `Skipping remove operation - path does not exist: ${ operation.path }` );
              return false; // Skip this operation
            }
          }
        }
        return true; // Operation is valid
      } catch ( validateError ) {
        this.services.logger.debug( `Skipping invalid operation: ${ JSON.stringify( operation ) } - ${ validateError.message }` );
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

      this.services.logger.debug( `State updated via patch for message: ${ message.name }` );
      this.services.logger.debug( `Applied ${ validOperations.length } patch operations` );

      if ( validOperations.length < statePatch.length ) {
        this.services.logger.debug( `Skipped ${ statePatch.length - validOperations.length } invalid operations` );
      }
    } else {
      this.services.logger.debug( `No valid operations to apply for message: ${ message.name }` );
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
    this.services.initializeStateService();
    this.services.logger.debug( 'StateService initialized successfully with validated state' );
  }

  async _initializeMessageTracking () {
    // Initialize lastMessageIDs from service container state
    const lastMessageId = this.services.getState( 'lastMessageId' );

    if ( lastMessageId ) {
      this.lastMessageIDs.id = lastMessageId;
      // We don't have fromTimestamp in persistent state, so start fresh
      this.lastMessageIDs.fromTimestamp = Math.floor( Date.now() / 1000 );
      this.services.logger.debug( `Initialized message tracking with ID: ${ lastMessageId }` );
    } else {
      this.services.logger.debug( 'No previous message ID found, will fetch from latest messages' );

      // Try to get the latest message ID to establish a baseline using the correct API function
      try {
        const latestMessageId = await this.services.messageService.returnLatestGroupMessageId();
        if ( latestMessageId ) {
          this.lastMessageIDs.id = latestMessageId;
          this.lastMessageIDs.fromTimestamp = Math.floor( Date.now() / 1000 );
          this.services.updateLastMessageId( latestMessageId );
          this.services.logger.debug( `Initialized tracking with latest message ID: ${ latestMessageId }` );
        } else {
          this.services.logger.debug( 'No messages found to establish baseline, starting fresh' );
          this.lastMessageIDs.fromTimestamp = Math.floor( Date.now() / 1000 );
        }
      } catch ( error ) {
        this.services.logger.warn( `Could not fetch latest message ID: ${ error.message }` );
        this.lastMessageIDs.fromTimestamp = Math.floor( Date.now() / 1000 );
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
      this.services.logger.debug( `statefulMessage - ${ message.name }` );

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
      this.services.logger.debug( `serverMessage - ${ payload.message.name }` );

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
            this.services.logger.debug( `Calling handler for serverMessage: ${ payload.message.name }` );
            await handlerFn( payload.message, this.state, this.services );
          } else {
            this.services.logger.debug( `No handler found for serverMessage: ${ payload.message.name }` );
          }
        } else {
          this.services.logger.debug( `Skipping serverMessage handler for ${ payload.message.name } - handled by statefulMessage only` );
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
      // this.services.logger.debug( `🔄 [processNewPublicMessages] Already processing, skipping this interval` );
      return;
    }

    this.isProcessingPublicMessages = true;

    try {
      // Add timeout to prevent hanging (900ms - shorter than polling interval so next poll can retry)
      // If this times out, the next 1-second interval will make another call with the same lastID
      const messages = await Promise.race( [
        this._fetchNewMessages(),
        new Promise( ( _, reject ) =>
          setTimeout( () => reject( new Error( 'Message fetch timeout after 900ms' ) ), 900 )
        )
      ] );

      if ( !messages?.length ) {
        // this.services.logger.debug( `🔄 [processNewPublicMessages] No new public messages found` );
        return; // No new messages to process
      }

      // this.services.logger.info( `🔄 [processNewPublicMessages] Processing ${ messages.length } new public messages` );
      await this._processMessageBatch( messages );
    } catch ( error ) {
      // More defensive error handling
      const errorMessage = error && typeof error === 'object'
        ? ( error.message || error.toString() || 'Unknown error object' )
        : ( error || 'Unknown error' );

      this.services.logger.error( `Error in processNewPublicMessages: ${ errorMessage }` );

      // if ( error && error.stack ) {
      //   this.services.logger.error( `Error stack: ${ error.stack }` );
      // }

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

    try {
      // this.services.logger.debug( `🔄 [processNewPrivateMessages] Starting private message check...` );

      // Add timeout to prevent hanging. Private messages require longer than public messages
      // because they fetch from multiple users sequentially. 5 seconds allows for this.
      // If fetch times out mid-processing, message tracking is already updated (safe),
      // finally block resets flag, and next poll retries with same lastPrivateMessageTracking
      const messages = await Promise.race( [
        this._fetchNewPrivateMessages(),
        new Promise( ( _, reject ) =>
          setTimeout( () => reject( new Error( 'Private message fetch timeout after 5 seconds' ) ), 5000 )
        )
      ] );

      if ( !messages?.length ) {
        // this.services.logger.debug( `🔄 [processNewPrivateMessages] No new private messages found` );
        return; // No new messages to process
      }

      // this.services.logger.debug( `🔄 [processNewPrivateMessages] Processing ${messages.length} new private messages` );
      await this._processMessageBatch( messages );
    } catch ( error ) {
      // More defensive error handling
      const errorMessage = error && typeof error === 'object'
        ? ( error.message || error.toString() || 'Unknown error object' )
        : ( error || 'Unknown error' );

      this.services.logger.error( `Error in processNewPrivateMessages: ${ errorMessage }` );

      if ( error && error.stack ) {
        this.services.logger.error( `Error stack: ${ error.stack }` );
      }
    } finally {
      this.isProcessingPrivateMessages = false;
    }
  }

  async _fetchNewMessages () {
    // Get the most current lastMessageId from service container state
    const serviceLastMessageId = this.services.getState( 'lastMessageId' );
    const localLastMessageId = this.lastMessageIDs?.id;

    // Use service state if available, fallback to local state
    const effectiveLastMessageId = serviceLastMessageId || localLastMessageId;

    const messages = await this.services.messageService.fetchGroupMessages( this.services.config.HANGOUT_ID, {
      fromTimestamp: this.lastMessageIDs?.fromTimestamp,
      lastID: effectiveLastMessageId,
      filterCommands: true, // Get command messages for processing
      services: this.services // Pass services for state management
    } );

    return messages;
  }

  async _fetchNewPrivateMessages () {
    try {
      // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Starting private message fetch` );

      // Get all users currently in the hangout
      const allUsers = this.services.stateService._getAllUsers();
      // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Found ${ allUsers.length } users in hangout` );
      // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Users: ${JSON.stringify(allUsers.map(u => ({ uuid: u.uuid, nickname: u.nickname })), null, 2)}` );

      // Debug: Show current tracking state for all users
      // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Current message tracking state:` );
      for ( const user of allUsers ) {
        const userUUID = user.uuid;
        const userTracking = this.lastPrivateMessageTracking[ userUUID ];
        const timestampInfo = userTracking?.lastTimestamp
          ? `${ userTracking.lastTimestamp } (${ userTracking.lastTimestamp.toString().length } digits)`
          : 'none';
        // this.services.logger.debug( `   👤 User: ${userUUID} (${user.nickname || 'No nickname'}) -> LastMsgID: ${userTracking?.lastMessageId || 'none'}, LastTimestamp: ${timestampInfo}` );
      }

      const allPrivateMessages = [];

      for ( const user of allUsers ) {
        const userUUID = user.uuid;
        // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Processing user: ${userUUID} (${user.nickname || 'No nickname'})` );

        // Skip bot's own messages
        if ( userUUID === this.services.config.BOT_UID ) {
          // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Skipping bot's own messages (BOT_UID: ${this.services.config.BOT_UID})` );
          continue;
        }

        try {
          // Get the last processed message tracking for this user
          const userTracking = this.lastPrivateMessageTracking[ userUUID ];
          // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Last processed message tracking for user ${userUUID}: ${JSON.stringify(userTracking)}` );

          // Build options for fetchNewPrivateUserMessages with filtering
          const options = {
            lastMessageId: userTracking?.lastMessageId,
            lastTimestamp: userTracking?.lastTimestamp,
            logLastMessage: false,
            returnData: true
          };
          // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Calling fetchNewPrivateUserMessages with options: ${JSON.stringify(options)}` );

          // Use the new API-filtered fetch method
          const userMessages = await this.services.privateMessageService.fetchNewPrivateUserMessages( userUUID, options );
          // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] fetchNewPrivateUserMessages returned ${userMessages ? userMessages.length : 'null'} NEW messages for user ${userUUID}` );

          if ( userMessages && userMessages.length > 0 ) {
            // No additional filtering needed - the API already filtered for us
            // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Processing ${userMessages.length} new messages from user ${userUUID}` );

            // Transform messages to match the structure expected by _processMessageBatch
            const transformedMessages = userMessages.map( ( msg, index ) => {
              const transformed = {
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

              // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Transformed message ${index} from user ${userUUID}: ID=${msg.id}, Text="${msg.text}", SentAt=${msg.sentAt}` );
              return transformed;
            } );

            allPrivateMessages.push( ...transformedMessages );

            // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Added ${transformedMessages.length} transformed messages from user ${userUUID}` );
          } else {
            // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] No new messages found for user ${userUUID}` );
          }
        } catch ( userError ) {
          this.services.logger.warn( `❌ [_fetchNewPrivateMessages] Failed to fetch private messages for user ${ userUUID }: ${ userError.message }` );
          this.services.logger.warn( `❌ [_fetchNewPrivateMessages] Error stack: ${ userError.stack }` );
          // Continue with other users even if one fails
        }
      }

      // Sort all messages by sentAt timestamp to process them in chronological order
      allPrivateMessages.sort( ( a, b ) => a.sentAt - b.sentAt );

      // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Total new private messages found: ${ allPrivateMessages.length }` );
      // if ( allPrivateMessages.length > 0 ) {
      //   this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Message summary: ${allPrivateMessages.map(m => `ID=${m.id} from=${m.sender} to=${m.recipientUUID} at=${m.sentAt}`).join(', ')}` );
      // }

      // Debug: Show updated tracking state after fetch
      // this.services.logger.debug( `🔍 [_fetchNewPrivateMessages] Tracking state after fetch (before processing):` );
      for ( const user of allUsers ) {
        const userUUID = user.uuid;
        const userTracking = this.lastPrivateMessageTracking[ userUUID ];
        const timestampInfo = userTracking?.lastTimestamp
          ? `${ userTracking.lastTimestamp } (${ userTracking.lastTimestamp.toString().length } digits)`
          : 'none';
        // this.services.logger.debug( `   👤 User: ${userUUID} -> LastMsgID: ${userTracking?.lastMessageId || 'none'}, LastTimestamp: ${timestampInfo}` );
      }

      return allPrivateMessages;

    } catch ( error ) {
      this.services.logger.error( `❌ [_fetchNewPrivateMessages] Error in _fetchNewPrivateMessages: ${ error.message }` );
      this.services.logger.error( `❌ [_fetchNewPrivateMessages] Error stack: ${ error.stack }` );
      return [];
    }
  }

  async _processMessageBatch ( messages ) {
    for ( const message of messages ) {
      await this._processSingleMessage( message );
    }
  }

  async _processSingleMessage ( message ) {
    // Log raw CometChat data with timestamp information
    // try {
    //   this.services.logger.debug( `📨 [_processSingleMessage] Raw CometChat message data:` );
    //   this.services.logger.debug( `   ID: ${message?.id}` );
    //   this.services.logger.debug( `   SentAt: ${message?.sentAt} (${message?.sentAt?.toString().length || 0} digits)` );
    //   this.services.logger.debug( `   Sender: ${JSON.stringify(message?.sender)}` );
    //   this.services.logger.debug( `   IsPrivate: ${message?.isPrivateMessage || false}` );
    //   this.services.logger.debug( `   Full structure: ${JSON.stringify(message, null, 2)}` );
    // } catch ( err ) {
    //   this.services.logger.debug( `📨 [_processSingleMessage] Could not log raw message: ${err.message}` );
    //   this.services.logger.debug( `📨 [_processSingleMessage] Message type: ${typeof message}, basic info: id=${message?.id}, sentAt=${message?.sentAt}` );
    // }

    // Check for duplicate processing (additional safety check)
    if ( message.isPrivateMessage ) {
      const sender = message.sender?.uid || message.sender || '';
      const userTracking = this.lastPrivateMessageTracking[ sender ];

      if ( userTracking && userTracking.lastMessageId === message.id ) {
        this.services.logger.warn( `⚠️ [_processSingleMessage] DUPLICATE DETECTED: Message ID ${ message.id } from user ${ sender } already processed. Skipping.` );
        return; // Skip processing this duplicate message
      }
    }

    this._updateMessageTracking( message );

    const chatMessage = this._extractChatMessage( message );
    if ( !chatMessage ) return;

    // Debug: Log sender extraction step by step
    // this.services.logger.debug( `[_processSingleMessage] message?.sender: ${ JSON.stringify( message?.sender ) }` );
    // this.services.logger.debug( `[_processSingleMessage] message?.sender?.uid: ${ JSON.stringify( message?.sender?.uid ) }` );
    // this.services.logger.debug( `[_processSingleMessage] typeof message?.sender: ${ typeof message?.sender }` );

    // Extract sender UUID - handle both direct string and object with uid property
    const sender = message?.sender?.uid || message?.sender || '';

    // this.services.logger.debug( `[_processSingleMessage] Final extracted sender: "${ sender }"` );

    if ( this._shouldIgnoreMessage( sender ) ) return;

    // this.services.logger.debug( `[_processSingleMessage] Processing message ID: ${ message?.id }: "${ chatMessage }" from ${ sender }` );

    await this._handleMessage( chatMessage, sender, message );
  }

  _updateMessageTracking ( message ) {
    const previousId = this.lastMessageIDs.id;
    const previousTimestamp = this.lastMessageIDs.fromTimestamp;

    // Handle private message tracking
    if ( message.isPrivateMessage ) {
      // Update private message tracking for the sender
      const sender = message.sender?.uid || message.sender || '';
      if ( sender ) {
        const previousTracking = this.lastPrivateMessageTracking[ sender ];
        const normalizedTimestamp = this._normalizeTimestamp( message.sentAt );

        this.lastPrivateMessageTracking[ sender ] = {
          lastMessageId: message.id,
          lastTimestamp: normalizedTimestamp
        };

        // Persist private message tracking to service container
        try {
          this.services.setState( 'lastPrivateMessageTracking', this.lastPrivateMessageTracking );
          // this.services.logger.debug( `✅ [_updateMessageTracking] Private message tracking updated for user ${ sender }:` );
          // this.services.logger.debug( `   📨 Previous: { lastMessageId: ${ previousTracking?.lastMessageId || 'none' }, lastTimestamp: ${ previousTracking?.lastTimestamp || 'none' } }` );
          // this.services.logger.debug( `   📨 Current:  { lastMessageId: ${ message.id }, lastTimestamp: ${ normalizedTimestamp } } (normalized from ${ message.sentAt })` );
          // this.services.logger.debug( `   💾 State persisted successfully` );
        } catch ( error ) {
          this.services.logger.error( `❌ [_updateMessageTracking] Failed to persist private message tracking state for user ${ sender }: ${ error.message }` );
        }
      } else {
        this.services.logger.warn( `⚠️ [_updateMessageTracking] Private message received but no sender identified. Message: ${ JSON.stringify( message ) }` );
      }
    } else {
      // Handle public message tracking (existing logic)
      this.services.updateLastMessageId( message.id );
      this.lastMessageIDs.fromTimestamp = message.sentAt + 1;
      this.lastMessageIDs.id = message.id;

      // Debug: Log tracking updates
      // this.services.logger.debug( `[Bot] Message tracking updated:` );
      // this.services.logger.debug( `[Bot] - Previous ID: ${ previousId } -> New ID: ${ message.id }` );
      // this.services.logger.debug( `[Bot] - Previous timestamp: ${ previousTimestamp } -> New timestamp: ${ message.sentAt + 1 }` );
      // this.services.logger.debug( `[Bot] - Message sentAt: ${ message.sentAt }` );
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
        this.services.logger.debug( `[_handleMessage] parseCommands result: ${ JSON.stringify( parseResult ) }` );

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

        this.services.logger.debug( `✅ Removed private message tracking for user: ${ userUUID }` );
      } else {
        this.services.logger.debug( `No private message tracking found for user: ${ userUUID }` );
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
      this.services.logger.debug( 'Saved private message tracking state' );
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
