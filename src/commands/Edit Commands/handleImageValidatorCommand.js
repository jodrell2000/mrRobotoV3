// src/commands/handleImageValidatorCommand.js
const { logger } = require( '../../lib/logging.js' );

/**
 * Validate chat command images and remove dead links
 */
async function handleImageValidatorCommand ( { command, args, services, context } ) {
    const sendErrorResponse = async ( message ) => {
        await services.messageService.sendResponse( message, {
            responseChannel: 'request',
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response: message };
    };

    const sendSuccessResponse = async ( message ) => {
        await services.messageService.sendResponse( message, {
            responseChannel: 'request',
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: true, shouldRespond: true, response: message };
    };

    try {
        const parts = args.trim().split( /\s+/ );
        const subcommand = parts[ 0 ]?.toLowerCase();

        if ( !subcommand ) {
            return await sendErrorResponse(
                `Usage: \`!imageValidator <subcommand>\`\n\nSubcommands:\n` +
                `\`start\` - Start validation of images not checked in 30 days\n` +
                `\`stop\` - Stop current validation\n` +
                `\`status\` - Show validation progress\n` +
                `\`report\` - Show summary of dead images by command\n` +
                `\`remove\` - Delete all dead images from chat.json`
            );
        }

        if ( subcommand === 'start' ) {
            const result = await services.validationService.startValidation();

            if ( result.success ) {
                return await sendSuccessResponse( `🚀 ${ result.message }` );
            } else {
                return await sendErrorResponse( `❌ ${ result.message }` );
            }
        }

        if ( subcommand === 'stop' ) {
            const result = await services.validationService.stopValidation();

            if ( result.success ) {
                return await sendSuccessResponse( `🛑 ${ result.message }` );
            } else {
                return await sendErrorResponse( `❌ ${ result.message }` );
            }
        }

        if ( subcommand === 'status' ) {
            const status = services.validationService.getStatus();

            if ( !status.isValidating ) {
                return await sendErrorResponse( `⏹️ No validation in progress` );
            }

            const message = `📊 ${ status.message }\n💀 Dead images found: ${ status.deadFound }`;
            return await sendSuccessResponse( message );
        }

        if ( subcommand === 'report' ) {
            const report = await services.validationService.getReport();

            if ( report.dead && Object.keys( report.dead ).length === 0 ) {
                return await sendSuccessResponse( `✅ ${ report.summary }` );
            }

            let message = `📋 ${ report.summary }\n\n`;

            for ( const [ command, urls ] of Object.entries( report.dead ) ) {
                message += `**${ command }** (${ urls.length } dead):\n`;
                urls.forEach( url => {
                    message += `  • ${ url }\n`;
                } );
            }

            return await sendSuccessResponse( message );
        }

        if ( subcommand === 'remove' ) {
            const report = await services.validationService.getReport();

            if ( report.dead && Object.keys( report.dead ).length === 0 ) {
                return await sendErrorResponse( `❌ No dead images to remove. Run \`!imageValidator start\` first.` );
            }

            const result = await services.validationService.removeDeadImages();

            if ( result.success ) {
                return await sendSuccessResponse( `🗑️ ${ result.message }` );
            } else {
                return await sendErrorResponse( `❌ ${ result.message }` );
            }
        }

        return await sendErrorResponse( `❌ Unknown subcommand "${ subcommand }"` );
    } catch ( error ) {
        logger.error( `Error in handleImageValidatorCommand: ${ error.message }` );
        return {
            success: false,
            shouldRespond: true,
            response: `❌ Error: ${ error.message }`
        };
    }
}

// Set metadata for the command
handleImageValidatorCommand.requiredRole = 'MODERATOR';
handleImageValidatorCommand.description = 'Validate and remove dead images';
handleImageValidatorCommand.example = 'start';
handleImageValidatorCommand.hidden = false;

module.exports = handleImageValidatorCommand;
