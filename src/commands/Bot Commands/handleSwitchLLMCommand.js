// Set required role level for this command
const requiredRole = 'OWNER';
const description = 'Switch LLM backend (gemma or mistral)';
const example = 'switchllm mistral';
const hidden = false;
const config = require( '../../config' );
const { hasPermission } = require( '../../lib/roleUtils' );

/**
 * Handle the !switchllm command for switching LLM backends
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments (backend name)
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleSwitchLLMCommand ( commandParams ) {
    const { args, services, context, responseChannel = 'request' } = commandParams;
    const { messageService, machineLearningService, stateService, logger } = services;

    try {
        // Check if user has required permissions (owner only)
        const senderRole = stateService.getUserRole( context.sender );

        if ( !hasPermission( senderRole, requiredRole ) ) {
            const response = '❌ Only the room owner can switch LLM backends.';
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
                error: 'Insufficient permissions'
            };
        }

        // Parse backend name
        const backendName = args?.trim().toLowerCase();

        if ( !backendName ) {
            const cmdSwitch = config.COMMAND_SWITCH || '!';
            const response =
                '🤖 **LLM Backend Switching:**\n\n' +
                `\`${ cmdSwitch }switchllm gemma\` - Switch to Gemma backend\n` +
                `\`${ cmdSwitch }switchllm mistral\` - Switch to Mistral backend\n` +
                `\`${ cmdSwitch }llmstatus\` - Check current backend status\n\n` +
                '**Available backends:**\n' +
                '• gemma - Google Gemma 4 models\n' +
                '• mistral - Mistral AI models\n';

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

        // Validate backend name
        const validBackends = [ 'gemma', 'mistral' ];
        if ( !validBackends.includes( backendName ) ) {
            const response = `❌ Unknown backend: **${ backendName }**. Available backends: ${ validBackends.join( ', ' ) }`;
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

        // Get current backend
        const currentBackend = machineLearningService.getActiveBackend();

        if ( currentBackend === backendName ) {
            const response = `ℹ️ Already using **${ backendName }** backend.`;
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

        // Switch to the new backend
        logger.info( `🤖 [SwitchLLM] User ${ context.sender } switching from ${ currentBackend } to ${ backendName }` );
        const switchResult = await machineLearningService.switchBackend( backendName );

        if ( switchResult.success ) {
            const response = `✅ Successfully switched to **${ backendName }** backend. (from ${ currentBackend })`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );

            return {
                success: true,
                shouldRespond: true,
                response,
                notification: `🤖 Bot switched LLM backend from ${ currentBackend } to ${ backendName }`
            };
        } else {
            const response = `❌ Failed to switch to ${ backendName } backend: ${ switchResult.error || 'Unknown error' }`;
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
                error: switchResult.error
            };
        }
    } catch ( error ) {
        const response = `❌ Error switching LLM backend: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );

        return {
            success: false,
            response,
            error: error.message,
            shouldRespond: true
        };
    }
}

// Attach metadata to the function
handleSwitchLLMCommand.requiredRole = requiredRole;
handleSwitchLLMCommand.description = description;
handleSwitchLLMCommand.example = example;
handleSwitchLLMCommand.hidden = hidden;

module.exports = handleSwitchLLMCommand;
