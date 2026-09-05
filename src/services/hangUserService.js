const { logger } = require( '../lib/logging.js' );
const config = require( '../config.js' );

async function _fetchUserProfileByUuid ( services, userUuid ) {
  if ( !userUuid || typeof userUuid !== 'string' ) {
    throw new Error( 'userUuid must be a non-empty string' );
  }
  if ( !services || !services.apiAdapter ) {
    throw new Error( 'API adapter not available - ensure serviceContainer is initialized' );
  }

  const res = await services.apiAdapter.getUserProfile( userUuid );
  if ( res && typeof res === 'object' ) {
    const keys = Object.keys( res );
    const hasNickname = Object.prototype.hasOwnProperty.call( res, 'nickname' ) || !!res?.data?.nickname;
    logger.debug( `hangUserService._fetchUserProfileByUuid: responseKeys=[${ keys.join( ', ' ) }], hasNickname=${ hasNickname }` );
  } else {
    logger.debug( `hangUserService._fetchUserProfileByUuid: empty or non-object response` );
  }
  return res;
}

async function getUserNicknameByUuid ( services, userUuid ) {
  try {
    if ( !services ) {
      throw new Error( 'services parameter is required' );
    }
    const profile = await _fetchUserProfileByUuid( services, userUuid );
    const nickname = profile?.nickname || profile?.data?.nickname;
    if ( !nickname ) {
      logger.debug( `hangUserService.getUserNicknameByUuid: nickname missing for uuid=${ userUuid }, profilePreview=${ JSON.stringify( profile ).slice( 0, 200 ) }...` );
      throw new Error( 'Nickname not found in response' );
    }
    logger.debug( `hangUserService.getUserNicknameByUuid: resolved nickname="${ nickname }" for uuid=${ userUuid }` );
    return nickname;
  } catch ( err ) {
    logger.error( `hangUserService.getUserNicknameByUuid: error for uuid=${ userUuid } -> ${ err.message }` );
    throw new Error( `Unable to resolve nickname for UUID ${ userUuid }: ${ err.message }` );
  }
}

async function updateHangNickname ( services, newNickname ) {
  try {
    if ( !services || !services.apiAdapter ) {
      throw new Error( 'API adapter not available - ensure serviceContainer is initialized' );
    }
    if ( !newNickname || typeof newNickname !== 'string' ) {
      throw new Error( 'newNickname must be a non-empty string' );
    }

    logger.debug( `hangUserService.updateHangNickname: attempting to update nickname to "${ newNickname }"` );

    const response = await services.apiAdapter.updateUserNickname( newNickname );

    logger.debug( `hangUserService.updateHangNickname: successfully updated nickname to "${ newNickname }"` );
    return response;
  } catch ( err ) {
    logger.error( `hangUserService.updateHangNickname: failed to update nickname -> ${ err.message }` );
    throw new Error( `Failed to update nickname: ${ err.message }` );
  }
}

async function getAllPresentUsers ( services ) {
  try {
    if ( !services || !services.apiAdapter ) {
      logger.debug( 'hangUserService.getAllPresentUsers: API adapter not available' );
      return [];
    }

    const userUuids = await services.apiAdapter.getAllPresentUsers( services );
    logger.debug( `hangUserService.getAllPresentUsers: found ${ userUuids.length } users currently in hangout` );
    return userUuids;
  } catch ( err ) {
    logger.error( `hangUserService.getAllPresentUsers: error -> ${ err.message }` );
    return [];
  }
}

/**
 * Fetch CometChat auth token from Gateway API via adapter
 * @param {Object} services - Services container with apiAdapter
 * @returns {Promise<string>} The CometChat auth token
 * @throws {Error} If token fetch fails
 */
async function getCometChatToken ( services ) {
  try {
    if ( !services || !services.apiAdapter ) {
      throw new Error( 'API adapter not available - ensure serviceContainer is initialized' );
    }

    logger.debug( '🔑 Fetching CometChat auth token via API adapter...' );

    const token = await services.apiAdapter.getChatAuthToken();

    logger.info( '✅ Successfully fetched CometChat auth token' );
    return token;

  } catch ( error ) {
    logger.error( `❌ Failed to fetch CometChat token: ${ error.message }` );
    throw new Error( `CometChat token fetch failed: ${ error.message }` );
  }
}

module.exports = {
  getUserNicknameByUuid,
  updateHangNickname,
  getAllPresentUsers,
  getCometChatToken
};

