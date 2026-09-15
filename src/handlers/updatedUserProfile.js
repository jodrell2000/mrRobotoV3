/**
 * Handler for updatedUserProfile statefulMessages
 * Updates the DJ nickname in the database if the nickname is changed in the state patch
 *
 * @param {Object} message - The stateful message containing the patch
 * @param {Object} state - The current hangout state (not used)
 * @param {Object} services - Services container
 */
async function updatedUserProfile(message, state, services) {
  if (!message || !Array.isArray(message.statePatch)) return;
  if (!services.databaseService || !services.databaseService.initialized) return;

  for (const patch of message.statePatch) {
    if (
      patch.op === 'replace' &&
      typeof patch.path === 'string' &&
      patch.path.includes('/userProfile/nickname') &&
      patch.path.startsWith('/allUserData/')
    ) {
      // Extract UUID from path: /allUserData/{uuid}/userProfile/nickname
      const match = patch.path.match(/^\/allUserData\/([^/]+)\/userProfile\/nickname$/);
      if (match) {
        const uuid = match[1];
        const newNickname = patch.value;
        try {
          services.databaseService.insertOrUpdateDjNickname({ uuid, nickname: newNickname });
          services.logger.debug(`updatedUserProfile: Updated DJ nickname in database: ${uuid} → ${newNickname}`);
        } catch (err) {
          services.logger.error(`updatedUserProfile: Failed to update DJ nickname in database: ${err.message}`);
        }
      }
    }
  }
}

/**
 * Normalized handler for userProfileChanged events (works with both Hang and Wavez)
 * Updates the DJ nickname in the database when a user's profile/nickname changes
 * @param {Object} event - Normalized userProfileChanged event with payload.userId and payload.nickname
 * @param {Object} context - Context object with services
 */
async function handleUpdatedUserProfileEvent(event, context) {
  const userId = event.payload?.userId;
  const newNickname = event.payload?.nickname;
  const services = context.services;

  if (!userId || !newNickname || !services) {
    services?.logger?.debug?.('handleUpdatedUserProfileEvent: missing userId, nickname, or services');
    return;
  }

  // Only update if databaseService is available and initialized
  if (!services.databaseService || !services.databaseService.initialized) {
    services.logger?.debug?.('handleUpdatedUserProfileEvent: databaseService not available or initialized');
    return;
  }

  try {
    const result = services.databaseService.insertOrUpdateDjNickname({
      uuid: userId,
      nickname: newNickname
    });
    if (result.action === 'inserted') {
      services.logger?.debug?.(`Inserted new DJ in database: ${userId} (${newNickname})`);
    } else if (result.action === 'updated') {
      services.logger?.debug?.(`Updated DJ nickname in database: ${userId} (${result.oldNickname} → ${result.newNickname})`);
    }
  } catch (err) {
    services.logger?.error?.(`handleUpdatedUserProfileEvent: Failed to update DJ nickname in database: ${err.message}`);
  }
}

module.exports = updatedUserProfile;
module.exports.handleUpdatedUserProfileEvent = handleUpdatedUserProfileEvent;
