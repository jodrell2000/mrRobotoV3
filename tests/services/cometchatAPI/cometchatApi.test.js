const cometchatApi = require( '../../../src/services/cometchatApi' );

describe( 'cometchatApi deprecated module', () => {
  test( 'does not expose the retired CometChat implementation', () => {
    expect( cometchatApi ).toEqual( {} );
  } );
} );
