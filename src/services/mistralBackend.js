const { logger } = require( "../lib/logging" );
const { normalizeText } = require( "../lib/textUtils" );

/**
 * Mistral Backend for Machine Learning Service
 * Provides interface to Mistral AI models
 */
class MistralBackend {
    constructor () {
        this.mistralApiKey = process.env.MISTRAL_API_KEY;
        this.client = null;
        this.availableModels = [];
        this.Mistral = null;
    }

    /**
     * Initialize the Mistral backend
     * @param {Object} config - Configuration object
     * @returns {Promise<Object>} Initialization status
     */
    async initialize ( config ) {
        try {
            if ( !this.mistralApiKey ) {
                return {
                    success: false,
                    error: "MISTRAL_API_KEY environment variable not set"
                };
            }

            // Dynamically import Mistral SDK (ES module)
            const { Mistral } = await import( "@mistralai/mistralai" );
            this.Mistral = Mistral;
            this.client = new Mistral( { apiKey: this.mistralApiKey } );
            await this.initializeAvailableModels();

            return {
                success: true,
                message: "Mistral backend initialized successfully"
            };
        } catch ( error ) {
            logger.error( `🤖 [MistralBackend] Initialization error: ${ error.message }` );
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate configuration for Mistral backend
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validation result
     */
    validateConfig ( config ) {
        if ( !process.env.MISTRAL_API_KEY ) {
            return {
                valid: false,
                errors: [ "MISTRAL_API_KEY environment variable is required" ]
            };
        }

        return {
            valid: true,
            errors: []
        };
    }

    /**
     * Check backend health
     * @returns {Promise<Object>} Health status
     */
    async healthCheck () {
        try {
            if ( !this.client ) {
                return {
                    healthy: false,
                    status: "not_initialized",
                    message: "Mistral backend not initialized"
                };
            }

            // Try to list models as a connectivity check
            await this.client.models.list();

            return {
                healthy: true,
                status: "operational",
                message: `Mistral backend operational with ${ this.availableModels.length } available models`
            };
        } catch ( error ) {
            logger.error( `🤖 [MistralBackend] Health check error: ${ error.message }` );
            return {
                healthy: false,
                status: "error",
                message: error.message
            };
        }
    }

    /**
     * Initialize the list of available Mistral models
     * Filter to keep only relevant models for text generation (mistral/ministral)
     * Ignore transcribe, ocr, code, and vision models
     * @private
     */
    async initializeAvailableModels () {
        try {
            const response = await this.client.models.list();

            let modelList = [];
            if ( Array.isArray( response ) ) {
                modelList = response;
            } else if ( response.data && Array.isArray( response.data ) ) {
                modelList = response.data;
            } else if ( response.models && Array.isArray( response.models ) ) {
                modelList = response.models;
            }

            this.availableModels = modelList
                .map( m => m.id || m.name )
                .filter( m => {
                    if ( !m ) return false;

                    // Only include mistral and ministral models for text generation
                    const isMistralModel = m.includes( 'mistral' ) || m.includes( 'ministral' );
                    if ( !isMistralModel ) return false;

                    // Exclude specialized models
                    if ( m.includes( 'transcribe' ) ) return false;
                    if ( m.includes( 'ocr' ) ) return false;
                    if ( m.includes( 'code' ) ) return false;
                    if ( m.includes( 'embed' ) ) return false;
                    if ( m.includes( 'vision' ) ) return false;
                    if ( m.includes( 'tts' ) ) return false;
                    if ( m.includes( 'voxtral' ) ) return false;

                    return true;
                } )
                .sort();

            logger.debug( `🤖 [MistralBackend] Available Mistral models (filtered): ${ this.availableModels.join( ', ' ) }` );
        } catch ( error ) {
            logger.warn( `🤖 [MistralBackend] Could not load available models: ${ error.message }` );
            this.availableModels = [];
        }
    }

    /**
     * Get prioritized model list for fallback chain
     * Prefers 8b models over smaller/larger variants
     * @private
     * @returns {Array<string>} Ordered list of models to try
     */
    getPrioritizedModels () {
        // Preference order: 8b models first, then others
        const modelPreferences = [
            'ministral-8b-latest',
            'ministral-8b-2512',
            'mistral-medium-latest',
            'mistral-medium-3.5',
            'mistral-medium-3-5',
            'mistral-medium-3',
            'ministral-3b-latest',
            'ministral-3b-2512',
            'mistral-small-latest'
        ];

        // Start with preferred models that are available
        const prioritized = modelPreferences.filter( m => this.availableModels.includes( m ) );

        // Add any remaining available models
        for ( const model of this.availableModels ) {
            if ( !prioritized.includes( model ) ) {
                prioritized.push( model );
            }
        }

        return prioritized.length > 0 ? prioritized : [ 'mistral-tiny-latest', 'ministral-3b-latest' ];
    }

    /**
     * Query the Mistral backend with a prompt
     * @param {string} prompt - The prompt to send
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Response object with success, response, and metadata
     */
    async queryLLM ( prompt, options = {} ) {
        if ( !this.client ) {
            return {
                success: false,
                response: null,
                error: "Mistral backend not initialized"
            };
        }

        const normalizedPrompt = normalizeText( prompt );

        // Get prioritized model list, limit to 3 models for fallback
        const prioritizedModels = this.getPrioritizedModels();
        const modelsToTry = prioritizedModels.slice( 0, 3 );
        const attemptedModels = [];
        const quotaExceededModels = [];

        logger.debug( `🤖 [MistralBackend] Attempting query with prioritized models: ${ modelsToTry.join( ', ' ) }` );

        for ( const model of modelsToTry ) {
            try {
                const result = await this.tryModel( model, normalizedPrompt, options );
                if ( result ) {
                    return result;
                }
            } catch ( error ) {
                attemptedModels.push( model );

                const is429Error = error.status === 429 ||
                    error.code === 429 ||
                    error.message?.includes( '429' ) ||
                    error.message?.toLowerCase().includes( 'quota' ) ||
                    error.message?.toLowerCase().includes( 'rate limit' );

                if ( is429Error ) {
                    logger.warn( `🤖 [MistralBackend] Quota exceeded for model ${ model }, trying next model...` );
                    quotaExceededModels.push( model );
                    // Continue to next model instead of returning
                    continue;
                }

                logger.warn( `🤖 [MistralBackend] Error with model ${ model }: ${ error.message }` );
            }
        }

        // All models exhausted - determine response
        if ( quotaExceededModels.length === attemptedModels.length && quotaExceededModels.length > 0 ) {
            // All models failed with quota exceeded
            logger.error( `🤖 [MistralBackend] API quota exceeded for all attempted models: ${ quotaExceededModels.join( ', ' ) }` );
            return {
                success: false,
                response: null,
                error: "API quota exceeded for all models",
                retryable: true
            };
        }

        logger.error( `🤖 [MistralBackend] All models exhausted (${ modelsToTry.length } attempted)` );
        return {
            success: false,
            response: null,
            error: "All models exhausted"
        };
    }

    /**
     * Try a single model
     * @private
     * @param {string} model - Model name
     * @param {string} prompt - Prompt text
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Response object
     */
    async tryModel ( model, prompt, options = {} ) {
        const systemInstruction = options.systemInstruction || null;

        logger.debug( `🤖 [MistralBackend] Trying model ${ model }` );

        // Build messages array
        const messages = [];

        // Add system instruction as a system message if provided
        if ( systemInstruction && systemInstruction.length > 0 ) {
            messages.push( {
                role: "system",
                content: systemInstruction.join( '\n\n' )
            } );
        }

        // Add the user prompt
        messages.push( {
            role: "user",
            content: prompt
        } );

        // Debug: Log the complete prompt being sent
        logger.debug( `🤖 [MistralBackend] Complete prompt for ${ model }:\n${ JSON.stringify( messages, null, 2 ) }` );

        const response = await this.client.chat.complete( {
            model: model,
            messages: messages,
            temperature: 0.8,
            topP: 0.8,
            maxTokens: 1024
        } );

        if ( !response || !response.choices || response.choices.length === 0 ) {
            logger.warn( `🤖 [MistralBackend] Model ${ model } returned no response` );
            return null;
        }

        const responseText = response.choices[ 0 ].message.content;

        if ( responseText ) {
            logger.info( `🤖 [MistralBackend] Successfully used model: ${ model }` );
            return {
                success: true,
                response: responseText,
                model: model,
                tokens: response.usage?.total_tokens || null
            };
        }

        logger.warn( `🤖 [MistralBackend] Model ${ model } returned empty response` );
        return null;
    }
}

module.exports = MistralBackend;
