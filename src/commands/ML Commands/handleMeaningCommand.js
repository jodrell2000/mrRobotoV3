const { executeSongAICommand } = require( '../../lib/songAICommandHelper' );

// Set required role level for this command
const requiredRole = 'USER';
const description = 'Tell me what the lyrics for a track are all about';
const example = 'meaning';
const hidden = false;

/**
 * Handle the !meaning command
 * Find the meaning of the lyrics for the currently playing song using AI
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments (not used for this command)
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleMeaningCommand ( commandParams ) {
    const config = {
        templateKey: 'mlQuestions.meaningQuestion',
        defaultTemplate: 'Tell me the meaning of the lyrics of the song {trackName} by {artistName} in less than 200 words.',
        commandName: 'meaning',
        errorMessage: '🎵 Sorry, I couldn\'t find the meaning of the current song right now. Please try again later.',
        noSongMessage: '🎵 No song is currently playing. Start a song first and try again!'
    };

    return await executeSongAICommand( commandParams, config );
}

// Attach metadata to the function
handleMeaningCommand.requiredRole = requiredRole;
handleMeaningCommand.description = description;
handleMeaningCommand.example = example;
handleMeaningCommand.hidden = hidden;

module.exports = handleMeaningCommand;