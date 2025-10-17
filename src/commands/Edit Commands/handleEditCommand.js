const config = require( '../../config.js' );

// Set required role level for this command - requires moderator or higher
const requiredRole = 'MODERATOR';
const description = 'Edit editable message templates (welcomeMessage, nowPlayingMessage, justPlayedMessage, popfactsMessage)';
const example = 'edit nowPlayingMessage {username} is now playing {trackName} by {artistName}';
const hidden = false;

// Define which messages are editable
const EDITABLE_MESSAGES = {
    'welcomeMessage': {
        name: 'Welcome Message',
        availableTokens: [ '{username}', '{hangoutName}' ],
        example: 'Hi {username}, welcome to {hangoutName}!',
        dataKey: 'editableMessages.welcomeMessage'
    },
    'nowPlayingMessage': {
        name: 'Now Playing Message',
        availableTokens: [ '{username}', '{trackName}', '{artistName}' ],
        example: '{username} is now playing {trackName} by {artistName}',
        dataKey: 'editableMessages.nowPlayingMessage'
    },
    'justPlayedMessage': {
        name: 'Just Played Message',
        availableTokens: [ '{username}', '{trackName}', '{artistName}', '{likes}', '{dislikes}', '{stars}' ],
        example: '{username} played...\n{trackName} by {artistName}\nStats: 👍 {likes} 👎 {dislikes} ❤️ {stars}',
        dataKey: 'editableMessages.justPlayedMessage'
    },
    'popfactsQuestion': {
        name: 'Popfacts AI Question Template',
        availableTokens: [ '${trackName}', '${artistName}' ],
        example: 'Tell me about the song ${trackName} by ${artistName}. Please provide interesting facts.',
        dataKey: 'mlQuestions.popfactsQuestion'
    },
    'whatyearQuestion': {
        name: 'What Year AI Question Template',
        availableTokens: [ '${trackName}', '${artistName}' ],
        example: 'In what year was the song ${trackName} by ${artistName} originally released?',
        dataKey: 'mlQuestions.whatyearQuestion'
    },
    'meaningQuestion': {
        name: 'Meaning AI Question Template',
        availableTokens: [ '${trackName}', '${artistName}' ],
        example: 'What is the meaning behind the lyrics of ${trackName} by ${artistName}?',
        dataKey: 'mlQuestions.meaningQuestion'
    },
    'bandQuestion': {
        name: 'Band AI Question Template',
        availableTokens: [ '${artistName}' ],
        example: 'Tell me about ${artistName}?',
        dataKey: 'mlQuestions.bandQuestion'
    }
};

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
        const response = `❌ Please specify a message type and new content.\n\n**Usage:** \`${ config.COMMAND_SWITCH }edit <messageType> <newMessage>\`\n\n**Available message types:** ${ availableMessages }\n\n**Example:** \`${ config.COMMAND_SWITCH }edit nowPlayingMessage {username} is now playing {trackName} by {artistName}\``;

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

    // Split args into messageType and newMessage
    const argParts = args.split( ' ' );
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