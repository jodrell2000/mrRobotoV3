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

    test( 'accepts mixed-case Wavez host roles as owner permissions', () => {
        const services = {
            frameworkSpecification: {
                resolveCommandPermissions: role => {
                    const normalized = String( role || '' ).trim().toLowerCase();
                    const map = { owner: 'OWNER', host: 'OWNER', manager: 'OWNER', moderator: 'MODERATOR', user: 'USER' };
                    return map[ normalized ] || 'USER';
                }
            }
        };

        expect( hasPermission( services, 'HOST', 'OWNER' ) ).toBe( true );
        expect( hasPermission( services, 'Owner', 'OWNER' ) ).toBe( true );
        expect( hasPermission( services, 'Moderator', 'OWNER' ) ).toBe( false );
    } );

    test( 'falls back to Hang role utility without a framework specification', () => {
        expect( hasPermission( {}, 'moderator', 'MODERATOR' ) ).toBe( true );
        expect( hasPermission( {}, 'user', 'MODERATOR' ) ).toBe( false );
    } );
} );