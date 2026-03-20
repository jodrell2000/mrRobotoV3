'use strict';

const mockStatement = {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    finalize: jest.fn()
};

const mockDatabase = {
    prepare: jest.fn().mockReturnValue( mockStatement ),
    exec: jest.fn(),
    close: jest.fn()
};

module.exports = jest.fn().mockImplementation( () => mockDatabase );
