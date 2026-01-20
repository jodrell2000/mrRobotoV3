const { GoogleGenAI } = require( "@google/genai" );
const { logger } = require( "../lib/logging" );

/**
 * Machine Learning Service
 * Provides AI-powered functionality using Google's Generative AI
 */
class MachineLearningService {
  constructor ( services ) {
    this.googleAIKey = process.env.googleAIKey;
    this.genAI = null;
    this.services = services;
    this.currentChat = null; // Store the active chat session
    this.availableModels = []; // Will be populated with text generation models from API

    if ( this.googleAIKey ) {
      this.genAI = new GoogleGenAI( { apiKey: this.googleAIKey } );
      // Don't await initialization in constructor - it will happen asynchronously
      // This keeps tests simple and doesn't block initialization
      this.initializeAvailableModels().catch( err => {
        logger.warn( `🤖 [MachineLearningService] Failed to load available models on init: ${ err.message }` );
      } );
    }
  }

  /**
   * Initialize the list of available text generation models from the API
   * This allows us to build a dynamic fallback chain
   */
  async initializeAvailableModels () {
    try {
      const models = await this.genAI.models.list();

      // Handle different response formats
      let modelList = [];
      if ( Array.isArray( models ) ) {
        modelList = models;
      } else if ( models.models ) {
        modelList = models.models;
      } else if ( models.pageInternal ) {
        modelList = models.pageInternal;
      }

      // Filter for text generation models that support generateContent
      this.availableModels = modelList
        .filter( m => m.supportedActions && m.supportedActions.includes( 'generateContent' ) )
        .map( m => m.name.replace( 'models/', '' ) )
        .sort();

      logger.info( `🤖 [MachineLearningService] Loaded ${ this.availableModels.length } available text generation models` );
    } catch ( error ) {
      logger.warn( `🤖 [MachineLearningService] Could not load available models: ${ error.message }` );
      this.availableModels = [];
    }
  }

  /**
   * Get the next fallback model from the available models list
   * Skips the provided model and returns the next available one
   * @param {string} currentModel - The model to skip
   * @returns {string|null} The next available model or null
   */
  getNextFallbackModel ( currentModel ) {
    const cleanCurrent = currentModel.replace( 'models/', '' );
    const remaining = this.availableModels.filter( m => m !== cleanCurrent );
    return remaining.length > 0 ? remaining[ 0 ] : null;
  }

  /**
   * Load conversation history from data service
   * @param {boolean} skipDataLoad - Skip calling loadData() if data is already loaded
   * @returns {Array} Array of conversation entries within the last hour
   */
  async loadConversationHistory ( skipDataLoad = false ) {
    try {
      if ( !this.services?.dataService ) {
        return [];
      }

      if ( !skipDataLoad ) {
        await this.services.dataService.loadData();
      }
      const allHistory = this.services.dataService.getValue( 'conversationHistory' ) || [];

      // Filter to only include entries from the last hour
      const oneHourAgo = Date.now() - ( 60 * 60 * 1000 );
      const recentHistory = allHistory.filter( entry =>
        new Date( entry.timestamp ).getTime() > oneHourAgo
      );

      // Return all entries from the last hour (no limit on count)
      return recentHistory;
    } catch ( error ) {
      logger.error( `🤖 [MachineLearningService] Error loading conversation history: ${ error.message }` );
      return [];
    }
  }

  /**
   * Save conversation entry to data service
   * @param {string} question - The question asked
   * @param {string} response - The AI's response
   * @param {boolean} skipDataLoad - Skip calling loadData() if data is already loaded
   */
  async saveConversationEntry ( question, response, skipDataLoad = false ) {
    try {
      if ( !this.services?.dataService ) {
        return;
      }

      if ( !skipDataLoad ) {
        await this.services.dataService.loadData();
      }

      // Load existing history
      let allHistory = this.services.dataService.getValue( 'conversationHistory' ) || [];

      // Add new entry
      const newEntry = {
        timestamp: new Date().toISOString(),
        question: question,
        response: response
      };
      allHistory.push( newEntry );

      // Filter to keep only entries from the last hour
      const oneHourAgo = Date.now() - ( 60 * 60 * 1000 );
      const filteredHistory = allHistory.filter( entry =>
        new Date( entry.timestamp ).getTime() > oneHourAgo
      );

      // Save back to data service
      await this.services.dataService.setValue( 'conversationHistory', filteredHistory );
    } catch ( error ) {
      logger.error( `🤖 [MachineLearningService] Error saving conversation entry: ${ error.message }` );
    }
  }

  /**
   * Convert conversation history to Google AI chat history format
   * @param {Array} history - Array of conversation entries
   * @returns {Array} Array of Google AI chat history objects
   */
  formatChatHistory ( history ) {
    const chatHistory = [];

    for ( const entry of history ) {
      // Add user message
      chatHistory.push( {
        role: 'user',
        parts: [ { text: entry.question } ]
      } );

      // Add model response
      chatHistory.push( {
        role: 'model',
        parts: [ { text: entry.response } ]
      } );
    }

    return chatHistory;
  }

  /**
   * Get or create a chat session with current conversation history
   * @param {string} model - The model to use for the chat
   * @param {Array} conversationHistory - The conversation history
   * @param {Array} systemInstruction - System instructions for the chat as array of strings
   * @returns {Promise<Object>} Promise that resolves to the chat instance
   */
  async getOrCreateChat ( model, conversationHistory, systemInstruction ) {
    // Format the conversation history for the chat API
    const formattedHistory = this.formatChatHistory( conversationHistory );

    // Create chat configuration
    const config = {
      temperature: 0.9,
      history: formattedHistory
    };

    // Add system instruction if available
    if ( systemInstruction ) {
      config.systemInstruction = systemInstruction;
    }

    logger.debug( `🤖 [MachineLearningService] Creating chat with model: ${ model }` );
    logger.debug( `🤖 [MachineLearningService] Chat config: ${ JSON.stringify( { config }, null, 2 ) }` );

    // Always create a new chat session with the current history and context
    // This ensures we have the most up-to-date conversation context
    this.currentChat = await this.genAI.chats.create( {
      model: model,
      config
    } );

    return this.currentChat;
  }

  /**
   * Create comprehensive system instruction by combining MLPersonality and MLInstructions
   * @param {boolean} skipDataLoad - Skip calling loadData() if data is already loaded
   * @returns {Array|null} Array of processed system instruction strings or null if not available
   */
  async createSystemInstruction ( skipDataLoad = false ) {
    if ( !this.services?.dataService ) {
      return null;
    }

    try {
      if ( !skipDataLoad ) {
        await this.services.dataService.loadData();
      }

      const personality = this.services.dataService.getValue( 'Instructions.MLPersonality' );
      const instructions = this.services.dataService.getValue( 'Instructions.MLInstructions' );

      // Always start with the hardcoded safety instruction
      const systemInstructionArray = [ "## Safety & Constraints\n- **Prohibited Content:** No sexist, racist, or homophobic language." ];

      // Add instructions if available
      if ( instructions ) {
        const processedInstructions = this.services.tokenService
          ? await this.services.tokenService.replaceTokens( instructions, {}, true )
          : instructions
            .replace( /\{hangoutName\}/g, hangoutName )
            .replace( /\{botName\}/g, botName );
        systemInstructionArray.push( "\n" + processedInstructions );
      }

      // Add personality if available
      if ( personality ) {
        const processedPersonality = this.services.tokenService
          ? await this.services.tokenService.replaceTokens( personality, {}, true )
          : personality
            .replace( /\{hangoutName\}/g, hangoutName )
            .replace( /\{botName\}/g, botName );
        systemInstructionArray.push( "\n" + processedPersonality );
      }

      return systemInstructionArray;
    } catch ( error ) {
      logger.error( `🤖 [MachineLearningService] Error creating system instruction: ${ error.message }` );
      return null;
    }
  }

  /**
   * Get system instructions with template replacement (deprecated - use createSystemInstruction)
   * @param {boolean} skipDataLoad - Skip calling loadData() if data is already loaded
   * @returns {string|null} The processed system instructions or null if not available
   */
  async getSystemInstructions ( skipDataLoad = false ) {
    // Delegate to the new createSystemInstruction method for backward compatibility
    return await this.createSystemInstruction( skipDataLoad );
  }

  /**
   * List all available models from Google AI API
   * @returns {Promise<Array>} Array of available model names, or empty array if error
   */
  async listModels () {
    if ( !this.genAI ) {
      logger.warn( "🤖 [MachineLearningService] Google AI service not configured. Cannot list models." );
      return [];
    }

    try {
      const models = await this.genAI.models.list();
      const modelNames = models.map( m => m.name.replace( 'models/', '' ) );
      logger.info( `🤖 [MachineLearningService] Available models: ${ modelNames.join( ', ' ) }` );
      return modelNames;
    } catch ( error ) {
      logger.error( `🤖 [MachineLearningService] Error listing models: ${ error.message }` );
      return [];
    }
  }

  /**
   * Ask Google AI a question and get a response using conversation context
   * Tries primary model, then dynamically falls back through available models
   * @param {string} theQuestion - The question to ask the AI
   * @param {Object} chatFunctions - Optional chat functions (reserved for future use)
   * @returns {Promise<string>} The AI's response or error message
   */
  async askGoogleAI ( theQuestion, chatFunctions ) {
    if ( !this.genAI ) {
      return "Google AI service is not configured. Please check your googleAIKey environment variable.";
    }

    // Load data once at the start
    if ( this.services?.dataService ) {
      await this.services.dataService.loadData();
    }

    // TEMPORARY: Use only Gemma models
    const primaryModel = "gemma-3-27b-it";
    const secondaryModel = "gemma-3-12b-it";

    // Create fallback chain with guaranteed models first, then dynamically-loaded ones
    const modelsToTry = [ primaryModel, secondaryModel ];

    // Add any other available gemma models that aren't already in the chain
    if ( this.availableModels && this.availableModels.length > 0 ) {
      for ( const model of this.availableModels ) {
        if ( model.includes( 'gemma' ) && !modelsToTry.includes( model ) ) {
          modelsToTry.push( model );
        }
      }
    }

    // Try each model in the fallback chain
    for ( const model of modelsToTry ) {
      try {
        const result = await this.tryModel( model, theQuestion );
        if ( result ) {
          return result;
        }
      } catch ( error ) {
        logger.warn( `🤖 [MachineLearningService] Error with model ${ model }: ${ error.message }` );
        // Continue to next model in chain
      }
    }

    // All models failed
    logger.error( `🤖 [MachineLearningService] All available models exhausted (${ modelsToTry.length } attempted). Unable to get response.` );
    return "I'm unable to process your request at the moment. Please try again later.";
  }

  /**
   * Try a single model with the given question
   * @param {string} model - The model name to try
   * @param {string} theQuestion - The question to ask
   * @returns {Promise<string|null>} The response or null if unsuccessful
   */
  async tryModel ( model, theQuestion ) {
    // Load conversation history (data already loaded in askGoogleAI)
    const conversationHistory = await this.loadConversationHistory( true );

    // Get system instructions
    const systemInstruction = await this.createSystemInstruction( true );

    // For Gemma models, include instructions in the question with proper turn tokens; for others, pass separately
    let instructionsForChat = null;
    let questionToSend = theQuestion;

    if ( model.includes( 'gemma' ) ) {
      // Gemma models: format with turn tokens as per documentation
      // https://ai.google.dev/gemma/docs/core/prompt-structure
      let prompt = '<start_of_turn>user\n';

      // Add instructions if available
      if ( systemInstruction && systemInstruction.length > 0 ) {
        prompt += systemInstruction.join( '\n\n' ) + '\n\n';
      }

      // Add the actual question and close the turn
      prompt += theQuestion + '<end_of_turn>\n<start_of_turn>model\n';

      questionToSend = prompt;
    } else {
      // Other models: pass instructions separately
      instructionsForChat = systemInstruction;
    }

    // Get or create chat session with conversation history
    const chat = await this.getOrCreateChat( model, conversationHistory, instructionsForChat );

    logger.debug( `🤖 [MachineLearningService] Trying model ${ model }. The Question: ${ JSON.stringify( {
      theQuestion
    }, null, 2 ) }` );

    // Send the message to the chat
    const response = await chat.sendMessage( {
      message: questionToSend
    } );

    logger.debug( `🤖 [MachineLearningService] Full API Request sent to model ${ model }:` );
    logger.debug( `🤖 [MachineLearningService] Message: ${ JSON.stringify( questionToSend, null, 2 ) }` );
    logger.debug( `🤖 [MachineLearningService] Full API Response from ${ model }: ${ JSON.stringify( response, null, 2 ) }` );

    const theResponse = response.text;

    if ( theResponse && theResponse !== "No response text available" ) {
      logger.info( `🤖 [MachineLearningService] Successfully used model: ${ model }` );
      // Conversation history storage disabled - no longer saving entries
      return theResponse;
    }

    logger.warn( `🤖 [MachineLearningService] Model ${ model } returned no response` );
    return null;
  }

}

module.exports = MachineLearningService;