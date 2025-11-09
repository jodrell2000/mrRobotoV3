const { logger } = require('../lib/logging.js');
const config = require('../config.js');
const { makeRequest } = require('../lib/buildUrl.js');

async function _fetchUserProfileByUuid(userUuid) {
  if (!userUuid || typeof userUuid !== 'string') {
    throw new Error('userUuid must be a non-empty string');
  }
  const commonHeaders = { Authorization: `Bearer ${config.BOT_USER_TOKEN}` }
  const path = `/api/user-service/profile/${encodeURIComponent(userUuid)}`;
  const url = `${config.TTFM_GATEWAY_BASE_URL}${path}`;
  
  // Debugging info (mask token)
  const maskedToken = typeof config.BOT_USER_TOKEN === 'string' && config.BOT_USER_TOKEN.length > 8
    ? `${config.BOT_USER_TOKEN.slice(0, 4)}...${config.BOT_USER_TOKEN.slice(-4)}`
    : '[unset]';

  const res = await makeRequest(url, { method: 'GET' }, commonHeaders);
  if (res && typeof res === 'object') {
    const keys = Object.keys(res);
    const hasNickname = Object.prototype.hasOwnProperty.call(res, 'nickname') || !!res?.data?.nickname;
    logger.debug(`hangUserService._fetchUserProfileByUuid: responseKeys=[${keys.join(', ')}], hasNickname=${hasNickname}`);
  } else {
    logger.debug(`hangUserService._fetchUserProfileByUuid: empty or non-object response`);
  }
  return res;
}

async function getUserNicknameByUuid(userUuid) {
  try {
    const profile = await _fetchUserProfileByUuid(userUuid);
    const nickname = profile?.nickname || profile?.data?.nickname;
    if (!nickname) {
      logger.debug(`hangUserService.getUserNicknameByUuid: nickname missing for uuid=${userUuid}, profilePreview=${JSON.stringify(profile).slice(0, 200)}...`);
      throw new Error('Nickname not found in response');
    }
    logger.debug(`hangUserService.getUserNicknameByUuid: resolved nickname="${nickname}" for uuid=${userUuid}`);
    return nickname;
  } catch (err) {
    logger.error(`hangUserService.getUserNicknameByUuid: error for uuid=${userUuid} -> ${err.message}`);
    throw new Error(`Unable to resolve nickname for UUID ${userUuid}: ${err.message}`);
  }
}

async function updateHangNickname(newNickname) {
  try {
    if (!newNickname || typeof newNickname !== 'string') {
      throw new Error('newNickname must be a non-empty string');
    }

    const url = `${config.TTFM_GATEWAY_BASE_URL}/api/user-service/users/profile`;
    const payload = {
      nickname: newNickname
    };

    logger.debug(`hangUserService.updateHangNickname: attempting to update nickname to "${newNickname}"`);
    
    const response = await makeRequest(
      url, 
      { 
        method: 'POST',
        data: payload 
      },
      { Authorization: `Bearer ${config.BOT_USER_TOKEN}` }
    );

    logger.debug(`hangUserService.updateHangNickname: successfully updated nickname to "${newNickname}"`);
    return response;
  } catch (err) {
    logger.error(`hangUserService.updateHangNickname: failed to update nickname -> ${err.message}`);
    throw new Error(`Failed to update nickname: ${err.message}`);
  }
}

function getAllPresentUsers(services) {
  try {
    if (!services || !services.hangoutState) {
      logger.debug('hangUserService.getAllPresentUsers: hangoutState service not available');
      return [];
    }

    const currentState = services.hangoutState.getCurrentState();
    if (!currentState || !currentState.allUsers || !Array.isArray(currentState.allUsers)) {
      logger.debug('hangUserService.getAllPresentUsers: allUsers not found or not an array in current state');
      return [];
    }

    const userUuids = currentState.allUsers.map(user => user.uuid).filter(uuid => uuid);
    
    logger.debug(`hangUserService.getAllPresentUsers: found ${userUuids.length} users currently in hangout`);
    return userUuids;
  } catch (err) {
    logger.error(`hangUserService.getAllPresentUsers: error -> ${err.message}`);
    return [];
  }
}

module.exports = {
  getUserNicknameByUuid,
  updateHangNickname,
  getAllPresentUsers
};

