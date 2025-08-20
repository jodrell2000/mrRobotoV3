const { Bot } = require('../../../src/lib/bot.js');

describe('Bot - File Operations Integration', () => {
  let bot;
  let mockServices;
  
  // We'll use the real fs module but mock its behavior
  const originalFS = require('fs').promises;
  
  beforeEach(() => {
    mockServices = {
      config: {
        HANGOUT_ID: 'test-hangout-123',
        BOT_USER_TOKEN: 'test-bot-token-456',
        BOT_UID: 'test-bot-uid-789',
        SOCKET_MESSAGE_LOG_LEVEL: 'ON' // Default for existing tests
      },
      logger: {
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      },
      messageService: {
        joinChat: jest.fn(),
        fetchGroupMessages: jest.fn()
      },
      parseCommands: jest.fn(),
      commandService: jest.fn(),
      updateLastMessageId: jest.fn()
    };

    bot = new Bot('test-slug', mockServices);
  });

  describe('_writeSocketMessagesToLogFile with real fs module', () => {
    test('should handle file write errors', async () => {
      // Mock fs.appendFile to throw an error
      const fs = require('fs').promises;
      const originalAppendFile = fs.appendFile;
      
      const testError = new Error('Permission denied');
      fs.appendFile = jest.fn().mockRejectedValue(testError);
      
      await bot._writeSocketMessagesToLogFile('test.log', { test: 'data' });
      
      // Check that error was logged
      expect(mockServices.logger.error).toHaveBeenCalledWith(
        `Failed to write to log file test.log: ${testError.message}`
      );
      
      // Restore original method
      fs.appendFile = originalAppendFile;
    });

    test('should successfully write to file', async () => {
      // Mock fs.appendFile to succeed
      const fs = require('fs').promises;
      const originalAppendFile = fs.appendFile;
      
      fs.appendFile = jest.fn().mockResolvedValue();
      
      await bot._writeSocketMessagesToLogFile('success.log', { success: true });
      
      // Should not log any errors
      expect(mockServices.logger.error).not.toHaveBeenCalled();
      
      // Should have called appendFile
      expect(fs.appendFile).toHaveBeenCalled();
      
      // Restore original method
      fs.appendFile = originalAppendFile;
    });
  });

  describe('_writeSocketMessagesToLogFile log levels', () => {
    let fs;
    let originalAppendFile;

    beforeEach(() => {
      fs = require('fs').promises;
      originalAppendFile = fs.appendFile;
      fs.appendFile = jest.fn().mockResolvedValue();
    });

    afterEach(() => {
      fs.appendFile = originalAppendFile;
    });

    test('should not log anything when SOCKET_MESSAGE_LOG_LEVEL is OFF', async () => {
      mockServices.config.SOCKET_MESSAGE_LOG_LEVEL = 'OFF';
      bot = new Bot('test-slug', mockServices);

      await bot._writeSocketMessagesToLogFile('test.log', { test: 'data' });

      expect(fs.appendFile).not.toHaveBeenCalled();
      expect(mockServices.logger.error).not.toHaveBeenCalled();
    });

    test('should log to original filename when SOCKET_MESSAGE_LOG_LEVEL is ON', async () => {
      mockServices.config.SOCKET_MESSAGE_LOG_LEVEL = 'ON';
      bot = new Bot('test-slug', mockServices);

      await bot._writeSocketMessagesToLogFile('test.log', { test: 'data' });

      expect(fs.appendFile).toHaveBeenCalledTimes(1);
      const [[filePath, content]] = fs.appendFile.mock.calls;
      expect(filePath).toMatch(/test\.log$/);
      expect(content).toContain('"test": "data"');
    });

    test('should log to numbered files when SOCKET_MESSAGE_LOG_LEVEL is DEBUG', async () => {
      mockServices.config.SOCKET_MESSAGE_LOG_LEVEL = 'DEBUG';
      bot = new Bot('test-slug', mockServices);

      // First message
      await bot._writeSocketMessagesToLogFile('test.log', { message: 1 });
      
      // Second message
      await bot._writeSocketMessagesToLogFile('test.log', { message: 2 });
      
      // Third message with different base name
      await bot._writeSocketMessagesToLogFile('other.log', { message: 3 });

      expect(fs.appendFile).toHaveBeenCalledTimes(3);
      
      const calls = fs.appendFile.mock.calls;
      
      // Check first call - padded counter at start
      expect(calls[0][0]).toMatch(/000001_test\.log$/);
      expect(calls[0][1]).toContain('"message": 1');
      
      // Check second call - padded counter at start
      expect(calls[1][0]).toMatch(/000002_test\.log$/);
      expect(calls[1][1]).toContain('"message": 2');
      
      // Check third call - padded counter at start
      expect(calls[2][0]).toMatch(/000003_other\.log$/);
      expect(calls[2][1]).toContain('"message": 3');
    });

    test('should increment counter across different filenames in DEBUG mode', async () => {
      mockServices.config.SOCKET_MESSAGE_LOG_LEVEL = 'DEBUG';
      bot = new Bot('test-slug', mockServices);

      await bot._writeSocketMessagesToLogFile('stateful.log', { type: 'stateful' });
      await bot._writeSocketMessagesToLogFile('stateless.log', { type: 'stateless' });
      await bot._writeSocketMessagesToLogFile('server.log', { type: 'server' });

      expect(fs.appendFile).toHaveBeenCalledTimes(3);
      
      const calls = fs.appendFile.mock.calls;
      expect(calls[0][0]).toMatch(/000001_stateful\.log$/);
      expect(calls[1][0]).toMatch(/000002_stateless\.log$/);
      expect(calls[2][0]).toMatch(/000003_server\.log$/);
    });

    test('should handle filenames without .log extension in DEBUG mode', async () => {
      mockServices.config.SOCKET_MESSAGE_LOG_LEVEL = 'DEBUG';
      bot = new Bot('test-slug', mockServices);

      await bot._writeSocketMessagesToLogFile('noextension', { test: 'data' });

      expect(fs.appendFile).toHaveBeenCalledTimes(1);
      const [[filePath]] = fs.appendFile.mock.calls;
      expect(filePath).toMatch(/000001_noextension\.log$/);
    });

    test('should include timestamp and JSON formatting', async () => {
      mockServices.config.SOCKET_MESSAGE_LOG_LEVEL = 'ON';
      bot = new Bot('test-slug', mockServices);

      const testData = { test: 'data', nested: { value: 123 } };
      await bot._writeSocketMessagesToLogFile('test.log', testData);

      expect(fs.appendFile).toHaveBeenCalledTimes(1);
      const [[, content]] = fs.appendFile.mock.calls;
      
      // Should contain timestamp
      expect(content).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z:/);
      
      // Should contain formatted JSON
      expect(content).toContain('"test": "data"');
      expect(content).toContain('"nested": {\n    "value": 123\n  }');
      
      // Should end with newline
      expect(content).toMatch(/\n$/);
    });
  });
});
