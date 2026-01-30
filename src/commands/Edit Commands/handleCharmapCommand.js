const config = require( '../../config.js' );
const { getMappings, addMapping, removeMapping, normalizeText, clearCache } = require( '../../lib/textUtils' );

const requiredRole = 'MODERATOR';
const description = 'Manage special character to ASCII mappings';
const example = 'charmap list | charmap add ᕼ H | charmap remove ᕼ | charmap test ᕼEᒪᒪO';
const hidden = false;

/**
 * Handle the charmap command for managing character mappings
 * @param {Object} commandParams - Standard command parameters
 * @returns {Promise<Object>} Command result
 */
async function handleCharmapCommand ( commandParams ) {
    const { args, services, context, responseChannel = 'request' } = commandParams;
    const { messageService } = services;

    if ( !args || args.trim().length === 0 ) {
        const response = `**📝 Character Mapping Commands**\n\n` +
            `• \`${ config.COMMAND_SWITCH }charmap list\` - Show all character mappings\n` +
            `• \`${ config.COMMAND_SWITCH }charmap add <char> <replacement>\` - Add/update a mapping\n` +
            `• \`${ config.COMMAND_SWITCH }charmap remove <char>\` - Remove a mapping\n` +
            `• \`${ config.COMMAND_SWITCH }charmap test <text>\` - Test normalization on text\n` +
            `• \`${ config.COMMAND_SWITCH }charmap reload\` - Reload mappings from file`;

        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );

        return { success: true, shouldRespond: true, response };
    }

    const argParts = args.split( ' ' );
    const subCommand = argParts[ 0 ].toLowerCase();

    switch ( subCommand ) {
        case 'list':
            return await handleList( services, context, responseChannel );

        case 'add':
            return await handleAdd( argParts.slice( 1 ), services, context, responseChannel );

        case 'remove':
            return await handleRemove( argParts.slice( 1 ), services, context, responseChannel );

        case 'test':
            return await handleTest( argParts.slice( 1 ).join( ' ' ), services, context, responseChannel );

        case 'reload':
            return await handleReload( services, context, responseChannel );

        default:
            const response = `❌ Unknown subcommand: "${ subCommand }"\n\nUse \`${ config.COMMAND_SWITCH }charmap\` for help.`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response };
    }
}

/**
 * List all character mappings
 */
async function handleList ( services, context, responseChannel ) {
    const { messageService } = services;
    const mappings = getMappings();
    const entries = Object.entries( mappings );

    if ( entries.length === 0 ) {
        const response = '📝 No character mappings defined.';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: true, shouldRespond: true, response };
    }

    // Group mappings by their ASCII value for cleaner display
    const grouped = {};
    for ( const [ fancy, ascii ] of entries ) {
        if ( !grouped[ ascii ] ) {
            grouped[ ascii ] = [];
        }
        grouped[ ascii ].push( fancy );
    }

    // Sort by ASCII letter and format
    const sortedKeys = Object.keys( grouped ).sort();
    const lines = sortedKeys.map( ascii => {
        const chars = grouped[ ascii ].join( ' ' );
        return `**${ ascii }**: ${ chars }`;
    } );

    const response = `**📝 Character Mappings (${ entries.length } total)**\n\n${ lines.join( '\n' ) }`;

    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );

    return { success: true, shouldRespond: true, response };
}

/**
 * Add or update a character mapping
 */
async function handleAdd ( args, services, context, responseChannel ) {
    const { messageService } = services;

    if ( args.length < 2 ) {
        const response = `❌ Please provide the character and its replacement.\n\n**Usage:** \`${ config.COMMAND_SWITCH }charmap add <char> <replacement>\`\n\n**Example:** \`${ config.COMMAND_SWITCH }charmap add ᕼ H\``;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response };
    }

    const fancyChar = args[ 0 ];
    const asciiChar = args[ 1 ];

    const result = addMapping( fancyChar, asciiChar );
    const response = result.success ? `✅ ${ result.message }` : `❌ ${ result.message }`;

    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );

    return { success: result.success, shouldRespond: true, response };
}

/**
 * Remove a character mapping
 */
async function handleRemove ( args, services, context, responseChannel ) {
    const { messageService } = services;

    if ( args.length < 1 ) {
        const response = `❌ Please specify the character to remove.\n\n**Usage:** \`${ config.COMMAND_SWITCH }charmap remove <char>\``;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response };
    }

    const fancyChar = args[ 0 ];
    const result = removeMapping( fancyChar );
    const response = result.success ? `✅ ${ result.message }` : `❌ ${ result.message }`;

    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );

    return { success: result.success, shouldRespond: true, response };
}

/**
 * Test text normalization
 */
async function handleTest ( text, services, context, responseChannel ) {
    const { messageService } = services;

    if ( !text || text.trim().length === 0 ) {
        const response = `❌ Please provide text to test.\n\n**Usage:** \`${ config.COMMAND_SWITCH }charmap test <text>\`\n\n**Example:** \`${ config.COMMAND_SWITCH }charmap test 💃𝔻𝔸ℕℂ𝔼 𝔽𝔼𝕍𝔼ℝ🕺\``;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response };
    }

    const normalized = normalizeText( text );
    const response = `**Original:** ${ text }\n**Normalized:** ${ normalized }`;

    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );

    return { success: true, shouldRespond: true, response };
}

/**
 * Reload mappings from file
 */
async function handleReload ( services, context, responseChannel ) {
    const { messageService } = services;

    clearCache();
    const mappings = getMappings();
    const response = `✅ Reloaded ${ Object.keys( mappings ).length } character mappings from file.`;

    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );

    return { success: true, shouldRespond: true, response };
}

handleCharmapCommand.requiredRole = requiredRole;
handleCharmapCommand.description = description;
handleCharmapCommand.example = example;
handleCharmapCommand.hidden = hidden;

module.exports = handleCharmapCommand;
