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

    if ( this.googleAIKey ) {
      this.genAI = new GoogleGenAI( { apiKey: this.googleAIKey } );
    }
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
   * @param {string} systemInstruction - System instructions for the chat
   * @returns {Object} The chat instance
   */
  async getOrCreateChat ( model, conversationHistory, systemInstruction ) {
    // Format the conversation history for the chat API
    const formattedHistory = this.formatChatHistory( conversationHistory );
    
    // Create chat configuration
    const config = {
      history: formattedHistory
    };

    // Add system instruction if available
    if ( systemInstruction ) {
      config.systemInstruction = systemInstruction;
    }

    logger.debug( `🤖 [MachineLearningService] chatConfig: ${JSON.stringify({ config })}` );

    // Always create a new chat session with the current history and context
    // This ensures we have the most up-to-date conversation context
    this.currentChat = this.genAI.chats.create( {
      model: model,
      config
    } );

    return this.currentChat;
  }

  /**
   * Create comprehensive system instruction by combining MLPersonality and MLInstructions
   * @param {boolean} skipDataLoad - Skip calling loadData() if data is already loaded
   * @returns {string|null} The processed system instruction or null if not available
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

      // If neither personality nor instructions exist, return null
      if ( !personality && !instructions ) {
        return null;
      }

      // Get replacement values
      const hangoutName = this.services.stateService?.getHangoutName?.() || 'Hangout FM';
      const botName = this.services.getState?.( 'botNickname' ) || 'DJ Bot';

      let combinedSystemInstruction = '';

      // Add personality if available
      if ( personality ) {
        const processedPersonality = personality
          .replace( /\{hangoutName\}/g, hangoutName )
          .replace( /\{botName\}/g, botName );
        combinedSystemInstruction += processedPersonality;
      }

      // Add instructions if available
      if ( instructions ) {
        const processedInstructions = instructions
          .replace( /\{hangoutName\}/g, hangoutName )
          .replace( /\{botName\}/g, botName );
        
        // Add a separator if we have both personality and instructions
        if ( personality ) {
          combinedSystemInstruction += '\n\n';
        }
        combinedSystemInstruction += processedInstructions;
      }

      return combinedSystemInstruction || null;
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
   * Ask Google AI a question and get a response using conversation context
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

    // Try primary model first
    const primaryModel = "gemini-2.5-flash";
    const fallbackModel = "gemini-1.5-pro";

    try {
      // Load conversation history (skip data load since we already loaded)
      const conversationHistory = await this.loadConversationHistory( true );
      
      // Get system instructions (skip data load since we already loaded)
      const systemInstruction = await this.createSystemInstruction( true );

      // Get or create chat session with conversation history
      const chat = await this.getOrCreateChat( primaryModel, conversationHistory, systemInstruction );

      // Log the full request being sent to AI
      logger.debug( `🤖 [MachineLearningService] The Question: ${JSON.stringify({
        theQuestion
      }, null, 2)}` );

      // Send the message to the chat
      const response = await chat.sendMessage( {
        message: theQuestion
      } );
      const theResponse = response.text;

      // Log the raw response from AI
      logger.debug( `🤖 [MachineLearningService] Raw AI Chat Response: ${JSON.stringify({
        model: primaryModel,
        response: theResponse,
        fullResponseObject: response
      }, null, 2)}` );

      if ( theResponse && theResponse !== "No response text available" ) {
        // Save this conversation entry (skip data load since we already loaded)
        await this.saveConversationEntry( theQuestion, theResponse, true );
        
        return theResponse;
      } else {
        // Primary model failed, try fallback
        return await this.tryFallbackModel( theQuestion, fallbackModel );
      }
    } catch ( error ) {
      logger.warn( `🤖 [MachineLearningService] Error with ${ primaryModel }: ${ error.message }, trying fallback model: ${ fallbackModel }` );
      // Primary model errored, try fallback
      return await this.tryFallbackModel( theQuestion, fallbackModel );
    }
  }

  /**
   * Try the fallback model when the primary model fails
   * @param {string} theQuestion - The question to ask the AI
   * @param {string} fallbackModel - The fallback model to use
   * @returns {Promise<string>} The AI's response or error message
   */
  async tryFallbackModel ( theQuestion, fallbackModel ) {
    try {
      // Load conversation history (skip data load since we already loaded in main method)
      const conversationHistory = await this.loadConversationHistory( true );

      // Get system instructions (skip data load since we already loaded in main method)
      const systemInstruction = await this.createSystemInstruction( true );

      // Get or create chat session with fallback model
      const chat = await this.getOrCreateChat( fallbackModel, conversationHistory, systemInstruction );

      // Log the full fallback request being sent to AI
      logger.debug( `🤖 [MachineLearningService] Full AI Fallback Chat Request: ${JSON.stringify({
        model: fallbackModel,
        systemInstruction: systemInstruction,
        message: theQuestion,
        conversationHistory: conversationHistory
      }, null, 2)}` );

      // Send the message to the fallback chat
      const response = await chat.sendMessage( {
        message: theQuestion
      } );
      const theResponse = response.text;

      // Log the raw response from fallback AI
      logger.debug( `🤖 [MachineLearningService] Raw AI Fallback Chat Response: ${JSON.stringify({
        model: fallbackModel,
        response: theResponse,
        fullResponseObject: response
      }, null, 2)}` );

      if ( theResponse && theResponse !== "No response text available" ) {
        // Save this conversation entry (skip data load since we already loaded in main method)
        await this.saveConversationEntry( theQuestion, theResponse, true );
        
        return theResponse;
      } else {
        logger.error( `🤖 [MachineLearningService] No response from fallback model ${ fallbackModel }` );
        return "No response";
      }
    } catch ( error ) {
      logger.error( `🤖 [MachineLearningService] Error with fallback model ${ fallbackModel }: ${ error.message }` );
      console.error( "Google AI error (fallback):", error );
      return "An error occurred while connecting to Google Gemini. Please wait a minute and try again";
    }
  }
}

module.exports = MachineLearningService;