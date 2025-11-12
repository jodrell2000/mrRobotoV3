const { logger } = require( '../lib/logging.js' );
const fs = require( 'fs' );
const path = require( 'path' );

/**
 * Handles dynamic commands loaded from chat.json
 * @param {string} command - The command name
 * @param {string} args - Command arguments (unused)
 * @param {Object} services - Service container
 * @param {Object} context - Context including sender info
 * @returns {Promise<Object>} Response object
 */
async function handleDynamicCommand ( command, args, services, context ) {
  try {
    // Load dynamic command data
    const chatPath = path.join( __dirname, '../../data/chat.json' );
    
    let chatData;
    try {
      chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );
    } catch ( error ) {
      if ( error.code === 'ENOENT' ) {
        return {
          success: false,
          shouldRespond: true,
          response: 'Command not found'
        };
      }
      return {
        success: false,
        shouldRespond: true,
        response: 'Error loading command data'
      };
    }

    const commandData = chatData[ command ];

    if ( !commandData ) {
      return {
        success: false,
        shouldRespond: true,
        response: 'Command not found'
      };
    }

    // Select a random message from the command's messages array
    const messages = commandData.messages || [];
    if ( messages.length === 0 ) {
      return {
        success: false,
        shouldRespond: true,
        response: 'No messages available for this command'
      };
    }

    // Get a random message
    const randomMessage = messages[ Math.floor( Math.random() * messages.length ) ];

    // Use tokenService to replace tokens in the message
    let processedMessage = randomMessage;
    if ( services.tokenService ) {
      processedMessage = await services.tokenService.replaceTokens( randomMessage, context );
    }

    // Get a random picture from the command's pictures array (if available)
    const pictures = commandData.pictures || [];
    // Filter out null/undefined values from pictures array
    const validPictures = pictures.filter( pic => pic !== null && pic !== undefined );
    const randomPicture = validPictures.length > 0
      ? validPictures[ Math.floor( Math.random() * validPictures.length ) ]
      : null;

    // Send the processed message to public chat with optional image
    if ( randomPicture ) {
      // Send with image using sendGroupPictureMessage
      await services.messageService.sendGroupPictureMessage( processedMessage, randomPicture, services );
    } else {
      // Send text-only message
      await services.messageService.sendResponse( processedMessage, {
        responseChannel: 'publicChat',
        isPrivateMessage: false,
        sender: context?.sender,
        services
      } );
    }

    return {
      success: true,
      shouldRespond: true,
      response: processedMessage
    };

  } catch ( error ) {
    logger.error( `Error processing dynamic command '${ command }': ${ error.message }` );
    return {
      success: false,
      shouldRespond: true,
      error: error.message
    };
  }
}

// Set metadata for the command
handleDynamicCommand.requiredRole = 'USER';
handleDynamicCommand.description = 'Execute dynamic command from chat.json';
handleDynamicCommand.example = 'props';
handleDynamicCommand.hidden = true;

module.exports = handleDynamicCommand;