'use strict';

const requiredRole = 'MODERATOR';
const description = 'Send a message as the bot';
const example = 'say Good evening everyone!';
const hidden = false;

async function handleSayCommand ( { args, services, context, responseChannel } ) {
    const { messageService } = services;

    const message = args.trim();

    if ( !message ) {
        const response = '❓ Usage: `!say <message>`';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services,
        } );
        return { success: false, shouldRespond: true, response };
    }

    await messageService.sendGroupMessage( message, { services } );
    return { success: true, shouldRespond: false, response: message };
}

handleSayCommand.requiredRole = requiredRole;
handleSayCommand.description = description;
handleSayCommand.example = example;
handleSayCommand.hidden = hidden;

module.exports = handleSayCommand;
