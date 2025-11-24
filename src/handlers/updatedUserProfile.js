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

module.exports = updatedUserProfile;
