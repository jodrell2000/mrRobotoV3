const config = require( '../../config.js' );

// Set required role level for this command
const requiredRole = 'OWNER';
const description = 'Manage custom tokens for messages and questions';
const example = 'token list | token add myToken "Hello World" | token remove myToken';
const hidden = false;

/**
 * Handle listing all tokens
 */
async function handleListTokens ( services, context, responseChannel ) {
    const { messageService, tokenService } = services;

    try {
        const tokenList = await tokenService.getTokenList();

        if ( tokenList.length === 0 ) {
            const response = '📝 No tokens available.';
            await messageService.sendResponse( response, {
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
        }

        let response = '📝 **Available Tokens:**\n\n';

        // Group by type
        const builtInTokens = tokenList.filter( token => token.type === 'built-in' );
        const customTokens = tokenList.filter( token => token.type === 'custom' );

        if ( builtInTokens.length > 0 ) {
            response += '**Built-in Tokens:**\n';
            builtInTokens.forEach( token => {
                response += `• \`${ token.name }\` - ${ token.description }\n`;
            } );
            response += '\n';
        }

        if ( customTokens.length > 0 ) {
            response += '**Custom Tokens:**\n';
            customTokens.forEach( token => {
                response += `• \`${ token.name }\` - ${ token.description }\n`;
            } );
            response += '\n';
        }

        response += `**Context Tokens** (available during song/user events):\n`;
        response += `• \`{username}\` - User who triggered the event\n`;
        response += `• \`{trackName}\` - Current or referenced song title\n`;
        response += `• \`{artistName}\` - Current or referenced artist name\n`;
        response += `• \`{likes}\`, \`{dislikes}\`, \`{stars}\` - Song statistics\n\n`;

        response += `**Usage:**\n`;
        response += `• \`${ config.COMMAND_SWITCH }token add <name> <value>\`\n`;
        response += `• \`${ config.COMMAND_SWITCH }token remove <name>\`\n`;
        response += `• \`${ config.COMMAND_SWITCH }token test <text>\` - Test token replacement`;

        await messageService.sendResponse( response, {
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
        const response = `❌ Failed to list tokens: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return {
            success: false,
            shouldRespond: true,
            response,
            error: error.message
        };
    }
}

/**
 * Handle adding a token
 */
async function handleAddToken ( tokenName, tokenValue, services, context, responseChannel ) {
    const { messageService, tokenService } = services;

    try {
        const result = await tokenService.setCustomToken( tokenName, tokenValue );

        if ( !result.success ) {
            const response = `❌ ${ result.error }`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return {
                success: false,
                shouldRespond: true,
                response,
                error: result.error
            };
        }

        const response = `✅ ${ result.message }`;
        await messageService.sendResponse( response, {
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
        const response = `❌ Failed to add token: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return {
            success: false,
            shouldRespond: true,
            response,
            error: error.message
        };
    }
}

/**
 * Handle removing a token
 */
async function handleRemoveToken ( tokenName, services, context, responseChannel ) {
    const { messageService, tokenService } = services;

    try {
        const result = await tokenService.removeCustomToken( tokenName );

        if ( !result.success ) {
            const response = `❌ ${ result.error }`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return {
                success: false,
                shouldRespond: true,
                response,
                error: result.error
            };
        }

        const response = `✅ ${ result.message }`;
        await messageService.sendResponse( response, {
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
        const response = `❌ Failed to remove token: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return {
            success: false,
            shouldRespond: true,
            response,
            error: error.message
        };
    }
}

/**
 * Handle testing token replacement
 */
async function handleTestTokens ( testText, services, context, responseChannel ) {
    const { messageService, tokenService } = services;

    try {
        const originalText = testText;
        const processedText = await tokenService.replaceTokens( testText, {
            // Add some example context for testing
            trackName: 'Sample Song',
            artistName: 'Sample Artist',
            username: context?.sender?.username || 'TestUser',
            likes: 5,
            dislikes: 1,
            stars: 3
        } );

        let response = '🧪 **Token Test Results:**\n\n';
        response += `**Original:** ${ originalText }\n\n`;
        response += `**Processed:** ${ processedText }`;

        if ( originalText === processedText ) {
            response += '\n\n⚠️ No tokens were found or replaced in the text.';
        }

        await messageService.sendResponse( response, {
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
        const response = `❌ Failed to test tokens: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return {
            success: false,
            shouldRespond: true,
            response,
            error: error.message
        };
    }
}

/**
 * Manages custom tokens for message and question templates
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleTokenCommand ( commandParams ) {
    const { args, services, context, responseChannel = 'request' } = commandParams;
    const { messageService } = services;

    // Parse arguments
    if ( !args || args.trim().length === 0 ) {
        const response = `❌ Please specify a token command.\n\n**Usage:**\n• \`${ config.COMMAND_SWITCH }token list\` - Show all available tokens\n• \`${ config.COMMAND_SWITCH }token add <name> <value>\` - Add a custom token\n• \`${ config.COMMAND_SWITCH }token remove <name>\` - Remove a custom token\n• \`${ config.COMMAND_SWITCH }token test <text>\` - Test token replacement in text`;
        await messageService.sendResponse( response, {
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

    const argParts = args.trim().split( /\s+/ );
    const subCommand = argParts[ 0 ].toLowerCase();

    // Handle list command
    if ( subCommand === 'list' ) {
        return await handleListTokens( services, context, responseChannel );
    }

    // Handle add command
    if ( subCommand === 'add' ) {
        if ( argParts.length < 3 ) {
            const response = `❌ Please specify token name and value.\n\n**Usage:** \`${ config.COMMAND_SWITCH }token add <name> <value>\`\n\n**Example:** \`${ config.COMMAND_SWITCH }token add greeting "Hello everyone!"\``;
            await messageService.sendResponse( response, {
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

        const tokenName = argParts[ 1 ];

        // Find the value by reconstructing from the remaining args
        // This handles values with spaces that might be quoted
        const restOfArgs = args.substring( args.indexOf( tokenName ) + tokenName.length ).trim();

        // Simple parsing - look for quoted strings or take everything as the value
        let tokenValue;

        if ( restOfArgs.startsWith( '"' ) ) {
            // Handle quoted value
            const endQuote = restOfArgs.indexOf( '"', 1 );
            if ( endQuote === -1 ) {
                tokenValue = restOfArgs.substring( 1 ); // No closing quote, take everything
            } else {
                tokenValue = restOfArgs.substring( 1, endQuote );
            }
        } else {
            // No quotes, take everything as the value
            tokenValue = restOfArgs;
        }

        return await handleAddToken( tokenName, tokenValue, services, context, responseChannel );
    }

    // Handle remove command
    if ( subCommand === 'remove' ) {
        if ( argParts.length < 2 ) {
            const response = `❌ Please specify token name to remove.\n\n**Usage:** \`${ config.COMMAND_SWITCH }token remove <name>\``;
            await messageService.sendResponse( response, {
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
        const tokenName = argParts[ 1 ];
        return await handleRemoveToken( tokenName, services, context, responseChannel );
    }

    // Handle test command
    if ( subCommand === 'test' ) {
        if ( argParts.length < 2 ) {
            const response = `❌ Please specify text to test.\n\n**Usage:** \`${ config.COMMAND_SWITCH }token test <text with tokens>\`\n\n**Example:** \`${ config.COMMAND_SWITCH }token test "Hello {username}, welcome to {hangoutName}!"\``;
            await messageService.sendResponse( response, {
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
        const testText = args.substring( args.indexOf( argParts[ 1 ] ) );
        return await handleTestTokens( testText, services, context, responseChannel );
    }

    // Invalid subcommand
    const response = `❌ Invalid subcommand: "${ subCommand }"\n\n**Available subcommands:** list, add, remove, test\n\n**Usage:**\n• \`${ config.COMMAND_SWITCH }token list\`\n• \`${ config.COMMAND_SWITCH }token add <name> <value>\`\n• \`${ config.COMMAND_SWITCH }token remove <name>\`\n• \`${ config.COMMAND_SWITCH }token test <text>\``;
    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );

    return {
        success: false,
        shouldRespond: true,
        response,
        error: `Invalid subcommand: ${ subCommand }`
    };
}

// Attach metadata to the function
handleTokenCommand.requiredRole = requiredRole;
handleTokenCommand.description = description;
handleTokenCommand.example = example;
handleTokenCommand.hidden = hidden;

module.exports = handleTokenCommand;