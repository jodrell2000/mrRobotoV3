const handleTokenCommand = require( '../../src/commands/Edit Commands/handleTokenCommand' );

// Mock fs to prevent real file operations during tests
jest.mock( 'fs', () => ( {
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    existsSync: jest.fn(),
    mkdirSync: jest.fn()
} ) );

describe( 'handleTokenCommand', () => {
    let mockServices;

    beforeEach( () => {
        mockServices = {
            dataService: {
                loadData: jest.fn(),
                getValue: jest.fn(),
                setValue: jest.fn()
            },
            messageService: {
                sendResponse: jest.fn()
            },
            tokenService: {
                getTokenList: jest.fn(),
                setCustomToken: jest.fn(),
                removeCustomToken: jest.fn(),
                replaceTokens: jest.fn()
            }
        };
    } );

    afterEach( () => {
        jest.clearAllMocks();
    } );

    describe( 'metadata', () => {
        it( 'should have correct metadata properties', () => {
            expect( handleTokenCommand.requiredRole ).toBe( 'OWNER' );
            expect( handleTokenCommand.description ).toBe( 'Manage custom tokens for messages and questions' );
            expect( handleTokenCommand.example ).toBe( 'token list | token add myToken "Hello World" | token remove myToken' );
            expect( handleTokenCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'command execution', () => {
        const defaultContext = {
            sender: { username: 'testowner', role: 'OWNER' },
            fullMessage: { isPrivateMessage: false }
        };

        it( 'should show help when no args provided', async () => {
            const result = await handleTokenCommand( {
                command: 'token',
                args: '',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Please specify a token command' ),
                expect.any( Object )
            );
        } );

        it( 'should list tokens successfully', async () => {
            mockServices.tokenService.getTokenList.mockResolvedValue( [
                {
                    name: '{hangoutName}',
                    type: 'built-in',
                    description: 'Name of the current hangout'
                },
                {
                    name: '{customToken}',
                    type: 'custom',
                    description: 'A custom token',
                    createdAt: '2023-01-01T00:00:00.000Z',
                    valueType: 'static'
                }
            ] );

            const result = await handleTokenCommand( {
                command: 'token',
                args: 'list',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );
            expect( mockServices.tokenService.getTokenList ).toHaveBeenCalled();
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Available Tokens' ),
                expect.any( Object )
            );
        } );

        it( 'should handle empty token list', async () => {
            mockServices.tokenService.getTokenList.mockResolvedValue( [] );

            const result = await handleTokenCommand( {
                command: 'token',
                args: 'list',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'No tokens available' ),
                expect.any( Object )
            );
        } );

        it( 'should add a token successfully', async () => {
            mockServices.tokenService.setCustomToken.mockResolvedValue( {
                success: true,
                message: 'Token {greeting} added successfully',
                tokenName: '{greeting}'
            } );

            const result = await handleTokenCommand( {
                command: 'token',
                args: 'add greeting "Hello World"',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );
            expect( mockServices.tokenService.setCustomToken ).toHaveBeenCalledWith(
                'greeting',
                'Hello World'
            );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Token {greeting} added successfully' ),
                expect.any( Object )
            );
        } );

        it( 'should handle add command with missing arguments', async () => {
            const result = await handleTokenCommand( {
                command: 'token',
                args: 'add greeting',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Please specify token name and value' ),
                expect.any( Object )
            );
        } );

        it( 'should remove a token successfully', async () => {
            mockServices.tokenService.removeCustomToken.mockResolvedValue( {
                success: true,
                message: 'Token {greeting} removed successfully',
                tokenName: '{greeting}'
            } );

            const result = await handleTokenCommand( {
                command: 'token',
                args: 'remove greeting',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );
            expect( mockServices.tokenService.removeCustomToken ).toHaveBeenCalledWith( 'greeting' );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Token {greeting} removed successfully' ),
                expect.any( Object )
            );
        } );

        it( 'should handle remove command with missing arguments', async () => {
            const result = await handleTokenCommand( {
                command: 'token',
                args: 'remove',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Please specify token name to remove' ),
                expect.any( Object )
            );
        } );

        it( 'should test token replacement successfully', async () => {
            mockServices.tokenService.replaceTokens.mockResolvedValue( 'Hello TestUser, welcome to Test Hangout!' );

            const result = await handleTokenCommand( {
                command: 'token',
                args: 'test "Hello {username}, welcome to {hangoutName}!"',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( true );
            expect( mockServices.tokenService.replaceTokens ).toHaveBeenCalledWith(
                '"Hello {username}, welcome to {hangoutName}!"',
                expect.objectContaining( {
                    trackName: 'Sample Song',
                    artistName: 'Sample Artist',
                    username: 'testowner'
                } )
            );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Token Test Results' ),
                expect.any( Object )
            );
        } );

        it( 'should handle test command with missing arguments', async () => {
            const result = await handleTokenCommand( {
                command: 'token',
                args: 'test',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Please specify text to test' ),
                expect.any( Object )
            );
        } );

        it( 'should handle invalid subcommands', async () => {
            const result = await handleTokenCommand( {
                command: 'token',
                args: 'invalid',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Invalid subcommand: "invalid"' ),
                expect.any( Object )
            );
        } );

        it( 'should handle service errors gracefully', async () => {
            mockServices.tokenService.getTokenList.mockRejectedValue( new Error( 'Service error' ) );

            const result = await handleTokenCommand( {
                command: 'token',
                args: 'list',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Failed to list tokens' ),
                expect.any( Object )
            );
        } );

        it( 'should parse quoted values correctly in add command', async () => {
            mockServices.tokenService.setCustomToken.mockResolvedValue( {
                success: true,
                message: 'Token added',
                tokenName: '{test}'
            } );

            await handleTokenCommand( {
                command: 'token',
                args: 'add test "Hello World with spaces"',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( mockServices.tokenService.setCustomToken ).toHaveBeenCalledWith(
                'test',
                'Hello World with spaces'
            );
        } );

        it( 'should handle add command without quotes', async () => {
            mockServices.tokenService.setCustomToken.mockResolvedValue( {
                success: true,
                message: 'Token added',
                tokenName: '{test}'
            } );

            await handleTokenCommand( {
                command: 'token',
                args: 'add test Hello World',
                services: mockServices,
                context: defaultContext,
                responseChannel: 'public'
            } );

            expect( mockServices.tokenService.setCustomToken ).toHaveBeenCalledWith(
                'test',
                'Hello World'
            );
        } );
    } );
} );