// Mock config module to avoid environment dependencies
jest.mock('../../src/config.js', () => ({
  COMMAND_SWITCH: '!',
  COMETCHAT_API_KEY: 'test-api-key',
  COMETCHAT_AUTH_TOKEN: 'test-auth-token',
  LOG_LEVEL: 'INFO',
  SOCKET_MESSAGE_LOG_LEVEL: 'OFF',
  BOT_UID: 'test-bot-uid',
  HANGOUT_ID: 'test-hangout-id',
  BOT_USER_TOKEN: 'test-bot-token',
  CHAT_AVATAR_ID: 'test-avatar',
  CHAT_NAME: 'TestBot',
  CHAT_COLOUR: 'ff0000',
  COMETCHAT_RECEIVER_UID: 'test-receiver-uid',
  TTFM_GATEWAY_BASE_URL: 'http://test.example.com'
}));

// Mock logging module to prevent file system operations
jest.mock('../../src/lib/logging.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn()
  }
}));

jest.mock('fs');

const fs = require('fs');
const path = require('path');
const handleDynamicCommand = require('../../src/commands/handleDynamicCommand');

describe('handleDynamicCommand', () => {
  let mockServices;
  let mockContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock services
    mockServices = {
      messageService: {
        sendResponse: jest.fn().mockResolvedValue(),
        sendGroupPictureMessage: jest.fn().mockResolvedValue(),
        formatMention: jest.fn((uuid) => `<@uid:${uuid}>`)
      },
      tokenService: {
        replaceTokens: jest.fn((message, context) => {
          // Simple token replacement for testing
          return message
            .replace('{senderUsername}', '<@uid:sender-123>')
            .replace('{djUsername}', '<@uid:dj-456>');
        })
      }
    };

    // Mock context
    mockContext = {
      sender: 'sender-123',
      fullMessage: { isPrivateMessage: false }
    };
  });



  describe('metadata', () => {
    it('should have correct metadata properties', () => {
      expect(handleDynamicCommand.requiredRole).toBe('USER');
      expect(handleDynamicCommand.description).toBe('Execute dynamic command from chat.json');
      expect(handleDynamicCommand.example).toBe('props');
      expect(handleDynamicCommand.hidden).toBe(true);
    });
  });

  describe('command execution', () => {
    it('should send a random message with token replacement', async () => {
      // Mock fs.readFileSync to return valid chat.json data
      fs.readFileSync.mockReturnValue(JSON.stringify({
        props: {
          messages: [
            "nice one {djUsername}, {senderUsername} thinks that's an absolute banger",
            "props to {djUsername} from {senderUsername}!",
            "{senderUsername} is loving this track by {djUsername}"
          ],
          pictures: []
        }
      }));

      const result = await handleDynamicCommand('props', '', mockServices, mockContext);

      expect(result.success).toBe(true);
      expect(result.shouldRespond).toBe(true);
      expect(mockServices.tokenService.replaceTokens).toHaveBeenCalledWith(
        expect.any(String),
        mockContext
      );
      expect(mockServices.messageService.sendResponse).toHaveBeenCalledWith(
        expect.stringContaining('<@uid:'),
        expect.objectContaining({
          responseChannel: 'publicChat',
          isPrivateMessage: false,
          sender: 'sender-123',
          services: mockServices
        })
      );
    });

    it('should handle missing chat.json file', async () => {
      fs.readFileSync.mockImplementation(() => {
        const error = new Error('File not found');
        error.code = 'ENOENT';
        throw error;
      });

      const result = await handleDynamicCommand('missing', '', mockServices, mockContext);

      expect(result.success).toBe(false);
      expect(result.shouldRespond).toBe(true);
      expect(result.response).toBe('Command not found');
    });

    it('should handle invalid JSON in chat.json', async () => {
      fs.readFileSync.mockReturnValue('invalid json');

      const result = await handleDynamicCommand('props', '', mockServices, mockContext);

      expect(result.success).toBe(false);
      expect(result.shouldRespond).toBe(true);
      expect(result.response).toBe('Error loading command data');
    });

    it('should handle command not found in chat.json', async () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({
        otherCommand: {
          messages: ["test message"]
        }
      }));

      const result = await handleDynamicCommand('missing', '', mockServices, mockContext);

      expect(result.success).toBe(false);
      expect(result.shouldRespond).toBe(true);
      expect(result.response).toBe('Command not found');
    });

    it('should handle empty messages array', async () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({
        props: {
          messages: [],
          pictures: []
        }
      }));

      const result = await handleDynamicCommand('props', '', mockServices, mockContext);

      expect(result.success).toBe(false);
      expect(result.shouldRespond).toBe(true);
      expect(result.response).toBe('No messages available for this command');
    });

    it('should handle service errors gracefully', async () => {
      // Mock fs.readFileSync to return valid chat.json data
      fs.readFileSync.mockReturnValue(JSON.stringify({
        props: {
          messages: ["test message"],
          pictures: []
        }
      }));

      mockServices.messageService.sendResponse.mockRejectedValue(new Error('Network error'));

      const result = await handleDynamicCommand('props', '', mockServices, mockContext);

      expect(result.success).toBe(false);
      expect(result.shouldRespond).toBe(true);
      expect(result.error).toBe('Network error');
    });

    it('should select from available messages randomly', async () => {
      const singleMessageData = {
        props: {
          messages: ["single test message {djUsername}"],
          pictures: []
        }
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(singleMessageData));

      const result = await handleDynamicCommand('props', '', mockServices, mockContext);

      expect(result.success).toBe(true);
      expect(mockServices.tokenService.replaceTokens).toHaveBeenCalledWith(
        'single test message {djUsername}',
        mockContext
      );
    });

    it('should use publicChat as response channel when no pictures', async () => {
      // Mock fs.readFileSync to return valid chat.json data without pictures
      fs.readFileSync.mockReturnValue(JSON.stringify({
        props: {
          messages: ["test message"],
          pictures: []
        }
      }));

      await handleDynamicCommand('props', '', mockServices, mockContext);

      expect(mockServices.messageService.sendResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          responseChannel: 'publicChat'
        })
      );
    });

    it('should send picture message when pictures are available', async () => {
      // Mock fs.readFileSync to return valid chat.json data with pictures
      fs.readFileSync.mockReturnValue(JSON.stringify({
        props: {
          messages: ["test message"],
          pictures: ["https://example.com/image.gif", "https://example.com/image2.gif"]
        }
      }));

      await handleDynamicCommand('props', '', mockServices, mockContext);

      expect(mockServices.messageService.sendGroupPictureMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('https://'),
        mockServices
      );
    });

    it('should filter out null values from pictures array', async () => {
      // Mock fs.readFileSync to return chat.json with null in pictures array
      fs.readFileSync.mockReturnValue(JSON.stringify({
        props: {
          messages: ["test message"],
          pictures: ["https://example.com/image.gif", null, "https://example.com/image2.gif"]
        }
      }));

      await handleDynamicCommand('props', '', mockServices, mockContext);

      // Should still send picture message, ignoring the null
      expect(mockServices.messageService.sendGroupPictureMessage).toHaveBeenCalled();
      const callArgs = mockServices.messageService.sendGroupPictureMessage.mock.calls[0];
      expect(callArgs[1]).not.toBeNull();
    });
  });
});