// Mock logger to keep test output clean
jest.mock('../../src/lib/logging.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock config to provide gateway base URL and token
jest.mock('../../src/config.js', () => ({
  BOT_USER_TOKEN: 'TEST_BOT_TOKEN',
  TTFM_GATEWAY_BASE_URL: 'https://gateway.prod.tt.fm'
}));

// Mock makeRequest used by hangUserService
jest.mock('../../src/lib/buildUrl.js', () => ({
  makeRequest: jest.fn()
}));

const { makeRequest } = require('../../src/lib/buildUrl.js');
const { getUserNicknameByUuid, getAllPresentUsers } = require('../../src/services/hangUserService.js');

describe('hangUserService.getUserNicknameByUuid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns nickname when response contains top-level nickname', async () => {
    makeRequest.mockResolvedValueOnce({ nickname: 'Alice' });

    const uuid = 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc';
    const nickname = await getUserNicknameByUuid(uuid);

    expect(nickname).toBe('Alice');
    expect(makeRequest).toHaveBeenCalledWith(
      `https://gateway.prod.tt.fm/api/user-service/profile/${encodeURIComponent(uuid)}`,
      { method: 'GET' },
      { Authorization: 'Bearer TEST_BOT_TOKEN' }
    );
  });

  test('returns nickname when response contains nested data.nickname', async () => {
    makeRequest.mockResolvedValueOnce({ data: { nickname: 'Bob' } });

    const nickname = await getUserNicknameByUuid('abc');
    expect(nickname).toBe('Bob');
  });

  test('encodes UUID in URL correctly', async () => {
    makeRequest.mockResolvedValueOnce({ nickname: 'EncodedUser' });

    const uuid = 'id with spaces+plus';
    await getUserNicknameByUuid(uuid);

    expect(makeRequest).toHaveBeenCalledWith(
      `https://gateway.prod.tt.fm/api/user-service/profile/${encodeURIComponent(uuid)}`,
      { method: 'GET' },
      { Authorization: 'Bearer TEST_BOT_TOKEN' }
    );
  });

  test('throws with clear message when nickname is missing', async () => {
    makeRequest.mockResolvedValueOnce({});
    const uuid = 'no-nickname';

    await expect(getUserNicknameByUuid(uuid))
      .rejects
      .toThrow(`Unable to resolve nickname for UUID ${uuid}: Nickname not found in response`);
  });

  test('throws for invalid UUID (empty string) and does not call makeRequest', async () => {
    await expect(getUserNicknameByUuid(''))
      .rejects
      .toThrow('Unable to resolve nickname for UUID : userUuid must be a non-empty string');
    expect(makeRequest).not.toHaveBeenCalled();
  });

  test('throws for invalid UUID (non-string) and does not call makeRequest', async () => {
    await expect(getUserNicknameByUuid(null))
      .rejects
      .toThrow('Unable to resolve nickname for UUID null: userUuid must be a non-empty string');
    expect(makeRequest).not.toHaveBeenCalled();
  });
});

describe('hangUserService.getAllPresentUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns array of UUIDs when allUsers contains valid users', () => {
    const mockServices = {
      hangoutState: {
        getCurrentState: jest.fn().mockReturnValue({
          allUsers: [
            { uuid: 'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc', tokenRole: 'globalModerator' },
            { uuid: 'f3efc54f-1090-4a83-b5e4-73328eb649d1', tokenRole: 'bot' }
          ]
        })
      }
    };

    const result = getAllPresentUsers(mockServices);

    expect(result).toEqual([
      'f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc',
      'f3efc54f-1090-4a83-b5e4-73328eb649d1'
    ]);
    expect(mockServices.hangoutState.getCurrentState).toHaveBeenCalledTimes(1);
  });

  test('returns empty array when services is null or undefined', () => {
    expect(getAllPresentUsers(null)).toEqual([]);
    expect(getAllPresentUsers(undefined)).toEqual([]);
  });

  test('returns empty array when hangoutState service is missing', () => {
    const mockServices = {};
    
    const result = getAllPresentUsers(mockServices);
    
    expect(result).toEqual([]);
  });

  test('returns empty array when current state is null', () => {
    const mockServices = {
      hangoutState: {
        getCurrentState: jest.fn().mockReturnValue(null)
      }
    };

    const result = getAllPresentUsers(mockServices);

    expect(result).toEqual([]);
  });

  test('returns empty array when allUsers is missing from state', () => {
    const mockServices = {
      hangoutState: {
        getCurrentState: jest.fn().mockReturnValue({
          settings: { name: 'Test Room' }
          // allUsers is missing
        })
      }
    };

    const result = getAllPresentUsers(mockServices);

    expect(result).toEqual([]);
  });

  test('returns empty array when allUsers is not an array', () => {
    const mockServices = {
      hangoutState: {
        getCurrentState: jest.fn().mockReturnValue({
          allUsers: "not-an-array"
        })
      }
    };

    const result = getAllPresentUsers(mockServices);

    expect(result).toEqual([]);
  });

  test('filters out users with missing or invalid UUIDs', () => {
    const mockServices = {
      hangoutState: {
        getCurrentState: jest.fn().mockReturnValue({
          allUsers: [
            { uuid: 'valid-uuid-1', tokenRole: 'user' },
            { uuid: '', tokenRole: 'user' }, // empty string
            { uuid: null, tokenRole: 'user' }, // null
            { tokenRole: 'user' }, // missing uuid
            { uuid: 'valid-uuid-2', tokenRole: 'moderator' },
            { uuid: undefined, tokenRole: 'user' } // undefined
          ]
        })
      }
    };

    const result = getAllPresentUsers(mockServices);

    expect(result).toEqual(['valid-uuid-1', 'valid-uuid-2']);
  });

  test('returns empty array when allUsers is empty', () => {
    const mockServices = {
      hangoutState: {
        getCurrentState: jest.fn().mockReturnValue({
          allUsers: []
        })
      }
    };

    const result = getAllPresentUsers(mockServices);

    expect(result).toEqual([]);
  });

  test('handles errors gracefully and returns empty array', () => {
    const mockServices = {
      hangoutState: {
        getCurrentState: jest.fn().mockImplementation(() => {
          throw new Error('State service error');
        })
      }
    };

    const result = getAllPresentUsers(mockServices);

    expect(result).toEqual([]);
  });
});


