const { hasPermission } = require( '../../src/services/permissionService.js' );

describe( 'permissionService', () => {
    test( 'resolves platform roles through the framework specification', () => {
        const services = {
            frameworkSpecification: {
                resolveCommandPermissions: role => ( role === 'moderator' ? 'MODERATOR' : 'USER' )
            }
        };

        expect( hasPermission( services, 'moderator', 'MODERATOR' ) ).toBe( true );
        expect( hasPermission( services, 'user', 'MODERATOR' ) ).toBe( false );
        expect( hasPermission( services, 'new-role', 'OWNER' ) ).toBe( false );
    } );

    test( 'falls back to Hang role utility without a framework specification', () => {
        expect( hasPermission( {}, 'moderator', 'MODERATOR' ) ).toBe( true );
        expect( hasPermission( {}, 'user', 'MODERATOR' ) ).toBe( false );
    } );
} );