/**
 * Extract duration and reason from arguments
 * Expected format: [duration + unit] [reason...]
 * Units: s/sec/second/m/min/minute/h/hour/d/day
 * Examples: "5m spam", "1h", "2d repeated warnings"
 * @param {string[]} args - Arguments array
 * @returns {Object} { duration (ms or null for permanent), label (human readable), reason }
 */
function extractDurationAndReason ( args ) {
    if ( !args || args.length === 0 ) {
        return { duration: null, label: null, reason: null };
    }

    const firstArg = String( args[ 0 ] ).toLowerCase();
    const durationMatch = firstArg.match( /^(\d+)([smhd]|sec|second|min|minute|hour|day)/ );

    if ( !durationMatch ) {
        // No duration found, treat entire args as reason
        return {
            duration: null,
            label: null,
            reason: args.join( ' ' )
        };
    }

    const value = parseInt( durationMatch[ 1 ], 10 );
    const unit = durationMatch[ 2 ];

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

    // Reason is everything after the duration
    const reasonParts = args.slice( 1 );
    const reason = reasonParts.length > 0 ? reasonParts.join( ' ' ) : null;

    return { duration: durationMs, label, reason };
}

async function handleMuteUser ( nameArg, durationArg, reasonArg, services, context, responseChannel ) {
    if ( !nameArg ) {
        return {
            success: false,
            shouldRespond: true,
            response: '❌ Please specify a username to mute. Usage: !mod mute <username> [duration] [reason]'
        };
    }

    const users = services.stateService?.getUsers?.();
    if ( !users || users.length === 0 ) {
        return {
            success: false,
            shouldRespond: true,
            response: '❌ No users found in the hangout'
        };
    }

    // Find user by name (case-insensitive, partial match)
    const targetName = String( nameArg ).toLowerCase();
    let targetUser = null;

    for ( const user of users ) {
        if ( user.nickname && String( user.nickname ).toLowerCase().includes( targetName ) ) {
            targetUser = user;
            break;
        }
    }

    if ( !targetUser ) {
        return {
            success: false,
            shouldRespond: true,
            response: `❌ User "${ nameArg }" not found`
        };
    }

    // Parse duration and reason
    const reasonArgs = reasonArg ? [ durationArg, reasonArg ].filter( Boolean ) : ( durationArg ? [ durationArg ] : [] );
    const { duration, label, reason } = extractDurationAndReason( reasonArgs );

    try {
        const response = await services.platformActions.muteUser( targetUser.userId, duration );

        if ( !response.supported ) {
            return {
                success: false,
                shouldRespond: true,
                response: `❌ Mute is not supported on this framework`
            };
        }

        if ( !response.success ) {
            return {
                success: false,
                shouldRespond: true,
                response: `❌ Failed to mute ${ targetUser.nickname }: ${ response.error || 'Unknown error' }`,
                error: response.error
            };
        }

        let confirmMessage = `✅ Muted ${ targetUser.nickname }`;
        if ( label ) {
            confirmMessage += ` for ${ label }`;
        } else {
            confirmMessage += ` permanently`;
        }
        if ( reason ) {
            confirmMessage += ` — Reason: ${ reason }`;
        }

        await services.messageService.sendResponse( {
            responseChannel,
            isPrivateMessage: false,
            sender: context.sender,
            services,
            response: confirmMessage
        } );

        return {
            success: true,
            shouldRespond: false
        };
    } catch ( error ) {
        return {
            success: false,
            shouldRespond: true,
            response: `❌ Error muting user: ${ error.message }`,
            error: error.message
        };
    }
}

async function handleUnmuteUser ( nameArg, services, context, responseChannel ) {
    if ( !nameArg ) {
        return {
            success: false,
            shouldRespond: true,
            response: '❌ Please specify a username to unmute. Usage: !mod unmute <username>'
        };
    }

    const users = services.stateService?.getUsers?.();
    if ( !users || users.length === 0 ) {
        return {
            success: false,
            shouldRespond: true,
            response: '❌ No users found in the hangout'
        };
    }

    // Find user by name (case-insensitive, partial match)
    const targetName = String( nameArg ).toLowerCase();
    let targetUser = null;

    for ( const user of users ) {
        if ( user.nickname && String( user.nickname ).toLowerCase().includes( targetName ) ) {
            targetUser = user;
            break;
        }
    }

    if ( !targetUser ) {
        return {
            success: false,
            shouldRespond: true,
            response: `❌ User "${ nameArg }" not found`
        };
    }

    try {
        const response = await services.platformActions.unmuteUser( targetUser.userId );

        if ( !response.supported ) {
            return {
                success: false,
                shouldRespond: true,
                response: `❌ Unmute is not supported on this framework`
            };
        }

        if ( !response.success ) {
            return {
                success: false,
                shouldRespond: true,
                response: `❌ Failed to unmute ${ targetUser.nickname }: ${ response.error || 'Unknown error' }`,
                error: response.error
            };
        }

        await services.messageService.sendResponse( {
            responseChannel,
            isPrivateMessage: false,
            sender: context.sender,
            services,
            response: `✅ Unmuted ${ targetUser.nickname }`
        } );

        return {
            success: true,
            shouldRespond: false
        };
    } catch ( error ) {
        return {
            success: false,
            shouldRespond: true,
            response: `❌ Error unmuting user: ${ error.message }`,
            error: error.message
        };
    }
}

async function handleMuteCommand ( { command, args, services, context, responseChannel } ) {
    const [ subcommand, ...subcommandArgs ] = args;

    if ( !subcommand ) {
        return {
            success: false,
            shouldRespond: true,
            response: '❌ Subcommand required. Usage: !mod mute <username> [duration] [reason] or !mod unmute <username>'
        };
    }

    const subcommandLower = String( subcommand ).toLowerCase();

    if ( subcommandLower === 'mute' ) {
        return handleMuteUser( subcommandArgs[ 0 ], subcommandArgs[ 1 ], subcommandArgs.slice( 2 ).join( ' ' ), services, context, responseChannel );
    }

    if ( subcommandLower === 'unmute' ) {
        return handleUnmuteUser( subcommandArgs[ 0 ], services, context, responseChannel );
    }

    return {
        success: false,
        shouldRespond: true,
        response: '❌ Unknown subcommand. Use: !mod mute <username> or !mod unmute <username>'
    };
}

handleMuteCommand.requiredRole = 'MODERATOR';
handleMuteCommand.description = 'Mute or unmute a user';
handleMuteCommand.example = '!mod mute username 5m spam | !mod unmute username';
handleMuteCommand.hidden = false;

module.exports = handleMuteCommand;
