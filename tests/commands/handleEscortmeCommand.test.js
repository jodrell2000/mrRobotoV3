'use strict';

const handleEscortmeCommand = require( '../../src/commands/General Commands/handleEscortmeCommand' );

describe( 'handleEscortmeCommand', () => {
    let mockServices;
    let mockContext;

    beforeEach( () => {
        mockServices = {
            messageService: {
                sendResponse: jest.fn().mockResolvedValue(),
                formatMention: jest.fn().mockImplementation( uuid => `@${ uuid }` )
            },
            stateService: {
                _getDjs: jest.fn(),
                _getCurrentState: jest.fn().mockReturnValue( {
                    allUserData: {}
                } )
            },
            dataService: {
                getValue: jest.fn().mockReturnValue( {} ),
                setValue: jest.fn().mockResolvedValue()
            },
            logger: {
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            },
            socket: {},
            hangSocketServices: {
                removeDj: jest.fn().mockResolvedValue()
            }
        };

        mockContext = {
            sender: 'test-user-uuid',
            fullMessage: { isPrivateMessage: false }
        };

        jest.clearAllMocks();
    } );

    describe( 'command metadata', () => {
        it( 'should have correct metadata', () => {
            expect( handleEscortmeCommand.requiredRole ).toBe( 'USER' );
            expect( handleEscortmeCommand.description ).toBe( 'Schedule removal after current song' );
            expect( handleEscortmeCommand.example ).toBe( 'escortme' );
            expect( handleEscortmeCommand.hidden ).toBe( false );
        } );
    } );

    describe( 'Phase 1: DJ Position Checking', () => {
        describe( 'user not on decks', () => {
            it( 'should error when user is not in DJ list', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'other-dj-1' },
                    { uuid: 'other-dj-2' }
                ] );

                const result = await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( false );
                expect( result.error ).toBe( 'User not on decks' );
                expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                    expect.stringContaining( 'You must be on the decks' ),
                    expect.any( Object )
                );
            } );

            it( 'should error when user is beyond position 20 in queue', async () => {
                const djList = [];
                for ( let i = 0; i < 25; i++ ) {
                    djList.push( { uuid: `dj-${ i }` } );
                }
                djList[ 22 ] = { uuid: 'test-user-uuid' }; // Position 22, beyond limit

                mockServices.stateService._getDjs.mockReturnValue( djList );

                const result = await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( false );
                expect( result.error ).toBe( 'User not on decks' );
                expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                    expect.stringContaining( 'You must be on the decks' ),
                    expect.any( Object )
                );
            } );
        } );

        describe( 'user currently playing', () => {
            it( 'should succeed when user is at position 0', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'test-user-uuid' },
                    { uuid: 'other-dj' }
                ] );

                const result = await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( true );
                expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                    expect.stringContaining( 'will be removed after your song ends' ),
                    expect.any( Object )
                );
            } );
        } );

        describe( 'user in queue', () => {
            it( 'should succeed when user is at position 1', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'other-dj' },
                    { uuid: 'test-user-uuid' }
                ] );

                const result = await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( true );
                expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                    expect.stringContaining( 'will be removed after your song plays' ),
                    expect.any( Object )
                );
            } );

            it( 'should succeed when user is at position 5', async () => {
                const djList = [ { uuid: 'dj-0' } ];
                for ( let i = 1; i < 5; i++ ) {
                    djList.push( { uuid: `dj-${ i }` } );
                }
                djList.push( { uuid: 'test-user-uuid' } );

                mockServices.stateService._getDjs.mockReturnValue( djList );

                const result = await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( true );
                expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                    expect.stringContaining( 'will be removed after your song plays' ),
                    expect.any( Object )
                );
            } );

            it( 'should succeed when user is at position 20', async () => {
                const djList = [ { uuid: 'dj-0' } ];
                for ( let i = 1; i < 20; i++ ) {
                    djList.push( { uuid: `dj-${ i }` } );
                }
                djList.push( { uuid: 'test-user-uuid' } );

                mockServices.stateService._getDjs.mockReturnValue( djList );

                const result = await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( true );
                expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                    expect.stringContaining( 'will be removed after your song plays' ),
                    expect.any( Object )
                );
            } );
        } );

        describe( 'error handling', () => {
            it( 'should handle missing user UUID', async () => {
                const result = await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: { fullMessage: { isPrivateMessage: false } },
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( false );
                expect( result.error ).toBe( 'No user UUID' );
                expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                    expect.stringContaining( 'Unable to determine your identity' ),
                    expect.any( Object )
                );
            } );

            it( 'should handle stateService._getDjs() errors gracefully', async () => {
                mockServices.stateService._getDjs.mockImplementation( () => {
                    throw new Error( 'State service error' );
                } );

                const result = await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( false );
                expect( result.error ).toBe( 'User not on decks' );
            } );
        } );

        describe( 'response formatting', () => {
            it( 'should use correct response channel', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'test-user-uuid' }
                ] );

                await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'public'
                } );

                const callArgs = mockServices.messageService.sendResponse.mock.calls[ 0 ][ 1 ];
                expect( callArgs.responseChannel ).toBe( 'public' );
                expect( callArgs.sender ).toBe( 'test-user-uuid' );
            } );

            it( 'should include isPrivateMessage in response', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'test-user-uuid' }
                ] );

                const contextWithPrivate = {
                    ...mockContext,
                    fullMessage: { isPrivateMessage: true }
                };

                await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: contextWithPrivate,
                    responseChannel: 'request'
                } );

                const callArgs = mockServices.messageService.sendResponse.mock.calls[ 0 ][ 1 ];
                expect( callArgs.isPrivateMessage ).toBe( true );
            } );
        } );

        describe( 'logging', () => {
            it( 'should log when user is on decks', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'test-user-uuid' }
                ] );
                mockServices.stateService._getCurrentState.mockReturnValue( {
                    allUserData: {
                        'test-user-uuid': {
                            userProfile: { nickname: 'TestDJ' }
                        }
                    }
                } );

                await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( mockServices.logger.info ).toHaveBeenCalledWith(
                    expect.stringContaining( '[escortme]' )
                );
                expect( mockServices.logger.info ).toHaveBeenCalledWith(
                    expect.stringContaining( 'TestDJ' )
                );
            } );

            it( 'should log when user is not on decks', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [] );

                await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( mockServices.logger.info ).toHaveBeenCalledWith(
                    expect.stringContaining( 'not on decks' )
                );
            } );
        } );
    } );

    describe( 'Phase 2: Escortme Flag Management', () => {
        describe( 'enabling escortme', () => {
            it( 'should set flag when user is currently playing (position 0)', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'test-user-uuid' },
                    { uuid: 'other-dj' }
                ] );
                mockServices.stateService._getCurrentState.mockReturnValue( {
                    allUserData: {
                        'test-user-uuid': {
                            userProfile: { nickname: 'TestDJ' }
                        }
                    }
                } );

                const result = await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( true );
                expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                    '✅ You will be removed after your song ends.',
                    expect.any( Object )
                );

                // Verify flag was set with correct structure
                const setValueCalls = mockServices.dataService.setValue.mock.calls;
                expect( setValueCalls.length ).toBeGreaterThan( 0 );
                const escortQueue = setValueCalls[ 0 ][ 1 ];
                expect( escortQueue[ 'test-user-uuid' ] ).toBeDefined();
                expect( escortQueue[ 'test-user-uuid' ].removeAfterCurrent ).toBe( true );
                expect( escortQueue[ 'test-user-uuid' ].markedAt ).toBeDefined();
            } );

            it( 'should set flag when user is in queue (position 1)', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'other-dj' },
                    { uuid: 'test-user-uuid' },
                    { uuid: 'another-dj' }
                ] );
                mockServices.stateService._getCurrentState.mockReturnValue( {
                    allUserData: {
                        'test-user-uuid': {
                            userProfile: { nickname: 'TestDJ' }
                        }
                    }
                } );

                const result = await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( true );
                expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                    '✅ You will be removed after your song plays.',
                    expect.any( Object )
                );

                // Verify flag was set with correct structure
                const setValueCalls = mockServices.dataService.setValue.mock.calls;
                const escortQueue = setValueCalls[ 0 ][ 1 ];
                expect( escortQueue[ 'test-user-uuid' ].removeAfterCurrent ).toBe( false );
            } );

            it( 'should set flag with correct removeAfterCurrent for position 5', async () => {
                const djList = [ { uuid: 'dj-0' } ];
                for ( let i = 1; i < 5; i++ ) {
                    djList.push( { uuid: `dj-${ i }` } );
                }
                djList.push( { uuid: 'test-user-uuid' } );

                mockServices.stateService._getDjs.mockReturnValue( djList );
                mockServices.stateService._getCurrentState.mockReturnValue( {
                    allUserData: {
                        'test-user-uuid': {
                            userProfile: { nickname: 'TestDJ' }
                        }
                    }
                } );

                await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                const setValueCalls = mockServices.dataService.setValue.mock.calls;
                const escortQueue = setValueCalls[ 0 ][ 1 ];
                expect( escortQueue[ 'test-user-uuid' ].removeAfterCurrent ).toBe( false );
                expect( escortQueue[ 'test-user-uuid' ].markedAt ).toBeDefined();
            } );

            it( 'should reject if escortme is already enabled', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'test-user-uuid' }
                ] );
                mockServices.dataService.getValue.mockReturnValue( {
                    'test-user-uuid': {
                        markedAt: Date.now() - 5000,
                        removeAfterCurrent: true
                    }
                } );

                const result = await handleEscortmeCommand( {
                    args: '',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( false );
                expect( result.error ).toBe( 'Escortme already enabled' );
                expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                    expect.stringContaining( 'already have escortme enabled' ),
                    expect.any( Object )
                );
            } );
        } );

        describe( 'disabling escortme (stop)', () => {
            it( 'should cancel escortme when stop is invoked', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'test-user-uuid' }
                ] );
                mockServices.dataService.getValue.mockReturnValue( {
                    'test-user-uuid': {
                        markedAt: Date.now() - 5000,
                        removeAfterCurrent: true
                    }
                } );
                mockServices.stateService._getCurrentState.mockReturnValue( {
                    allUserData: {
                        'test-user-uuid': {
                            userProfile: { nickname: 'TestDJ' }
                        }
                    }
                } );

                const result = await handleEscortmeCommand( {
                    args: 'stop',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( true );
                expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                    '✅ Escortme cancelled. You will remain on the decks.',
                    expect.any( Object )
                );

                // Verify flag was deleted
                const setValueCalls = mockServices.dataService.setValue.mock.calls;
                const escortQueue = setValueCalls[ 0 ][ 1 ];
                expect( escortQueue[ 'test-user-uuid' ] ).toBeUndefined();
            } );

            it( 'should error if escortme is not enabled and stop is invoked', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'test-user-uuid' }
                ] );
                mockServices.dataService.getValue.mockReturnValue( {} );

                const result = await handleEscortmeCommand( {
                    args: 'stop',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                expect( result.success ).toBe( false );
                expect( result.error ).toBe( 'Escortme not enabled' );
                expect( mockServices.messageService.sendResponse ).toHaveBeenCalledWith(
                    expect.stringContaining( "don't have escortme enabled" ),
                    expect.any( Object )
                );
            } );

            it( 'should preserve other users flags when stopping', async () => {
                mockServices.stateService._getDjs.mockReturnValue( [
                    { uuid: 'test-user-uuid' }
                ] );
                const otherUserFlag = {
                    markedAt: Date.now() - 10000,
                    removeAfterCurrent: false
                };
                mockServices.dataService.getValue.mockReturnValue( {
                    'test-user-uuid': {
                        markedAt: Date.now() - 5000,
                        removeAfterCurrent: true
                    },
                    'other-user-uuid': otherUserFlag
                } );

                await handleEscortmeCommand( {
                    args: 'stop',
                    services: mockServices,
                    context: mockContext,
                    responseChannel: 'request'
                } );

                const setValueCalls = mockServices.dataService.setValue.mock.calls;
                const escortQueue = setValueCalls[ 0 ][ 1 ];
                expect( escortQueue[ 'test-user-uuid' ] ).toBeUndefined();
                expect( escortQueue[ 'other-user-uuid' ] ).toEqual( otherUserFlag );
            } );
        } );
    } );
} );
