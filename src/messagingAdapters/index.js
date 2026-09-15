const HangFmMessagingAdapter = require( './HangFmMessagingAdapter.js' );
const WavezFmMessagingAdapter = require( './WavezFmMessagingAdapter.js' );

function loadMessagingAdapter ( frameworkId, dependencies ) {
    if ( frameworkId === 'hangfm' ) return new HangFmMessagingAdapter( dependencies );
    if ( frameworkId === 'wavezfm' ) return new WavezFmMessagingAdapter( dependencies );
    throw new Error( `Messaging adapter not found for framework: ${ frameworkId }` );
}

module.exports = { loadMessagingAdapter };
