const { logger } = require( '../../lib/logging.js' );
const fs = require( 'fs' );
const path = require( 'path' );

const WELCOME_MESSAGES_PATH = path.join( __dirname, '../../../data/welcomeMessages.json' );

function isValidImageUrl ( url ) {
    try {
        const urlObj = new URL( url );
        if ( ![ 'http:', 'https:' ].includes( urlObj.protocol ) ) return false;
        const imageExtensions = [ '.gif', '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.svg' ];
        const imageHosts = [ 'giphy.com', 'tenor.com', 'imgur.com', 'media.giphy.com', 'media.tenor.com',
            'media0.giphy.com', 'media1.giphy.com', 'media2.giphy.com', 'media3.giphy.com', 'media4.giphy.com' ];
        const hasImageExt = imageExtensions.some( ext => url.toLowerCase().includes( ext ) );
        const hasImageHost = imageHosts.some( host => urlObj.hostname.includes( host ) );
        return hasImageExt || hasImageHost;
    } catch {
        return false;
    }
}

function loadWelcomeMessages () {
    if ( !fs.existsSync( WELCOME_MESSAGES_PATH ) ) return {};
    return JSON.parse( fs.readFileSync( WELCOME_MESSAGES_PATH, 'utf8' ) );
}

function saveWelcomeMessages ( data ) {
    fs.writeFileSync( WELCOME_MESSAGES_PATH, JSON.stringify( data, null, 2 ), 'utf8' );
}

function normalizeWhitespace ( str ) {
    return str.trim().replace( /\s+/g, ' ' );
}

function resolveUuid ( identifier, services ) {
    if ( /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test( identifier ) ) {
        return identifier;
    }
    const normalizedId = normalizeWhitespace( identifier ).toLowerCase();

    if ( services.stateService ) {
        try {
            const allUserData = services.stateService._getCurrentState()?.allUserData || {};
            const match = Object.entries( allUserData ).find(
                ( [ , data ] ) => data?.userProfile?.nickname?.toLowerCase() === identifier.toLowerCase()
            );
            if ( match ) return match[ 0 ];
        } catch { }
    }
    if ( services.databaseService?.initialized ) {
        const row = services.databaseService.findDjByNickname( identifier );
        if ( row ) return row.uuid;
    }

    // Normalized whitespace fallback — handles extra/double spaces in stored names
    if ( services.stateService ) {
        try {
            const allUserData = services.stateService._getCurrentState()?.allUserData || {};
            const match = Object.entries( allUserData ).find(
                ( [ , data ] ) => {
                    const nick = data?.userProfile?.nickname;
                    return nick && normalizeWhitespace( nick ).toLowerCase() === normalizedId;
                }
            );
            if ( match ) return match[ 0 ];
        } catch { }
    }
    if ( services.databaseService?.initialized ) {
        try {
            const rows = services.databaseService.getAllDjNicknames();
            const match = rows.find( row => normalizeWhitespace( row.nickname ).toLowerCase() === normalizedId );
            if ( match ) return match.uuid;
        } catch { }
    }

    return null;
}

function levenshtein ( a, b ) {
    const m = a.length, n = b.length;
    const dp = Array.from( { length: m + 1 }, ( _, i ) => [ i, ...Array( n ).fill( 0 ) ] );
    for ( let j = 0; j <= n; j++ ) dp[ 0 ][ j ] = j;
    for ( let i = 1; i <= m; i++ ) {
        for ( let j = 1; j <= n; j++ ) {
            dp[ i ][ j ] = a[ i - 1 ] === b[ j - 1 ]
                ? dp[ i - 1 ][ j - 1 ]
                : 1 + Math.min( dp[ i - 1 ][ j ], dp[ i ][ j - 1 ], dp[ i - 1 ][ j - 1 ] );
        }
    }
    return dp[ m ][ n ];
}

function getSuggestions ( identifier, services ) {
    const candidates = [];
    const lower = identifier.toLowerCase();

    if ( services.stateService ) {
        try {
            const allUserData = services.stateService._getCurrentState()?.allUserData || {};
            for ( const data of Object.values( allUserData ) ) {
                const nick = data?.userProfile?.nickname;
                if ( nick ) candidates.push( nick );
            }
        } catch { }
    }

    if ( services.databaseService?.initialized ) {
        try {
            const rows = services.databaseService.getAllDjNicknames();
            for ( const row of rows ) {
                if ( row.nickname && !candidates.includes( row.nickname ) ) {
                    candidates.push( row.nickname );
                }
            }
        } catch { }
    }

    return candidates
        .map( nick => ( { nick, dist: levenshtein( lower, nick.toLowerCase() ) } ) )
        .sort( ( a, b ) => a.dist - b.dist )
        .slice( 0, 3 )
        .filter( ( { dist } ) => dist <= Math.max( 5, Math.floor( identifier.length / 2 ) ) )
        .map( ( { nick } ) => `"${ nick }"` );
}

function notFoundMessage ( identifier, services ) {
    const suggestions = getSuggestions( identifier, services );
    if ( suggestions.length === 0 ) {
        return `❌ User "${ identifier }" not found.`;
    }
    return `❌ User "${ identifier }" not found. Did you mean: ${ suggestions.join( ', ' ) }?`;
}

function parseIdentifierAndRest ( str ) {
    const trimmed = str.trim();
    if ( trimmed.startsWith( '"' ) ) {
        const closing = trimmed.indexOf( '"', 1 );
        if ( closing !== -1 ) {
            return {
                identifier: trimmed.slice( 1, closing ).trim(),
                rest: trimmed.slice( closing + 1 ).trim()
            };
        }
    }
    const spaceIdx = trimmed.indexOf( ' ' );
    if ( spaceIdx === -1 ) return { identifier: trimmed, rest: '' };
    return { identifier: trimmed.slice( 0, spaceIdx ), rest: trimmed.slice( spaceIdx + 1 ).trim() };
}

function getNickname ( uuid, services ) {
    if ( services.stateService ) {
        try {
            const allUserData = services.stateService._getCurrentState()?.allUserData || {};
            const nickname = allUserData[ uuid ]?.userProfile?.nickname;
            if ( nickname ) return nickname;
        } catch { }
    }
    return uuid;
}

async function sendResponse ( message, services, context ) {
    await services.messageService.sendResponse( message, {
        responseChannel: 'request',
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: false, shouldRespond: true, response: message };
}

async function sendSuccessResponse ( message, services, context ) {
    await services.messageService.sendResponse( message, {
        responseChannel: 'request',
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: true, shouldRespond: true, response: message };
}

async function handleEditWelcomeCommand ( commandParams ) {
    const { args, services, context } = commandParams;
    const { config } = services;
    const cmdSwitch = config?.COMMAND_SWITCH || '!';

    const usageText =
        `\`${ cmdSwitch }editWelcome list\` - List all users with custom welcome messages\n` +
        `\`${ cmdSwitch }editWelcome show <"nickname"|uuid>\` - Show a user's welcome messages\n` +
        `\`${ cmdSwitch }editWelcome addMessage <"nickname"|uuid> <message>\` - Add a welcome message\n` +
        `\`${ cmdSwitch }editWelcome removeMessage <"nickname"|uuid> <message>\` - Remove a welcome message\n` +
        `\`${ cmdSwitch }editWelcome addImage <"nickname"|uuid> <url>\` - Add a welcome image\n` +
        `\`${ cmdSwitch }editWelcome removeImage <"nickname"|uuid> <url>\` - Remove a welcome image\n` +
        `\`${ cmdSwitch }editWelcome remove <"nickname"|uuid>\` - Remove all welcome data for a user\n` +
        'Note: wrap names containing spaces in double quotes, e.g. "Dr. Fart Mustache"';

    try {
        if ( !args || args.trim().length === 0 ) {
            return await sendResponse( `❌ No subcommand provided.\n\n${ usageText }`, services, context );
        }

        const parts = args.trim().split( ' ' );
        const subcommand = parts[ 0 ].toLowerCase();

        if ( subcommand === 'list' ) {
            const welcomeData = loadWelcomeMessages();
            const uuids = Object.keys( welcomeData );
            if ( uuids.length === 0 ) {
                return await sendResponse( '📋 No users have custom welcome messages.', services, context );
            }
            let response = '**📋 Users with custom welcome messages:**\n\n';
            uuids.forEach( uuid => {
                const nickname = getNickname( uuid, services );
                const entry = welcomeData[ uuid ];
                const msgCount = ( entry.messages || [] ).length;
                const imgCount = ( entry.pictures || [] ).filter( p => p ).length;
                const display = nickname !== uuid ? `${ nickname } (${ uuid })` : uuid;
                response += `• ${ display } - ${ msgCount } message(s), ${ imgCount } image(s)\n`;
            } );
            return await sendSuccessResponse( response, services, context );
        }

        if ( subcommand === 'show' ) {
            const { identifier } = parseIdentifierAndRest( parts.slice( 1 ).join( ' ' ) );
            if ( !identifier ) {
                return await sendResponse( `❌ Usage: \`${ cmdSwitch }editWelcome show <"nickname"|uuid>\``, services, context );
            }
            const uuid = resolveUuid( identifier, services );
            if ( !uuid ) {
                return await sendResponse( notFoundMessage( identifier, services ), services, context );
            }
            const welcomeData = loadWelcomeMessages();
            const entry = welcomeData[ uuid ];
            if ( !entry ) {
                return await sendResponse( `❌ No custom welcome messages found for "${ identifier }".`, services, context );
            }
            const nickname = getNickname( uuid, services );
            const messages = entry.messages || [];
            const pictures = ( entry.pictures || [] ).filter( p => p );

            let response = `**Welcome messages for ${ nickname }:**\n\n`;
            if ( messages.length > 0 ) {
                response += `**Messages:** (${ messages.length })\n`;
                messages.forEach( ( msg, i ) => {
                    const display = msg.length > 100 ? msg.substring( 0, 100 ) + '...' : msg;
                    response += `  ${ i + 1 }. ${ display }\n`;
                } );
                response += '\n';
            } else {
                response += '**Messages:** None\n\n';
            }
            if ( pictures.length > 0 ) {
                response += `**Images:** (${ pictures.length })\n`;
                pictures.forEach( ( img, i ) => {
                    response += `  ${ i + 1 }. ${ img }\n`;
                } );
            } else {
                response += '**Images:** None';
            }
            return await sendSuccessResponse( response, services, context );
        }

        if ( subcommand === 'addmessage' ) {
            const { identifier, rest: message } = parseIdentifierAndRest( parts.slice( 1 ).join( ' ' ) );
            if ( !identifier ) {
                return await sendResponse( `❌ Usage: \`${ cmdSwitch }editWelcome addMessage <"nickname"|uuid> <message>\``, services, context );
            }
            const uuid = resolveUuid( identifier, services );
            if ( !uuid ) {
                return await sendResponse( notFoundMessage( identifier, services ), services, context );
            }
            if ( !message || message.trim().length === 0 ) {
                return await sendResponse( `❌ Message cannot be empty.`, services, context );
            }
            const welcomeData = loadWelcomeMessages();
            if ( !welcomeData[ uuid ] ) welcomeData[ uuid ] = { messages: [], pictures: [] };
            if ( !Array.isArray( welcomeData[ uuid ].messages ) ) welcomeData[ uuid ].messages = [];
            if ( welcomeData[ uuid ].messages.includes( message ) ) {
                return await sendResponse( `❌ This message already exists for this user.`, services, context );
            }
            welcomeData[ uuid ].messages.push( message );
            saveWelcomeMessages( welcomeData );
            logger.info( `Welcome message added for ${ uuid } by ${ context?.sender }` );
            const nickname = getNickname( uuid, services );
            return await sendSuccessResponse( `✅ Welcome message added for ${ nickname }.`, services, context );
        }

        if ( subcommand === 'removemessage' ) {
            const { identifier, rest: message } = parseIdentifierAndRest( parts.slice( 1 ).join( ' ' ) );
            if ( !identifier ) {
                return await sendResponse( `❌ Usage: \`${ cmdSwitch }editWelcome removeMessage <"nickname"|uuid> <message>\``, services, context );
            }
            const uuid = resolveUuid( identifier, services );
            if ( !uuid ) {
                return await sendResponse( notFoundMessage( identifier, services ), services, context );
            }
            if ( !message || message.trim().length === 0 ) {
                return await sendResponse( `❌ Message cannot be empty.`, services, context );
            }
            const welcomeData = loadWelcomeMessages();
            if ( !welcomeData[ uuid ] || !Array.isArray( welcomeData[ uuid ].messages ) ) {
                return await sendResponse( `❌ No messages found for this user.`, services, context );
            }
            const index = welcomeData[ uuid ].messages.indexOf( message );
            if ( index === -1 ) {
                return await sendResponse( `❌ Message not found. Only exact matches are removed.`, services, context );
            }
            welcomeData[ uuid ].messages.splice( index, 1 );
            saveWelcomeMessages( welcomeData );
            logger.info( `Welcome message removed for ${ uuid } by ${ context?.sender }` );
            const nickname = getNickname( uuid, services );
            return await sendSuccessResponse( `✅ Welcome message removed for ${ nickname }.`, services, context );
        }

        if ( subcommand === 'addimage' ) {
            const { identifier, rest: imageUrl } = parseIdentifierAndRest( parts.slice( 1 ).join( ' ' ) );
            if ( !identifier || !imageUrl ) {
                return await sendResponse( `❌ Usage: \`${ cmdSwitch }editWelcome addImage <"nickname"|uuid> <url>\``, services, context );
            }
            if ( !isValidImageUrl( imageUrl ) ) {
                return await sendResponse( `❌ Invalid image URL. Must be a valid HTTPS URL pointing to an image.`, services, context );
            }
            const uuid = resolveUuid( identifier, services );
            if ( !uuid ) {
                return await sendResponse( notFoundMessage( identifier, services ), services, context );
            }
            const welcomeData = loadWelcomeMessages();
            if ( !welcomeData[ uuid ] ) welcomeData[ uuid ] = { messages: [], pictures: [] };
            if ( !Array.isArray( welcomeData[ uuid ].pictures ) ) welcomeData[ uuid ].pictures = [];
            if ( welcomeData[ uuid ].pictures.includes( imageUrl ) ) {
                return await sendResponse( `❌ This image URL already exists for this user.`, services, context );
            }
            welcomeData[ uuid ].pictures.push( imageUrl );
            saveWelcomeMessages( welcomeData );
            logger.info( `Welcome image added for ${ uuid } by ${ context?.sender }` );
            const nickname = getNickname( uuid, services );
            return await sendSuccessResponse( `✅ Welcome image added for ${ nickname }.`, services, context );
        }

        if ( subcommand === 'removeimage' ) {
            const { identifier, rest: imageUrl } = parseIdentifierAndRest( parts.slice( 1 ).join( ' ' ) );
            if ( !identifier || !imageUrl ) {
                return await sendResponse( `❌ Usage: \`${ cmdSwitch }editWelcome removeImage <"nickname"|uuid> <url>\``, services, context );
            }
            const uuid = resolveUuid( identifier, services );
            if ( !uuid ) {
                return await sendResponse( notFoundMessage( identifier, services ), services, context );
            }
            const welcomeData = loadWelcomeMessages();
            if ( !welcomeData[ uuid ] || !Array.isArray( welcomeData[ uuid ].pictures ) ) {
                return await sendResponse( `❌ No images found for this user.`, services, context );
            }
            const index = welcomeData[ uuid ].pictures.indexOf( imageUrl );
            if ( index === -1 ) {
                return await sendResponse( `❌ Image URL not found. Only exact matches are removed.`, services, context );
            }
            welcomeData[ uuid ].pictures.splice( index, 1 );
            saveWelcomeMessages( welcomeData );
            logger.info( `Welcome image removed for ${ uuid } by ${ context?.sender }` );
            const nickname = getNickname( uuid, services );
            return await sendSuccessResponse( `✅ Welcome image removed for ${ nickname }.`, services, context );
        }

        if ( subcommand === 'remove' ) {
            const { identifier } = parseIdentifierAndRest( parts.slice( 1 ).join( ' ' ) );
            if ( !identifier ) {
                return await sendResponse( `❌ Usage: \`${ cmdSwitch }editWelcome remove <"nickname"|uuid>\``, services, context );
            }
            const uuid = resolveUuid( identifier, services );
            if ( !uuid ) {
                return await sendResponse( notFoundMessage( identifier, services ), services, context );
            }
            const welcomeData = loadWelcomeMessages();
            if ( !welcomeData[ uuid ] ) {
                return await sendResponse( `❌ No custom welcome data found for "${ identifier }".`, services, context );
            }
            delete welcomeData[ uuid ];
            saveWelcomeMessages( welcomeData );
            logger.info( `Welcome data removed for ${ uuid } by ${ context?.sender }` );
            return await sendSuccessResponse( `✅ All custom welcome data removed for "${ identifier }".`, services, context );
        }

        return await sendResponse( `❌ Unknown subcommand "${ subcommand }".\n\n${ usageText }`, services, context );
    } catch ( error ) {
        logger.error( `Error in handleEditWelcomeCommand: ${ error.message }` );
        return { success: false, shouldRespond: true, response: `❌ Error processing command: ${ error.message }` };
    }
}

handleEditWelcomeCommand.requiredRole = 'OWNER';
handleEditWelcomeCommand.description = 'Manage per-user welcome messages';
handleEditWelcomeCommand.example = 'addMessage "Dr. Fart Mustache" Hey {username}, welcome back! 🎉';
handleEditWelcomeCommand.hidden = false;

module.exports = handleEditWelcomeCommand;
