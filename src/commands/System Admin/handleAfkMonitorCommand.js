'use strict';

const { hasPermission } = require( '../../lib/roleUtils' );
const config = require( '../../config' );

const DEFAULT_FIRST_WARNING_MS = 15 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 60 * 1000;

function formatAge ( date ) {
    if ( !date ) return '—';
    const mins = Math.floor( ( Date.now() - date.getTime() ) / 60000 );
    return mins === 0 ? 'just now' : `${ mins }m ago`;
}

function findUserByName ( name, snapshot ) {
    const lower = name.toLowerCase();
    return snapshot.find( e => e.nickname?.toLowerCase() === lower )
        || snapshot.find( e => e.nickname?.toLowerCase().includes( lower ) );
}

async function handleAfkMonitorCommand ( { args, services, context, responseChannel = 'request' } ) {
    const { afkService, stateService, dataService, messageService, featuresService } = services;

    if ( !featuresService?.isFeatureEnabled( 'afkMonitor' ) ) {
        const response = '❌ AFK monitor is currently disabled.';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Feature disabled' };
    }

    const senderRole = stateService.getUserRole( context.sender );
    if ( !hasPermission( senderRole, 'MODERATOR' ) ) {
        const response = '❌ You need at least moderator permissions to use this command.';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: false, shouldRespond: true, response, error: 'Insufficient permissions' };
    }

    const argParts = args.trim().split( /\s+/ ).filter( Boolean );
    const subCommand = argParts[ 0 ]?.toLowerCase() || '';

    switch ( subCommand ) {
        case 'status':
            return handleStatus( afkService, stateService, dataService, messageService, responseChannel, context, services );

        case 'exempt': {
            if ( !hasPermission( senderRole, 'OWNER' ) ) {
                const response = '❌ Only the room owner can exempt DJs.';
                await messageService.sendResponse( response, { responseChannel, isPrivateMessage: context?.fullMessage?.isPrivateMessage, sender: context?.sender, services } );
                return { success: false, shouldRespond: true, response, error: 'Insufficient permissions' };
            }
            const name = argParts.slice( 1 ).join( ' ' );
            return handleExempt( name, afkService, messageService, responseChannel, context, services );
        }

        case 'reset': {
            if ( !hasPermission( senderRole, 'OWNER' ) ) {
                const response = '❌ Only the room owner can reset AFK timers.';
                await messageService.sendResponse( response, { responseChannel, isPrivateMessage: context?.fullMessage?.isPrivateMessage, sender: context?.sender, services } );
                return { success: false, shouldRespond: true, response, error: 'Insufficient permissions' };
            }
            const name = argParts.slice( 1 ).join( ' ' );
            return handleReset( name, afkService, messageService, responseChannel, context, services );
        }

        case 'set': {
            if ( !hasPermission( senderRole, 'OWNER' ) ) {
                const response = '❌ Only the room owner can change AFK settings.';
                await messageService.sendResponse( response, { responseChannel, isPrivateMessage: context?.fullMessage?.isPrivateMessage, sender: context?.sender, services } );
                return { success: false, shouldRespond: true, response, error: 'Insufficient permissions' };
            }
            const setting = argParts[ 1 ]?.toLowerCase();
            const value = argParts[ 2 ];
            return handleSet( setting, value, dataService, messageService, responseChannel, context, services );
        }

        default: {
            const cmdSwitch = config.COMMAND_SWITCH || '!';
            const response =
                `📋 **AFK Monitor Usage:**\n\n` +
                `\`${ cmdSwitch }afkMonitor status\` — Show all DJs and their last activity\n` +
                `\`${ cmdSwitch }afkMonitor exempt <name>\` — Exempt a DJ from warnings this session\n` +
                `\`${ cmdSwitch }afkMonitor reset <name>\` — Reset a DJ's inactivity timer to now\n` +
                `\`${ cmdSwitch }afkMonitor set warning <seconds>\` — Set first-warning threshold\n` +
                `\`${ cmdSwitch }afkMonitor set interval <seconds>\` — Set interval between warnings`;
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services
            } );
            return { success: false, shouldRespond: true, response, error: 'Unknown subcommand' };
        }
    }
}

async function handleStatus ( afkService, stateService, dataService, messageService, responseChannel, context, services ) {
    const djs = stateService._getDjs();

    if ( !djs.length ) {
        const response = 'ℹ️ No DJs are currently on the decks.';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services
        } );
        return { success: true, shouldRespond: true, response };
    }

    const snapshotByUuid = new Map( afkService.getActivitySnapshot().map( e => [ e.uuid, e ] ) );

    const firstWarningMs = dataService?.getValue( 'afk.firstWarningMs' ) ?? DEFAULT_FIRST_WARNING_MS;
    const intervalMs = dataService?.getValue( 'afk.intervalMs' ) ?? DEFAULT_INTERVAL_MS;
    const firstWarningMins = Math.round( firstWarningMs / 60000 );
    const intervalMins = Math.round( intervalMs / 60000 );

    const lines = [ `🎧 **AFK Monitor** — warn at ${ firstWarningMins }m, every ${ intervalMins }m after\n` ];

    for ( const dj of djs ) {
        const entry = snapshotByUuid.get( dj.uuid );
        const nickname = entry?.nickname || dj.uuid;
        if ( !entry ) {
            lines.push( `**${ nickname }** — not tracked yet` );
            continue;
        }
        const exemptTag = entry.exempted ? ' (exempt)' : '';
        const lastActive = formatAge( entry.mostRecent );
        const chat = formatAge( entry.activity?.chat );
        const emoji = formatAge( entry.activity?.emoji );
        const vote = formatAge( entry.activity?.vote );
        const queue = formatAge( entry.activity?.queue );
        const decks = formatAge( entry.activity?.joinedDecks );
        lines.push( `**${ nickname }**${ exemptTag } — last active: ${ lastActive }  (chat: ${ chat }  emoji: ${ emoji }  vote: ${ vote }  queue: ${ queue }  decks: ${ decks })` );
    }

    const response = lines.join( '\n' );
    await messageService.sendResponse( response, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services
    } );
    return { success: true, shouldRespond: true, response };
}

async function handleExempt ( name, afkService, messageService, responseChannel, context, services ) {
    if ( !name ) {
        const cmdSwitch = config.COMMAND_SWITCH || '!';
        const response = `❌ Please specify a DJ name. Usage: \`${ cmdSwitch }afkMonitor exempt <name>\``;
        await messageService.sendResponse( response, { responseChannel, isPrivateMessage: context?.fullMessage?.isPrivateMessage, sender: context?.sender, services } );
        return { success: false, shouldRespond: true, response, error: 'Missing name' };
    }

    const snapshot = afkService.getActivitySnapshot();
    const entry = findUserByName( name, snapshot );

    if ( !entry ) {
        const response = `❌ Could not find a tracked user matching "${ name }".`;
        await messageService.sendResponse( response, { responseChannel, isPrivateMessage: context?.fullMessage?.isPrivateMessage, sender: context?.sender, services } );
        return { success: false, shouldRespond: true, response, error: 'User not found' };
    }

    afkService.setExempt( entry.uuid );
    const response = `✅ **${ entry.nickname || entry.uuid }** has been exempted from AFK warnings for this session.`;
    await messageService.sendResponse( response, { responseChannel, isPrivateMessage: context?.fullMessage?.isPrivateMessage, sender: context?.sender, services } );
    return { success: true, shouldRespond: true, response };
}

async function handleReset ( name, afkService, messageService, responseChannel, context, services ) {
    if ( !name ) {
        const cmdSwitch = config.COMMAND_SWITCH || '!';
        const response = `❌ Please specify a DJ name. Usage: \`${ cmdSwitch }afkMonitor reset <name>\``;
        await messageService.sendResponse( response, { responseChannel, isPrivateMessage: context?.fullMessage?.isPrivateMessage, sender: context?.sender, services } );
        return { success: false, shouldRespond: true, response, error: 'Missing name' };
    }

    const snapshot = afkService.getActivitySnapshot();
    const entry = findUserByName( name, snapshot );

    if ( !entry ) {
        const response = `❌ Could not find a tracked user matching "${ name }".`;
        await messageService.sendResponse( response, { responseChannel, isPrivateMessage: context?.fullMessage?.isPrivateMessage, sender: context?.sender, services } );
        return { success: false, shouldRespond: true, response, error: 'User not found' };
    }

    afkService.resetActivity( entry.uuid );
    const response = `✅ AFK timer reset for **${ entry.nickname || entry.uuid }**.`;
    await messageService.sendResponse( response, { responseChannel, isPrivateMessage: context?.fullMessage?.isPrivateMessage, sender: context?.sender, services } );
    return { success: true, shouldRespond: true, response };
}

async function handleSet ( setting, value, dataService, messageService, responseChannel, context, services ) {
    const cmdSwitch = config.COMMAND_SWITCH || '!';

    if ( setting !== 'warning' && setting !== 'interval' ) {
        const response = `❌ Unknown setting "${ setting }". Use \`warning\` or \`interval\`.`;
        await messageService.sendResponse( response, { responseChannel, isPrivateMessage: context?.fullMessage?.isPrivateMessage, sender: context?.sender, services } );
        return { success: false, shouldRespond: true, response, error: 'Unknown setting' };
    }

    const seconds = parseInt( value, 10 );
    if ( !value || isNaN( seconds ) || seconds <= 0 ) {
        const response = `❌ Please provide a positive integer number of seconds. Usage: \`${ cmdSwitch }afkMonitor set ${ setting } <seconds>\``;
        await messageService.sendResponse( response, { responseChannel, isPrivateMessage: context?.fullMessage?.isPrivateMessage, sender: context?.sender, services } );
        return { success: false, shouldRespond: true, response, error: 'Invalid value' };
    }

    const key = setting === 'warning' ? 'afk.firstWarningMs' : 'afk.intervalMs';
    const label = setting === 'warning' ? 'First warning threshold' : 'Warning interval';
    dataService.setValue( key, seconds * 1000 );

    const response = `✅ ${ label } set to **${ seconds } seconds** (${ Math.round( seconds / 60 * 10 ) / 10 } minutes).`;
    await messageService.sendResponse( response, { responseChannel, isPrivateMessage: context?.fullMessage?.isPrivateMessage, sender: context?.sender, services } );
    return { success: true, shouldRespond: true, response };
}

handleAfkMonitorCommand.requiredRole = 'MODERATOR';
handleAfkMonitorCommand.description = 'Manage AFK monitor settings';
handleAfkMonitorCommand.example = 'afkMonitor status';
handleAfkMonitorCommand.hidden = false;

module.exports = handleAfkMonitorCommand;
