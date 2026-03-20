// Mock dependencies BEFORE importing modules
jest.mock( '../../src/config', () => ( {
  HANGOUT_ID: 'test-hangout-id',
  BOT_UID: 'test-bot-uid'
} ) );

const mockLogger = {
  debug: jest.fn(),
  error: jest.fn()
};

jest.mock( '../../src/lib/logging', () => ( {
  logger: mockLogger
} ) );

// Import after mocking
const { hangSocketServices } = require( '../../src/services/hangSocketServices' );

describe( 'hangSocketServices', () => {
  let mockSocket;

  beforeEach( () => {
    jest.clearAllMocks();
    mockLogger.debug.mockClear();
    mockLogger.error.mockClear();
    mockSocket = {
      action: jest.fn().mockResolvedValue( {} )
    };
  } );

  describe( 'upVote', () => {
    it( 'should send upvote action with correct parameters', async () => {
      await hangSocketServices.upVote( mockSocket );

      expect( mockSocket.action ).toHaveBeenCalledWith( 'voteOnSong', {
        roomUuid: 'test-hangout-id',
        userUuid: 'test-bot-uid',
        songVotes: { like: true }
      } );

      expect( mockLogger.debug ).toHaveBeenCalledWith(
        'hangSocketServices.upVote: Sending upvote for room test-hangout-id'
      );
      expect( mockLogger.debug ).toHaveBeenCalledWith(
        'hangSocketServices.upVote: Successfully sent upvote'
      );
    } );

    it( 'should handle socket action errors', async () => {
      const testError = new Error( 'Socket connection failed' );
      mockSocket.action.mockRejectedValue( testError );

      await expect( hangSocketServices.upVote( mockSocket ) ).rejects.toThrow( 'Socket connection failed' );

      expect( mockLogger.error ).toHaveBeenCalledWith(
        'hangSocketServices.upVote: Error sending upvote - Socket connection failed'
      );
    } );
  } );

  describe( 'downVote', () => {
    it( 'should send downvote action with correct parameters', async () => {
      await hangSocketServices.downVote( mockSocket );

      expect( mockSocket.action ).toHaveBeenCalledWith( 'voteOnSong', {
        roomUuid: 'test-hangout-id',
        userUuid: 'test-bot-uid',
        songVotes: { like: false }
      } );

      expect( mockLogger.debug ).toHaveBeenCalledWith(
        'hangSocketServices.downVote: Sending downvote for room test-hangout-id'
      );
      expect( mockLogger.debug ).toHaveBeenCalledWith(
        'hangSocketServices.downVote: Successfully sent downvote'
      );
    } );

    it( 'should handle socket action errors', async () => {
      const testError = new Error( 'Socket connection failed' );
      mockSocket.action.mockRejectedValue( testError );

      await expect( hangSocketServices.downVote( mockSocket ) ).rejects.toThrow( 'Socket connection failed' );

      expect( mockLogger.error ).toHaveBeenCalledWith(
        'hangSocketServices.downVote: Error sending downvote - Socket connection failed'
      );
    } );
  } );

  describe( 'integration with serviceContainer', () => {
    it( 'should be accessible through services container', () => {
      jest.mock( '../../src/services/databaseService', () => {
        return jest.fn().mockImplementation( () => ( {
          initialize: jest.fn().mockResolvedValue( undefined ),
          initialized: true
        } ) );
      } );
      const services = require( '../../src/services/serviceContainer' );
      expect( services.hangSocketServices ).toBeDefined();
      expect( services.hangSocketServices.upVote ).toBeInstanceOf( Function );
      expect( services.hangSocketServices.downVote ).toBeInstanceOf( Function );
    } );
  } );
} );
