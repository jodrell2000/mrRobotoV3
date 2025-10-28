const handleConnectivityCommand = require( '../../src/commands/System Admin/handleConnectivityCommand' );

// Mock the config
jest.mock( '../../src/config.js', () => ( {
    COMMAND_SWITCH: '!'
} ) );

describe( 'handleConnectivityCommand', () => {
    let mockServices;
    let mockContext;

    beforeEach( () => {
        mockServices = {
            messageService: {
                sendResponse: jest.fn().mockResolvedValue()
            },
            retryService: {
                getAllCircuitStatuses: jest.fn(),
                resetCircuitBreaker: jest.fn()
            }
        };

        mockContext = {
            fullMessage: { isPrivateMessage: false },
            sender: 'testUser'
        };

        jest.clearAllMocks();
    } );

    describe( 'metadata', () => {
        it( 'should have correct metadata', () => {
            expect( handleConnectivityCommand.requiredRole ).toBe( 'MODERATOR' );
            expect( handleConnectivityCommand.description ).toBe( 'Monitor CometChat API connection status and circuit breakers' );
            expect( handleConnectivityCommand.example ).toBe( 'connectivity' );
            expect( handleConnectivityCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'status display', () => {
        it( 'should show healthy status when no circuit breakers exist', async () => {
            mockServices.retryService.getAllCircuitStatuses.mockReturnValue( {} );

            const result = await handleConnectivityCommand( {
                command: 'connectivity',
                args: [],
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'No connection issues detected' ),
                expect.any( Object )
            );
        } );

        it( 'should show circuit breaker statuses', async () => {
            const mockStatuses = {
                'cometchat-fetchMessages': {
                    state: 'CLOSED',
                    failureCount: 0,
                    lastFailureTime: null
                },
                'cometchat-sendMessage': {
                    state: 'OPEN',
                    failureCount: 5,
                    lastFailureTime: Date.now() - 60000 // 1 minute ago
                }
            };

            mockServices.retryService.getAllCircuitStatuses.mockReturnValue( mockStatuses );

            const result = await handleConnectivityCommand( {
                command: 'connectivity',
                args: [],
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            const response = mockServices.messageService.sendResponse.mock.calls[ 0 ][ 0 ];
            expect( response ).toContain( 'Circuit Breaker Status' );
            expect( response ).toContain( 'cometchat-fetchMessages' );
            expect( response ).toContain( 'cometchat-sendMessage' );
            expect( response ).toContain( 'CLOSED' );
            expect( response ).toContain( 'OPEN' );
        } );
    } );

    describe( 'reset functionality', () => {
        it( 'should reset all circuit breakers', async () => {
            const mockStatuses = {
                'cometchat-fetchMessages': { state: 'OPEN', failureCount: 3 },
                'cometchat-sendMessage': { state: 'CLOSED', failureCount: 1 }
            };

            mockServices.retryService.getAllCircuitStatuses.mockReturnValue( mockStatuses );

            const result = await handleConnectivityCommand( {
                command: 'connectivity',
                args: [ 'reset', 'all' ],
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( mockServices.retryService.resetCircuitBreaker ).toHaveBeenCalledWith( 'cometchat-fetchMessages' );
            expect( mockServices.retryService.resetCircuitBreaker ).toHaveBeenCalledWith( 'cometchat-sendMessage' );

            const response = mockServices.messageService.sendResponse.mock.calls[ 0 ][ 0 ];
            expect( response ).toContain( 'Reset 2 circuit breakers' );
        } );

        it( 'should reset specific circuit breaker', async () => {
            const mockStatuses = {
                'cometchat-fetchMessages': { state: 'OPEN', failureCount: 3 },
                'cometchat-sendMessage': { state: 'CLOSED', failureCount: 1 }
            };

            mockServices.retryService.getAllCircuitStatuses.mockReturnValue( mockStatuses );

            const result = await handleConnectivityCommand( {
                command: 'connectivity',
                args: [ 'reset', 'fetch' ], // Using partial match that should work
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( true );
            expect( mockServices.retryService.resetCircuitBreaker ).toHaveBeenCalledWith( 'cometchat-fetchMessages' );

            const response = mockServices.messageService.sendResponse.mock.calls[ 0 ][ 0 ];
            expect( response ).toContain( 'Reset circuit breaker for: cometchat-fetchMessages' );
        } );

        it( 'should handle unknown endpoint reset', async () => {
            mockServices.retryService.getAllCircuitStatuses.mockReturnValue( {
                'cometchat-fetchMessages': { state: 'OPEN' }
            } );

            const result = await handleConnectivityCommand( {
                command: 'connectivity',
                args: [ 'reset', 'unknown' ],
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            const response = mockServices.messageService.sendResponse.mock.calls[ 0 ][ 0 ];
            expect( response ).toContain( "Endpoint 'unknown' not found" );
        } );

        it( 'should handle reset without arguments', async () => {
            const result = await handleConnectivityCommand( {
                command: 'connectivity',
                args: [ 'reset' ],
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            const response = mockServices.messageService.sendResponse.mock.calls[ 0 ][ 0 ];
            expect( response ).toContain( 'Usage: `!connectivity reset <endpoint|all>`' );
        } );
    } );

    describe( 'error handling', () => {
        it( 'should handle service errors gracefully', async () => {
            mockServices.retryService.getAllCircuitStatuses.mockImplementation( () => {
                throw new Error( 'Service unavailable' );
            } );

            const result = await handleConnectivityCommand( {
                command: 'connectivity',
                args: [],
                services: mockServices,
                context: mockContext,
                responseChannel: 'public'
            } );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Service unavailable' );

            const response = mockServices.messageService.sendResponse.mock.calls[ 0 ][ 0 ];
            expect( response ).toContain( 'Failed to get connectivity status' );
        } );
    } );
} );