// Set required role level for this command
const requiredRole = 'USER';
const description = 'Check LLM backend status';
const example = 'llmstatus';
const hidden = false;

/**
 * Shows the current LLM backend status
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleLLMStatusCommand ( commandParams ) {
    const { services, context, responseChannel = 'request' } = commandParams;
    const { messageService, machineLearningService } = services;

    try {
        const activeBackend = machineLearningService.getActiveBackend();
        const healthResult = await machineLearningService.healthCheck();

        let response = `🤖 LLM Backend Status:\n`;
        response += `📡 Active Backend: **${ activeBackend }**\n`;
        response += `💓 Status: ${ healthResult.healthy ? '✅ Healthy' : '❌ Unhealthy' }\n`;
        response += `📝 Details: ${ healthResult.message }`;

        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );

        return {
            success: true,
            response,
            shouldRespond: true
        };
    } catch ( error ) {
        const response = `❌ Error checking LLM status: ${ error.message }`;
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
handleLLMStatusCommand.requiredRole = requiredRole;
handleLLMStatusCommand.description = description;
handleLLMStatusCommand.example = example;
handleLLMStatusCommand.hidden = hidden;

module.exports = handleLLMStatusCommand;
