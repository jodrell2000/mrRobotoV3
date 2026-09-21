'use strict';

const config = require( '../../config' );
const { hasPermission } = require( '../../services/permissionService.js' );

const requiredRole = 'MODERATOR';
const description = 'Manage room settings (Wavez only)';
const example = 'roomSetting name "My Awesome Room" | roomSetting description "Where music happens"';
const hidden = false;

async function handleUpdateRoomName ( newName, services, context, responseChannel ) {
    const { messageService, logger } = services;

    if ( !newName || newName.trim().length === 0 ) {
        const response = 'Usage: !roomSetting name <new room name>';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Missing room name' };
    }

    if ( logger ) logger.debug( `[roomSetting name] Attempting to update room name to: "${ newName }"` );

    try {
        const result = await services.platformActions.updateRoomSettings( { name: newName.trim() } );
        if ( logger ) logger.debug( `[roomSetting name] platformActions result: ${ JSON.stringify( result ) }` );
        if ( result && !result.success ) throw new Error( result.error );
    } catch ( err ) {
        if ( logger ) logger.error( `[roomSetting name] Failed to update room name: ${ err.message }` );
        const response = `❌ Failed to update room name: ${ err.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: err.message };
    }

    if ( logger ) logger.info( `[roomSetting name] Successfully updated room name to "${ newName }"` );
    const response = `✅ Room name updated to: "${ newName }"`;
    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: true, shouldRespond: true, response };
}

async function handleUpdateRoomDescription ( newDescription, services, context, responseChannel ) {
    const { messageService, logger } = services;

    if ( !newDescription || newDescription.trim().length === 0 ) {
        const response = 'Usage: !roomSetting description <new description>';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Missing description' };
    }

    if ( logger ) logger.debug( `[roomSetting description] Attempting to update room description to: "${ newDescription }"` );

    try {
        const result = await services.platformActions.updateRoomSettings( { description: newDescription.trim() } );
        if ( logger ) logger.debug( `[roomSetting description] platformActions result: ${ JSON.stringify( result ) }` );
        if ( result && !result.success ) throw new Error( result.error );
    } catch ( err ) {
        if ( logger ) logger.error( `[roomSetting description] Failed to update room description: ${ err.message }` );
        const response = `❌ Failed to update room description: ${ err.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: err.message };
    }

    if ( logger ) logger.info( `[roomSetting description] Successfully updated room description` );
    const response = `✅ Room description updated to: "${ newDescription }"`;
    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: true, shouldRespond: true, response };
}

async function handleRoomSettingCommand ( commandParams ) {
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

    if ( subCommand === 'name' ) {
        const newName = argParts.slice( 1 ).join( ' ' ).replace( /^"|"$/g, '' );
        return handleUpdateRoomName( newName, services, context, responseChannel );
    }

    if ( subCommand === 'description' ) {
        const newDescription = argParts.slice( 1 ).join( ' ' ).replace( /^"|"$/g, '' );
        return handleUpdateRoomDescription( newDescription, services, context, responseChannel );
    }

    const cmdSwitch = config.COMMAND_SWITCH || '!';
    const response =
        `📋 **Room Setting Usage:**\n\n` +
        `\`${ cmdSwitch }roomSetting name <name>\` — Update room name\n` +
        `\`${ cmdSwitch }roomSetting description <description>\` — Update room description\n\n` +
        `**Note:** Room settings are only supported on Wavez.fm. Hang.fm changes must be made through the UI.`;
    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: false, shouldRespond: true, response, error: 'Unknown subcommand' };
}

handleRoomSettingCommand.requiredRole = requiredRole;
handleRoomSettingCommand.description = description;
handleRoomSettingCommand.example = example;
handleRoomSettingCommand.hidden = hidden;

module.exports = handleRoomSettingCommand;
