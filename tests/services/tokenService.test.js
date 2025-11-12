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

    describe( 'username tokens', () => {
        beforeEach( () => {
            // Add username-related services to mock
            mockServices.messageService = {
                formatMention: jest.fn( ( uuid ) => `<@uid:${ uuid }>` )
            };
            mockServices.hangUserService = {
                getUserNicknameByUuid: jest.fn()
            };
            mockServices.stateService._getDjs = jest.fn();
        } );

        describe( 'getSenderUsername', () => {
            it( 'should return formatted mention for valid sender UUID', async () => {
                const context = { sender: 'sender-123' };
                const result = await tokenService.getSenderUsername( context );

                expect( result ).toBe( '<@uid:sender-123>' );
                expect( mockServices.messageService.formatMention ).toHaveBeenCalledWith( 'sender-123' );
            } );

            it( 'should handle sender as object with uuid property', async () => {
                const context = { sender: { uuid: 'sender-456' } };
                const result = await tokenService.getSenderUsername( context );

                expect( result ).toBe( '<@uid:sender-456>' );
                expect( mockServices.messageService.formatMention ).toHaveBeenCalledWith( 'sender-456' );
            } );

            it( 'should return Unknown User when no sender provided', async () => {
                const context = {};
                const result = await tokenService.getSenderUsername( context );

                expect( result ).toBe( 'Unknown User' );
            } );

            it( 'should return Unknown User when sender has no uuid', async () => {
                const context = { sender: {} };
                const result = await tokenService.getSenderUsername( context );

                expect( result ).toBe( 'Unknown User' );
            } );

            it( 'should fallback to hangUserService when messageService not available', async () => {
                delete mockServices.messageService;
                mockServices.hangUserService.getUserNicknameByUuid.mockResolvedValue( 'John Doe' );

                const context = { sender: 'sender-123' };
                const result = await tokenService.getSenderUsername( context );

                expect( result ).toBe( 'John Doe' );
                expect( mockServices.hangUserService.getUserNicknameByUuid ).toHaveBeenCalledWith( 'sender-123' );
            } );

            it( 'should handle errors gracefully', async () => {
                mockServices.messageService.formatMention.mockImplementation( () => {
                    throw new Error( 'Format error' );
                } );

                const context = { sender: 'sender-123' };
                const result = await tokenService.getSenderUsername( context );

                expect( result ).toBe( 'Unknown User' );
            } );
        } );

        describe( 'getDjUsername', () => {
            it( 'should return formatted mention for current DJ', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'dj-123', nickname: 'DJ Mike' },
                    { uuid: 'dj-456', nickname: 'DJ Sarah' }
                ] );

                const result = await tokenService.getDjUsername( {} );

                expect( result ).toBe( '<@uid:dj-123>' );
                expect( mockServices.messageService.formatMention ).toHaveBeenCalledWith( 'dj-123' );
            } );

            it( 'should return No DJ when no DJs are available', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [] );

                const result = await tokenService.getDjUsername( {} );

                expect( result ).toBe( 'No DJ' );
            } );

            it( 'should return No DJ when _getDjs returns null', async () => {
                mockServices.stateService._getDjs.mockReturnValue( null );

                const result = await tokenService.getDjUsername( {} );

                expect( result ).toBe( 'No DJ' );
            } );

            it( 'should return No DJ when stateService not available', async () => {
                delete mockServices.stateService;
                tokenService = new TokenService( mockServices );

                const result = await tokenService.getDjUsername( {} );

                expect( result ).toBe( 'No DJ' );
            } );

            it( 'should fallback to hangUserService when messageService not available', async () => {
                delete mockServices.messageService;
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'dj-123', nickname: 'DJ Mike' }
                ] );
                mockServices.hangUserService.getUserNicknameByUuid.mockResolvedValue( 'DJ Mike' );

                const result = await tokenService.getDjUsername( {} );

                expect( result ).toBe( 'DJ Mike' );
                expect( mockServices.hangUserService.getUserNicknameByUuid ).toHaveBeenCalledWith( 'dj-123' );
            } );

            it( 'should handle errors gracefully', async () => {
                mockServices.stateService._getDjs.mockImplementation( () => {
                    throw new Error( 'State error' );
                } );

                const result = await tokenService.getDjUsername( {} );

                expect( result ).toBe( 'No DJ' );
            } );
        } );

        describe( 'username token integration in replaceTokens', () => {
            beforeEach( () => {
                mockServices.stateService._getDjs = jest.fn().mockReturnValue( [
                    { uuid: 'dj-123', nickname: 'DJ Mike' }
                ] );
            } );

            it( 'should replace senderUsername token', async () => {
                const text = 'Hello {senderUsername}!';
                const context = { sender: 'sender-456' };

                const result = await tokenService.replaceTokens( text, context );

                expect( result ).toBe( 'Hello <@uid:sender-456>!' );
            } );

            it( 'should replace djUsername token', async () => {
                const text = 'Now playing by {djUsername}';

                const result = await tokenService.replaceTokens( text );

                expect( result ).toBe( 'Now playing by <@uid:dj-123>' );
            } );

            it( 'should replace both username tokens', async () => {
                const text = '{senderUsername} thanks {djUsername} for the great music!';
                const context = { sender: 'sender-456' };

                const result = await tokenService.replaceTokens( text, context );

                expect( result ).toBe( '<@uid:sender-456> thanks <@uid:dj-123> for the great music!' );
            } );
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