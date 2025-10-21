const { executeSongAICommand } = require( '../../lib/songAICommandHelper' );

// Set required role level for this command
const requiredRole = 'USER';
const description = 'Get interesting facts about the currently playing song';
const example = 'popfacts';
const hidden = false;

/**
 * Handle the !popfacts command
 * Gets interesting facts about the currently playing song using AI
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments (not used for this command)
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handlePopfactsCommand ( commandParams ) {
  const config = {
    templateKey: 'mlQuestions.popfactsQuestion',
    defaultTemplate: 'The song I\'m currently listening to is {trackName} by {artistName}. Tell me three short interesting facts about the song and/or the artist. When searching note that it may or may not be a cover version. Do not tell me that you\'re giving me three facts as part of the reply',
    commandName: 'popfacts',
    errorMessage: '🎵 Sorry, I couldn\'t get facts about the current song right now. Please try again later.',
    noSongMessage: '🎵 No song is currently playing. Start a song first and try again!'
  };

  return await executeSongAICommand( commandParams, config );
}

// Attach metadata to the function
handlePopfactsCommand.requiredRole = requiredRole;
handlePopfactsCommand.description = description;
handlePopfactsCommand.example = example;
handlePopfactsCommand.hidden = hidden;

module.exports = handlePopfactsCommand;