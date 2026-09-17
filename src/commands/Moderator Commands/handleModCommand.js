'use strict';

const config = require( '../../config' );
const { hasPermission } = require( '../../services/permissionService.js' );

const requiredRole = 'MODERATOR';
const description = 'Moderator tools (anonymous)';
const example = 'mod listUsers | mod remove "DJ Name" | mod skip';
const hidden = false;

async function handleListUsers ( services, context, responseChannel ) {
    const { stateService, messageService } = services;
    const users = typeof stateService?.getUsers === 'function'
        ? stateService.getUsers()
        : Object.values( stateService._getAllUserData() );
    const nicknames = users
        .map( user => user?.nickname || user?.userProfile?.nickname )
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
    const logger = services.logger;

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

    if ( logger ) logger.debug( `[mod remove] Starting removal of user: "${ nameArg }"` );

    // Get all users using framework-agnostic method (works for both Hang and Wavez)
    const users = stateService.getUsers();
    if ( logger ) logger.debug( `[mod remove] Found ${ users?.length || 0 } total users: ${ users?.map( u => u?.nickname || u?.id ).join( ', ' ) }` );

    const matchedUser = users.find(
        user => ( user?.nickname || user?.userProfile?.nickname )?.toLowerCase() === nameArg.toLowerCase()
    );

    if ( !matchedUser ) {
        if ( logger ) logger.warn( `[mod remove] User "${ nameArg }" not found in user list` );
        const response = `❌ No user found with name "${ nameArg }".`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'User not found' };
    }

    // Get user ID (handles both frameworks: 'id' for Wavez/normalized, 'uuid' for Hang)
    const userId = matchedUser.id || matchedUser.uuid;
    if ( logger ) logger.debug( `[mod remove] Matched user "${ nameArg }" -> userId: "${ userId }"` );

    // Get DJ queue using framework-agnostic method
    const djQueue = stateService.getDjQueue();
    if ( logger ) logger.debug( `[mod remove] DJ queue size: ${ djQueue?.length || 0 }, queue: ${ djQueue?.map( dj => dj.userId || dj.uuid ).join( ', ' ) }` );

    if ( !djQueue.some( dj => ( dj.userId || dj.uuid ) === userId ) ) {
        if ( logger ) logger.warn( `[mod remove] User "${ userId }" is not on the decks` );
        const response = `❌ "${ nameArg }" is not currently on the decks.`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Not on decks' };
    }

    if ( logger ) logger.info( `[mod remove] User "${ nameArg }" is on decks with userId "${ userId }", calling platformActions.removeFromDJQueue()` );

    try {
        const result = services.platformActions
            ? await services.platformActions.removeFromDJQueue( userId )
            : await services.hangSocketServices.removeDj( services, userId );
        if ( logger ) logger.debug( `[mod remove] platformActions result: ${ JSON.stringify( result ) }` );
        if ( result && !result.success ) throw new Error( result.error );
    } catch ( err ) {
        if ( logger ) logger.error( `[mod remove] Failed to remove user: ${ err.message }` );
        const response = `❌ Failed to remove "${ nameArg }": ${ err.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: err.message };
    }

    if ( logger ) logger.info( `[mod remove] Successfully removed "${ nameArg }"` );
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
        const result = services.platformActions
            ? await services.platformActions.skipTrack()
            : await services.hangSocketServices.skipSong( services );
        if ( result && !result.success ) throw new Error( result.error );
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

    const senderRole = context?.fullMessage?.roomRole || context?.fullMessage?.platformRole ||
        ( typeof stateService?.getUserRole === 'function' ? stateService.getUserRole( context.sender ) : 'user' );

    if ( !hasPermission( services, senderRole, 'MODERATOR' ) ) {
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
