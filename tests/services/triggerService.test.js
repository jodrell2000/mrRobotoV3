const TriggerService = require('../../src/services/triggerService');

describe('TriggerService', () => {
  let triggerService;
  let mockServices;

  beforeEach(() => {
    mockServices = {
      dataService: {
        loadData: jest.fn(),
        getValue: jest.fn(),
        setValue: jest.fn()
      },
      commandService: jest.fn(),
      config: {
        BOT_UID: 'test-bot-123'
      }
    };

    triggerService = new TriggerService(mockServices);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with services', () => {
      expect(triggerService.services).toBe(mockServices);
      expect(triggerService.logger).toBeDefined();
    });
  });

  describe('getAvailableTriggers', () => {
    it('should return all available trigger types', () => {
      const triggers = triggerService.getAvailableTriggers();
      
      expect(triggers).toEqual({
        'newSong': 'Fires when a new song starts playing',
        'userJoined': 'Fires when a user joins the hangout',
        'userLeft': 'Fires when a user leaves the hangout',
        'djAdded': 'Fires when a DJ is added to the booth',
        'djRemoved': 'Fires when a DJ is removed from the booth'
      });
    });
  });

  describe('getAllTriggers', () => {
    it('should return configured triggers from dataService', () => {
      const mockTriggers = {
        'newSong': ['intro', 'echo welcome!'],
        'userJoined': ['help']
      };
      mockServices.dataService.getValue.mockReturnValue(mockTriggers);

      const result = triggerService.getAllTriggers();

      expect(mockServices.dataService.getValue).toHaveBeenCalledWith('triggers');
      expect(result).toEqual(mockTriggers);
    });

    it('should return empty object when no triggers configured', () => {
      mockServices.dataService.getValue.mockReturnValue(null);

      const result = triggerService.getAllTriggers();

      expect(result).toEqual({});
    });
  });

  describe('getTriggerCommands', () => {
    it('should return commands for specific trigger', () => {
      const mockTriggers = {
        'newSong': ['intro', 'echo welcome!'],
        'userJoined': ['help']
      };
      mockServices.dataService.getValue.mockReturnValue(mockTriggers);

      const result = triggerService.getTriggerCommands('newSong');

      expect(result).toEqual(['intro', 'echo welcome!']);
    });

    it('should return empty array for non-existent trigger', () => {
      mockServices.dataService.getValue.mockReturnValue({});

      const result = triggerService.getTriggerCommands('nonExistent');

      expect(result).toEqual([]);
    });
  });

  describe('executeTrigger', () => {
    it('should execute all commands for a trigger successfully', async () => {
      const mockTriggers = {
        'newSong': ['intro', 'ping']
      };
      mockServices.dataService.getValue.mockReturnValue(mockTriggers);
      mockServices.commandService
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });

      const triggerContext = {
        eventData: { songInfo: { trackName: 'Test Song' } }
      };

      const result = await triggerService.executeTrigger('newSong', triggerContext);

      expect(result.success).toBe(true);
      expect(result.executed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);

      expect(mockServices.commandService).toHaveBeenCalledTimes(2);
      expect(mockServices.commandService).toHaveBeenCalledWith(
        'intro', '', mockServices, expect.objectContaining({
          sender: { username: 'System', uuid: 'test-bot-123' },
          fullMessage: { isPrivateMessage: false },
          chatMessage: null
        })
      );
    });

    it('should handle command failures gracefully', async () => {
      const mockTriggers = {
        'newSong': ['intro', 'badcommand']
      };
      mockServices.dataService.getValue.mockReturnValue(mockTriggers);
      mockServices.commandService
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Command failed'));

      const result = await triggerService.executeTrigger('newSong', {});

      expect(result.success).toBe(true);
      expect(result.executed).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBe('Command failed');
    });

    it('should return success true for non-existent trigger with 0 executed', async () => {
      mockServices.dataService.getValue.mockReturnValue({});

      const result = await triggerService.executeTrigger('nonExistent', {});

      expect(result.success).toBe(true);
      expect(result.executed).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('should use provided context when executing triggers', async () => {
      const mockTriggers = {
        'newSong': ['intro']
      };
      mockServices.dataService.getValue.mockReturnValue(mockTriggers);
      mockServices.commandService.mockResolvedValue({ success: true });

      const customContext = {
        sender: { username: 'TestDJ', uuid: 'test-dj-123' },
        fullMessage: { isPrivateMessage: true },
        chatMessage: { text: 'test message' }
      };

      await triggerService.executeTrigger('newSong', customContext);

      expect(mockServices.commandService).toHaveBeenCalledWith(
        'intro', '', mockServices, expect.objectContaining({
          sender: { username: 'TestDJ', uuid: 'test-dj-123' },
          fullMessage: { isPrivateMessage: true },
          chatMessage: { text: 'test message' }
        })
      );
    });

    it('should create default system context when no context provided', async () => {
      const mockTriggers = {
        'newSong': ['intro']
      };
      mockServices.dataService.getValue.mockReturnValue(mockTriggers);
      mockServices.commandService.mockResolvedValue({ success: true });

      await triggerService.executeTrigger('newSong', {});

      expect(mockServices.commandService).toHaveBeenCalledWith(
        'intro', '', mockServices, expect.objectContaining({
          sender: { username: 'System', uuid: 'test-bot-123' },
          fullMessage: { isPrivateMessage: false },
          chatMessage: null
        })
      );
    });

    it('should handle empty command list', async () => {
      const mockTriggers = {
        'newSong': []
      };
      mockServices.dataService.getValue.mockReturnValue(mockTriggers);

      const result = await triggerService.executeTrigger('newSong', {});

      expect(result.success).toBe(true);
      expect(result.executed).toBe(0);
      expect(result.results).toEqual([]);
    });
  });

  describe('addTriggerCommand', () => {
    it('should add command to existing trigger', async () => {
      const mockTriggers = {
        'newSong': ['intro']
      };
      mockServices.dataService.getValue.mockReturnValue(mockTriggers);
      mockServices.dataService.setValue.mockResolvedValue();

      const result = await triggerService.addTriggerCommand('newSong', 'ping');

      expect(result.success).toBe(true);
      expect(result.currentCommands).toEqual(['intro', 'ping']);
      expect(mockServices.dataService.loadData).toHaveBeenCalled();
      expect(mockServices.dataService.setValue).toHaveBeenCalledWith('triggers', {
        'newSong': ['intro', 'ping']
      });
    });

    it('should create new trigger when it does not exist', async () => {
      mockServices.dataService.getValue.mockReturnValue({});
      mockServices.dataService.setValue.mockResolvedValue();

      const result = await triggerService.addTriggerCommand('newSong', 'intro');

      expect(result.success).toBe(true);
      expect(result.currentCommands).toEqual(['intro']);
      expect(mockServices.dataService.setValue).toHaveBeenCalledWith('triggers', {
        'newSong': ['intro']
      });
    });

    it('should not add duplicate commands', async () => {
      const mockTriggers = {
        'newSong': ['intro', 'ping']
      };
      mockServices.dataService.getValue.mockReturnValue(mockTriggers);

      const result = await triggerService.addTriggerCommand('newSong', 'intro');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command "intro" is already configured for trigger "newSong"');
    });

    it('should return error for invalid trigger name', async () => {
      const result = await triggerService.addTriggerCommand('invalidTrigger', 'ping');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid trigger name: invalidTrigger');
    });
  });

  describe('removeTriggerCommand', () => {
    it('should remove command from trigger', async () => {
      const mockTriggers = {
        'newSong': ['intro', 'ping']
      };
      mockServices.dataService.getValue.mockReturnValue(mockTriggers);
      mockServices.dataService.setValue.mockResolvedValue();

      const result = await triggerService.removeTriggerCommand('newSong', 'ping');

      expect(result.success).toBe(true);
      expect(result.currentCommands).toEqual(['intro']);
      expect(mockServices.dataService.setValue).toHaveBeenCalledWith('triggers', {
        'newSong': ['intro']
      });
    });

    it('should return error when command not found', async () => {
      const mockTriggers = {
        'newSong': ['intro']
      };
      mockServices.dataService.getValue.mockReturnValue(mockTriggers);

      const result = await triggerService.removeTriggerCommand('newSong', 'ping');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command "ping" is not configured for trigger "newSong"');
    });

    it('should return error when trigger does not exist', async () => {
      mockServices.dataService.getValue.mockReturnValue({});

      const result = await triggerService.removeTriggerCommand('newSong', 'ping');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No commands configured for trigger "newSong"');
    });
  });

  describe('clearTrigger', () => {
    it('should clear all commands from trigger', async () => {
      const mockTriggers = {
        'newSong': ['intro', 'ping'],
        'userJoined': ['help']
      };
      mockServices.dataService.getValue.mockReturnValue(mockTriggers);
      mockServices.dataService.setValue.mockResolvedValue();

      const result = await triggerService.clearTrigger('newSong');

      expect(result.success).toBe(true);
      expect(mockServices.dataService.setValue).toHaveBeenCalledWith('triggers', {
        'userJoined': ['help']
      });
    });

    it('should return error for non-existent trigger', async () => {
      mockServices.dataService.getValue.mockReturnValue({});

      const result = await triggerService.clearTrigger('newSong');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No commands configured for trigger "newSong"');
    });
  });

  describe('metadata', () => {
    it('should have correct metadata properties', () => {
      // Since TriggerService is not a command, it doesn't have metadata
      // But we can test that it's properly constructed
      expect(triggerService).toBeInstanceOf(TriggerService);
      expect(typeof triggerService.executeTrigger).toBe('function');
      expect(typeof triggerService.addTriggerCommand).toBe('function');
    });
  });
});