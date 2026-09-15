const userLeft = require( '../../src/handlers/userLeft' );
const { handleUserLeftEvent } = require( '../../src/handlers/userLeft' );

describe( 'userLeft handler', () => {
  let mockServices;
  let mockState;
  let mockMessage;

  beforeEach( () => {
    mockServices = {
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      stateService: {
        // Mock state service methods if needed
      },
      afkService: {
        removeUser: jest.fn()
      },
      bot: {
        removePrivateMessageTrackingForUser: jest.fn().mockResolvedValue()
      }
    };

    mockState = {
      allUserData: {
        'user-123': { userProfile: { nickname: 'TestUser' } }
      }
    };

    mockMessage = {
      statePatch: [
        {
          op: 'remove',
          path: '/allUserData/user-123'
        }
      ]
    };
  } );

  test( 'should remove private message tracking when user leaves', async () => {
    await userLeft( mockMessage, mockState, mockServices );

    // Verify bot method was called to remove tracking
    expect( mockServices.bot.removePrivateMessageTrackingForUser ).toHaveBeenCalledWith( 'user-123' );

    // Verify debug logs
    expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'userLeft.js handler called' );
    expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'User user-123 left the hangout' );
    expect( mockServices.logger.debug ).toHaveBeenCalledWith( '✅ Private message tracking removed for user who left: user-123' );
  } );

  test( 'should handle multiple patch operations and find the remove operation', async () => {
    const messageWithMultiplePatches = {
      statePatch: [
        {
          op: 'replace',
          path: '/someOtherData',
          value: 'new value'
        },
        {
          op: 'remove',
          path: '/allUserData/user-456'
        },
        {
          op: 'add',
          path: '/moreData',
          value: 'another value'
        }
      ]
    };

    await userLeft( messageWithMultiplePatches, mockState, mockServices );

    // Verify correct user UUID was extracted
    expect( mockServices.bot.removePrivateMessageTrackingForUser ).toHaveBeenCalledWith( 'user-456' );
    expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'User user-456 left the hangout' );
  } );

  test( 'should handle missing user UUID in patch path', async () => {
    const messageWithBadPath = {
      statePatch: [
        {
          op: 'remove',
          path: '/allUserData/' // Missing UUID
        }
      ]
    };

    await userLeft( messageWithBadPath, mockState, mockServices );

    // Verify warning was logged
    expect( mockServices.logger.warn ).toHaveBeenCalledWith( 'No user UUID found in remove patch path' );

    // Verify bot method was not called
    expect( mockServices.bot.removePrivateMessageTrackingForUser ).not.toHaveBeenCalled();
  } );

  test( 'should handle no remove patch found', async () => {
    const messageWithNoRemovePatch = {
      statePatch: [
        {
          op: 'add',
          path: '/allUserData/user-789',
          value: { userProfile: { nickname: 'NewUser' } }
        },
        {
          op: 'replace',
          path: '/someData',
          value: 'updated value'
        }
      ]
    };

    await userLeft( messageWithNoRemovePatch, mockState, mockServices );

    // Verify debug log for no remove patch
    expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'No user data remove patch found in userLeft message' );

    // Verify bot method was not called
    expect( mockServices.bot.removePrivateMessageTrackingForUser ).not.toHaveBeenCalled();
  } );

  test( 'should handle missing state', async () => {
    await userLeft( mockMessage, null, mockServices );

    // Verify early return debug log
    expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'State not available, skipping userLeft processing' );

    // Verify bot method was not called
    expect( mockServices.bot.removePrivateMessageTrackingForUser ).not.toHaveBeenCalled();
  } );

  test( 'should handle missing stateService', async () => {
    const servicesWithoutStateService = {
      ...mockServices,
      stateService: null
    };

    await userLeft( mockMessage, mockState, servicesWithoutStateService );

    // Verify early return debug log
    expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'State not available, skipping userLeft processing' );

    // Verify bot method was not called
    expect( mockServices.bot.removePrivateMessageTrackingForUser ).not.toHaveBeenCalled();
  } );

  test( 'should handle missing bot instance', async () => {
    const servicesWithoutBot = {
      ...mockServices,
      bot: null
    };

    await userLeft( mockMessage, mockState, servicesWithoutBot );

    // Verify debug log for missing bot
    expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'Bot instance not available for private message tracking removal' );
  } );

  test( 'should handle bot method not available', async () => {
    const servicesWithBadBot = {
      ...mockServices,
      bot: {
        // Missing removePrivateMessageTrackingForUser method
      }
    };

    await userLeft( mockMessage, mockState, servicesWithBadBot );

    // Verify debug log for missing bot method
    expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'Bot instance not available for private message tracking removal' );
  } );

  test( 'should handle errors in bot method gracefully', async () => {
    // Mock bot method to throw error
    mockServices.bot.removePrivateMessageTrackingForUser.mockRejectedValue( new Error( 'Bot error' ) );

    await userLeft( mockMessage, mockState, mockServices );

    // Verify error was caught and logged as warning
    expect( mockServices.logger.warn ).toHaveBeenCalledWith( 'Failed to remove private message tracking for user user-123: Bot error' );
  } );

  test( 'should handle general errors gracefully', async () => {
    // Create a message with a patch path that will cause an error during split
    const messageWithBadPath = {
      statePatch: [
        {
          op: 'remove',
          path: { invalid: 'object' } // This will cause an error when trying to split
        }
      ]
    };

    // Mock the logger to not interfere
    const originalDebug = mockServices.logger.debug;
    mockServices.logger.debug = jest.fn();

    await userLeft( messageWithBadPath, mockState, mockServices );

    // Restore the original debug function
    mockServices.logger.debug = originalDebug;

    // Verify error was caught and logged
    expect( mockServices.logger.error ).toHaveBeenCalledWith(
      expect.stringContaining( 'Error processing userLeft message:' )
    );
  } );

  test( 'should handle missing statePatch', async () => {
    const messageWithoutStatePatch = {};

    await userLeft( messageWithoutStatePatch, mockState, mockServices );

    // Should handle gracefully and log that no remove patch was found
    expect( mockServices.logger.debug ).toHaveBeenCalledWith( 'No user data remove patch found in userLeft message' );
  } );

  describe( 'afkService integration', () => {
    test( 'should call removeUser with the correct UUID when a user leaves', async () => {
      await userLeft( mockMessage, mockState, mockServices );
      expect( mockServices.afkService.removeUser ).toHaveBeenCalledWith( 'user-123' );
    } );

    test( 'should not call removeUser when no remove patch is found', async () => {
      const messageWithNoRemovePatch = {
        statePatch: [ { op: 'add', path: '/allUserData/user-789', value: {} } ]
      };
      await userLeft( messageWithNoRemovePatch, mockState, mockServices );
      expect( mockServices.afkService.removeUser ).not.toHaveBeenCalled();
    } );

    test( 'should not throw if afkService is absent', async () => {
      const servicesWithoutAfk = { ...mockServices, afkService: undefined };
      await expect( userLeft( mockMessage, mockState, servicesWithoutAfk ) ).resolves.not.toThrow();
    } );
  } );

  describe( 'Phase 5: Escort flag cleanup', () => {
    beforeEach( () => {
      mockServices.dataService = {
        getValue: jest.fn().mockReturnValue( {} ),
        setValue: jest.fn()
      };
    } );

    test( 'should clear escort flag when user disconnects from room', async () => {
      const escortQueue = {
        'user-123': {
          markedAt: Date.now() - 5000,
          removeAfterCurrent: true
        }
      };
      mockServices.dataService.getValue.mockReturnValue( escortQueue );

      await userLeft( mockMessage, mockState, mockServices );

      expect( mockServices.dataService.getValue ).toHaveBeenCalledWith( 'escortQueue' );
      expect( mockServices.dataService.setValue ).toHaveBeenCalledWith( 'escortQueue', {} );
      expect( mockServices.logger.debug ).toHaveBeenCalledWith(
        'userLeft handler: cleared escortme flag for user-123'
      );
    } );

    test( 'should not call setValue when user has no escort flag', async () => {
      const escortQueue = {
        'other-user': {
          markedAt: Date.now() - 5000,
          removeAfterCurrent: false
        }
      };
      mockServices.dataService.getValue.mockReturnValue( escortQueue );

      await userLeft( mockMessage, mockState, mockServices );

      expect( mockServices.dataService.getValue ).toHaveBeenCalled();
      expect( mockServices.dataService.setValue ).not.toHaveBeenCalled();
    } );

    test( 'should preserve other users flags when one user disconnects', async () => {
      const otherUserFlag = {
        markedAt: Date.now() - 10000,
        removeAfterCurrent: false
      };
      const escortQueue = {
        'user-123': {
          markedAt: Date.now() - 5000,
          removeAfterCurrent: true
        },
        'other-user': otherUserFlag
      };
      mockServices.dataService.getValue.mockReturnValue( escortQueue );

      await userLeft( mockMessage, mockState, mockServices );

      const setValueCall = mockServices.dataService.setValue.mock.calls[ 0 ][ 1 ];
      expect( setValueCall[ 'user-123' ] ).toBeUndefined();
      expect( setValueCall[ 'other-user' ] ).toEqual( otherUserFlag );
    } );

    test( 'should handle empty escortQueue gracefully', async () => {
      mockServices.dataService.getValue.mockReturnValue( {} );

      await userLeft( mockMessage, mockState, mockServices );

      expect( mockServices.dataService.getValue ).toHaveBeenCalled();
      expect( mockServices.dataService.setValue ).not.toHaveBeenCalled();
    } );

    test( 'should handle dataService.getValue returning null', async () => {
      mockServices.dataService.getValue.mockReturnValue( null );

      await userLeft( mockMessage, mockState, mockServices );

      expect( () => userLeft( mockMessage, mockState, mockServices ) ).not.toThrow();
      expect( mockServices.dataService.setValue ).not.toHaveBeenCalled();
    } );

    test( 'should log error if escort flag clearing fails', async () => {
      mockServices.dataService.getValue.mockImplementation( () => {
        throw new Error( 'dataService error' );
      } );

      await userLeft( mockMessage, mockState, mockServices );

      expect( mockServices.logger.error ).toHaveBeenCalledWith(
        expect.stringContaining( 'error clearing escort flag' ),
        expect.any( Error )
      );
    } );

    test( 'should not throw when dataService is absent', async () => {
      const servicesWithoutDataService = {
        ...mockServices,
        dataService: undefined
      };

      await expect( userLeft( mockMessage, mockState, servicesWithoutDataService ) ).resolves.not.toThrow();
    } );
  } );
} );

describe( 'handleUserLeftEvent (normalized handler)', () => {
    let services;

    beforeEach( () => {
        services = {
            logger: {
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            },
            stateService: {
                getState: jest.fn().mockReturnValue( { usersById: {} } )
            },
            afkService: {
                removeUser: jest.fn()
            },
            dataService: {
                getValue: jest.fn().mockReturnValue( {} ),
                setValue: jest.fn()
            },
            bot: {
                removePrivateMessageTrackingForUser: jest.fn().mockResolvedValue( undefined )
            }
        };
    } );

    test( 'should return early if no userId in payload', async () => {
        const event = { payload: {} };
        const context = { services };

        await handleUserLeftEvent( event, context );

        expect( services.logger.debug ).toHaveBeenCalledWith( 'handleUserLeftEvent: missing userId or services' );
    } );

    test( 'should return early if no services in context', async () => {
        const event = { payload: { userId: 'test-uuid' } };
        const context = {};

        await handleUserLeftEvent( event, context );
    } );

    test( 'should remove user from AFK monitor', async () => {
        const userId = 'test-user-id';
        const event = { payload: { userId } };
        const context = { services };

        await handleUserLeftEvent( event, context );

        expect( services.afkService.removeUser ).toHaveBeenCalledWith( userId );
        expect( services.logger.debug ).toHaveBeenCalledWith( `User ${ userId } left the room` );
    } );

    test( 'should clear escort flag when user leaves', async () => {
        const userId = 'test-user-id';
        services.dataService.getValue.mockReturnValue( { [ userId ]: true } );
        const event = { payload: { userId } };
        const context = { services };

        await handleUserLeftEvent( event, context );

        expect( services.dataService.getValue ).toHaveBeenCalledWith( 'escortQueue' );
        expect( services.dataService.setValue ).toHaveBeenCalledWith( 'escortQueue', {} );
        expect( services.logger.debug ).toHaveBeenCalledWith( `handleUserLeftEvent: cleared escortme flag for ${ userId }` );
    } );

    test( 'should handle escortQueue error gracefully', async () => {
        const userId = 'test-user-id';
        const error = new Error( 'Data service error' );
        services.dataService.getValue.mockImplementation( () => {
            throw error;
        } );
        const event = { payload: { userId } };
        const context = { services };

        await handleUserLeftEvent( event, context );

        expect( services.logger.error ).toHaveBeenCalledWith(
            `handleUserLeftEvent: error clearing escort flag for ${ userId }: ${ error.message }`
        );
    } );

    test( 'should remove private message tracking when user leaves', async () => {
        const userId = 'test-user-id';
        const event = { payload: { userId } };
        const context = { services };

        await handleUserLeftEvent( event, context );

        expect( services.bot.removePrivateMessageTrackingForUser ).toHaveBeenCalledWith( userId );
        expect( services.logger.debug ).toHaveBeenCalledWith( `✅ Private message tracking removed for user who left: ${ userId }` );
    } );

    test( 'should handle private message tracking error gracefully', async () => {
        const userId = 'test-user-id';
        const error = new Error( 'Private message tracking error' );
        services.bot.removePrivateMessageTrackingForUser.mockRejectedValue( error );
        const event = { payload: { userId } };
        const context = { services };

        await handleUserLeftEvent( event, context );

        expect( services.logger.warn ).toHaveBeenCalledWith(
            `handleUserLeftEvent: Failed to remove private message tracking for user ${ userId }: ${ error.message }`
        );
    } );

    test( 'should remove user from state usersById', async () => {
        const userId = 'test-user-id';
        const mockUser = { id: userId, nickname: 'TestUser' };
        services.stateService.getState.mockReturnValue( { usersById: { [ userId ]: mockUser } } );
        const event = { payload: { userId } };
        const context = { services };

        await handleUserLeftEvent( event, context );

        expect( services.logger.debug ).toHaveBeenCalledWith(
            `handleUserLeftEvent: Removed user ${ userId } from state.usersById`
        );
    } );

    test( 'should handle missing stateService gracefully', async () => {
        const servicesWithoutStateService = { ...services, stateService: undefined };
        const userId = 'test-user-id';
        const event = { payload: { userId } };
        const context = { services: servicesWithoutStateService };

        await handleUserLeftEvent( event, context );

        // Should not throw, just skip state update
        expect( servicesWithoutStateService.afkService.removeUser ).toHaveBeenCalledWith( userId );
    } );

    test( 'should handle missing afkService gracefully', async () => {
        const servicesWithoutAfk = { ...services, afkService: undefined };
        const userId = 'test-user-id';
        const event = { payload: { userId } };
        const context = { services: servicesWithoutAfk };

        await handleUserLeftEvent( event, context );

        // Should not throw
        expect( servicesWithoutAfk.dataService.getValue ).toHaveBeenCalled();
    } );

    test( 'should handle missing dataService gracefully', async () => {
        const servicesWithoutDataService = { ...services, dataService: undefined };
        const userId = 'test-user-id';
        const event = { payload: { userId } };
        const context = { services: servicesWithoutDataService };

        await handleUserLeftEvent( event, context );

        // Should not throw
        expect( servicesWithoutDataService.afkService.removeUser ).toHaveBeenCalledWith( userId );
    } );

    test( 'should handle missing bot gracefully', async () => {
        const servicesWithoutBot = { ...services, bot: undefined };
        const userId = 'test-user-id';
        const event = { payload: { userId } };
        const context = { services: servicesWithoutBot };

        await handleUserLeftEvent( event, context );

        expect( servicesWithoutBot.logger.debug ).toHaveBeenCalledWith(
            'handleUserLeftEvent: Bot instance not available for private message tracking removal'
        );
    } );

    test( 'should work with Wavez userLeft event structure', async () => {
        const event = {
            type: 'userLeft',
            payload: {
                userId: 'wavez-user-123',
                nickname: 'WavezUser'
            },
            source: 'wavezfm'
        };
        const context = { services };

        await handleUserLeftEvent( event, context );

        expect( services.afkService.removeUser ).toHaveBeenCalledWith( 'wavez-user-123' );
    } );

    test( 'should work with Hang userLeft event structure', async () => {
        const event = {
            type: 'userLeft',
            payload: {
                userId: 'hang-user-456'
            },
            source: 'hangfm'
        };
        const context = { services };

        await handleUserLeftEvent( event, context );

        expect( services.afkService.removeUser ).toHaveBeenCalledWith( 'hang-user-456' );
    } );

    test( 'should handle errors gracefully', async () => {
        const userId = 'test-user-id';
        const error = new Error( 'Test error' );
        services.afkService.removeUser.mockImplementation( () => {
            throw error;
        } );
        const event = { payload: { userId } };
        const context = { services };

        await handleUserLeftEvent( event, context );

        expect( services.logger.error ).toHaveBeenCalledWith(
            '[handleUserLeftEvent] Error: Test error'
        );
    } );
} );