// Tests specifically for private message tracking to prevent duplicate responses
const { Bot } = require('../../../src/lib/bot');

describe('Bot - Private Message Tracking', () => {
  let bot;
  let mockServices;

  beforeEach(() => {
    mockServices = {
      config: {
        BOT_UID: 'test-bot-uid-789',
        HANGOUT_ID: 'test-hangout'
      },
      logger: {
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      },
      setState: jest.fn(),
      getState: jest.fn(),
      updateLastMessageId: jest.fn(),
      stateService: {
        _getAllUsers: jest.fn()
      },
      privateMessageService: {
        fetchNewPrivateUserMessages: jest.fn()
      }
    };

    bot = new Bot('test-slug', mockServices);
    bot.lastMessageIDs = { id: null, fromTimestamp: 0 };
    bot.lastPrivateMessageTracking = {};
  });

  describe('_updateMessageTracking for private messages', () => {
    test('should update private message tracking correctly', () => {
      const privateMessage = {
        id: 'pm-123',
        sentAt: 1640995200, // Use seconds
        sender: 'user-456',
        isPrivateMessage: true
      };

      bot._updateMessageTracking(privateMessage);

      // Should update private message tracking
      expect(bot.lastPrivateMessageTracking['user-456']).toEqual({
        lastMessageId: 'pm-123',
        lastTimestamp: 1640995200 // Expect seconds
      });

      // Should persist to state
      expect(mockServices.setState).toHaveBeenCalledWith(
        'lastPrivateMessageTracking',
        bot.lastPrivateMessageTracking
      );

      // Should NOT update public message tracking
      expect(mockServices.updateLastMessageId).not.toHaveBeenCalled();
      expect(bot.lastMessageIDs.id).toBeNull();
    });

    test('should handle sender as object with uid property', () => {
      const privateMessage = {
        id: 'pm-124',
        sentAt: 1640995300,
        sender: { uid: 'user-789' },
        isPrivateMessage: true
      };

      bot._updateMessageTracking(privateMessage);

      expect(bot.lastPrivateMessageTracking['user-789']).toEqual({
        lastMessageId: 'pm-124',
        lastTimestamp: 1640995300
      });
    });

    test('should handle multiple users independently', () => {
      const message1 = {
        id: 'pm-1',
        sentAt: 1640995100,
        sender: 'user-1',
        isPrivateMessage: true
      };

      const message2 = {
        id: 'pm-2',
        sentAt: 1640995200,
        sender: 'user-2',
        isPrivateMessage: true
      };

      bot._updateMessageTracking(message1);
      bot._updateMessageTracking(message2);

      expect(bot.lastPrivateMessageTracking['user-1']).toEqual({
        lastMessageId: 'pm-1',
        lastTimestamp: 1640995100
      });

      expect(bot.lastPrivateMessageTracking['user-2']).toEqual({
        lastMessageId: 'pm-2',
        lastTimestamp: 1640995200
      });

      // Should have called setState twice
      expect(mockServices.setState).toHaveBeenCalledTimes(2);
    });

    test('should update existing user tracking', () => {
      // Set initial tracking
      bot.lastPrivateMessageTracking['user-1'] = {
        lastMessageId: 'pm-old',
        lastTimestamp: 1640995000
      };

      const newMessage = {
        id: 'pm-new',
        sentAt: 1640995500,
        sender: 'user-1',
        isPrivateMessage: true
      };

      bot._updateMessageTracking(newMessage);

      expect(bot.lastPrivateMessageTracking['user-1']).toEqual({
        lastMessageId: 'pm-new',
        lastTimestamp: 1640995500
      });
    });

    test('should handle empty/invalid sender gracefully', () => {
      const invalidMessage = {
        id: 'pm-invalid',
        sentAt: 1640995200,
        sender: '',
        isPrivateMessage: true
      };

      bot._updateMessageTracking(invalidMessage);

      // Should not add tracking for empty sender
      expect(Object.keys(bot.lastPrivateMessageTracking)).toHaveLength(0);
      expect(mockServices.setState).not.toHaveBeenCalled();
    });
  });

  describe('Private message duplicate prevention', () => {
    test('should not fetch already processed messages', async () => {
      const mockUsers = [{ uuid: 'user-1' }];
      const mockMessages = [
        { id: 'pm-1', text: 'Message 1', sender: 'user-1', sentAt: 1640995100 },
        { id: 'pm-2', text: 'Message 2', sender: 'user-1', sentAt: 1640995200 }
      ];

      // Set up initial state with last processed message
      bot.lastPrivateMessageTracking['user-1'] = {
        lastMessageId: 'pm-1',
        lastTimestamp: 1640995100
      };

      mockServices.stateService._getAllUsers.mockReturnValue(mockUsers);
      mockServices.privateMessageService.fetchNewPrivateUserMessages.mockResolvedValue(mockMessages);

      await bot._fetchNewPrivateMessages();

      // Should pass the tracking info to filter out old messages
      expect(mockServices.privateMessageService.fetchNewPrivateUserMessages).toHaveBeenCalledWith('user-1', {
        lastMessageId: 'pm-1',
        lastTimestamp: 1640995100,
        logLastMessage: false,
        returnData: true
      });
    });

    test('should process new messages and update tracking correctly', async () => {
      const mockUsers = [{ uuid: 'user-1' }];
      const newMessages = [
        { id: 'pm-new', text: 'New message', sender: 'user-1', sentAt: 1640995300 }
      ];

      bot.lastPrivateMessageTracking['user-1'] = {
        lastMessageId: 'pm-old',
        lastTimestamp: 1640995200
      };

      mockServices.stateService._getAllUsers.mockReturnValue(mockUsers);
      mockServices.privateMessageService.fetchNewPrivateUserMessages.mockResolvedValue(newMessages);

      const messages = await bot._fetchNewPrivateMessages();

      // Should return the new message
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('pm-new');
      expect(messages[0].isPrivateMessage).toBe(true);

      // Now simulate processing this message
      await bot._processSingleMessage(messages[0]);

      // Should update tracking with the new message
      expect(bot.lastPrivateMessageTracking['user-1']).toEqual({
        lastMessageId: 'pm-new',
        lastTimestamp: 1640995300
      });
    });

    test('should handle empty fetch results correctly', async () => {
      const mockUsers = [{ uuid: 'user-1' }];

      bot.lastPrivateMessageTracking['user-1'] = {
        lastMessageId: 'pm-latest',
        lastTimestamp: 1640995300
      };

      mockServices.stateService._getAllUsers.mockReturnValue(mockUsers);
      mockServices.privateMessageService.fetchNewPrivateUserMessages.mockResolvedValue([]);

      const messages = await bot._fetchNewPrivateMessages();

      // Should return empty array
      expect(messages).toHaveLength(0);

      // Tracking should remain unchanged
      expect(bot.lastPrivateMessageTracking['user-1']).toEqual({
        lastMessageId: 'pm-latest',
        lastTimestamp: 1640995300
      });
    });
  });

  describe('Integration test for complete private message flow', () => {
    test('should prevent duplicate processing in complete workflow', async () => {
      // Mock _extractChatMessage and _shouldIgnoreMessage
      bot._extractChatMessage = jest.fn().mockReturnValue('!test command');
      bot._shouldIgnoreMessage = jest.fn().mockReturnValue(false);
      bot._handleMessage = jest.fn();

      const mockUsers = [{ uuid: 'user-1' }];
      const mockMessage = {
        id: 'pm-123',
        text: '!test command',
        sender: 'user-1',
        sentAt: 1640995200
      };

      mockServices.stateService._getAllUsers.mockReturnValue(mockUsers);
      mockServices.privateMessageService.fetchNewPrivateUserMessages.mockResolvedValue([mockMessage]);

      // First fetch - should return the message
      const messages1 = await bot._fetchNewPrivateMessages();
      expect(messages1).toHaveLength(1);

      // Process the message (this should update tracking)
      await bot._processSingleMessage(messages1[0]);

      // Second fetch - should not return the same message again
      // Reset the mock to return the same message (as if API didn't filter properly)
      mockServices.privateMessageService.fetchNewPrivateUserMessages.mockResolvedValue([mockMessage]);
      
      const messages2 = await bot._fetchNewPrivateMessages();

      // The service should have been called with updated tracking parameters
      expect(mockServices.privateMessageService.fetchNewPrivateUserMessages).toHaveBeenLastCalledWith('user-1', {
        lastMessageId: 'pm-123',
        lastTimestamp: 1640995200,
        logLastMessage: false,
        returnData: true
      });
    });
  });

  describe('State persistence', () => {
    test('should persist tracking state on updates', () => {
      const message = {
        id: 'pm-persist',
        sentAt: 1640995200,
        sender: 'user-persist',
        isPrivateMessage: true
      };

      bot._updateMessageTracking(message);

      expect(mockServices.setState).toHaveBeenCalledWith(
        'lastPrivateMessageTracking',
        expect.objectContaining({
          'user-persist': {
            lastMessageId: 'pm-persist',
            lastTimestamp: 1640995200
          }
        })
      );
    });

    test('should handle setState errors gracefully', () => {
      mockServices.setState.mockImplementation(() => {
        throw new Error('State save failed');
      });

      const message = {
        id: 'pm-error',
        sentAt: 1640995200,
        sender: 'user-error',
        isPrivateMessage: true
      };

      // Should not throw
      expect(() => {
        bot._updateMessageTracking(message);
      }).not.toThrow();

      // Should log the error
      expect(mockServices.logger.error).toHaveBeenCalledWith(
        '❌ [_updateMessageTracking] Failed to persist private message tracking state for user user-error: State save failed'
      );

      // Tracking should still be updated locally
      expect(bot.lastPrivateMessageTracking['user-error']).toEqual({
        lastMessageId: 'pm-error',
        lastTimestamp: 1640995200
      });
    });

    test('should normalize timestamps correctly', () => {
      // Test with 10-digit timestamp (seconds) - like your example  
      const messageWithSeconds = {
        id: 'msg123',
        sentAt: 1759599330, // 10 digits (seconds) - your example
        sender: 'user1',
        isPrivateMessage: true
      };

      bot._updateMessageTracking(messageWithSeconds);

      // Should remain in seconds (no conversion)
      expect(bot.lastPrivateMessageTracking['user1']).toEqual({
        lastMessageId: 'msg123',
        lastTimestamp: 1759599330 // Should remain in seconds
      });

      // Test with another 10-digit timestamp
      const messageWithOtherSeconds = {
        id: 'msg124',
        sentAt: 1640995200, // 10 digits (seconds)
        sender: 'user2',
        isPrivateMessage: true
      };

      bot._updateMessageTracking(messageWithOtherSeconds);

      // Should remain in seconds
      expect(bot.lastPrivateMessageTracking['user2']).toEqual({
        lastMessageId: 'msg124',
        lastTimestamp: 1640995200 // Should remain in seconds
      });

      // Test with another seconds timestamp
      const messageWithMoreSeconds = {
        id: 'msg125',
        sentAt: 1640995210, // Another timestamp in seconds
        sender: 'user3',
        isPrivateMessage: true
      };

      bot._updateMessageTracking(messageWithMoreSeconds);

      // Should remain in seconds
      expect(bot.lastPrivateMessageTracking['user3']).toEqual({
        lastMessageId: 'msg125',
        lastTimestamp: 1640995210 // Should remain in seconds
      });
    });

    test('should normalize existing timestamps on initialization', () => {
      // Test the _normalizeTimestamp method directly - now just passes through seconds
      expect(bot._normalizeTimestamp(1759599330)).toBe(1759599330); // seconds remain seconds
      expect(bot._normalizeTimestamp(1640995200)).toBe(1640995200); // seconds remain seconds
      expect(bot._normalizeTimestamp(1640995210)).toBe(1640995210); // seconds remain seconds
      expect(bot._normalizeTimestamp(null)).toBe(null); // null unchanged
      expect(bot._normalizeTimestamp(undefined)).toBe(null); // undefined to null

      // Test that existing tracking data gets normalized when loaded
      const mockTrackingData = {
        'user1': { lastMessageId: 'msg1', lastTimestamp: 1759599330 }, // seconds
        'user2': { lastMessageId: 'msg2', lastTimestamp: 1640995200 }, // seconds
        'user3': { lastMessageId: 'msg3', lastTimestamp: 1640995210 }, // seconds
        'user4': { lastMessageId: 'msg4', lastTimestamp: null } // null
      };

      // Manually set the tracking data and trigger normalization
      bot.lastPrivateMessageTracking = mockTrackingData;
      
      // Simulate the normalization that happens during initialization
      for ( const [userUUID, tracking] of Object.entries( bot.lastPrivateMessageTracking ) ) {
        if ( tracking && tracking.lastTimestamp ) {
          const normalizedTimestamp = bot._normalizeTimestamp( tracking.lastTimestamp );
          if ( normalizedTimestamp !== tracking.lastTimestamp ) {
            tracking.lastTimestamp = normalizedTimestamp;
          }
        }
      }

      // Check that timestamps remain in seconds (no change expected now)
      expect(bot.lastPrivateMessageTracking['user1'].lastTimestamp).toBe(1759599330); // unchanged
      expect(bot.lastPrivateMessageTracking['user2'].lastTimestamp).toBe(1640995200); // unchanged
      expect(bot.lastPrivateMessageTracking['user3'].lastTimestamp).toBe(1640995210); // unchanged
      expect(bot.lastPrivateMessageTracking['user4'].lastTimestamp).toBe(null); // unchanged
    });
  });

  describe('User join timestamp initialization', () => {
    test('should set timestamp to current time when user joins with setTimestampToNow=true', async () => {
      const userUUID = 'new-user-uuid';
      
      // Mock Date.now to return a specific timestamp in milliseconds 
      const mockNowMs = 1759600000000; // milliseconds
      const mockNowSeconds = 1759600000; // seconds
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => mockNowMs);

      // Ensure the user is not already tracked
      expect(bot.lastPrivateMessageTracking[userUUID]).toBeUndefined();

      // Call the method with setTimestampToNow=true
      await bot._initializePrivateMessageTrackingForUser(userUUID, true);

      // Verify tracking was set with current timestamp
      expect(bot.lastPrivateMessageTracking[userUUID]).toEqual({
        lastMessageId: null,
        lastTimestamp: mockNowSeconds
      });

      // Verify setState was called to persist the change
      expect(mockServices.setState).toHaveBeenCalledWith('lastPrivateMessageTracking', bot.lastPrivateMessageTracking);

      // Verify debug log was called
      expect(mockServices.logger.debug).toHaveBeenCalledWith(
        `Set private message tracking for new user ${userUUID} to current time: ${mockNowSeconds}`
      );

      // Restore Date.now
      Date.now = originalDateNow;
    });

    test('should use existing tracking behavior when setTimestampToNow=false', async () => {
      const userUUID = 'existing-user-uuid';
      const mockTracking = {
        lastMessageId: 'last-msg-123',
        lastTimestamp: 1759599330
      };

      // Mock the private message service to return tracking data
      mockServices.privateMessageService = {
        returnLastUserMessageTracking: jest.fn().mockResolvedValue(mockTracking)
      };

      // Ensure the user is not already tracked
      expect(bot.lastPrivateMessageTracking[userUUID]).toBeUndefined();

      // Call the method with setTimestampToNow=false (default behavior)
      await bot._initializePrivateMessageTrackingForUser(userUUID, false);

      // Verify tracking was set with historical data
      expect(bot.lastPrivateMessageTracking[userUUID]).toEqual({
        lastMessageId: 'last-msg-123',
        lastTimestamp: 1759599330
      });

      // Verify the service method was called
      expect(mockServices.privateMessageService.returnLastUserMessageTracking).toHaveBeenCalledWith(userUUID);

      // Verify setState was called to persist the change
      expect(mockServices.setState).toHaveBeenCalledWith('lastPrivateMessageTracking', bot.lastPrivateMessageTracking);
    });

    test('should refresh all startup private tracking timestamps to startup baseline', async () => {
      const startupTimestamp = 1757462400;
      bot.lastPrivateMessageTracking = {
        'user-1': { lastMessageId: 'old-msg-1', lastTimestamp: 1111111111 }
      };
      mockServices.stateService = {
        _getAllUsers: jest.fn().mockReturnValue([
          { uuid: mockServices.config.BOT_UID },
          { uuid: 'user-1' },
          { uuid: 'user-2' }
        ])
      };

      await bot._initializePrivateMessageTrackingForAllUsers(startupTimestamp);

      expect(bot.lastPrivateMessageTracking).toEqual({
        'user-1': { lastMessageId: 'old-msg-1', lastTimestamp: startupTimestamp },
        'user-2': { lastMessageId: null, lastTimestamp: startupTimestamp }
      });
      expect(mockServices.setState).toHaveBeenCalledWith('lastPrivateMessageTracking', bot.lastPrivateMessageTracking);
    });

    test('should not re-initialize tracking for existing users', async () => {
      const userUUID = 'already-tracked-user';
      const existingTracking = {
        lastMessageId: 'existing-msg-456',
        lastTimestamp: 1759599000
      };

      // Set existing tracking
      bot.lastPrivateMessageTracking[userUUID] = existingTracking;

      // Call the method with setTimestampToNow=true
      await bot._initializePrivateMessageTrackingForUser(userUUID, true);

      // Verify tracking was not changed
      expect(bot.lastPrivateMessageTracking[userUUID]).toEqual(existingTracking);

      // Verify debug log for existing user
      expect(mockServices.logger.debug).toHaveBeenCalledWith(
        `Private message tracking already exists for user ${userUUID}: ${JSON.stringify(existingTracking)}`
      );
    });
  });

  describe('User leave tracking cleanup', () => {
    test('should remove private message tracking when user leaves', async () => {
      const userUUID = 'leaving-user-uuid';
      const existingTracking = {
        lastMessageId: 'msg-123',
        lastTimestamp: 1759599000
      };

      // Set up existing tracking
      bot.lastPrivateMessageTracking[userUUID] = existingTracking;

      // Verify tracking exists
      expect(bot.lastPrivateMessageTracking[userUUID]).toEqual(existingTracking);

      // Call the removal method
      await bot.removePrivateMessageTrackingForUser(userUUID);

      // Verify tracking was removed
      expect(bot.lastPrivateMessageTracking[userUUID]).toBeUndefined();

      // Verify setState was called to persist the change
      expect(mockServices.setState).toHaveBeenCalledWith('lastPrivateMessageTracking', bot.lastPrivateMessageTracking);

      // Verify debug log
      expect(mockServices.logger.debug).toHaveBeenCalledWith(
        `✅ Removed private message tracking for user: ${userUUID}`
      );
    });

    test('should handle removal when user has no tracking', async () => {
      const userUUID = 'non-tracked-user';

      // Ensure user has no tracking
      expect(bot.lastPrivateMessageTracking[userUUID]).toBeUndefined();

      // Call the removal method
      await bot.removePrivateMessageTrackingForUser(userUUID);

      // Verify tracking is still undefined
      expect(bot.lastPrivateMessageTracking[userUUID]).toBeUndefined();

      // Verify debug log for no tracking found
      expect(mockServices.logger.debug).toHaveBeenCalledWith(
        `No private message tracking found for user: ${userUUID}`
      );
    });

    test('should not remove tracking for bot user', async () => {
      const botUUID = 'test-bot-uid-789'; // This matches mockServices.config.BOT_UID
      const existingTracking = {
        lastMessageId: 'bot-msg-123',
        lastTimestamp: 1759599000
      };

      // Set up tracking for bot (this shouldn't happen in practice, but test the safety check)
      bot.lastPrivateMessageTracking[botUUID] = existingTracking;

      // Call the removal method
      await bot.removePrivateMessageTrackingForUser(botUUID);

      // Verify tracking was not removed (method should return early)
      expect(bot.lastPrivateMessageTracking[botUUID]).toEqual(existingTracking);
    });

    test('should handle setState errors gracefully during removal', async () => {
      const userUUID = 'error-test-user';
      const existingTracking = {
        lastMessageId: 'msg-456',
        lastTimestamp: 1759599000
      };

      // Set up existing tracking
      bot.lastPrivateMessageTracking[userUUID] = existingTracking;

      // Mock setState to throw an error
      mockServices.setState.mockImplementationOnce(() => {
        throw new Error('State save failed');
      });

      // Call the removal method
      await bot.removePrivateMessageTrackingForUser(userUUID);

      // Verify tracking was removed from memory even though setState failed
      expect(bot.lastPrivateMessageTracking[userUUID]).toBeUndefined();

      // Verify error was logged
      expect(mockServices.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error removing private message tracking for user')
      );
    });
  });
});