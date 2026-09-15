
// Timer reference stored on services to persist between calls
if ( !global.playedSongTimer ) global.playedSongTimer = null;

// Storage for previous song info to persist between playedSong calls
if ( !global.previousPlayedSong ) global.previousPlayedSong = null;

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

  // If we don't have all required info from patches, try to get from full state
  if ( !djUuid || !artistName || !trackName || !songShortId ) {
    const nowPlaying = services.hangoutState?.nowPlaying?.song;
    if ( nowPlaying ) {
      if ( !djUuid && services.hangoutState?.djs && services.hangoutState.djs.length > 0 ) {
        djUuid = services.hangoutState.djs[ 0 ].uuid;
      }
      if ( !artistName ) {
        artistName = nowPlaying.artistName;
      }
      if ( !trackName ) {
        trackName = nowPlaying.trackName;
      }
      if ( !songShortId ) {
        songShortId = nowPlaying.songShortId;
      }
      // Also fill in missing provider IDs if available
      if ( !sevenDigitalId ) {
        sevenDigitalId = nowPlaying.musicProviders?.sevenDigital;
      }
      if ( !spotifyId ) {
        spotifyId = nowPlaying.musicProviders?.spotify;
      }
      if ( !appleId ) {
        appleId = nowPlaying.musicProviders?.apple;
      }
      if ( !youtubeId ) {
        youtubeId = nowPlaying.musicProviders?.youtube;
      }
    }
  }

  // Only return song info if we have all required pieces
  if ( djUuid && artistName && trackName && songShortId ) {
    return { djUuid, artistName, trackName, songShortId, sevenDigitalId, spotifyId, appleId, youtubeId };
  }

  return null;
}

async function playedSong ( message, state, services ) {
  try {
    // services.logger.debug( `[playedSong] Handler called with message patches: ${ message.statePatch?.length || 0 } patches` );

    // Log all the patches for debugging
    // if ( message.statePatch && message.statePatch.length > 0 ) {
    //   services.logger.debug( `[playedSong] State patches: ${ JSON.stringify( message.statePatch.map( p => ( { op: p.op, path: p.path, hasValue: !!p.value } ) ), null, 2 ) }` );
    // }

    // Extract current song information from the patches
    const currentSongInfo = extractSongInfo( message, services );
    // services.logger.debug( `[playedSong] Current song info extracted: ${ !!currentSongInfo }` );
    if ( currentSongInfo ) {
      // services.logger.debug( `[playedSong] Current song data: ${ JSON.stringify( currentSongInfo, null, 2 ) }` );

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
          // services.logger.debug( `[playedSong] Recorded song play in database: songId=${ songId }, djUuid=${ currentSongInfo.djUuid }` );
        } catch ( err ) {
          services.logger.error( `[playedSong] Failed to record song play in database: ${ err.message }` );
        }
      }
    }

    // Check if playId changed - this indicates a new song play even if song details aren't in the patch
    const playIdChanged = hasPlayIdChanged( message );

    // Store the current song info for the next playedSong call
    if ( currentSongInfo ) {
      let initialVoteCounts;

      // If no previous song is stored (bot just started), initialize from hangout state
      // Otherwise, reset vote counts to 0 for new song
      if ( !global.previousPlayedSong ) {
        // Bot startup: use current vote counts from hangout state
        initialVoteCounts = services.hangoutState?.voteCounts || { likes: 0, dislikes: 0, stars: 0 };
        // services.logger.debug( '[playedSong] Bot startup: initializing vote counts from hangout state:', initialVoteCounts );
      } else {
        // Normal operation: reset vote counts for new song
        initialVoteCounts = { likes: 0, dislikes: 0, stars: 0 };
        // services.logger.debug( '[playedSong] New song: resetting vote counts to 0' );

        // Also reset the hangout state vote counts for the new song
        if ( services.hangoutState && services.hangoutState.voteCounts ) {
          services.hangoutState.voteCounts = { likes: 0, dislikes: 0, stars: 0 };
          // services.logger.debug( '[playedSong] Reset hangout state vote counts for new song' );
        }
      }

      global.previousPlayedSong = {
        ...currentSongInfo,
        voteCounts: { ...initialVoteCounts }
      };
      // services.logger.debug( `[playedSong] Stored current song for next comparison: ${ JSON.stringify( global.previousPlayedSong, null, 2 ) }` );
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
        // services.logger.debug( '[playedSong] Using hangout state for song processing (playId changed, same song)' );
      }
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

    // Execute any pending AFK removals — the song change confirms the pending DJ's
    // track has ended so it is now safe to remove them from the decks.
    if ( services.afkService && services.hangSocketServices ) {
      const pendingRemovals = services.afkService.getPendingRemovals();
      for ( const uuid of pendingRemovals ) {
        services.afkService.clearPendingRemoval( uuid );
        try {
          const snapshot = services.afkService.getActivitySnapshot().find( e => e.uuid === uuid );
          const djName = snapshot?.nickname || uuid;
          const result = services.platformActions
            ? await services.platformActions.removeFromDJQueue( uuid )
            : await services.hangSocketServices.removeDj( services, uuid );
          if ( result && !result.success ) throw new Error( result.error );
          await services.messageService.sendGroupMessage(
            `🚫 ${ djName } has been removed from the decks for inactivity.`,
            { services }
          );
        } catch ( err ) {
          services.logger.error( `[playedSong] Failed to remove pending AFK DJ ${ uuid }: ${ err.message }` );
        }
      }
    }

    // Phase 6: Execute escort removals - remove DJ if they have escortme enabled
    if ( services.hangSocketServices && services.dataService && services.messageService ) {
      try {
        const djs = services.stateService?._getDjs?.() || [];
        if ( djs.length > 0 ) {
          const currentDj = djs[ 0 ]; // Position 0 = currently playing
          const escortQueue = services.dataService.getValue( 'escortQueue' ) || {};

          if ( currentDj && escortQueue[ currentDj.uuid ] ) {
            // Current DJ has escortme enabled - remove them
            const djMention = services.frameworkSpecification?.formatters
              ? services.messageService.formatMention( currentDj.uuid, services )
              : services.messageService.formatMention( currentDj.uuid );

            // Clear the escort flag BEFORE removal to prevent double-removal
            delete escortQueue[ currentDj.uuid ];
            services.dataService.setValue( 'escortQueue', escortQueue );

            try {
              // Remove the DJ from the decks
              const result = services.platformActions
                ? await services.platformActions.removeFromDJQueue( currentDj.uuid )
                : await services.hangSocketServices.removeDj( services, currentDj.uuid );
              if ( result && !result.success ) throw new Error( result.error );

              // Notify the room
              await services.messageService.sendGroupMessage(
                `👋 ${ djMention } had enabled escortme and has left the decks.`,
                { services }
              );

              services.logger.info( `[playedSong] Escort removal executed for DJ ${ djMention } (${ currentDj.uuid })` );
            } catch ( err ) {
              services.logger.error( `[playedSong] Failed to execute escort removal for ${ djMention }: ${ err.message }` );
            }
          }
        }
      } catch ( err ) {
        services.logger.error( `[playedSong] Error processing escort removals: ${ err.message }` );
      }
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
          const result = services.platformActions
            ? await services.platformActions.voteOnTrack( 'up' )
            : await services.hangSocketServices.upVote( services );
          if ( result && !result.success ) throw new Error( result.error );
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

/**
 * Normalized handler for trackStarted events - handles DB recording, triggers, AFK/escort removal, auto-upvote
 * Framework-agnostic: reads only from normalized event payloads and stateService
 * @param {Object} event - Normalized trackStarted event with playback info
 * @param {Object} context - Handler context containing services
 */
async function handlePlayedSongEvent ( event, context ) {
  const services = context.services;
  if ( !services ) {
    console.error( '[handlePlayedSongEvent] No services provided in context' );
    return;
  }

  try {
    const playback = event.payload?.playback;
    const song = playback?.song;
    const djId = playback?.djId;

    // Validate we have required song data
    if ( !djId || !song?.artist || !song?.title ) {
      services.logger.debug( '[handlePlayedSongEvent] Insufficient song data in event payload, skipping processing' );
      return;
    }

    // --- DATABASE LOGIC: Record song play ---
    if ( services.databaseService && services.databaseService.initialized ) {
      try {
        const votes = services.stateService?.getVotes?.() || { likes: 0, dislikes: 0, stars: 0 };

        // Upsert song
        services.databaseService.upsertSong( {
          songId: song.id || `${ song.artist }-${ song.title }`,
          artistName: song.artist,
          trackName: song.title,
          sevenDigitalId: song.sevenDigitalId,
          spotifyId: song.spotifyId,
          appleId: song.appleId,
          youtubeId: song.youtubeId
        } );

        // Record song play (use vote counts from global.previousPlayedSong if available)
        let voteCounts = { likes: 0, dislikes: 0, stars: 0 };
        if ( global.previousPlayedSong && global.previousPlayedSong.voteCounts ) {
          voteCounts = global.previousPlayedSong.voteCounts;
        } else {
          voteCounts = votes;
        }

        services.databaseService.recordSongPlay( {
          songId: song.id || `${ song.artist }-${ song.title }`,
          djUuid: djId,
          djNickname: playback.djNickname,
          artistName: song.artist,
          trackName: song.title,
          likes: voteCounts.likes || 0,
          dislikes: voteCounts.dislikes || 0,
          stars: voteCounts.stars || 0
        } );

        services.logger.debug( `[handlePlayedSongEvent] Recorded song play: ${ song.artist } - ${ song.title } by DJ ${ djId }` );
      } catch ( err ) {
        services.logger.error( `[handlePlayedSongEvent] Failed to record song play in database: ${ err.message }` );
      }
    }

    // --- TRIGGER EXECUTION: Execute 'newSong' triggers ---
    if ( services.triggerService ) {
      try {
        const triggerContext = {
          eventData: {
            songInfo: {
              djId,
              djNickname: playback.djNickname,
              artist: song.artist,
              title: song.title
            },
            triggerType: 'newSong'
          }
        };
        await services.triggerService.executeTrigger( 'newSong', triggerContext );
      } catch ( err ) {
        services.logger.error( `[handlePlayedSongEvent] Failed to execute newSong trigger: ${ err.message }` );
      }
    }

    // --- AFK REMOVAL: Process pending AFK DJ removals when song changes ---
    if ( services.afkService && services.platformActions ) {
      try {
        const pendingRemovals = services.afkService.getPendingRemovals();
        for ( const uuid of pendingRemovals ) {
          services.afkService.clearPendingRemoval( uuid );
          try {
            const snapshot = services.afkService.getActivitySnapshot().find( e => e.uuid === uuid );
            const djName = snapshot?.nickname || uuid;

            // Try platformActions first (adapter-aware), fallback to hangSocketServices
            const result = services.platformActions
              ? await services.platformActions.removeFromDJQueue( uuid )
              : services.hangSocketServices && await services.hangSocketServices.removeDj( services, uuid );

            if ( result && !result.success ) throw new Error( result.error || 'Removal failed' );

            await services.messageService.sendResponse(
              `🚫 ${ djName } has been removed from the decks for inactivity.`,
              { responseChannel: 'public', services }
            );
          } catch ( err ) {
            services.logger.error( `[handlePlayedSongEvent] Failed to remove pending AFK DJ ${ uuid }: ${ err.message }` );
          }
        }
      } catch ( err ) {
        services.logger.error( `[handlePlayedSongEvent] Error processing AFK removals: ${ err.message }` );
      }
    }

    // --- ESCORT REMOVAL: Remove DJ if they have escortme enabled ---
    if ( services.dataService && services.messageService && services.platformActions ) {
      try {
        const djs = services.stateService?._getDjs?.() || [];
        if ( djs.length > 0 ) {
          const currentDj = djs[ 0 ]; // Position 0 = currently playing
          const escortQueue = services.dataService.getValue( 'escortQueue' ) || {};

          if ( currentDj && escortQueue[ currentDj.uuid ] ) {
            // Current DJ has escortme enabled - remove them
            const djMention = services.messageService.formatMention( currentDj.uuid, services );

            // Clear the escort flag BEFORE removal to prevent double-removal
            delete escortQueue[ currentDj.uuid ];
            services.dataService.setValue( 'escortQueue', escortQueue );

            try {
              // Try platformActions first (adapter-aware), fallback to hangSocketServices
              const result = services.platformActions
                ? await services.platformActions.removeFromDJQueue( currentDj.uuid )
                : services.hangSocketServices && await services.hangSocketServices.removeDj( services, currentDj.uuid );

              if ( result && !result.success ) throw new Error( result.error || 'Removal failed' );

              // Notify the room
              await services.messageService.sendResponse(
                `👋 ${ djMention } had enabled escortme and has left the decks.`,
                { responseChannel: 'public', services }
              );

              services.logger.info( `[handlePlayedSongEvent] Escort removal executed for DJ ${ djMention } (${ currentDj.uuid })` );
            } catch ( err ) {
              services.logger.error( `[handlePlayedSongEvent] Failed to execute escort removal for ${ djMention }: ${ err.message }` );
            }
          }
        }
      } catch ( err ) {
        services.logger.error( `[handlePlayedSongEvent] Error processing escort removals: ${ err.message }` );
      }
    }

    // --- AUTO-UPVOTE TIMER: Start 90-second auto-upvote timer ---
    try {
      // Cancel any existing timer
      if ( global.playedSongTimer ) {
        clearTimeout( global.playedSongTimer );
        global.playedSongTimer = null;
      }

      // Start a new timer for 90 seconds
      global.playedSongTimer = setTimeout( async () => {
        try {
          const result = services.platformActions
            ? await services.platformActions.voteOnTrack( 'up' )
            : services.hangSocketServices && await services.hangSocketServices.upVote( services );

          if ( result && !result.success ) throw new Error( result.error || 'Upvote failed' );
          services.logger.debug( '[handlePlayedSongEvent] Auto-upvote executed after 90 seconds' );
        } catch ( err ) {
          services.logger.error( `[handlePlayedSongEvent] Error in auto-upvote timer: ${ err.message }` );
        }
        global.playedSongTimer = null;
      }, 90000 );

      services.logger.debug( '[handlePlayedSongEvent] Started 90-second auto-upvote timer' );
    } catch ( err ) {
      services.logger.error( `[handlePlayedSongEvent] Error setting up auto-upvote timer: ${ err.message }` );
    }

    // --- Update global previousPlayedSong for next song tracking ---
    const votes = services.stateService?.getVotes?.() || { likes: 0, dislikes: 0, stars: 0 };
    global.previousPlayedSong = {
      djId,
      djNickname: playback.djNickname,
      song,
      voteCounts: votes
    };

  } catch ( error ) {
    services.logger.error( `[handlePlayedSongEvent] Unhandled error: ${ error.message }` );
    services.logger.error( `[handlePlayedSongEvent] Error stack: ${ error.stack }` );
  }
}

module.exports = playedSong;
module.exports.handlePlayedSongEvent = handlePlayedSongEvent;
