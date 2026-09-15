function hasPermission ( services, platformRole, requiredLevel ) {
    const framework = services?.frameworkSpecification;
    const normalizedRole = String( platformRole || '' ).trim().toLowerCase();

    if ( framework?.resolveCommandPermissions ) {
        const resolvedLevel = framework.resolveCommandPermissions( normalizedRole );
        const levels = {
            OWNER: [ 'OWNER' ],
            MODERATOR: [ 'OWNER', 'MODERATOR' ],
            USER: [ 'OWNER', 'MODERATOR', 'USER' ]
        };
        if ( !levels[ requiredLevel ] ) throw new Error( `Invalid required level: ${ requiredLevel }` );
        return levels[ requiredLevel ].includes( resolvedLevel );
    }

    const { hasPermission: legacyHasPermission } = require( '../lib/roleUtils.js' );
    return legacyHasPermission( normalizedRole, requiredLevel );
}

module.exports = { hasPermission };
