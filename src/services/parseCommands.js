const { logger } = require( '../lib/logging.js' );
const config = require( '../config.js' );

/**
 * Asynchronously processes a single command
 * @param {string} commandText - The command string to process
 * @param {Object} services - Required services container with logger and config
 * @returns {Promise<Object|boolean>} Object with command details if command found, false otherwise
 */
async function parseCommand ( commandText, services ) {
  const logger = services.logger;
  const config = services.config;

  // Validate input
  if ( typeof commandText !== 'string' || !commandText.trim().length ) {
    logger.warn( `Invalid command format (not a string or empty): ${ commandText }` );
    return Promise.resolve( false );
  }

  try {
    const trimmedCommand = commandText.trim();
    // logger.debug( `[parseCommand] Processing message: ${ trimmedCommand }` );

    // Check if the command starts with the command switch
    if ( !trimmedCommand.startsWith( config.COMMAND_SWITCH ) ) {
      return Promise.resolve( false );
    }

    // Extract the command name and remainder
    const commandPart = trimmedCommand.slice( config.COMMAND_SWITCH.length ).trim();
    const spaceIndex = commandPart.indexOf( ' ' );

    let command, remainder;
    if ( spaceIndex === -1 ) {
      // No space found, entire string is the command
      command = commandPart;
      remainder = '';
    } else {
      // Split at first space
      command = commandPart.substring( 0, spaceIndex );
      remainder = commandPart.substring( spaceIndex + 1 );
    }

    logger.debug( `[parseCommand] Command detected: "${ command }", remainder: "${ remainder }"` );

    return Promise.resolve( {
      isCommand: true,
      command: command.toLowerCase(),
      remainder: remainder.trim(),
      originalText: trimmedCommand
    } );

  } catch ( error ) {
    const errorMessage = error && typeof error === 'object'
      ? ( error.message || error.toString() || 'Unknown error object' )
      : ( error || 'Unknown error' );

    logger.error( `Failed to process command: ${ errorMessage }` );
    return Promise.resolve( false );
  }
}

module.exports = parseCommand;
