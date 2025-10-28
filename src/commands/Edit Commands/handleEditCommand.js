const config = require( '../../config.js' );

// Set required role level for this command - requires moderator or higher
const requiredRole = 'OWNER';
const description = 'Manage editable message/question templates';
const example = 'edit list | edit show popfactsQuestion | edit nowPlayingMessage {username} is now playing {trackName}';
const hidden = false;

// Define which messages are editable
const EDITABLE_MESSAGES = {
    'welcomeMessage': {
        name: 'Welcome Message',
        availableTokens: [ '{username}', '{hangoutName}', '{botName}' ],
        example: 'Hi {username}, welcome to {hangoutName}!',
        dataKey: 'editableMessages.welcomeMessage'
    },
    'nowPlayingMessage': {
        name: 'Now Playing Message',
        availableTokens: [ '{username}', '{trackName}', '{artistName}', '{botName}' ],
        example: '{username} is now playing {trackName} by {artistName}',
        dataKey: 'editableMessages.nowPlayingMessage'
    },
    'justPlayedMessage': {
        name: 'Just Played Message',
        availableTokens: [ '{username}', '{trackName}', '{artistName}', '{likes}', '{dislikes}', '{stars}', '{botName}' ],
        example: '{username} played...\n{trackName} by {artistName}\nStats: 👍 {likes} 👎 {dislikes} ❤️ {stars}',
        dataKey: 'editableMessages.justPlayedMessage'
    },
    'popfactsQuestion': {
        name: 'Popfacts AI Question Template',
        availableTokens: [ '{trackName}', '{artistName}', '{username}', '{hangoutName}', '{botName}' ],
        example: 'Tell me about the song {trackName} by {artistName}. Please provide interesting facts.',
        dataKey: 'mlQuestions.popfactsQuestion'
    },
    'whatyearQuestion': {
        name: 'What Year AI Question Template',
        availableTokens: [ '{trackName}', '{artistName}', '{username}', '{hangoutName}', '{botName}' ],
        example: 'In what year was the song {trackName} by {artistName} originally released?',
        dataKey: 'mlQuestions.whatyearQuestion'
    },
    'meaningQuestion': {
        name: 'Meaning AI Question Template',
        availableTokens: [ '{trackName}', '{artistName}', '{username}', '{hangoutName}', '{botName}' ],
        example: 'What is the meaning behind the lyrics of {trackName} by {artistName}?',
        dataKey: 'mlQuestions.meaningQuestion'
    },
    'bandQuestion': {
        name: 'Band AI Question Template',
        availableTokens: [ '{artistName}', '{username}', '{hangoutName}', '{botName}' ],
        example: 'Tell me about {artistName}?',
        dataKey: 'mlQuestions.bandQuestion'
    },
    'introQuestion': {
        name: 'Intro AI Question Template',
        availableTokens: [ '{trackName}', '{artistName}', '{username}', '{hangoutName}', '{botName}' ],
        example: 'Give me a brief introduction to {artistName}. What should I know about them?',
        dataKey: 'mlQuestions.introQuestion'
    },
    'MLInstructions': {
        name: 'AI System Instructions',
        availableTokens: [ '{hangoutName}', '{botName}' ],
        example: 'When asked about dates or facts about artists or music you should verify all facts with reputable sources such as Wikipedia and MusicBrainz',
        dataKey: 'Instructions.MLInstructions'
    },
    'MLPersonality': {
        name: 'AI Personality',
        availableTokens: [ '{hangoutName}', '{botName}' ],
        example: 'You are the host of a social music room called {hangoutName} where other people take it in turns playing songs. You should adopt the personality of an upbeat radio DJ called {botName}.',
        dataKey: 'Instructions.MLPersonality'
    },
    'timezone': {
        name: 'Timezone Configuration',
        availableTokens: [],
        example: 'Europe/London (or America/New_York, America/Los_Angeles, Australia/Sydney, etc.)',
        dataKey: 'configuration.timezone'
    },
    'locale': {
        name: 'Locale Configuration',
        availableTokens: [],
        example: 'en-GB (or en-US, fr-FR, de-DE, etc.)',
        dataKey: 'configuration.locale'
    },
    'timeFormat': {
        name: 'Time Format (12 or 24 hour)',
        availableTokens: [],
        example: '24 (for 24-hour format) or 12 (for 12-hour format with AM/PM)',
        dataKey: 'configuration.timeFormat'
    }
};

/**
 * Handles listing all editable messages and questions
 */
async function handleListCommand ( services, context, responseChannel ) {
    const { messageService } = services;

    // Separate messages, questions, system settings, and configuration
    const messages = [];
    const questions = [];
    const systemSettings = [];
    const configSettings = [];

    Object.entries( EDITABLE_MESSAGES ).forEach( ( [ key, info ] ) => {
        if ( info.dataKey.startsWith( 'editableMessages.' ) ) {
            messages.push( `• **${ key }** - ${ info.name }` );
        } else if ( info.dataKey.startsWith( 'mlQuestions.' ) ) {
            questions.push( `• **${ key }** - ${ info.name }` );
        } else if ( info.dataKey.startsWith( 'configuration.' ) ) {
            configSettings.push( `• **${ key }** - ${ info.name }` );
        } else {
            // Handle other items like MLInstructions
            systemSettings.push( `• **${ key }** - ${ info.name }` );
        }
    } );

    let response = `**📝 Editable Messages and Questions**\n\n**Messages:**\n${ messages.join( '\n' ) }\n\n**AI Questions:**\n${ questions.join( '\n' ) }`;

    if ( systemSettings.length > 0 ) {
        response += `\n\n**System Settings:**\n${ systemSettings.join( '\n' ) }`;
    }

    if ( configSettings.length > 0 ) {
        response += `\n\n**Configuration:**\n${ configSettings.join( '\n' ) }`;
    }

    response += `\n\n**Usage:**\n• \`${ config.COMMAND_SWITCH }edit show <messageType>\` - Show current template\n• \`${ config.COMMAND_SWITCH }edit <messageType> <newContent>\` - Update template`;

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

/**
 * Handles showing a specific message template
 */
async function handleShowCommand ( messageType, services, context, responseChannel ) {
    const { messageService, dataService, logger } = services;

    // Validate message type
    if ( !EDITABLE_MESSAGES[ messageType ] ) {
        const availableMessages = Object.keys( EDITABLE_MESSAGES ).join( ', ' );
        const response = `❌ Invalid message type: "${ messageType }"\n\n**Available message types:** ${ availableMessages }`;

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
            error: `Invalid message type: ${ messageType }`
        };
    }

    try {
        // Load current data
        await dataService.loadData();

        const messageInfo = EDITABLE_MESSAGES[ messageType ];
        const currentTemplate = dataService.getValue( messageInfo.dataKey );

        const response = `**${ messageInfo.name } Template:**\n\n\`\`\`\n${ currentTemplate || messageInfo.example }\n\`\`\`\n\n**Available tokens:** ${ messageInfo.availableTokens.join( ', ' ) }\n\n**Usage:** \`${ config.COMMAND_SWITCH }edit ${ messageType } <newTemplate>\``;

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
        logger.error( `Error showing template for ${ messageType }: ${ error.message }` );
        const response = `❌ Failed to show template for ${ messageInfo.name }: ${ error.message }`;

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

/**
 * Updates an editable message template
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments (messageType and new message)
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleEditCommand ( commandParams ) {
    const { args, services, context, responseChannel = 'request' } = commandParams;
    const { messageService, dataService, logger } = services;

    // Parse arguments
    if ( !args || args.trim().length === 0 ) {
        const availableMessages = Object.keys( EDITABLE_MESSAGES ).join( ', ' );
        const response = `❌ Please specify a command and parameters.\n\n**Usage:**\n• \`${ config.COMMAND_SWITCH }edit list\` - Show all editable messages and questions\n• \`${ config.COMMAND_SWITCH }edit show <messageType>\` - Show current template\n• \`${ config.COMMAND_SWITCH }edit <messageType> <newContent>\` - Update template\n\n**Available message types:** ${ availableMessages }`;

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

    // Split args into command and parameters
    const argParts = args.split( ' ' );
    const subCommand = argParts[ 0 ];

    // Handle list command
    if ( subCommand === 'list' ) {
        return await handleListCommand( services, context, responseChannel );
    }

    // Handle show command
    if ( subCommand === 'show' ) {
        if ( argParts.length < 2 ) {
            const response = `❌ Please specify a message type to show.\n\n**Usage:** \`${ config.COMMAND_SWITCH }edit show <messageType>\``;
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
        const messageType = argParts[ 1 ];
        return await handleShowCommand( messageType, services, context, responseChannel );
    }

    // Handle update command (original functionality)
    const messageType = argParts[ 0 ];
    const newMessage = argParts.slice( 1 ).join( ' ' );

    // Validate message type
    if ( !EDITABLE_MESSAGES[ messageType ] ) {
        const availableMessages = Object.keys( EDITABLE_MESSAGES ).join( ', ' );
        const response = `❌ Invalid message type: "${ messageType }"\n\n**Available message types:** ${ availableMessages }`;

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
            error: `Invalid message type: ${ messageType }`
        };
    }

    // Validate new message content
    if ( !newMessage || newMessage.trim().length === 0 ) {
        const messageInfo = EDITABLE_MESSAGES[ messageType ];
        const response = `❌ Please provide a new ${ messageInfo.name.toLowerCase() }.\n\n**Available tokens:** ${ messageInfo.availableTokens.join( ', ' ) }\n\n**Example:** \`${ config.COMMAND_SWITCH }edit ${ messageType } ${ messageInfo.example }\``;

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
            error: 'Missing message content'
        };
    }

    const messageInfo = EDITABLE_MESSAGES[ messageType ];
    logger.info( `Starting ${ messageInfo.name.toLowerCase() } update process` );

    try {
        // Load current data to ensure we have the latest
        logger.debug( 'Loading current data...' );
        await dataService.loadData();

        // Update the message using dataService with the correct data key
        const messageKey = messageInfo.dataKey;
        logger.debug( `Setting ${ messageKey } to: ${ newMessage }` );

        await dataService.setValue( messageKey, newMessage );

        // Verify the update
        const updatedMessage = dataService.getValue( messageKey );
        logger.debug( `Updated ${ messageType } in service: ${ updatedMessage }` );

        if ( updatedMessage !== newMessage ) {
            const response = `❌ Failed to update ${ messageInfo.name.toLowerCase() }: Message in memory does not match new message after reload`;
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
                error: 'Message in memory does not match new message after reload'
            };
        }

        const response = `✅ ${ messageInfo.name } updated to: "${ newMessage }"`;
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
        const response = `❌ Failed to update ${ messageInfo.name.toLowerCase() }: ${ error.message }`;
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
handleEditCommand.requiredRole = requiredRole;
handleEditCommand.description = description;
handleEditCommand.example = example;
handleEditCommand.hidden = hidden;

module.exports = handleEditCommand;