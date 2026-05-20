const http = require( 'node:http' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const services = require( './services/serviceContainer.js' );
const { Bot } = require( './lib/bot.js' );
const { runAfkMonitorTick, TICK_INTERVAL_MS } = require( './tasks/afkMonitorTask.js' );
const dailyCloudSyncTask = require( './tasks/dailyCloudSyncTask.js' );

// Bind a minimal HTTP server with secure routing
// The bot is a WebSocket client — there is no real HTTP API here.
const healthServer = http.createServer( async ( req, res ) => {
  const url = new URL( req.url, `http://${ req.headers.host }` );

  // Extract client IP (handle proxies)
  const clientIp = req.headers[ 'x-forwarded-for' ]?.split( ',' )[ 0 ]?.trim() ||
    req.headers[ 'x-real-ip' ] ||
    req.socket.remoteAddress;

  // Check rate limit
  const rateLimitResult = services.rateLimiterService.checkLimit( clientIp, url.pathname );

  if ( !rateLimitResult.allowed ) {
    res.writeHead( 429, {
      'Content-Type': 'text/plain',
      'Retry-After': Math.ceil( ( rateLimitResult.resetTime - Date.now() ) / 1000 ),
      'X-RateLimit-Limit': rateLimitResult.limit,
      'X-RateLimit-Remaining': rateLimitResult.remaining,
      'X-RateLimit-Reset': rateLimitResult.resetTime
    } );
    res.end( 'Too Many Requests' );
    return;
  }

  // Add rate limit headers to all responses
  const rateLimitHeaders = {
    'X-RateLimit-Limit': rateLimitResult.limit,
    'X-RateLimit-Remaining': rateLimitResult.remaining,
    'X-RateLimit-Reset': rateLimitResult.resetTime
  };

  // Route handling
  if ( url.pathname === '/health' ) {
    res.writeHead( 200, { 'Content-Type': 'text/plain', ...rateLimitHeaders } );
    res.end( 'ok' );
  } else if ( url.pathname === '/' ) {
    try {
      const html = await services.documentationService.generateLandingPage();
      res.writeHead( 200, { 'Content-Type': 'text/html; charset=utf-8', ...rateLimitHeaders } );
      res.end( html );
    } catch ( error ) {
      services.logger.error( `Error generating landing page: ${ error.message }` );
      res.writeHead( 500, { 'Content-Type': 'text/plain', ...rateLimitHeaders } );
      res.end( 'Internal Server Error' );
    }
  } else if ( url.pathname === '/chatcommands' ) {
    try {
      const htmlPath = path.join( __dirname, '../html/chat.html' );
      if ( fs.existsSync( htmlPath ) ) {
        const html = fs.readFileSync( htmlPath, 'utf8' );
        res.writeHead( 200, { 'Content-Type': 'text/html; charset=utf-8', ...rateLimitHeaders } );
        res.end( html );
      } else {
        res.writeHead( 404, { 'Content-Type': 'text/plain', ...rateLimitHeaders } );
        res.end( 'Chat commands documentation not yet generated' );
      }
    } catch ( error ) {
      services.logger.error( `Error serving chat commands: ${ error.message }` );
      res.writeHead( 500, { 'Content-Type': 'text/plain', ...rateLimitHeaders } );
      res.end( 'Internal Server Error' );
    }
  } else if ( url.pathname === '/commands' ) {
    try {
      const htmlPath = path.join( __dirname, '../html/commands.html' );
      if ( fs.existsSync( htmlPath ) ) {
        const html = fs.readFileSync( htmlPath, 'utf8' );
        res.writeHead( 200, { 'Content-Type': 'text/html; charset=utf-8', ...rateLimitHeaders } );
        res.end( html );
      } else {
        res.writeHead( 404, { 'Content-Type': 'text/plain', ...rateLimitHeaders } );
        res.end( 'Commands documentation not yet generated' );
      }
    } catch ( error ) {
      services.logger.error( `Error serving commands: ${ error.message }` );
      res.writeHead( 500, { 'Content-Type': 'text/plain', ...rateLimitHeaders } );
      res.end( 'Internal Server Error' );
    }
  } else {
    // Return 404 for all other paths (including file access attempts)
    res.writeHead( 404, { 'Content-Type': 'text/plain', ...rateLimitHeaders } );
    res.end( 'Not Found' );
  }
} );
healthServer.listen( process.env.PORT || 8080 );

process.on( 'unhandledRejection', ( reason, promise ) => {
  services.logger.error( `Unhandled Rejection at: ${ promise }, reason: ${ reason }` );
} );

// Log application starting
services.logger.info( '======================================= Application Starting =======================================' );

( async () => {

  services.logger.debug( '🚀 Starting application async function' );

  try {
    // Wait for database initialization to complete
    services.logger.debug( '⏳ Waiting for database service initialization...' );
    let maxWaitTime = 30000; // 30 seconds max wait
    let elapsedTime = 0;
    const dbCheckInterval = 100; // Check every 100ms
    while ( !services.databaseService || !services.databaseService.initialized ) {
      if ( elapsedTime >= maxWaitTime ) {
        services.logger.warn( '⚠️ Database service initialization timeout - proceeding without full DB initialization' );
        break;
      }
      await new Promise( resolve => setTimeout( resolve, dbCheckInterval ) );
      elapsedTime += dbCheckInterval;
    }
    if ( services.databaseService && services.databaseService.initialized ) {
      services.logger.info( '✅ Database service initialized successfully' );
    }

    // Fetch bot's nickname using BOT_UID and hangUserService
    services.logger.debug( '🔍 About to fetch bot nickname' );
    try {
      const botNickname = await services.hangUserService.getUserNicknameByUuid( services.config.BOT_UID );
      services.setState( 'botNickname', botNickname );
      services.logger.info( `🤖 Bot nickname resolved and stored: ${ botNickname }` );
    } catch ( err ) {
      services.logger.warn( `⚠️ Could not resolve bot nickname: ${ err.message }` );
    }

    services.logger.debug( '🤖 About to create Bot instance' );
    const roomBot = new Bot( services.config.HANGOUT_ID, services );
    services.logger.debug( '🤖 Bot instance created' );

    // Register bot instance in services so handlers can access it
    services.bot = roomBot;
    services.logger.debug( '🤖 Bot instance registered in services container' );

    services.logger.debug( '🔗 About to connect bot' );
    try {
      await roomBot.connect();
      services.logger.debug( '✅ Bot connect() completed successfully' );
    } catch ( connectError ) {
      services.logger.error( `❌ Error during bot.connect(): ${ connectError }` );
      throw connectError;
    }

    // Sync bot name from data.json to TT.fm platform on startup
    try {
      const savedBotName = services.dataService.getValue( 'botData.CHAT_NAME' );
      if ( savedBotName ) {
        services.logger.debug( `🔄 Syncing bot name to TT.fm platform: ${ savedBotName }` );
        await services.hangUserService.updateHangNickname( savedBotName );
        services.logger.info( `✅ Bot name synced to TT.fm: ${ savedBotName }` );

        // Leave and rejoin CometChat to refresh display name
        try {
          services.logger.debug( '🔄 Leaving CometChat to refresh display name...' );
          await services.messageService.leaveChat( services.config.HANGOUT_ID );
          services.logger.debug( '✅ Left CometChat group' );
        } catch ( leaveError ) {
          services.logger.warn( `⚠️ Failed to leave CometChat (will still try to rejoin): ${ leaveError.message }` );
        }
      }
    } catch ( syncError ) {
      services.logger.warn( `⚠️ Failed to sync bot name on startup: ${ syncError.message }` );
      // Don't throw - this is not critical for bot operation
    }

    // Join the chat group before processing messages
    try {
      services.logger.debug( '🔄 Joining chat group...' );
      await services.messageService.joinChat( services.config.HANGOUT_ID );
      services.logger.debug( '✅ Successfully joined chat group' );
    } catch ( joinError ) {
      services.logger.error( `❌ Error joining chat group: ${ joinError }` );
      // Don't throw here - continue with limited functionality
      services.logger.warn( '⚠️ Continuing without group membership - some features may not work' );
    }

    const checkInterval = 1000 * 1; // 1 second

    // Start message processing with setInterval
    services.logger.debug( `Starting message processing with ${ checkInterval }ms interval` );
    setInterval( async () => {
      try {
        await roomBot.processNewPublicMessages();
      } catch ( error ) {
        services.logger.error( `Error in processNewPublicMessages: ${ error?.message || error?.toString() || 'Unknown error' }` );
      }

      try {
        await roomBot.processNewPrivateMessages();
      } catch ( error ) {
        services.logger.error( `Error in processNewPrivateMessages: ${ error?.message || error?.toString() || 'Unknown error' }` );
      }
    }, checkInterval );

    services.logger.debug( `Started message processing with ${ checkInterval }ms interval` );

    // Start image validation background task (1 image per second when validation is active)
    setInterval( async () => {
      try {
        await services.validationService.processNextImage();
      } catch ( error ) {
        services.logger.error( `Error in image validation: ${ error?.message || error?.toString() || 'Unknown error' }` );
      }
    }, 1000 ); // Check one image per second

    services.logger.debug( '✅ Image validation background task started' );

    // Start AFK monitor background task
    setInterval( async () => {
      try {
        await runAfkMonitorTick( services );
      } catch ( error ) {
        services.logger.error( `Error in AFK monitor tick: ${ error?.message || error?.toString() || 'Unknown error' }` );
      }
    }, TICK_INTERVAL_MS );

    services.logger.debug( '✅ AFK monitor background task started' );

    // Start daily cloud sync task
    const cloudSyncTask = dailyCloudSyncTask.initialize( services );
    if ( cloudSyncTask.enabled ) {
      services.logger.info( '✅ Daily cloud sync task initialized' );
    }

    // Initialize validation cache on startup
    services.validationService.loadCache();

    // Rebuild chat documentation on startup
    services.logger.debug( '📄 Rebuilding chat documentation...' );
    try {
      const result = await services.documentationService.rebuildChatDocumentation();
      if ( result.success ) {
        services.logger.info( `✅ Chat documentation rebuilt: ${ result.message }` );
      } else {
        services.logger.warn( `⚠️ Chat documentation rebuild failed: ${ result.message }` );
      }
    } catch ( docError ) {
      services.logger.error( `❌ Error rebuilding chat documentation: ${ docError.message }` );
      // Don't throw - this is not critical for bot operation
    }

    // Rebuild commands documentation on startup
    services.logger.debug( '📚 Rebuilding commands documentation...' );
    try {
      const result = await services.documentationService.rebuildCommandsDocumentation();
      if ( result.success ) {
        services.logger.info( `✅ Commands documentation rebuilt: ${ result.message }` );
      } else {
        services.logger.warn( `⚠️ Commands documentation rebuild failed: ${ result.message }` );
      }
    } catch ( docError ) {
      services.logger.error( `❌ Error rebuilding commands documentation: ${ docError.message }` );
      // Don't throw - this is not critical for bot operation
    }

    // Small delay to allow state to settle after room join and initial patches
    services.logger.debug( '⏳ Waiting 2 seconds for state to settle...' );
    await new Promise( resolve => setTimeout( resolve, 2000 ) );

    // Validate that we have initial state data before declaring success
    services.logger.debug( '🔍 Starting state validation...' );
    try {
      const allUserData = services.hangoutState?.allUserData || {};
      const userCount = Object.keys( allUserData ).length;
      services.logger.debug( `🔍 State validation: userCount = ${ userCount }` );

      if ( userCount === 0 ) {
        services.logger.error( '❌ CRITICAL ERROR: allUserData is empty - no initial state loaded' );
        services.logger.error( '❌ This indicates the stateful message processing failed to apply initial state patches' );
        services.logger.error( '❌ The bot cannot operate without proper state initialization' );
        services.logger.error( '❌ Check logs for JSON Patch application errors and ensure stateful messages are being processed correctly' );
        services.logger.error( '❌ EXITING APPLICATION DUE TO EMPTY STATE' );
        process.exit( 1 );
      }

      services.logger.info( `✅ State validation passed: ${ userCount } users loaded in allUserData` );
    } catch ( stateError ) {
      services.logger.error( `❌ CRITICAL ERROR: Failed to validate initial state: ${ stateError.message }` );
      services.logger.error( '❌ Cannot proceed without valid state - exiting application' );
      services.logger.error( '❌ EXITING APPLICATION DUE TO STATE ERROR' );
      process.exit( 1 );
    }
    services.logger.debug( '✅ State validation completed successfully' );

    services.logger.info( '======================================= Application Started Successfully =======================================' );

    // Send startup message to group
    services.logger.debug( '📤 Preparing to send startup message...' );
    try {
      const botMention = services.messageService.formatMention( services.config.BOT_UID );
      services.logger.debug( `📤 Sending startup message with bot mention: ${ botMention }` );

      await services.messageService.sendGroupMessage( `${ botMention } is online...use ${ services.config.COMMAND_SWITCH }help to see some of what I can do`, { services } );

      // await services.messageService.sendGroupPictureMessage(
      //   `${ botMention } is online...user ${ services.config.COMMAND_SWITCH }help to see some of what I can do`,
      //   "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNmprZG5yMDY1aDVndGo3cDI4eWN2cTJ1cHNrODlkcTgzbDhzc25obSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Cmr1OMJ2FN0B2/giphy.gif",
      //   { services }
      // );

      services.logger.info( "✅ Startup message sent to group" );
    } catch ( error ) {
      services.logger.error( `❌ Failed to send startup message: ${ error?.message || error?.toString() || 'Unknown error' }` );
      services.logger.error( `❌ Startup message error details:`, error );
      // Don't exit here - continue running even if startup message fails
    }

    services.logger.info( '🎉 APPLICATION STARTUP COMPLETED - Bot is now running' );

  } catch ( err ) {
    services.logger.error( `❌ Error during startup: ${ err.response?.data || err.message }` );
    services.logger.error( err );
    services.logger.error( '❌ EXITING APPLICATION DUE TO STARTUP ERROR' );
  }
} )();
