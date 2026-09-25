'use strict';

const config = require( '../../config.js' );

// Set required role level for this command
const requiredRole = 'USER';
const description = 'Schedule removal after current song';
const example = 'escortme | escortme stop';
const hidden = false;

/**
 * Parses command arguments to determine action and any switches
 * @param {string} args - Raw command arguments
 * @returns {Object} Parsed command with action and switches
 */
function parseCommand ( args ) {
    const trimmed = args.trim().toLowerCase();
    const parts = trimmed.split( /\s+/ );
    const action = parts[ 0 ];
    const switches = parts.slice( 1 );

    return {
        action,
        switches,
        isStop: action === 'stop'
    };
}

/**
 * Gets the nickname for a user UUID
 * @param {string} uuid - User UUID
 * @param {Object} services - Services container
 * @returns {string} User's nickname or UUID as fallback
 */
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

/**
 * Finds user's position in DJ queue
 * Framework-agnostic: Works with both Hang (uuid) and Wavez (userId) formats
 * @param {string} userId - User ID (uuid for Hang, userId for Wavez)
 * @param {Object} services - Services container
 * @returns {number} Position in queue (-1 if not found, 0 if currently playing, 1-20 if in queue)
 */
function findUserDjPosition ( userId, services ) {
    try {
        // Use getDjQueue() which handles both frameworks (Hang and Wavez)
        // Normalized DJ objects have userId field in both frameworks
        const djQueue = services.stateService.getDjQueue();
        if ( !djQueue || !Array.isArray( djQueue ) ) {
            return -1;
        }

        // Find by userId (works for both Hang and Wavez normalized format)
        const position = djQueue.findIndex( dj => dj.userId === userId );
        return position;
    } catch ( err ) {
        return -1;
    }
}

/**
 * Handles the escortme command
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel
 * @returns {Promise<Object>} Command result
 */
async function handleEscortmeCommand ( commandParams ) {
    const { args, services, context, responseChannel = 'request' } = commandParams;
    const { messageService, stateService, logger } = services;

    // Get sender's UUID
    const userUuid = context?.sender;

    if ( !userUuid ) {
        const response = '❌ Unable to determine your identity.';
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services,
    context
        } );
        return {
            success: false,
            response,
            shouldRespond: true,
            error: 'No user UUID'
        };
    }

    // Parse command arguments
    const parsed = parseCommand( args );

    // Find user's position in DJ queue
    const userPosition = findUserDjPosition( userUuid, services );

    // Check if user is on decks or in queue (positions 0-20)
    if ( userPosition === -1 || userPosition > 20 ) {
        const response = `❌ You must be on the decks to use the ${ config.COMMAND_SWITCH }escortme command.`;
        logger.info( `[escortme] User ${ userUuid } attempted escortme but not on decks (position: ${ userPosition })` );
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services,
    context
        } );
        return {
            success: false,
            response,
            shouldRespond: true,
            error: 'User not on decks'
        };
    }

    // Determine if user is currently playing or queued
    const isCurrentlyPlaying = userPosition === 0;
    const positionText = isCurrentlyPlaying ? 'currently playing' : `in queue at position ${ userPosition }`;
    const nickname = getNickname( userUuid, services );

    // Phase 2: Handle escortme enable/disable logic
    if ( parsed.isStop ) {
        // User is requesting to stop/cancel escortme
        const escortQueue = services.dataService.getValue( 'escortQueue' ) || {};

        if ( !escortQueue[ userUuid ] ) {
            const response = `❌ You don't have escortme enabled.`;
            logger.info( `[escortme] User ${ nickname } (${ userUuid }) tried to stop but escortme not enabled` );
            await messageService.sendResponse( response, {
                responseChannel,
                isPrivateMessage: context?.fullMessage?.isPrivateMessage,
                sender: context?.sender,
                services,
    context
            } );
            return {
                success: false,
                response,
                shouldRespond: true,
                error: 'Escortme not enabled'
            };
        }

        // Clear the escortme flag
        delete escortQueue[ userUuid ];
        services.dataService.setValue( 'escortQueue', escortQueue );

        const response = `✅ Escortme cancelled. You will remain on the decks.`;
        logger.info( `[escortme] User ${ nickname } (${ userUuid }) cancelled escortme` );
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services,
    context
        } );

        return {
            success: true,
            response,
            shouldRespond: true
        };
    }

    // User is enabling escortme
    const escortQueue = services.dataService.getValue( 'escortQueue' ) || {};

    // Check if already enabled
    if ( escortQueue[ userUuid ] ) {
        const response = `⏰ You already have escortme enabled. Use ${ config.COMMAND_SWITCH }escortme stop to cancel.`;
        logger.info( `[escortme] User ${ nickname } (${ userUuid }) tried to enable but already enabled` );
        await messageService.sendResponse( response, {
            responseChannel,
            isPrivateMessage: context?.fullMessage?.isPrivateMessage,
            sender: context?.sender,
            services,
    context
        } );
        return {
            success: false,
            response,
            shouldRespond: true,
            error: 'Escortme already enabled'
        };
    }

    // Set the escortme flag
    escortQueue[ userUuid ] = {
        markedAt: Date.now(),
        removeAfterCurrent: isCurrentlyPlaying
    };
    services.dataService.setValue( 'escortQueue', escortQueue );

    // Provide context-appropriate confirmation message
    const confirmationMessage = isCurrentlyPlaying
        ? '✅ You will be removed after your song ends.'
        : '✅ You will be removed after your song plays.';

    logger.info( `[escortme] User ${ nickname } (${ userUuid }) enabled escortme (${ positionText })` );
    await messageService.sendResponse( confirmationMessage, {
        responseChannel,
        isPrivateMessage: context?.fullMessage?.isPrivateMessage,
        sender: context?.sender,
        services,
    context
    } );

    return {
        success: true,
        response: confirmationMessage,
        shouldRespond: true
    };
}

// Attach metadata to the function
handleEscortmeCommand.requiredRole = requiredRole;
handleEscortmeCommand.description = description;
handleEscortmeCommand.example = example;
handleEscortmeCommand.hidden = hidden;

module.exports = handleEscortmeCommand;
