/**
 * Handler for when room settings are updated (including room name changes)
 * @param {Object} message - The stateful message containing room settings updates
 * @param {Object} state - Current state
 * @param {Object} services - Services container
 */
async function updatedRoomSettings(message, state, services) {
  services.logger.debug('updatedRoomSettings.js handler called');

  try {
    // Look for patch operations that update room settings
    if (message.statePatch && Array.isArray(message.statePatch)) {
      
      // Check for room name updates
      const nameUpdatePatch = message.statePatch.find(patch => 
        patch.op === 'replace' && 
        patch.path === '/settings/name'
      );

      if (nameUpdatePatch && nameUpdatePatch.value) {
        const newRoomName = nameUpdatePatch.value;
        services.logger.info(`🏠 Room name updated to: "${newRoomName}"`);
        
        // Verify the StateService can read the new name
        const stateServiceName = services.stateService.getHangoutName();
        services.logger.info(`✅ StateService now reads room name as: "${stateServiceName}"`);
        
        // Welcome messages will automatically use the new name for future users
      }

      // Log other settings changes for debugging
      const otherPatches = message.statePatch.filter(patch => 
        patch.path.startsWith('/settings/') && patch.path !== '/settings/name'
      );
      
      if (otherPatches.length > 0) {
        services.logger.debug(`Other room settings updated: ${otherPatches.map(p => p.path).join(', ')}`);
      }
    }

    // Emit normalized roomSettingsChanged event for the normalized handler to process
    if ( services.eventDispatcher ) {
      const event = {
        type: 'roomSettingsChanged',
        eventId: `roomSettingsChanged:${ Date.now() }`,
        occurredAt: new Date().toISOString(),
        source: 'hangfm',
        payload: {
          roomSettings: services.stateService.getRoomSettings()
        }
      };
      services.eventDispatcher.dispatch( event, { bot: services.bot, services } );
    }
  } catch (error) {
    services.logger.error('Error processing updatedRoomSettings message:', error);
  }
}

/**
 * Normalized handler for roomSettingsChanged events (works with both Hang and Wavez)
 * Logs room name changes and updates
 * @param {Object} event - Normalized roomSettingsChanged event with payload.roomSettings
 * @param {Object} context - Handler context containing services
 */
async function handleUpdatedRoomSettingsEvent ( event, context ) {
  const services = context.services;
  if ( !services ) {
    console.error( '[handleUpdatedRoomSettingsEvent] No services provided in context' );
    return;
  }

  try {
    const roomSettings = event.payload?.roomSettings;

    if ( !roomSettings ) {
      services.logger?.debug?.( '[handleUpdatedRoomSettingsEvent] No roomSettings in event payload' );
      return;
    }

    // Check for room name updates and log
    if ( roomSettings.name ) {
      services.logger?.info?.( `🏠 Room name updated to: "${ roomSettings.name }"` );
      
      // Verify the StateService can read the new name
      const stateServiceName = services.stateService?.getHangoutName?.();
      if ( stateServiceName ) {
        services.logger?.info?.( `✅ StateService now reads room name as: "${ stateServiceName }"` );
      }
    }

    // Log other settings changes for debugging
    const settingKeys = Object.keys( roomSettings ).filter( k => k !== 'name' && k !== 'description' );
    if ( settingKeys.length > 0 ) {
      services.logger?.debug?.( `Other room settings updated: ${ settingKeys.join( ', ' ) }` );
    }

  } catch ( error ) {
    services.logger?.error?.( `[handleUpdatedRoomSettingsEvent] Error: ${ error.message }` );
    services.logger?.error?.( `[handleUpdatedRoomSettingsEvent] Stack: ${ error.stack }` );
  }
}

module.exports = updatedRoomSettings;
module.exports.handleUpdatedRoomSettingsEvent = handleUpdatedRoomSettingsEvent;