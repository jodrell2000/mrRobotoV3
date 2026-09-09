const { applyPatch } = require( 'fast-json-patch' );

function applyHangStatePatch ( state, statePatch ) {
    if ( !state ) throw new Error( 'Cannot apply patch - state not available' );

    const validOperations = statePatch.filter( operation => {
        if ( operation.op !== 'remove' ) return true;

        const pathParts = operation.path.split( '/' ).slice( 1 );
        let current = state;
        for ( const part of pathParts ) {
            if ( current && typeof current === 'object' && part in current ) {
                current = current[ part ];
            } else {
                return false;
            }
        }
        return true;
    } );

    if ( validOperations.length === 0 ) {
        return { newDocument: state, appliedOperations: 0 };
    }

    const patchResult = applyPatch( state, validOperations, true, false );
    return {
        newDocument: patchResult.newDocument,
        appliedOperations: validOperations.length
    };
}

module.exports = applyHangStatePatch;
