// Set required role level for this command
const requiredRole = 'USER';
const description = 'Echo back your message';
const example = 'echo Hello everyone!';
const hidden = false;

/**
 * Echoes a message back to the chat
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleEchoCommand ( commandParams ) {
  const { args, services, context, responseChannel = 'public' } = commandParams;
  const { messageService } = services;

  // Force responseChannel to 'public' for echo command
  const actualResponseChannel = 'public';

  if ( !args.trim() ) {
    const response = '❓ Echo what? Please provide a message to echo.';
    await messageService.sendResponse( response, {
      responseChannel: actualResponseChannel,
      isPrivateMessage: context?.fullMessage?.isPrivateMessage,
      sender: context?.sender,
      services
    } );
    return {
      success: false,
      response,
      shouldRespond: true
    };
  }

  const senderUuid = context && typeof context.sender === 'string' && context.sender.trim().length
    ? context.sender
    : null;

  const senderMention = services.frameworkSpecification?.formatters
    ? messageService.formatMention( senderUuid, services )
    : messageService.formatMention( senderUuid );
  const response = `🔊 Echo: ${ args } (from ${ senderMention })`;
  await messageService.sendResponse( response, {
    responseChannel: actualResponseChannel,
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
handleEchoCommand.requiredRole = requiredRole;
handleEchoCommand.description = description;
handleEchoCommand.example = example;
handleEchoCommand.hidden = hidden;

module.exports = handleEchoCommand;
