const config = require( '../../config.js' );
const fs = require( 'fs' );
const path = require( 'path' );

// Set required role level for this command
const requiredRole = 'USER';
const description = 'Show this help message';
const example = 'help [command]';
const hidden = false;

/**
 * Check if a command is disabled in botConfig.json
 * @param {string} commandName - The command name to check
 * @returns {boolean} True if command is disabled, false if enabled
 */
function isCommandDisabled ( commandName ) {
  try {
    const dataPath = path.join( __dirname, '../../../data/botConfig.json' );
    const data = JSON.parse( fs.readFileSync( dataPath, 'utf8' ) );
    return Array.isArray( data.disabledCommands ) && data.disabledCommands.includes( commandName );
  } catch ( error ) {
    return false; // Default to enabled if we can't read the file
  }
}

/**
 * Loads commands from a specific directory
 * @param {string} dirPath - Directory path to scan
 * @param {string} folderName - Name of the folder (for grouping)
 * @param {Object} commandsByFolder - Object to populate with commands grouped by folder
 */
function loadCommandsFromSpecificDirectory ( dirPath, folderName, commandsByFolder ) {
  let items;
  try {
    items = fs.readdirSync( dirPath );
  } catch ( error ) {
    // Skip directories that can't be accessed
    return;
  }

  items.forEach( item => {
    if ( item.endsWith( '.js' ) ) {
      // Extract command name from filename: handleStateCommand.js -> state
      const match = item.match( /^handle(.*)Command\.js$/ );
      if ( match && match[ 1 ] ) {
        const commandName = match[ 1 ].toLowerCase();

        try {
          const commandModule = require( path.join( dirPath, item ) );

          // Skip commands that are hidden, disabled, or don't have required metadata
          if ( !commandModule.hidden &&
            !isCommandDisabled( commandName ) &&
            commandModule.requiredRole &&
            commandModule.description ) {

            // Initialize folder array if it doesn't exist
            if ( !commandsByFolder[ folderName ] ) {
              commandsByFolder[ folderName ] = [];
            }

            commandsByFolder[ folderName ].push( {
              name: commandName,
              role: commandModule.requiredRole,
              description: commandModule.description,
              example: commandModule.example || commandName,
              hidden: commandModule.hidden || false
            } );
          }
        } catch ( error ) {
          // Skip commands that can't be loaded
          console.warn( `Failed to load command ${ commandName }: ${ error.message }` );
        }
      }
    }
  } );
}

/**
 * Dynamically loads all available commands and their metadata organized by folder
 * @returns {Object} Commands organized by folder
 */
function loadAvailableCommands () {
  const commandsByFolder = {};
  const baseDir = path.join( __dirname, '../../commands' );

  // Define static folder structure
  const folders = [
    { path: 'Bot Commands', name: 'Bot Commands' },
    { path: 'Debug Commands', name: 'Debug Commands' },
    { path: 'Edit Commands', name: 'Edit Commands' },
    { path: 'General Commands', name: 'General Commands' },
    { path: 'ML Commands', name: 'ML Commands' }
  ];

  // Load commands from each defined folder
  folders.forEach( folder => {
    const folderPath = path.join( baseDir, folder.path );
    loadCommandsFromSpecificDirectory( folderPath, folder.name, commandsByFolder );
  } );

  // Load commands from root directory (like handleUnknownCommand.js)
  loadCommandsFromSpecificDirectory( baseDir, 'Other Commands', commandsByFolder );

  // Sort commands within each folder alphabetically
  Object.keys( commandsByFolder ).forEach( folder => {
    commandsByFolder[ folder ].sort( ( a, b ) => a.name.localeCompare( b.name ) );
  } );

  return commandsByFolder;
}

/**
 * Finds a specific command from the commands organized by folder
 * @param {Object} commandsByFolder - Commands organized by folder
 * @param {string} commandName - Name of the command to find
 * @returns {Object|null} Command object or null if not found
 */
function findCommand ( commandsByFolder, commandName ) {
  for ( const folder of Object.keys( commandsByFolder ) ) {
    const command = commandsByFolder[ folder ].find( cmd => cmd.name === commandName );
    if ( command ) {
      return command;
    }
  }
  return null;
}

/**
 * Shows available commands and their usage
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleHelpCommand ( commandParams ) {
  const { args, services, context, responseChannel = 'request' } = commandParams;
  const { messageService } = services;

  try {
    const commandsByFolder = loadAvailableCommands();

    // If a specific command is requested
    if ( args && args.trim() ) {
      const requestedCommand = args.trim().toLowerCase();
      const command = findCommand( commandsByFolder, requestedCommand );

      if ( command ) {
        // Show specific command help
        const helpText = `🤖 Help for command: ${ config.COMMAND_SWITCH }${ command.name }\n\n` +
          `📝 Description: ${ command.description }\n` +
          `🎯 Example: ${ config.COMMAND_SWITCH }${ command.example }\n` +
          `👤 Required Role: ${ command.role }`;

        await messageService.sendResponse( helpText, {
          responseChannel,
          isPrivateMessage: context?.fullMessage?.isPrivateMessage,
          sender: context?.sender,
          services
        } );

        return {
          success: true,
          response: helpText,
          shouldRespond: true
        };
      } else {
        // Check if command exists but is disabled
        if ( isCommandDisabled( requestedCommand ) ) {
          const errorText = `❌ Command "${ requestedCommand }" is currently disabled.`;

          await messageService.sendResponse( errorText, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
          } );

          return {
            success: false,
            response: errorText,
            shouldRespond: true,
            error: `Command "${ requestedCommand }" is disabled`
          };
        }

        // Command doesn't exist
        const errorText = `❌ Command "${ requestedCommand }" does not exist.\n` +
          `Type ${ config.COMMAND_SWITCH }help to see all available commands.`;

        await messageService.sendResponse( errorText, {
          responseChannel,
          isPrivateMessage: context?.fullMessage?.isPrivateMessage,
          sender: context?.sender,
          services
        } );

        return {
          success: false,
          response: errorText,
          shouldRespond: true,
          error: `Command "${ requestedCommand }" not found`
        };
      }
    }

    // Show general help (all commands grouped by folder)
    let helpText = '🤖 Available Commands:\n\n';

    // Sort folders alphabetically
    const sortedFolders = Object.keys( commandsByFolder ).sort();

    sortedFolders.forEach( folderName => {
      const commands = commandsByFolder[ folderName ];
      if ( commands.length > 0 ) {
        // Use folder name as header (skip "Root" folder name for commands in the root)
        const displayName = folderName === 'Root' ? 'Other Commands' : folderName;
        helpText += `� ${ displayName }:\n`;

        commands.forEach( command => {
          helpText += `${ config.COMMAND_SWITCH }${ command.name } (${ command.role }) - ${ command.description }\n`;
        } );
        helpText += '\n';
      }
    } );

    // Add footer with specific help instructions
    helpText += `💡 Tip: Type ${ config.COMMAND_SWITCH }help [command] to see specific examples and usage.`;

    // Remove extra trailing newlines
    helpText = helpText.replace( /\n+$/, '' );

    await messageService.sendResponse( helpText, {
      responseChannel,
      isPrivateMessage: context?.fullMessage?.isPrivateMessage,
      sender: context?.sender,
      services
    } );

    return {
      success: true,
      response: helpText,
      shouldRespond: true
    };
  } catch ( error ) {
    const errorResponse = '❌ Error loading help information. Please try again.';
    await messageService.sendResponse( errorResponse, {
      responseChannel,
      isPrivateMessage: context?.fullMessage?.isPrivateMessage,
      sender: context?.sender,
      services
    } );

    return {
      success: false,
      response: errorResponse,
      shouldRespond: true,
      error: error.message
    };
  }
}

// Attach metadata to the function
handleHelpCommand.requiredRole = requiredRole;
handleHelpCommand.description = description;
handleHelpCommand.example = example;
handleHelpCommand.hidden = hidden;

module.exports = handleHelpCommand;
