/**
 * Helper utility for commands that query AI about the currently playing song
 * Provides common functionality for song-based AI commands like popfacts, whatyear, etc.
 */

/**
 * Executes a song-based AI command with standardized error handling and response formatting
 * @param {Object} commandParams - Standard command parameters
 * @param {Object} config - Command-specific configuration
 * @param {string} config.templateKey - Key in dataService for the question template (e.g., 'editableMessages.popfactsQuestion')
 * @param {string} config.defaultTemplate - Default template if dataService key not found
 * @param {string} config.commandName - Command name for logging (e.g., 'popfacts', 'whatyear')
 * @param {string} config.errorMessage - Custom error message for AI failures
 * @param {string} config.noSongMessage - Custom message when no song is playing
 * @param {Function} [config.responseFormatter] - Optional custom response formatter function
 * @returns {Promise<Object>} Command result
 */
async function executeSongAICommand ( commandParams, config ) {
    const { services, context, responseChannel = 'request' } = commandParams;
    const { messageService, machineLearningService, hangoutState, logger, dataService } = services;

    try {
        // Get the currently playing song from hangout state
        const nowPlaying = hangoutState?.nowPlaying;

        if ( !nowPlaying || !nowPlaying.song ) {
            const response = config.noSongMessage || '🎵 No song is currently playing. Start a song first and try again!';
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
                error: 'No song currently playing'
            };
        }

        const { trackName, artistName } = nowPlaying.song;

        if ( !trackName || !artistName ) {
            const response = '🎵 Unable to get song details. Please try again when a song is playing.';
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
                error: 'Missing song details'
            };
        }

        // Prepare the question for the AI
        // Try the new mlQuestions location first, then fall back to old editableMessages location
        let questionTemplate = dataService.getValue( config.templateKey );
        if ( !questionTemplate && config.templateKey.startsWith( 'editableMessages.' ) ) {
            // Try the new mlQuestions location for ML commands
            const mlKey = config.templateKey.replace( 'editableMessages.', 'mlQuestions.' );
            questionTemplate = dataService.getValue( mlKey );
        }
        questionTemplate = questionTemplate || config.defaultTemplate;

        const theQuestion = questionTemplate
            .replace( /\${trackName}/g, trackName )
            .replace( /\${artistName}/g, artistName );

        logger.debug( `[${ config.commandName }] Asking AI about: ${ trackName } by ${ artistName }` );

        // Get response from the machine learning service
        const aiResponse = await machineLearningService.askGoogleAI( theQuestion );

        // Format the response
        let response;
        if ( aiResponse && aiResponse !== "No response" && !aiResponse.includes( "error occurred" ) ) {
            // Use custom formatter if provided, otherwise use default
            if ( config.responseFormatter && typeof config.responseFormatter === 'function' ) {
                response = config.responseFormatter( trackName, artistName, aiResponse );
            } else {
                response = `🎵 **${ trackName }** by **${ artistName }**\n\n${ aiResponse }`;
            }
        } else {
            // Create specific error message with song details, customizing based on command
            if ( config.commandName === 'popfacts' ) {
                response = `🎵 Sorry, I couldn't get facts about "${ trackName }" by ${ artistName } right now. Please try again later.`;
            } else if ( config.commandName === 'whatyear' ) {
                response = `🎵 Sorry, I couldn't find the release year for "${ trackName }" by ${ artistName } right now. Please try again later.`;
            } else {
                response = config.errorMessage || `🎵 Sorry, I couldn't get information about "${ trackName }" by ${ artistName } right now. Please try again later.`;
            }
        }

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
        logger.error( `[${ config.commandName }] Error getting song facts: ${ error.message }` );

        // Use command-specific error message for catch block
        let response;
        if ( config.commandName === 'popfacts' ) {
            response = '🎵 Sorry, there was an error getting song facts. Please try again later.';
        } else if ( config.commandName === 'whatyear' ) {
            response = '🎵 Sorry, there was an error getting release year information. Please try again later.';
        } else {
            response = config.errorMessage || '🎵 Sorry, there was an error getting song information. Please try again later.';
        }

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

module.exports = {
    executeSongAICommand
};