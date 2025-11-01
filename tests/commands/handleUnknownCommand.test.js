// Mock fs before requiring the module
jest.mock( 'node:fs' );

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const handleUnknownCommand = require( '../../src/commands/handleUnknownCommand.js' );

describe( 'handleUnknownCommand with dynamic chat', () => {
    let mockServices;
    let mockContext;

    beforeEach( () => {
        jest.clearAllMocks();

        // Mock services
        mockServices = {
            messageService: {
                sendResponse: jest.fn().mockResolvedValue()
            }
        };

        // Mock context
        mockContext = {
            sender: { username: 'testuser' },
            djUsername: 'testdj',
            fullMessage: { isPrivateMessage: false }
        };
    } );



    test( 'should fall back to unknown command when command not in chat.json', async () => {
        // Mock chat.json data without the requested command
        const mockChatData = {
            props: {
                messages: [ 'some message' ]
            }
        };

        fs.existsSync = jest.fn().mockReturnValue( true );
        fs.readFileSync = jest.fn().mockReturnValue( JSON.stringify( mockChatData ) );

        const commandParams = {
            command: 'nonexistent',
            args: '',
            services: mockServices,
            context: mockContext,
            responseChannel: 'request'
        };

        const result = await handleUnknownCommand( commandParams );

        expect( result.success ).toBe( false );
        expect( result.error ).toBe( 'Unknown command' );
        expect( result.response ).toContain( 'Unknown command: "nonexistent"' );
    } );

    test( 'should handle missing chat.json gracefully', async () => {
        // Mock fs.existsSync to return false
        fs.existsSync = jest.fn().mockReturnValue( false );

        const commandParams = {
            command: 'props',
            args: '',
            services: mockServices,
            context: mockContext,
            responseChannel: 'request'
        };

        const result = await handleUnknownCommand( commandParams );

        expect( result.success ).toBe( false );
        expect( result.error ).toBe( 'Unknown command' );
        expect( result.response ).toContain( 'Unknown command: "props"' );
    } );


} );