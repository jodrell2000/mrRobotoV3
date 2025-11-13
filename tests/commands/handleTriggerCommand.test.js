const handleTriggerCommand = require( '../../src/commands/Edit Commands/handleTriggerCommand' );

// Mock fs to prevent real file operations during tests
jest.mock( 'fs', () => ( {
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn()
} ) );

describe( 'handleTriggerCommand', () => {
  let mockServices;

  beforeEach( () => {
    mockServices = {
      dataService: {
        loadData: jest.fn(),
        getValue: jest.fn(),
        setValue: jest.fn()
      },
      messageService: {
        sendResponse: jest.fn()
      },
      stateService: {
        getUserRole: jest.fn().mockReturnValue( 'owner' )
      },
      triggerService: {
        getAvailableTriggers: jest.fn().mockReturnValue( {
          'newSong': 'Fires when a new song starts playing',
          'userJoined': 'Fires when a user joins the hangout'
        } ),
        getAllTriggers: jest.fn().mockReturnValue( {
          'newSong': [ 'intro', 'echo welcome!' ]
        } ),
        addTriggerCommand: jest.fn(),
        removeTriggerCommand: jest.fn(),
        clearTrigger: jest.fn()
      },
      commandService: jest.fn()
    };
  } );

  afterEach( () => {
    jest.clearAllMocks();
  } );

  describe( 'metadata', () => {
    it( 'should have correct metadata properties', () => {
      expect( handleTriggerCommand.requiredRole ).toBe( 'OWNER' );
      expect( handleTriggerCommand.description ).toBe( 'Manage command triggers for bot events' );
      expect( handleTriggerCommand.example ).toBe( 'trigger list | trigger add newSong intro | trigger remove newSong intro' );
      expect( handleTriggerCommand.hidden ).toBe( false );
    } );
  } );

  describe( 'command execution', () => {
    const defaultContext = {
      sender: { username: 'testowner', role: 'OWNER' },
      fullMessage: { isPrivateMessage: false }
    };

    it( 'should show help when no args provided', async () => {
      const result = await handleTriggerCommand( {
        command: 'trigger',
        args: '',
        services: mockServices,
        context: defaultContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.shouldRespond ).toBe( true );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Please specify a trigger command' ),
        expect.any( Object )
      );
    } );

    it( 'should list all triggers', async () => {
      const result = await handleTriggerCommand( {
        command: 'trigger',
        args: 'list',
        services: mockServices,
        context: defaultContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true );
      expect( result.shouldRespond ).toBe( true );
      expect( mockServices.triggerService.getAvailableTriggers ).toHaveBeenCalled();
      expect( mockServices.triggerService.getAllTriggers ).toHaveBeenCalled();
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Configured Triggers' ),
        expect.any( Object )
      );
    } );

    it( 'should add a command to a trigger', async () => {
      mockServices.triggerService.addTriggerCommand.mockResolvedValue( {
        success: true,
        message: 'Added command "ping" to trigger "newSong"',
        currentCommands: [ 'intro', 'echo welcome!', 'ping' ]
      } );

      const result = await handleTriggerCommand( {
        command: 'trigger',
        args: 'add newSong ping',
        services: mockServices,
        context: defaultContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true );
      expect( result.shouldRespond ).toBe( true );
      expect( mockServices.triggerService.addTriggerCommand ).toHaveBeenCalledWith( 'newSong', 'ping' );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Added command "ping" to trigger "newSong"' ),
        expect.any( Object )
      );
    } );

    it( 'should handle add command failure', async () => {
      mockServices.triggerService.addTriggerCommand.mockResolvedValue( {
        success: false,
        error: 'Command "ping" is already configured for trigger "newSong"'
      } );

      const result = await handleTriggerCommand( {
        command: 'trigger',
        args: 'add newSong ping',
        services: mockServices,
        context: defaultContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.shouldRespond ).toBe( true );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Command "ping" is already configured for trigger "newSong"' ),
        expect.any( Object )
      );
    } );

    it( 'should remove a command from a trigger', async () => {
      mockServices.triggerService.removeTriggerCommand.mockResolvedValue( {
        success: true,
        message: 'Removed command "ping" from trigger "newSong"',
        currentCommands: [ 'intro' ]
      } );

      const result = await handleTriggerCommand( {
        command: 'trigger',
        args: 'remove newSong ping',
        services: mockServices,
        context: defaultContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true );
      expect( result.shouldRespond ).toBe( true );
      expect( mockServices.triggerService.removeTriggerCommand ).toHaveBeenCalledWith( 'newSong', 'ping' );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Removed command "ping" from trigger "newSong"' ),
        expect.any( Object )
      );
    } );

    it( 'should clear all commands from a trigger', async () => {
      mockServices.triggerService.clearTrigger.mockResolvedValue( {
        success: true,
        message: 'Cleared all commands from trigger "newSong"',
        clearedCommands: [ 'intro', 'echo welcome!' ]
      } );

      const result = await handleTriggerCommand( {
        command: 'trigger',
        args: 'clear newSong',
        services: mockServices,
        context: defaultContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true );
      expect( result.shouldRespond ).toBe( true );
      expect( mockServices.triggerService.clearTrigger ).toHaveBeenCalledWith( 'newSong' );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Cleared all commands from trigger "newSong"' ),
        expect.any( Object )
      );
    } );

    it( 'should handle invalid subcommands', async () => {
      const result = await handleTriggerCommand( {
        command: 'trigger',
        args: 'invalid',
        services: mockServices,
        context: defaultContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.shouldRespond ).toBe( true );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Invalid subcommand: "invalid"' ),
        expect.any( Object )
      );
    } );

    it( 'should handle missing arguments for add command', async () => {
      const result = await handleTriggerCommand( {
        command: 'trigger',
        args: 'add newSong',
        services: mockServices,
        context: defaultContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.shouldRespond ).toBe( true );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Please specify trigger name and command name' ),
        expect.any( Object )
      );
    } );

    it( 'should handle missing arguments for remove command', async () => {
      const result = await handleTriggerCommand( {
        command: 'trigger',
        args: 'remove newSong',
        services: mockServices,
        context: defaultContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.shouldRespond ).toBe( true );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Please specify trigger name and command name' ),
        expect.any( Object )
      );
    } );

    it( 'should handle missing arguments for clear command', async () => {
      const result = await handleTriggerCommand( {
        command: 'trigger',
        args: 'clear',
        services: mockServices,
        context: defaultContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.shouldRespond ).toBe( true );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Please specify trigger name' ),
        expect.any( Object )
      );
    } );

    it( 'should handle service errors gracefully', async () => {
      mockServices.triggerService.addTriggerCommand.mockRejectedValue( new Error( 'Service error' ) );

      const result = await handleTriggerCommand( {
        command: 'trigger',
        args: 'add newSong ping',
        services: mockServices,
        context: defaultContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.shouldRespond ).toBe( true );
      expect( result.error ).toBe( 'Service error' );
    } );
  } );
} );