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

        // Get additional context for token replacement
        const currentDjUuid = services.hangoutState?.djs?.[ 0 ]?.uuid;
        let username = 'Someone';
        let usernameMention = 'Someone';

        if ( currentDjUuid ) {
            try {
                // Get actual display name for AI context
                username = await services.hangUserService.getUserNicknameByUuid( currentDjUuid );
                // Create mention format for final response
                usernameMention = `<@uid:${ currentDjUuid }>`;
            } catch ( error ) {
                logger.debug( `[${ config.commandName }] Could not get DJ username for UUID ${ currentDjUuid }: ${ error.message }` );
                // Fallback to command sender if DJ username lookup fails
                username = context?.sender?.username || 'Someone';
                usernameMention = username;
            }
        } else {
            // Fallback to command sender if no current DJ
            username = context?.sender?.username || 'Someone';
            usernameMention = username;
        }

        const hangoutName = services.stateService.getHangoutName();
        const botName = dataService.getValue( 'botData.CHAT_NAME' ) || 'Bot';

        const theQuestion = questionTemplate
            .replace( /\{trackName\}/g, trackName )
            .replace( /\{artistName\}/g, artistName )
            .replace( /\{username\}/g, username )
            .replace( /\{hangoutName\}/g, hangoutName )
            .replace( /\{botName\}/g, botName );

        logger.debug( `[${ config.commandName }] Asking AI about: ${ trackName } by ${ artistName }` );

        // Get response from the machine learning service
        const aiResponse = await machineLearningService.askGoogleAI( theQuestion );

        // Debug: Log the raw AI response
        logger.debug( `[${ config.commandName }] Raw AI response: "${ aiResponse }"` );
        logger.debug( `[${ config.commandName }] AI response type: ${ typeof aiResponse }` );
        logger.debug( `[${ config.commandName }] AI response length: ${ aiResponse ? aiResponse.length : 'null/undefined' }` );

        // Check response validity
        const isValidResponse = aiResponse && aiResponse !== "No response" && !aiResponse.includes( "error occurred" );
        logger.debug( `[${ config.commandName }] Is valid response: ${ isValidResponse }` );

        if ( !isValidResponse ) {
            logger.warn( `[${ config.commandName }] Invalid AI response detected - aiResponse: "${ aiResponse }"` );
        }

        // Replace DJ display name with mention format in AI response
        let processedAiResponse = aiResponse;
        if ( aiResponse && username !== 'Someone' && username !== usernameMention ) {
            logger.debug( `[${ config.commandName }] Attempting mention replacement - username: "${ username }", mention: "${ usernameMention }"` );

            // Replace all instances of the display name with the mention format
            const usernameRegex = new RegExp( username.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ), 'g' );
            processedAiResponse = aiResponse.replace( usernameRegex, usernameMention );

            if ( processedAiResponse !== aiResponse ) {
                logger.debug( `[${ config.commandName }] Mention replacement performed - original: "${ aiResponse }", processed: "${ processedAiResponse }"` );
            } else {
                logger.debug( `[${ config.commandName }] No mention replacement needed - username not found in response` );
            }
        } else {
            logger.debug( `[${ config.commandName }] Skipping mention replacement - aiResponse: ${ !!aiResponse }, username: "${ username }", mention: "${ usernameMention }"` );
        }

        // Format the response
        let response;
        logger.debug( `[${ config.commandName }] Processing AI response for formatting - valid: ${ !!processedAiResponse && processedAiResponse !== "No response" && !processedAiResponse.includes( "error occurred" ) }` );

        if ( processedAiResponse && processedAiResponse !== "No response" && !processedAiResponse.includes( "error occurred" ) ) {
            logger.debug( `[${ config.commandName }] Using AI response - has custom formatter: ${ !!( config.responseFormatter && typeof config.responseFormatter === 'function' ) }` );

            // Use custom formatter if provided, otherwise use default
            if ( config.responseFormatter && typeof config.responseFormatter === 'function' ) {
                response = config.responseFormatter( trackName, artistName, processedAiResponse );
                logger.debug( `[${ config.commandName }] Custom formatter result: "${ response }"` );
            } else {
                response = `🎵 **${ trackName }** by **${ artistName }**\n\n${ processedAiResponse }`;
                logger.debug( `[${ config.commandName }] Default formatter result: "${ response }"` );
            }
        } else {
            logger.warn( `[${ config.commandName }] AI response failed validation, using error message` );
            logger.debug( `[${ config.commandName }] Failed response details - processedAiResponse: "${ processedAiResponse }", isNoResponse: ${ processedAiResponse === "No response" }, hasError: ${ processedAiResponse && processedAiResponse.includes( "error occurred" ) }` );

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
        logger.debug( `[${ config.commandName }] Error stack: ${ error.stack }` );

        // Safely log context variables that might not be defined
        try {
            const contextInfo = {
                trackName: typeof trackName !== 'undefined' ? trackName : 'undefined',
                artistName: typeof artistName !== 'undefined' ? artistName : 'undefined'
            };
            logger.debug( `[${ config.commandName }] Error context: ${ JSON.stringify( contextInfo ) }` );
        } catch ( debugError ) {
            logger.debug( `[${ config.commandName }] Could not log error context: ${ debugError.message }` );
        }

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