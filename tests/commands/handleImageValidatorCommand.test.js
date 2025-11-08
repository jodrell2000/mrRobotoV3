// tests/commands/handleImageValidatorCommand.test.js
jest.mock( '../../src/lib/logging.js', () => ( {
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
} ) );

const handleImageValidatorCommand = require( '../../src/commands/handleImageValidatorCommand.js' );

describe( 'handleImageValidatorCommand', () => {
    let services;
    let context;

    beforeEach( () => {
        jest.clearAllMocks();

        services = {
            validationService: {
                startValidation: jest.fn(),
                getStatus: jest.fn(),
                getReport: jest.fn(),
                removeDeadImages: jest.fn()
            },
            messageService: {
                sendResponse: jest.fn()
            },
            dataService: {
                getValue: jest.fn(),
                setValue: jest.fn()
            }
        };

        context = {
            sender: {
                uuid: 'user-123',
                userProfile: {
                    id: 'user-id',
                    nickname: 'TestUser'
                },
                role: 'MODERATOR'
            },
            fullMessage: {
                isPrivateMessage: false
            },
            room: {
                name: 'TestRoom'
            }
        };
    } );

    describe( 'command metadata', () => {
        it( 'should have requiredRole of MODERATOR', () => {
            expect( handleImageValidatorCommand.requiredRole ).toBe( 'MODERATOR' );
        } );

        it( 'should have description', () => {
            expect( handleImageValidatorCommand.description ).toBeDefined();
            expect( typeof handleImageValidatorCommand.description ).toBe( 'string' );
        } );

        it( 'should have example', () => {
            expect( handleImageValidatorCommand.example ).toBeDefined();
            expect( typeof handleImageValidatorCommand.example ).toBe( 'string' );
        } );

        it( 'should not be hidden', () => {
            expect( handleImageValidatorCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'start subcommand', () => {
        it( 'should start validation with no args', async () => {
            services.validationService.startValidation.mockResolvedValue( {
                success: true,
                message: 'Starting image validation...'
            } );

            const result = await handleImageValidatorCommand( {
                args: 'start',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( services.validationService.startValidation ).toHaveBeenCalledWith( services.dataService );
            expect( services.messageService.sendResponse ).toHaveBeenCalled();
            expect( result.success ).toBe( true );
        } );

        it( 'should handle start with checkOldest argument', async () => {
            services.validationService.startValidation.mockResolvedValue( {
                success: true,
                message: 'Validating images older than 30 days...'
            } );

            const result = await handleImageValidatorCommand( {
                args: 'start checkOldest',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( result.success ).toBe( true );
        } );

        it( 'should handle validation already in progress', async () => {
            services.validationService.startValidation.mockResolvedValue( {
                success: false,
                message: 'Validation already in progress'
            } );

            const result = await handleImageValidatorCommand( {
                args: 'start',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( result.success ).toBe( false );
            expect( services.messageService.sendResponse ).toHaveBeenCalled();
        } );
    } );

    describe( 'status subcommand', () => {
        it( 'should return validation status', async () => {
            services.validationService.getStatus.mockReturnValue( {
                isValidating: true,
                message: 'Validated 100/200 images',
                deadFound: 5
            } );

            const result = await handleImageValidatorCommand( {
                args: 'status',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( services.validationService.getStatus ).toHaveBeenCalled();
            expect( services.messageService.sendResponse ).toHaveBeenCalled();
            expect( result.success ).toBe( true );
        } );

        it( 'should show not validating status', async () => {
            services.validationService.getStatus.mockReturnValue( {
                isValidating: false
            } );

            const result = await handleImageValidatorCommand( {
                args: 'status',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( result.success ).toBe( false );
            expect( services.messageService.sendResponse ).toHaveBeenCalled();
        } );
    } );

    describe( 'report subcommand', () => {
        it( 'should return dead images report', async () => {
            services.validationService.getReport.mockReturnValue( {
                dead: {
                    cmd1: [ 'https://dead1.jpg' ],
                    cmd2: [ 'https://dead2.jpg' ]
                },
                summary: '2 dead images found'
            } );

            const result = await handleImageValidatorCommand( {
                args: 'report',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( services.validationService.getReport ).toHaveBeenCalled();
            expect( services.messageService.sendResponse ).toHaveBeenCalled();
            expect( result.success ).toBe( true );
        } );

        it( 'should show no dead images message', async () => {
            services.validationService.getReport.mockReturnValue( {
                dead: {},
                summary: 'No dead images found'
            } );

            const result = await handleImageValidatorCommand( {
                args: 'report',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( result.success ).toBe( true );
            expect( services.messageService.sendResponse ).toHaveBeenCalled();
        } );
    } );

    describe( 'remove subcommand', () => {
        it( 'should remove dead images', async () => {
            services.validationService.getReport.mockReturnValue( {
                dead: {
                    cmd1: [ 'https://dead.jpg' ]
                },
                summary: '1 dead image found'
            } );

            services.validationService.removeDeadImages.mockResolvedValue( {
                success: true,
                message: 'Removed 1 dead image'
            } );

            const result = await handleImageValidatorCommand( {
                args: 'remove',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( services.validationService.removeDeadImages ).toHaveBeenCalledWith( services.dataService );
            expect( services.messageService.sendResponse ).toHaveBeenCalled();
            expect( result.success ).toBe( true );
        } );

        it( 'should handle no dead images to remove', async () => {
            services.validationService.getReport.mockReturnValue( {
                dead: {},
                summary: 'No dead images found'
            } );

            const result = await handleImageValidatorCommand( {
                args: 'remove',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( result.success ).toBe( false );
            expect( services.messageService.sendResponse ).toHaveBeenCalled();
        } );
    } );

    describe( 'error handling', () => {
        it( 'should handle invalid subcommand', async () => {
            const result = await handleImageValidatorCommand( {
                args: 'invalid',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( result.success ).toBe( false );
            expect( services.messageService.sendResponse ).toHaveBeenCalled();
        } );

        it( 'should handle missing subcommand', async () => {
            const result = await handleImageValidatorCommand( {
                args: '',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( result.success ).toBe( false );
            expect( services.messageService.sendResponse ).toHaveBeenCalled();
        } );

        it( 'should handle service errors', async () => {
            services.validationService.startValidation.mockRejectedValue( new Error( 'Service error' ) );

            const result = await handleImageValidatorCommand( {
                args: 'start',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
        } );
    } );

    describe( 'response format', () => {
        it( 'should return response object with required fields', async () => {
            services.validationService.getStatus.mockReturnValue( {
                isValidating: false
            } );

            const result = await handleImageValidatorCommand( {
                args: 'status',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( result ).toHaveProperty( 'success' );
            expect( result ).toHaveProperty( 'shouldRespond' );
            expect( result ).toHaveProperty( 'response' );
        } );

        it( 'should call sendResponse with correct parameters', async () => {
            services.validationService.getStatus.mockReturnValue( {
                isValidating: false
            } );

            await handleImageValidatorCommand( {
                args: 'status',
                command: 'imagevalidator',
                services,
                context
            } );

            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.any( String ),
                {
                    responseChannel: 'request',
                    isPrivateMessage: false,
                    sender: context.sender,
                    services
                }
            );
        } );
    } );
} );
