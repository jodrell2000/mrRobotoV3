const { executeSongAICommand } = require( '../../lib/songAICommandHelper' );

// Set required role level for this command
const requiredRole = 'USER';
const description = 'Tell me something about the band currently playing';
const example = 'band';
const hidden = false;

/**
 * Handle the !band command
 * Gets interesting facts about the currently playing song using AI
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments (not used for this command)
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleBandCommand ( commandParams ) {
    const config = {
        templateKey: 'mlQuestions.bandQuestion',
        defaultTemplate: 'I\'m currently listening to {artistName}. Tell me about them. Include facts such as when and where they formed, when their first and most notable or recent releases were, how well these releases performed in the charts in both the UK and USA, and about any notable former band members. Keep your response under 300 words',
        commandName: 'band',
        errorMessage: '🎵 Sorry, I couldn\'t get facts about that artist right now. Please try again later.',
        noSongMessage: '🎵 No song is currently playing. Start a song first and try again!',
        responseFormatter: ( trackName, artistName, aiResponse ) => {
            return `${ aiResponse }`;
        }
    };

    return await executeSongAICommand( commandParams, config );
}

// Attach metadata to the function
handleBandCommand.requiredRole = requiredRole;
handleBandCommand.description = description;
handleBandCommand.example = example;
handleBandCommand.hidden = hidden;

module.exports = handleBandCommand;