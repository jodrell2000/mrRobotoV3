function hasPermission ( services, platformRole, requiredLevel ) {
    const framework = services?.frameworkSpecification;
    if ( framework?.resolveCommandPermissions ) {
        const resolvedLevel = framework.resolveCommandPermissions( platformRole );
        const levels = {
            OWNER: [ 'OWNER' ],
            MODERATOR: [ 'OWNER', 'MODERATOR' ],
            USER: [ 'OWNER', 'MODERATOR', 'USER' ]
        };
        if ( !levels[ requiredLevel ] ) throw new Error( `Invalid required level: ${ requiredLevel }` );
        return levels[ requiredLevel ].includes( resolvedLevel );
    }

    const { hasPermission: legacyHasPermission } = require( '../lib/roleUtils.js' );
    return legacyHasPermission( platformRole, requiredLevel );
}

module.exports = { hasPermission };
