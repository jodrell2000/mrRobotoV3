const { logger } = require( '../../lib/logging.js' );
const fs = require( 'fs' ).promises;
const path = require( 'path' );

// Set required role level for this command
const requiredRole = 'OWNER';
const description = 'Change the bot name';
const example = 'changebotname MyAwesomeBot';
const hidden = false;

/**
 * Changes the bot's nickname and updates all related configurations
 * @param {Object} commandParams Standard command parameters
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleChangebotnameCommand ( commandParams ) {
  const { args, services, context, responseChannel = 'request' } = commandParams;

  if ( !args ) {
    const response = '❌ Please provide a new name for the bot.';
    await services.messageService.sendResponse( response, {
      responseChannel,
      isPrivateMessage: context?.fullMessage?.isPrivateMessage,
      sender: context?.sender,
      services
    } );
    return {
      success: false,
      shouldRespond: true,
      response
    };
  }

  try {
    // 1. Update the nickname in TT.fm
    await services.hangUserService.updateHangNickname( services, args );

    // 2. Update CHAT_NAME in the data service (this will also update the file)
    await services.dataService.setValue( 'botData.CHAT_NAME', args );

    const response = `✅ Bot name successfully changed to: ${ args }`;
    await services.messageService.sendResponse( response, {
      responseChannel,
      isPrivateMessage: context?.fullMessage?.isPrivateMessage,
      sender: context?.sender,
      services
    } );

    return {
      success: true,
      shouldRespond: true,
      response
    };

  } catch ( error ) {
    const errorMsg = `❌ Failed to change bot name: ${ error.message }`;
    logger.error( `Error in changeBotName command: ${ error.message }` );
    await services.messageService.sendResponse( errorMsg, {
      responseChannel,
      isPrivateMessage: context?.fullMessage?.isPrivateMessage,
      sender: context?.sender,
      services
    } );

    return {
      success: false,
      shouldRespond: true,
      error: error.message,
      response: errorMsg
    };
  }
}

// Attach metadata to the function
handleChangebotnameCommand.requiredRole = requiredRole;
handleChangebotnameCommand.description = description;
handleChangebotnameCommand.example = example;
handleChangebotnameCommand.hidden = hidden;

module.exports = handleChangebotnameCommand;
