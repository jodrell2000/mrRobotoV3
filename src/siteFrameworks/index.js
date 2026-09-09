const hangfm = require( './hangfm/framework.js' );

const frameworks = {
    hangfm
};

function loadFramework ( frameworkId ) {
    const framework = frameworks[ frameworkId ];

    if ( !framework ) {
        throw new Error(
            `Site framework not found: ${ frameworkId }. Supported frameworks: ${ Object.keys( frameworks ).join( ', ' ) }`
        );
    }

    return framework;
}

module.exports = {
    frameworks,
    loadFramework
};
