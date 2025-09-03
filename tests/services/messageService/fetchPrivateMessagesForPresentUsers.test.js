jest.mock('../../../src/lib/logging.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../src/config.js', () => ({
  BOT_UID: 'bot-uuid-123'
}));

const { messageService } = require('../../../src/services/messageService.js');
const { logger } = require('../../../src/lib/logging.js');

describe('messageService.fetchPrivateMessagesForPresentUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches messages from all present users except the bot', async () => {
    const mockHangUserService = {
      getAllPresentUsers: jest.fn().mockReturnValue(['user-1', 'user-2', 'bot-uuid-123', 'user-3'])
    };
    
    const mockServices = { 
      hangoutState: {},
      hangUserService: mockHangUserService
    };
    
    // Mock fetchAllPrivateUserMessages for each user
    const originalFetch = messageService.fetchAllPrivateUserMessages;
    messageService.fetchAllPrivateUserMessages = jest.fn()
      .mockResolvedValueOnce([
        { id: '1', message: 'message from user-1', sender: 'user-1' }
      ])
      .mockResolvedValueOnce([
        { id: '2', message: 'message from user-2', sender: 'user-2' }
      ])
      .mockResolvedValueOnce([
        { id: '3', message: 'message from user-3', sender: 'user-3' }
      ]);

    const result = await messageService.fetchPrivateMessagesForPresentUsers(mockServices);

    expect(mockHangUserService.getAllPresentUsers).toHaveBeenCalledWith(mockServices);
    expect(messageService.fetchAllPrivateUserMessages).toHaveBeenCalledTimes(3);
    expect(messageService.fetchAllPrivateUserMessages).toHaveBeenCalledWith('user-1');
    expect(messageService.fetchAllPrivateUserMessages).toHaveBeenCalledWith('user-2');
    expect(messageService.fetchAllPrivateUserMessages).toHaveBeenCalledWith('user-3');
    expect(messageService.fetchAllPrivateUserMessages).not.toHaveBeenCalledWith('bot-uuid-123');

    expect(result).toEqual([
      { id: '1', message: 'message from user-1', sender: 'user-1', userUUID: 'user-1' },
      { id: '2', message: 'message from user-2', sender: 'user-2', userUUID: 'user-2' },
      { id: '3', message: 'message from user-3', sender: 'user-3', userUUID: 'user-3' }
    ]);

    // Restore original function
    messageService.fetchAllPrivateUserMessages = originalFetch;
  });

  test('returns empty array when no users are present', async () => {
    const mockHangUserService = {
      getAllPresentUsers: jest.fn().mockReturnValue([])
    };
    
    const mockServices = { 
      hangoutState: {},
      hangUserService: mockHangUserService
    };

    const result = await messageService.fetchPrivateMessagesForPresentUsers(mockServices);

    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith('fetchPrivateMessagesForPresentUsers: No users found in hangout');
  });

  test('returns empty array when only bot is present', async () => {
    const mockHangUserService = {
      getAllPresentUsers: jest.fn().mockReturnValue(['bot-uuid-123'])
    };
    
    const mockServices = { 
      hangoutState: {},
      hangUserService: mockHangUserService
    };

    const result = await messageService.fetchPrivateMessagesForPresentUsers(mockServices);

    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith('fetchPrivateMessagesForPresentUsers: No other users found (only bot in hangout)');
  });

  test('handles null/undefined response from hangUserService', async () => {
    const mockHangUserService = {
      getAllPresentUsers: jest.fn().mockReturnValue(null)
    };
    
    const mockServices = { 
      hangoutState: {},
      hangUserService: mockHangUserService
    };

    const result = await messageService.fetchPrivateMessagesForPresentUsers(mockServices);

    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith('fetchPrivateMessagesForPresentUsers: No users found in hangout');
  });

  test('continues processing other users when one user fetch fails', async () => {
    const mockHangUserService = {
      getAllPresentUsers: jest.fn().mockReturnValue(['user-1', 'user-2', 'user-3'])
    };
    
    const mockServices = { 
      hangoutState: {},
      hangUserService: mockHangUserService
    };
    
    // Mock fetchAllPrivateUserMessages with one failure
    const originalFetch = messageService.fetchAllPrivateUserMessages;
    messageService.fetchAllPrivateUserMessages = jest.fn()
      .mockResolvedValueOnce([
        { id: '1', message: 'message from user-1', sender: 'user-1' }
      ])
      .mockRejectedValueOnce(new Error('Network error for user-2'))
      .mockResolvedValueOnce([
        { id: '3', message: 'message from user-3', sender: 'user-3' }
      ]);

    const result = await messageService.fetchPrivateMessagesForPresentUsers(mockServices);

    expect(result).toEqual([
      { id: '1', message: 'message from user-1', sender: 'user-1', userUUID: 'user-1' },
      { id: '3', message: 'message from user-3', sender: 'user-3', userUUID: 'user-3' }
    ]);

    expect(logger.error).toHaveBeenCalledWith(
      'fetchPrivateMessagesForPresentUsers: Error fetching messages for user user-2: Network error for user-2'
    );

    // Restore original function
    messageService.fetchAllPrivateUserMessages = originalFetch;
  });

  test('handles users with no messages', async () => {
    const mockHangUserService = {
      getAllPresentUsers: jest.fn().mockReturnValue(['user-1', 'user-2'])
    };
    
    const mockServices = { 
      hangoutState: {},
      hangUserService: mockHangUserService
    };
    
    // Mock fetchAllPrivateUserMessages with empty arrays
    const originalFetch = messageService.fetchAllPrivateUserMessages;
    messageService.fetchAllPrivateUserMessages = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: '2', message: 'message from user-2', sender: 'user-2' }
      ]);

    const result = await messageService.fetchPrivateMessagesForPresentUsers(mockServices);

    expect(result).toEqual([
      { id: '2', message: 'message from user-2', sender: 'user-2', userUUID: 'user-2' }
    ]);

    // Restore original function
    messageService.fetchAllPrivateUserMessages = originalFetch;
  });

  test('handles general errors gracefully', async () => {
    const mockServices = { hangoutState: {} }; // Missing hangUserService intentionally

    const result = await messageService.fetchPrivateMessagesForPresentUsers(mockServices);

    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      'fetchPrivateMessagesForPresentUsers: hangUserService not available in services container'
    );
  });

  test('logs correct debug information during execution', async () => {
    const mockHangUserService = {
      getAllPresentUsers: jest.fn().mockReturnValue(['user-1', 'user-2'])
    };
    
    const mockServices = { 
      hangoutState: {},
      hangUserService: mockHangUserService
    };
    
    const originalFetch = messageService.fetchAllPrivateUserMessages;
    messageService.fetchAllPrivateUserMessages = jest.fn()
      .mockResolvedValueOnce([
        { id: '1', message: 'message from user-1', sender: 'user-1' }
      ])
      .mockResolvedValueOnce([]);

    const result = await messageService.fetchPrivateMessagesForPresentUsers(mockServices);

    expect(logger.debug).toHaveBeenCalledWith('fetchPrivateMessagesForPresentUsers: Fetching messages for 2 users');
    expect(logger.debug).toHaveBeenCalledWith('fetchPrivateMessagesForPresentUsers: Found 1 total private messages from 2 users');

    // Restore original function
    messageService.fetchAllPrivateUserMessages = originalFetch;
  });
});
