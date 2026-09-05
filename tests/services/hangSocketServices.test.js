// Mock dependencies BEFORE importing modules
jest.mock( '../../src/lib/logging', () => ( {
  logger: {
    debug: jest.fn(),
    error: jest.fn()
  }
} ) );

const { logger } = require( '../../src/lib/logging' );
const { hangSocketServices } = require( '../../src/services/hangSocketServices' );

describe( 'hangSocketServices', () => {
  let mockServices;

  beforeEach( () => {
    jest.clearAllMocks();
    mockServices = {
      config: {
        BOT_UID: 'test-bot-uid'
      },
      socketAdapter: {
        voteOnSong: jest.fn().mockResolvedValue( {} ),
        removeDj: jest.fn().mockResolvedValue( {} ),
        skipSong: jest.fn().mockResolvedValue( {} )
      }
    };
  } );

  describe( 'upVote', () => {
    it( 'should call socketAdapter.voteOnSong with upvote', async () => {
      await hangSocketServices.upVote( mockServices );

      expect( mockServices.socketAdapter.voteOnSong ).toHaveBeenCalledWith( 'test-bot-uid', 'upvote' );
      expect( logger.debug ).toHaveBeenCalledWith( 'hangSocketServices.upVote: Sending upvote' );
      expect( logger.debug ).toHaveBeenCalledWith( 'hangSocketServices.upVote: Successfully sent upvote' );
    } );

    it( 'should handle socket adapter errors', async () => {
      const testError = new Error( 'Socket connection failed' );
      mockServices.socketAdapter.voteOnSong.mockRejectedValue( testError );

      await expect( hangSocketServices.upVote( mockServices ) ).rejects.toThrow( 'Socket connection failed' );
      expect( logger.error ).toHaveBeenCalledWith(
        'hangSocketServices.upVote: Error sending upvote - Socket connection failed'
      );
    } );

    it( 'should throw error if socketAdapter is not available', async () => {
      const invalidServices = { config: { BOT_UID: 'test-bot-uid' } };

      await expect( hangSocketServices.upVote( invalidServices ) ).rejects.toThrow(
        'Socket adapter not available'
      );
    } );
  } );

  describe( 'downVote', () => {
    it( 'should call socketAdapter.voteOnSong with downvote', async () => {
      await hangSocketServices.downVote( mockServices );

      expect( mockServices.socketAdapter.voteOnSong ).toHaveBeenCalledWith( 'test-bot-uid', 'downvote' );
      expect( logger.debug ).toHaveBeenCalledWith( 'hangSocketServices.downVote: Sending downvote' );
      expect( logger.debug ).toHaveBeenCalledWith( 'hangSocketServices.downVote: Successfully sent downvote' );
    } );

    it( 'should handle socket adapter errors', async () => {
      const testError = new Error( 'Socket connection failed' );
      mockServices.socketAdapter.voteOnSong.mockRejectedValue( testError );

      await expect( hangSocketServices.downVote( mockServices ) ).rejects.toThrow( 'Socket connection failed' );
      expect( logger.error ).toHaveBeenCalledWith(
        'hangSocketServices.downVote: Error sending downvote - Socket connection failed'
      );
    } );

    it( 'should throw error if socketAdapter is not available', async () => {
      const invalidServices = { config: { BOT_UID: 'test-bot-uid' } };

      await expect( hangSocketServices.downVote( invalidServices ) ).rejects.toThrow(
        'Socket adapter not available'
      );
    } );
  } );

  describe( 'removeDj', () => {
    it( 'should call socketAdapter.removeDj with djUuid', async () => {
      await hangSocketServices.removeDj( mockServices, 'test-dj-uuid' );

      expect( mockServices.socketAdapter.removeDj ).toHaveBeenCalledWith( 'test-dj-uuid' );
      expect( logger.debug ).toHaveBeenCalledWith( 'hangSocketServices.removeDj: Removing DJ test-dj-uuid' );
      expect( logger.debug ).toHaveBeenCalledWith( 'hangSocketServices.removeDj: Successfully removed DJ test-dj-uuid' );
    } );

    it( 'should handle socket adapter errors', async () => {
      const testError = new Error( 'DJ not found' );
      mockServices.socketAdapter.removeDj.mockRejectedValue( testError );

      await expect( hangSocketServices.removeDj( mockServices, 'test-dj-uuid' ) ).rejects.toThrow( 'DJ not found' );
      expect( logger.error ).toHaveBeenCalledWith(
        'hangSocketServices.removeDj: Error removing DJ test-dj-uuid - DJ not found'
      );
    } );

    it( 'should throw error if socketAdapter is not available', async () => {
      const invalidServices = { config: { BOT_UID: 'test-bot-uid' } };

      await expect( hangSocketServices.removeDj( invalidServices, 'test-dj-uuid' ) ).rejects.toThrow(
        'Socket adapter not available'
      );
    } );
  } );

  describe( 'skipSong', () => {
    it( 'should call socketAdapter.skipSong', async () => {
      await hangSocketServices.skipSong( mockServices );

      expect( mockServices.socketAdapter.skipSong ).toHaveBeenCalled();
      expect( logger.debug ).toHaveBeenCalledWith( 'hangSocketServices.skipSong: Skipping song' );
      expect( logger.debug ).toHaveBeenCalledWith( 'hangSocketServices.skipSong: Successfully skipped song' );
    } );

    it( 'should handle socket adapter errors', async () => {
      const testError = new Error( 'Skip not allowed' );
      mockServices.socketAdapter.skipSong.mockRejectedValue( testError );

      await expect( hangSocketServices.skipSong( mockServices ) ).rejects.toThrow( 'Skip not allowed' );
      expect( logger.error ).toHaveBeenCalledWith(
        'hangSocketServices.skipSong: Error skipping song - Skip not allowed'
      );
    } );

    it( 'should throw error if socketAdapter is not available', async () => {
      const invalidServices = { config: { BOT_UID: 'test-bot-uid' } };

      await expect( hangSocketServices.skipSong( invalidServices ) ).rejects.toThrow(
        'Socket adapter not available'
      );
    } );
  } );
} );
