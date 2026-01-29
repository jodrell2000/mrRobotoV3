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

  return {
    userUUID,
    nickname,
    avatarId,
    userDataPatch
  };
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
 * Creates and sends a personalized welcome message
 * @param {Object} userData - User data extracted from patch
 * @param {Object} services - Services container
 */
async function sendWelcomeMessage ( userData, services ) {
  // Get welcome message template from data service, fallback to default if not found
  services.logger.debug( 'Getting welcome message from dataService...' );
  let messageTemplate = services.dataService.getValue( 'editableMessages.welcomeMessage' );
  if ( !messageTemplate ) {
    // Fallback to old structure for backward compatibility
    messageTemplate = services.dataService.getValue( 'welcomeMessage' ) || "👋 Welcome to {hangoutName}, {username}!";
  }
  services.logger.debug( `Retrieved welcome message template: ${ messageTemplate }` );

  // Prepare context for token replacement
  const tokenContext = {
    username: services.messageService.formatMention( userData.userUUID )
  };

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

  services.logger.debug( `Sending personalized welcome message: ${ personalizedMessage }` );

  // Send the personalized welcome message
  await services.messageService.sendGroupMessage( personalizedMessage, { services } );

  services.logger.debug( `✅ Welcome message sent for user: ${ userData.userUUID }` );
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

    // Upsert DJ in database (only if databaseService is available and initialized)
    if (services.databaseService && services.databaseService.initialized) {
      try {
        const result = services.databaseService.insertOrUpdateDjNickname({
          uuid: userData.userUUID,
          nickname: userData.nickname
        });
        if (result.action === 'inserted') {
          services.logger.debug(`Inserted new DJ in database: ${userData.userUUID} (${userData.nickname})`);
        } else if (result.action === 'updated') {
          services.logger.debug(`Updated DJ nickname in database: ${userData.userUUID} (${result.oldNickname} → ${result.newNickname})`);
        }
      } catch (err) {
        services.logger.error(`Failed to upsert DJ in database: ${err.message}`);
      }
    }

    // Initialize private message tracking for the new user
    await initializePrivateMessageTracking( userData.userUUID, services );

    // Check if user should be welcomed (skip ghost users)
    if ( !shouldWelcomeUser( userData, services ) ) {
      return;
    }

    // Check if welcome message feature is enabled
    if ( !services.featuresService.isFeatureEnabled( 'welcomeMessage' ) ) {
      services.logger.debug( 'Welcome message feature is disabled, skipping welcome message' );
      return;
    }

    // Send welcome message
    await sendWelcomeMessage( userData, services );

  } catch ( error ) {
    services.logger.error( `Error processing userJoined message: ${ error.message }` );
  }
}

module.exports = userJoined;
