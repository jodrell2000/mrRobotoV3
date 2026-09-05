const fs = require( 'fs' ).promises;
const path = require( 'path' );
const handleChangebotnameCommand = require( '../../src/commands/Bot Commands/handleChangebotnameCommand.js' );

// Mock the command service to test role-based access control
const commandService = require( '../../src/services/commandService.js' );
jest.mock( '../../src/services/commandService.js' );

describe( 'handleChangebotnameCommand', () => {
  let mockServices;
  let mockCommandParams;

  beforeEach( () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock services
    mockServices = {
      messageService: {
        sendGroupMessage: jest.fn().mockResolvedValue( {} ),
        sendResponse: jest.fn().mockResolvedValue( {} )
      },
      hangUserService: {
        updateHangNickname: jest.fn().mockResolvedValue( {} )
      },
      dataService: {
        setValue: jest.fn().mockResolvedValue( true )
      },
      stateService: {
        getUserRole: jest.fn().mockReturnValue( 'user' )
      }
    };

    // Mock command parameters
    mockCommandParams = {
      args: 'NewBotName',
      services: mockServices,
      context: {
        sender: 'testUser',
        fullMessage: {
          isPrivateMessage: false
        }
      }
    };

    // No need for file operations as they're handled by dataService
  } );

  test( 'changes bot name successfully', async () => {
    const result = await handleChangebotnameCommand( mockCommandParams );

    // Verify successful result
    expect( result.success ).toBe( true );
    expect( result.response ).toContain( 'NewBotName' );

    // Verify all services were called
    expect( mockServices.hangUserService.updateHangNickname ).toHaveBeenCalledWith( mockServices, 'NewBotName' );
    expect( mockServices.dataService.setValue ).toHaveBeenCalledWith( 'botData.CHAT_NAME', 'NewBotName' );
    expect( mockServices.messageService.sendResponse ).toHaveBeenCalled();
  } );

  test( 'fails when no name is provided', async () => {
    mockCommandParams.args = '';
    const result = await handleChangebotnameCommand( mockCommandParams );

    expect( result.success ).toBe( false );
    expect( result.response ).toContain( 'provide a new name' );
    expect( mockServices.hangUserService.updateHangNickname ).not.toHaveBeenCalled();
  } );

  test( 'handles updateHangNickname failure', async () => {
    mockServices.hangUserService.updateHangNickname.mockRejectedValue( new Error( 'API Error' ) );

    const result = await handleChangebotnameCommand( mockCommandParams );

    expect( result.success ).toBe( false );
    expect( result.response ).toContain( 'Failed to change bot name' );
    expect( result.error ).toBe( 'API Error' );
  } );

  test( 'handles file write failure', async () => {
    mockServices.dataService.setValue.mockRejectedValue( new Error( 'File write failed' ) );

    const result = await handleChangebotnameCommand( mockCommandParams );

    expect( result.success ).toBe( false );
    expect( result.response ).toContain( 'Failed to change bot name' );
    expect( result.error ).toBe( 'File write failed' );
  } );

  // Test that the command has the correct required role
  test( 'command requires OWNER role', () => {
    expect( handleChangebotnameCommand.requiredRole ).toBe( 'OWNER' );
  } );

  describe( 'Response channel handling', () => {
    test( 'responds via public channel when isPrivateMessage is false', async () => {
      mockCommandParams.context.fullMessage.isPrivateMessage = false;

      const result = await handleChangebotnameCommand( mockCommandParams );

      expect( result.success ).toBe( true );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'NewBotName' ),
        expect.objectContaining( {
          responseChannel: 'request',
          isPrivateMessage: false,
          sender: 'testUser',
          services: mockServices
        } )
      );
    } );

    test( 'responds via private message when isPrivateMessage is true', async () => {
      mockCommandParams.context.fullMessage.isPrivateMessage = true;

      const result = await handleChangebotnameCommand( mockCommandParams );

      expect( result.success ).toBe( true );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'NewBotName' ),
        expect.objectContaining( {
          responseChannel: 'request',
          isPrivateMessage: true,
          sender: 'testUser',
          services: mockServices
        } )
      );
    } );

    test( 'handles missing fullMessage context gracefully', async () => {
      mockCommandParams.context.fullMessage = undefined;

      const result = await handleChangebotnameCommand( mockCommandParams );

      expect( result.success ).toBe( true );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'NewBotName' ),
        expect.objectContaining( {
          responseChannel: 'request',
          isPrivateMessage: undefined,
          sender: 'testUser',
          services: mockServices
        } )
      );
    } );

    test( 'uses custom responseChannel when provided', async () => {
      mockCommandParams.responseChannel = 'public';

      const result = await handleChangebotnameCommand( mockCommandParams );

      expect( result.success ).toBe( true );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'NewBotName' ),
        expect.objectContaining( {
          responseChannel: 'public',
          isPrivateMessage: false,
          sender: 'testUser',
          services: mockServices
        } )
      );
    } );
  } );

  describe( 'Error handling for different message contexts', () => {
    test( 'sends error response via public channel when command fails', async () => {
      mockServices.hangUserService.updateHangNickname.mockRejectedValue( new Error( 'API Error' ) );
      mockCommandParams.context.fullMessage.isPrivateMessage = false;

      const result = await handleChangebotnameCommand( mockCommandParams );

      expect( result.success ).toBe( false );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Failed to change bot name' ),
        expect.objectContaining( {
          responseChannel: 'request',
          isPrivateMessage: false,
          sender: 'testUser',
          services: mockServices
        } )
      );
    } );

    test( 'sends error response via private message when command fails', async () => {
      mockServices.hangUserService.updateHangNickname.mockRejectedValue( new Error( 'API Error' ) );
      mockCommandParams.context.fullMessage.isPrivateMessage = true;

      const result = await handleChangebotnameCommand( mockCommandParams );

      expect( result.success ).toBe( false );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Failed to change bot name' ),
        expect.objectContaining( {
          responseChannel: 'request',
          isPrivateMessage: true,
          sender: 'testUser',
          services: mockServices
        } )
      );
    } );

    test( 'sends missing args error via private message', async () => {
      mockCommandParams.args = '';
      mockCommandParams.context.fullMessage.isPrivateMessage = true;

      const result = await handleChangebotnameCommand( mockCommandParams );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( 'provide a new name' );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'provide a new name' ),
        expect.objectContaining( {
          responseChannel: 'request',
          isPrivateMessage: true,
          sender: 'testUser',
          services: mockServices
        } )
      );
    } );
  } );
} );
