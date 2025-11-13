const { logger } = require( '../lib/logging.js' );
const fs = require( 'fs' );
const path = require( 'path' );

/**
 * Lists all chat commands and their aliases (no specific command)
 */
function listAllCommands ( services, context ) {
    try {
        const chatPath = path.join( __dirname, '../../data/chat.json' );
        const aliasesPath = path.join( __dirname, '../../data/aliases.json' );

        if ( !fs.existsSync( chatPath ) ) {
            return {
                success: false,
                shouldRespond: true,
                response: '❌ No chat commands available.'
            };
        }

        const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );
        const aliasesData = fs.existsSync( aliasesPath )
            ? JSON.parse( fs.readFileSync( aliasesPath, 'utf8' ) )
            : {};

        // Build a map of command -> aliases
        const commandAliases = {};
        Object.keys( chatData ).forEach( cmd => {
            commandAliases[ cmd ] = [];
        } );

        Object.entries( aliasesData ).forEach( ( [ alias, aliasData ] ) => {
            if ( commandAliases[ aliasData.command ] ) {
                commandAliases[ aliasData.command ].push( alias );
            }
        } );

        // Build response
        let response = '**📋 Chat Commands:**\n\n';
        Object.entries( commandAliases ).forEach( ( [ command, aliases ] ) => {
            if ( aliases.length > 0 ) {
                response += `• **${ command }**: ${ aliases.join( ', ' ) }\n`;
            } else {
                response += `• **${ command }**\n`;
            }
        } );

        return {
            success: true,
            shouldRespond: true,
            response
        };
    } catch ( error ) {
        logger.error( `Error listing chat commands: ${ error.message }` );
        return {
            success: false,
            shouldRespond: true,
            response: '❌ Error loading chat commands'
        };
    }
}

/**
 * Lists a specific chat command with its aliases, messages, and images
 */
function listSpecificCommand ( commandName, services, context ) {
    try {
        const chatPath = path.join( __dirname, '../../data/chat.json' );
        const aliasesPath = path.join( __dirname, '../../data/aliases.json' );

        if ( !fs.existsSync( chatPath ) ) {
            return {
                success: false,
                shouldRespond: true,
                response: `❌ Chat command "${ commandName }" not found.`
            };
        }

        const chatData = JSON.parse( fs.readFileSync( chatPath, 'utf8' ) );
        const aliasesData = fs.existsSync( aliasesPath )
            ? JSON.parse( fs.readFileSync( aliasesPath, 'utf8' ) )
            : {};

        // Check if command exists or if it's an alias
        let targetCommand = commandName;
        if ( !chatData[ commandName ] ) {
            // Check if it's an alias
            if ( aliasesData[ commandName ] ) {
                targetCommand = aliasesData[ commandName ].command;
            } else {
                return {
                    success: false,
                    shouldRespond: true,
                    response: `❌ Chat command "${ commandName }" not found.`
                };
            }
        }

        const commandData = chatData[ targetCommand ];

        // Find all aliases for this command
        const aliases = Object.entries( aliasesData )
            .filter( ( [ alias, aliasData ] ) => aliasData.command === targetCommand )
            .map( ( [ alias ] ) => alias );

        // Build response
        let response = `**${ targetCommand }**`;
        if ( aliases.length > 0 ) {
            response += `: ${ aliases.join( ', ' ) }`;
        }
        response += '\n\n';

        // Add images
        const images = commandData.pictures || [];
        const validImages = images.filter( img => img !== null && img !== undefined );
        if ( validImages.length > 0 ) {
            response += `**Images:** (${ validImages.length })\n`;
            validImages.forEach( ( img, index ) => {
                response += `  ${ index + 1 }. ${ img }\n`;
            } );
            response += '\n';
        } else {
            response += '**Images:** None\n\n';
        }

        // Add messages
        const messages = commandData.messages || [];
        if ( messages.length > 0 ) {
            response += `**Messages:** (${ messages.length })\n`;
            messages.forEach( ( msg, index ) => {
                // Truncate long messages for display
                const displayMsg = msg.length > 100 ? msg.substring( 0, 100 ) + '...' : msg;
                response += `  ${ index + 1 }. ${ displayMsg }\n`;
            } );
        } else {
            response += '**Messages:** None';
        }

        return {
            success: true,
            shouldRespond: true,
            response
        };
    } catch ( error ) {
        logger.error( `Error listing specific chat command: ${ error.message }` );
        return {
            success: false,
            shouldRespond: true,
            response: '❌ Error loading chat command details'
        };
    }
}

/**
 * Handles chat commands loaded from chat.json
 * @param {string} command - The command name
 * @param {string} args - Command arguments
 * @param {Object} services - Service container
 * @param {Object} context - Context including sender info
 * @returns {Promise<Object>} Response object
 */
async function handleChatCommand ( command, args, services, context ) {
    try {
        // Check for "list" subcommand
        if ( args && args.trim().toLowerCase() === 'list' ) {
            return listAllCommands( services, context );
        }

        if ( args && args.trim().toLowerCase().startsWith( 'list ' ) ) {
            const listCommand = args.trim().substring( 5 ).toLowerCase();
            return listSpecificCommand( listCommand, services, context );
        }

        // Load chat command data
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

        // Check for aliases
        const aliasesPath = path.join( __dirname, '../../data/aliases.json' );
        let aliasesData = {};
        if ( fs.existsSync( aliasesPath ) ) {
            aliasesData = JSON.parse( fs.readFileSync( aliasesPath, 'utf8' ) );
        }

        let commandData = chatData[ command ];

        // Check if command is an alias
        if ( !commandData && aliasesData[ command ] ) {
            commandData = chatData[ aliasesData[ command ].command ];
        }

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
        // Extract sender UUID (could be a string UUID or an object with uuid property)
        const senderUuid = typeof context?.sender === 'string' ? context.sender : context?.sender?.uuid;

        // Get the sender's profile info (nickname, avatarId, color) from state
        let senderName = null;
        let senderAvatarId = null;
        let senderColor = null;

        if ( senderUuid && services.stateService ) {
            try {
                const allUserData = services.stateService._getAllUserData();
                const userProfile = allUserData[ senderUuid ]?.userProfile;

                if ( userProfile ) {
                    senderName = userProfile.nickname;
                    senderAvatarId = userProfile.avatarId;
                    senderColor = userProfile.color;
                }
            } catch ( err ) {
                logger.warn( `[handleChatCommand] Could not get user profile from state for UUID ${ senderUuid }: ${ err.message }` );
            }
        }

        if ( randomPicture ) {
            // Send with image using sendGroupPictureMessage
            await services.messageService.sendGroupPictureMessage( processedMessage, randomPicture, services, senderUuid, senderName, senderAvatarId, senderColor );
        } else {
            // Send text-only message
            await services.messageService.sendResponse( processedMessage, {
                responseChannel: 'publicChat',
                isPrivateMessage: false,
                sender: context?.sender,
                services,
                senderUid: senderUuid,
                senderName: senderName,
                senderAvatarId: senderAvatarId,
                senderColor: senderColor
            } );
        }

        return {
            success: true,
            shouldRespond: true,
            response: processedMessage
        };

    } catch ( error ) {
        logger.error( `Error processing chat command '${ command }': ${ error.message }` );
        return {
            success: false,
            shouldRespond: true,
            error: error.message
        };
    }
}

// Set metadata for the command
handleChatCommand.requiredRole = 'USER';
handleChatCommand.description = 'Execute chat command from chat.json or list commands';
handleChatCommand.example = 'props | list | list props';
handleChatCommand.hidden = true;

module.exports = handleChatCommand;
