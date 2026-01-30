jest.mock( '../../src/lib/textUtils', () => ( {
    getMappings: jest.fn(),
    addMapping: jest.fn(),
    removeMapping: jest.fn(),
    normalizeText: jest.fn(),
    clearCache: jest.fn()
} ) );

const handleCharmapCommand = require( '../../src/commands/Edit Commands/handleCharmapCommand' );
const { getMappings, addMapping, removeMapping, normalizeText, clearCache } = require( '../../src/lib/textUtils' );

describe( 'handleCharmapCommand', () => {
    let mockServices;
    let mockContext;

    beforeEach( () => {
        jest.clearAllMocks();

        mockServices = {
            messageService: {
                sendResponse: jest.fn().mockResolvedValue( {} )
            },
            logger: {
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            }
        };

        mockContext = {
            sender: { uuid: 'test-uuid' },
            fullMessage: { isPrivateMessage: false }
        };

        // Default mocks
        getMappings.mockReturnValue( {
            'ᕼ': 'H',
            'ᖇ': 'R',
            'ᗩ': 'A'
        } );
        addMapping.mockReturnValue( { success: true, message: 'Added mapping: "ᘔ" → "Z"' } );
        removeMapping.mockReturnValue( { success: true, message: 'Removed mapping: "ᕼ" → "H"' } );
        normalizeText.mockImplementation( text => text.replace( 'ᕼ', 'H' ) );
        clearCache.mockReturnValue( undefined );
    } );

    describe( 'metadata', () => {
        it( 'should have correct metadata properties', () => {
            expect( handleCharmapCommand.requiredRole ).toBe( 'OWNER' );
            expect( handleCharmapCommand.description ).toBe( 'Manage special character to ASCII mappings' );
            expect( handleCharmapCommand.example ).toBeDefined();
            expect( handleCharmapCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'no arguments', () => {
        it( 'should show help when no args provided', async () => {
            const result = await handleCharmapCommand( {
                args: '',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'Character Mapping Commands' );
            expect( result.response ).toContain( 'charmap list' );
            expect( result.response ).toContain( 'charmap add' );
            expect( result.response ).toContain( 'charmap remove' );
            expect( result.response ).toContain( 'charmap test' );
        } );
    } );

    describe( 'list subcommand', () => {
        it( 'should list all character mappings grouped by ASCII', async () => {
            const result = await handleCharmapCommand( {
                args: 'list',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'Character Mappings' );
            expect( result.response ).toContain( '3 total' );
            expect( getMappings ).toHaveBeenCalled();
        } );

        it( 'should handle empty mappings', async () => {
            getMappings.mockReturnValue( {} );

            const result = await handleCharmapCommand( {
                args: 'list',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'No character mappings defined' );
        } );
    } );

    describe( 'add subcommand', () => {
        it( 'should add a character mapping', async () => {
            const result = await handleCharmapCommand( {
                args: 'add ᘔ Z',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( '✅' );
            expect( addMapping ).toHaveBeenCalledWith( 'ᘔ', 'Z' );
        } );

        it( 'should require both arguments', async () => {
            const result = await handleCharmapCommand( {
                args: 'add ᘔ',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Please provide the character and its replacement' );
        } );

        it( 'should handle add failure', async () => {
            addMapping.mockReturnValue( { success: false, message: 'Failed to save' } );

            const result = await handleCharmapCommand( {
                args: 'add ᘔ Z',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( '❌' );
        } );
    } );

    describe( 'remove subcommand', () => {
        it( 'should remove a character mapping', async () => {
            const result = await handleCharmapCommand( {
                args: 'remove ᕼ',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( '✅' );
            expect( removeMapping ).toHaveBeenCalledWith( 'ᕼ' );
        } );

        it( 'should require character argument', async () => {
            const result = await handleCharmapCommand( {
                args: 'remove',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Please specify the character to remove' );
        } );

        it( 'should handle remove failure', async () => {
            removeMapping.mockReturnValue( { success: false, message: 'No mapping found' } );

            const result = await handleCharmapCommand( {
                args: 'remove ᘔ',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( '❌' );
        } );
    } );

    describe( 'test subcommand', () => {
        it( 'should test text normalization', async () => {
            const result = await handleCharmapCommand( {
                args: 'test ᕼello World',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'Original:' );
            expect( result.response ).toContain( 'Normalized:' );
            expect( normalizeText ).toHaveBeenCalledWith( 'ᕼello World' );
        } );

        it( 'should require text argument', async () => {
            const result = await handleCharmapCommand( {
                args: 'test',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Please provide text to test' );
        } );
    } );

    describe( 'reload subcommand', () => {
        it( 'should reload mappings from file', async () => {
            const result = await handleCharmapCommand( {
                args: 'reload',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( true );
            expect( result.response ).toContain( 'Reloaded' );
            expect( clearCache ).toHaveBeenCalled();
            expect( getMappings ).toHaveBeenCalled();
        } );
    } );

    describe( 'unknown subcommand', () => {
        it( 'should handle unknown subcommand', async () => {
            const result = await handleCharmapCommand( {
                args: 'unknown',
                services: mockServices,
                context: mockContext,
                responseChannel: 'request'
            } );

            expect( result.success ).toBe( false );
            expect( result.response ).toContain( 'Unknown subcommand' );
        } );
    } );
} );
