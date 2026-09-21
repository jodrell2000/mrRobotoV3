'use strict';

const handleRoomSettingCommand = require( '../../src/commands/Moderator Commands/handleRoomSettingCommand' );

const makeServices = ( { role = 'moderator' } = {} ) => {
    return {
        stateService: {
            getUserRole: jest.fn().mockReturnValue( role )
        },
        messageService: {
            sendResponse: jest.fn().mockResolvedValue( undefined )
        },
        platformActions: {
            updateRoomSettings: jest.fn().mockResolvedValue( { success: true } )
        },
        logger: {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        }
    };
};

const makeContext = ( sender = 'uuid-mod-1' ) => ( {
    sender,
    fullMessage: { isPrivateMessage: true }
} );

describe( 'handleRoomSettingCommand', () => {
    describe( 'metadata', () => {
        test( 'requiredRole is MODERATOR', () => {
            expect( handleRoomSettingCommand.requiredRole ).toBe( 'MODERATOR' );
        } );
        test( 'description is set', () => {
            expect( typeof handleRoomSettingCommand.description ).toBe( 'string' );
            expect( handleRoomSettingCommand.description.length ).toBeGreaterThan( 0 );
        } );
        test( 'example is set', () => {
            expect( typeof handleRoomSettingCommand.example ).toBe( 'string' );
        } );
        test( 'hidden is false', () => {
            expect( handleRoomSettingCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'permission check', () => {
        test( 'rejects users without moderator role', async () => {
            const services = makeServices( { role: 'user' } );
            const result = await handleRoomSettingCommand( {
                args: 'name "New Room"',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /permissions/i );
        } );

        test( 'allows moderators', async () => {
            const services = makeServices( { role: 'moderator' } );
            const result = await handleRoomSettingCommand( {
                args: 'name "New Room"',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( true );
        } );

        test( 'allows owners', async () => {
            const services = makeServices( { role: 'owner' } );
            const result = await handleRoomSettingCommand( {
                args: 'name "New Room"',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( true );
        } );
    } );

    describe( 'name subcommand', () => {
        test( 'error when name is missing', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'name',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /missing|usage/i );
            expect( services.messageService.sendResponse ).toHaveBeenCalled();
        } );

        test( 'error when name is empty string', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'name ""',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /missing|usage/i );
        } );

        test( 'calls updateRoomSettings and returns success', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'name "My Awesome Room"',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.updateRoomSettings ).toHaveBeenCalledWith( {
                name: 'My Awesome Room'
            } );
        } );

        test( 'case-insensitive for subcommand', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'NAME "Test Room"',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.updateRoomSettings ).toHaveBeenCalledWith( {
                name: 'Test Room'
            } );
        } );

        test( 'handles quoted names correctly', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'name "Room With Spaces"',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.updateRoomSettings ).toHaveBeenCalledWith( {
                name: 'Room With Spaces'
            } );
        } );

        test( 'handles error response when platformActions throws', async () => {
            const services = makeServices();
            services.platformActions.updateRoomSettings.mockRejectedValue(
                new Error( 'API Error' )
            );
            const result = await handleRoomSettingCommand( {
                args: 'name "New Room"',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /API Error/i );
            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( '❌' ),
                expect.any( Object )
            );
        } );
    } );

    describe( 'description subcommand', () => {
        test( 'error when description is missing', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'description',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /missing|usage/i );
        } );

        test( 'error when description is empty string', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'description ""',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /missing|usage/i );
        } );

        test( 'calls updateRoomSettings and returns success', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'description "Welcome to our music room!"',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.updateRoomSettings ).toHaveBeenCalledWith( {
                description: 'Welcome to our music room!'
            } );
        } );

        test( 'case-insensitive for subcommand', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'DESCRIPTION "Test Description"',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.updateRoomSettings ).toHaveBeenCalledWith( {
                description: 'Test Description'
            } );
        } );

        test( 'handles long descriptions', async () => {
            const services = makeServices();
            const longDesc = 'This is a very long description about our music room with lots of details';
            const result = await handleRoomSettingCommand( {
                args: `description "${ longDesc }"`,
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( true );
            expect( services.platformActions.updateRoomSettings ).toHaveBeenCalledWith( {
                description: longDesc
            } );
        } );

        test( 'handles error response when platformActions throws', async () => {
            const services = makeServices();
            services.platformActions.updateRoomSettings.mockRejectedValue(
                new Error( 'Update Failed' )
            );
            const result = await handleRoomSettingCommand( {
                args: 'description "New Description"',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /Update Failed/i );
        } );
    } );

    describe( 'help/unknown subcommand', () => {
        test( 'shows help when no subcommand provided', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: '',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /unknown/i );
            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Room Setting Usage' ),
                expect.any( Object )
            );
        } );

        test( 'shows help for invalid subcommand', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'invalid something',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( false );
            expect( result.error ).toMatch( /unknown/i );
            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Room Setting Usage' ),
                expect.any( Object )
            );
        } );

        test( 'mentions Wavez-only support in help text', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'help',
                services,
                context: makeContext(),
                responseChannel: 'request'
            } );
            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( 'Wavez' ),
                expect.any( Object )
            );
        } );
    } );

    describe( 'response channel handling', () => {
        test( 'sends success response via public channel', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'name "New Room"',
                services,
                context: { sender: 'uuid-mod-1', fullMessage: { isPrivateMessage: false } },
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( true );
            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( '✅' ),
                expect.objectContaining( { isPrivateMessage: false, responseChannel: 'request' } )
            );
        } );

        test( 'sends success response via private message', async () => {
            const services = makeServices();
            const result = await handleRoomSettingCommand( {
                args: 'name "New Room"',
                services,
                context: { sender: 'uuid-mod-1', fullMessage: { isPrivateMessage: true } },
                responseChannel: 'request'
            } );
            expect( result.success ).toBe( true );
            expect( services.messageService.sendResponse ).toHaveBeenCalledWith(
                expect.stringContaining( '✅' ),
                expect.objectContaining( { isPrivateMessage: true } )
            );
        } );
    } );
} );
