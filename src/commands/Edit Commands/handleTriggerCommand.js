const config = require( '../../config.js' );

// Set required role level for this command - requires owner
const requiredRole = 'OWNER';
const description = 'Manage command triggers for bot events';
const example = 'trigger list | trigger add newSong intro | trigger remove newSong intro';
const hidden = false;



/**
 * Handles listing all triggers and their configured commands
 */
async function handleListTriggers ( services, context, responseChannel ) {
    const { messageService, triggerService } = services;

    try {
        const availableTriggers = triggerService.getAvailableTriggers();
        const allTriggers = triggerService.getAllTriggers();
        
        let response = '**🔧 Configured Triggers:**\n\n';
        
        // Show available trigger types
        response += '**Available Trigger Types:**\n';
        Object.entries( availableTriggers ).forEach( ( [ triggerName, description ] ) => {
            response += `• **${ triggerName }** - ${ description }\n`;
        } );
        
        response += '\n**Current Configuration:**\n';
        
        // Show configured triggers
        if ( Object.keys( allTriggers ).length === 0 ) {
            response += '*No triggers configured*\n';
        } else {
            Object.entries( allTriggers ).forEach( ( [ triggerName, commands ] ) => {
                const commandList = Array.isArray( commands ) ? commands.join( ', ' ) : 'Invalid configuration';
                response += `• **${ triggerName }**: ${ commandList }\n`;
            } );
        }
        
        response += `\n**Usage:**\n• \`${ config.COMMAND_SWITCH }trigger add <triggerName> <commandName>\` - Add command to trigger\n• \`${ config.COMMAND_SWITCH }trigger remove <triggerName> <commandName>\` - Remove command from trigger\n• \`${ config.COMMAND_SWITCH }trigger clear <triggerName>\` - Remove all commands from trigger`;

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
        const response = `❌ Failed to list triggers: ${ error.message }`;
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
 * Handles adding a command to a trigger
 */
async function handleAddTrigger ( triggerName, commandName, services, context, responseChannel ) {
    const { messageService, triggerService } = services;

    try {
        const result = await triggerService.addTriggerCommand( triggerName, commandName );
        
        if ( !result.success ) {
            let response = `❌ ${ result.error }`;
            if ( result.availableTriggers ) {
                response += `\n\n**Available triggers:** ${ result.availableTriggers.join( ', ' ) }`;
            }
            
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
        
        const response = `✅ ${ result.message }\n\nTrigger "${ triggerName }" now executes: ${ result.currentCommands.join( ', ' ) }`;
        
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
        const response = `❌ Failed to add trigger: ${ error.message }`;
        
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
 * Handles removing a command from a trigger
 */
async function handleRemoveTrigger ( triggerName, commandName, services, context, responseChannel ) {
    const { messageService, triggerService } = services;

    try {
        const result = await triggerService.removeTriggerCommand( triggerName, commandName );
        
        if ( !result.success ) {
            let response = `❌ ${ result.error }`;
            if ( result.availableTriggers ) {
                response += `\n\n**Available triggers:** ${ result.availableTriggers.join( ', ' ) }`;
            }
            if ( result.currentCommands ) {
                response += `\n\n**Current commands:** ${ result.currentCommands.join( ', ' ) || 'none' }`;
            }
            
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
        
        let response = `✅ ${ result.message }`;
        
        if ( result.currentCommands.length > 0 ) {
            response += `\n\nTrigger "${ triggerName }" now executes: ${ result.currentCommands.join( ', ' ) }`;
        } else {
            response += `\n\nTrigger "${ triggerName }" is now empty`;
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
        const response = `❌ Failed to remove trigger: ${ error.message }`;
        
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
 * Handles clearing all commands from a trigger
 */
async function handleClearTrigger ( triggerName, services, context, responseChannel ) {
    const { messageService, triggerService } = services;

    try {
        const result = await triggerService.clearTrigger( triggerName );
        
        if ( !result.success ) {
            let response = `❌ ${ result.error }`;
            if ( result.availableTriggers ) {
                response += `\n\n**Available triggers:** ${ result.availableTriggers.join( ', ' ) }`;
            }
            
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
        
        const response = `✅ ${ result.message }\n\nRemoved commands: ${ result.clearedCommands.join( ', ' ) }`;
        
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
        const response = `❌ Failed to clear trigger: ${ error.message }`;
        
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
 * Manages command triggers for bot events
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleTriggerCommand ( commandParams ) {
    const { args, services, context, responseChannel = 'request' } = commandParams;
    const { messageService } = services;

    // Parse arguments
    if ( !args || args.trim().length === 0 ) {
        const availableTriggers = Object.keys( services.triggerService.getAvailableTriggers() ).join( ', ' );
        const response = `❌ Please specify a trigger command.\n\n**Usage:**\n• \`${ config.COMMAND_SWITCH }trigger list\` - Show all configured triggers\n• \`${ config.COMMAND_SWITCH }trigger add <triggerName> <commandName>\` - Add command to trigger\n• \`${ config.COMMAND_SWITCH }trigger remove <triggerName> <commandName>\` - Remove command from trigger\n• \`${ config.COMMAND_SWITCH }trigger clear <triggerName>\` - Remove all commands from trigger\n\n**Available triggers:** ${ availableTriggers }`;

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

    // Split args into subcommand and parameters
    const argParts = args.split( ' ' );
    const subCommand = argParts[ 0 ].toLowerCase();

    // Handle list command
    if ( subCommand === 'list' ) {
        return await handleListTriggers( services, context, responseChannel );
    }

    // Handle add command
    if ( subCommand === 'add' ) {
        if ( argParts.length < 3 ) {
            const availableTriggers = Object.keys( services.triggerService.getAvailableTriggers() ).join( ', ' );
            const response = `❌ Please specify trigger name and command name.\n\n**Usage:** \`${ config.COMMAND_SWITCH }trigger add <triggerName> <commandName>\`\n\n**Available triggers:** ${ availableTriggers }`;
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
        const triggerName = argParts[ 1 ];
        const commandName = argParts[ 2 ];
        return await handleAddTrigger( triggerName, commandName, services, context, responseChannel );
    }

    // Handle remove command
    if ( subCommand === 'remove' ) {
        if ( argParts.length < 3 ) {
            const response = `❌ Please specify trigger name and command name.\n\n**Usage:** \`${ config.COMMAND_SWITCH }trigger remove <triggerName> <commandName>\``;
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
        const triggerName = argParts[ 1 ];
        const commandName = argParts[ 2 ];
        return await handleRemoveTrigger( triggerName, commandName, services, context, responseChannel );
    }

    // Handle clear command
    if ( subCommand === 'clear' ) {
        if ( argParts.length < 2 ) {
            const availableTriggers = Object.keys( services.triggerService.getAvailableTriggers() ).join( ', ' );
            const response = `❌ Please specify trigger name.\n\n**Usage:** \`${ config.COMMAND_SWITCH }trigger clear <triggerName>\`\n\n**Available triggers:** ${ availableTriggers }`;
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
        const triggerName = argParts[ 1 ];
        return await handleClearTrigger( triggerName, services, context, responseChannel );
    }

    // Invalid subcommand
    const availableTriggers = Object.keys( services.triggerService.getAvailableTriggers() ).join( ', ' );
    const response = `❌ Invalid subcommand: "${ subCommand }"\n\n**Available subcommands:** list, add, remove, clear\n\n**Usage:**\n• \`${ config.COMMAND_SWITCH }trigger list\`\n• \`${ config.COMMAND_SWITCH }trigger add <triggerName> <commandName>\`\n• \`${ config.COMMAND_SWITCH }trigger remove <triggerName> <commandName>\`\n• \`${ config.COMMAND_SWITCH }trigger clear <triggerName>\`\n\n**Available triggers:** ${ availableTriggers }`;
    
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
handleTriggerCommand.requiredRole = requiredRole;
handleTriggerCommand.description = description;
handleTriggerCommand.example = example;
handleTriggerCommand.hidden = hidden;

module.exports = handleTriggerCommand;