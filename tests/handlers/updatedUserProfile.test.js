'use strict';

const updatedUserProfile = require( '../../src/handlers/updatedUserProfile' );
const { handleUpdatedUserProfileEvent } = require( '../../src/handlers/updatedUserProfile' );

describe( 'updatedUserProfile handler', () => {
    let services;

    beforeEach( () => {
        services = {
            logger: {
                debug: jest.fn(),
                info: jest.fn(),
                error: jest.fn()
            },
            databaseService: {
                initialized: true,
                insertOrUpdateDjNickname: jest.fn().mockReturnValue( { action: 'updated', oldNickname: 'OldNick', newNickname: 'NewNick' } )
            }
        };
    } );

    test( 'should handle empty message gracefully', () => {
        expect( () => updatedUserProfile( {}, {}, services ) ).not.toThrow();
    } );

    test( 'should handle message without statePatch gracefully', () => {
        const message = {};
        expect( () => updatedUserProfile( message, {}, services ) ).not.toThrow();
    } );

    test( 'should handle message with empty statePatch array gracefully', () => {
        const message = { statePatch: [] };
        expect( () => updatedUserProfile( message, {}, services ) ).not.toThrow();
    } );

    test( 'should return early if databaseService not available', () => {
        const servicesWithoutDB = { ...services, databaseService: undefined };
        const message = {
            statePatch: [
                { op: 'replace', path: '/allUserData/uuid123/userProfile/nickname', value: 'NewNickname' }
            ]
        };
        updatedUserProfile( message, {}, servicesWithoutDB );
        expect( servicesWithoutDB.logger.error ).not.toHaveBeenCalled();
    } );

    test( 'should return early if databaseService not initialized', () => {
        const servicesNotInitialized = { 
            ...services, 
            databaseService: { 
                initialized: false,
                insertOrUpdateDjNickname: jest.fn()
            } 
        };
        const message = {
            statePatch: [
                { op: 'replace', path: '/allUserData/uuid123/userProfile/nickname', value: 'NewNickname' }
            ]
        };
        updatedUserProfile( message, {}, servicesNotInitialized );
        expect( servicesNotInitialized.databaseService.insertOrUpdateDjNickname ).not.toHaveBeenCalled();
    } );

    test( 'should update nickname when valid userProfile/nickname patch is present', () => {
        const uuid = 'test-uuid-123';
        const newNickname = 'TestNickname';
        const message = {
            statePatch: [
                { op: 'replace', path: `/allUserData/${ uuid }/userProfile/nickname`, value: newNickname }
            ]
        };
        updatedUserProfile( message, {}, services );

        expect( services.databaseService.insertOrUpdateDjNickname ).toHaveBeenCalledWith( {
            uuid,
            nickname: newNickname
        } );
        expect( services.logger.debug ).toHaveBeenCalledWith(
            `updatedUserProfile: Updated DJ nickname in database: ${ uuid } → ${ newNickname }`
        );
    } );

    test( 'should ignore non-replace operations', () => {
        const message = {
            statePatch: [
                { op: 'add', path: '/allUserData/uuid123/userProfile/nickname', value: 'NewNickname' }
            ]
        };
        updatedUserProfile( message, {}, services );

        expect( services.databaseService.insertOrUpdateDjNickname ).not.toHaveBeenCalled();
    } );

    test( 'should ignore patches not matching userProfile/nickname path', () => {
        const message = {
            statePatch: [
                { op: 'replace', path: '/allUserData/uuid123/userProfile/avatarId', value: 'newAvatar' }
            ]
        };
        updatedUserProfile( message, {}, services );

        expect( services.databaseService.insertOrUpdateDjNickname ).not.toHaveBeenCalled();
    } );

    test( 'should ignore patches not starting with /allUserData/', () => {
        const message = {
            statePatch: [
                { op: 'replace', path: '/userProfile/nickname', value: 'NewNickname' }
            ]
        };
        updatedUserProfile( message, {}, services );

        expect( services.databaseService.insertOrUpdateDjNickname ).not.toHaveBeenCalled();
    } );

    test( 'should handle database errors gracefully', () => {
        const error = new Error( 'Database error' );
        services.databaseService.insertOrUpdateDjNickname.mockImplementation( () => {
            throw error;
        } );

        const message = {
            statePatch: [
                { op: 'replace', path: '/allUserData/uuid123/userProfile/nickname', value: 'NewNickname' }
            ]
        };
        updatedUserProfile( message, {}, services );

        expect( services.logger.error ).toHaveBeenCalledWith(
            `updatedUserProfile: Failed to update DJ nickname in database: ${ error.message }`
        );
    } );
} );

describe( 'handleUpdatedUserProfileEvent (normalized handler)', () => {
    let services;

    beforeEach( () => {
        services = {
            logger: {
                debug: jest.fn(),
                info: jest.fn(),
                error: jest.fn()
            },
            databaseService: {
                initialized: true,
                insertOrUpdateDjNickname: jest.fn().mockReturnValue( { action: 'updated', oldNickname: 'OldNick', newNickname: 'NewNick' } )
            }
        };
    } );

    test( 'should return early if no userId in payload', async () => {
        const event = { payload: { nickname: 'NewNickname' } };
        const context = { services };

        await handleUpdatedUserProfileEvent( event, context );

        expect( services.logger.debug ).toHaveBeenCalledWith(
            'handleUpdatedUserProfileEvent: missing userId, nickname, or services'
        );
        expect( services.databaseService.insertOrUpdateDjNickname ).not.toHaveBeenCalled();
    } );

    test( 'should return early if no nickname in payload', async () => {
        const event = { payload: { userId: 'test-uuid' } };
        const context = { services };

        await handleUpdatedUserProfileEvent( event, context );

        expect( services.logger.debug ).toHaveBeenCalledWith(
            'handleUpdatedUserProfileEvent: missing userId, nickname, or services'
        );
        expect( services.databaseService.insertOrUpdateDjNickname ).not.toHaveBeenCalled();
    } );

    test( 'should return early if no services in context', async () => {
        const event = { payload: { userId: 'test-uuid', nickname: 'NewNickname' } };
        const context = {};

        await handleUpdatedUserProfileEvent( event, context );

        expect( services.databaseService.insertOrUpdateDjNickname ).not.toHaveBeenCalled();
    } );

    test( 'should return early if databaseService not available', async () => {
        const servicesWithoutDB = { ...services, databaseService: undefined };
        const event = { payload: { userId: 'test-uuid', nickname: 'NewNickname' } };
        const context = { services: servicesWithoutDB };

        await handleUpdatedUserProfileEvent( event, context );

        expect( servicesWithoutDB.logger.debug ).toHaveBeenCalledWith(
            'handleUpdatedUserProfileEvent: databaseService not available or initialized'
        );
    } );

    test( 'should return early if databaseService not initialized', async () => {
        const servicesNotInitialized = { 
            ...services, 
            databaseService: { 
                initialized: false,
                insertOrUpdateDjNickname: jest.fn()
            } 
        };
        const event = { payload: { userId: 'test-uuid', nickname: 'NewNickname' } };
        const context = { services: servicesNotInitialized };

        await handleUpdatedUserProfileEvent( event, context );

        expect( servicesNotInitialized.logger.debug ).toHaveBeenCalledWith(
            'handleUpdatedUserProfileEvent: databaseService not available or initialized'
        );
        expect( servicesNotInitialized.databaseService.insertOrUpdateDjNickname ).not.toHaveBeenCalled();
    } );

    test( 'should update nickname via databaseService with valid payload', async () => {
        const userId = 'test-uuid-123';
        const newNickname = 'TestNickname';
        const event = { payload: { userId, nickname: newNickname } };
        const context = { services };

        await handleUpdatedUserProfileEvent( event, context );

        expect( services.databaseService.insertOrUpdateDjNickname ).toHaveBeenCalledWith( {
            uuid: userId,
            nickname: newNickname
        } );
    } );

    test( 'should log debug message on successful insert', async () => {
        services.databaseService.insertOrUpdateDjNickname.mockReturnValue( { action: 'inserted' } );
        const event = { payload: { userId: 'new-user-uuid', nickname: 'NewUser' } };
        const context = { services };

        await handleUpdatedUserProfileEvent( event, context );

        expect( services.logger.debug ).toHaveBeenCalledWith(
            'Inserted new DJ in database: new-user-uuid (NewUser)'
        );
    } );

    test( 'should log debug message on successful update', async () => {
        services.databaseService.insertOrUpdateDjNickname.mockReturnValue( {
            action: 'updated',
            oldNickname: 'OldName',
            newNickname: 'NewName'
        } );
        const event = { payload: { userId: 'existing-user-uuid', nickname: 'NewName' } };
        const context = { services };

        await handleUpdatedUserProfileEvent( event, context );

        expect( services.logger.debug ).toHaveBeenCalledWith(
            'Updated DJ nickname in database: existing-user-uuid (OldName → NewName)'
        );
    } );

    test( 'should handle database errors gracefully', async () => {
        const error = new Error( 'Database connection failed' );
        services.databaseService.insertOrUpdateDjNickname.mockImplementation( () => {
            throw error;
        } );

        const event = { payload: { userId: 'test-uuid', nickname: 'NewNickname' } };
        const context = { services };

        await handleUpdatedUserProfileEvent( event, context );

        expect( services.logger.error ).toHaveBeenCalledWith(
            'handleUpdatedUserProfileEvent: Failed to update DJ nickname in database: Database connection failed'
        );
    } );

    test( 'should work with Wavez userProfileChanged event structure', async () => {
        const event = {
            type: 'userProfileChanged',
            payload: {
                userId: 'wavez-user-123',
                nickname: 'WavezNickname',
                displayUsername: 'WavezDisplay',
                username: 'wavezuser'
            },
            source: 'wavezfm'
        };
        const context = { services };

        await handleUpdatedUserProfileEvent( event, context );

        expect( services.databaseService.insertOrUpdateDjNickname ).toHaveBeenCalledWith( {
            uuid: 'wavez-user-123',
            nickname: 'WavezNickname'
        } );
    } );

    test( 'should work with Hang userProfileChanged event structure', async () => {
        const event = {
            type: 'userProfileChanged',
            payload: {
                userId: 'hang-user-456',
                nickname: 'HangNickname'
            },
            source: 'hangfm'
        };
        const context = { services };

        await handleUpdatedUserProfileEvent( event, context );

        expect( services.databaseService.insertOrUpdateDjNickname ).toHaveBeenCalledWith( {
            uuid: 'hang-user-456',
            nickname: 'HangNickname'
        } );
    } );
} );
