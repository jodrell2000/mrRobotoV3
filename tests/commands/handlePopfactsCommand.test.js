const handlePopfactsCommand = require( '../../src/commands/ML Commands/handlePopfactsCommand.js' );

describe( 'handlePopfactsCommand', () => {
  let mockServices;
  let mockContext;

  beforeEach( () => {
    mockServices = {
      messageService: {
        sendResponse: jest.fn().mockResolvedValue()
      },
      machineLearningService: {
        askGoogleAI: jest.fn()
      },
      hangoutState: {
        nowPlaying: {
          song: {
            trackName: 'Bohemian Rhapsody',
            artistName: 'Queen'
          }
        },
        djs: [
          { uuid: 'test-dj-uuid' }
        ]
      },
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      dataService: {
        getValue: jest.fn().mockImplementation( ( key ) => {
          if ( key === 'botData.CHAT_NAME' ) return 'TestBot';
          return null;
        } )
      },
      stateService: {
        getHangoutName: jest.fn().mockReturnValue( 'Test Hangout' )
      },
      hangUserService: {
        getUserNicknameByUuid: jest.fn().mockResolvedValue( 'TestDJ' )
      }
    }; mockContext = {
      sender: {
        uuid: 'test-user-uuid',
        username: 'TestUser'
      },
      fullMessage: { isPrivateMessage: false }
    }; jest.clearAllMocks();
  } );

  describe( 'command metadata', () => {
    it( 'should have correct metadata', () => {
      expect( handlePopfactsCommand.requiredRole ).toBe( 'USER' );
      expect( handlePopfactsCommand.description ).toBe( 'Get interesting facts about the currently playing song' );
      expect( handlePopfactsCommand.example ).toBe( 'popfacts' );
      expect( handlePopfactsCommand.hidden ).toBe( false );
    } );
  } );

  describe( 'successful execution', () => {
    it( 'should get facts about currently playing song', async () => {
      const mockAIResponse = 'Queen formed in London in 1970. Bohemian Rhapsody was recorded in 1975. The song has no chorus structure.';
      mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

      // Mock the template from dataService
      const mockTemplate = 'The song I\'m currently listening to is {trackName} by {artistName}. Tell me three short interesting facts about the song and/or the artist. When searching note that it may or may not be a cover version. Do not tell me that you\'re giving me three facts as part of the reply';
      mockServices.dataService.getValue.mockImplementation( ( key ) => {
        if ( key === 'botData.CHAT_NAME' ) return 'TestBot';
        if ( key === 'mlQuestions.popfactsQuestion' ) return mockTemplate;
        return null;
      } );

      const result = await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true );
      expect( result.shouldRespond ).toBe( true );

      // Check that dataService was called to get the template
      expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'mlQuestions.popfactsQuestion' );

      // Check that AI was called with correct question (template with substitutions)
      expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
        "The song I'm currently listening to is Bohemian Rhapsody by Queen. Tell me three short interesting facts about the song and/or the artist. When searching note that it may or may not be a cover version. Do not tell me that you're giving me three facts as part of the reply"
      );

      // Check that one response was sent (just facts)
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledTimes( 1 );

      // Check facts response
      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        'Queen formed in London in 1970. Bohemian Rhapsody was recorded in 1975. The song has no chorus structure.',
        expect.any( Object )
      );
    } );

    it( 'should work with private messages', async () => {
      const mockAIResponse = 'Some interesting facts here.';
      mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

      mockContext.fullMessage.isPrivateMessage = true;

      const result = await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
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

  describe( 'error handling', () => {
    it( 'should handle no song currently playing', async () => {
      mockServices.hangoutState.nowPlaying = null;

      const result = await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.error ).toBe( 'No song currently playing' );

      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        '🎵 No song is currently playing. Start a song first and try again!',
        expect.any( Object )
      );

      // AI should not be called
      expect( mockServices.machineLearningService.askGoogleAI ).not.toHaveBeenCalled();
    } );

    it( 'should handle missing song object', async () => {
      mockServices.hangoutState.nowPlaying = { song: null };

      const result = await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.error ).toBe( 'No song currently playing' );

      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        '🎵 No song is currently playing. Start a song first and try again!',
        expect.any( Object )
      );
    } );

    it( 'should handle missing track name', async () => {
      mockServices.hangoutState.nowPlaying.song.trackName = null;

      const result = await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.error ).toBe( 'Missing song details' );

      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        '🎵 Unable to get song details. Please try again when a song is playing.',
        expect.any( Object )
      );
    } );

    it( 'should handle missing artist name', async () => {
      mockServices.hangoutState.nowPlaying.song.artistName = '';

      const result = await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.error ).toBe( 'Missing song details' );
    } );

    it( 'should handle AI service errors', async () => {
      mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'An error occurred while connecting to Google Gemini. Please wait a minute and try again' );

      const result = await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true ); // Command succeeded but AI failed

      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        '🎵 Sorry, I couldn\'t get facts about "Bohemian Rhapsody" by Queen right now. Please try again later.',
        expect.any( Object )
      );
    } );

    it( 'should handle "No response" from AI', async () => {
      mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'No response' );

      const result = await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( true );

      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        '🎵 Sorry, I couldn\'t get facts about "Bohemian Rhapsody" by Queen right now. Please try again later.',
        expect.any( Object )
      );
    } );

    it( 'should handle AI service throwing an error', async () => {
      mockServices.machineLearningService.askGoogleAI.mockRejectedValue( new Error( 'Network error' ) );

      const result = await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.error ).toBe( 'Network error' );

      expect( mockServices.logger.error ).toHaveBeenCalledWith( '[popfacts] Error getting song facts: Network error' );

      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        '🎵 Sorry, there was an error getting song facts. Please try again later.',
        expect.any( Object )
      );
    } );

    it( 'should handle missing hangout state', async () => {
      mockServices.hangoutState = null;

      const result = await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.error ).toBe( 'No song currently playing' );
    } );
  } );

  describe( 'response formatting', () => {
    it( 'should format successful response with song title and artist', async () => {
      const mockAIResponse = 'Fact 1. Fact 2. Fact 3.';
      mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

      await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        'Fact 1. Fact 2. Fact 3.',
        expect.any( Object )
      );
    } );

    it( 'should handle different song titles and artists', async () => {
      mockServices.hangoutState.nowPlaying.song = {
        trackName: 'Imagine',
        artistName: 'John Lennon'
      };

      const mockAIResponse = 'Some facts about Imagine.';
      mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

      // Mock the template from dataService
      const mockTemplate = 'The song I\'m currently listening to is {trackName} by {artistName}. Tell me three short interesting facts about the song and/or the artist. When searching note that it may or may not be a cover version. Do not tell me that you\'re giving me three facts as part of the reply';
      mockServices.dataService.getValue.mockReturnValue( mockTemplate );

      await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
        "The song I'm currently listening to is Imagine by John Lennon. Tell me three short interesting facts about the song and/or the artist. When searching note that it may or may not be a cover version. Do not tell me that you're giving me three facts as part of the reply"
      );

      expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
        'Some facts about Imagine.',
        expect.any( Object )
      );
    } );

    it( 'should use default template when dataService returns null', async () => {
      mockServices.hangoutState.nowPlaying.song = {
        trackName: 'Test Song',
        artistName: 'Test Artist'
      };

      const mockAIResponse = 'Default template facts.';
      mockServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

      // Mock dataService to return null (template not found)
      mockServices.dataService.getValue.mockReturnValue( null );

      await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      // Should still work with the default fallback template
      expect( mockServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
        "The song I'm currently listening to is Test Song by Test Artist. Tell me three short interesting facts about the song and/or the artist. When searching note that it may or may not be a cover version. Do not tell me that you're giving me three facts as part of the reply"
      );
    } );
  } );

  describe( 'logging', () => {
    it( 'should log debug information about the song being queried', async () => {
      mockServices.machineLearningService.askGoogleAI.mockResolvedValue( 'Some facts' );

      await handlePopfactsCommand( {
        services: mockServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( mockServices.logger.debug ).toHaveBeenCalledWith(
        '[popfacts] Asking AI about: Bohemian Rhapsody by Queen'
      );
    } );
  } );
} );