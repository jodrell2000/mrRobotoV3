// Mock the fs module before requiring the DataService
jest.mock( 'fs', () => ( {
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn()
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

const path = require( 'path' );
const dataService = require( '../../src/services/dataService' );
const fs = require( 'fs' );

describe( 'DataService', () => {
    mockData = {
        welcomeMessage: "Hi {username}, welcome to '{hangoutName}'"
    }; beforeEach( () => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        fs.promises.readFile.mockReset();
        // Reset the internal data
        dataService.data = {};
    } );

    describe( 'loadData', () => {
        it( 'should load data from file successfully', async () => {
            const expectedData = { ...mockData };
            fs.promises.readFile.mockResolvedValueOnce( JSON.stringify( expectedData ) );

            const result = await dataService.loadData();

            expect( result ).toEqual( expectedData );
            expect( fs.promises.readFile ).toHaveBeenCalledTimes( 1 );
            expect( fs.promises.readFile ).toHaveBeenCalledWith(
                expect.stringContaining( 'botConfig.json' ),
                'utf8'
            );
        } );

        it( 'should handle missing file gracefully', async () => {
            const error = new Error( 'File not found' );
            error.code = 'ENOENT';
            fs.promises.readFile.mockRejectedValueOnce( error );

            const result = await dataService.loadData();

            expect( result ).toEqual( {} );
            expect( dataService.getAllData() ).toEqual( {} );
        } );

        it( 'should throw error on invalid JSON', async () => {
            const invalidJson = '{ "broken": "json" "missing": "comma" }';
            fs.promises.readFile.mockResolvedValue( invalidJson );

            await expect( dataService.loadData() ).rejects.toThrow( SyntaxError );
        }, 10000 );
    } );

    describe( 'getValue', () => {
        beforeEach( async () => {
            fs.promises.readFile.mockResolvedValue( JSON.stringify( mockData ) );
            await dataService.loadData();
        } );

        it( 'should return value for existing key', () => {
            expect( dataService.getValue( 'welcomeMessage' ) ).toBe( "Hi {username}, welcome to '{hangoutName}'" );
        } );

        it( 'should return undefined for non-existent key', () => {
            expect( dataService.getValue( 'nonexistent' ) ).toBeUndefined();
        } );
    } );

    describe( 'getAllData', () => {
        beforeEach( async () => {
            // Always mock the file read to return the expected mockData for this test
            fs.promises.readFile.mockResolvedValueOnce( JSON.stringify( mockData ) );
            await dataService.loadData();
        } );

        it( 'should return all data', () => {
            expect( dataService.getAllData() ).toEqual( mockData );
        } );
    } );

    describe( 'setValue', () => {
        beforeEach( async () => {
            fs.promises.readFile.mockResolvedValueOnce( JSON.stringify( mockData ) );
            fs.promises.writeFile.mockResolvedValue();
            await dataService.loadData();
        } );

        it( 'should set a top-level value', async () => {
            await dataService.setValue( 'newKey', 'newValue' );
            expect( dataService.getValue( 'newKey' ) ).toBe( 'newValue' );
            // Verify file was written
            expect( fs.promises.writeFile ).toHaveBeenCalled();

            // Verify the path
            expect( fs.promises.writeFile.mock.calls[ 0 ][ 0 ] ).toContain( 'botConfig.json' );

            // Parse and verify the written data
            const writtenData = JSON.parse( fs.promises.writeFile.mock.calls[ 0 ][ 1 ] );
            expect( writtenData ).toHaveProperty( 'newKey', 'newValue' );
        } );

        it( 'should set a nested value', async () => {
            await dataService.setValue( 'nested.deep.value', 'test' );
            expect( dataService.getValue( 'nested.deep.value' ) ).toBe( 'test' );
            // Verify file was written
            expect( fs.promises.writeFile ).toHaveBeenCalled();

            // Verify the path
            expect( fs.promises.writeFile.mock.calls[ 0 ][ 0 ] ).toContain( 'botConfig.json' );

            // Parse and verify the written data
            const writtenData = JSON.parse( fs.promises.writeFile.mock.calls[ 0 ][ 1 ] );
            expect( writtenData.nested.deep.value ).toBe( 'test' );
        } );

        it( 'should update an existing value', async () => {
            await dataService.setValue( 'welcomeMessage', 'Updated message' );
            expect( dataService.getValue( 'welcomeMessage' ) ).toBe( 'Updated message' );
            // Verify file was written
            expect( fs.promises.writeFile ).toHaveBeenCalled();

            // Verify the path
            expect( fs.promises.writeFile.mock.calls[ 0 ][ 0 ] ).toContain( 'botConfig.json' );

            // Parse and verify the written data
            const writtenData = JSON.parse( fs.promises.writeFile.mock.calls[ 0 ][ 1 ] );
            expect( writtenData.welcomeMessage ).toBe( 'Updated message' );
        } );

        it( 'should handle file write errors', async () => {
            fs.promises.writeFile.mockRejectedValueOnce( new Error( 'Write failed' ) );
            await expect( dataService.setValue( 'test', 'value' ) ).rejects.toThrow( 'Write failed' );
        } );

        it( 'should create intermediate objects for nested paths', async () => {
            await dataService.setValue( 'a.b.c.d', 'deep' );
            expect( dataService.getValue( 'a.b.c.d' ) ).toBe( 'deep' );
            expect( dataService.getValue( 'a.b.c' ) ).toEqual( { d: 'deep' } );
            expect( fs.promises.writeFile ).toHaveBeenCalled();
        } );
    } );
} );
