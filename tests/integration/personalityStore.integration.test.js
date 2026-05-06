const DatabaseService = require('../../src/services/databaseService');
const handlePersonalityCommand = require('../../src/commands/Edit Commands/handlePersonalityCommand');
const fs = require('fs');
const path = require('path');

const TEST_DB_PATH = path.join(__dirname, '../test-data/test-personality.db');

describe('Personality Store Integration Tests', () => {
    let databaseService;
    let mockServices;
    let mockContext;

    beforeAll(() => {
        const testDataDir = path.join(__dirname, '../test-data');
        if (!fs.existsSync(testDataDir)) {
            fs.mkdirSync(testDataDir, { recursive: true });
        }
    });

    beforeEach(async () => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }

        const logger = {
            info: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
        };
        
        databaseService = new DatabaseService(logger);
        databaseService.dbPath = TEST_DB_PATH;
        await databaseService.initialize();

        mockServices = {
            messageService: {
                sendResponse: jest.fn().mockResolvedValue({ success: true })
            },
            dataService: {
                getAllData: jest.fn().mockReturnValue({
                    Instructions: {
                        MLPersonality: 'You are a friendly bot',
                        MLInstructions: 'Be helpful and accurate'
                    },
                    editableMessages: {
                        welcomeMessage: 'Welcome {username}!'
                    },
                    configuration: {
                        timezone: 'UTC'
                    },
                    mlQuestions: {},
                    disabledCommands: [],
                    disabledFeatures: [],
                    triggers: {},
                    customTokens: {}
                }),
                getValue: jest.fn(),
                setValue: jest.fn().mockResolvedValue(),
                loadData: jest.fn().mockResolvedValue()
            },
            databaseService,
            logger
        };

        mockContext = {
            sender: 'testuser',
            fullMessage: { isPrivateMessage: false }
        };
    });

    afterEach(() => {
        if (databaseService?.db) {
            databaseService.db.close();
        }
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    afterAll(() => {
        const testDataDir = path.join(__dirname, '../test-data');
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });

    test('Full lifecycle: save → list → activate → update → delete', async () => {
        console.log('DB transaction method exists:', typeof databaseService.db.transaction);
        console.log('DB prepare method exists:', typeof databaseService.db.prepare);
        
        const saveResult = await handlePersonalityCommand({
            args: 'save "TestMode" "Test personality"',
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });
        
        if (!saveResult.success) {
            console.log('Save failed:', saveResult.response, saveResult.error);
        }
        
        expect(saveResult.success).toBe(true);

        const listResult = await handlePersonalityCommand({
            args: 'list',
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });
        expect(listResult.success).toBe(true);
        expect(listResult.response).toContain('TestMode');

        const personalities = await databaseService.getAllPersonalities();
        expect(personalities).toHaveLength(1);
        expect(personalities[0].description).toBe('Test personality');

        const activateResult = await handlePersonalityCommand({
            args: 'activate "TestMode"',
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });
        expect(activateResult.success).toBe(true);

        const updateResult = await handlePersonalityCommand({
            args: 'update "TestMode" "Updated description"',
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });
        expect(updateResult.success).toBe(true);

        const updated = await databaseService.getPersonalityByName('TestMode');
        expect(updated.description).toBe('Updated description');

        mockServices.dataService.getValue.mockReturnValue('TestMode');
        const deleteResult = await handlePersonalityCommand({
            args: 'delete "TestMode"',
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });
        expect(deleteResult.success).toBe(true);

        const finalList = await databaseService.getAllPersonalities();
        expect(finalList).toHaveLength(0);
    });

    test('Case-insensitive name lookups', async () => {
        await handlePersonalityCommand({
            args: 'save "TestMode" "Description"',
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });

        const showResult = await handlePersonalityCommand({
            args: 'show "testmode"',
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });
        expect(showResult.success).toBe(true);
    });

    test('Prevents duplicate names with different cases', async () => {
        await handlePersonalityCommand({
            args: 'save "TestMode" "First"',
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });

        const result = await handlePersonalityCommand({
            args: 'save "testmode" "Second"',
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });
        expect(result.success).toBe(false);
    });

    test('Enforces description requirement', async () => {
        const result = await handlePersonalityCommand({
            args: 'save "TestMode"',
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });
        expect(result.success).toBe(false);
    });

    test('Enforces 50 character description limit', async () => {
        const longDesc = 'a'.repeat(51);
        const result = await handlePersonalityCommand({
            args: `save "TestMode" "${longDesc}"`,
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });
        expect(result.success).toBe(false);
    });

    test('Allows exactly 50 characters', async () => {
        const maxDesc = 'a'.repeat(50);
        const result = await handlePersonalityCommand({
            args: `save "TestMode" "${maxDesc}"`,
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });
        expect(result.success).toBe(true);
    });

    test('Preserves complex data structures', async () => {
        mockServices.dataService.getAllData.mockReturnValue({
            Instructions: { MLPersonality: 'Test', MLInstructions: 'Test' },
            editableMessages: {},
            configuration: {},
            mlQuestions: {},
            disabledCommands: [],
            disabledFeatures: [],
            triggers: {
                exact: [{ pattern: 'hello', response: 'hi' }]
            },
            customTokens: {}
        });

        await handlePersonalityCommand({
            args: 'save "ComplexMode" "Complex data"',
            services: mockServices,
            context: mockContext,
            responseChannel: 'public'
        });

        const personality = await databaseService.getPersonalityByName('ComplexMode');
        expect(personality.triggers.exact).toHaveLength(1);
        expect(personality.triggers.exact[0].pattern).toBe('hello');
    });
});
