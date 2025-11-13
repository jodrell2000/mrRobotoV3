// Set required role level for this command
const requiredRole = 'OWNER';
const description = 'Manage bot features "list" to see all or "enable/disable/status" to modify';
const example = 'feature <feature name> enable|disable|status>';
const hidden = false;
const config = require( '../../config' );
const { hasPermission } = require( '../../lib/roleUtils' );

/**
 * Handle the !feature command for managing bot features
 * @param {Object} commandParams - Standard command parameters
 * @param {string} commandParams.command - The command name
 * @param {string} commandParams.args - Command arguments
 * @param {Object} commandParams.services - Service container
 * @param {Object} commandParams.context - Command context
 * @param {string} commandParams.responseChannel - Response channel ('public' or 'request')
 * @returns {Promise<Object>} Command result
 */
async function handleFeatureCommand ( commandParams ) {
  const { args, services, context, responseChannel = 'request' } = commandParams;
  const { featuresService, messageService, stateService } = services;

  try {
    // Check if user has required permissions (owner or coOwner)
    const senderRole = stateService.getUserRole( context.sender );

    if ( !hasPermission( senderRole, requiredRole ) ) {
      const response = '❌ Only the room owner or co-owner can manage features.';
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
        error: 'Insufficient permissions'
      };
    }

    // Parse subcommand and arguments
    const argParts = args.trim().split( /\s+/ );
    const subCommand = argParts[ 0 ]?.toLowerCase() || '';
    const featureName = argParts[ 1 ];

    switch ( subCommand ) {
      case 'list':
        return await handleListFeatures( featuresService, messageService, responseChannel, context, services );

      case 'enable':
        return await handleEnableFeature( featureName, featuresService, messageService, responseChannel, context, services );

      case 'disable':
        return await handleDisableFeature( featureName, featuresService, messageService, responseChannel, context, services );

      case 'status':
        return await handleFeatureStatus( featureName, featuresService, messageService, responseChannel, context, services );

      default:
        const cmdSwitch = config.COMMAND_SWITCH || '!';
        const response =
          '📋 **Feature Management Usage:**\n\n' +
          `\`${ cmdSwitch }feature list\` - Show all features and their status\n` +
          `\`${ cmdSwitch }feature enable <featureName>\` - Enable a feature\n` +
          `\`${ cmdSwitch }feature disable <featureName>\` - Disable a feature\n` +
          `\`${ cmdSwitch }feature status <featureName>\` - Check feature status\n\n` +
          '**Examples:**\n' +
          `\`${ cmdSwitch }feature list\`\n` +
          `\`${ cmdSwitch }feature enable welcomeMessage\`\n` +
          `\`${ cmdSwitch }feature disable nowPlayingMessage\`\n` +
          `\`${ cmdSwitch }feature status welcomeMessage\``;

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
          error: 'Invalid subcommand'
        };
    }
  } catch ( error ) {
    const response = `❌ Error managing features: ${ error.message }`;
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
 * Handle the list subcommand
 */
async function handleListFeatures ( featuresService, messageService, responseChannel, context, services ) {
  const features = featuresService.getAllFeatures();

  let response = '📋 **Available Features:**\n\n';

  if ( features.enabled.length > 0 ) {
    response += '✅ **Enabled:**\n';
    features.enabled.forEach( feature => {
      response += `• ${ feature }\n`;
    } );
    response += '\n';
  } else {
    response += '✅ **Enabled:**\n(none)\n\n';
  }

  if ( features.disabled.length > 0 ) {
    response += '❌ **Disabled:**\n';
    features.disabled.forEach( feature => {
      response += `• ${ feature }\n`;
    } );
  } else {
    response += '❌ **Disabled:**\n(none)';
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
}

/**
 * Handle the enable subcommand
 */
async function handleEnableFeature ( featureName, featuresService, messageService, responseChannel, context, services ) {
  if ( !featureName ) {
    const cmdSwitch = config.COMMAND_SWITCH || '!';
    const response = `❌ Please specify a feature name. Usage: \`${ cmdSwitch }feature enable <featureName>\``;
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
      error: 'Missing feature name'
    };
  }

  const wasEnabled = featuresService.enableFeature( featureName );

  if ( wasEnabled ) {
    const response = `✅ Feature "${ featureName }" has been enabled.`;
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
  } else {
    const response = `ℹ️ Feature "${ featureName }" is already enabled.`;
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
      error: 'Feature already enabled'
    };
  }
}

/**
 * Handle the disable subcommand
 */
async function handleDisableFeature ( featureName, featuresService, messageService, responseChannel, context, services ) {
  if ( !featureName ) {
    const cmdSwitch = config.COMMAND_SWITCH || '!';
    const response = `❌ Please specify a feature name. Usage: \`${ cmdSwitch }feature disable <featureName>\``;
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
      error: 'Missing feature name'
    };
  }

  const wasDisabled = featuresService.disableFeature( featureName );

  if ( wasDisabled ) {
    const response = `❌ Feature "${ featureName }" has been disabled.`;
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
  } else {
    const response = `ℹ️ Feature "${ featureName }" is already disabled.`;
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
      error: 'Feature already disabled'
    };
  }
}

/**
 * Handle the status subcommand
 */
async function handleFeatureStatus ( featureName, featuresService, messageService, responseChannel, context, services ) {
  if ( !featureName ) {
    const cmdSwitch = config.COMMAND_SWITCH || '!';
    const response = `❌ Please specify a feature name. Usage: \`${ cmdSwitch }feature status <featureName>\``;
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
      error: 'Missing feature name'
    };
  }

  const isEnabled = featuresService.isFeatureEnabled( featureName );
  const status = isEnabled ? 'enabled ✅' : 'disabled ❌';
  const response = `ℹ️ Feature "${ featureName }" is currently ${ status }.`;

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

// Attach metadata to the function
handleFeatureCommand.requiredRole = requiredRole;
handleFeatureCommand.description = description;
handleFeatureCommand.example = example;
handleFeatureCommand.hidden = hidden;

module.exports = handleFeatureCommand;

// Command metadata for help system
module.exports.requiredRole = 'OWNER';
module.exports.description = 'Manage optional bot features';
module.exports.example = 'feature list';
module.exports.hidden = false;