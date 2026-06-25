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
                .filter( m => m && !m.includes( 'embed' ) && !m.includes( 'vision' ) )
                .sort();

            logger.debug( `🤖 [MistralBackend] Available Mistral models: ${ this.availableModels.join( ', ' ) }` );
        } catch ( error ) {
            logger.warn( `🤖 [MistralBackend] Could not load available models: ${ error.message }` );
            this.availableModels = [];
        }
    }

    /**
     * Get the next model in the fallback chain
     * @private
     * @param {string} currentModel - Current model name
     * @returns {string|null} Next model to try or null
     */
    getNextFallbackModel ( currentModel ) {
        const modelIndex = this.availableModels.indexOf( currentModel );
        if ( modelIndex >= 0 && modelIndex < this.availableModels.length - 1 ) {
            return this.availableModels[ modelIndex + 1 ];
        }
        return null;
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
        // logger.debug( `🤖 [MistralBackend] Normalized prompt: "${ normalizedPrompt }"` );

        const primaryModel = "mistral-tiny-latest";
        const secondaryModel = "ministral-3b-latest";

        const modelsToTry = [ primaryModel, secondaryModel ];

        if ( this.availableModels && this.availableModels.length > 0 ) {
            for ( const model of this.availableModels ) {
                if ( !modelsToTry.includes( model ) ) {
                    modelsToTry.push( model );
                }
            }
        }

        for ( const model of modelsToTry ) {
            try {
                return await this.tryModel( model, normalizedPrompt, options );
            } catch ( error ) {
                const is429Error = error.status === 429 ||
                    error.code === 429 ||
                    error.message?.includes( '429' ) ||
                    error.message?.toLowerCase().includes( 'quota' ) ||
                    error.message?.toLowerCase().includes( 'rate limit' );

                if ( is429Error ) {
                    logger.error( `🤖 [MistralBackend] API quota exceeded (429)` );
                    return {
                        success: false,
                        response: null,
                        error: "API quota exceeded"
                    };
                }

                logger.warn( `🤖 [MistralBackend] Error with model ${ model }: ${ error.message }` );
            }
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
