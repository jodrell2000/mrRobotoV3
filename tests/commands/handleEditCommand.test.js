const handleEditCommand = require( '../../src/commands/Edit Commands/handleEditCommand' );

// Mock fs.promises more completely
const mockWriteFile = jest.fn();
const mockReadFile = jest.fn();

jest.mock( 'fs', () => {
  const actual = jest.requireActual( 'fs' );
  return {
    ...actual,
    promises: {
      writeFile: mockWriteFile,
      readFile: mockReadFile
    }
  };
} );

describe( 'handleEditCommand', () => {
  let mockServices;
  let mockContext;

  beforeEach( () => {
    // Reset mocks
    jest.clearAllMocks();

    // Reset mock implementations
    mockWriteFile.mockReset();
    mockReadFile.mockReset();

    // Mock services
    mockServices = {
      messageService: {
        sendResponse: jest.fn()
      },
      dataService: {
        getAllData: jest.fn(),
        getValue: jest.fn(),
        setValue: jest.fn(),
        loadData: jest.fn().mockResolvedValue()
      },
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn()
      }
    };

    // Mock context
    mockContext = {
      sender: { username: 'testuser' },
      fullMessage: { isPrivateMessage: false }
    };

    // Default successful mocks
    mockWriteFile.mockResolvedValue();
    mockReadFile.mockResolvedValue( '{"editableMessages":{"welcomeMessage":"test"}}' );
  } );

  describe( 'command metadata', () => {
    it( 'should have correct metadata', () => {
      expect( handleEditCommand.requiredRole ).toBe( 'MODERATOR' );
      expect( handleEditCommand.description ).toBeDefined();
      expect( handleEditCommand.example ).toBeDefined();
      expect( handleEditCommand.hidden ).toBe( false );
    } );
  } );

  describe( 'argument validation', () => {
    it( 'should require arguments', async () => {
      const result = await handleEditCommand( {
        args: '',
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( 'Please specify a message type' );
    } );

    it( 'should validate message type', async () => {
      const result = await handleEditCommand( {
        args: 'invalidMessage Test message',
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( 'Invalid message type' );
    } );

    it( 'should require message content', async () => {
      const result = await handleEditCommand( {
        args: 'welcomeMessage',
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( 'Please provide a new' );
    } );

    it( 'should require non-empty message content', async () => {
      const result = await handleEditCommand( {
        args: 'welcomeMessage   ',
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.response ).toContain( 'Please provide a new' );
    } );
  } );

  describe( 'successful updates with new structure', () => {
    beforeEach( () => {
      // Mock existing new structure data
      mockServices.dataService.getAllData.mockReturnValue( {
        editableMessages: {
          welcomeMessage: 'Old welcome'
        },
        disabledCommands: [],
        disabledFeatures: []
      } );
    } );

    it( 'should update welcomeMessage in new structure', async () => {
      const expectedMessage = 'Hi {username}, welcome to our awesome {hangoutName}!';

      // Set up getValue mock to return the new message during verification
      mockServices.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'editableMessages.welcomeMessage' ) return expectedMessage;
        return undefined;
      } );

      const result = await handleEditCommand( {
        args: `welcomeMessage ${ expectedMessage }`,
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true );
      expect( result.response ).toContain( 'Welcome Message updated to' );
      expect( mockServices.dataService.loadData ).toHaveBeenCalledTimes( 1 ); // Initial load
    } );

    it( 'should update nowPlayingMessage', async () => {
      const expectedMessage = '🎵 {username} is jamming to {trackName} by {artistName}';

      // Set up getValue mock to return the new message during verification  
      mockServices.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'editableMessages.nowPlayingMessage' ) return expectedMessage;
        return undefined;
      } );

      const result = await handleEditCommand( {
        args: `nowPlayingMessage ${ expectedMessage }`,
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true );
      expect( result.response ).toContain( 'Now Playing Message updated to' );
    } );

    it( 'should update justPlayedMessage', async () => {
      const expectedMessage = '🎵 {username} just finished playing {trackName} by {artistName}. Votes: 👍 {likes} 👎 {dislikes} ❤️ {stars}';

      // Set up getValue mock to return the new message during verification
      mockServices.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'editableMessages.justPlayedMessage' ) return expectedMessage;
        return undefined;
      } );

      const result = await handleEditCommand( {
        args: `justPlayedMessage ${ expectedMessage }`,
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true );
      expect( result.response ).toContain( 'Just Played Message updated to' );
    } );

    it( 'should update popfactsMessage', async () => {
      const expectedMessage = 'Please tell me interesting facts about the song ${trackName} by ${artistName}. Include historical context and trivia.';

      // Set up getValue mock to return the new message during verification
      mockServices.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'editableMessages.popfactsMessage' ) return expectedMessage;
        return undefined;
      } );

      const result = await handleEditCommand( {
        args: `popfactsMessage ${ expectedMessage }`,
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true );
      expect( result.response ).toContain( 'Popfacts AI Question Template updated to' );
    } );
  } );

  describe( 'migration from old structure', () => {
    beforeEach( () => {
      // Mock existing old structure data
      mockServices.dataService.getAllData.mockReturnValue( {
        welcomeMessage: 'Old welcome',
        nowPlayingMessage: 'Old now playing',
        justPlayedMessage: 'Old just played',
        disabledCommands: [],
        disabledFeatures: []
      } );
    } );

    it( 'should migrate old structure to new structure', async () => {
      const expectedMessage = 'New welcome message';

      // Mock getValue to return from new structure after migration
      mockServices.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'editableMessages.welcomeMessage' ) return expectedMessage;
        if ( key === 'welcomeMessage' ) return 'Old welcome'; // fallback
        return undefined;
      } );

      const result = await handleEditCommand( {
        args: `welcomeMessage ${ expectedMessage }`,
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true );
      expect( result.response ).toContain( 'Welcome Message updated to' );
    } );
  } );

  describe( 'error handling', () => {
    beforeEach( () => {
      mockServices.dataService.getAllData.mockReturnValue( {
        editableMessages: {
          welcomeMessage: 'Old welcome'
        }
      } );
    } );

    it( 'should handle file write errors', async () => {
      // Mock getValue to return different value to simulate verification failure
      mockServices.dataService.getValue.mockReturnValue( 'Different message' );

      const result = await handleEditCommand( {
        args: 'welcomeMessage New welcome',
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.error ).toBe( 'Message in memory does not match new message after reload' );
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.stringContaining( 'Failed to update welcome message' ),
        expect.any( Object )
      );
    } );

    it( 'should handle verification failure', async () => {
      // Mock getValue to return different value than what was written
      mockServices.dataService.getValue.mockReturnValue( 'Different message' );

      const result = await handleEditCommand( {
        args: 'welcomeMessage New welcome',
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.error ).toBe( 'Message in memory does not match new message after reload' );
    } );

    it( 'should handle general errors', async () => {
      mockServices.dataService.loadData.mockRejectedValue( new Error( 'Database error' ) );

      const result = await handleEditCommand( {
        args: 'welcomeMessage New welcome',
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.error ).toBe( 'Database error' );
    } );
  } );

  describe( 'backward compatibility', () => {
    beforeEach( () => {
      mockServices.dataService.getAllData.mockReturnValue( {
        editableMessages: {
          welcomeMessage: 'New welcome'
        }
      } );
    } );

    it( 'should successfully update messages using new structure', async () => {
      const expectedMessage = 'Updated welcome message';

      // Mock getValue to return the expected message after setValue is called
      mockServices.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'editableMessages.welcomeMessage' ) return expectedMessage;
        return undefined;
      } );

      const result = await handleEditCommand( {
        args: `welcomeMessage ${ expectedMessage }`,
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true );
      expect( mockServices.dataService.setValue ).toHaveBeenCalledWith( 'editableMessages.welcomeMessage', expectedMessage );
    } );
  } );

  describe( 'private message handling', () => {
    it( 'should work with private messages', async () => {
      mockServices.dataService.getAllData.mockReturnValue( {
        editableMessages: { welcomeMessage: 'Old welcome' }
      } );

      mockServices.dataService.getValue.mockReturnValue( 'Updated welcome message' );

      // Set up private message context
      const privateContext = {
        ...mockContext,
        fullMessage: { isPrivateMessage: true }
      };

      const result = await handleEditCommand( {
        args: 'welcomeMessage Updated welcome message',
        services: mockServices,
        context: privateContext,
        responseChannel: 'request'
      } );

      expect( result.success ).toBe( true );

      // Check that private message flag was passed correctly
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        expect.any( String ),
        expect.objectContaining( {
          isPrivateMessage: true,
          responseChannel: 'request'
        } )
      );
    } );
  } );
} );