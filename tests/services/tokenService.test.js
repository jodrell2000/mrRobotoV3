const TokenService = require( '../../src/services/tokenService.js' );

// Mock fs to prevent real file operations during tests
jest.mock( 'fs', () => ( {
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    existsSync: jest.fn(),
    mkdirSync: jest.fn()
} ) );

describe( 'TokenService', () => {
    let tokenService;
    let mockServices;

    beforeEach( () => {
        mockServices = {
            dataService: {
                loadData: jest.fn(),
                getValue: jest.fn(),
                setValue: jest.fn()
            },
            stateService: {
                getHangoutName: jest.fn().mockReturnValue( 'Test Hangout' )
            },
            getState: jest.fn( ( key ) => {
                if ( key === 'botNickname' ) return 'Test Bot';
                return undefined;
            } ),
            logger: {
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            }
        };

        // Mock configuration values
        mockServices.dataService.getValue.mockImplementation( ( key ) => {
            if ( key === 'configuration.timezone' ) return 'Europe/London';
            if ( key === 'configuration.locale' ) return 'en-GB';
            if ( key === 'configuration.timeFormat' ) return '24';
            if ( key === 'customTokens' ) return {};
            return undefined;
        } );

        tokenService = new TokenService( mockServices );
    } );

    afterEach( () => {
        jest.clearAllMocks();
    } );

    describe( 'getAllTokens', () => {
        it( 'should return built-in tokens when no custom tokens exist', async () => {
            mockServices.dataService.getValue.mockReturnValue( undefined );

            const tokens = await tokenService.getAllTokens();

            expect( tokens ).toHaveProperty( '{hangoutName}' );
            expect( tokens ).toHaveProperty( '{botName}' );
            expect( tokens ).toHaveProperty( '{currentTime}' );
            expect( tokens ).toHaveProperty( '{currentDate}' );
            expect( tokens ).toHaveProperty( '{currentDayOfWeek}' );
        } );

        it( 'should merge built-in and custom tokens', async () => {
            const customTokens = {
                '{customToken}': {
                    value: 'custom value',
                    description: 'A custom token'
                }
            };
            mockServices.dataService.getValue.mockReturnValue( customTokens );

            const tokens = await tokenService.getAllTokens();

            expect( tokens ).toHaveProperty( '{hangoutName}' );
            expect( tokens ).toHaveProperty( '{customToken}' );
        } );
    } );

    describe( 'setCustomToken', () => {
        it( 'should add a custom token successfully', async () => {
            mockServices.dataService.getValue.mockReturnValue( {} );
            mockServices.dataService.setValue.mockResolvedValue();

            const result = await tokenService.setCustomToken( 'testToken', 'test value', 'Test description' );

            expect( result.success ).toBe( true );
            expect( result.tokenName ).toBe( '{testToken}' );
            expect( mockServices.dataService.setValue ).toHaveBeenCalledWith(
                'customTokens',
                expect.objectContaining( {
                    '{testToken}': expect.objectContaining( {
                        value: 'test value',
                        description: 'Test description',
                        type: 'static'
                    } )
                } )
            );
        } );

        it( 'should normalize token name to include braces', async () => {
            mockServices.dataService.getValue.mockReturnValue( {} );
            mockServices.dataService.setValue.mockResolvedValue();

            const result = await tokenService.setCustomToken( '{testToken}', 'test value' );

            expect( result.tokenName ).toBe( '{testToken}' );
        } );

        it( 'should handle function values as dynamic tokens', async () => {
            mockServices.dataService.getValue.mockReturnValue( {} );
            mockServices.dataService.setValue.mockResolvedValue();

            const testFunction = () => 'dynamic value';
            const result = await tokenService.setCustomToken( 'dynamicToken', testFunction );

            expect( result.success ).toBe( true );
            expect( mockServices.dataService.setValue ).toHaveBeenCalledWith(
                'customTokens',
                expect.objectContaining( {
                    '{dynamicToken}': expect.objectContaining( {
                        type: 'dynamic'
                    } )
                } )
            );
        } );

        it( 'should return error when dataService is not available', async () => {
            tokenService.services.dataService = null;

            const result = await tokenService.setCustomToken( 'testToken', 'test value' );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'DataService not available' );
        } );
    } );

    describe( 'removeCustomToken', () => {
        it( 'should remove a custom token successfully', async () => {
            const existingTokens = {
                '{testToken}': {
                    value: 'test value',
                    description: 'Test token'
                }
            };
            mockServices.dataService.getValue.mockReturnValue( existingTokens );
            mockServices.dataService.setValue.mockResolvedValue();

            const result = await tokenService.removeCustomToken( 'testToken' );

            expect( result.success ).toBe( true );
            expect( mockServices.dataService.setValue ).toHaveBeenCalledWith( 'customTokens', {} );
        } );

        it( 'should return error when token does not exist', async () => {
            mockServices.dataService.getValue.mockReturnValue( {} );

            const result = await tokenService.removeCustomToken( 'nonExistentToken' );

            expect( result.success ).toBe( false );
            expect( result.error ).toBe( 'Token {nonExistentToken} not found' );
        } );
    } );

    describe( 'replaceTokens', () => {
        it( 'should replace built-in tokens in text', async () => {
            mockServices.dataService.getValue.mockReturnValue( {} );

            const text = 'Welcome to {hangoutName}, {botName}!';
            const result = await tokenService.replaceTokens( text );

            expect( result ).toContain( 'Test Hangout' );
            expect( result ).toContain( 'Test Bot' );
        } );

        it( 'should replace context tokens in text', async () => {
            mockServices.dataService.getValue.mockReturnValue( {} );

            const text = 'Now playing {trackName} by {artistName}';
            const context = {
                trackName: 'Test Song',
                artistName: 'Test Artist'
            };
            const result = await tokenService.replaceTokens( text, context );

            expect( result ).toBe( 'Now playing Test Song by Test Artist' );
        } );

        it( 'should replace custom tokens in text', async () => {
            const customTokens = {
                '{greeting}': {
                    value: 'Hello there!'
                }
            };
            mockServices.dataService.getValue.mockReturnValue( customTokens );

            const text = '{greeting} Welcome to {hangoutName}!';
            const result = await tokenService.replaceTokens( text );

            expect( result ).toContain( 'Hello there!' );
            expect( result ).toContain( 'Test Hangout' );
        } );

        it( 'should handle function-based custom tokens', async () => {
            const customTokens = {
                '{dynamicGreeting}': {
                    value: () => 'Dynamic Hello!'
                }
            };
            mockServices.dataService.getValue.mockReturnValue( customTokens );

            const text = '{dynamicGreeting} How are you?';
            const result = await tokenService.replaceTokens( text );

            expect( result ).toBe( 'Dynamic Hello! How are you?' );
        } );

        it( 'should return original text when no tokens are found', async () => {
            mockServices.dataService.getValue.mockReturnValue( {} );

            const text = 'This text has no tokens';
            const result = await tokenService.replaceTokens( text );

            expect( result ).toBe( text );
        } );

        it( 'should handle non-string input gracefully', async () => {
            const result = await tokenService.replaceTokens( null );
            expect( result ).toBe( null );

            const result2 = await tokenService.replaceTokens( 123 );
            expect( result2 ).toBe( 123 );
        } );
    } );

    describe( 'getTokenList', () => {
        it( 'should return list of built-in and custom tokens', async () => {
            const customTokens = {
                '{customToken}': {
                    value: 'custom value',
                    description: 'Custom token',
                    type: 'static',
                    createdAt: '2023-01-01T00:00:00.000Z'
                }
            };
            mockServices.dataService.getValue.mockReturnValue( customTokens );

            const tokenList = await tokenService.getTokenList();

            const builtInTokens = tokenList.filter( token => token.type === 'built-in' );
            const customTokensList = tokenList.filter( token => token.type === 'custom' );

            expect( builtInTokens.length ).toBeGreaterThan( 0 );
            expect( customTokensList.length ).toBe( 1 );
            expect( customTokensList[ 0 ].name ).toBe( '{customToken}' );
            expect( customTokensList[ 0 ].description ).toBe( 'Custom token' );
        } );

        it( 'should return only built-in tokens when no custom tokens exist', async () => {
            mockServices.dataService.getValue.mockReturnValue( {} );

            const tokenList = await tokenService.getTokenList();

            const customTokensList = tokenList.filter( token => token.type === 'custom' );
            const builtInTokens = tokenList.filter( token => token.type === 'built-in' );

            expect( customTokensList.length ).toBe( 0 );
            expect( builtInTokens.length ).toBeGreaterThan( 0 );
        } );
    } );

    describe( 'getBuiltInTokenDescription', () => {
        it( 'should return correct descriptions for built-in tokens', () => {
            expect( tokenService.getBuiltInTokenDescription( '{hangoutName}' ) ).toBe( 'Name of the current hangout' );
            expect( tokenService.getBuiltInTokenDescription( '{botName}' ) ).toBe( 'Current bot nickname' );
            expect( tokenService.getBuiltInTokenDescription( '{currentTime}' ) ).toBe( 'Current time' );
        } );

        it( 'should return default description for unknown tokens', () => {
            expect( tokenService.getBuiltInTokenDescription( '{unknownToken}' ) ).toBe( 'Built-in token' );
        } );
    } );

    describe( 'timezone configuration', () => {
        it( 'should use configured timezone for time formatting', () => {
            const time = tokenService.getCurrentTime();
            expect( typeof time ).toBe( 'string' );
            expect( time.length ).toBeGreaterThan( 0 );
        } );

        it( 'should use configured timezone for date formatting', () => {
            const date = tokenService.getCurrentDate();
            expect( typeof date ).toBe( 'string' );
            expect( date.length ).toBeGreaterThan( 0 );
        } );

        it( 'should use configured timezone for day of week formatting', () => {
            const dayOfWeek = tokenService.getCurrentDayOfWeek();
            expect( typeof dayOfWeek ).toBe( 'string' );
            expect( dayOfWeek.length ).toBeGreaterThan( 0 );
        } );

        it( 'should fallback to UK timezone when configuration is not available', () => {
            mockServices.dataService.getValue.mockImplementation( ( key ) => {
                if ( key === 'customTokens' ) return {};
                return undefined; // Simulate missing config
            } );

            const time = tokenService.getCurrentTime();
            expect( typeof time ).toBe( 'string' );
            expect( time.length ).toBeGreaterThan( 0 );
        } );

        it( 'should handle errors gracefully in time formatting', () => {
            // Mock an error in the configuration
            mockServices.dataService.getValue.mockImplementation( ( key ) => {
                if ( key === 'configuration.timezone' ) throw new Error( 'Config error' );
                if ( key === 'customTokens' ) return {};
                return undefined;
            } );

            const time = tokenService.getCurrentTime();
            expect( typeof time ).toBe( 'string' );
            expect( time.length ).toBeGreaterThan( 0 );
        } );
    } );
} );