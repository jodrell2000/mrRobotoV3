// Services Container - Singleton pattern via Node.js module caching
const { messageService } = require( './messageService.js' );
const privateMessageService = require( './privateMessageService.js' );
const parseCommands = require( './parseCommands.js' );
const commandService = require( './commandService.js' );
const playlistService = require( './playlistService.js' );
const { hangSocketServices } = require( './hangSocketServices.js' );
const { logger } = require( '../lib/logging.js' );
const config = require( '../config.js' );
const hangUserService = require( './hangUserService.js' );
const StateService = require( './stateService.js' );
const DataService = require( './dataService.js' );
const FeaturesService = require( './featuresService.js' );
const MachineLearningService = require( './machineLearningService.js' );
const TriggerService = require( './triggerService.js' );
const TokenService = require( './tokenService.js' );
const RetryService = require( './retryService.js' );
const validationService = require( './validationService.js' );

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
  featuresService,
  retryService,
  validationService,
  machineLearningService: null, // Will be initialized after services object is created
  triggerService: null, // Will be initialized after services object is created
  tokenService: null, // Will be initialized after services object is created
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

  updateLastMessageId ( id ) {
    if ( !this.hangoutState ) this.hangoutState = {};
    this.hangoutState.lastMessageId = id;
    if ( this.state ) this.state.lastMessageId = id;
    this.logger.debug( `Last message ID updated to: ${ id }` );
  },

  initializeStateService () {
    if ( !this.hangoutState ) {
      throw new Error( 'Cannot initialize StateService: hangoutState is not set' );
    }

    // Check if hangoutState is empty (just an empty object)
    const stateKeys = Object.keys( this.hangoutState );
    if ( stateKeys.length === 0 ) {
      throw new Error( 'Cannot initialize StateService: hangoutState is empty - socket room may not be joined yet' );
    }

    // Check if hangoutState has essential properties that indicate it's properly loaded
    const hasAllUserData = this.hangoutState.hasOwnProperty( 'allUserData' );
    const hasAllUsers = this.hangoutState.hasOwnProperty( 'allUsers' );

    if ( !hasAllUserData || !hasAllUsers ) {
      const missingProps = [];
      if ( !hasAllUserData ) missingProps.push( 'allUserData' );
      if ( !hasAllUsers ) missingProps.push( 'allUsers' );

      throw new Error( `Cannot initialize StateService: hangoutState is missing essential properties: ${ missingProps.join( ', ' ) } - initial state may not be fully loaded` );
    }

    this.stateService = new StateService( this.hangoutState, this );
    this.logger.debug( 'StateService initialized with valid hangout state' );
  }
};

// Initialize triggerService, machineLearningService and tokenService after services object is created to avoid circular dependencies
services.machineLearningService = new MachineLearningService( services );
services.triggerService = new TriggerService( services );
services.tokenService = new TokenService( services );

// Initialize retry service connection to CometChat API
const cometchatApi = require( './cometchatApi.js' );
cometchatApi.setRetryService( retryService );

// Initialize data asynchronously
initializeData();

module.exports = services;
