// Mock logging
jest.mock( '../../src/lib/logging.js', () => ( {
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
} ) );

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
            _getCurrentState: jest.fn().mockReturnValue( {
                hangoutName: 'Test Room',
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
            mockStateService._getCurrentState.mockReturnValue( {
                hangoutName: undefined,
                allUserData: {},
                djs: []
            } );

            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( 'Not connected' );
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
            mockStateService._getCurrentState.mockReturnValue( {
                hangoutName: '<script>alert("xss")</script>',
                allUserData: {},
                djs: []
            } );

            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( '&lt;script&gt;' );
            expect( html ).not.toContain( '<script>alert' );
        } );

        it( 'should handle when stateService throws error', async () => {
            mockStateService._getCurrentState.mockImplementation( () => {
                throw new Error( 'State service error' );
            } );

            const html = await documentationService.generateLandingPage();

            expect( html ).toContain( 'Not connected' );
            expect( html ).toContain( 'v1.2.0' );
        } );
    } );
} );
