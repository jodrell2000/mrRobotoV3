const fs = require( 'node:fs' );
const path = require( 'node:path' );

const WELCOME_MESSAGES_PATH = path.join( __dirname, '../../data/welcomeMessages.json' );

// Track when each user was last welcomed (per hangout) to prevent spamming
// Format: { 'hangout-name:user-uuid': timestamp }
const welcomeCooldowns = new Map();
const WELCOME_COOLDOWN_MS = 30 * 60 * 1000; // 10 minutes

// Track when the last full welcome message was sent per hangout (rate limiting)
// Format: { 'hangout-name': timestamp }
const fullWelcomeCooldowns = new Map();
const FULL_WELCOME_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Checks if a user is on cooldown for welcome messages
 * @param {string} userUUID - User's UUID
 * @param {string} hangoutName - Name of the hangout
 * @returns {boolean} True if user is still on cooldown, false if they can be welcomed
 */
function isOnWelcomeCooldown ( userUUID, hangoutName ) {
  const key = `${ hangoutName }:${ userUUID }`;
  const lastWelcomeTime = welcomeCooldowns.get( key );

  if ( !lastWelcomeTime ) {
    return false; // First time or cooldown expired
  }

  const elapsed = Date.now() - lastWelcomeTime;
  return elapsed < WELCOME_COOLDOWN_MS;
}

/**
 * Records that a user was welcomed (updates cooldown timestamp)
 * @param {string} userUUID - User's UUID
 * @param {string} hangoutName - Name of the hangout
 */
function recordWelcome ( userUUID, hangoutName ) {
  const key = `${ hangoutName }:${ userUUID }`;
  welcomeCooldowns.set( key, Date.now() );
}

/**
 * Checks if the full welcome message can be sent (per hangout)
 * @param {string} hangoutName - Name of the hangout
 * @returns {boolean} True if full message can be sent, false if still on cooldown
 */
function canSendFullWelcome ( hangoutName ) {
  const lastFullWelcomeTime = fullWelcomeCooldowns.get( hangoutName );

  if ( !lastFullWelcomeTime ) {
    return true; // First time or cooldown expired
  }

  const elapsed = Date.now() - lastFullWelcomeTime;
  return elapsed >= FULL_WELCOME_COOLDOWN_MS;
}

/**
 * Records that a full welcome message was sent (updates cooldown timestamp)
 * @param {string} hangoutName - Name of the hangout
 */
function recordFullWelcome ( hangoutName ) {
  fullWelcomeCooldowns.set( hangoutName, Date.now() );
}

/**
 * Extracts user data from the state patch message
 * @param {Object} message - The stateful message containing user data
 * @returns {Object|null} User data object with userUUID, nickname, and avatarId, or null if not found
 */
function extractUserDataFromPatch ( message ) {
  const userDataPatch = message.statePatch.find( patch =>
    patch.op === 'add' &&
    patch.path.startsWith( '/allUserData/' )
  );

  if ( !userDataPatch ) {
    return null;
  }

  const nickname = userDataPatch.value?.userProfile?.nickname;
  const avatarId = userDataPatch.value?.userProfile?.avatarId;
  const userUUID = userDataPatch.path.split( '/' )[ 2 ]; // Extract UUID from path like /allUserData/uuid

  const userData = {
    userUUID,
    nickname,
    avatarId,
    userDataPatch
  };

  // DEBUG: Log the full patch value to see what fields are available
  if ( userDataPatch.value ) {
    const patchValueKeys = Object.keys( userDataPatch.value );
    const userProfileKeys = userDataPatch.value.userProfile ? Object.keys( userDataPatch.value.userProfile ) : [];
    console.log( `[extractUserDataFromPatch] Patch value keys: ${ patchValueKeys.join( ', ' ) }` );
    console.log( `[extractUserDataFromPatch] userProfile keys: ${ userProfileKeys.join( ', ' ) }` );
    console.log( `[extractUserDataFromPatch] Full patch value:`, JSON.stringify( userDataPatch.value, null, 2 ) );
  }

  return userData;
}

/**
 * Validates that required user data is present
 * @param {Object} userData - User data extracted from patch
 * @param {Object} services - Services container for logging
 * @returns {boolean} True if valid, false otherwise
 */
function validateUserData ( userData, services ) {
  if ( !userData.nickname ) {
    services.logger.warn( 'No nickname found in user data' );
    return false;
  }

  if ( !userData.userUUID ) {
    services.logger.warn( 'No user UUID found in patch path' );
    return false;
  }

  return true;
}

/**
 * Checks if a user is the bot itself
 * @param {Object} userData - User data extracted from patch
 * @param {Object} state - The bot's state containing currentUser if available
 * @param {Object} services - Services container for logging
 * @returns {boolean} True if user is the bot, false otherwise
 */
function isBot ( userData, state, services ) {
  services.logger?.debug?.( `[isBot] Checking userData: bot=${ userData.bot }, uuid=${ userData.userUUID }, nickname=${ userData.nickname }` );

  // For Wavez, check the bot flag directly (most reliable)
  if ( userData.bot === true ) {
    services.logger.debug( `[isBot] ✓ MATCHED: userData.bot === true` );
    services.logger.debug( `Skipping welcome message for bot user: ${ userData.userUUID } (nickname: ${ userData.nickname })` );
    return true;
  }

  // For Hang.fm, check the configured BOT_UID
  if ( services.config?.API_FRAMEWORK === 'hangfm' && services.config?.BOT_UID ) {
    services.logger?.debug?.( `[isBot] Checking Hang.fm BOT_UID: ${ services.config.BOT_UID } vs ${ userData.userUUID }` );
    if ( userData.userUUID === services.config.BOT_UID ) {
      services.logger.debug( `[isBot] ✓ MATCHED: userData.userUUID === BOT_UID` );
      services.logger.debug( `Skipping welcome message for bot user: ${ userData.userUUID } (nickname: ${ userData.nickname })` );
      return true;
    }
  }

  // Check by known bot nicknames
  const botNames = [ 'Mrs. Roboto', 'Mrs Roboto', 'MrsRoboto' ];
  if ( botNames.includes( userData.nickname ) ) {
    services.logger.debug( `[isBot] ✓ MATCHED: nickname matches bot names` );
    services.logger.debug( `Skipping welcome message for bot account: ${ userData.userUUID } (nickname: ${ userData.nickname })` );
    return true;
  }

  services.logger?.debug?.( `[isBot] ✗ NO MATCH - user is not a bot` );
  return false;
}

/**
 * Checks if the user should be welcomed (not a ghost user)
 * @param {Object} userData - User data extracted from patch
 * @param {Object} services - Services container for logging
 * @returns {boolean} True if user should be welcomed, false otherwise
 */
function shouldWelcomeUser ( userData, services ) {
  if ( userData.avatarId === 'ghost' ) {
    services.logger.debug( `Skipping welcome message for ghost user: ${ userData.userUUID } (nickname: ${ userData.nickname })` );
    return false;
  }

  return true;
}

/**
 * Initializes private message tracking for a new user
 * @param {string} userUUID - UUID of the user
 * @param {Object} services - Services container
 */
async function initializePrivateMessageTracking ( userUUID, services ) {
  if ( !services.bot || typeof services.bot.initializePrivateMessageTrackingForUser !== 'function' ) {
    services.logger.debug( 'Bot instance not available for private message tracking initialization' );
    return;
  }

  try {
    // Set timestamp to now to avoid processing messages sent while user was not in room
    await services.bot.initializePrivateMessageTrackingForUser( userUUID, true );
    services.logger.debug( `✅ Private message tracking initialized for new user: ${ userUUID } with timestamp set to now` );
  } catch ( error ) {
    services.logger.warn( `Failed to initialize private message tracking for user ${ userUUID }: ${ error.message }` );
  }
}

/**
 * Gets the hangout name with fallback
 * @param {Object} services - Services container
 * @returns {string} Hangout name or fallback
 */
function getHangoutName ( services ) {
  try {
    return services.stateService.getHangoutName();
  } catch ( error ) {
    services.logger.debug( 'Could not get hangout name from state service, using fallback' );
    return 'our Hangout';
  }
}

/**
 * Looks up a per-user personalized welcome message and picture from the database or JSON file (fallback).
 * Returns null if no custom data exists for this user.
 * @param {Object} userData - User data extracted from patch
 * @param {Object} services - Services container
 * @returns {Promise<{message: string, picture: string|null}|null>}
 */
async function getPersonalizedWelcome ( userData, services ) {
  // Safety check: don't return personalized welcome for the bot
  const botNames = [ 'Mrs. Roboto', 'Mrs Roboto', 'MrsRoboto' ];
  if ( botNames.includes( userData.nickname ) ) {
    services.logger?.debug?.( `Skipping personalized welcome for bot: ${ userData.nickname }` );
    return null;
  }

  try {
    // Try database first (cross-platform)
    if ( services.databaseService && services.databaseService.initialized ) {
      const framework = services.frameworkSpecification?.id || 'hang.fm';
      const welcomeData = services.databaseService.getPersonalizedWelcomeByUser( framework, userData.userUUID );

      if ( welcomeData && welcomeData.messages && welcomeData.messages.length > 0 ) {
        const randomMessage = welcomeData.messages[ Math.floor( Math.random() * welcomeData.messages.length ) ];

        // Format username as mention for the current platform
        const userMention = services.messageService?.formatMention
          ? await services.messageService.formatMention( userData.userUUID, services, userData.nickname )
          : userData.nickname;

        const tokenContext = {
          username: userMention
        };

        let processedMessage;
        if ( services.tokenService ) {
          processedMessage = await services.tokenService.replaceTokens( randomMessage, tokenContext, true );
        } else {
          processedMessage = randomMessage.replace( /\{username\}/g, tokenContext.username );
        }

        const randomPicture = welcomeData.pictures && welcomeData.pictures.length > 0
          ? welcomeData.pictures[ Math.floor( Math.random() * welcomeData.pictures.length ) ]
          : null;

        return { message: processedMessage, picture: randomPicture };
      }
    }

    // Fallback to JSON file for backward compatibility
    if ( !fs.existsSync( WELCOME_MESSAGES_PATH ) ) return null;
    const welcomeData = JSON.parse( fs.readFileSync( WELCOME_MESSAGES_PATH, 'utf8' ) );
    const entry = welcomeData[ userData.userUUID ];
    if ( !entry ) return null;

    const messages = ( entry.messages || [] ).filter( m => m );
    if ( messages.length === 0 ) return null;

    const randomMessage = messages[ Math.floor( Math.random() * messages.length ) ];

    // Format username as mention for the current platform
    const userMention = services.messageService?.formatMention
      ? await services.messageService.formatMention( userData.userUUID, services, userData.nickname )
      : userData.nickname;

    const tokenContext = {
      username: userMention
    };

    let processedMessage;
    if ( services.tokenService ) {
      processedMessage = await services.tokenService.replaceTokens( randomMessage, tokenContext, true );
    } else {
      processedMessage = randomMessage.replace( /\{username\}/g, tokenContext.username );
    }

    const pictures = ( entry.pictures || [] ).filter( p => p );
    const randomPicture = pictures.length > 0
      ? pictures[ Math.floor( Math.random() * pictures.length ) ]
      : null;

    return { message: processedMessage, picture: randomPicture };
  } catch ( error ) {
    services.logger.debug( `Could not load personalized welcome for ${ userData.userUUID }: ${ error.message }` );
    return null;
  }
}

/**
 * Creates and sends a personalized welcome message
 * @param {Object} userData - User data extracted from patch
 * @param {Object} services - Services container
 * @param {boolean} canSendFullMessage - Whether the full welcome is available (not on cooldown). If false, send simple "Welcome {username}"
 * @returns {boolean} True if a full welcome message was sent, false otherwise (personalized or simple)
 */
async function sendWelcomeMessage ( userData, services, canSendFullMessage = true ) {
  // Safety check: don't welcome the bot even if it somehow reaches here
  const botNames = [ 'Mrs. Roboto', 'Mrs Roboto', 'MrsRoboto' ];
  if ( botNames.includes( userData.nickname ) ) {
    services.logger?.debug?.( `Safety check: preventing welcome message for bot: ${ userData.nickname }` );
    return false;
  }

  // Check for per-user personalized welcome first (always sent if it exists, doesn't count toward full welcome cooldown)
  const personalized = await getPersonalizedWelcome( userData, services );
  if ( personalized ) {
    services.logger?.debug?.( `[sendWelcomeMessage] Found personalized welcome for ${ userData.nickname }` );
    // Always use adapter-aware response path (sendResponse routes through messagingAdapter)
    if ( typeof services.messageService?.sendResponse === 'function' ) {
      // Include picture URL in message if available (format depends on framework support)
      const messageWithPicture = personalized.picture
        ? `${ personalized.message }\n${ personalized.picture }`
        : personalized.message;
      await services.messageService.sendResponse( messageWithPicture, { responseChannel: 'public', services } );
      return false; // Personalized message sent, doesn't count toward full welcome cooldown
    }

    // Fallback for legacy systems without sendResponse (should not reach here in normal operation)
    if ( personalized.picture && typeof services.messageService?.sendGroupPictureMessage === 'function' ) {
      await services.messageService.sendGroupPictureMessage( personalized.message, personalized.picture, services );
      return false;
    }

    if ( typeof services.messageService?.sendGroupMessage === 'function' ) {
      await services.messageService.sendGroupMessage( personalized.message, { services } );
      return false;
    }
    return false;
  }

  // If no personalized welcome and canSendFullMessage is false, send simple greeting
  if ( !canSendFullMessage ) {
    const simpleMessage = `Welcome ${ userData.nickname }`;
    await services.messageService.sendResponse( simpleMessage, { responseChannel: 'public', services } );
    return false; // Simple message sent, doesn't count toward full welcome cooldown
  }

  // Get welcome message template from data service, fallback to default if not found
  let messageTemplate = services.dataService.getValue( 'editableMessages.welcomeMessage' );
  if ( !messageTemplate ) {
    // Fallback to old structure for backward compatibility
    messageTemplate = services.dataService.getValue( 'welcomeMessage' ) || "👋 Welcome to {hangoutName}, {username}!";
  }

  // Prepare context for token replacement with mention format for username
  const userMention = services.messageService?.formatMention
    ? await services.messageService.formatMention( userData.userUUID, services, userData.nickname )
    : userData.nickname;

  services.logger?.debug?.( `[sendWelcomeMessage] Token preparation:` );
  services.logger?.debug?.( `  - userData.userUUID: ${ userData.userUUID }` );
  services.logger?.debug?.( `  - userData.nickname: ${ userData.nickname }` );
  services.logger?.debug?.( `  - userMention (from formatMention): ${ userMention }` );

  const tokenContext = {
    username: userMention
  };

  services.logger?.debug?.( `[sendWelcomeMessage] About to replace tokens in template with username: ${ tokenContext.username }` );

  // Use TokenService if available for more comprehensive token replacement
  let personalizedMessage;
  if ( services.tokenService ) {
    personalizedMessage = await services.tokenService.replaceTokens( messageTemplate, tokenContext, true );
  } else {
    // Fallback to manual replacement for backward compatibility
    const hangoutName = getHangoutName( services );
    personalizedMessage = messageTemplate
      .replace( '{username}', tokenContext.username )
      .replace( '{hangoutName}', hangoutName );
  }

  // Send the full welcome message via the adapter-aware response layer
  await services.messageService.sendResponse( personalizedMessage, { responseChannel: 'public', services } );
  return true; // Full message sent, counts toward cooldown
}

/**
 * Handler for when a user joins the hangout
 * @param {Object} message - The stateful message containing user data
 * @param {Object} state - The current hangout state
 * @param {Object} services - Services container
 */
async function userJoined ( message, state, services ) {
  services.logger.debug( 'userJoined.js handler called' );

  try {
    // Check if state is available - during initial connection, state might not be set yet
    if ( !state || !services.stateService ) {
      services.logger.debug( 'State not available yet, skipping userJoined processing during initial connection' );
      return;
    }

    // Extract user data from the patch message
    const userData = extractUserDataFromPatch( message );
    if ( !userData ) {
      services.logger.debug( 'No user data patch found in userJoined message' );
      return;
    }

    // Validate required user data
    if ( !validateUserData( userData, services ) ) {
      return;
    }

    // Check if user is already in the room
    const allUserData = state.allUserData || {};
    const userAlreadyInRoom = allUserData[ userData.userUUID ];
    if ( userAlreadyInRoom ) {
      services.logger.debug(
        `[userJoined] Duplicate user_joined event for ${ userData.nickname } (${ userData.userUUID }) - already in room`
      );
    }

    // Upsert DJ in database (only if databaseService is available and initialized)
    if ( services.databaseService && services.databaseService.initialized ) {
      try {
        const result = services.databaseService.insertOrUpdateDjNickname( {
          uuid: userData.userUUID,
          nickname: userData.nickname
        } );
        if ( result.action === 'inserted' ) {
          services.logger.debug( `Inserted new DJ in database: ${ userData.userUUID } (${ userData.nickname })` );
        } else if ( result.action === 'updated' ) {
          services.logger.debug( `Updated DJ nickname in database: ${ userData.userUUID } (${ result.oldNickname } → ${ result.newNickname })` );
        }
      } catch ( err ) {
        services.logger.error( `Failed to upsert DJ in database: ${ err.message }` );
      }
    }

    // Initialize private message tracking for the new user
    await initializePrivateMessageTracking( userData.userUUID, services );

    // Track user in AFK monitor
    if ( services.afkService ) {
      services.afkService.addUser( userData.userUUID, userData.nickname );
      services.afkService.recordActivity( userData.userUUID, 'joinedRoom' );
    }

    // Check if user should be welcomed (skip ghost users)
    if ( !shouldWelcomeUser( userData, services ) ) {
      return;
    }

    // Skip welcome message for the bot itself
    services.logger?.debug?.( `[userJoined] About to check isBot. userData keys: ${ Object.keys( userData ).join( ', ' ) }` );
    services.logger?.debug?.( `[userJoined] userData.bot = ${ userData.bot }` );
    if ( isBot( userData, state, services ) ) {
      return;
    }

    // Check if welcome message feature is enabled
    if ( !services.featuresService.isFeatureEnabled( 'welcomeMessage' ) ) {
      services.logger.debug( 'Welcome message feature is disabled, skipping welcome message' );
      return;
    }

    // Check if user is on welcome cooldown (10 minutes per user per hangout)
    const hangoutName = getHangoutName( services );
    if ( isOnWelcomeCooldown( userData.userUUID, hangoutName ) ) {
      services.logger.debug( `User ${ userData.nickname } (${ userData.userUUID }) is on welcome cooldown, skipping welcome message` );
      return;
    }

    // Check if full welcome message can be sent (2-minute cooldown per hangout, only for non-personalized welcomes)
    const canSendFullMessage = canSendFullWelcome( hangoutName );
    if ( !canSendFullMessage ) {
      services.logger.debug( `Full welcome message on cooldown for ${ hangoutName }, sending simple greeting instead` );
    }

    // Send welcome message and check if it was a full welcome (true) or personalized/simple (false)
    const wasFullWelcomeSent = await sendWelcomeMessage( userData, services, canSendFullMessage );

    // Record this welcome for cooldown tracking
    recordWelcome( userData.userUUID, hangoutName );

    // Record full welcome cooldown only if a full message was actually sent (not for personalized or simple)
    if ( wasFullWelcomeSent ) {
      recordFullWelcome( hangoutName );
    }

  } catch ( error ) {
    services.logger.error( `Error processing userJoined message: ${ error.message }` );
  }
}

/**
 * Normalized handler for userJoined events (works with both Hang and Wavez)
 * Sends welcome messages and handles user setup via normalized event payloads
 * @param {Object} event - Normalized userJoined event with payload.userId and payload.user
 * @param {Object} context - Context object with services and bot
 */
async function handleUserJoinedEvent ( event, context ) {
  const userId = event.payload?.userId;
  const userObj = event.payload?.user;
  const services = context.services;

  if ( !userId || !services ) {
    services?.logger?.debug?.( 'handleUserJoinedEvent: missing userId or services' );
    return;
  }

  // Skip if this is a bot joining (check bot flag in event payload)
  if ( event.payload?.bot === true ) {
    services.logger?.debug?.( `handleUserJoinedEvent: skipping bot user (userId=${ userId })` );
    return;
  }

  try {
    // Get full user data from stateService if not already in event payload
    let user = userObj;
    services.logger?.debug?.( `[handleUserJoinedEvent] User retrieval:` );
    services.logger?.debug?.( `  - userObj from event.payload.user: ${ userObj ? 'present' : 'missing' }` );
    if ( userObj ) {
      services.logger?.debug?.( `    - userObj.nickname: ${ userObj.nickname }` );
      services.logger?.debug?.( `    - userObj.id: ${ userObj.id }` );
    }

    if ( !user || !user.nickname ) {
      services.logger?.debug?.( `  - userObj missing/incomplete, fetching from stateService.getUser(${ userId })` );
      user = services.stateService?.getUser?.( userId );
      if ( user ) {
        services.logger?.debug?.( `    - Retrieved user.nickname: ${ user.nickname }` );
        services.logger?.debug?.( `    - Retrieved user.id: ${ user.id }` );
      } else {
        services.logger?.debug?.( `    - stateService.getUser returned null/undefined` );
      }
    }

    // If still no user data, try fetching from API
    if ( !user || !user.nickname ) {
      services.logger?.debug?.( `  - No user data in state, attempting API lookup for userId=${ userId }` );
      try {
        if ( services.apiAdapter?.getUserProfile ) {
          const apiUser = await services.apiAdapter.getUserProfile( userId );
          if ( apiUser ) {
            services.logger?.debug?.( `    - API returned user: nickname=${ apiUser.nickname || 'missing' }` );
            user = apiUser;
          } else {
            services.logger?.debug?.( `    - API returned null/undefined` );
          }
        } else {
          services.logger?.debug?.( `    - apiAdapter.getUserProfile not available` );
        }
      } catch ( err ) {
        services.logger?.error?.( `Failed to fetch user from API: ${ err.message }` );
      }
    }

    if ( !user || !user.nickname ) {
      services.logger?.debug?.( `handleUserJoinedEvent: no user data found for ${ userId } (not in state, not in API)` );
      return;
    }

    // Track user in AFK monitor
    if ( services.afkService ) {
      services.afkService.addUser( userId, user.nickname );
      services.afkService.recordActivity( userId, 'joinedRoom' );
    }

    // Upsert DJ in database (only if databaseService is available and initialized)
    if ( services.databaseService && services.databaseService.initialized ) {
      try {
        const result = services.databaseService.insertOrUpdateDjNickname( {
          uuid: userId,
          nickname: user.nickname
        } );
        if ( result.action === 'inserted' ) {
          services.logger?.debug?.( `Inserted new DJ in database: ${ userId } (${ user.nickname })` );
        } else if ( result.action === 'updated' ) {
          services.logger?.debug?.( `Updated DJ nickname in database: ${ userId } (${ result.oldNickname } → ${ result.newNickname })` );
        }
      } catch ( err ) {
        services.logger?.error?.( `Failed to upsert DJ in database: ${ err.message }` );
      }
    }

    // Initialize private message tracking for the new user
    if ( services.bot && typeof services.bot.initializePrivateMessageTrackingForUser === 'function' ) {
      try {
        await services.bot.initializePrivateMessageTrackingForUser( userId, true );
        services.logger?.debug?.( `✅ Private message tracking initialized for new user: ${ userId } with timestamp set to now` );
      } catch ( error ) {
        services.logger?.warn?.( `Failed to initialize private message tracking for user ${ userId }: ${ error.message }` );
      }
    }

    // Check if user should be welcomed (skip ghost users)
    if ( user.profile?.avatarId === 'ghost' ) {
      services.logger?.debug?.( `Skipping welcome message for ghost user: ${ userId } (nickname: ${ user.nickname })` );
      return;
    }

    // Skip welcome message for the bot itself
    services.logger?.debug?.( `[handleUserJoinedEvent] Bot detection checks:` );
    services.logger?.debug?.( `  - userId: ${ userId }` );
    services.logger?.debug?.( `  - user.nickname: ${ user.nickname }` );
    services.logger?.debug?.( `  - event.payload?.bot: ${ event.payload?.bot }` );
    services.logger?.debug?.( `  - API_FRAMEWORK: ${ services.config?.API_FRAMEWORK }` );
    services.logger?.debug?.( `  - BOT_UID: ${ services.config?.BOT_UID }` );

    const state = services.stateService?._getCurrentState?.();
    services.logger?.debug?.( `  - currentUser.id: ${ state?.currentUser?.id }` );
    services.logger?.debug?.( `  - metadata.bot.id: ${ state?.metadata?.bot?.id }` );

    const botNames = [ 'Mrs. Roboto', 'Mrs Roboto', 'MrsRoboto' ];

    // Check bot flag first (most reliable for Wavez)
    if ( event.payload?.bot === true ) {
      services.logger?.debug?.( `[handleUserJoinedEvent] ✓ MATCHED: event.payload.bot === true` );
      services.logger?.debug?.( `Skipping welcome message for bot user: ${ userId } (nickname: ${ user.nickname })` );
      return;
    }

    // For Hang.fm, check the configured BOT_UID
    if ( services.config?.API_FRAMEWORK === 'hangfm' && services.config?.BOT_UID === userId ) {
      services.logger?.debug?.( `[handleUserJoinedEvent] ✓ MATCHED: BOT_UID check` );
      services.logger?.debug?.( `Skipping welcome message for bot user: ${ userId } (nickname: ${ user.nickname })` );
      return;
    }

    // Check by known bot nicknames
    if ( botNames.includes( user.nickname ) ) {
      services.logger?.debug?.( `[handleUserJoinedEvent] ✓ MATCHED: nickname in botNames` );
      services.logger?.debug?.( `Skipping welcome message for bot account: ${ userId } (nickname: ${ user.nickname })` );
      return;
    }

    services.logger?.debug?.( `[handleUserJoinedEvent] ✗ NO MATCH - proceeding with welcome` );

    // Check if welcome message feature is enabled
    if ( !services.featuresService?.isFeatureEnabled?.( 'welcomeMessage' ) ) {
      services.logger?.debug?.( 'Welcome message feature is disabled, skipping welcome message' );
      return;
    }

    // Check if user is on welcome cooldown (10 minutes per user per hangout)
    const hangoutName = services.stateService?.getHangoutName?.() || 'Hangout';
    if ( isOnWelcomeCooldown( userId, hangoutName ) ) {
      services.logger?.debug?.( `User ${ user.nickname } (${ userId }) is on welcome cooldown, skipping welcome message` );
      return;
    }

    // Check if full welcome message can be sent (2-minute cooldown per hangout, only for non-personalized welcomes)
    const canSendFullMessage = canSendFullWelcome( hangoutName );
    if ( !canSendFullMessage ) {
      services.logger?.debug?.( `Full welcome message on cooldown for ${ hangoutName }, sending simple greeting instead` );
    }

    // Send welcome message and check if it was a full welcome (true) or personalized/simple (false)
    services.logger?.debug?.( `Sending welcome for userId=${ userId }, nickname=${ user.nickname }` );
    const wasFullWelcomeSent = await sendWelcomeMessage( { userUUID: userId, nickname: user.nickname, avatarId: user.profile?.avatarId }, services, canSendFullMessage );

    // Record this welcome for cooldown tracking
    recordWelcome( userId, hangoutName );

    // Record full welcome cooldown only if a full message was actually sent (not for personalized or simple)
    if ( wasFullWelcomeSent ) {
      recordFullWelcome( hangoutName );
    }

  } catch ( error ) {
    services?.logger?.error?.( `[handleUserJoinedEvent] Error: ${ error.message }` );
  }
}

module.exports = userJoined;
module.exports.handleUserJoinedEvent = handleUserJoinedEvent;
module.exports._resetWelcomeCooldowns = () => {
  welcomeCooldowns.clear();
  fullWelcomeCooldowns.clear();
};
