#!/usr/bin/env node

/**
 * List all available Mistral models
 * Usage: node scripts/listMistralModels.js
 * 
 * This script queries the Mistral AI API to show which models are available
 * for your API key. Use this to verify new models before adding them to the bot.
 */

require( 'dotenv' ).config();

const mistralApiKey = process.env.MISTRAL_API_KEY;

if ( !mistralApiKey ) {
    console.error( "❌ MISTRAL_API_KEY not found in environment variables. Please set it in your .env file." );
    process.exit( 1 );
}

async function listModels () {
    try {
        const { Mistral } = await import( "@mistralai/mistralai" );

        const client = new Mistral( { apiKey: mistralApiKey } );
        const result = await client.models.list();

        // Handle different response formats from the API
        let models = [];
        if ( Array.isArray( result ) ) {
            models = result;
        } else if ( result.data && Array.isArray( result.data ) ) {
            models = result.data;
        } else if ( result.models && Array.isArray( result.models ) ) {
            models = result.models;
        }

        if ( !models || models.length === 0 ) {
            console.log( "\n❌ No models found in response. Check API key and permissions.\n" );
            process.exit( 1 );
        }

        // Filter for chat completion models (exclude embeddings and vision-only)
        const chatModels = models.filter( m => {
            const id = m.id || m.name || '';
            return !id.includes( 'embed' ) && !id.includes( 'vision' );
        } );

        console.log( "\n📋 Available Mistral Chat Models:\n" );
        console.log( "Model Name" );
        console.log( "-".repeat( 50 ) );

        // Helper function to categorize models
        function getModelType ( name ) {
            if ( name.includes( 'embed' ) ) return '🔗 Embedding';
            if ( name.includes( 'vision' ) ) return '👁️ Vision';
            if ( name.includes( 'codestral' ) ) return '💻 Codestral';
            if ( name.includes( 'large' ) ) return '🧠 Large';
            if ( name.includes( 'small' ) ) return '⚡ Small';
            if ( name.includes( 'medium' ) ) return '📊 Medium';
            if ( name.includes( 'nemo' ) ) return '🌟 Nemo';
            return '🔷 Chat';
        }

        // Group and display models
        chatModels.forEach( model => {
            const name = model.id || model.name || 'N/A';
            const description = model.description || model.displayName || '';
            const type = getModelType( name );
            const shortDesc = description.length > 50 ? description.substring( 0, 47 ) + '...' : description;

            console.log( `${ type } ${ name }` );
            if ( shortDesc ) {
                console.log( `   📝 ${ shortDesc }` );
            }
        } );

        console.log( "\n✅ Total chat-capable models: " + chatModels.length );
        console.log( "\n💡 To use a model in the bot:" );
        console.log( "   1. Pick a model from the list above" );
        console.log( "   2. Update PRIMARY_MODEL in mistralBackend.js" );
        console.log( "   3. Set it like: const primaryModel = 'mistral-tiny-latest';\n" );
        console.log( "🚀 Recommended models (cost-optimized):" );
        console.log( "   - mistral-tiny-latest (ultra-small, fastest, lowest cost)" );
        console.log( "   - ministral-3b-latest (3B model, balanced quality/cost)" );
        console.log( "   - mistral-small-latest (small model, better quality)\n" );
    } catch ( error ) {
        console.error( "\n❌ Error listing models:", error.message );
        console.error( "\nCommon issues:" );
        console.error( "  - Invalid API key in .env" );
        console.error( "  - Mistral API endpoint unreachable" );
        console.error( "  - Rate limiting or quota exceeded" );
        console.error( "  - Network connectivity issues" );
        process.exit( 1 );
    }
}

listModels().catch( error => {
    console.error( "\n❌ Fatal error:", error.message );
    process.exit( 1 );
} );
