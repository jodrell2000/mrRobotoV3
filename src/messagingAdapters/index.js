const HangFmMessagingAdapter = require( './HangFmMessagingAdapter.js' );

function loadMessagingAdapter ( frameworkId, dependencies ) {
    if ( frameworkId === 'hangfm' ) return new HangFmMessagingAdapter( dependencies );
    throw new Error( `Messaging adapter not found for framework: ${ frameworkId }` );
}

module.exports = { loadMessagingAdapter };
