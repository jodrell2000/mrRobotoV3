#!/usr/bin/env node

/**
 * Test Mistral Backend Connectivity
 * Usage: node scripts/testMistralBackend.js
 * 
 * This script tests the Mistral backend by sending a sample question
 * from the mlQuestions configuration.
 */

require( 'dotenv' ).config();

const MistralBackend = require( '../src/services/mistralBackend.js' );

async function testMistralBackend () {
    try {
        console.log( '\n🧪 Testing Mistral Backend Connectivity...\n' );

        // Initialize the backend
        const backend = new MistralBackend();
        console.log( '📡 Initializing Mistral backend...' );
        const initResult = await backend.initialize();

        if ( !initResult.success ) {
            console.error( '❌ Initialization failed:', initResult.error );
            process.exit( 1 );
        }

        console.log( '✅ Backend initialized successfully\n' );

        // Perform health check
        console.log( '💓 Running health check...' );
        const healthResult = await backend.healthCheck();
        console.log( `   Status: ${ healthResult.status }` );
        console.log( `   Message: ${ healthResult.message }\n` );

        // Test with a sample question from mlQuestions
        const testQuestion = `## Task
The user "Jodrell" wants to know some interesting information about the band or artist called "Guns N' Roses".
**Suggested information to include**
- when and where they formed
- when their first and most notable or recent releases were plus how well these releases performed in the charts in both the UK and USA
- notable former band members
- **Format:** Limit response to 300 words`;

        console.log( '🤔 Sending test question to Mistral...\n' );
        console.log( 'Question:' );
        console.log( '-'.repeat( 50 ) );
        console.log( testQuestion );
        console.log( '-'.repeat( 50 ) );
        console.log( '\n⏳ Waiting for response...\n' );

        const response = await backend.queryLLM( testQuestion );

        if ( !response.success ) {
            console.error( '❌ Query failed:', response.error );
            process.exit( 1 );
        }

        console.log( '✅ Response received successfully!\n' );
        console.log( 'Response:' );
        console.log( '-'.repeat( 50 ) );
        console.log( response.response );
        console.log( '-'.repeat( 50 ) );
        console.log( `\n📊 Model used: ${ response.model }` );
        if ( response.tokens ) {
            console.log( `📈 Tokens used: ${ response.tokens }` );
        }
        console.log( '\n✅ Mistral backend is working correctly!\n' );
    } catch ( error ) {
        console.error( '\n❌ Test failed with error:' );
        console.error( error.message );
        console.error( '\nStack trace:' );
        console.error( error.stack );
        process.exit( 1 );
    }
}

testMistralBackend();
