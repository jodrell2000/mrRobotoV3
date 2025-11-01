const config = require( '../../config.js' );
const fs = require( 'fs' );
const path = require( 'path' );

// Set required role level for this command
const requiredRole = 'OWNER';
const description = 'Manage bot commands - list, enable, disable, or check status';
const example = 'command list';
const hidden = false;

/**
 * Get all available commands by scanning the commands directory recursively
 * @returns {Array} Array of command names
 */
function getAllCommands () {
    try {
        const commandsDir = path.join( __dirname, '../../commands' );
        const commands = [];

        // Function to recursively scan directories
        function scanDirectory ( dirPath ) {
            const items = fs.readdirSync( dirPath );

            items.forEach( item => {
                const itemPath = path.join( dirPath, item );
                const stat = fs.statSync( itemPath );

                if ( stat.isDirectory() ) {
                    // Recursively scan subdirectories
                    scanDirectory( itemPath );
                } else if ( item.endsWith( '.js' ) ) {
                    // Extract command name from filename: handleStateCommand.js -> state
                    const match = item.match( /^handle(.*)Command\.js$/ );
                    if ( match && match[ 1 ] ) {
                        const commandName = match[ 1 ].toLowerCase();
                        // Avoid duplicate entries
                        if ( !commands.includes( commandName ) ) {
                            commands.push( commandName );
                        }
                    }
                }
            } );
        }

        scanDirectory( commandsDir );
        return commands.sort();
    } catch ( error ) {
        return [];
    }
}

/**
 * Get the current disabled commands from botConfig.json
 * @returns {Array} Array of disabled command names
 */
function getDisabledCommands () {
    try {
        const dataPath = path.join( __dirname, '../../../data/botConfig.json' );
        const data = JSON.parse( fs.readFileSync( dataPath, 'utf8' ) );
        return Array.isArray( data.disabledCommands ) ? data.disabledCommands : [];
    } catch ( error ) {
        return [];
    }
}

/**
 * Update the disabled commands list in botConfig.json
 * @param {Array} disabledCommands - Array of disabled command names
 */
function updateDisabledCommands ( disabledCommands ) {
    const dataPath = path.join( __dirname, '../../../data/botConfig.json' );
    const data = JSON.parse( fs.readFileSync( dataPath, 'utf8' ) );
    data.disabledCommands = disabledCommands;
    fs.writeFileSync( dataPath, JSON.stringify( data, null, 2 ), 'utf8' );
}

/**
 * Check if a command exists by looking for its file recursively
 * @param {string} commandName - The command name to check
 * @returns {boolean} True if command exists
 */
function commandExists ( commandName ) {
    try {
        const commandsDir = path.join( __dirname, '../../commands' );
        const commandFileName = `handle${ commandName.charAt( 0 ).toUpperCase() + commandName.slice( 1 ) }Command.js`;

        // Function to recursively search for the command file
        function searchDirectory ( dirPath ) {
            const items = fs.readdirSync( dirPath );

            for ( const item of items ) {
                const itemPath = path.join( dirPath, item );
                const stat = fs.statSync( itemPath );

                if ( stat.isDirectory() ) {
                    // Recursively search subdirectories
                    if ( searchDirectory( itemPath ) ) {
                        return true;
                    }
                } else if ( item === commandFileName ) {
                    return true;
                }
            }
            return false;
        }

        // Special case for unknown command (in root commands directory)
        if ( commandName === 'unknown' ) {
            return fs.existsSync( path.join( commandsDir, 'handleUnknownCommand.js' ) );
        }

        return searchDirectory( commandsDir );
    } catch ( error ) {
        return false;
    }
}

/**
 * Handle command management - list, enable, disable, or check status
 * @param {Object} commandParams - The command parameters object
 * @param {string} commandParams.args - The command arguments
 * @param {Object} commandParams.services - The services object
 * @param {Object} commandParams.context - The context object containing bot and msg information
 * @param {string} commandParams.responseChannel - The channel to send responses to
 */
async function handleCommandCommand ( { args, services, context, responseChannel } ) {
    const { messageService } = services;

    if ( !args || args.trim() === '' ) {
        await messageService.sendResponse(
            'Please specify an action: list, enable <command>, disable <command>, or status <command>',
            {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            }
        );
        return {
            success: false,
            shouldRespond: true,
            response: 'Please specify an action: list, enable <command>, disable <command>, or status <command>'
        };
    }

    const [ action, commandName ] = args.split( ' ' );

    if ( action === 'list' ) {
        const allCommands = getAllCommands();
        const disabledCommands = getDisabledCommands();

        if ( allCommands.length === 0 ) {
            const response = '❌ No commands found';
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

        let response = '🔧 **Command Status:**\n\n';
        allCommands.forEach( command => {
            const isDisabled = disabledCommands.includes( command );
            const emoji = isDisabled ? '🔴' : '🟢';
            const status = isDisabled ? 'disabled' : 'enabled';
            response += `${ emoji } **${ command }** - ${ status }\n`;
        } );

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

    if ( !commandName ) {
        const response = 'Please specify a command name';
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

    // Check if the command exists
    if ( !commandExists( commandName ) ) {
        const response = `❌ Command '${ commandName }' does not exist`;
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

    // Special case: cannot disable unknown command
    if ( commandName === 'unknown' && action === 'disable' ) {
        const response = "❌ Cannot disable the 'unknown' command as it handles unrecognized commands";
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

    try {
        const disabledCommands = getDisabledCommands();
        const isCurrentlyDisabled = disabledCommands.includes( commandName );

        let response;

        if ( action === 'status' ) {
            const status = isCurrentlyDisabled ? 'disabled' : 'enabled';
            response = `ℹ️ Command '${ commandName }' is currently ${ status }`;
        } else if ( action === 'enable' ) {
            if ( !isCurrentlyDisabled ) {
                response = `ℹ️ Command '${ commandName }' is already enabled`;
            } else {
                // Remove from disabled list
                const newDisabledCommands = disabledCommands.filter( cmd => cmd !== commandName );
                updateDisabledCommands( newDisabledCommands );
                response = `✅ Command '${ commandName }' has been enabled`;
            }
        } else if ( action === 'disable' ) {
            if ( isCurrentlyDisabled ) {
                response = `ℹ️ Command '${ commandName }' is already disabled`;
            } else {
                // Add to disabled list
                const newDisabledCommands = [ ...disabledCommands, commandName ];
                updateDisabledCommands( newDisabledCommands );
                response = `✅ Command '${ commandName }' has been disabled`;
            }
        } else {
            response = `❌ Invalid action '${ action }'. Use: list, enable, disable, or status`;
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
        console.error( 'Error in command management:', error );
        const response = '❌ An error occurred while managing the command';
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
handleCommandCommand.requiredRole = requiredRole;
handleCommandCommand.description = description;
handleCommandCommand.example = example;
handleCommandCommand.hidden = hidden;

module.exports = handleCommandCommand;