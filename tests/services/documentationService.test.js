// Mock logging
jest.mock( '../../src/lib/logging.js', () => ( {
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
} ) );

// Mock fs
jest.mock( 'fs', () => ( {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
} ) );

const fs = require( 'fs' );
const DocumentationService = require( '../../src/services/documentationService' );

describe( 'DocumentationService', () => {
    let documentationService;
    let mockVersionService;
    let mockStateService;
    let mockServices;

    beforeEach( () => {
        jest.clearAllMocks();

        mockVersionService = {
            getVersion: jest.fn().mockResolvedValue( {
                version: '1.2.0',
                tag: 'v1.2.0',
                buildDate: '2026-05-18T10:00:00Z',
                gitCommit: 'abc123def456',
                packageVersion: '1.0.3'
            } )
        };

        mockStateService = {
            getHangoutName: jest.fn().mockReturnValue( 'Test Room' ),
            _getCurrentState: jest.fn().mockReturnValue( {
                settings: { name: 'Test Room' },
                allUserData: {
                    'user1': { userProfile: { nickname: 'User1' } },
                    'user2': { userProfile: { nickname: 'User2' } }
                },
                djs: [ 'user1' ]
            } )
        };

        mockServices = {
            stateService: mockStateService
        };

        documentationService = new DocumentationService( {
            versionService: mockVersionService,
            services: mockServices
        } );
    } );

    describe( 'escapeHtml', () => {
        it( 'should escape HTML special characters', () => {
            expect( documentationService.escapeHtml( '<script>' ) ).toBe( '&lt;script&gt;' );
            expect( documentationService.escapeHtml( 'a & b' ) ).toBe( 'a &amp; b' );
            expect( documentationService.escapeHtml( '"hello"' ) ).toBe( '&quot;hello&quot;' );
            expect( documentationService.escapeHtml( "'hello'" ) ).toBe( '&#039;hello&#039;' );
        } );

        it( 'should handle undefined and null', () => {
            expect( documentationService.escapeHtml( undefined ) ).toBe( '' );
            expect( documentationService.escapeHtml( null ) ).toBe( '' );
        } );

        it( 'should convert numbers to strings', () => {
            expect( documentationService.escapeHtml( 123 ) ).toBe( '123' );
        } );
    } );

    describe( 'generateHtmlWrapper', () => {
        it( 'should generate valid HTML wrapper', () => {
            const html = documentationService.generateHtmlWrapper( 'Test Page', '<p>Content</p>' );

            expect( html ).toContain( '<!DOCTYPE html>' );
            expect( html ).toContain( '<title>Test Page - Mr. Roboto V3</title>' );
            expect( html ).toContain( '<p>Content</p>' );
            expect( html ).toContain( '</html>' );
        } );

        it( 'should include navigation links', () => {
            const html = documentationService.generateHtmlWrapper( 'Test', 'content' );

            expect( html ).toContain( '<a href="/">Home</a>' );
            expect( html ).toContain( '<a href="/health">Health</a>' );
            expect( html ).toContain( '<a href="/status">Status</a>' );
        } );

        it( 'should include CSS styling', () => {
            const html = documentationService.generateHtmlWrapper( 'Test', 'content' );

            expect( html ).toContain( '<style>' );
            expect( html ).toContain( 'background:' );
            expect( html ).toContain( '.container' );
        } );

        it( 'should escape title to prevent XSS', () => {
            const html = documentationService.generateHtmlWrapper( '<script>alert("xss")</script>', 'content' );

            expect( html ).toContain( '&lt;script&gt;' );
            expect( html ).not.toContain( '<script>alert' );
        } );
    } );

    describe( 'generateLandingPage', () => {
        it( 'should generate landing page with version info', async () => {
            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( 'Welcome to Mr. Roboto V3' );
            expect( html ).toContain( 'v1.2.0' );
            expect( html ).toContain( '1.2.0' );
            expect( mockVersionService.getVersion ).toHaveBeenCalled();
        } );

        it( 'should include hangout information', async () => {
            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( 'Test Room' );
            expect( html ).toContain( 'Users:' );
            expect( html ).toContain( '2' ); // 2 users
            expect( html ).toContain( 'DJs:' );
            expect( html ).toContain( '1' ); // 1 DJ
        } );

        it( 'should display build date when available', async () => {
            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( 'Built:' );
        } );

        it( 'should display git commit when available', async () => {
            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( 'Commit:' );
            expect( html ).toContain( 'abc123de' ); // First 8 chars
        } );

        it( 'should handle missing build date gracefully', async () => {
            mockVersionService.getVersion.mockResolvedValue( {
                version: '1.0.3',
                tag: 'v1.0.3',
                buildDate: undefined,
                gitCommit: undefined,
                packageVersion: '1.0.3'
            } );

            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( 'v1.0.3' );
            expect( html ).not.toContain( 'Built:' );
            expect( html ).not.toContain( 'Commit:' );
        } );

        it( 'should include links to available pages', async () => {
            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( '/health' );
            expect( html ).toContain( '/status' );
            expect( html ).toContain( '/commands' );
            expect( html ).toContain( '/chatcommands' );
        } );

        it( 'should handle not connected state', async () => {
            mockStateService.getHangoutName.mockReturnValue( 'our Hangout' );
            mockStateService._getCurrentState.mockReturnValue( {
                settings: { name: undefined },
                allUserData: {},
                djs: []
            } );

            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( 'our Hangout' );
            expect( html ).toContain( '0' ); // 0 users and DJs
        } );

        it( 'should handle when stateService is not initialized', async () => {
            mockServices.stateService = undefined;

            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( 'Not connected' );
            expect( html ).toContain( 'v1.2.0' );
            expect( html ).toContain( '0' ); // 0 users
        } );

        it( 'should return error page when version service fails', async () => {
            mockVersionService.getVersion.mockRejectedValue( new Error( 'Version load failed' ) );

            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( 'Error' );
            expect( html ).toContain( 'Failed to load bot information' );
        } );

        it( 'should escape user-provided content to prevent XSS', async () => {
            mockStateService.getHangoutName.mockReturnValue( '<script>alert("xss")</script>' );
            mockStateService._getCurrentState.mockReturnValue( {
                settings: { name: '<script>alert("xss")</script>' },
                allUserData: {},
                djs: []
            } );

            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( '&lt;script&gt;' );
            expect( html ).not.toContain( '<script>alert' );
        } );

        it( 'should handle when stateService throws error', async () => {
            mockStateService.getHangoutName.mockImplementation( () => {
                throw new Error( 'State service error' );
            } );

            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( 'Not connected' );
            expect( html ).toContain( 'v1.2.0' );
            expect( html ).toContain( '0' ); // 0 users and DJs
        } );
    } );

    describe( 'rebuildChatDocumentation', () => {
        beforeEach( () => {
            // Reset fs mocks
            fs.existsSync.mockReset();
            fs.readFileSync.mockReset();
            fs.writeFileSync.mockReset();
            fs.mkdirSync.mockReset();
        } );

        it( 'should generate documentation from chat.json and aliases.json', async () => {
            // Mock chat.json exists
            fs.existsSync.mockImplementation( path => {
                if ( path.includes( 'chat.json' ) ) return true;
                if ( path.includes( 'aliases.json' ) ) return true;
                if ( path.includes( 'html' ) ) return true;
                return false;
            } );

            // Mock file contents
            fs.readFileSync.mockImplementation( path => {
                if ( path.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: {
                            messages: [ 'Nice one {djUsername}!' ],
                            pictures: [ 'https://example.com/props.gif' ]
                        },
                        hello: {
                            messages: [ 'Hello {senderUsername}!' ],
                            pictures: []
                        }
                    } );
                }
                if ( path.includes( 'aliases.json' ) ) {
                    return JSON.stringify( {
                        propos: { command: 'props' },
                        hi: { command: 'hello' }
                    } );
                }
                return '{}';
            } );

            const result = await documentationService.rebuildChatDocumentation();

            expect( result.success ).toBe( true );
            expect( result.message ).toContain( '2 commands' );
            expect( fs.writeFileSync ).toHaveBeenCalled();

            // Verify the HTML was written
            const writeCall = fs.writeFileSync.mock.calls[ 0 ];
            const htmlContent = writeCall[ 1 ];

            expect( htmlContent ).toContain( 'Chat Commands' );
            expect( htmlContent ).toContain( '!props' );
            expect( htmlContent ).toContain( '!hello' );
            expect( htmlContent ).toContain( 'propos' ); // alias
            expect( htmlContent ).toContain( 'hi' ); // alias
            expect( htmlContent ).toContain( 'Nice one {djUsername}!' );
            expect( htmlContent ).toContain( 'Hello {senderUsername}!' );
            expect( htmlContent ).toContain( 'Show Images (1)' );
        } );

        it( 'should create html directory if it does not exist', async () => {
            fs.existsSync.mockImplementation( path => {
                if ( path.includes( 'html' ) ) return false; // html dir doesn't exist
                return true;
            } );

            fs.readFileSync.mockReturnValue( JSON.stringify( {} ) );

            await documentationService.rebuildChatDocumentation();

            expect( fs.mkdirSync ).toHaveBeenCalledWith(
                expect.stringContaining( 'html' ),
                { recursive: true }
            );
        } );

        it( 'should handle missing chat.json gracefully', async () => {
            fs.existsSync.mockImplementation( path => {
                if ( path.includes( 'chat.json' ) ) return false;
                if ( path.includes( 'aliases.json' ) ) return true;
                if ( path.includes( 'html' ) ) return true;
                return false;
            } );

            fs.readFileSync.mockReturnValue( JSON.stringify( {} ) );

            const result = await documentationService.rebuildChatDocumentation();

            expect( result.success ).toBe( true );
            expect( result.message ).toContain( '0 commands' );
            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );

        it( 'should handle missing aliases.json gracefully', async () => {
            fs.existsSync.mockImplementation( path => {
                if ( path.includes( 'chat.json' ) ) return true;
                if ( path.includes( 'aliases.json' ) ) return false;
                if ( path.includes( 'html' ) ) return true;
                return false;
            } );

            fs.readFileSync.mockImplementation( path => {
                if ( path.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        test: { messages: [ 'Test' ], pictures: [] }
                    } );
                }
                return '{}';
            } );

            const result = await documentationService.rebuildChatDocumentation();

            expect( result.success ).toBe( true );
            expect( fs.writeFileSync ).toHaveBeenCalled();
        } );

        it( 'should sort commands alphabetically', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( path => {
                if ( path.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        zebra: { messages: [ 'Z' ], pictures: [] },
                        alpha: { messages: [ 'A' ], pictures: [] },
                        beta: { messages: [ 'B' ], pictures: [] }
                    } );
                }
                return '{}';
            } );

            await documentationService.rebuildChatDocumentation();

            const writeCall = fs.writeFileSync.mock.calls[ 0 ];
            const htmlContent = writeCall[ 1 ];

            // Check order in HTML
            const alphaIndex = htmlContent.indexOf( '!alpha' );
            const betaIndex = htmlContent.indexOf( '!beta' );
            const zebraIndex = htmlContent.indexOf( '!zebra' );

            expect( alphaIndex ).toBeLessThan( betaIndex );
            expect( betaIndex ).toBeLessThan( zebraIndex );
        } );

        it( 'should handle commands with no messages or pictures', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( path => {
                if ( path.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        empty: { messages: [], pictures: [] }
                    } );
                }
                return '{}';
            } );

            const result = await documentationService.rebuildChatDocumentation();

            expect( result.success ).toBe( true );

            const writeCall = fs.writeFileSync.mock.calls[ 0 ];
            const htmlContent = writeCall[ 1 ];

            expect( htmlContent ).toContain( '!empty' );
            expect( htmlContent ).toContain( 'none' );
        } );

        it( 'should escape HTML in command data to prevent XSS', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( path => {
                if ( path.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        'xss<script>': {
                            messages: [ '<script>alert("xss")</script>' ],
                            pictures: []
                        }
                    } );
                }
                if ( path.includes( 'aliases.json' ) ) {
                    return JSON.stringify( {
                        '<script>': { command: 'xss<script>' }
                    } );
                }
                return '{}';
            } );

            await documentationService.rebuildChatDocumentation();

            const writeCall = fs.writeFileSync.mock.calls[ 0 ];
            const htmlContent = writeCall[ 1 ];

            expect( htmlContent ).toContain( '&lt;script&gt;' );
            expect( htmlContent ).not.toContain( '<script>alert' );
        } );

        it( 'should handle file write errors', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( JSON.stringify( {} ) );
            fs.writeFileSync.mockImplementation( () => {
                throw new Error( 'Write failed' );
            } );

            const result = await documentationService.rebuildChatDocumentation();

            expect( result.success ).toBe( false );
            expect( result.message ).toContain( 'Write failed' );
        } );

        it( 'should handle JSON parse errors', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockReturnValue( 'invalid json' );

            const result = await documentationService.rebuildChatDocumentation();

            expect( result.success ).toBe( false );
            expect( result.message ).toContain( 'Failed to rebuild documentation' );
        } );

        it( 'should include image toggle buttons for commands with pictures', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( path => {
                if ( path.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        test: {
                            messages: [ 'Test' ],
                            pictures: [
                                'https://example.com/1.gif',
                                'https://example.com/2.gif',
                                'https://example.com/3.gif'
                            ]
                        }
                    } );
                }
                return '{}';
            } );

            await documentationService.rebuildChatDocumentation();

            const writeCall = fs.writeFileSync.mock.calls[ 0 ];
            const htmlContent = writeCall[ 1 ];

            expect( htmlContent ).toContain( 'Show Images (3)' );
            expect( htmlContent ).toContain( 'toggleImages' );
            expect( htmlContent ).toContain( 'https://example.com/1.gif' );
        } );

        it( 'should group multiple aliases for the same command', async () => {
            fs.existsSync.mockReturnValue( true );
            fs.readFileSync.mockImplementation( path => {
                if ( path.includes( 'chat.json' ) ) {
                    return JSON.stringify( {
                        props: { messages: [ 'Props!' ], pictures: [] }
                    } );
                }
                if ( path.includes( 'aliases.json' ) ) {
                    return JSON.stringify( {
                        propos: { command: 'props' },
                        porps: { command: 'props' },
                        banger: { command: 'props' }
                    } );
                }
                return '{}';
            } );

            await documentationService.rebuildChatDocumentation();

            const writeCall = fs.writeFileSync.mock.calls[ 0 ];
            const htmlContent = writeCall[ 1 ];

            expect( htmlContent ).toContain( 'propos' );
            expect( htmlContent ).toContain( 'porps' );
            expect( htmlContent ).toContain( 'banger' );
        } );
    } );
} );
