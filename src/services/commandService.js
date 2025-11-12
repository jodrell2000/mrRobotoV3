const { logger } = require( '../lib/logging.js' );
const config = require( '../config.js' );
const fs = require( 'fs' );
const path = require( 'path' );
const { hasPermission } = require( '../lib/roleUtils' );

/**
 * Check if a command is disabled in botConfig.json
 * @param {string} commandName - The command name to check
 * @returns {boolean} True if command is disabled, false if enabled
 */
function isCommandDisabled ( commandName ) {
  try {
    const dataPath = path.join( __dirname, '../../data/botConfig.json' );
    const data = JSON.parse( fs.readFileSync( dataPath, 'utf8' ) );
    return Array.isArray( data.disabledCommands ) && data.disabledCommands.includes( commandName );
  } catch ( error ) {
    logger.warn( `Failed to read disabled commands from botConfig.json: ${ error.message }` );
    return false; // Default to enabled if we can't read the file
  }
}

/**
 * Recursively loads command files from directories
 * @param {string} dirPath - Directory path to scan
 * @param {Object} commands - Commands object to populate
 */
function loadCommandsFromDirectory ( dirPath, commands ) {
  const items = fs.readdirSync( dirPath );

  items.forEach( item => {
    const itemPath = path.join( dirPath, item );
    let stats;
    try {
      stats = fs.statSync( itemPath );
    } catch ( error ) {
      // Skip items that can't be accessed
      return;
    }

    if ( stats.isDirectory() ) {
      // Recursively load commands from subdirectory
      loadCommandsFromDirectory( itemPath, commands );
    } else if ( item.endsWith( '.js' ) ) {
      // Extract command name from filename: handleStateCommand.js -> state
      const match = item.match( /^handle(.*)Command\.js$/ );
      if ( match && match[ 1 ] ) {
        const commandName = match[ 1 ].toLowerCase();
        try {
          commands[ commandName ] = require( itemPath );
        } catch ( error ) {
          logger.warn( `Failed to load command ${ commandName }: ${ error.message }` );
        }
      }
      // Also support handleUnknownCommand.js as 'unknown'
      if ( item === 'handleUnknownCommand.js' ) {
        try {
          commands[ 'unknown' ] = require( itemPath );
        } catch ( error ) {
          logger.warn( `Failed to load unknown command handler: ${ error.message }` );
        }
      }
    }
  } );
}

/**
 * Loads chat command names from data/chat.json
 * @returns {string[]} Array of chat command names (root keys in chat.json)
 */
function loadChatCommands () {
  try {
    const chatPath = path.join( __dirname, '../../data/chat.json' );
    if ( !fs.existsSync( chatPath ) ) return [];
    const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );
    if ( chatData && typeof chatData === 'object' ) {
      return Object.keys( chatData );
    }
    return [];
  } catch ( error ) {
    logger.warn( `Failed to load chat commands from chat.json: ${ error.message }` );
    return [];
  }
}

/**
 * Loads chat command aliases from data/aliases.json
 * @returns {string[]} Array of alias names (root keys in aliases.json)
 */
function loadChatCommandAliases () {
  try {
    const aliasesPath = path.join( __dirname, '../../data/aliases.json' );
    if ( !fs.existsSync( aliasesPath ) ) return [];
    const aliasesData = JSON.parse( fs.readFileSync( aliasesPath, 'utf8' ) );
    if ( aliasesData && typeof aliasesData === 'object' ) {
      return Object.keys( aliasesData );
    }
    return [];
  } catch ( error ) {
    logger.warn( `Failed to load chat command aliases from aliases.json: ${ error.message }` );
    return [];
  }
}

// Dynamically load all command handlers from src/commands
const commands = {};
const commandsDir = path.join( __dirname, '../commands' );
loadCommandsFromDirectory( commandsDir, commands );

/**
 * Processes bot commands and generates appropriate responses
 * @param {string} command - The command name (without the command switch)
 * @param {string} messageRemainder - The rest of the message after the command
 * @param {Object} services - Required services container with messageService, etc.
 * @param {Object} context - Additional context (sender, fullMessage, etc.)
 * @returns {Promise<Object>} Result object with success status and response
 */
async function processCommand ( command, messageRemainder, services, context = {} ) {
  // Use the provided services directly - they should be complete
  const serviceContainer = services;

  try {
    const trimmedCommand = command.trim().toLowerCase();
    const args = messageRemainder.trim();

    logger.debug( `[commandService] Processing command: "${ trimmedCommand }" with args: "${ args }"` );

    // Create standardized commandParams object that all commands will receive
    const commandParams = {
      command: trimmedCommand,      // The command name
      args: args,                   // Command arguments (everything after the command)
      services: serviceContainer,   // Pass the complete services container
      context,                      // Context object with sender info etc.
      responseChannel: 'request'    // Default response channel
    };

    // Handle 'unknown' command specifically - it should always use the unknown handler
    if ( trimmedCommand === 'unknown' ) {
      return await commands.unknown( commandParams );
    }

    // Check if it's a main command first
    if ( commands[ trimmedCommand ] ) {
      // It's a main command, check if it's disabled
      if ( isCommandDisabled( trimmedCommand ) ) {
        const response = `❌ The "${ trimmedCommand }" command is currently disabled.`;
        await serviceContainer.messageService.sendResponse( response, {
          responseChannel: 'request',
          isPrivateMessage: context?.fullMessage?.isPrivateMessage,
          sender: context?.sender,
          services: serviceContainer
        } );
        return {
          success: false,
          error: 'Command disabled',
          response,
          shouldRespond: true
        };
      }

      // Check user's role and command permissions
      const senderUuid = typeof context.sender === 'string' ? context.sender : context.sender?.uuid;
      const userRole = await serviceContainer.stateService.getUserRole( senderUuid );
      const commandLevel = commands[ trimmedCommand ].requiredRole || 'USER';

      if ( !hasPermission( userRole, commandLevel ) ) {
        const response = `❌ You don't have permission to use the "${ trimmedCommand }" command. Required role: ${ commandLevel }`;
        await serviceContainer.messageService.sendResponse( response, {
          responseChannel: 'request',
          isPrivateMessage: context?.fullMessage?.isPrivateMessage,
          sender: context?.sender,
          services: serviceContainer
        } );
        return {
          success: false,
          error: 'Insufficient permissions',
          response,
          shouldRespond: true
        };
      }

      // Execute the main command
      return await commands[ trimmedCommand ]( commandParams );
    } else {
      // Not a main command, check if it's a chat command or alias
      const chatCommands = loadChatCommands();
      const chatAliases = loadChatCommandAliases();

      let targetCommand = trimmedCommand;
      let isChatCommand = false;

      // Check if it's a chat command
      if ( chatCommands.includes( trimmedCommand ) ) {
        isChatCommand = true;
      } else if ( chatAliases.includes( trimmedCommand ) ) {
        // Check if it's an alias for a chat command
        try {
          const aliasesPath = path.join( __dirname, '../../data/aliases.json' );
          const aliasesData = JSON.parse( fs.readFileSync( aliasesPath, 'utf8' ) );
          const aliasTarget = aliasesData[ trimmedCommand ]?.command;

          if ( aliasTarget && chatCommands.includes( aliasTarget ) ) {
            targetCommand = aliasTarget;
            isChatCommand = true;
          }
        } catch ( error ) {
          logger.warn( `Failed to resolve alias '${ trimmedCommand }': ${ error.message }` );
        }
      }

      if ( isChatCommand ) {
        // Handle as chat command - all chat commands have USER permission
        return await commands.chat( targetCommand, args, serviceContainer, context );
      }

      // Not a chat command or alias, treat as unknown
      return await commands.unknown( commandParams );
    }
  } catch ( error ) {
    const errorMessage = error && typeof error === 'object'
      ? ( error.message || error.toString() || 'Unknown error object' )
      : ( error || 'Unknown error' );
    logger.error( `Failed to process command "${ command }": ${ errorMessage }` );

    // If error is specifically about unknown command, respond to user
    const isUnknownCommand = ( errorMessage === 'Unknown command' ) || ( error && error.error === 'Unknown command' );
    if ( isUnknownCommand ) {
      const response = `❓ Unknown command: "${ command }". Type ${ config.COMMAND_SWITCH }help for available commands.`;
      await serviceContainer.messageService.sendResponse( response, {
        responseChannel: 'request',
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services: serviceContainer
      } );
      return {
        success: false,
        error: 'Unknown command',
        response,
        shouldRespond: true
      };
    } else {
      // For other errors (network, string, etc.), do not respond to user
      return {
        success: false,
        error: errorMessage,
        shouldRespond: false
      };
    }
  }
}

module.exports = processCommand;
