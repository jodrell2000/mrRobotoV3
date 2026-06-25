const handleLLMStatusCommand = require( '../../src/commands/Bot Commands/handleLLMStatusCommand' );

describe( 'handleLLMStatusCommand', () => {
    let services;
    let commandParams;

    beforeEach( () => {
        services = {
            messageService: {
                sendResponse: jest.fn()
            },
            machineLearningService: {
                getActiveBackend: jest.fn().mockReturnValue( 'gemma' ),
                healthCheck: jest.fn().mockResolvedValue( {
                    healthy: true,
                    status: 'operational',
                    message: 'Gemma backend is operational with 2 models available'
                } )
            }
        };

        commandParams = {
            command: 'llmstatus',
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
            expect( handleLLMStatusCommand.requiredRole ).toBe( 'USER' );
            expect( handleLLMStatusCommand.description ).toBe( 'Check LLM backend status' );
            expect( handleLLMStatusCommand.example ).toBe( 'llmstatus' );
            expect( handleLLMStatusCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'healthy backend status', () => {
        it( 'should report healthy gemma backend', async () => {
            const result = await handleLLMStatusCommand( commandParams );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( '🤖 LLM Backend Status:' );
            expect( result.response ).toContain( '📡 Active Backend: **gemma**' );
            expect( result.response ).toContain( '✅ Healthy' );
            expect( result.response ).toContain( 'Gemma backend is operational with 2 models available' );
            expect( services.machineLearningService.healthCheck ).toHaveBeenCalled();
        } );

        it( 'should report healthy mistral backend', async () => {
            services.machineLearningService.getActiveBackend.mockReturnValue( 'mistral' );
            services.machineLearningService.healthCheck.mockResolvedValue( {
                healthy: true,
                status: 'operational',
                message: 'Mistral backend is operational with 73 models available'
            } );

            const result = await handleLLMStatusCommand( commandParams );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( '📡 Active Backend: **mistral**' );
            expect( result.response ).toContain( '✅ Healthy' );
            expect( result.response ).toContain( '73 models available' );
        } );
    } );

    describe( 'unhealthy backend status', () => {
        it( 'should report unhealthy backend', async () => {
            services.machineLearningService.healthCheck.mockResolvedValue( {
                healthy: false,
                status: 'error',
                message: 'API key missing or invalid'
            } );

            const result = await handleLLMStatusCommand( commandParams );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( '❌ Unhealthy' );
            expect( result.response ).toContain( 'API key missing or invalid' );
        } );

        it( 'should report connection errors', async () => {
            services.machineLearningService.healthCheck.mockResolvedValue( {
                healthy: false,
                status: 'connection_error',
                message: 'Unable to connect to API'
            } );

            const result = await handleLLMStatusCommand( commandParams );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( '❌ Unhealthy' );
            expect( result.response ).toContain( 'Unable to connect to API' );
        } );
    } );

    describe( 'error handling', () => {
        it( 'should handle health check errors gracefully', async () => {
            services.machineLearningService.healthCheck.mockRejectedValue(
                new Error( 'Health check failed' )
            );

            const result = await handleLLMStatusCommand( commandParams );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( '❌ Error checking LLM status' );
            expect( result.response ).toContain( 'Health check failed' );
            expect( result.shouldRespond ).toBe( true );
        } );

        it( 'should handle missing services gracefully', async () => {
            commandParams.services = {
                messageService: services.messageService
            };

            const result = await handleLLMStatusCommand( commandParams );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( '❌ Error checking LLM status' );
        } );

        it( 'should handle null backend response', async () => {
            services.machineLearningService.getActiveBackend.mockReturnValue( null );
            services.machineLearningService.healthCheck.mockResolvedValue( {
                healthy: false,
                status: 'not_initialized',
                message: 'No active backend'
            } );

            const result = await handleLLMStatusCommand( commandParams );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'null' );
        } );
    } );

    describe( 'response formatting', () => {
        it( 'should include all required fields in response', async () => {
            const result = await handleLLMStatusCommand( commandParams );

            expect( result.response ).toBeDefined();
            expect( result.success ).toBeDefined();
            expect( result.shouldRespond ).toBeDefined();
        } );

        it( 'should use emoji indicators', async () => {
            const result = await handleLLMStatusCommand( commandParams );

            expect( result.response ).toContain( '🤖' );
            expect( result.response ).toContain( '📡' );
            expect( result.response ).toContain( '💓' );
        } );
    } );

    describe( 'response channel handling', () => {
        it( 'should respect responseChannel parameter', async () => {
            commandParams.responseChannel = 'public';

            await handleLLMStatusCommand( commandParams );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.any( String ),
                expect.objectContaining( {
                    responseChannel: 'public'
                } )
            );
        } );

        it( 'should pass private message flag', async () => {
            commandParams.context.fullMessage.isPrivateMessage = true;

            await handleLLMStatusCommand( commandParams );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.any( String ),
                expect.objectContaining( {
                    isPrivateMessage: true
                } )
            );
        } );

        it( 'should include sender information', async () => {
            commandParams.context.sender = 'statuschecker';

            await handleLLMStatusCommand( commandParams );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.any( String ),
                expect.objectContaining( {
                    sender: 'statuschecker'
                } )
            );
        } );

        it( 'should include services in response params', async () => {
            await handleLLMStatusCommand( commandParams );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.any( String ),
                expect.objectContaining( {
                    services: services
                } )
            );
        } );
    } );

    describe( 'accessibility', () => {
        it( 'should be accessible to all users', () => {
            expect( handleLLMStatusCommand.requiredRole ).toBe( 'USER' );
        } );

        it( 'should not be hidden', () => {
            expect( handleLLMStatusCommand.hidden ).toBe( false );
        } );
    } );
} );
