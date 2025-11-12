// Mock the modules before importing messageService
jest.mock( '../../../src/lib/logging.js', () => ( {
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
} ) );

jest.mock( 'axios' );

// Now import the modules that use the mocked dependencies
const axios = require( 'axios' );
const { messageService } = require( '../../../src/services/messageService.js' );
const { logger } = require( '../../../src/lib/logging.js' );

describe( 'messageService.sendGroupPictureMessage', () => {
    let sendGroupMessageSpy;

    beforeEach( () => {
        jest.clearAllMocks();

        // Mock services object for tests
        const mockServices = {
            dataService: {
                getValue: jest.fn()
                    .mockReturnValueOnce( 'avatar123' )  // for CHAT_AVATAR_ID
                    .mockReturnValueOnce( 'TestBot' )    // for CHAT_NAME
                    .mockReturnValueOnce( 'ff0000' ),    // for CHAT_COLOUR
                getAllData: jest.fn().mockReturnValue( {
                    botData: {
                        CHAT_AVATAR_ID: 'avatar123',
                        CHAT_NAME: 'TestBot',
                        CHAT_COLOUR: 'ff0000'
                    }
                } )
            }
        };

        // Spy on sendGroupMessage since our function uses it
        sendGroupMessageSpy = jest.spyOn( messageService, 'sendGroupMessage' )
            .mockResolvedValue( {
                message: "Test message",
                messageResponse: { data: { id: 'msg123' } }
            } );
    } );

    afterEach( () => {
        jest.resetAllMocks();
    } );

    it( 'should call sendGroupMessage with correct parameters', async () => {
        const message = "Check out this image!";
        const imageUrl = "https://example.com/test.jpg";
        const services = { dataService: {} };

        await messageService.sendGroupPictureMessage( message, imageUrl, services );

        expect( sendGroupMessageSpy ).toHaveBeenCalledWith( {
            message: message,
            images: [ imageUrl ],
            services: services,
            senderUid: null,
            senderName: null,
            senderAvatarId: null,
            senderColor: null
        } );
    } );

    it( 'should wrap single image URL in array', async () => {
        const imageUrl = "https://example.com/test.jpg";

        await messageService.sendGroupPictureMessage( "Test", imageUrl );

        expect( sendGroupMessageSpy ).toHaveBeenCalledWith(
            expect.objectContaining( {
                images: [ imageUrl ] // Verify image URL is wrapped in array
            } )
        );
    } );

    // Test removed: services is now a required parameter in the updated architecture

    it( 'should forward the response from sendGroupMessage', async () => {
        const expectedResponse = {
            message: "Test message",
            messageResponse: { data: { id: 'msg123' } }
        };
        sendGroupMessageSpy.mockResolvedValueOnce( expectedResponse );

        const result = await messageService.sendGroupPictureMessage(
            "Test",
            "https://example.com/test.jpg"
        );

        expect( result ).toEqual( expectedResponse );
    } );

    it( 'should handle errors properly', async () => {
        const error = new Error( 'Test error' );
        sendGroupMessageSpy.mockRejectedValueOnce( error );

        await expect( messageService.sendGroupPictureMessage(
            "Test",
            "https://example.com/test.jpg"
        ) ).rejects.toThrow( 'Test error' );

        expect( logger.error ).toHaveBeenCalledWith(
            expect.stringContaining( 'Failed to send group picture message' )
        );
    } );
} );
