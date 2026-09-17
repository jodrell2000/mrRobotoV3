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
        getHangoutName: jest.fn().mockReturnValue( 'Test Hangout' ),
        getNowPlaying: jest.fn().mockReturnValue( {
          song: {
            trackName: 'Bohemian Rhapsody',
            artistName: 'Queen'
          }
        } ),
        getCurrentDj: jest.fn().mockReturnValue( { uuid: 'test-dj-uuid' } ),
        getUser: jest.fn().mockReturnValue( { uuid: 'test-dj-uuid', nickname: 'TestDJ' } )
      },
      hangUserService: {
        getUserNicknameByUuid: jest.fn().mockResolvedValue( 'TestDJ' )
      },
      tokenService: {
        replaceTokens: jest.fn().mockImplementation( async ( template, tokens ) => {
          let result = template;
          if ( tokens ) {
            Object.entries( tokens ).forEach( ( [ key, value ] ) => {
              result = result.replace( `{${ key }}`, value );
            } );
          }
          return result;
        } )
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
      const noSongServices = {
        ...mockServices,
        stateService: {
          ...mockServices.stateService,
          getNowPlaying: jest.fn().mockReturnValue( null )
        },
        hangoutState: { nowPlaying: null }
      };

      const result = await handlePopfactsCommand( {
        services: noSongServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.error ).toBe( 'No song currently playing' );

      expect( noSongServices.messageService.sendResponse ).toHaveBeenCalledWith(
        '🎵 No song is currently playing. Start a song first and try again!',
        expect.any( Object )
      );

      // AI should not be called
      expect( noSongServices.machineLearningService.askGoogleAI ).not.toHaveBeenCalled();
    } );

    it( 'should handle missing song object', async () => {
      const noSongServices = {
        ...mockServices,
        stateService: {
          ...mockServices.stateService,
          getNowPlaying: jest.fn().mockReturnValue( {} )
        },
        hangoutState: { nowPlaying: { song: null } }
      };

      const result = await handlePopfactsCommand( {
        services: noSongServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.error ).toBe( 'No song currently playing' );

      expect( noSongServices.messageService.sendResponse ).toHaveBeenCalledWith(
        '🎵 No song is currently playing. Start a song first and try again!',
        expect.any( Object )
      );
    } );

    it( 'should handle missing track name', async () => {
      const noTrackServices = {
        ...mockServices,
        stateService: {
          ...mockServices.stateService,
          getNowPlaying: jest.fn().mockReturnValue( {
            song: {
              trackName: null,
              artistName: 'Queen'
            }
          } )
        }
      };

      const result = await handlePopfactsCommand( {
        services: noTrackServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( result.success ).toBe( false );
      expect( result.error ).toBe( 'Missing song details' );

      expect( noTrackServices.messageService.sendResponse ).toHaveBeenCalledWith(
        '🎵 Unable to get song details. Please try again when a song is playing.',
        expect.any( Object )
      );
    } );

    it( 'should handle missing artist name', async () => {
      const noArtistServices = {
        ...mockServices,
        stateService: {
          ...mockServices.stateService,
          getNowPlaying: jest.fn().mockReturnValue( {
            song: {
              trackName: 'Bohemian Rhapsody',
              artistName: ''
            }
          } )
        }
      };

      const result = await handlePopfactsCommand( {
        services: noArtistServices,
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
      const noStateServices = {
        ...mockServices,
        stateService: {
          ...mockServices.stateService,
          getNowPlaying: jest.fn().mockReturnValue( null )
        },
        hangoutState: null
      };

      const result = await handlePopfactsCommand( {
        services: noStateServices,
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
      const differentSongServices = {
        ...mockServices,
        stateService: {
          ...mockServices.stateService,
          getNowPlaying: jest.fn().mockReturnValue( {
            song: {
              trackName: 'Imagine',
              artistName: 'John Lennon'
            }
          } )
        }
      };
      differentSongServices.hangoutState.nowPlaying.song = {
        trackName: 'Imagine',
        artistName: 'John Lennon'
      };

      const mockAIResponse = 'Some facts about Imagine.';
      differentSongServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

      // Mock the template from dataService
      const mockTemplate = 'The song I\'m currently listening to is {trackName} by {artistName}. Tell me three short interesting facts about the song and/or the artist. When searching note that it may or may not be a cover version. Do not tell me that you\'re giving me three facts as part of the reply';
      differentSongServices.dataService.getValue.mockReturnValue( mockTemplate );

      await handlePopfactsCommand( {
        services: differentSongServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      expect( differentSongServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
        "The song I'm currently listening to is Imagine by John Lennon. Tell me three short interesting facts about the song and/or the artist. When searching note that it may or may not be a cover version. Do not tell me that you're giving me three facts as part of the reply"
      );

      expect( differentSongServices.messageService.sendResponse ).toHaveBeenCalledWith(
        'Some facts about Imagine.',
        expect.any( Object )
      );
    } );

    it( 'should use default template when dataService returns null', async () => {
      const defaultTemplateServices = {
        ...mockServices,
        stateService: {
          ...mockServices.stateService,
          getNowPlaying: jest.fn().mockReturnValue( {
            song: {
              trackName: 'Test Song',
              artistName: 'Test Artist'
            }
          } )
        }
      };
      defaultTemplateServices.hangoutState.nowPlaying.song = {
        trackName: 'Test Song',
        artistName: 'Test Artist'
      };

      const mockAIResponse = 'Default template facts.';
      defaultTemplateServices.machineLearningService.askGoogleAI.mockResolvedValue( mockAIResponse );

      // Mock dataService to return null (template not found)
      defaultTemplateServices.dataService.getValue.mockReturnValue( null );

      await handlePopfactsCommand( {
        services: defaultTemplateServices,
        context: mockContext,
        responseChannel: 'public'
      } );

      // Should still work with the default fallback template
      expect( defaultTemplateServices.machineLearningService.askGoogleAI ).toHaveBeenCalledWith(
        "The song I'm currently listening to is Test Song by Test Artist. Tell me three short interesting facts about the song and/or the artist. When searching note that it may or may not be a cover version. Do not tell me that you're giving me three facts as part of the reply"
      );
    } );
  } );


} );