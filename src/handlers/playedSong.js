
// Timer reference stored on services to persist between calls
if ( !global.playedSongTimer ) global.playedSongTimer = null;

// Storage for previous song info to persist between playedSong calls
if ( !global.previousPlayedSong ) global.previousPlayedSong = null;

/**
 * Announces the just-finished song with vote counts to the public chat
 * @param {Object} previousSongInfo - Previous song information object
 * @param {Object} services - Services container
 */
async function announceJustPlayed ( previousSongInfo, services ) {
  try {
    services.logger.debug( '[playedSong] Starting announceJustPlayed with data:', previousSongInfo );

    let messageTemplate = services.dataService.getValue( 'editableMessages.justPlayedMessage' );
    if ( !messageTemplate ) {
      // Fallback to old structure for backward compatibility
      messageTemplate = services.dataService.getValue( 'justPlayedMessage' ) ||
        `{username} played...
      {trackName} by {artistName}
      Stats: 👍 {likes} 👎 {dislikes} ❤️ {stars}`;
    }

    services.logger.debug( '[playedSong] Using justPlayedMessage template:', messageTemplate );

    // Replace placeholders with actual values
    const djMention = services.messageService.formatMention( previousSongInfo.djUuid );
    services.logger.debug( '[playedSong] DJ mention formatted as:', djMention );

    const announcement = messageTemplate
      .replace( '{username}', djMention )
      .replace( '{trackName}', previousSongInfo.trackName )
      .replace( '{artistName}', previousSongInfo.artistName )
      .replace( '{likes}', previousSongInfo.voteCounts.likes || 0 )
      .replace( '{dislikes}', previousSongInfo.voteCounts.dislikes || 0 )
      .replace( '{stars}', previousSongInfo.voteCounts.stars || 0 );

    services.logger.info( '[playedSong] Sending justPlayed announcement:', announcement );
    await services.messageService.sendGroupMessage( announcement, { services } );
    services.logger.debug( '[playedSong] Successfully sent justPlayed announcement' );
  } catch ( error ) {
    services.logger.error( `[playedSong] Failed to announce just played song: ${ error.message }` );
    services.logger.error( `[playedSong] Error stack: ${ error.stack }` );
  }
}

/**
 * Extracts the new nowPlaying value from the state patch
 * @param {Object} message - The stateful message containing patch data
 * @returns {Object|null} The new nowPlaying value or undefined if not found in patch
 */
function extractNowPlayingFromPatch ( message ) {
  const statePatch = message.statePatch || [];

  for ( const patch of statePatch ) {
    if ( patch.op === 'replace' && patch.path === '/nowPlaying' ) {
      return patch.value;
    }
  }

  return undefined; // Not found in patch
}

/**
 * Checks if the playId has changed, indicating a new song play
 * @param {Object} message - The stateful message containing patch data
 * @returns {boolean} True if playId has changed
 */
function hasPlayIdChanged ( message ) {
  const statePatch = message.statePatch || [];

  for ( const patch of statePatch ) {
    if ( patch.op === 'replace' && patch.path === '/nowPlaying/playId' ) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts song information from the state patch and full state
 * @param {Object} message - The stateful message containing patch data
 * @param {Object} services - Services container for accessing hangout state
 * @returns {Object|null} Song info object or null if not found
 */
function extractSongInfo ( message, services ) {
  const statePatch = message.statePatch || [];
  let djUuid = null;
  let artistName = null;
  let trackName = null;
  let songShortId = null;
  let sevenDigitalId = null;
  let spotifyId = null;
  let appleId = null;
  let youtubeId = null;

  // Look through the patches to find the song and DJ information
  for ( const patch of statePatch ) {
    if ( patch.op === 'replace' ) {
      if ( patch.path === '/djs/0/uuid' ) {
        djUuid = patch.value;
      } else if ( patch.path === '/nowPlaying/song/artistName' ) {
        artistName = patch.value;
      } else if ( patch.path === '/nowPlaying/song/trackName' ) {
        trackName = patch.value;
      } else if ( patch.path === '/nowPlaying/song/songShortId' ) {
        songShortId = patch.value;
      } else if ( patch.path === '/nowPlaying/song/musicProviders/sevenDigital' ) {
        sevenDigitalId = patch.value;
      } else if ( patch.path === '/nowPlaying/song/musicProviders/spotify' ) {
        spotifyId = patch.value;
      } else if ( patch.path === '/nowPlaying/song/musicProviders/apple' ) {
        appleId = patch.value;
      } else if ( patch.path === '/nowPlaying/song/musicProviders/youtube' ) {
        youtubeId = patch.value;
      } else if ( patch.path === '/nowPlaying' && patch.value?.song ) {
        // Handle case where entire nowPlaying object is replaced
        artistName = patch.value.song.artistName;
        trackName = patch.value.song.trackName;
        songShortId = patch.value.song.songShortId;
        sevenDigitalId = patch.value.song.musicProviders?.sevenDigital;
        spotifyId = patch.value.song.musicProviders?.spotify;
        appleId = patch.value.song.musicProviders?.apple;
        youtubeId = patch.value.song.musicProviders?.youtube;
      }
    }
  }

  // If we have song info but no DJ UUID from patch, try to get it from full state
  if ( !djUuid && ( artistName || trackName ) ) {
    if ( services.hangoutState?.djs && services.hangoutState.djs.length > 0 ) {
      djUuid = services.hangoutState.djs[ 0 ].uuid;
    }
  }

  // Only return song info if we have all required pieces
  if ( djUuid && artistName && trackName && songShortId ) {
    return { djUuid, artistName, trackName, songShortId, sevenDigitalId, spotifyId, appleId, youtubeId };
  }

  return null;
}

/**
 * Announces the new song to the public chat
 * @param {Object} songInfo - Song information object
 * @param {Object} services - Services container
 */
async function announceSong ( songInfo, services ) {
  try {
    let messageTemplate = services.dataService.getValue( 'editableMessages.nowPlayingMessage' );
    if ( !messageTemplate ) {
      // Fallback to old structure for backward compatibility
      messageTemplate = services.dataService.getValue( 'nowPlayingMessage' ) || "{username} is now playing {trackName} by {artistName}";
    }

    // Replace placeholders with actual values
    const djMention = services.messageService.formatMention( songInfo.djUuid );

    const announcement = messageTemplate
      .replace( '{username}', djMention )
      .replace( '{trackName}', songInfo.trackName )
      .replace( '{artistName}', songInfo.artistName );

    await services.messageService.sendGroupMessage( announcement, { services } );
  } catch ( error ) {
    services.logger.error( `Failed to announce song: ${ error.message }` );
  }
}



async function playedSong ( message, state, services ) {
  try {
    services.logger.debug( `[playedSong] Handler called with message patches: ${ message.statePatch?.length || 0 } patches` );

    // Log all the patches for debugging
    // if ( message.statePatch && message.statePatch.length > 0 ) {
    //   services.logger.debug( `[playedSong] State patches: ${ JSON.stringify( message.statePatch.map( p => ( { op: p.op, path: p.path, hasValue: !!p.value } ) ), null, 2 ) }` );
    // }

    // Extract current song information from the patches
    const currentSongInfo = extractSongInfo( message, services );
    services.logger.debug( `[playedSong] Current song info extracted: ${ !!currentSongInfo }` );
    if ( currentSongInfo ) {
      services.logger.debug( `[playedSong] Current song data: ${ JSON.stringify( currentSongInfo, null, 2 ) }` );

      // --- DATABASE LOGIC: Upsert DJ, upsert song, record play ---
      if ( services.databaseService && services.databaseService.initialized ) {
        try {
          // Extract provider IDs if available from hangoutState
          let appleId, spotifyId, youtubeId;
          let songId;
          if ( services.hangoutState?.nowPlaying?.song ) {
            const song = services.hangoutState.nowPlaying.song;
            appleId = currentSongInfo.appleId || song.appleId;
            spotifyId = currentSongInfo.spotifyId || song.spotifyId;
            youtubeId = currentSongInfo.youtubeId || song.youtubeId;
            songId = currentSongInfo.songShortId;
          } else {
            appleId = currentSongInfo.appleId;
            spotifyId = currentSongInfo.spotifyId;
            youtubeId = currentSongInfo.youtubeId;
            songId = currentSongInfo.songShortId;
          }

          // Upsert song
          services.databaseService.upsertSong( {
            songId,
            sevenDigitalId: currentSongInfo.sevenDigitalId,
            artistName: currentSongInfo.artistName,
            trackName: currentSongInfo.trackName,
            appleId,
            spotifyId,
            youtubeId
          } );

          // Record song play (use vote counts from global.previousPlayedSong if available)
          let voteCounts = { likes: 0, dislikes: 0, stars: 0 };
          if ( global.previousPlayedSong && global.previousPlayedSong.voteCounts ) {
            voteCounts = global.previousPlayedSong.voteCounts;
          } else if ( services.hangoutState?.voteCounts ) {
            voteCounts = services.hangoutState.voteCounts;
          }
          services.databaseService.recordSongPlay( {
            songId,
            djUuid: currentSongInfo.djUuid,
            likes: voteCounts.likes || 0,
            dislikes: voteCounts.dislikes || 0,
            stars: voteCounts.stars || 0
          } );
          services.logger.debug( `[playedSong] Recorded song play in database: songId=${ songId }, djUuid=${ currentSongInfo.djUuid }` );
        } catch ( err ) {
          services.logger.error( `[playedSong] Failed to record song play in database: ${ err.message }` );
        }
      }
    }

    // Get the stored previous song info from the last playedSong call
    const previousSongInfo = global.previousPlayedSong;
    services.logger.debug( `[playedSong] Previous stored song info: ${ !!previousSongInfo }` );
    if ( previousSongInfo ) {
      services.logger.debug( `[playedSong] Previous stored song data: ${ JSON.stringify( previousSongInfo, null, 2 ) }` );
    }

    // Check if justPlayed feature is enabled
    const justPlayedEnabled = services.featuresService.isFeatureEnabled( 'justPlayed' );
    services.logger.debug( `[playedSong] justPlayed feature enabled: ${ justPlayedEnabled }` );

    // Check if nowPlaying became null (song ended)
    const nowPlayingBecameNull = message.statePatch?.some( patch =>
      patch.op === 'replace' && patch.path === '/nowPlaying' && patch.value === null
    );

    // Check if playId changed - this indicates a new song play even if song details aren't in the patch
    const playIdChanged = hasPlayIdChanged( message );

    // Announce the just-finished song if we have a previous song and either:
    // 1. Current song is different from previous, OR
    // 2. Song ended (nowPlaying became null), OR
    // 3. PlayId changed (indicating same song played again)
    if ( previousSongInfo && justPlayedEnabled && ( currentSongInfo || nowPlayingBecameNull || playIdChanged ) ) {
      let shouldAnnounce = false;

      if ( nowPlayingBecameNull ) {
        services.logger.debug( '[playedSong] Song ended (nowPlaying became null) - will announce justPlayed' );
        shouldAnnounce = true;
      } else if ( currentSongInfo ) {
        services.logger.debug( '[playedSong] Checking if current song is different from previous...' );

        const songChanged = (
          currentSongInfo.trackName !== previousSongInfo.trackName ||
          currentSongInfo.artistName !== previousSongInfo.artistName ||
          currentSongInfo.djUuid !== previousSongInfo.djUuid
        );

        // Check if playId changed - this indicates a new song play even if song details are the same
        const songPlayIdChanged = hasPlayIdChanged( message );

        services.logger.debug( `[playedSong] Song changed: ${ songChanged }, PlayId changed: ${ songPlayIdChanged }` );

        if ( songChanged ) {
          const comparison = {
            newTrack: currentSongInfo.trackName,
            oldTrack: previousSongInfo.trackName,
            tracksDifferent: currentSongInfo.trackName !== previousSongInfo.trackName,
            newArtist: currentSongInfo.artistName,
            oldArtist: previousSongInfo.artistName,
            artistsDifferent: currentSongInfo.artistName !== previousSongInfo.artistName,
            newDJ: currentSongInfo.djUuid,
            oldDJ: previousSongInfo.djUuid,
            djsDifferent: currentSongInfo.djUuid !== previousSongInfo.djUuid
          };
          services.logger.debug( `[playedSong] Song comparison: ${ JSON.stringify( comparison, null, 2 ) }` );
          shouldAnnounce = true;
        } else if ( songPlayIdChanged ) {
          services.logger.debug( '[playedSong] PlayId changed - will announce justPlayed (same song played again)' );
          shouldAnnounce = true;
        } else {
          services.logger.debug( '[playedSong] Not announcing justPlayed - same song as previous and no playId change' );
        }
      } else {
        services.logger.debug( '[playedSong] PlayId changed but no current song info - will announce justPlayed using previous song data' );
        shouldAnnounce = true;
      }

      if ( shouldAnnounce ) {
        services.logger.info( `[playedSong] Announcing justPlayed for: ${ previousSongInfo.trackName } by ${ previousSongInfo.artistName }` );

        // Use the stored vote counts (which get updated by votedOnSong and playedOneTimeAnimation handlers)
        // If no vote counts are stored, fall back to current hangout state
        const voteCounts = previousSongInfo.voteCounts || services.hangoutState?.voteCounts || { likes: 0, dislikes: 0, stars: 0 };
        const previousSongWithVotes = { ...previousSongInfo, voteCounts };

        await announceJustPlayed( previousSongWithVotes, services );
      }
    } else {
      if ( !previousSongInfo ) {
        services.logger.debug( '[playedSong] No justPlayed announcement - no previous song stored' );
      }
      if ( !justPlayedEnabled ) {
        services.logger.debug( '[playedSong] No justPlayed announcement - feature disabled' );
      }
      if ( !currentSongInfo && !nowPlayingBecameNull ) {
        services.logger.debug( '[playedSong] No justPlayed announcement - no current song info extracted and nowPlaying did not become null' );
      }
    }

    // Store the current song info for the next playedSong call
    if ( currentSongInfo ) {
      let initialVoteCounts;

      // If no previous song is stored (bot just started), initialize from hangout state
      // Otherwise, reset vote counts to 0 for new song
      if ( !global.previousPlayedSong ) {
        // Bot startup: use current vote counts from hangout state
        initialVoteCounts = services.hangoutState?.voteCounts || { likes: 0, dislikes: 0, stars: 0 };
        services.logger.debug( '[playedSong] Bot startup: initializing vote counts from hangout state:', initialVoteCounts );
      } else {
        // Normal operation: reset vote counts for new song
        initialVoteCounts = { likes: 0, dislikes: 0, stars: 0 };
        services.logger.debug( '[playedSong] New song: resetting vote counts to 0' );

        // Also reset the hangout state vote counts for the new song
        if ( services.hangoutState && services.hangoutState.voteCounts ) {
          services.hangoutState.voteCounts = { likes: 0, dislikes: 0, stars: 0 };
          services.logger.debug( '[playedSong] Reset hangout state vote counts for new song' );
        }
      }

      global.previousPlayedSong = {
        ...currentSongInfo,
        voteCounts: { ...initialVoteCounts }
      };
      services.logger.debug( `[playedSong] Stored current song for next comparison: ${ JSON.stringify( global.previousPlayedSong, null, 2 ) }` );
    }

    // Determine song info for both announcements and triggers
    let songForProcessing = currentSongInfo;

    // If no song info was extracted from patch but playId changed,
    // get song info from current hangout state (same song being replayed)
    if ( !songForProcessing && playIdChanged && services.hangoutState?.nowPlaying?.song ) {
      const hangoutSong = services.hangoutState.nowPlaying.song;
      const currentDj = services.hangoutState?.djs?.[ 0 ]?.uuid;

      if ( hangoutSong.artistName && hangoutSong.trackName && currentDj ) {
        songForProcessing = {
          djUuid: currentDj,
          artistName: hangoutSong.artistName,
          trackName: hangoutSong.trackName
        };
        services.logger.debug( '[playedSong] Using hangout state for song processing (playId changed, same song)' );
      }
    }

    // Announce the new song if the feature is enabled (after justPlayed announcement)
    if ( services.featuresService.isFeatureEnabled( 'nowPlayingMessage' ) && songForProcessing ) {
      await announceSong( songForProcessing, services );
    }

    // Process 'newSong' triggers after all announcements (independent of nowPlayingMessage feature)
    if ( services.triggerService && songForProcessing ) {
      const triggerContext = {
        eventData: {
          songInfo: songForProcessing,
          triggerType: 'newSong'
        }
      };
      await services.triggerService.executeTrigger( 'newSong', triggerContext );
    }

    const nowPlaying = services.hangoutState?.nowPlaying;

    // Cancel any existing timer
    if ( global.playedSongTimer ) {
      clearTimeout( global.playedSongTimer );
      global.playedSongTimer = null;
    }

    if ( nowPlaying ) {
      // Start a new timer for 90 seconds
      global.playedSongTimer = setTimeout( async () => {
        try {
          await services.hangSocketServices.upVote( services.socket );
        } catch ( err ) {
          services.logger.error( 'Error in playedSong timer upVote:', err );
        }
        global.playedSongTimer = null;
      }, 90000 );
    }
  } catch ( error ) {
    services.logger.error( `Error in playedSong handler: ${ error.message }` );
    services.logger.error( `Error stack: ${ error.stack }` );
  }
}

module.exports = playedSong;
