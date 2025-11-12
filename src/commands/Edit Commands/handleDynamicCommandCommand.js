const { logger } = require( '../../lib/logging.js' );
const fs = require( 'fs' );
const path = require( 'path' );

/**
 * Validates if a string is a valid image URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid image URL
 */
function isValidImageUrl ( url ) {
  try {
    const urlObj = new URL( url );
    // Check if it's http or https
    if ( ![ 'http:', 'https:' ].includes( urlObj.protocol ) ) return false;

    // Common image extensions and domains
    const imageExtensions = [ '.gif', '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.svg' ];
    const imageHosts = [ 'giphy.com', 'tenor.com', 'imgur.com', 'media.giphy.com', 'media.tenor.com', 'media0.giphy.com', 'media1.giphy.com', 'media2.giphy.com', 'media3.giphy.com', 'media4.giphy.com' ];

    const hasImageExt = imageExtensions.some( ext => url.toLowerCase().includes( ext ) );
    const hasImageHost = imageHosts.some( host => urlObj.hostname.includes( host ) );

    return hasImageExt || hasImageHost;
  } catch ( error ) {
    return false;
  }
}

/**
 * Loads all commands (static + dynamic + aliases) for conflict checking
 * @returns {Object} Object with commands, dynamicCommands, and aliases arrays
 */
function loadAllCommands () {
  const result = {
    commands: [],
    dynamicCommands: [],
    aliases: []
  };

  try {
    // Load static commands
    const commandsDir = path.join( __dirname, '../' );
    function getAllCommands ( dirPath ) {
      const items = fs.readdirSync( dirPath );
      items.forEach( item => {
        const itemPath = path.join( dirPath, item );
        const stats = fs.statSync( itemPath );

        if ( stats.isDirectory() ) {
          getAllCommands( itemPath );
        } else if ( item.match( /^handle(.*)Command\.js$/ ) ) {
          const match = item.match( /^handle(.*)Command\.js$/ );
          if ( match && match[ 1 ] ) {
            result.commands.push( match[ 1 ].toLowerCase() );
          }
        }
      } );
    }
    getAllCommands( commandsDir );

    // Load dynamic commands
    const chatPath = path.join( __dirname, '../../data/chat.json' );
    if ( fs.existsSync( chatPath ) ) {
      const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );
      result.dynamicCommands = Object.keys( chatData );
    }

    // Load aliases
    const aliasesPath = path.join( __dirname, '../../data/aliases.json' );
    if ( fs.existsSync( aliasesPath ) ) {
      const aliasesData = JSON.parse( fs.readFileSync( aliasesPath, 'utf8' ) );
      result.aliases = Object.keys( aliasesData );
    }
  } catch ( error ) {
    logger.error( `Error loading commands for conflict checking: ${ error.message }` );
  }

  return result;
}

/**
 * Adds a new dynamic command
 */
async function addCommand ( commandName, services, context ) {
  try {
    const allCommands = loadAllCommands();

    // Check for conflicts
    if ( allCommands.commands.includes( commandName ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Cannot add command "${ commandName }": it already exists as a static command.`
      };
    }

    if ( allCommands.dynamicCommands.includes( commandName ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Cannot add command "${ commandName }": it already exists as a dynamic command.`
      };
    }

    if ( allCommands.aliases.includes( commandName ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Cannot add command "${ commandName }": it already exists as an alias.`
      };
    }

    // Load current chat.json
    const chatPath = path.join( __dirname, '../../data/chat.json' );
    let chatData = {};

    if ( fs.existsSync( chatPath ) ) {
      chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );
    }

    // Check if command already exists
    if ( chatData[ commandName ] ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" already exists.`
      };
    }

    // Create new command
    chatData[ commandName ] = {
      messages: [],
      pictures: []
    };

    // Save to chat.json
    fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );
    logger.info( `Dynamic command "${ commandName }" added by ${ context?.sender }` );

    return {
      success: true,
      shouldRespond: true,
      response: `✅ Dynamic command "${ commandName }" created. Use \`!dynamicCommand addMessage\` to add messages and \`!dynamicCommand addImage\` to add images.`
    };
  } catch ( error ) {
    logger.error( `Error adding dynamic command: ${ error.message }` );
    return {
      success: false,
      shouldRespond: true,
      response: `❌ Error creating command: ${ error.message }`
    };
  }
}

/**
 * Removes a dynamic command
 */
async function removeCommand ( commandName, services, context ) {
  try {
    const chatPath = path.join( __dirname, '../../data/chat.json' );

    if ( !fs.existsSync( chatPath ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" not found.`
      };
    }

    const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );

    if ( !chatData[ commandName ] ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" does not exist.`
      };
    }

    // Remove the command
    delete chatData[ commandName ];

    // Save to chat.json
    fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );
    logger.info( `Dynamic command "${ commandName }" removed by ${ context?.sender }` );

    return {
      success: true,
      shouldRespond: true,
      response: `✅ Dynamic command "${ commandName }" removed.`
    };
  } catch ( error ) {
    logger.error( `Error removing dynamic command: ${ error.message }` );
    return {
      success: false,
      shouldRespond: true,
      response: `❌ Error removing command: ${ error.message }`
    };
  }
}

/**
 * Adds a message to a dynamic command
 */
async function addMessage ( commandName, message, services, context ) {
  try {
    if ( !message || message.trim().length === 0 ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Message cannot be empty.`
      };
    }

    const chatPath = path.join( __dirname, '../../data/chat.json' );

    if ( !fs.existsSync( chatPath ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" not found.`
      };
    }

    const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );

    if ( !chatData[ commandName ] ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" does not exist.`
      };
    }

    // Initialize messages array if it doesn't exist
    if ( !Array.isArray( chatData[ commandName ].messages ) ) {
      chatData[ commandName ].messages = [];
    }

    // Check if message already exists
    if ( chatData[ commandName ].messages.includes( message ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ This message already exists for command "${ commandName }".`
      };
    }

    // Add message
    chatData[ commandName ].messages.push( message );

    // Save to chat.json
    fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );
    logger.info( `Message added to command "${ commandName }" by ${ context?.sender }` );

    return {
      success: true,
      shouldRespond: true,
      response: `✅ Message added to command "${ commandName }".`
    };
  } catch ( error ) {
    logger.error( `Error adding message to dynamic command: ${ error.message }` );
    return {
      success: false,
      shouldRespond: true,
      response: `❌ Error adding message: ${ error.message }`
    };
  }
}

/**
 * Removes a message from a dynamic command
 */
async function removeMessage ( commandName, message, services, context ) {
  try {
    if ( !message || message.trim().length === 0 ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Message cannot be empty.`
      };
    }

    const chatPath = path.join( __dirname, '../../data/chat.json' );

    if ( !fs.existsSync( chatPath ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" not found.`
      };
    }

    const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );

    if ( !chatData[ commandName ] ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" does not exist.`
      };
    }

    if ( !Array.isArray( chatData[ commandName ].messages ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ No messages found for command "${ commandName }".`
      };
    }

    const index = chatData[ commandName ].messages.indexOf( message );

    if ( index === -1 ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Message not found in command "${ commandName }". Only exact matches are deleted.`
      };
    }

    // Remove message
    chatData[ commandName ].messages.splice( index, 1 );

    // Save to chat.json
    fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );
    logger.info( `Message removed from command "${ commandName }" by ${ context?.sender }` );

    return {
      success: true,
      shouldRespond: true,
      response: `✅ Message removed from command "${ commandName }".`
    };
  } catch ( error ) {
    logger.error( `Error removing message from dynamic command: ${ error.message }` );
    return {
      success: false,
      shouldRespond: true,
      response: `❌ Error removing message: ${ error.message }`
    };
  }
}

/**
 * Adds an image URL to a dynamic command
 */
async function addImage ( commandName, imageUrl, services, context ) {
  try {
    if ( !imageUrl || imageUrl.trim().length === 0 ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Image URL cannot be empty.`
      };
    }

    if ( !isValidImageUrl( imageUrl ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Invalid image URL. Must be a valid HTTP(S) URL to an image (gif, jpg, png, webp, etc).`
      };
    }

    const chatPath = path.join( __dirname, '../../data/chat.json' );

    if ( !fs.existsSync( chatPath ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" not found.`
      };
    }

    const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );

    if ( !chatData[ commandName ] ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" does not exist.`
      };
    }

    // Initialize pictures array if it doesn't exist
    if ( !Array.isArray( chatData[ commandName ].pictures ) ) {
      chatData[ commandName ].pictures = [];
    }

    // Check if image already exists
    if ( chatData[ commandName ].pictures.includes( imageUrl ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ This image URL already exists for command "${ commandName }".`
      };
    }

    // Add image
    chatData[ commandName ].pictures.push( imageUrl );

    // Save to chat.json
    fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );
    logger.info( `Image added to command "${ commandName }" by ${ context?.sender }` );

    return {
      success: true,
      shouldRespond: true,
      response: `✅ Image added to command "${ commandName }".`
    };
  } catch ( error ) {
    logger.error( `Error adding image to dynamic command: ${ error.message }` );
    return {
      success: false,
      shouldRespond: true,
      response: `❌ Error adding image: ${ error.message }`
    };
  }
}

/**
 * Removes an image URL from a dynamic command
 */
async function removeImage ( commandName, imageUrl, services, context ) {
  try {
    if ( !imageUrl || imageUrl.trim().length === 0 ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Image URL cannot be empty.`
      };
    }

    const chatPath = path.join( __dirname, '../../data/chat.json' );

    if ( !fs.existsSync( chatPath ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" not found.`
      };
    }

    const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );

    if ( !chatData[ commandName ] ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" does not exist.`
      };
    }

    if ( !Array.isArray( chatData[ commandName ].pictures ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ No images found for command "${ commandName }".`
      };
    }

    const index = chatData[ commandName ].pictures.indexOf( imageUrl );

    if ( index === -1 ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Image URL not found in command "${ commandName }". Only exact matches are deleted.`
      };
    }

    // Remove image
    chatData[ commandName ].pictures.splice( index, 1 );

    // Save to chat.json
    fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );
    logger.info( `Image removed from command "${ commandName }" by ${ context?.sender }` );

    return {
      success: true,
      shouldRespond: true,
      response: `✅ Image removed from command "${ commandName }".`
    };
  } catch ( error ) {
    logger.error( `Error removing image from dynamic command: ${ error.message }` );
    return {
      success: false,
      shouldRespond: true,
      response: `❌ Error removing image: ${ error.message }`
    };
  }
}

/**
 * Adds an alias for a dynamic command
 */
async function addAlias ( commandName, alias, services, context ) {
  try {
    if ( !alias || alias.trim().length === 0 ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Alias cannot be empty.`
      };
    }

    const normalizedAlias = alias.toLowerCase().trim();
    const allCommands = loadAllCommands();

    // Check for conflicts
    if ( allCommands.commands.includes( normalizedAlias ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Cannot add alias "${ normalizedAlias }": it already exists as a static command.`
      };
    }

    if ( allCommands.dynamicCommands.includes( normalizedAlias ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Cannot add alias "${ normalizedAlias }": it already exists as a dynamic command.`
      };
    }

    if ( allCommands.aliases.includes( normalizedAlias ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Alias "${ normalizedAlias }" already exists.`
      };
    }

    // Check if the command exists
    const chatPath = path.join( __dirname, '../../data/chat.json' );
    if ( !fs.existsSync( chatPath ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" does not exist.`
      };
    }

    const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );

    if ( !chatData[ commandName ] ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Dynamic command "${ commandName }" does not exist.`
      };
    }

    // Load or create aliases.json
    const aliasesPath = path.join( __dirname, '../../data/aliases.json' );
    let aliasesData = {};

    if ( fs.existsSync( aliasesPath ) ) {
      aliasesData = JSON.parse( fs.readFileSync( aliasesPath, 'utf8' ) );
    }

    // Add alias
    aliasesData[ normalizedAlias ] = {
      command: commandName
    };

    // Save to aliases.json
    fs.writeFileSync( aliasesPath, JSON.stringify( aliasesData, null, 2 ), 'utf8' );
    logger.info( `Alias "${ normalizedAlias }" added for command "${ commandName }" by ${ context?.sender }` );

    return {
      success: true,
      shouldRespond: true,
      response: `✅ Alias "${ normalizedAlias }" created for command "${ commandName }".`
    };
  } catch ( error ) {
    logger.error( `Error adding alias for dynamic command: ${ error.message }` );
    return {
      success: false,
      shouldRespond: true,
      response: `❌ Error adding alias: ${ error.message }`
    };
  }
}

/**
 * Removes an alias for a dynamic command
 */
async function removeAlias ( alias, services, context ) {
  try {
    if ( !alias || alias.trim().length === 0 ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Alias cannot be empty.`
      };
    }

    const normalizedAlias = alias.toLowerCase().trim();
    const aliasesPath = path.join( __dirname, '../../data/aliases.json' );

    if ( !fs.existsSync( aliasesPath ) ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Alias "${ normalizedAlias }" does not exist.`
      };
    }

    const aliasesData = JSON.parse( fs.readFileSync( aliasesPath, 'utf8' ) );

    if ( !aliasesData[ normalizedAlias ] ) {
      return {
        success: false,
        shouldRespond: true,
        response: `❌ Alias "${ normalizedAlias }" does not exist.`
      };
    }

    // Remove alias
    delete aliasesData[ normalizedAlias ];

    // Save to aliases.json
    fs.writeFileSync( aliasesPath, JSON.stringify( aliasesData, null, 2 ), 'utf8' );
    logger.info( `Alias "${ normalizedAlias }" removed by ${ context?.sender }` );

    return {
      success: true,
      shouldRespond: true,
      response: `✅ Alias "${ normalizedAlias }" removed.`
    };
  } catch ( error ) {
    logger.error( `Error removing alias for dynamic command: ${ error.message }` );
    return {
      success: false,
      shouldRespond: true,
      response: `❌ Error removing alias: ${ error.message }`
    };
  }
}

/**
 * Main command handler for dynamic command configuration
 */
async function handleDynamicCommandCommand ( { command, args, services, context } ) {
  try {
    const parts = args.trim().split( /\s+/ );
    const subcommand = parts[ 0 ]?.toLowerCase();

    if ( !subcommand ) {
      return {
        success: false,
        shouldRespond: true,
        response: `Usage: \`!dynamicCommand <subcommand> [args]\`\n\nSubcommands:\n\`add <command>\` - Create a new dynamic command\n\`remove <command>\` - Delete a dynamic command\n\`addMessage <command> <message>\` - Add a message\n\`removeMessage <command> <message>\` - Remove a message\n\`addImage <command> <url>\` - Add an image\n\`removeImage <command> <url>\` - Remove an image\n\`addAlias <command> <alias>\` - Create an alias\n\`removeAlias <alias>\` - Remove an alias`
      };
    }

    if ( subcommand === 'add' ) {
      const commandName = parts[ 1 ]?.toLowerCase();
      if ( !commandName ) {
        return {
          success: false,
          shouldRespond: true,
          response: `❌ Usage: \`!dynamicCommand add <command>\``
        };
      }
      return await addCommand( commandName, services, context );
    }

    if ( subcommand === 'remove' ) {
      const commandName = parts[ 1 ]?.toLowerCase();
      if ( !commandName ) {
        return {
          success: false,
          shouldRespond: true,
          response: `❌ Usage: \`!dynamicCommand remove <command>\``
        };
      }
      return await removeCommand( commandName, services, context );
    }

    if ( subcommand === 'addmessage' ) {
      const commandName = parts[ 1 ]?.toLowerCase();
      if ( !commandName ) {
        return {
          success: false,
          shouldRespond: true,
          response: `❌ Usage: \`!dynamicCommand addMessage <command> <message>\``
        };
      }
      const message = parts.slice( 2 ).join( ' ' );
      return await addMessage( commandName, message, services, context );
    }

    if ( subcommand === 'removemessage' ) {
      const commandName = parts[ 1 ]?.toLowerCase();
      if ( !commandName ) {
        return {
          success: false,
          shouldRespond: true,
          response: `❌ Usage: \`!dynamicCommand removeMessage <command> <message>\``
        };
      }
      const message = parts.slice( 2 ).join( ' ' );
      return await removeMessage( commandName, message, services, context );
    }

    if ( subcommand === 'addimage' ) {
      const commandName = parts[ 1 ]?.toLowerCase();
      const imageUrl = parts[ 2 ];
      if ( !commandName || !imageUrl ) {
        return {
          success: false,
          shouldRespond: true,
          response: `❌ Usage: \`!dynamicCommand addImage <command> <url>\``
        };
      }
      return await addImage( commandName, imageUrl, services, context );
    }

    if ( subcommand === 'removeimage' ) {
      const commandName = parts[ 1 ]?.toLowerCase();
      const imageUrl = parts[ 2 ];
      if ( !commandName || !imageUrl ) {
        return {
          success: false,
          shouldRespond: true,
          response: `❌ Usage: \`!dynamicCommand removeImage <command> <url>\``
        };
      }
      return await removeImage( commandName, imageUrl, services, context );
    }

    if ( subcommand === 'addalias' ) {
      const commandName = parts[ 1 ]?.toLowerCase();
      const alias = parts[ 2 ]?.toLowerCase();
      if ( !commandName || !alias ) {
        return {
          success: false,
          shouldRespond: true,
          response: `❌ Usage: \`!dynamicCommand addAlias <command> <alias>\``
        };
      }
      return await addAlias( commandName, alias, services, context );
    }

    if ( subcommand === 'removealias' ) {
      const alias = parts[ 1 ]?.toLowerCase();
      if ( !alias ) {
        return {
          success: false,
          shouldRespond: true,
          response: `❌ Usage: \`!dynamicCommand removeAlias <alias>\``
        };
      }
      return await removeAlias( alias, services, context );
    }

    return {
      success: false,
      shouldRespond: true,
      response: `❌ Unknown subcommand "${ subcommand }". Use \`!dynamicCommand\` without args to see available subcommands.`
    };
  } catch ( error ) {
    logger.error( `Error in handleDynamicCommandCommand: ${ error.message }` );
    return {
      success: false,
      shouldRespond: true,
      response: `❌ Error processing command: ${ error.message }`
    };
  }
}

// Set metadata for the command
handleDynamicCommandCommand.requiredRole = 'MODERATOR';
handleDynamicCommandCommand.description = 'Manage dynamic commands';
handleDynamicCommandCommand.example = 'add props';
handleDynamicCommandCommand.hidden = false;

module.exports = handleDynamicCommandCommand;
