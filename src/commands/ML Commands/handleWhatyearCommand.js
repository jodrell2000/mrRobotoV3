const { executeSongAICommand } = require( '../../lib/songAICommandHelper' );

// Set required role level for this command
const requiredRole = 'USER';
const description = 'Find out what year the currently playing song was released';
const example = 'whatyear';
const hidden = false;

/**
 * Handle the !whatyear command
 * Gets the release year of the currently playing song using AI
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments (not used for this command)
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleWhatyearCommand ( commandParams ) {
  const config = {
    templateKey: 'mlQuestions.whatyearQuestion',
    defaultTemplate: 'In what year was the song {trackName} by {artistName} originally released?',
    commandName: 'whatyear',
    errorMessage: '🎵 Sorry, I couldn\'t find the release year for the current song right now. Please try again later.',
    noSongMessage: '🎵 No song is currently playing. Start a song first and try again!',
    responseFormatter: ( trackName, artistName, aiResponse ) => {
      return `${ aiResponse }`;
    }
  };

  return await executeSongAICommand( commandParams, config );
}

// Attach metadata to the function
handleWhatyearCommand.requiredRole = requiredRole;
handleWhatyearCommand.description = description;
handleWhatyearCommand.example = example;
handleWhatyearCommand.hidden = hidden;

module.exports = handleWhatyearCommand;