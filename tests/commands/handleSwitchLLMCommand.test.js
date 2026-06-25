// Mock the config BEFORE requiring the command
jest.mock( '../../src/config.js', () => ( {
    COMMAND_SWITCH: '!'
} ) );

const handleSwitchLLMCommand = require( '../../src/commands/Bot Commands/handleSwitchLLMCommand' );

describe( 'handleSwitchLLMCommand', () => {
    let services;
    let commandParams;

    beforeEach( () => {
        services = {
            messageService: {
                sendResponse: jest.fn()
            },
            machineLearningService: {
                getActiveBackend: jest.fn().mockReturnValue( 'gemma' ),
                switchBackend: jest.fn()
            },
            stateService: {
                getUserRole: jest.fn()
            },
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            }
        };

        commandParams = {
            command: 'switchllm',
            args: '',
            services: services,
            context: {
                sender: 'user123',
                fullMessage: {
                    isPrivateMessage: false
                }
            },
            responseChannel: 'request'
        };
    } );

    describe( 'metadata', () => {
        it( 'should have correct metadata properties', () => {
            expect( handleSwitchLLMCommand.requiredRole ).toBe( 'OWNER' );
            expect( handleSwitchLLMCommand.description ).toBe( 'Switch LLM backend (gemma or mistral)' );
            expect( handleSwitchLLMCommand.example ).toBe( 'switchllm mistral' );
            expect( handleSwitchLLMCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'permission checking', () => {
        it( 'should deny access to regular users', async () => {
            services.stateService.getUserRole.mockReturnValue( 'user' );
            commandParams.args = 'mistral';

            const result = await handleSwitchLLMCommand( commandParams );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( '❌ Only the room owner can switch LLM backends.' );
            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( '❌ Only the room owner can switch LLM backends.' ),
                expect.any( Object )
            );
        } );

        it( 'should deny access to moderators', async () => {
            services.stateService.getUserRole.mockReturnValue( 'moderator' );
            commandParams.args = 'mistral';

            const result = await handleSwitchLLMCommand( commandParams );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( '❌ Only the room owner can switch LLM backends.' );
        } );

        it( 'should allow access to owners', async () => {
            services.stateService.getUserRole.mockReturnValue( 'owner' );
            services.machineLearningService.switchBackend.mockResolvedValue( { success: true } );
            commandParams.args = 'mistral';

            const result = await handleSwitchLLMCommand( commandParams );

            expect( services.machineLearningService.switchBackend ).toHaveBeenCalled();
        } );
    } );

    describe( 'no backend specified', () => {
        beforeEach( () => {
            services.stateService.getUserRole.mockReturnValue( 'owner' );
            commandParams.args = '';
        } );

        it( 'should show usage instructions when no backend specified', async () => {
            const result = await handleSwitchLLMCommand( commandParams );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( '🤖 **LLM Backend Switching:**' );
            expect( result.response ).toContain( '!switchllm gemma' );
            expect( result.response ).toContain( '!switchllm mistral' );
            expect( result.response ).toContain( 'llmstatus' );
            expect( result.response ).toContain( 'Available backends' );
        } );
    } );

    describe( 'invalid backend specified', () => {
        beforeEach( () => {
            services.stateService.getUserRole.mockReturnValue( 'owner' );
        } );

        it( 'should reject unknown backend', async () => {
            commandParams.args = 'claude';

            const result = await handleSwitchLLMCommand( commandParams );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( '❌ Unknown backend: **claude**' );
            expect( result.response ).toContain( 'Available backends: gemma, mistral' );
        } );

        it( 'should be case-insensitive', async () => {
            commandParams.args = 'MISTRAL';
            services.machineLearningService.switchBackend.mockResolvedValue( { success: true } );

            const result = await handleSwitchLLMCommand( commandParams );

            expect( services.machineLearningService.switchBackend ).toHaveBeenCalledWith( 'mistral' );
        } );
    } );

    describe( 'successful backend switch', () => {
        beforeEach( () => {
            services.stateService.getUserRole.mockReturnValue( 'owner' );
            services.machineLearningService.getActiveBackend.mockReturnValue( 'gemma' );
        } );

        it( 'should successfully switch to mistral', async () => {
            commandParams.args = 'mistral';
            services.machineLearningService.switchBackend.mockResolvedValue( { success: true } );

            const result = await handleSwitchLLMCommand( commandParams );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( '✅ Successfully switched to **mistral** backend' );
            expect( result.response ).toContain( '(from gemma)' );
            expect( services.machineLearningService.switchBackend ).toHaveBeenCalledWith( 'mistral' );
            expect( services.logger.info ).toHaveBeenCalledWith(
                expect.stringContaining( 'switching from gemma to mistral' )
            );
        } );

        it( 'should successfully switch to gemma', async () => {
            services.machineLearningService.getActiveBackend.mockReturnValue( 'mistral' );
            commandParams.args = 'gemma';
            services.machineLearningService.switchBackend.mockResolvedValue( { success: true } );

            const result = await handleSwitchLLMCommand( commandParams );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( '✅ Successfully switched to **gemma** backend' );
            expect( result.response ).toContain( '(from mistral)' );
        } );

        it( 'should include notification when switching', async () => {
            commandParams.args = 'mistral';
            services.machineLearningService.switchBackend.mockResolvedValue( { success: true } );

            const result = await handleSwitchLLMCommand( commandParams );

            expect( result.notification ).toContain( 'Bot switched LLM backend from gemma to mistral' );
        } );
    } );

    describe( 'already using same backend', () => {
        beforeEach( () => {
            services.stateService.getUserRole.mockReturnValue( 'owner' );
            services.machineLearningService.getActiveBackend.mockReturnValue( 'gemma' );
        } );

        it( 'should handle switching to same backend', async () => {
            commandParams.args = 'gemma';

            const result = await handleSwitchLLMCommand( commandParams );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'ℹ️ Already using **gemma** backend.' );
            expect( services.machineLearningService.switchBackend ).not.toHaveBeenCalled();
        } );
    } );

    describe( 'backend switch failures', () => {
        beforeEach( () => {
            services.stateService.getUserRole.mockReturnValue( 'owner' );
        } );

        it( 'should handle initialization failure', async () => {
            commandParams.args = 'mistral';
            services.machineLearningService.switchBackend.mockResolvedValue( {
                success: false,
                error: 'API key not configured'
            } );

            const result = await handleSwitchLLMCommand( commandParams );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( '❌ Failed to switch to mistral backend' );
            expect( result.response ).toContain( 'API key not configured' );
        } );

        it( 'should handle network errors', async () => {
            commandParams.args = 'mistral';
            services.machineLearningService.switchBackend.mockResolvedValue( {
                success: false,
                error: 'Connection timeout'
            } );

            const result = await handleSwitchLLMCommand( commandParams );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Connection timeout' );
        } );

        it( 'should handle exceptions gracefully', async () => {
            commandParams.args = 'mistral';
            services.machineLearningService.switchBackend.mockRejectedValue(
                new Error( 'Unexpected error occurred' )
            );

            const result = await handleSwitchLLMCommand( commandParams );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( '❌ Error switching LLM backend' );
            expect( result.response ).toContain( 'Unexpected error occurred' );
            expect( result.shouldRespond ).toBe( true );
        } );
    } );

    describe( 'response channel handling', () => {
        beforeEach( () => {
            services.stateService.getUserRole.mockReturnValue( 'owner' );
            services.machineLearningService.switchBackend.mockResolvedValue( { success: true } );
            commandParams.args = 'mistral';
        } );

        it( 'should respect responseChannel parameter', async () => {
            commandParams.responseChannel = 'public';

            await handleSwitchLLMCommand( commandParams );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.any( String ),
                expect.objectContaining( {
                    responseChannel: 'public'
                } )
            );
        } );

        it( 'should pass private message flag correctly', async () => {
            commandParams.context.fullMessage.isPrivateMessage = true;

            await handleSwitchLLMCommand( commandParams );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.any( String ),
                expect.objectContaining( {
                    isPrivateMessage: true
                } )
            );
        } );

        it( 'should include sender information', async () => {
            commandParams.context.sender = 'testuser';

            await handleSwitchLLMCommand( commandParams );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.any( String ),
                expect.objectContaining( {
                    sender: 'testuser'
                } )
            );
        } );
    } );
} );
