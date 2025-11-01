
const config = require( '../config.js' );

// Set required role level for this command
const requiredRole = 'USER';
const description = '';
const hidden = true;
const enabled = true; // Always enabled to handle unknown commands

/**

/**
 * Handles unknown commands with a simple fallback message.
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleUnknownCommand ( commandParams ) {
  const { command, services, context, responseChannel = 'request' } = commandParams;
  const { messageService } = services;

  const response = `❓ Unknown command: "${ command }". Type ${ config.COMMAND_SWITCH }help for available commands.`;
  await messageService.sendResponse( response, {
    responseChannel,
    isPrivateMessage: context?.fullMessage?.isPrivateMessage,
    sender: context?.sender,
    services
  } );
  return {
    success: false,
    response,
    shouldRespond: true,
    error: 'Unknown command'
  };
}

// Attach metadata to the function

handleUnknownCommand.requiredRole = requiredRole;
handleUnknownCommand.description = description;
handleUnknownCommand.hidden = hidden;

module.exports = handleUnknownCommand;
