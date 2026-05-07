const handlePersonalityCommand = require( '../../src/commands/Edit Commands/handlePersonalityCommand' );

describe( 'handlePersonalityCommand', () => {
    let mockServices;
    let mockContext;

    beforeEach( () => {
        jest.clearAllMocks();

        mockServices = {
            messageService: {
                sendResponse: jest.fn()
            },
            dataService: {
                getAllData: jest.fn(),
                getValue: jest.fn(),
                setValue: jest.fn(),
                loadData: jest.fn().mockResolvedValue()
            },
            databaseService: {
                initialized: true,
                getAllPersonalities: jest.fn(),
                getPersonalityByName: jest.fn(),
                savePersonality: jest.fn(),
                updatePersonality: jest.fn(),
                deletePersonality: jest.fn()
            },
            stateService: {
                getUserRole: jest.fn().mockReturnValue( 'owner' )
            },
            hangUserService: {
                updateHangNickname: jest.fn().mockResolvedValue()
            },
            logger: {
                info: jest.fn(),
                debug: jest.fn(),
                error: jest.fn()
            }
        };

        mockContext = {
            sender: 'testuser',
            fullMessage: { isPrivateMessage: false }
        };
    } );

    describe( 'command metadata', () => {
        it( 'should have correct metadata', () => {
            expect( handlePersonalityCommand.requiredRole ).toBe( 'MODERATOR' );
            expect( handlePersonalityCommand.description ).toBeDefined();
            expect( handlePersonalityCommand.description ).toBe( 'Manage bot personality presets' );
            expect( handlePersonalityCommand.example ).toBeDefined();
            expect( handlePersonalityCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'permissions', () => {
        it( 'should allow moderators to list personalities', async () => {
            mockServices.stateService.getUserRole.mockReturnValue( 'moderator' );
            mockServices.databaseService.getAllPersonalities.mockResolvedValue( [] );

            const result = await handlePersonalityCommand( {
                args: 'list',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( mockServices.databaseService.getAllPersonalities ).toHaveBeenCalled();
        } );

        it( 'should allow moderators to activate personalities', async () => {
            mockServices.stateService.getUserRole.mockReturnValue( 'moderator' );
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( {
                name: 'Test',
                instructions: { MLPersonality: 'test', MLInstructions: 'test' },
                editableMessages: {},
                configuration: { botName: 'TestBot' },
                mlQuestions: {},
                disabledCommands: [],
                disabledFeatures: [],
                triggers: {},
                customTokens: {}
            } );

            const result = await handlePersonalityCommand( {
                args: 'activate "Test"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
        } );

        it( 'should prevent moderators from saving personalities', async () => {
            mockServices.stateService.getUserRole.mockReturnValue( 'moderator' );

            const result = await handlePersonalityCommand( {
                args: 'save "Test" "Description"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Only the room owner' );
            expect( mockServices.databaseService.savePersonality ).not.toHaveBeenCalled();
        } );

        it( 'should prevent moderators from updating personalities', async () => {
            mockServices.stateService.getUserRole.mockReturnValue( 'moderator' );

            const result = await handlePersonalityCommand( {
                args: 'update "Test"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Only the room owner' );
            expect( mockServices.databaseService.updatePersonality ).not.toHaveBeenCalled();
        } );

        it( 'should prevent moderators from deleting personalities', async () => {
            mockServices.stateService.getUserRole.mockReturnValue( 'moderator' );

            const result = await handlePersonalityCommand( {
                args: 'delete "Test"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Only the room owner' );
            expect( mockServices.databaseService.deletePersonality ).not.toHaveBeenCalled();
        } );

        it( 'should prevent moderators from viewing full personality details (showall)', async () => {
            mockServices.stateService.getUserRole.mockReturnValue( 'moderator' );

            const result = await handlePersonalityCommand( {
                args: 'showall "Test"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Only the room owner' );
            expect( result.response ).toContain( 'Use `show` for a brief overview' );
        } );

        it( 'should allow owners to perform all operations', async () => {
            mockServices.stateService.getUserRole.mockReturnValue( 'owner' );
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( null );
            mockServices.dataService.getAllData.mockReturnValue( {} );

            const result = await handlePersonalityCommand( {
                args: 'save "Test" "Description"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( mockServices.databaseService.savePersonality ).toHaveBeenCalled();
        } );
    } );

    describe( 'argument validation', () => {
        it( 'should require arguments', async () => {
            const result = await handlePersonalityCommand( {
                args: '',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Please specify a command' );
        } );

        it( 'should reject unknown subcommand', async () => {
            const result = await handlePersonalityCommand( {
                args: 'unknown',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Unknown command' );
        } );
    } );

    describe( 'list subcommand', () => {
        it( 'should list all personalities with descriptions', async () => {
            mockServices.dataService.getValue.mockReturnValue( undefined );
            mockServices.databaseService.getAllPersonalities.mockResolvedValue( [
                { id: 1, name: 'TestPersonality', description: 'Test description', created_at: '2026-05-06T00:00:00Z', updated_at: '2026-05-06T00:00:00Z' },
                { id: 2, name: 'AnotherOne', description: 'Another description', created_at: '2026-05-05T00:00:00Z', updated_at: '2026-05-05T00:00:00Z' }
            ] );

            const result = await handlePersonalityCommand( {
                args: 'list',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'TestPersonality' );
            expect( result.response ).toContain( 'Test description' );
            expect( result.response ).toContain( 'AnotherOne' );
            expect( result.response ).toContain( 'Another description' );
            expect( mockServices.databaseService.getAllPersonalities ).toHaveBeenCalled();
        } );

        it( 'should show active personality at top', async () => {
            mockServices.dataService.getValue.mockReturnValue( 'TestPersonality' );
            mockServices.databaseService.getAllPersonalities.mockResolvedValue( [
                { id: 1, name: 'TestPersonality', description: 'Active one', created_at: '2026-05-06T00:00:00Z', updated_at: '2026-05-06T00:00:00Z' }
            ] );

            const result = await handlePersonalityCommand( {
                args: 'list',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( '🔵' );
            expect( result.response ).toContain( 'Active:' );
            expect( result.response ).toContain( 'TestPersonality' );
        } );

        it( 'should handle empty list', async () => {
            mockServices.dataService.getValue.mockReturnValue( undefined );
            mockServices.databaseService.getAllPersonalities.mockResolvedValue( [] );

            const result = await handlePersonalityCommand( {
                args: 'list',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'No saved personalities' );
        } );
    } );

    describe( 'show subcommand', () => {
        it( 'should show personality overview', async () => {
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( {
                name: 'TestPersonality',
                description: 'Test description',
                instructions: { MLPersonality: 'You are a helpful bot' }
            } );

            const result = await handlePersonalityCommand( {
                args: 'show "TestPersonality"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'TestPersonality' );
            expect( result.response ).toContain( 'Test description' );
            expect( result.response ).toContain( 'You are a helpful bot' );
        } );

        it( 'should truncate long ML personality text', async () => {
            const longText = 'a'.repeat( 600 );
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( {
                name: 'TestPersonality',
                description: 'Test description',
                instructions: { MLPersonality: longText }
            } );

            const result = await handlePersonalityCommand( {
                args: 'show "TestPersonality"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( '...' );
            expect( result.response ).toContain( 'showall' );
        } );

        it( 'should suggest similar names for typos', async () => {
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( undefined );
            mockServices.databaseService.getAllPersonalities.mockResolvedValue( [
                { name: 'TestPersonality' },
                { name: 'ProductionMode' }
            ] );

            const result = await handlePersonalityCommand( {
                args: 'show "TesPersonality"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'not found' );
            expect( result.response ).toContain( 'Did you mean' );
        } );
    } );

    describe( 'save subcommand', () => {
        beforeEach( () => {
            mockServices.stateService.getUserRole.mockReturnValue( 'owner' );
            mockServices.dataService.getAllData.mockReturnValue( {
                botData: { CHAT_NAME: 'TestBot' },
                Instructions: { MLPersonality: 'Test personality', MLInstructions: 'Test instructions' },
                editableMessages: { welcomeMessage: 'Welcome!' },
                configuration: { timezone: 'UTC' },
                mlQuestions: {},
                disabledCommands: [],
                disabledFeatures: [],
                triggers: {},
                customTokens: {}
            } );
        } );

        it( 'should save personality with valid name and description', async () => {
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( undefined );

            const result = await handlePersonalityCommand( {
                args: 'save "TestPersonality" "Test description"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'saved successfully' );
            expect( mockServices.databaseService.savePersonality ).toHaveBeenCalledWith(
                expect.objectContaining( {
                    name: 'TestPersonality',
                    description: 'Test description'
                } )
            );
        } );

        it( 'should reject save without description', async () => {
            const result = await handlePersonalityCommand( {
                args: 'save "TestPersonality"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'both name and description' );
        } );

        it( 'should reject description over 50 characters', async () => {
            const longDescription = 'a'.repeat( 51 );

            const result = await handlePersonalityCommand( {
                args: `save "TestPersonality" "${ longDescription }"`,
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'must be 50 characters or less' );
            expect( result.response ).toContain( '51' );
        } );

        it( 'should reject empty description', async () => {
            const result = await handlePersonalityCommand( {
                args: 'save "TestPersonality" ""',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Description required' );
        } );

        it( 'should reject reserved name "current"', async () => {
            const result = await handlePersonalityCommand( {
                args: 'save "current" "Test description"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'reserved' );
        } );

        it( 'should reject duplicate personality names', async () => {
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( {
                name: 'TestPersonality'
            } );

            const result = await handlePersonalityCommand( {
                args: 'save "TestPersonality" "Test description"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'already exists' );
        } );
    } );

    describe( 'update subcommand', () => {
        beforeEach( () => {
            mockServices.stateService.getUserRole.mockReturnValue( 'owner' );
            mockServices.dataService.getAllData.mockReturnValue( {
                botData: { CHAT_NAME: 'TestBot' },
                Instructions: { MLPersonality: 'Updated personality', MLInstructions: 'Updated instructions' },
                editableMessages: {},
                configuration: {},
                mlQuestions: {},
                disabledCommands: [],
                disabledFeatures: [],
                triggers: {},
                customTokens: {}
            } );
        } );

        it( 'should update existing personality', async () => {
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( {
                name: 'TestPersonality',
                description: 'Old description'
            } );

            const result = await handlePersonalityCommand( {
                args: 'update "TestPersonality"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'updated successfully' );
            expect( mockServices.databaseService.updatePersonality ).toHaveBeenCalled();
        } );

        it( 'should update personality with new description', async () => {
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( {
                name: 'TestPersonality',
                description: 'Old description'
            } );

            const result = await handlePersonalityCommand( {
                args: 'update "TestPersonality" "New description"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( mockServices.databaseService.updatePersonality ).toHaveBeenCalledWith(
                expect.objectContaining( {
                    description: 'New description'
                } )
            );
        } );

        it( 'should update "current" personality when active exists', async () => {
            mockServices.dataService.getValue.mockReturnValue( 'ActivePersonality' );
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( {
                name: 'ActivePersonality',
                description: 'Active description'
            } );

            const result = await handlePersonalityCommand( {
                args: 'update "current"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( mockServices.databaseService.getPersonalityByName ).toHaveBeenCalledWith( 'ActivePersonality' );
        } );

        it( 'should reject update of "current" when no active personality', async () => {
            mockServices.dataService.getValue.mockReturnValue( undefined );

            const result = await handlePersonalityCommand( {
                args: 'update "current"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'No active personality' );
        } );

        it( 'should reject description over 50 characters', async () => {
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( {
                name: 'TestPersonality',
                description: 'Old description'
            } );
            const longDescription = 'a'.repeat( 51 );

            const result = await handlePersonalityCommand( {
                args: `update "TestPersonality" "${ longDescription }"`,
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'must be 50 characters or less' );
        } );
    } );

    describe( 'activate subcommand', () => {
        it( 'should activate existing personality', async () => {
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( {
                name: 'TestPersonality',
                description: 'Test description',
                instructions: { MLPersonality: 'Test', MLInstructions: 'Instructions' },
                editableMessages: { welcomeMessage: 'Welcome!' },
                configuration: { botName: 'NewBotName' },
                mlQuestions: {},
                disabledCommands: [],
                disabledFeatures: [],
                triggers: {},
                customTokens: {}
            } );

            const result = await handlePersonalityCommand( {
                args: 'activate "TestPersonality"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'Activated' );
            expect( mockServices.dataService.setValue ).toHaveBeenCalledWith( 'activePersonality', 'TestPersonality' );
            expect( mockServices.dataService.setValue ).toHaveBeenCalledWith( 'botData.CHAT_NAME', 'NewBotName' );
            expect( mockServices.hangUserService.updateHangNickname ).toHaveBeenCalledWith( 'NewBotName' );
            
            // Verify loading message is sent first, then success message
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledTimes( 2 );
            expect( mockServices.messageService.sendResponse ).toHaveBeenNthCalledWith( 1, 
                expect.stringContaining( 'Loading new personality' ), 
                expect.any( Object ) 
            );
            expect( mockServices.messageService.sendResponse ).toHaveBeenNthCalledWith( 2, 
                expect.stringContaining( 'Activated' ), 
                expect.any( Object ) 
            );
        } );

        it( 'should reject reserved name "current"', async () => {
            const result = await handlePersonalityCommand( {
                args: 'activate "current"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'reserved' );
        } );

        it( 'should reject non-existent personality', async () => {
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( undefined );
            mockServices.databaseService.getAllPersonalities.mockResolvedValue( [] );

            const result = await handlePersonalityCommand( {
                args: 'activate "NonExistent"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'not found' );
        } );
    } );

    describe( 'delete subcommand', () => {
        beforeEach( () => {
            mockServices.stateService.getUserRole.mockReturnValue( 'owner' );
        } );

        it( 'should delete existing personality', async () => {
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( {
                name: 'TestPersonality'
            } );

            const result = await handlePersonalityCommand( {
                args: 'delete "TestPersonality"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'deleted' );
            expect( mockServices.databaseService.deletePersonality ).toHaveBeenCalledWith( 'TestPersonality' );
        } );

        it( 'should clear active personality if deleting active one', async () => {
            mockServices.dataService.getValue.mockReturnValue( 'TestPersonality' );
            mockServices.databaseService.getPersonalityByName.mockResolvedValue( {
                name: 'TestPersonality'
            } );

            const result = await handlePersonalityCommand( {
                args: 'delete "TestPersonality"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( mockServices.dataService.setValue ).toHaveBeenCalledWith( 'activePersonality', undefined );
        } );

        it( 'should reject reserved name "current"', async () => {
            const result = await handlePersonalityCommand( {
                args: 'delete "current"',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'reserved' );
        } );
    } );

    describe( 'database error handling', () => {
        it( 'should handle database not initialized', async () => {
            mockServices.databaseService.initialized = false;

            const result = await handlePersonalityCommand( {
                args: 'list',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Database not initialized' );
        } );

        it( 'should handle database errors gracefully', async () => {
            mockServices.databaseService.getAllPersonalities.mockRejectedValue( new Error( 'Database error' ) );

            const result = await handlePersonalityCommand( {
                args: 'list',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Failed to list personalities' );
        } );
    } );

    describe( 'response channel routing', () => {
        it( 'should route to correct response channel', async () => {
            mockServices.dataService.getValue.mockReturnValue( undefined );
            mockServices.databaseService.getAllPersonalities.mockResolvedValue( [] );

            await handlePersonalityCommand( {
                args: 'list',
                services: mockServices,
                context: mockContext,
                responseChannel: 'private'
            } );

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.any( String ),
                expect.objectContaining( {
                    responseChannel: 'private'
                } )
            );
        } );

        it( 'should handle private messages correctly', async () => {
            mockServices.dataService.getValue.mockReturnValue( undefined );
            mockServices.databaseService.getAllPersonalities.mockResolvedValue( [] );
            mockContext.fullMessage.isPrivateMessage = true;

            await handlePersonalityCommand( {
                args: 'list',
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.any( String ),
                expect.objectContaining( {
                    isPrivateMessage: true
                } )
            );
        } );
    } );
} );
