// Services Container - Singleton pattern via Node.js module caching
const { messageService } = require( './messageService.js' );
const privateMessageService = require( './privateMessageService.js' );
const parseCommands = require( './parseCommands.js' );
const commandService = require( './commandService.js' );
const playlistService = require( './playlistService.js' );
const { hangSocketServices } = require( './hangSocketServices.js' );
const { announceTrackStarted, announceTrackEnded } = require( '../handlers/trackAnnouncer.js' );
const userJoinedHandler = require( '../handlers/userJoined.js' );
const { handleUserJoinedEvent } = userJoinedHandler;
const playedSongHandler = require( '../handlers/playedSong.js' );
const { handlePlayedSongEvent } = playedSongHandler;
const playedOneTimeAnimationHandler = require( '../handlers/playedOneTimeAnimation.js' );
const { handlePlayedOneTimeAnimationEvent } = playedOneTimeAnimationHandler;
const votedOnSongHandler = require( '../handlers/votedOnSong.js' );
const { handleVotedOnSongEvent } = votedOnSongHandler;
const addedDjHandler = require( '../handlers/addedDj.js' );
const { handleAddedDjEvent } = addedDjHandler;
const removedDjHandler = require( '../handlers/removedDj.js' );
const { handleRemovedDjEvent } = removedDjHandler;
const updatedRoomSettingsHandler = require( '../handlers/updatedRoomSettings.js' );
const { handleUpdatedRoomSettingsEvent } = updatedRoomSettingsHandler;
const { logger } = require( '../lib/logging.js' );
const config = require( '../config.js' );
const hangUserService = require( './hangUserService.js' );
const StateService = require( './stateService.js' );
const DataService = require( './dataService.js' );
const DatabaseService = require( './databaseService.js' );
const FeaturesService = require( './featuresService.js' );
const MachineLearningService = require( './machineLearningService.js' );
const TriggerService = require( './triggerService.js' );
const TokenService = require( './tokenService.js' );
const RetryService = require( './retryService.js' );
const AfkService = require( './afkService.js' );
const validationService = require( './validationService.js' );
const VersionService = require( './versionService.js' );
const DocumentationService = require( './documentationService.js' );
const RateLimiterService = require( './rateLimiterService.js' );
const VerificationService = require( './verificationService.js' );
const AdapterService = require( './AdapterService.js' );
const EventDispatcher = require( './eventDispatcher.js' );
const PlatformEventCoordinator = require( './platformEventCoordinator.js' );
const createPlatformActions = require( './platformActions.js' );

// Shared state that all services can access and modify
const sharedState = {
  lastMessageId: null,
  connectedUsers: [],
  botStatus: 'disconnected',
  messageCache: new Map(),
  userSessions: new Map(),
  currentPlaylist: [],
  dbConnectionStatus: 'disconnected'
};

// Services container with shared references
// Initialize dataService
const dataService = require( './dataService.js' );

// Initialize featuresService with dataService dependency
const featuresService = new FeaturesService( dataService );

// Initialize retryService
const retryService = new RetryService();

// Initialize afkService
const afkService = new AfkService();

// Initialize versionService
const versionService = new VersionService();

// Initialize rateLimiterService
const rateLimiterService = new RateLimiterService();

// Note: machineLearningService and triggerService will be initialized after services object is created
// to avoid circular dependency issues

// Load data and make it available in the services container
const initializeData = async () => {
  try {
    await dataService.loadData();
    services.data = dataService.getAllData();
  } catch ( err ) {
    logger.error( 'Failed to load data:', err );
    services.data = {}; // Fallback to empty object
  }
};

// Initialize database service
const initializeDatabase = async () => {
  try {
    services.databaseService = new DatabaseService( logger );
    await services.databaseService.initialize();
  } catch ( err ) {
    logger.error( 'Failed to initialize DatabaseService:', err );
  }
};

// Initialize adapter service (socket and API adapters)
const initializeAdapters = async () => {
  try {
    logger.debug( 'Initializing adapter service...' );

    // Create AdapterService with current config
    services.adapterService = new AdapterService( config, logger, {
      messageService,
      privateMessageService,
      openchatApi: services.openchatApi
    } );

    // Initialize and validate configuration
    await services.adapterService.initialize();

    // Register selected framework and adapters
    services.frameworkSpecification = services.adapterService.getFrameworkSpecification();
    services.platformActions = createPlatformActions( services );
    services.platformEventCoordinator = new PlatformEventCoordinator( {
      framework: services.frameworkSpecification,
      dispatcher: services.eventDispatcher,
      services,
      logger
    } );
    services.socketAdapter = services.adapterService.getSocketAdapter();
    services.socketAdapter.setLogger( logger );
    logger.info( `✅ Socket adapter initialized for framework: ${ services.adapterService.getFramework() }` );

    // Register API adapter
    services.apiAdapter = services.adapterService.getApiAdapter();
    services.apiAdapter.setLogger( logger );
    logger.info( `✅ API adapter initialized for framework: ${ services.adapterService.getFramework() }` );
    services.messagingAdapter = services.adapterService.getMessagingAdapter();

  } catch ( err ) {
    logger.error( `❌ Failed to initialize adapters: ${ err.message }` );
    throw err; // Re-throw to prevent bot startup with invalid configuration
  }
};

const services = {
  // External services
  messageService,
  privateMessageService,
  parseCommands,
  commandService,
  playlistService,
  hangSocketServices,
  hangUserService,
  logger,
  config,
  dataService,
  databaseService: null, // Will be initialized async
  featuresService,
  retryService,
  afkService,
  versionService,
  rateLimiterService,
  validationService,
  machineLearningService: null, // Will be initialized after services object is created
  triggerService: null, // Will be initialized after services object is created
  tokenService: null, // Will be initialized after services object is created
  documentationService: null, // Will be initialized after services object is created
  verificationService: null, // Will be initialized after services object is created
  openchatApi: null, // Will be initialized after services object is created
  adapterService: null, // Will be initialized async - adapter orchestrator
  socketAdapter: null, // Will be initialized async - socket adapter for the configured framework
  apiAdapter: null, // Will be initialized async - API adapter for the configured framework
  messagingAdapter: null, // Will be initialized async - messaging adapter for the configured framework
  frameworkSpecification: null, // Will be initialized async - selected site framework
  eventDispatcher: new EventDispatcher( logger ),
  platformEventCoordinator: null,
  platformActions: null,
  data: {}, // Will be populated by initializeData()

  // Shared state
  state: sharedState,
  hangoutState: {}, // Initialize hangoutState

  // Helper methods for state management
  setState ( key, value ) {
    if ( !this.hangoutState ) this.hangoutState = {};
    this.hangoutState[ key ] = value;
    if ( this.state ) this.state[ key ] = value;

    // Properly log objects by stringifying them
    const valueToLog = typeof value === 'object' && value !== null
      ? JSON.stringify( value, null, 2 )
      : value;
    // this.logger.debug( `State updated: ${ key } = ${ valueToLog }` );
  },

  getState ( key ) {
    if ( !this.hangoutState ) this.hangoutState = {};
    // Prefer hangoutState, fallback to state
    return this.hangoutState[ key ] !== undefined ? this.hangoutState[ key ] : this.state[ key ];
  },

  updateLastMessageId ( id, timestamp ) {
    if ( !this.hangoutState ) this.hangoutState = {};
    if ( id ) {
      this.hangoutState.lastMessageId = id;
      if ( this.state ) this.state.lastMessageId = id;
    }
    if ( timestamp ) {
      this.hangoutState.lastMessageTimestamp = timestamp;
      if ( this.state ) this.state.lastMessageTimestamp = timestamp;
    }
    // this.logger.debug( `Last message ID updated to: ${ id }, timestamp: ${ timestamp }` );
  },

  async initializeStateService () {
    if ( !this.hangoutState ) {
      throw new Error( 'Cannot initialize StateService: hangoutState is not set' );
    }

    // Check if hangoutState is empty (just an empty object)
    const stateKeys = Object.keys( this.hangoutState );
    if ( stateKeys.length === 0 ) {
      throw new Error( 'Cannot initialize StateService: hangoutState is empty - socket room may not be joined yet' );
    }

    // Check if hangoutState has essential properties that indicate it's properly loaded
    const isWavez = this.frameworkSpecification?.id === 'wavezfm';
    const hasAllUserData = this.hangoutState.hasOwnProperty( 'allUserData' );
    const hasAllUsers = this.hangoutState.hasOwnProperty( 'allUsers' );

    if ( !isWavez && ( !hasAllUserData || !hasAllUsers ) ) {
      const missingProps = [];
      if ( !hasAllUserData ) missingProps.push( 'allUserData' );
      if ( !hasAllUsers ) missingProps.push( 'allUsers' );

      throw new Error( `Cannot initialize StateService: hangoutState is missing essential properties: ${ missingProps.join( ', ' ) } - initial state may not be fully loaded` );
    }

    const normalizeState = this.frameworkSpecification?.translators?.normalizeState;
    const normalizedState = normalizeState
      ? normalizeState( this.hangoutState, this.config )
      : undefined;

    this.stateService = new StateService( this.hangoutState, this, normalizedState );
    this.logger.debug( 'StateService initialized with valid hangout state' );
  }
};

// Initialize triggerService, machineLearningService, tokenService and documentationService after services object is created to avoid circular dependencies
services.machineLearningService = new MachineLearningService( services );
services.triggerService = new TriggerService( services );
services.tokenService = new TokenService( services );
services.documentationService = new DocumentationService( {
  versionService: services.versionService,
  services: services
} );
services.verificationService = new VerificationService( services );

services.eventDispatcher.registerHandler( 'roomStateReceived', async ( event, context ) => {
  const state = event.payload?.state;
  if ( state && context.services?.stateService ) {
    context.services.stateService.setNormalizedState( state );
  }
} );

services.eventDispatcher.registerHandler( 'stateChanged', async ( event, context ) => {
  const state = event.payload?.state;
  if ( state && context.services?.stateService ) {
    context.services.stateService.setNormalizedState( state );
  }
} );

services.eventDispatcher.registerHandler( 'djQueueChanged', async ( event, context ) => {
  const state = context.services?.stateService?.getState();
  if ( state && event.payload?.djQueue ) state.djQueue = event.payload.djQueue;
} );

services.eventDispatcher.registerHandler( 'trackStarted', async ( event, context ) => {
  const state = context.services?.stateService?.getState();
  if ( state ) state.nowPlaying = event.payload?.playback || null;
  await announceTrackStarted( event, context.services );
  await handlePlayedSongEvent( event, context );
} );

services.eventDispatcher.registerHandler( 'trackEnded', async ( event, context ) => {
  const state = context.services?.stateService?.getState();
  await announceTrackEnded( event, context.services );
  if ( state?.nowPlaying?.playId === event.payload?.playId ) state.nowPlaying = null;
} );

services.eventDispatcher.registerHandler( 'userJoined', async ( event, context ) => {
  await handleUserJoinedEvent( event, context );
} );

services.eventDispatcher.registerHandler( 'emojiVote', async ( event, context ) => {
  await handlePlayedOneTimeAnimationEvent( event, context );
} );

services.eventDispatcher.registerHandler( 'voteChanged', async ( event, context ) => {
  const state = context.services?.stateService?.getState();
  if ( state && event.payload?.votes ) state.votes = event.payload.votes;
  await handleVotedOnSongEvent( event, context );
} );

services.eventDispatcher.registerHandler( 'djAdded', async ( event, context ) => {
  await handleAddedDjEvent( event, context );
} );

services.eventDispatcher.registerHandler( 'djRemoved', async ( event, context ) => {
  await handleRemovedDjEvent( event, context );
} );

services.eventDispatcher.registerHandler( 'roomSettingsChanged', async ( event, context ) => {
  const state = context.services?.stateService?.getState();
  if ( state && event.payload?.roomSettings ) state.roomSettings = event.payload.roomSettings;
  await handleUpdatedRoomSettingsEvent( event, context );
} );

// Initialize retry service connection to OpenChat API
const openchatApi = require( './openchatApi.js' );
openchatApi.setRetryService( retryService );
services.openchatApi = openchatApi;

// Initialize data asynchronously
const initializeServices = async () => {
  await initializeData();
  await initializeDatabase();

  // Initialize adapters (socket and API) - CRITICAL for phases 5, 6, 7
  try {
    await initializeAdapters();
  } catch ( err ) {
    logger.error( 'Adapter initialization failed - bot cannot start:', err );
    throw err;
  }

  // Initialize verification service
  try {
    await services.verificationService.initialize();
  } catch ( err ) {
    logger.error( 'Failed to initialize VerificationService:', err );
  }

  // Initialize machine learning service backend
  try {
    await services.machineLearningService.initialize();
  } catch ( err ) {
    logger.error( 'Failed to initialize MachineLearningService:', err );
  }
};

// Call initializeServices but don't block module export. Startup code can await
// this promise before reading framework-dependent configuration.
services.initializationPromise = initializeServices().catch( err => {
  logger.error( 'Failed to initialize services:', err );
  services.initializationError = err;
} );

module.exports = services;
module.exports.initializeServices = initializeServices;
