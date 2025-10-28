const config = require( '../../config.js' );

// Set required role level for this command
const requiredRole = 'OWNER';
const description = 'Debug message processing and connection status';
const example = 'debug';
const hidden = false;

/**
 * Handle the debug command - shows detailed system status for troubleshooting
 */
async function handleDebugCommand ( { command, args, services, context, responseChannel } ) {
    const { messageService, retryService } = services;

    try {
        let response = '🔍 **Debug Information**\n\n';

        // Check retry service circuit breakers
        const circuitStatuses = retryService.getAllCircuitStatuses();
        response += `**Circuit Breaker Status:**\n`;

        if ( Object.keys( circuitStatuses ).length === 0 ) {
            response += '✅ No circuit breakers triggered\n';
        } else {
            for ( const [ endpoint, status ] of Object.entries( circuitStatuses ) ) {
                const stateEmoji = status.state === 'CLOSED' ? '✅' :
                    status.state === 'OPEN' ? '🚫' : '⚠️';
                response += `${ stateEmoji } ${ endpoint }: ${ status.state } (${ status.failureCount } failures)\n`;
            }
        }

        // Check bot status
        response += `\n**Bot Status:**\n`;
        response += `• Bot instance: ${ services.bot ? '✅ Available' : '❌ Missing' }\n`;
        response += `• Socket connection: ${ services.socket ? '✅ Connected' : '❌ Disconnected' }\n`;
        response += `• Hangout state: ${ services.hangoutState ? '✅ Available' : '❌ Missing' }\n`;

        // Check message processing flags
        if ( services.bot ) {
            response += `• Public processing: ${ services.bot.isProcessingPublicMessages ? '🔄 Active' : '✅ Ready' }\n`;
            response += `• Private processing: ${ services.bot.isProcessingPrivateMessages ? '🔄 Active' : '✅ Ready' }\n`;
        }

        // Check services
        response += `\n**Services Status:**\n`;
        response += `• Message Service: ${ services.messageService ? '✅' : '❌' }\n`;
        response += `• Command Service: ${ services.commandService ? '✅' : '❌' }\n`;
        response += `• Data Service: ${ services.dataService ? '✅' : '❌' }\n`;
        response += `• Retry Service: ${ services.retryService ? '✅' : '❌' }\n`;

        // Recent message tracking
        if ( services.bot && services.bot.lastMessageIDs ) {
            response += `\n**Message Tracking:**\n`;
            response += `• Last message ID: ${ services.bot.lastMessageIDs.id || 'None' }\n`;
            response += `• From timestamp: ${ services.bot.lastMessageIDs.fromTimestamp || 'None' }\n`;
        }

        // Configuration check
        response += `\n**Configuration:**\n`;
        response += `• Bot UID: ${ services.config.BOT_UID ? '✅ Set' : '❌ Missing' }\n`;
        response += `• Hangout ID: ${ services.config.HANGOUT_ID ? '✅ Set' : '❌ Missing' }\n`;
        response += `• CometChat API Key: ${ services.config.COMETCHAT_API_KEY ? '✅ Set' : '❌ Missing' }\n`;

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
        const response = `❌ Failed to get debug information: ${ error.message }`;
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

// Attach metadata to the function
handleDebugCommand.requiredRole = requiredRole;
handleDebugCommand.description = description;
handleDebugCommand.example = example;
handleDebugCommand.hidden = hidden;

module.exports = handleDebugCommand;