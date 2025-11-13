// Mock the config BEFORE requiring the command
jest.mock( '../../src/config.js', () => ( {
  COMMAND_SWITCH: '!'
} ) );

const handleFeatureCommand = require( '../../src/commands/Bot Commands/handleFeatureCommand' );

describe( 'handleFeatureCommand', () => {
  let services;
  let commandParams;

  beforeEach( () => {
    services = {
      featuresService: {
        isFeatureEnabled: jest.fn(),
        enableFeature: jest.fn(),
        disableFeature: jest.fn(),
        getAllFeatures: jest.fn()
      },
      messageService: {
        sendResponse: jest.fn()
      },
      stateService: {
        getUserRole: jest.fn()
      }
    };

    commandParams = {
      command: 'feature',
      args: 'list',
      services: services,
      context: {
        sender: 'user123'
      },
      responseChannel: 'request'
    };
  } );

  describe( 'permission checking', () => {
    it( 'should allow owners to use feature command', async () => {
      services.stateService.getUserRole.mockReturnValue( 'owner' );
      services.featuresService.getAllFeatures.mockReturnValue( {
        enabled: [ 'welcomeMessage' ],
        disabled: [ 'nowPlayingMessage' ]
      } );

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( true );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should deny access to moderators', async () => {
      services.stateService.getUserRole.mockReturnValue( 'moderator' );

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( '❌ Only the room owner or co-owner can manage features.' );
      expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( '❌ Only the room owner or co-owner can manage features.' ),
        expect.any( Object )
      );
    } );

    it( 'should deny access to regular users', async () => {
      services.stateService.getUserRole.mockReturnValue( 'user' );

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( '❌ Only the room owner or co-owner can manage features.' );
      expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( '❌ Only the room owner or co-owner can manage features.' ),
        expect.any( Object )
      );
    } );
  } );

  describe( 'list command', () => {
    beforeEach( () => {
      services.stateService.getUserRole.mockReturnValue( 'owner' );
      commandParams.args = 'list';
    } );

    it( 'should display enabled and disabled features', async () => {
      services.featuresService.getAllFeatures.mockReturnValue( {
        enabled: [ 'welcomeMessage' ],
        disabled: [ 'nowPlayingMessage' ]
      } );

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( true );
      expect( result.response ).toContain( '📋 **Available Features:**' );
      expect( result.response ).toContain( '✅ **Enabled:**' );
      expect( result.response ).toContain( '• welcomeMessage' );
      expect( result.response ).toContain( '❌ **Disabled:**' );
      expect( result.response ).toContain( '• nowPlayingMessage' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should handle all features enabled', async () => {
      services.featuresService.getAllFeatures.mockReturnValue( {
        enabled: [ 'welcomeMessage', 'nowPlayingMessage' ],
        disabled: []
      } );

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( true );
      expect( result.response ).toContain( '• welcomeMessage' );
      expect( result.response ).toContain( '• nowPlayingMessage' );
      expect( result.response ).toContain( '❌ **Disabled:**\n(none)' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should handle all features disabled', async () => {
      services.featuresService.getAllFeatures.mockReturnValue( {
        enabled: [],
        disabled: [ 'welcomeMessage', 'nowPlayingMessage' ]
      } );

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( true );
      expect( result.response ).toContain( '✅ **Enabled:**\n(none)' );
      expect( result.response ).toContain( '• welcomeMessage' );
      expect( result.response ).toContain( '• nowPlayingMessage' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );
  } );

  describe( 'enable command', () => {
    beforeEach( () => {
      services.stateService.getUserRole.mockReturnValue( 'owner' );
    } );

    it( 'should enable a feature successfully', async () => {
      services.featuresService.enableFeature.mockReturnValue( true );
      commandParams.args = 'enable welcomeMessage';

      const result = await handleFeatureCommand( commandParams );

      expect( services.featuresService.enableFeature ).toHaveBeenCalledWith( 'welcomeMessage' );
      expect( result.success ).toBe( true );
      expect( result.response ).toContain( '✅ Feature "welcomeMessage" has been enabled.' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should handle feature already enabled', async () => {
      services.featuresService.enableFeature.mockReturnValue( false );
      commandParams.args = 'enable welcomeMessage';

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( 'ℹ️ Feature "welcomeMessage" is already enabled.' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should require feature name argument', async () => {
      commandParams.args = 'enable';

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( '❌ Please specify a feature name. Usage: `!feature enable <featureName>`' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );
  } );

  describe( 'disable command', () => {
    beforeEach( () => {
      services.stateService.getUserRole.mockReturnValue( 'owner' );
    } );

    it( 'should disable a feature successfully', async () => {
      services.featuresService.disableFeature.mockReturnValue( true );
      commandParams.args = 'disable welcomeMessage';

      const result = await handleFeatureCommand( commandParams );

      expect( services.featuresService.disableFeature ).toHaveBeenCalledWith( 'welcomeMessage' );
      expect( result.success ).toBe( true );
      expect( result.response ).toContain( '❌ Feature "welcomeMessage" has been disabled.' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should handle feature already disabled', async () => {
      services.featuresService.disableFeature.mockReturnValue( false );
      commandParams.args = 'disable welcomeMessage';

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( 'ℹ️ Feature "welcomeMessage" is already disabled.' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should require feature name argument', async () => {
      commandParams.args = 'disable';

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( '❌ Please specify a feature name. Usage: `!feature disable <featureName>`' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );
  } );

  describe( 'status command', () => {
    beforeEach( () => {
      services.stateService.getUserRole.mockReturnValue( 'owner' );
    } );

    it( 'should show enabled status', async () => {
      services.featuresService.isFeatureEnabled.mockReturnValue( true );
      commandParams.args = 'status welcomeMessage';

      const result = await handleFeatureCommand( commandParams );

      expect( services.featuresService.isFeatureEnabled ).toHaveBeenCalledWith( 'welcomeMessage' );
      expect( result.success ).toBe( true );
      expect( result.response ).toContain( 'ℹ️ Feature "welcomeMessage" is currently enabled ✅.' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should show disabled status', async () => {
      services.featuresService.isFeatureEnabled.mockReturnValue( false );
      commandParams.args = 'status welcomeMessage';

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( true );
      expect( result.response ).toContain( 'ℹ️ Feature "welcomeMessage" is currently disabled ❌.' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should require feature name argument', async () => {
      commandParams.args = 'status';

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( '❌ Please specify a feature name. Usage: `!feature status <featureName>`' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );
  } );

  describe( 'invalid command', () => {
    beforeEach( () => {
      services.stateService.getUserRole.mockReturnValue( 'owner' );
    } );

    it( 'should show usage for unknown subcommand', async () => {
      commandParams.args = 'invalid';

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( '📋 **Feature Management Usage:**' );
      expect( result.response ).toContain( '`!feature list`' );
      expect( result.response ).toContain( '`!feature enable <featureName>`' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );

    it( 'should show usage when no subcommand provided', async () => {
      commandParams.args = '';

      const result = await handleFeatureCommand( commandParams );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( '📋 **Feature Management Usage:**' );
      expect( services.messageService.sendResponse ).toHaveBeenCalled();
    } );
  } );
} );