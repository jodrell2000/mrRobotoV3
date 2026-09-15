// Set the required permission level
const requiredRole = 'USER';
const description = 'Check if bot is responding';
const example = 'ping';
const hidden = false;

/**
 * Checks if the bot is responding
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handlePingCommand ( commandParams ) {
  const { services, context, responseChannel = 'request' } = commandParams;
  const { messageService, config } = services;
  const botMention = services.frameworkSpecification?.formatters
    ? messageService.formatMention( config.BOT_UID, services )
    : messageService.formatMention( config.BOT_UID );
  const response = `🏓 Pong! ${ botMention } is alive and responding.`;
  await messageService.sendResponse( response, {
    responseChannel,
    isPrivateMessage: context?.fullMessage?.isPrivateMessage,
    sender: context?.sender,
    services
  } );
  return {
    success: true,
    response,
    shouldRespond: true
  };
}

// Attach metadata to the function
handlePingCommand.requiredRole = requiredRole;
handlePingCommand.description = description;
handlePingCommand.example = example;
handlePingCommand.hidden = hidden;

module.exports = handlePingCommand;
