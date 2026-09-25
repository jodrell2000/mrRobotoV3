const config = require( '../../config.js' );

// Set required role level for this command
const requiredRole = 'MODERATOR';
const description = 'Monitor CometChat API connection status and circuit breakers';
const example = 'connectivity';
const hidden = false;

/**
 * Handle the connectivity command - shows circuit breaker status and connection health
 */
async function handleConnectivityCommand ( { command, args, services, context, responseChannel } ) {
    const { messageService, retryService } = services;

    try {
        // Get all circuit breaker statuses
        const circuitStatuses = retryService.getAllCircuitStatuses();

        let response = '🔌 **CometChat API Connectivity Status**\n\n';

        // Check if we have any circuit breakers
        const endpoints = Object.keys( circuitStatuses );

        if ( endpoints.length === 0 ) {
            response += '✅ No connection issues detected\n';
            response += '📊 All CometChat endpoints are healthy\n\n';
        } else {
            response += '📊 **Circuit Breaker Status:**\n\n';

            for ( const [ endpoint, status ] of Object.entries( circuitStatuses ) ) {
                const stateEmoji = status.state === 'CLOSED' ? '✅' :
                    status.state === 'OPEN' ? '🚫' : '⚠️';

                response += `${ stateEmoji } **${ endpoint }**\n`;
                response += `   State: ${ status.state }\n`;
                response += `   Failures: ${ status.failureCount }\n`;

                if ( status.lastFailureTime ) {
                    const timeSince = Date.now() - status.lastFailureTime;
                    const minutesAgo = Math.floor( timeSince / ( 1000 * 60 ) );
                    response += `   Last Failure: ${ minutesAgo }m ago\n`;
                }
                response += '\n';
            }
        }

        // Add help information
        response += '**Circuit Breaker States:**\n';
        response += '✅ CLOSED - Normal operation\n';
        response += '⚠️ HALF_OPEN - Testing recovery\n';
        response += '🚫 OPEN - Blocking requests\n\n';

        response += `**Commands:**\n`;
        response += `• \`${ config.COMMAND_SWITCH }connectivity reset <endpoint>\` - Reset specific circuit\n`;
        response += `• \`${ config.COMMAND_SWITCH }connectivity reset all\` - Reset all circuits`;

        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services,
    context
        } );

        return {
            success: true,
            shouldRespond: true,
            response
        };
    } catch ( error ) {
        const response = `❌ Failed to get connectivity status: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services,
    context
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
 * Handle reset subcommand
 */
async function handleResetCommand ( args, services, context, responseChannel ) {
    const { messageService, retryService } = services;

    if ( args.length === 0 ) {
        const response = `❌ Usage: \`${ config.COMMAND_SWITCH }connectivity reset <endpoint|all>\``;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services,
    context
        } );
        return {
            success: false,
            shouldRespond: true,
            response
        };
    }

    const target = args[ 0 ].toLowerCase();

    try {
        if ( target === 'all' ) {
            // Reset all circuit breakers
            const circuitStatuses = retryService.getAllCircuitStatuses();
            const endpoints = Object.keys( circuitStatuses );

            for ( const endpoint of endpoints ) {
                retryService.resetCircuitBreaker( endpoint );
            }

            const response = `✅ Reset ${ endpoints.length } circuit breakers: ${ endpoints.join( ', ' ) }`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services,
    context
            } );

            return {
                success: true,
                shouldRespond: true,
                response
            };
        } else {
            // Reset specific endpoint
            const circuitStatuses = retryService.getAllCircuitStatuses();
            const endpoints = Object.keys( circuitStatuses );
            const matchingEndpoint = endpoints.find( ep => ep.includes( target ) );

            if ( !matchingEndpoint ) {
                const response = `❌ Endpoint '${ target }' not found. Available: ${ endpoints.join( ', ' ) }`;
                await messageService.sendResponse( response, {
                    responseChannel,
                    isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                    sender: context?.sender,
                    services,
    context
                } );
                return {
                    success: false,
                    shouldRespond: true,
                    response
                };
            }

            retryService.resetCircuitBreaker( matchingEndpoint );

            const response = `✅ Reset circuit breaker for: ${ matchingEndpoint }`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services,
    context
            } );

            return {
                success: true,
                shouldRespond: true,
                response
            };
        }
    } catch ( error ) {
        const response = `❌ Failed to reset circuit breaker: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services,
    context
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
 * Main command handler with subcommand routing
 */
async function handleConnectivityCommandWithSubcommands ( { command, args, services, context, responseChannel } ) {
    // Handle subcommands
    if ( args.length > 0 ) {
        const subcommand = args[ 0 ].toLowerCase();

        if ( subcommand === 'reset' ) {
            return await handleResetCommand( args.slice( 1 ), services, context, responseChannel );
        }
    }

    // Default to status display
    return await handleConnectivityCommand( { command, args, services, context, responseChannel } );
}

// Attach metadata to the function
handleConnectivityCommandWithSubcommands.requiredRole = requiredRole;
handleConnectivityCommandWithSubcommands.description = description;
handleConnectivityCommandWithSubcommands.example = example;
handleConnectivityCommandWithSubcommands.hidden = hidden;

module.exports = handleConnectivityCommandWithSubcommands;