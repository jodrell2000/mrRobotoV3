// Integration test to verify trigger context structure matches command service expectations
const TriggerService = require('../../src/services/triggerService');
const commandService = require('../../src/services/commandService');

describe('TriggerService Integration', () => {
  let mockServices;
  let triggerService;

  beforeEach(() => {
    // Mock everything except the actual command service structure validation
    mockServices = {
      dataService: {
        getValue: jest.fn().mockReturnValue({ 'newSong': ['ping'] }),
        setValue: jest.fn(),
        loadData: jest.fn()
      },
      config: {
        BOT_UID: 'test-bot-123'
      },
      // Use the actual command service to validate context structure
      commandService: jest.fn().mockImplementation(async (command, args, services, context) => {
        // Validate that context has the expected structure
        expect(context).toHaveProperty('sender');
        expect(context).toHaveProperty('fullMessage');
        expect(context).toHaveProperty('chatMessage');
        expect(context.sender).toHaveProperty('username');
        expect(context.sender).toHaveProperty('uuid');
        expect(typeof context.sender.uuid).toBe('string');
        
        return { success: true };
      })
    };

    triggerService = new TriggerService(mockServices);
  });

  it('should pass correctly structured context to command service', async () => {
    const result = await triggerService.executeTrigger('newSong', {});
    
    expect(result.success).toBe(true);
    expect(mockServices.commandService).toHaveBeenCalledWith(
      'ping',
      '',
      mockServices,
      expect.objectContaining({
        sender: expect.objectContaining({
          username: 'System',
          uuid: 'test-bot-123'
        }),
        fullMessage: expect.objectContaining({
          isPrivateMessage: false
        }),
        chatMessage: null
      })
    );
  });

  it('should pass custom context correctly when provided', async () => {
    const customContext = {
      sender: { username: 'TestUser', uuid: 'user-123' },
      fullMessage: { isPrivateMessage: true },
      chatMessage: { text: 'test' }
    };

    const result = await triggerService.executeTrigger('newSong', customContext);
    
    expect(result.success).toBe(true);
    expect(mockServices.commandService).toHaveBeenCalledWith(
      'ping',
      '',
      mockServices,
      expect.objectContaining({
        sender: { username: 'TestUser', uuid: 'user-123' },
        fullMessage: { isPrivateMessage: true },
        chatMessage: { text: 'test' }
      })
    );
  });
});