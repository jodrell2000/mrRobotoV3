'use strict';

const config = require( '../../config' );
const { hasPermission } = require( '../../lib/roleUtils' );

const requiredRole = 'MODERATOR';
const description = 'Moderator tools (anonymous)';
const example = 'mod listUsers | mod remove "DJ Name" | mod skip';
const hidden = false;

async function handleListUsers ( services, context, responseChannel ) {
    const { stateService, messageService } = services;
    const allUserData = stateService._getAllUserData();
    const nicknames = Object.values( allUserData )
        .map( u => u?.userProfile?.nickname )
        .filter( Boolean )
        .sort( ( a, b ) => a.localeCompare( b ) );

    if ( nicknames.length === 0 ) {
        const response = 'No users found in the hangout.';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: true, shouldRespond: true, response };
    }

    const response = nicknames.map( n => `"${ n }"` ).join( '\n' );
    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: true, shouldRespond: true, response };
}

async function handleRemoveDj ( nameArg, services, context, responseChannel ) {
    const { stateService, messageService } = services;

    if ( !nameArg ) {
        const response = 'Usage: !mod remove <name>';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Missing DJ name' };
    }

    const allUserData = stateService._getAllUserData();
    const match = Object.entries( allUserData ).find(
        ( [ , userData ] ) => userData?.userProfile?.nickname?.toLowerCase() === nameArg.toLowerCase()
    );

    if ( !match ) {
        const response = `❌ No user found with name "${ nameArg }".`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'User not found' };
    }

    const [ uuid ] = match;
    const djs = stateService._getDjs();
    if ( !djs.some( dj => dj.uuid === uuid ) ) {
        const response = `❌ "${ nameArg }" is not currently on the decks.`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Not on decks' };
    }

    try {
        await services.hangSocketServices.removeDj( services.socket, uuid );
    } catch ( err ) {
        const response = `❌ Failed to remove "${ nameArg }": ${ err.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: err.message };
    }

    const response = `✅ "${ nameArg }" has been removed from the decks.`;
    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: true, shouldRespond: true, response };
}

async function handleSkipSong ( services, context, responseChannel ) {
    const { messageService } = services;

    try {
        await services.hangSocketServices.skipSong( services.socket );
    } catch ( err ) {
        const response = `❌ Failed to skip song: ${ err.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: err.message };
    }

    const response = '✅ Song skipped.';
    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: true, shouldRespond: true, response };
}

async function handleModCommand ( commandParams ) {
    const { args, services, context, responseChannel = 'request' } = commandParams;
    const { stateService, messageService } = services;

    const senderRole = stateService.getUserRole( context.sender );
    if ( !hasPermission( senderRole, 'MODERATOR' ) ) {
        const response = '❌ You need at least moderator permissions to use this command.';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Insufficient permissions' };
    }

    const argParts = ( args || '' ).trim().split( /\s+/ );
    const subCommand = argParts[ 0 ]?.toLowerCase() || '';

    if ( subCommand === 'listusers' ) {
        return handleListUsers( services, context, responseChannel );
    }

    if ( subCommand === 'remove' ) {
        const nameArg = argParts.slice( 1 ).join( ' ' ).replace( /^"|"$/g, '' );
        return handleRemoveDj( nameArg, services, context, responseChannel );
    }

    if ( subCommand === 'skip' ) {
        return handleSkipSong( services, context, responseChannel );
    }

    const cmdSwitch = config.COMMAND_SWITCH || '!';
    const response =
        `📋 **Mod Usage:**\n\n` +
        `\`${ cmdSwitch }mod listUsers\` — List all users in the hangout\n` +
        `\`${ cmdSwitch }mod remove <name>\` — Remove a DJ from the decks\n` +
        `\`${ cmdSwitch }mod skip\` — Skip the currently playing song`;
    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: false, shouldRespond: true, response, error: 'Unknown subcommand' };
}

handleModCommand.requiredRole = requiredRole;
handleModCommand.description = description;
handleModCommand.example = example;
handleModCommand.hidden = hidden;

module.exports = handleModCommand;
