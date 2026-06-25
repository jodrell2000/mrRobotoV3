const { GoogleGenAI } = require( "@google/genai" );
const { logger } = require( "../lib/logging" );
const { normalizeText } = require( "../lib/textUtils" );

/**
 * Gemma Backend for Machine Learning Service
 * Provides interface to Google's Gemma models
 */
class GemmaBackend {
    constructor () {
        this.googleAIKey = process.env.googleAIKey;
        this.genAI = null;
        this.currentChat = null;
        this.availableModels = [];
    }

    /**
     * Initialize the Gemma backend
     * @param {Object} config - Configuration object
     * @returns {Promise<Object>} Initialization status
     */
    async initialize ( config ) {
        try {
            if ( !this.googleAIKey ) {
                return {
                    success: false,
                    error: "googleAIKey environment variable not set"
                };
            }

            this.genAI = new GoogleGenAI( { apiKey: this.googleAIKey } );
            await this.initializeAvailableModels();

            return {
                success: true,
                message: "Gemma backend initialized successfully"
            };
        } catch ( error ) {
            logger.error( `🤖 [GemmaBackend] Initialization error: ${ error.message }` );
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate configuration for Gemma backend
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validation result
     */
    validateConfig ( config ) {
        if ( !process.env.googleAIKey ) {
            return {
                valid: false,
                errors: [ "googleAIKey environment variable is required" ]
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
            if ( !this.genAI ) {
                return {
                    healthy: false,
                    status: "not_initialized",
                    message: "Gemma backend not initialized"
                };
            }

            // Try to list models as a connectivity check
            const models = await this.genAI.models.list();
            const modelList = Array.isArray( models ) ? models : models.models || models.pageInternal || [];

            return {
                healthy: modelList.length > 0,
                status: "operational",
                message: `Gemma backend operational with ${ this.availableModels.length } available models`
            };
        } catch ( error ) {
            logger.error( `🤖 [GemmaBackend] Health check error: ${ error.message }` );
            return {
                healthy: false,
                status: "error",
                message: error.message
            };
        }
    }

    /**
     * Initialize the list of available Gemma models
     * @private
     */
    async initializeAvailableModels () {
        try {
            const models = await this.genAI.models.list();

            let modelList = [];
            if ( Array.isArray( models ) ) {
                modelList = models;
            } else if ( models.models ) {
                modelList = models.models;
            } else if ( models.pageInternal ) {
                modelList = models.pageInternal;
            }

            this.availableModels = modelList
                .filter( m => m.supportedActions && m.supportedActions.includes( 'generateContent' ) )
                .map( m => m.name.replace( 'models/', '' ) )
                .filter( m => m.includes( 'gemma-4' ) )
                .sort();

            logger.debug( `🤖 [GemmaBackend] Available Gemma 4 models: ${ this.availableModels.join( ', ' ) }` );
        } catch ( error ) {
            logger.warn( `🤖 [GemmaBackend] Could not load available models: ${ error.message }` );
            this.availableModels = [];
        }
    }

    /**
     * Remove Gemini turn tokens from response text
     * @private
     * @param {string} text - Text to clean
     * @returns {string} Cleaned text
     */
    cleanGeminiTokens ( text ) {
        if ( !text || typeof text !== 'string' ) {
            return text;
        }

        return text
            .replace( /<start_of_turn>user\n/g, '' )
            .replace( /<start_of_turn>model\n/g, '' )
            .replace( /<start_of_turn>/g, '' )
            .replace( /<end_of_turn>/g, '' )
            .trim();
    }

    /**
     * Format conversation history for Google AI chat API
     * @private
     * @param {Array} history - Conversation history
     * @returns {Array} Formatted history
     */
    formatChatHistory ( history ) {
        const chatHistory = [];

        for ( const entry of history ) {
            if ( entry.role && entry.content ) {
                chatHistory.push( {
                    role: entry.role,
                    parts: [ { text: entry.content } ]
                } );
            } else if ( entry.question && entry.response ) {
                chatHistory.push( {
                    role: 'user',
                    parts: [ { text: entry.question } ]
                } );
                chatHistory.push( {
                    role: 'model',
                    parts: [ { text: entry.response } ]
                } );
            }
        }

        return chatHistory;
    }

    /**
     * Create or get a chat session
     * @private
     * @param {string} model - Model name
     * @param {Array} systemInstruction - System instructions
     * @returns {Promise<Object>} Chat instance
     */
    async getOrCreateChat ( model, systemInstruction ) {
        const config = {
            temperature: 0.8,
            topP: 0.8,
            topK: 20,
            maxOutputTokens: 1024,
            thinkingConfig: {
                includeThoughts: true,
                thinkingLevel: "HIGH"
            },
            history: []
        };

        if ( systemInstruction ) {
            config.systemInstruction = systemInstruction;
        }

        this.currentChat = await this.genAI.chats.create( {
            model: model,
            config
        } );

        return this.currentChat;
    }

    /**
     * Query the Gemma backend with a prompt
     * @param {string} prompt - The prompt to send
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Response object with success, response, and metadata
     */
    async queryLLM ( prompt, options = {} ) {
        if ( !this.genAI ) {
            return {
                success: false,
                response: null,
                error: "Gemma backend not initialized"
            };
        }

        const normalizedPrompt = normalizeText( prompt );

        const primaryModel = "gemma-4-31b-it";
        const secondaryModel = "gemma-4-26b-a4b-it";

        const modelsToTry = [ primaryModel, secondaryModel ];

        if ( this.availableModels && this.availableModels.length > 0 ) {
            for ( const model of this.availableModels ) {
                if ( model.includes( 'gemma-4' ) && !modelsToTry.includes( model ) ) {
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
                    logger.error( `🤖 [GemmaBackend] API quota exceeded (429)` );
                    return {
                        success: false,
                        response: null,
                        error: "API quota exceeded"
                    };
                }

                logger.warn( `🤖 [GemmaBackend] Error with model ${ model }: ${ error.message }` );
            }
        }

        logger.error( `🤖 [GemmaBackend] All models exhausted (${ modelsToTry.length } attempted)` );
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

        let promptToSend = prompt;

        // Gemma models use turn tokens
        let fullPrompt = '<start_of_turn>user\n';

        if ( systemInstruction && systemInstruction.length > 0 ) {
            fullPrompt += systemInstruction.join( '\n\n' ) + '\n\n';
        }

        fullPrompt += prompt + '<end_of_turn>\n<start_of_turn>model\n';
        promptToSend = normalizeText( fullPrompt );

        const chat = await this.getOrCreateChat( model, null );

        logger.debug( `🤖 [GemmaBackend] Trying model ${ model }` );

        const response = await chat.sendMessage( {
            message: promptToSend
        } );

        let responseText = response.text;
        responseText = this.cleanGeminiTokens( responseText );

        if ( responseText && responseText !== "No response text available" ) {
            logger.info( `🤖 [GemmaBackend] Successfully used model: ${ model }` );
            return {
                success: true,
                response: responseText,
                model: model,
                tokens: null
            };
        }

        logger.warn( `🤖 [GemmaBackend] Model ${ model } returned no response` );
        return null;
    }
}

module.exports = GemmaBackend;
