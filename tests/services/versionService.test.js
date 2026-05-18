// Mock fs module
jest.mock( 'fs', () => ( {
    promises: {
        readFile: jest.fn()
    }
} ) );

// Mock logging
jest.mock( '../../src/lib/logging.js', () => ( {
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
} ) );

const fs = require( 'fs' );
const VersionService = require( '../../src/services/versionService' );

describe( 'VersionService', () => {
    let versionService;

    beforeEach( () => {
        jest.clearAllMocks();
        fs.promises.readFile.mockReset();
        versionService = new VersionService();
        versionService.versionInfo = undefined; // Reset cached version
    } );

    describe( 'loadVersion', () => {
        it( 'should load version from VERSION file', async () => {
            const mockVersion = {
                version: '1.2.0',
                tag: 'v1.2.0',
                buildDate: '2026-05-18T10:00:00Z',
                gitCommit: 'abc123def456',
                packageVersion: '1.0.3'
            };

            fs.promises.readFile.mockResolvedValueOnce( JSON.stringify( mockVersion ) );

            const result = await versionService.loadVersion();

            expect( result ).toEqual( mockVersion );
            expect( fs.promises.readFile ).toHaveBeenCalledWith(
                expect.stringContaining( 'VERSION' ),
                'utf8'
            );
        } );

        it( 'should fallback to package.json when VERSION file not found', async () => {
            const error = new Error( 'File not found' );
            error.code = 'ENOENT';
            fs.promises.readFile
                .mockRejectedValueOnce( error ) // VERSION file fails
                .mockResolvedValueOnce( JSON.stringify( { version: '1.0.3' } ) ); // package.json succeeds

            const result = await versionService.loadVersion();

            expect( result.version ).toBe( '1.0.3' );
            expect( result.tag ).toBe( 'v1.0.3' );
            expect( result.buildDate ).toBeUndefined();
            expect( result.gitCommit ).toBeUndefined();
            expect( fs.promises.readFile ).toHaveBeenCalledTimes( 2 );
        } );

        it( 'should return unknown values when both VERSION and package.json fail', async () => {
            fs.promises.readFile.mockRejectedValue( new Error( 'File not found' ) );

            const result = await versionService.loadVersion();

            expect( result.version ).toBe( 'unknown' );
            expect( result.tag ).toBe( 'unknown' );
        } );

        it( 'should cache version info and not reload', async () => {
            const mockVersion = {
                version: '1.2.0',
                tag: 'v1.2.0',
                buildDate: '2026-05-18T10:00:00Z',
                gitCommit: 'abc123',
                packageVersion: '1.0.3'
            };

            fs.promises.readFile.mockResolvedValue( JSON.stringify( mockVersion ) );

            const result1 = await versionService.loadVersion();
            const result2 = await versionService.loadVersion();

            expect( result1 ).toEqual( mockVersion );
            expect( result2 ).toEqual( mockVersion );
            expect( fs.promises.readFile ).toHaveBeenCalledTimes( 1 );
        } );

        it( 'should handle invalid JSON in VERSION file', async () => {
            fs.promises.readFile
                .mockResolvedValueOnce( 'invalid json' ) // VERSION file with invalid JSON
                .mockResolvedValueOnce( JSON.stringify( { version: '1.0.3' } ) ); // package.json succeeds

            const result = await versionService.loadVersion();

            expect( result.version ).toBe( '1.0.3' );
            expect( result.tag ).toBe( 'v1.0.3' );
        } );
    } );

    describe( 'getVersion', () => {
        it( 'should return version info', async () => {
            const mockVersion = {
                version: '1.2.0',
                tag: 'v1.2.0',
                buildDate: '2026-05-18T10:00:00Z',
                gitCommit: 'abc123',
                packageVersion: '1.0.3'
            };

            fs.promises.readFile.mockResolvedValue( JSON.stringify( mockVersion ) );

            const result = await versionService.getVersion();

            expect( result ).toEqual( mockVersion );
        } );
    } );

    describe( 'getVersionString', () => {
        it( 'should return just the version string', async () => {
            const mockVersion = {
                version: '1.2.0',
                tag: 'v1.2.0',
                buildDate: '2026-05-18T10:00:00Z',
                gitCommit: 'abc123',
                packageVersion: '1.0.3'
            };

            fs.promises.readFile.mockResolvedValue( JSON.stringify( mockVersion ) );

            const result = await versionService.getVersionString();

            expect( result ).toBe( '1.2.0' );
        } );
    } );

    describe( 'getTag', () => {
        it( 'should return just the git tag', async () => {
            const mockVersion = {
                version: '1.2.0',
                tag: 'v1.2.0',
                buildDate: '2026-05-18T10:00:00Z',
                gitCommit: 'abc123',
                packageVersion: '1.0.3'
            };

            fs.promises.readFile.mockResolvedValue( JSON.stringify( mockVersion ) );

            const result = await versionService.getTag();

            expect( result ).toBe( 'v1.2.0' );
        } );
    } );

    describe( 'getBuildDate', () => {
        it( 'should return build date', async () => {
            const mockVersion = {
                version: '1.2.0',
                tag: 'v1.2.0',
                buildDate: '2026-05-18T10:00:00Z',
                gitCommit: 'abc123',
                packageVersion: '1.0.3'
            };

            fs.promises.readFile.mockResolvedValue( JSON.stringify( mockVersion ) );

            const result = await versionService.getBuildDate();

            expect( result ).toBe( '2026-05-18T10:00:00Z' );
        } );

        it( 'should return undefined when using package.json fallback', async () => {
            const error = new Error( 'File not found' );
            error.code = 'ENOENT';
            fs.promises.readFile
                .mockRejectedValueOnce( error )
                .mockResolvedValueOnce( JSON.stringify( { version: '1.0.3' } ) );

            const result = await versionService.getBuildDate();

            expect( result ).toBeUndefined();
        } );
    } );

    describe( 'getGitCommit', () => {
        it( 'should return git commit SHA', async () => {
            const mockVersion = {
                version: '1.2.0',
                tag: 'v1.2.0',
                buildDate: '2026-05-18T10:00:00Z',
                gitCommit: 'abc123def456',
                packageVersion: '1.0.3'
            };

            fs.promises.readFile.mockResolvedValue( JSON.stringify( mockVersion ) );

            const result = await versionService.getGitCommit();

            expect( result ).toBe( 'abc123def456' );
        } );

        it( 'should return undefined when using package.json fallback', async () => {
            const error = new Error( 'File not found' );
            error.code = 'ENOENT';
            fs.promises.readFile
                .mockRejectedValueOnce( error )
                .mockResolvedValueOnce( JSON.stringify( { version: '1.0.3' } ) );

            const result = await versionService.getGitCommit();

            expect( result ).toBeUndefined();
        } );
    } );
} );
