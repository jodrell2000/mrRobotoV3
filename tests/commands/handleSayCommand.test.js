'use strict';

const handleSayCommand = require( '../../src/commands/Moderator Commands/handleSayCommand' );

const makeServices = () => ( {
    messageService: {
        sendResponse: jest.fn().mockResolvedValue( undefined ),
        sendGroupMessage: jest.fn().mockResolvedValue( undefined ),
    },
} );

const makeContext = () => ( {
    sender: 'uuid-mod-1',
    fullMessage: { isPrivateMessage: true },
} );

describe( 'handleSayCommand', () => {
    describe( 'metadata', () => {
        test( 'requiredRole is MODERATOR', () => {
            expect( handleSayCommand.requiredRole ).toBe( 'MODERATOR' );
        } );
        test( 'description is set', () => {
            expect( typeof handleSayCommand.description ).toBe( 'string' );
            expect( handleSayCommand.description.length ).toBeGreaterThan( 0 );
        } );
        test( 'example is set', () => {
            expect( typeof handleSayCommand.example ).toBe( 'string' );
        } );
        test( 'hidden is false', () => {
            expect( handleSayCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'with a message', () => {
        test( 'sends the message as a group message', async () => {
            const services = makeServices();
            const result = await handleSayCommand( {
                args: 'Good evening everyone!',
                services,
                context: makeContext(),
                responseChannel: 'public',
            } );
            expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
                'Good evening everyone!',
                { services }
            );
            expect( result.success ).toBe( true );
            expect( result.shouldRespond ).toBe( false );
        } );

        test( 'trims leading and trailing whitespace from the message', async () => {
            const services = makeServices();
            await handleSayCommand( {
                args: '  hello world  ',
                services,
                context: makeContext(),
                responseChannel: 'public',
            } );
            expect( services.messageService.sendGroupMessage ).toHaveBeenCalledWith(
                'hello world',
                { services }
            );
        } );

        test( 'does not call sendResponse on success', async () => {
            const services = makeServices();
            await handleSayCommand( {
                args: 'Hello!',
                services,
                context: makeContext(),
                responseChannel: 'public',
            } );
            expect( services.messageService.sendResponse ).not.toHaveBeenCalled();
        } );
    } );

    describe( 'with no message', () => {
        test( 'returns failure and sends usage hint', async () => {
            const services = makeServices();
            const result = await handleSayCommand( {
                args: '',
                services,
                context: makeContext(),
                responseChannel: 'request',
            } );
            expect( result.success ).toBe( false );
            expect( result.shouldRespond ).toBe( true );
            expect( services.messageService.sendGroupMessage ).not.toHaveBeenCalled();
            expect( services.messageService.sendResponse ).toHaveBeenCalledTimes( 1 );
            const [ msg ] = services.messageService.sendResponse.mock.calls[ 0 ];
            expect( msg ).toMatch( /usage/i );
        } );

        test( 'treats whitespace-only args as empty', async () => {
            const services = makeServices();
            const result = await handleSayCommand( {
                args: '   ',
                services,
                context: makeContext(),
                responseChannel: 'request',
            } );
            expect( result.success ).toBe( false );
            expect( services.messageService.sendGroupMessage ).not.toHaveBeenCalled();
        } );
    } );
} );
