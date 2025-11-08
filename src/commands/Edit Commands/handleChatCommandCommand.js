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
 * Loads all commands (static + chat + aliases) for conflict checking
 * @returns {Object} Object with commands, chatCommands, and aliases arrays
 */
function loadAllCommands () {
    const result = {
        commands: [],
        chatCommands: [],
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

        // Load chat commands
        const chatPath = path.join( __dirname, '../../../data/chat.json' );
        if ( fs.existsSync( chatPath ) ) {
            const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );
            result.chatCommands = Object.keys( chatData );
        }

        // Load aliases
        const aliasesPath = path.join( __dirname, '../../../data/aliases.json' );
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
 * Helper to send response message
 */
async function sendResponse ( message, services, context ) {
    await services.messageService.sendResponse( message, {
        responseChannel: 'request',
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: false, shouldRespond: true, response: message };
}

/**
 * Helper to send success response
 */
async function sendSuccessResponse ( message, services, context ) {
    await services.messageService.sendResponse( message, {
        responseChannel: 'request',
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: true, shouldRespond: true, response: message };
}

/**
 * Adds a new chat command
 */
async function addCommand ( commandName, services, context ) {
    try {
        const allCommands = loadAllCommands();

        // Check for conflicts
        if ( allCommands.commands.includes( commandName ) ) {
            return await sendResponse( `❌ Cannot add command "${ commandName }": it already exists as a static command.`, services, context );
        }

        if ( allCommands.chatCommands.includes( commandName ) ) {
            return await sendResponse( `❌ Cannot add command "${ commandName }": it already exists as a chat command.`, services, context );
        }

        if ( allCommands.aliases.includes( commandName ) ) {
            return await sendResponse( `❌ Cannot add command "${ commandName }": it already exists as an alias.`, services, context );
        }

        // Load current chat.json
        const chatPath = path.join( __dirname, '../../../data/chat.json' );
        let chatData = {};

        if ( fs.existsSync( chatPath ) ) {
            chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );
        }

        // Check if command already exists
        if ( chatData[ commandName ] ) {
            return await sendResponse( `❌ Chat command "${ commandName }" already exists.`, services, context );
        }

        // Create new command
        chatData[ commandName ] = {
            messages: [],
            pictures: []
        };

        // Save to chat.json
        fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );
        logger.info( `Chat command "${ commandName }" added by ${ context?.sender }` );

        return await sendSuccessResponse( `✅ Chat command "${ commandName }" created. Use \`!chatCommand addMessage\` to add messages and \`!chatCommand addImage\` to add images.`, services, context );
    } catch ( error ) {
        logger.error( `Error adding chat command: ${ error.message }` );
        return await sendResponse( `❌ Error creating command: ${ error.message }`, services, context );
    }
}

/**
 * Removes a chat command
 */
async function removeCommand ( commandName, services, context ) {
    try {
        const chatPath = path.join( __dirname, '../../../data/chat.json' );

        if ( !fs.existsSync( chatPath ) ) {
            return await sendResponse( `❌ Chat command "${ commandName }" not found.`, services, context );
        }

        const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );

        if ( !chatData[ commandName ] ) {
            return await sendResponse( `❌ Chat command "${ commandName }" does not exist.`, services, context );
        }

        // Remove command
        delete chatData[ commandName ];

        // Save to chat.json
        fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );
        logger.info( `Chat command "${ commandName }" removed by ${ context?.sender }` );

        return await sendSuccessResponse( `✅ Chat command "${ commandName }" removed.`, services, context );
    } catch ( error ) {
        logger.error( `Error removing chat command: ${ error.message }` );
        return await sendResponse( `❌ Error removing command: ${ error.message }`, services, context );
    }
}

/**
 * Adds a message to a chat command
 */
async function addMessage ( commandName, message, services, context ) {
    try {
        if ( !message || message.trim().length === 0 ) {
            return await sendResponse( `❌ Message cannot be empty.`, services, context );
        }

        const chatPath = path.join( __dirname, '../../../data/chat.json' );

        if ( !fs.existsSync( chatPath ) ) {
            return await sendResponse( `❌ Chat command "${ commandName }" not found.`, services, context );
        }

        const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );

        if ( !chatData[ commandName ] ) {
            return await sendResponse( `❌ Chat command "${ commandName }" does not exist.`, services, context );
        }

        // Initialize messages array if it doesn't exist
        if ( !Array.isArray( chatData[ commandName ].messages ) ) {
            chatData[ commandName ].messages = [];
        }

        // Check if message already exists
        if ( chatData[ commandName ].messages.includes( message ) ) {
            return await sendResponse( `❌ This message already exists for command "${ commandName }".`, services, context );
        }

        // Add message
        chatData[ commandName ].messages.push( message );

        // Save to chat.json
        fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );
        logger.info( `Message added to command "${ commandName }" by ${ context?.sender }` );

        return await sendSuccessResponse( `✅ Message added to command "${ commandName }".`, services, context );
    } catch ( error ) {
        logger.error( `Error adding message to chat command: ${ error.message }` );
        return await sendResponse( `❌ Error adding message: ${ error.message }`, services, context );
    }
}

/**
 * Removes a message from a chat command
 */
async function removeMessage ( commandName, message, services, context ) {
    try {
        if ( !message || message.trim().length === 0 ) {
            return await sendResponse( `❌ Message cannot be empty.`, services, context );
        }

        const chatPath = path.join( __dirname, '../../../data/chat.json' );

        if ( !fs.existsSync( chatPath ) ) {
            return await sendResponse( `❌ Chat command "${ commandName }" not found.`, services, context );
        }

        const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );

        if ( !chatData[ commandName ] ) {
            return await sendResponse( `❌ Chat command "${ commandName }" does not exist.`, services, context );
        }

        if ( !Array.isArray( chatData[ commandName ].messages ) ) {
            return await sendResponse( `❌ No messages found for command "${ commandName }".`, services, context );
        }

        const index = chatData[ commandName ].messages.indexOf( message );

        if ( index === -1 ) {
            return await sendResponse( `❌ Message not found in command "${ commandName }". Only exact matches are deleted.`, services, context );
        }

        // Remove message
        chatData[ commandName ].messages.splice( index, 1 );

        // Save to chat.json
        fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );
        logger.info( `Message removed from command "${ commandName }" by ${ context?.sender }` );

        return await sendSuccessResponse( `✅ Message removed from command "${ commandName }".`, services, context );
    } catch ( error ) {
        logger.error( `Error removing message from chat command: ${ error.message }` );
        return await sendResponse( `❌ Error removing message: ${ error.message }`, services, context );
    }
}

/**
 * Adds an image URL to a chat command
 */
async function addImage ( commandName, imageUrl, services, context ) {
    try {
        if ( !imageUrl || imageUrl.trim().length === 0 ) {
            return await sendResponse( `❌ Image URL cannot be empty.`, services, context );
        }

        if ( !isValidImageUrl( imageUrl ) ) {
            return await sendResponse( `❌ Invalid image URL. Must be a valid HTTPS URL pointing to an image.`, services, context );
        }

        const chatPath = path.join( __dirname, '../../../data/chat.json' );

        if ( !fs.existsSync( chatPath ) ) {
            return await sendResponse( `❌ Chat command "${ commandName }" not found.`, services, context );
        }

        const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );

        if ( !chatData[ commandName ] ) {
            return await sendResponse( `❌ Chat command "${ commandName }" does not exist.`, services, context );
        }

        // Initialize pictures array if it doesn't exist
        if ( !Array.isArray( chatData[ commandName ].pictures ) ) {
            chatData[ commandName ].pictures = [];
        }

        // Check if image already exists
        if ( chatData[ commandName ].pictures.includes( imageUrl ) ) {
            return await sendResponse( `❌ This image URL already exists for command "${ commandName }".`, services, context );
        }

        // Add image
        chatData[ commandName ].pictures.push( imageUrl );

        // Save to chat.json
        fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );
        logger.info( `Image added to command "${ commandName }" by ${ context?.sender }` );

        return await sendSuccessResponse( `✅ Image added to command "${ commandName }".`, services, context );
    } catch ( error ) {
        logger.error( `Error adding image to chat command: ${ error.message }` );
        return await sendResponse( `❌ Error adding image: ${ error.message }`, services, context );
    }
}

/**
 * Removes an image URL from a chat command
 */
async function removeImage ( commandName, imageUrl, services, context ) {
    try {
        if ( !imageUrl || imageUrl.trim().length === 0 ) {
            return await sendResponse( `❌ Image URL cannot be empty.`, services, context );
        }

        const chatPath = path.join( __dirname, '../../../data/chat.json' );

        if ( !fs.existsSync( chatPath ) ) {
            return await sendResponse( `❌ Chat command "${ commandName }" not found.`, services, context );
        }

        const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );

        if ( !chatData[ commandName ] ) {
            return await sendResponse( `❌ Chat command "${ commandName }" does not exist.`, services, context );
        }

        if ( !Array.isArray( chatData[ commandName ].pictures ) ) {
            return await sendResponse( `❌ No images found for command "${ commandName }".`, services, context );
        }

        const index = chatData[ commandName ].pictures.indexOf( imageUrl );

        if ( index === -1 ) {
            return await sendResponse( `❌ Image URL not found in command "${ commandName }". Only exact matches are deleted.`, services, context );
        }

        // Remove image
        chatData[ commandName ].pictures.splice( index, 1 );

        // Save to chat.json
        fs.writeFileSync( chatPath, JSON.stringify( chatData, null, 2 ), 'utf8' );
        logger.info( `Image removed from command "${ commandName }" by ${ context?.sender }` );

        return await sendSuccessResponse( `✅ Image removed from command "${ commandName }".`, services, context );
    } catch ( error ) {
        logger.error( `Error removing image from chat command: ${ error.message }` );
        return await sendResponse( `❌ Error removing image: ${ error.message }`, services, context );
    }
}

/**
 * Adds an alias for a chat command
 */
async function addAlias ( commandName, alias, services, context ) {
    try {
        if ( !alias || alias.trim().length === 0 ) {
            return await sendResponse( `❌ Alias cannot be empty.`, services, context );
        }

        const normalizedAlias = alias.toLowerCase().trim();
        const allCommands = loadAllCommands();

        // Check for conflicts
        if ( allCommands.commands.includes( normalizedAlias ) ) {
            return await sendResponse( `❌ Cannot add alias "${ normalizedAlias }": it already exists as a static command.`, services, context );
        }

        if ( allCommands.chatCommands.includes( normalizedAlias ) ) {
            return await sendResponse( `❌ Cannot add alias "${ normalizedAlias }": it already exists as a chat command.`, services, context );
        }

        if ( allCommands.aliases.includes( normalizedAlias ) ) {
            return await sendResponse( `❌ Alias "${ normalizedAlias }" already exists.`, services, context );
        }

        // Check if the command exists
        const chatPath = path.join( __dirname, '../../../data/chat.json' );
        if ( !fs.existsSync( chatPath ) ) {
            return await sendResponse( `❌ Chat command "${ commandName }" does not exist.`, services, context );
        }

        const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );

        if ( !chatData[ commandName ] ) {
            return await sendResponse( `❌ Chat command "${ commandName }" does not exist.`, services, context );
        }

        // Load or create aliases.json
        const aliasesPath = path.join( __dirname, '../../../data/aliases.json' );
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

        return await sendSuccessResponse( `✅ Alias "${ normalizedAlias }" created for command "${ commandName }".`, services, context );
    } catch ( error ) {
        logger.error( `Error adding alias for chat command: ${ error.message }` );
        return await sendResponse( `❌ Error adding alias: ${ error.message }`, services, context );
    }
}

/**
 * Removes an alias for a chat command
 */
async function removeAlias ( alias, services, context ) {
    try {
        if ( !alias || alias.trim().length === 0 ) {
            return await sendResponse( `❌ Alias cannot be empty.`, services, context );
        }

        const normalizedAlias = alias.toLowerCase().trim();
        const aliasesPath = path.join( __dirname, '../../../data/aliases.json' );

        if ( !fs.existsSync( aliasesPath ) ) {
            return await sendResponse( `❌ Alias "${ normalizedAlias }" does not exist.`, services, context );
        }

        const aliasesData = JSON.parse( fs.readFileSync( aliasesPath, 'utf8' ) );

        if ( !aliasesData[ normalizedAlias ] ) {
            return await sendResponse( `❌ Alias "${ normalizedAlias }" does not exist.`, services, context );
        }

        // Remove alias
        delete aliasesData[ normalizedAlias ];

        // Save to aliases.json
        fs.writeFileSync( aliasesPath, JSON.stringify( aliasesData, null, 2 ), 'utf8' );
        logger.info( `Alias "${ normalizedAlias }" removed by ${ context?.sender }` );

        return await sendSuccessResponse( `✅ Alias "${ normalizedAlias }" removed.`, services, context );
    } catch ( error ) {
        logger.error( `Error removing alias for chat command: ${ error.message }` );
        return await sendResponse( `❌ Error removing alias: ${ error.message }`, services, context );
    }
}

/**
 * Main command handler for chat command configuration
 */
async function handleChatCommandCommand ( { command, args, services, context } ) {
    const sendErrorResponse = async ( message ) => {
        await services.messageService.sendResponse( message, {
            responseChannel: 'request',
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response: message };
    };

    try {
        const parts = args.trim().split( /\s+/ );
        const subcommand = parts[ 0 ]?.toLowerCase();

        if ( !subcommand ) {
            return await sendErrorResponse( `Usage: \`!chatCommand <subcommand> [args]\`\n\nSubcommands:\n\`add <command>\` - Create a new chat command\n\`remove <command>\` - Delete a chat command\n\`addMessage <command> <message>\` - Add a message\n\`removeMessage <command> <message>\` - Remove a message\n\`addImage <command> <url>\` - Add an image\n\`removeImage <command> <url>\` - Remove an image\n\`addAlias <command> <alias>\` - Create an alias\n\`removeAlias <alias>\` - Remove an alias` );
        }

        if ( subcommand === 'add' ) {
            const commandName = parts[ 1 ]?.toLowerCase();
            if ( !commandName ) {
                return await sendErrorResponse( `❌ Usage: \`!chatCommand add <command>\`` );
            }
            return await addCommand( commandName, services, context );
        }

        if ( subcommand === 'remove' ) {
            const commandName = parts[ 1 ]?.toLowerCase();
            if ( !commandName ) {
                return await sendErrorResponse( `❌ Usage: \`!chatCommand remove <command>\`` );
            }
            return await removeCommand( commandName, services, context );
        }

        if ( subcommand === 'addmessage' ) {
            const commandName = parts[ 1 ]?.toLowerCase();
            if ( !commandName ) {
                return await sendErrorResponse( `❌ Usage: \`!chatCommand addMessage <command> <message>\`` );
            }
            const message = parts.slice( 2 ).join( ' ' );
            return await addMessage( commandName, message, services, context );
        }

        if ( subcommand === 'removemessage' ) {
            const commandName = parts[ 1 ]?.toLowerCase();
            if ( !commandName ) {
                return await sendErrorResponse( `❌ Usage: \`!chatCommand removeMessage <command> <message>\`` );
            }
            const message = parts.slice( 2 ).join( ' ' );
            return await removeMessage( commandName, message, services, context );
        }

        if ( subcommand === 'addimage' ) {
            const commandName = parts[ 1 ]?.toLowerCase();
            const imageUrl = parts[ 2 ];
            if ( !commandName || !imageUrl ) {
                return await sendErrorResponse( `❌ Usage: \`!chatCommand addImage <command> <url>\`` );
            }
            return await addImage( commandName, imageUrl, services, context );
        }

        if ( subcommand === 'removeimage' ) {
            const commandName = parts[ 1 ]?.toLowerCase();
            const imageUrl = parts[ 2 ];
            if ( !commandName || !imageUrl ) {
                return await sendErrorResponse( `❌ Usage: \`!chatCommand removeImage <command> <url>\`` );
            }
            return await removeImage( commandName, imageUrl, services, context );
        }

        if ( subcommand === 'addalias' ) {
            const commandName = parts[ 1 ]?.toLowerCase();
            const alias = parts[ 2 ]?.toLowerCase();
            if ( !commandName || !alias ) {
                return await sendErrorResponse( `❌ Usage: \`!chatCommand addAlias <command> <alias>\`` );
            }
            return await addAlias( commandName, alias, services, context );
        }

        if ( subcommand === 'removealias' ) {
            const alias = parts[ 1 ]?.toLowerCase();
            if ( !alias ) {
                return await sendErrorResponse( `❌ Usage: \`!chatCommand removeAlias <alias>\`` );
            }
            return await removeAlias( alias, services, context );
        }

        return await sendErrorResponse( `❌ Unknown subcommand "${ subcommand }". Use \`!chatCommand\` without args to see available subcommands.` );
    } catch ( error ) {
        logger.error( `Error in handleChatCommandCommand: ${ error.message }` );
        return {
            success: false,
            shouldRespond: true,
            response: `❌ Error processing command: ${ error.message }`
        };
    }
}

// Set metadata for the command
handleChatCommandCommand.requiredRole = 'MODERATOR';
handleChatCommandCommand.description = 'Manage chat commands';
handleChatCommandCommand.example = 'add props';
handleChatCommandCommand.hidden = false;

module.exports = handleChatCommandCommand;
