const services = require( './services/serviceContainer.js' );
const { Bot } = require( './lib/bot.js' );

process.on( 'unhandledRejection', ( reason, promise ) => {
  services.logger.error( `Unhandled Rejection at: ${ promise }, reason: ${ reason }` );
} );

// Log application starting
services.logger.info( '======================================= Application Starting =======================================' );

( async () => {

  try {
    // Fetch bot's nickname using BOT_UID and hangUserService
    try {
      const botNickname = await services.hangUserService.getUserNicknameByUuid( services.config.BOT_UID );
      services.setState( 'botNickname', botNickname );
      services.logger.info( `🤖 Bot nickname resolved and stored: ${ botNickname }` );
    } catch ( err ) {
      services.logger.warn( `⚠️ Could not resolve bot nickname: ${ err.message }` );
    }

    const roomBot = new Bot( services.config.HANGOUT_ID, services );
    services.logger.debug( '🤖 Bot instance created' );

    try {
      await roomBot.connect();
      services.logger.debug( '✅ Bot connect() completed successfully' );
    } catch ( connectError ) {
      services.logger.error( `❌ Error during bot.connect(): ${ connectError }` );
      throw connectError;
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
    }, checkInterval );

    services.logger.debug( `Started message processing with ${ checkInterval }ms interval` );

    // Validate that we have initial state data before declaring success
    try {
      const allUserData = services.hangoutState?.allUserData || {};
      const userCount = Object.keys( allUserData ).length;

      if ( userCount === 0 ) {
        services.logger.error( '❌ CRITICAL ERROR: allUserData is empty - no initial state loaded' );
        services.logger.error( '❌ This indicates the stateful message processing failed to apply initial state patches' );
        services.logger.error( '❌ The bot cannot operate without proper state initialization' );
        services.logger.error( '❌ Check logs for JSON Patch application errors and ensure stateful messages are being processed correctly' );
        process.exit( 1 );
      }

      services.logger.info( `✅ State validation passed: ${ userCount } users loaded in allUserData` );
    } catch ( stateError ) {
      services.logger.error( `❌ CRITICAL ERROR: Failed to validate initial state: ${ stateError.message }` );
      services.logger.error( '❌ Cannot proceed without valid state - exiting application' );
      process.exit( 1 );
    }

    services.logger.info( '======================================= Application Started Successfully =======================================' );

    // Send startup message to group
    try {
      const botNickname = services.getState( 'botNickname' ) || 'Bot';
      await services.messageService.sendGroupMessage( `${ botNickname } is online...user ${ services.config.COMMAND_SWITCH }help to see some of what I can do`, { services } );

      // await services.messageService.sendGroupPictureMessage(
      //   `${ botNickname } is online...user ${ services.config.COMMAND_SWITCH }help to see some of what I can do`,
      //   "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNmprZG5yMDY1aDVndGo3cDI4eWN2cTJ1cHNrODlkcTgzbDhzc25obSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Cmr1OMJ2FN0B2/giphy.gif",
      //   { services }
      // );

      services.logger.info( "✅ Startup message sent to group" );
    } catch ( error ) {
      services.logger.error( `❌ Failed to send startup message: ${ error?.message || error?.toString() || 'Unknown error' }` );
    }

  } catch ( err ) {
    services.logger.error( `❌ Error during startup: ${ err.response?.data || err.message }` );
    services.logger.error( err );
  }
} )();
