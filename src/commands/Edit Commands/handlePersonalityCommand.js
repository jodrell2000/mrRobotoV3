const config = require( '../../config.js' );
const { hasPermission } = require( '../../lib/roleUtils' );

const requiredRole = 'MODERATOR';
const description = 'Manage bot personality presets';
const example = 'list | save "Name" "Description" | activate "Name" | delete "Name"';
const hidden = false;

async function handleListPersonalities ( services, context, responseChannel ) {
    const { messageService, dataService, databaseService, logger } = services;

    try {
        if ( !databaseService.initialized ) {
            throw new Error( 'Database not initialized' );
        }

        await dataService.loadData();
        const activePersonality = dataService.getValue( 'activePersonality' );
        const personalities = await databaseService.getAllPersonalities();

        if ( personalities.length === 0 ) {
            const response = `No saved personalities. Use \`${ config.COMMAND_SWITCH }personality save "Name" "Description"\` to create one.`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: true, shouldRespond: true, response };
        }

        let response = '';
        if ( activePersonality ) {
            const activeInfo = personalities.find( p => p.name.toLowerCase() === activePersonality.toLowerCase() );
            if ( activeInfo ) {
                response = `🔵 **Active:** ${ activeInfo.name } - ${ activeInfo.description }\n\n`;
            }
        }

        response += '📋 **Saved Personalities:**\n';
        personalities.forEach( p => {
            const date = new Date( p.created_at ).toLocaleDateString( 'en-GB' );
            response += `"${ p.name }" - ${ p.description } (created: ${ date })\n`;
        } );

        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );

        return { success: true, shouldRespond: true, response };

    } catch ( error ) {
        logger.error( `Error listing personalities: ${ error.message }` );
        const response = `❌ Failed to list personalities: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: error.message };
    }
}

async function handleShowPersonality ( personalityName, services, context, responseChannel ) {
    const { messageService, databaseService, logger } = services;

    try {
        if ( !databaseService.initialized ) {
            throw new Error( 'Database not initialized' );
        }

        const personality = await databaseService.getPersonalityByName( personalityName );

        if ( !personality ) {
            const allPersonalities = await databaseService.getAllPersonalities();
            const suggestions = suggestSimilarNames( personalityName, allPersonalities.map( p => p.name ) );
            let response = `❌ Personality "${ personalityName }" not found.`;
            if ( suggestions.length > 0 ) {
                response += `\n\nDid you mean: ${ suggestions.join( ', ' ) }?`;
            }
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: 'Personality not found' };
        }

        const mlPersonality = personality.instructions.MLPersonality || 'Not set';
        const truncated = mlPersonality.length > 500;
        const displayText = truncated ? mlPersonality.substring( 0, 500 ) + '...' : mlPersonality;

        let response = `**${ personality.name }** - ${ personality.description }\n\n**ML Personality:**\n\`\`\`\n${ displayText }\n\`\`\``;

        if ( truncated ) {
            response += `\n\n_Use \`${ config.COMMAND_SWITCH }personality showall ${ personality.name }\` to see full details_`;
        }

        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );

        return { success: true, shouldRespond: true, response };

    } catch ( error ) {
        logger.error( `Error showing personality: ${ error.message }` );
        const response = `❌ Failed to show personality: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: error.message };
    }
}

async function handleShowAllPersonality ( personalityName, services, context, responseChannel ) {
    const { messageService, databaseService, logger, stateService } = services;

    try {
        const senderRole = stateService.getUserRole( context.sender );
        if ( !hasPermission( senderRole, 'OWNER' ) ) {
            const response = '❌ Only the room owner can view full personality details. Use `show` for a brief overview.';
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: 'Insufficient permissions' };
        }

        if ( !databaseService.initialized ) {
            throw new Error( 'Database not initialized' );
        }

        const personality = await databaseService.getPersonalityByName( personalityName );

        if ( !personality ) {
            const allPersonalities = await databaseService.getAllPersonalities();
            const suggestions = suggestSimilarNames( personalityName, allPersonalities.map( p => p.name ) );
            let response = `❌ Personality "${ personalityName }" not found.`;
            if ( suggestions.length > 0 ) {
                response += `\n\nDid you mean: ${ suggestions.join( ', ' ) }?`;
            }
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: 'Personality not found' };
        }

        const created = new Date( personality.created_at ).toLocaleDateString( 'en-GB' );
        const updated = new Date( personality.updated_at ).toLocaleDateString( 'en-GB' );

        // Extract bot name for prominent display
        const botName = personality.configuration?.botName || 'Not set';

        const messages = [
            `**${ personality.name }** - ${ personality.description }\n_Created: ${ created } | Updated: ${ updated }_\n\n**Bot Name:** ${ botName }\n\n**ML Personality:**\n\`\`\`\n${ personality.instructions.MLPersonality || 'Not set' }\n\`\`\`\n\n**ML Instructions:**\n\`\`\`\n${ personality.instructions.MLInstructions || 'Not set' }\n\`\`\``,

            `**Editable Messages:**\n${ formatEditableMessages( personality.editableMessages ) }\n\n**Configuration:**\n${ formatConfiguration( personality.configuration ) }`,

            `**ML Questions:**\n${ formatMlQuestions( personality.mlQuestions ) }\n\n**Disabled Commands:** ${ formatList( personality.disabledCommands ) }\n\n**Disabled Features:** ${ formatList( personality.disabledFeatures ) }`,

            `**Triggers:**\n${ formatTriggers( personality.triggers ) }\n\n**Custom Tokens:**\n${ formatCustomTokens( personality.customTokens ) }`
        ];

        for ( const message of messages ) {
            await messageService.sendResponse( message, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
        }

        return { success: true, shouldRespond: true, response: 'Personality details sent' };

    } catch ( error ) {
        logger.error( `Error showing all personality details: ${ error.message }` );
        const response = `❌ Failed to show personality details: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: error.message };
    }
}

async function handleSavePersonality ( personalityName, description, services, context, responseChannel ) {
    const { messageService, dataService, databaseService, logger, stateService } = services;

    try {
        const senderRole = stateService.getUserRole( context.sender );
        if ( !hasPermission( senderRole, 'OWNER' ) ) {
            const response = '❌ Only the room owner can save personalities.';
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: 'Insufficient permissions' };
        }

        if ( !databaseService.initialized ) {
            throw new Error( 'Database not initialized' );
        }

        const validationError = validatePersonalityName( personalityName );
        if ( validationError ) {
            await messageService.sendResponse( validationError, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response: validationError, error: validationError };
        }

        const descValidationError = validateDescription( description );
        if ( descValidationError ) {
            await messageService.sendResponse( descValidationError, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response: descValidationError, error: descValidationError };
        }

        const existing = await databaseService.getPersonalityByName( personalityName );
        if ( existing ) {
            const response = `❌ Personality "${ existing.name }" already exists. Use \`${ config.COMMAND_SWITCH }personality update "${ existing.name }"\` to modify it.`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: 'Personality already exists' };
        }

        await dataService.loadData();
        const botConfig = dataService.getAllData();

        const personalityData = {
            name: personalityName,
            description,
            mlPersonality: botConfig.Instructions?.MLPersonality || '',
            mlInstructions: botConfig.Instructions?.MLInstructions || '',
            editableMessages: botConfig.editableMessages || {},
            configuration: {
                ...( botConfig.configuration || {} ),
                botName: botConfig.botData?.CHAT_NAME || ''
            },
            mlQuestions: botConfig.mlQuestions || {},
            disabledCommands: botConfig.disabledCommands || [],
            disabledFeatures: botConfig.disabledFeatures || [],
            triggers: botConfig.triggers || {},
            customTokens: botConfig.customTokens || {}
        };

        await databaseService.savePersonality( personalityData );

        // Set newly saved personality as active
        await dataService.setValue( 'activePersonality', personalityName );

        const response = `✅ Personality "${ personalityName }" saved successfully and activated`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );

        logger.info( `Personality "${ personalityName }" saved by ${ context?.sender }` );

        return { success: true, shouldRespond: true, response };

    } catch ( error ) {
        logger.error( `Error saving personality: ${ error.message }` );
        const response = `❌ Failed to save personality: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: error.message };
    }
}

async function handleUpdatePersonality ( personalityName, description, services, context, responseChannel ) {
    const { messageService, dataService, databaseService, logger, stateService } = services;

    try {
        const senderRole = stateService.getUserRole( context.sender );
        if ( !hasPermission( senderRole, 'OWNER' ) ) {
            const response = '❌ Only the room owner can update personalities.';
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: 'Insufficient permissions' };
        }

        if ( !databaseService.initialized ) {
            throw new Error( 'Database not initialized' );
        }

        if ( description !== undefined ) {
            const descValidationError = validateDescription( description );
            if ( descValidationError ) {
                await messageService.sendResponse( descValidationError, {
                    responseChannel,
                    isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                    sender: context?.sender,
                    services
                } );
                return { success: false, shouldRespond: true, response: descValidationError, error: descValidationError };
            }
        }

        // If no personality name provided, update the active personality
        let targetName = personalityName;
        if ( !personalityName || personalityName.trim().length === 0 ) {
            await dataService.loadData();
            const activePersonality = dataService.getValue( 'activePersonality' );
            if ( !activePersonality ) {
                const response = `❌ No active personality. Use \`${ config.COMMAND_SWITCH }personality save "Name" "Description"\` to create one first.`;
                await messageService.sendResponse( response, {
                    responseChannel,
                    isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                    sender: context?.sender,
                    services
                } );
                return { success: false, shouldRespond: true, response, error: 'No active personality' };
            }
            targetName = activePersonality;
        }

        const existing = await databaseService.getPersonalityByName( targetName );
        if ( !existing ) {
            const response = `❌ Personality "${ targetName }" not found. Use \`${ config.COMMAND_SWITCH }personality save "${ targetName }" "Description"\` to create it.`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: 'Personality not found' };
        }

        await dataService.loadData();
        const botConfig = dataService.getAllData();

        const personalityData = {
            name: existing.name,
            description: description !== undefined ? description : existing.description,
            mlPersonality: botConfig.Instructions?.MLPersonality || '',
            mlInstructions: botConfig.Instructions?.MLInstructions || '',
            editableMessages: botConfig.editableMessages || {},
            configuration: {
                ...( botConfig.configuration || {} ),
                botName: botConfig.botData?.CHAT_NAME || ''
            },
            mlQuestions: botConfig.mlQuestions || {},
            disabledCommands: botConfig.disabledCommands || [],
            disabledFeatures: botConfig.disabledFeatures || [],
            triggers: botConfig.triggers || {},
            customTokens: botConfig.customTokens || {}
        };

        await databaseService.updatePersonality( personalityData );

        const response = `✅ Personality "${ existing.name }" updated successfully`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );

        logger.info( `Personality "${ existing.name }" updated by ${ context?.sender }` );

        return { success: true, shouldRespond: true, response };

    } catch ( error ) {
        logger.error( `Error updating personality: ${ error.message }` );
        const response = `❌ Failed to update personality: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: error.message };
    }
}

async function handleActivatePersonality ( personalityName, services, context, responseChannel ) {
    const { messageService, dataService, databaseService, logger } = services;

    try {
        if ( !databaseService.initialized ) {
            throw new Error( 'Database not initialized' );
        }

        const validationError = validatePersonalityName( personalityName );
        if ( validationError ) {
            await messageService.sendResponse( validationError, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response: validationError, error: validationError };
        }

        const personality = await databaseService.getPersonalityByName( personalityName );
        if ( !personality ) {
            const allPersonalities = await databaseService.getAllPersonalities();
            const suggestions = suggestSimilarNames( personalityName, allPersonalities.map( p => p.name ) );
            let response = `❌ Personality "${ personalityName }" not found.`;
            if ( suggestions.length > 0 ) {
                response += `\n\nDid you mean: ${ suggestions.join( ', ' ) }?`;
            }
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: 'Personality not found' };
        }

        // Send loading message
        const loadingMessage = `🤖 Loading new personality...please wait`;
        await messageService.sendResponse( loadingMessage, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );

        await dataService.loadData();
        await dataService.setValue( 'Instructions.MLPersonality', personality.instructions.MLPersonality );
        await dataService.setValue( 'Instructions.MLInstructions', personality.instructions.MLInstructions );

        for ( const [ key, value ] of Object.entries( personality.editableMessages ) ) {
            await dataService.setValue( `editableMessages.${ key }`, value );
        }

        // Extract botName from configuration if it exists
        const { botName, ...otherConfig } = personality.configuration;
        if ( botName ) {
            await dataService.setValue( 'botData.CHAT_NAME', botName );
            // Update bot name on TT.fm platform
            await services.hangUserService.updateHangNickname( botName );

            // Leave and rejoin CometChat to refresh display name in chat window
            try {
                logger.debug( '🔄 Leaving CometChat to refresh display name...' );
                await messageService.leaveChat( services.config.HANGOUT_ID );
                logger.debug( '✅ Left CometChat group' );
            } catch ( leaveError ) {
                logger.warn( `⚠️ Failed to leave CometChat (will still try to rejoin): ${ leaveError.message }` );
            }

            try {
                logger.debug( '🔄 Rejoining CometChat with new display name...' );
                await messageService.joinChat( services.config.HANGOUT_ID );
                logger.debug( '✅ CometChat rejoin successful' );
            } catch ( rejoinError ) {
                // Don't fail the whole operation if rejoin fails
                logger.warn( `⚠️ Failed to rejoin CometChat: ${ rejoinError.message }` );
            }
        }
        await dataService.setValue( 'configuration', otherConfig );

        await dataService.setValue( 'mlQuestions', personality.mlQuestions );
        await dataService.setValue( 'disabledCommands', personality.disabledCommands );
        await dataService.setValue( 'disabledFeatures', personality.disabledFeatures );
        await dataService.setValue( 'triggers', personality.triggers );
        await dataService.setValue( 'customTokens', personality.customTokens );
        await dataService.setValue( 'activePersonality', personality.name );

        const response = `✅ Activated personality "${ personality.name }"`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );

        logger.info( `Personality "${ personality.name }" activated by ${ context?.sender }` );

        return { success: true, shouldRespond: true, response };

    } catch ( error ) {
        logger.error( `Error activating personality: ${ error.message }` );
        const response = `❌ Failed to activate personality: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: error.message };
    }
}

async function handleDeletePersonality ( personalityName, services, context, responseChannel ) {
    const { messageService, dataService, databaseService, logger, stateService } = services;

    try {
        const senderRole = stateService.getUserRole( context.sender );
        if ( !hasPermission( senderRole, 'OWNER' ) ) {
            const response = '❌ Only the room owner can delete personalities.';
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: 'Insufficient permissions' };
        }

        if ( !databaseService.initialized ) {
            throw new Error( 'Database not initialized' );
        }

        const validationError = validatePersonalityName( personalityName );
        if ( validationError ) {
            await messageService.sendResponse( validationError, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response: validationError, error: validationError };
        }

        const personality = await databaseService.getPersonalityByName( personalityName );
        if ( !personality ) {
            const allPersonalities = await databaseService.getAllPersonalities();
            const suggestions = suggestSimilarNames( personalityName, allPersonalities.map( p => p.name ) );
            let response = `❌ Personality "${ personalityName }" not found.`;
            if ( suggestions.length > 0 ) {
                response += `\n\nDid you mean: ${ suggestions.join( ', ' ) }?`;
            }
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: 'Personality not found' };
        }

        await databaseService.deletePersonality( personality.name );

        await dataService.loadData();
        const activePersonality = dataService.getValue( 'activePersonality' );
        if ( activePersonality && activePersonality.toLowerCase() === personality.name.toLowerCase() ) {
            await dataService.setValue( 'activePersonality', undefined );
        }

        const response = `✅ Personality "${ personality.name }" deleted`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );

        logger.info( `Personality "${ personality.name }" deleted by ${ context?.sender }` );

        return { success: true, shouldRespond: true, response };

    } catch ( error ) {
        logger.error( `Error deleting personality: ${ error.message }` );
        const response = `❌ Failed to delete personality: ${ error.message }`;
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: error.message };
    }
}

function parseQuotedStrings ( args ) {
    const matches = args.match( /"([^"]*)"/g );
    if ( !matches || matches.length < 2 ) {
        return undefined;
    }
    return {
        name: matches[ 0 ].slice( 1, -1 ),
        description: matches[ 1 ].slice( 1, -1 )
    };
}

function parsePersonalityName ( args ) {
    const match = args.match( /"([^"]*)"/ );
    if ( match ) {
        return match[ 1 ];
    }
    return args.trim().split( ' ' )[ 0 ];
}

function validatePersonalityName ( name ) {
    if ( !name || name.trim().length === 0 ) {
        return `❌ Please provide a personality name. Usage: \`${ config.COMMAND_SWITCH }personality save "Name" "Description"\``;
    }
    return undefined;
}

function validateDescription ( description ) {
    if ( description === undefined || description.trim().length === 0 ) {
        return `❌ Description required. Usage: \`${ config.COMMAND_SWITCH }personality save "Name" "Description"\` (max 50 chars)`;
    }
    if ( description.length > 50 ) {
        return `❌ Description must be 50 characters or less (currently: ${ description.length })`;
    }
    return undefined;
}

function suggestSimilarNames ( invalidName, allNames ) {
    const suggestions = allNames
        .map( name => ( { name, distance: levenshteinDistance( invalidName.toLowerCase(), name.toLowerCase() ) } ) )
        .filter( item => item.distance <= 3 )
        .sort( ( a, b ) => a.distance - b.distance )
        .slice( 0, 3 )
        .map( item => item.name );
    return suggestions;
}

function levenshteinDistance ( str1, str2 ) {
    const matrix = [];
    for ( let i = 0; i <= str2.length; i++ ) {
        matrix[ i ] = [ i ];
    }
    for ( let j = 0; j <= str1.length; j++ ) {
        matrix[ 0 ][ j ] = j;
    }
    for ( let i = 1; i <= str2.length; i++ ) {
        for ( let j = 1; j <= str1.length; j++ ) {
            if ( str2.charAt( i - 1 ) === str1.charAt( j - 1 ) ) {
                matrix[ i ][ j ] = matrix[ i - 1 ][ j - 1 ];
            } else {
                matrix[ i ][ j ] = Math.min(
                    matrix[ i - 1 ][ j - 1 ] + 1,
                    matrix[ i ][ j - 1 ] + 1,
                    matrix[ i - 1 ][ j ] + 1
                );
            }
        }
    }
    return matrix[ str2.length ][ str1.length ];
}

function formatEditableMessages ( messages ) {
    if ( !messages || Object.keys( messages ).length === 0 ) {
        return 'None';
    }
    return Object.entries( messages )
        .map( ( [ key, value ] ) => `  • ${ key }: "${ value.substring( 0, 50 ) }${ value.length > 50 ? '...' : '' }"` )
        .join( '\n' );
}

function formatConfiguration ( config ) {
    if ( !config || Object.keys( config ).length === 0 ) {
        return 'None';
    }

    // Exclude bot name since it's shown prominently at the top
    const { botName, ...otherConfig } = config;

    if ( Object.keys( otherConfig ).length === 0 ) {
        return 'None';
    }

    // Format other config items
    return Object.entries( otherConfig )
        .map( ( [ key, value ] ) => `  • ${ key }: ${ JSON.stringify( value ) }` )
        .join( '\n' );
}

function formatMlQuestions ( questions ) {
    if ( !questions || Object.keys( questions ).length === 0 ) {
        return 'None';
    }
    return Object.entries( questions )
        .map( ( [ key, value ] ) => `  • ${ key }: "${ value.substring( 0, 50 ) }${ value.length > 50 ? '...' : '' }"` )
        .join( '\n' );
}

function formatList ( items ) {
    if ( !items || items.length === 0 ) {
        return 'None';
    }
    return items.join( ', ' );
}

function formatTriggers ( triggers ) {
    if ( !triggers || Object.keys( triggers ).length === 0 ) {
        return 'None';
    }
    return Object.entries( triggers )
        .map( ( [ type, items ] ) => {
            const formattedItems = items.map( t => {
                // Handle both string format (simple command) and object format (pattern/response)
                if ( typeof t === 'string' ) {
                    return `    • "${ t }"`;
                } else if ( t && typeof t === 'object' && t.pattern && t.response ) {
                    return `    • "${ t.pattern }" → "${ t.response }"`;
                } else {
                    return `    • Invalid trigger format`;
                }
            } ).join( '\n' );
            return `  **${ type }:**\n${ formattedItems }`;
        } )
        .join( '\n' );
}

function formatCustomTokens ( tokens ) {
    if ( !tokens || Object.keys( tokens ).length === 0 ) {
        return 'None';
    }
    return Object.entries( tokens )
        .map( ( [ key, value ] ) => {
            // Extract just the value if it's a token object, otherwise display as-is
            let displayValue;
            if ( typeof value === 'object' && value !== null && 'value' in value ) {
                displayValue = value.value;
            } else if ( typeof value === 'object' ) {
                displayValue = JSON.stringify( value );
            } else {
                displayValue = value;
            }
            return `  • {${ key }}: "${ displayValue }"`;
        } )
        .join( '\n' );
}

async function handlePersonalityCommand ( commandParams ) {
    const { args, services, context, responseChannel = 'request' } = commandParams;
    const { messageService } = services;

    if ( !args || args.trim().length === 0 ) {
        const response = `❌ Please specify a command.\n\n**Usage:**\n• \`${ config.COMMAND_SWITCH }personality list\` - Show all saved personalities\n• \`${ config.COMMAND_SWITCH }personality show "Name"\` - Show personality overview\n• \`${ config.COMMAND_SWITCH }personality showall "Name"\` - Show full personality details\n• \`${ config.COMMAND_SWITCH }personality save "Name" "Description"\` - Save and activate current configuration\n• \`${ config.COMMAND_SWITCH }personality update ["Name"]\` - Update active or specified personality\n• \`${ config.COMMAND_SWITCH }personality activate "Name"\` - Load a saved personality\n• \`${ config.COMMAND_SWITCH }personality delete "Name"\` - Delete a saved personality`;

        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response };
    }

    const argParts = args.split( ' ' );
    const subCommand = argParts[ 0 ].toLowerCase();

    if ( subCommand === 'list' ) {
        return await handleListPersonalities( services, context, responseChannel );
    }

    if ( subCommand === 'show' ) {
        const restArgs = args.substring( args.indexOf( subCommand ) + subCommand.length ).trim();
        if ( !restArgs ) {
            const response = `❌ Please specify a personality name. Usage: \`${ config.COMMAND_SWITCH }personality show "Name"\``;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response };
        }
        const personalityName = parsePersonalityName( restArgs );
        return await handleShowPersonality( personalityName, services, context, responseChannel );
    }

    if ( subCommand === 'showall' ) {
        const restArgs = args.substring( args.indexOf( subCommand ) + subCommand.length ).trim();
        if ( !restArgs ) {
            const response = `❌ Please specify a personality name. Usage: \`${ config.COMMAND_SWITCH }personality showall "Name"\``;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response };
        }
        const personalityName = parsePersonalityName( restArgs );
        return await handleShowAllPersonality( personalityName, services, context, responseChannel );
    }

    if ( subCommand === 'save' ) {
        const restArgs = args.substring( args.indexOf( subCommand ) + subCommand.length ).trim();
        const parsed = parseQuotedStrings( restArgs );
        if ( !parsed ) {
            const response = `❌ Please provide both name and description in quotes. Usage: \`${ config.COMMAND_SWITCH }personality save "Name" "Description"\``;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response };
        }
        return await handleSavePersonality( parsed.name, parsed.description, services, context, responseChannel );
    }

    if ( subCommand === 'update' ) {
        const restArgs = args.substring( args.indexOf( subCommand ) + subCommand.length ).trim();
        if ( !restArgs ) {
            // No name provided, update active personality
            return await handleUpdatePersonality( undefined, undefined, services, context, responseChannel );
        }
        const parsed = parseQuotedStrings( restArgs );
        if ( parsed ) {
            return await handleUpdatePersonality( parsed.name, parsed.description, services, context, responseChannel );
        }
        const personalityName = parsePersonalityName( restArgs );
        return await handleUpdatePersonality( personalityName, undefined, services, context, responseChannel );
    }

    if ( subCommand === 'activate' ) {
        const restArgs = args.substring( args.indexOf( subCommand ) + subCommand.length ).trim();
        if ( !restArgs ) {
            const response = `❌ Please specify a personality name. Usage: \`${ config.COMMAND_SWITCH }personality activate "Name"\``;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response };
        }
        const personalityName = parsePersonalityName( restArgs );
        return await handleActivatePersonality( personalityName, services, context, responseChannel );
    }

    if ( subCommand === 'delete' ) {
        const restArgs = args.substring( args.indexOf( subCommand ) + subCommand.length ).trim();
        if ( !restArgs ) {
            const response = `❌ Please specify a personality name. Usage: \`${ config.COMMAND_SWITCH }personality delete "Name"\``;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response };
        }
        const personalityName = parsePersonalityName( restArgs );
        return await handleDeletePersonality( personalityName, services, context, responseChannel );
    }

    const response = `❌ Unknown command: "${ subCommand }"\n\nAvailable commands: list, show, showall, save, update, activate, delete`;
    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: false, shouldRespond: true, response };
}

handlePersonalityCommand.requiredRole = requiredRole;
handlePersonalityCommand.description = description;
handlePersonalityCommand.example = example;
handlePersonalityCommand.hidden = hidden;

module.exports = handlePersonalityCommand;
