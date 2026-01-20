#!/usr/bin/env node

/**
 * List all available Gemini models
 * Usage: node scripts/listGeminiModels.js
 * 
 * This script queries the Google Gemini API to show which models are available
 * for your API key. Use this to verify new models before adding them to the bot.
 */

require( 'dotenv' ).config();
const { GoogleGenAI } = require( "@google/genai" );

const googleAIKey = process.env.googleAIKey;

if ( !googleAIKey ) {
  console.error( "❌ googleAIKey not found in environment variables. Please set it in your .env file." );
  process.exit( 1 );
}

async function listModels () {
  try {
    const genAI = new GoogleGenAI( { apiKey: googleAIKey } );
    const result = await genAI.models.list();

    // Handle different response formats from the API
    let models = [];
    if ( Array.isArray( result ) ) {
      models = result;
    } else if ( result.models ) {
      models = result.models;
    } else if ( result.pageInternal ) {
      models = result.pageInternal;
    } else if ( Array.isArray( result.pageInternal ) ) {
      models = result.pageInternal;
    }

    if ( !models || models.length === 0 ) {
      console.log( "\n❌ No models found in response. Check API key and permissions.\n" );
      process.exit( 1 );
    }

    // Filter for text generation models that support generateContent
    const textModels = models.filter( m =>
      m.supportedActions && m.supportedActions.includes( 'generateContent' )
    );

    console.log( "\n📋 Available Gemini Text Generation Models:\n" );
    console.log( "Model Name" );
    console.log( "-".repeat( 50 ) );

    // Helper function to categorize models
    function getModelType ( name, description ) {
      if ( name.includes( 'embedding' ) ) return '🔗 Embedding';
      if ( name.includes( 'text-embedding' ) ) return '🔗 Text Embedding';
      if ( name.includes( 'imagen' ) ) return '🖼️ Image Generation';
      if ( name.includes( 'veo' ) ) return '🎬 Video Generation';
      if ( name.includes( 'flash-lite' ) ) return '⚡ Lite (Fast)';
      if ( name.includes( 'flash' ) ) return '⚡ Flash (Fast)';
      if ( name.includes( 'pro' ) ) return '🧠 Pro (Advanced)';
      if ( name.includes( 'nano-banana' ) ) return '🍌 Nano Banana';
      if ( name.includes( 'robotics' ) ) return '🤖 Robotics';
      if ( name.includes( 'computer-use' ) ) return '💻 Computer Use';
      if ( name.includes( 'gemma' ) ) return '✨ Gemma';
      if ( description && description.toLowerCase().includes( 'preview' ) ) return '🧪 Preview';
      return '🔷 Text';
    }

    // Helper function to determine billing category based on model capabilities
    function getBillingCategory ( name, supportedActions ) {
      if ( supportedActions.includes( 'embedContent' ) || supportedActions.includes( 'embedText' ) ) {
        return 'Embedding Model';
      }
      if ( supportedActions.includes( 'predict' ) ) {
        if ( name.includes( 'imagen' ) ) return 'Image Generation Model';
        if ( name.includes( 'veo' ) ) return 'Video Generation Model';
      }
      if ( supportedActions.includes( 'predictLongRunning' ) ) {
        return 'Video Generation Model';
      }
      if ( supportedActions.includes( 'generateAnswer' ) ) {
        return 'AQA (Attribution Answering)';
      }
      if ( supportedActions.includes( 'bidiGenerateContent' ) || 
           supportedActions.includes( 'generateContent' ) ||
           supportedActions.includes( 'countTokens' ) ) {
        return 'Text Generation Model';
      }
      return 'Other';
    }

    // Group and display models
    textModels.forEach( model => {
      const name = model.name ? model.name.replace( 'models/', '' ) : 'N/A';
      const description = model.description || model.displayName || '';
      const type = getModelType( name, description );
      const billingCategory = getBillingCategory( name, model.supportedActions || [] );
      const shortDesc = description.length > 50 ? description.substring( 0, 47 ) + '...' : description;

      console.log( `${ type } ${ name }` );
      console.log( `   💳 Billing: ${ billingCategory }` );
      if ( shortDesc ) {
        console.log( `   📝 ${ shortDesc }` );
      }
    } );

    console.log( "\n✅ Total generateContent-capable models: " + textModels.length );
    console.log( "\n💡 To use a model in the bot:" );
    console.log( "   1. Pick a model from the list above" );
    console.log( "   2. Update PRIMARY_MODEL in machineLearningService.js" );
    console.log( "   3. Set it like: const primaryModel = 'gemini-2.5-flash';\n" );
    console.log( "🚀 Recommended models:" );
    console.log( "   - gemini-2.5-flash (latest, fast, balanced)" );
    console.log( "   - gemini-2.5-pro (more capable, slower)" );
    console.log( "   - gemini-2.0-flash (stable, proven)\n" );
  } catch ( error ) {
    console.error( "\n❌ Error listing models:", error.message );
    console.error( "\nCommon issues:" );
    console.error( "  - Invalid API key in .env" );
    console.error( "  - Google Generative AI API not enabled in Google Cloud Console" );
    console.error( "  - Rate limiting or quota exceeded" );
    process.exit( 1 );
  }
}

listModels();
