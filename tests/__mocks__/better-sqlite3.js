'use strict';

const mockStatement = {
    run: jest.fn().mockReturnValue( { lastInsertRowid: 1, changes: 1 } ),
    get: jest.fn(),
    all: jest.fn(),
    finalize: jest.fn()
};

const mockDatabase = {
    prepare: jest.fn().mockReturnValue( mockStatement ),
    exec: jest.fn(),
    transaction: jest.fn( callback => callback ),
    close: jest.fn()
};

module.exports = jest.fn().mockImplementation( () => mockDatabase );
