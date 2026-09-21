'use strict';

const config = require( '../../config' );
const { hasPermission } = require( '../../services/permissionService.js' );

const requiredRole = 'MODERATOR';
const description = 'Moderator tools (anonymous)';
const example = 'mod listUsers | mod remove "DJ Name" | mod skip | mod requeue "DJ Name" 3 | mod kick "User Name" | mod mute "User Name" 5m spam | mod unmute "User Name"';
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
        const result = await services.platformActions.removeFromDJQueue( userId );
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

async function handleRequeueUser ( nameArg, positionArg, services, context, responseChannel ) {
    const { stateService, messageService } = services;
    const logger = services.logger;

    if ( !nameArg || !positionArg ) {
        const response = 'Usage: !mod requeue <name> <position>';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Missing name or position' };
    }

    const position = parseInt( positionArg, 10 );
    if ( isNaN( position ) || position < 0 ) {
        const response = '❌ Position must be a non-negative number.';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Invalid position' };
    }

    if ( logger ) logger.debug( `[mod requeue] Starting requeue of user: "${ nameArg }" to position ${ position }` );

    // Get all users using framework-agnostic method
    const users = stateService.getUsers();
    if ( logger ) logger.debug( `[mod requeue] Found ${ users?.length || 0 } total users` );

    const matchedUser = users.find(
        user => ( user?.nickname || user?.userProfile?.nickname )?.toLowerCase() === nameArg.toLowerCase()
    );

    if ( !matchedUser ) {
        if ( logger ) logger.warn( `[mod requeue] User "${ nameArg }" not found in user list` );
        const response = `❌ No user found with name "${ nameArg }".`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'User not found' };
    }

    // Get user ID (handles both frameworks)
    const userId = matchedUser.id || matchedUser.uuid;
    if ( logger ) logger.debug( `[mod requeue] Matched user "${ nameArg }" -> userId: "${ userId }"` );

    // Get DJ queue using framework-agnostic method
    const djQueue = stateService.getDjQueue();
    if ( logger ) logger.debug( `[mod requeue] DJ queue size: ${ djQueue?.length || 0 }` );

    if ( !djQueue.some( dj => ( dj.userId || dj.uuid ) === userId ) ) {
        if ( logger ) logger.warn( `[mod requeue] User "${ userId }" is not on the decks` );
        const response = `❌ "${ nameArg }" is not currently on the decks.`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Not on decks' };
    }

    if ( logger ) logger.info( `[mod requeue] Moving "${ nameArg }" to position ${ position }` );

    try {
        const result = await services.platformActions.moveInQueue( userId, position );
        if ( logger ) logger.debug( `[mod requeue] platformActions result: ${ JSON.stringify( result ) }` );
        if ( result && !result.success ) throw new Error( result.error );
    } catch ( err ) {
        if ( logger ) logger.error( `[mod requeue] Failed to requeue user: ${ err.message }` );
        const response = `❌ Failed to move "${ nameArg }": ${ err.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: err.message };
    }

    if ( logger ) logger.info( `[mod requeue] Successfully moved "${ nameArg }" to position ${ position }` );
    const response = `✅ "${ nameArg }" moved to position ${ position }.`;
    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: true, shouldRespond: true, response };
}

async function handleKickUser ( nameArg, reasonArg, services, context, responseChannel ) {
    const { stateService, messageService, platformActions } = services;
    const logger = services.logger;

    if ( !nameArg ) {
        const response = 'Usage: !mod kick <name> [reason]';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Missing username' };
    }

    if ( logger ) logger.debug( `[mod kick] Starting kick of user: "${ nameArg }"` );

    // Get all users using framework-agnostic method (works for both Hang and Wavez)
    const users = stateService.getUsers();
    if ( logger ) logger.debug( `[mod kick] Found ${ users?.length || 0 } total users` );

    const matchedUser = users.find(
        user => ( user?.nickname || user?.userProfile?.nickname )?.toLowerCase() === nameArg.toLowerCase()
    );

    if ( !matchedUser ) {
        if ( logger ) logger.warn( `[mod kick] User "${ nameArg }" not found in user list` );
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
    if ( logger ) logger.debug( `[mod kick] Matched user "${ nameArg }" -> userId: "${ userId }"` );

    if ( logger ) logger.info( `[mod kick] User "${ nameArg }" matched with userId "${ userId }", calling platformActions.kickUser()` );

    try {
        const result = await platformActions.kickUser( userId, reasonArg );

        if ( result && !result.success ) {
            if ( logger ) logger.warn( `[mod kick] Kick failed: ${ result.error }` );
            const response = `❌ Failed to kick "${ nameArg }": ${ result.error || 'Unknown error' }`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: result.error };
        }

        const reasonText = reasonArg ? ` (Reason: ${ reasonArg })` : '';
        const response = `✅ "${ nameArg }" has been kicked from the room${ reasonText }.`;
        if ( logger ) logger.info( `[mod kick] Successfully kicked "${ nameArg }" (${ userId })` );

        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: true, shouldRespond: true, response };
    } catch ( err ) {
        if ( logger ) logger.error( `[mod kick] Exception during kick: ${ err.message }` );
        const response = `❌ Error kicking "${ nameArg }": ${ err.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: err.message };
    }
}

async function handleMuteUser ( nameArg, durationArg, reasonArg, services, context, responseChannel ) {
    const { stateService, messageService } = services;
    const logger = services.logger;

    if ( !nameArg ) {
        const response = 'Usage: !mod mute <name> [duration] [reason]';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Missing username' };
    }

    const users = stateService?.getUsers?.() || Object.values( stateService?._getAllUserData?.() || {} );
    if ( !users || users.length === 0 ) {
        const response = '❌ No users found in the hangout';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response };
    }

    if ( logger ) logger.debug( `[mod mute] Starting mute of user: "${ nameArg }"` );

    if ( logger ) logger.debug( `[mod mute] Found ${ users?.length || 0 } total users` );

    // Find user by name (case-insensitive, partial match)
    const targetName = String( nameArg ).toLowerCase();
    let targetUser = null;
    let userId = null;

    for ( const user of users ) {
        const userNickname = user?.nickname || user?.userProfile?.nickname;
        if ( userNickname && String( userNickname ).toLowerCase().includes( targetName ) ) {
            targetUser = user;
            userId = user?.userId || user?.id;
            break;
        }
    }

    if ( !targetUser || !userId ) {
        if ( logger ) logger.warn( `[mod mute] User "${ nameArg }" not found in user list` );
        const response = `❌ User "${ nameArg }" not found`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: `User "${ nameArg }" not found` };
    }

    const userNickname = targetUser?.nickname || targetUser?.userProfile?.nickname;
    if ( logger ) logger.debug( `[mod mute] Matched user "${ nameArg }" -> userId: "${ userId }"` );
    if ( logger ) logger.info( `[mod mute] User "${ nameArg }" matched with userId "${ userId }", calling platformActions.muteUser()` );

    try {
        // Parse duration and reason
        const reasonArgs = [];
        if ( durationArg ) reasonArgs.push( durationArg );
        if ( reasonArg ) reasonArgs.push( reasonArg );

        const { duration, label } = extractDurationAndReason( reasonArgs );

        const result = await services.platformActions.muteUser( userId, duration );

        if ( !result.supported ) {
            if ( logger ) logger.warn( `[mod mute] Mute not supported` );
            const response = '❌ Mute is not supported on this framework';
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: 'Mute not supported' };
        }

        if ( !result.success ) {
            if ( logger ) logger.warn( `[mod mute] Mute failed: ${ result.error }` );
            const response = `❌ Failed to mute "${ userNickname }": ${ result.error || 'Unknown error' }`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: `Failed to mute: ${ result.error }` };
        }

        let confirmMessage = `✅ "${ userNickname }" has been muted`;
        if ( label ) {
            confirmMessage += ` for ${ label }`;
        } else {
            confirmMessage += ` permanently`;
        }
        if ( reasonArg ) {
            confirmMessage += ` — Reason: ${ reasonArg }`;
        }
        confirmMessage += '.';

        await messageService.sendResponse( confirmMessage, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );

        if ( logger ) logger.info( `[mod mute] Successfully muted "${ userNickname }" (${ userId })` );
        return { success: true, shouldRespond: false };
    } catch ( err ) {
        if ( logger ) logger.error( `[mod mute] Exception during mute: ${ err.message }` );
        const response = `❌ Error muting "${ userNickname }": ${ err.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: err.message };
    }
}

async function handleUnmuteUser ( nameArg, services, context, responseChannel ) {
    const { stateService, messageService } = services;
    const logger = services.logger;

    if ( !nameArg ) {
        const response = 'Usage: !mod unmute <name>';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Missing username' };
    }

    const users = stateService?.getUsers?.() || Object.values( stateService?._getAllUserData?.() || {} );
    if ( !users || users.length === 0 ) {
        const response = '❌ No users found in the hangout';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response };
    }

    if ( logger ) logger.debug( `[mod unmute] Starting unmute of user: "${ nameArg }"` );

    // Find user by name (case-insensitive, partial match)
    const targetName = String( nameArg ).toLowerCase();
    let targetUser = null;
    let userId = null;

    for ( const user of users ) {
        const userNickname = user?.nickname || user?.userProfile?.nickname;
        if ( userNickname && String( userNickname ).toLowerCase().includes( targetName ) ) {
            targetUser = user;
            userId = user?.userId || user?.id;
            break;
        }
    }

    if ( !targetUser || !userId ) {
        if ( logger ) logger.warn( `[mod unmute] User "${ nameArg }" not found in user list` );
        const response = `❌ User "${ nameArg }" not found`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: `User "${ nameArg }" not found` };
    }

    const userNickname = targetUser?.nickname || targetUser?.userProfile?.nickname;
    if ( logger ) logger.debug( `[mod unmute] Matched user "${ nameArg }" -> userId: "${ userId }"` );
    if ( logger ) logger.info( `[mod unmute] User "${ nameArg }" matched with userId "${ userId }", calling platformActions.unmuteUser()` );

    try {
        const result = await services.platformActions.unmuteUser( userId );

        if ( !result.supported ) {
            if ( logger ) logger.warn( `[mod unmute] Unmute not supported` );
            const response = '❌ Unmute is not supported on this framework';
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response };
        }

        if ( !result.success ) {
            if ( logger ) logger.warn( `[mod unmute] Unmute failed: ${ result.error }` );
            const response = `❌ Failed to unmute "${ userNickname }": ${ result.error || 'Unknown error' }`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: `Failed to unmute: ${ result.error }` };
        }

        const response = `✅ "${ userNickname }" has been unmuted.`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );

        if ( logger ) logger.info( `[mod unmute] Successfully unmuted "${ userNickname }" (${ userId })` );
        return { success: true, shouldRespond: false };
    } catch ( err ) {
        if ( logger ) logger.error( `[mod unmute] Exception during unmute: ${ err.message }` );
        const response = `❌ Error unmuting "${ userNickname }": ${ err.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: err.message };
    }
}

function extractDurationAndReason ( args ) {
    if ( !args || args.length === 0 ) {
        return { duration: null, label: null, reason: null };
    }

    const firstArg = String( args[ 0 ] ).toLowerCase();
    // Match digits optionally followed by a unit (s/m/h/d or verbose forms)
    // If no unit is provided, default to minutes
    const durationMatch = firstArg.match( /^(\d+)([smhd]|sec|second|min|minute|hour|day)?/ );

    if ( !durationMatch || !durationMatch[ 1 ] ) {
        return {
            duration: null,
            label: null,
            reason: args.join( ' ' )
        };
    }

    const value = parseInt( durationMatch[ 1 ], 10 );
    const unit = durationMatch[ 2 ] || 'm'; // Default to minutes if no unit provided

    let multiplier = 1;
    let unitLabel = unit;

    if ( unit === 's' || unit === 'sec' || unit === 'second' ) {
        multiplier = 1000;
        unitLabel = 's';
    } else if ( unit === 'm' || unit === 'min' || unit === 'minute' ) {
        multiplier = 60 * 1000;
        unitLabel = 'm';
    } else if ( unit === 'h' || unit === 'hour' ) {
        multiplier = 60 * 60 * 1000;
        unitLabel = 'h';
    } else if ( unit === 'd' || unit === 'day' ) {
        multiplier = 24 * 60 * 60 * 1000;
        unitLabel = 'd';
    }

    const durationMs = value * multiplier;
    const label = `${ value }${ unitLabel }`;

    const reasonParts = args.slice( 1 );
    const reason = reasonParts.length > 0 ? reasonParts.join( ' ' ) : null;

    return { duration: durationMs, label, reason };
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

    if ( subCommand === 'requeue' ) {
        const nameArg = argParts.slice( 1, -1 ).join( ' ' ).replace( /^"|"$/g, '' );
        const positionArg = argParts[ argParts.length - 1 ];
        return handleRequeueUser( nameArg, positionArg, services, context, responseChannel );
    }

    if ( subCommand === 'kick' ) {
        // Extract quoted name and optional reason
        let kickName = '';
        let kickReason = '';

        const fullArgsString = args.substring( args.indexOf( 'kick' ) + 4 ).trim();
        const quotedMatch = fullArgsString.match( /"([^"]*)"\s*(.*)/ );

        if ( quotedMatch ) {
            kickName = quotedMatch[ 1 ];
            kickReason = quotedMatch[ 2 ]?.trim() || '';
        } else {
            // No quotes, take first word as name, rest as reason
            const parts = fullArgsString.split( /\s+/ );
            kickName = parts[ 0 ];
            kickReason = parts.slice( 1 ).join( ' ' );
        }

        return handleKickUser( kickName, kickReason, services, context, responseChannel );
    }

    if ( subCommand === 'mute' ) {
        // Extract quoted name, optional duration, and optional reason
        let muteName = '';
        let muteDuration = '';
        let muteReason = '';

        const fullArgsString = args.substring( args.indexOf( 'mute' ) + 4 ).trim();
        const quotedMatch = fullArgsString.match( /"([^"]*)"\s*(.*)/ );

        if ( quotedMatch ) {
            muteName = quotedMatch[ 1 ];
            const remaining = quotedMatch[ 2 ]?.trim() || '';
            const remainingParts = remaining.split( /\s+/ );
            if ( remainingParts.length > 0 && /^\d+[smhd]/.test( remainingParts[ 0 ] ) ) {
                muteDuration = remainingParts[ 0 ];
                muteReason = remainingParts.slice( 1 ).join( ' ' );
            } else {
                muteReason = remaining;
            }
        } else {
            // No quotes, take first word as name
            const parts = fullArgsString.split( /\s+/ );
            muteName = parts[ 0 ];
            if ( parts.length > 1 && /^\d+[smhd]/.test( parts[ 1 ] ) ) {
                muteDuration = parts[ 1 ];
                muteReason = parts.slice( 2 ).join( ' ' );
            } else {
                muteReason = parts.slice( 1 ).join( ' ' );
            }
        }

        return handleMuteUser( muteName, muteDuration, muteReason, services, context, responseChannel );
    }

    if ( subCommand === 'unmute' ) {
        // Extract quoted name
        let unmuteName = '';

        const fullArgsString = args.substring( args.indexOf( 'unmute' ) + 6 ).trim();
        const quotedMatch = fullArgsString.match( /"([^"]*)/ );

        if ( quotedMatch ) {
            unmuteName = quotedMatch[ 1 ];
        } else {
            // No quotes, take first word as name
            const parts = fullArgsString.split( /\s+/ );
            unmuteName = parts[ 0 ];
        }

        return handleUnmuteUser( unmuteName, services, context, responseChannel );
    }

    const cmdSwitch = config.COMMAND_SWITCH || '!';
    const response =
        `📋 **Mod Usage:**\n\n` +
        `\`${ cmdSwitch }mod listUsers\` — List all users in the hangout\n` +
        `\`${ cmdSwitch }mod remove <name>\` — Remove a DJ from the decks\n` +
        `\`${ cmdSwitch }mod skip\` — Skip the currently playing song\n` +
        `\`${ cmdSwitch }mod requeue <name> <position>\` — Move a DJ to a specific position in the queue\n` +
        `\`${ cmdSwitch }mod kick <name> [reason]\` — Kick a user from the room (Wavez only)\n` +
        `\`${ cmdSwitch }mod mute <name> [duration] [reason]\` — Mute a user (Wavez only). Duration: 5 (minutes), 5m, 1h, 2d\n` +
        `\`${ cmdSwitch }mod unmute <name>\` — Unmute a user (Wavez only)`;
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
