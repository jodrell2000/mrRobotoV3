// Mock the Logger module
jest.mock( '../../src/lib/logging', () => ( {
    logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    }
} ) );

// Mock the RetryService module
jest.mock( '../../src/services/retryService', () => {
    return jest.fn().mockImplementation( () => ( {
        executeWithRetry: jest.fn(),
        getCircuitStatus: jest.fn(),
        resetCircuitBreaker: jest.fn(),
        isCircuitOpen: jest.fn()
    } ) );
} );

// Mock the CometChatApi module
jest.mock( '../../src/services/cometchatApi', () => ( {
    setRetryService: jest.fn(),
    // Add any methods that CometChatApi uses
} ) );

// Mock the MessageService module
jest.mock( '../../src/services/messageService', () => ( {
    messageService: {
        sendGroupMessage: jest.fn(),
        fetchGroupMessages: jest.fn(),
        joinChat: jest.fn(),
        // Add other methods as needed
    }
} ) );

// Mock the PrivateMessageService module
jest.mock( '../../src/services/privateMessageService', () => ( {
    fetchAllPrivateUserMessages: jest.fn(),
    sendPrivateMessage: jest.fn(),
    markAllPrivateUserMessagesAsRead: jest.fn(),
    // Add other methods as needed
} ) );

// Mock parseCommands
jest.mock( '../../src/services/parseCommands', () => ( {
    parseCommands: jest.fn()
} ) );

const serviceContainer = require( '../../src/services/serviceContainer' );

describe( 'ServiceContainer', () => {
    let container;
    let mockConfig;

    beforeEach( () => {
        mockConfig = {
            HANGOUT_ID: 'test-hangout-123',
            BOT_USER_TOKEN: 'test-bot-token-456',
            BOT_UID: 'test-bot-uid-789',
            COMMAND_SWITCH: '!',
            SOCKET_MESSAGE_LOG_LEVEL: 'ON'
        };
        // Use the singleton serviceContainer directly
        container = serviceContainer;
    } );

    test( 'should initialize with config and basic services', () => {
        expect( container.config ).toBeDefined();
        expect( container.logger ).toBeDefined();
        expect( container.parseCommands ).toBeDefined();
        expect( container.messageService ).toBeDefined();
        expect( container.hangoutState ).toEqual( {} );
    } );

    test( 'initializeStateService should throw error if hangoutState is empty', () => {
        expect( () => container.initializeStateService() ).toThrow( 'Cannot initialize StateService: hangoutState is empty' );
    } );

    test( 'initializeStateService should create stateService when hangoutState is set', () => {
        const mockState = {
            allUsers: [],
            allUserData: {},
            djs: [],
            settings: {}
        };
        container.hangoutState = mockState;
        container.initializeStateService();

        expect( container.stateService ).toBeDefined();
        expect( container.stateService.hangoutState ).toBe( mockState );
    } );

    test( 'updateLastMessageId should update lastMessageId', () => {
        const messageId = '123';
        container.updateLastMessageId( messageId );
        expect( container.hangoutState.lastMessageId ).toBe( messageId );
    } );

    test( 'should have all expected services available', () => {
        expect( container.config ).toBeDefined();
        expect( container.logger ).toBeDefined();
        expect( container.parseCommands ).toBeDefined();
        expect( container.messageService ).toBeDefined();
        expect( container.privateMessageService ).toBeDefined();
        expect( container.commandService ).toBeDefined();
        expect( container.hangUserService ).toBeDefined();
        expect( container.dataService ).toBeDefined();
        expect( container.hangoutState ).toBeDefined();
    } );
} );
