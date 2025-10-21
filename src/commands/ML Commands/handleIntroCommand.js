const { executeSongAICommand } = require( '../../lib/songAICommandHelper' );

// Set required role level for this command
const requiredRole = 'USER';
const description = 'Get an introduction to the currently playing artist';
const example = 'intro';
const hidden = false;

/**
 * Handle the !intro command
 * Gets an introduction to the currently playing artist using AI
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments (not used for this command)
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleIntroCommand ( commandParams ) {
    const config = {
        templateKey: 'mlQuestions.introQuestion',
        defaultTemplate: 'I\'m listening to {artistName}. Give me a brief introduction to this artist. Include when they started, their genre, and why they\'re notable. Keep it under 150 words.',
        commandName: 'intro',
        errorMessage: '🎵 Sorry, I couldn\'t get an introduction to that artist right now. Please try again later.',
        noSongMessage: '🎵 No song is currently playing. Start a song first and try again!',
        responseFormatter: ( trackName, artistName, aiResponse, additionalData ) => {
            // Get the current DJ info for mention replacement
            const { djUuid, djUsername, services } = additionalData || {};
            
            let formattedResponse = aiResponse;
            
            // Replace DJ name with mention if we have the DJ info and it appears in the response
            if ( djUuid && djUsername && services?.messageService?.formatMention ) {
                // Create the mention format
                const djMention = services.messageService.formatMention( djUuid );
                
                // Replace any occurrence of the DJ's username in the AI response with the mention
                // Use word boundaries to avoid partial replacements
                const djNameRegex = new RegExp( `\\b${ djUsername.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) }\\b`, 'gi' );
                formattedResponse = formattedResponse.replace( djNameRegex, djMention );
            }
            
            return formattedResponse;
        }
    };

    return await executeSongAICommand( commandParams, config );
}

// Attach metadata to the function
handleIntroCommand.requiredRole = requiredRole;
handleIntroCommand.description = description;
handleIntroCommand.example = example;
handleIntroCommand.hidden = hidden;

module.exports = handleIntroCommand;