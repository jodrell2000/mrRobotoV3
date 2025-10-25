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

    if ( this.googleAIKey ) {
      this.genAI = new GoogleGenAI( { apiKey: this.googleAIKey } );
    }
  }

  /**
   * Get system instructions with template replacement
   * @returns {string|null} The processed system instructions or null if not available
   */
  async getSystemInstructions () {
    if ( !this.services?.dataService ) {
      return null;
    }

    try {
      await this.services.dataService.loadData();
      const rawInstructions = this.services.dataService.getValue( 'MLInstructions' );

      if ( !rawInstructions ) {
        return null;
      }

      // Get replacement values
      const hangoutName = this.services.stateService?.getHangoutName?.() || 'Hangout FM';
      const botName = this.services.getState?.( 'botNickname' ) || 'DJ Bot';

      // Replace template variables
      const processedInstructions = rawInstructions
        .replace( /\{hangoutName\}/g, hangoutName )
        .replace( /\{botName\}/g, botName );

      logger.debug( `🤖 [MachineLearningService] Using system instructions: ${ processedInstructions }` );
      return processedInstructions;
    } catch ( error ) {
      logger.error( `🤖 [MachineLearningService] Error getting system instructions: ${ error.message }` );
      return null;
    }
  }

  /**
   * Ask Google AI a question and get a response
   * @param {string} theQuestion - The question to ask the AI
   * @param {Object} chatFunctions - Optional chat functions (reserved for future use)
   * @returns {Promise<string>} The AI's response or error message
   */
  async askGoogleAI ( theQuestion, chatFunctions ) {
    logger.debug( `🤖 [MachineLearningService] askGoogleAI - Question: ${ theQuestion }` );
    if ( !this.genAI ) {
      return "Google AI service is not configured. Please check your googleAIKey environment variable.";
    }

    // Try primary model first
    const primaryModel = "gemini-2.5-flash";
    const fallbackModel = "gemini-2.0-flash";

    try {
      logger.debug( `🤖 [MachineLearningService] Attempting with primary model: ${ primaryModel }` );

      // Get system instructions
      const systemInstruction = await this.getSystemInstructions();

      // Build request config
      const requestConfig = {
        model: primaryModel,
        contents: theQuestion
      };

      // Add system instruction if available
      if ( systemInstruction ) {
        requestConfig.config = {
          systemInstruction: [ systemInstruction ]
        };
      }

      const response = await this.genAI.models.generateContent( requestConfig );
      const theResponse = response?.text || "No response text available";

      if ( theResponse !== "No response text available" ) {
        logger.debug( `🤖 [MachineLearningService] askGoogleAI - Response from ${ primaryModel }: ${ theResponse }` );
        return theResponse;
      } else {
        logger.warn( `🤖 [MachineLearningService] No response from ${ primaryModel }, trying fallback model: ${ fallbackModel }` );
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
      logger.debug( `🤖 [MachineLearningService] Attempting with fallback model: ${ fallbackModel }` );

      // Get system instructions
      const systemInstruction = await this.getSystemInstructions();

      // Build request config
      const requestConfig = {
        model: fallbackModel,
        contents: theQuestion
      };

      // Add system instruction if available
      if ( systemInstruction ) {
        requestConfig.config = {
          systemInstruction: [ systemInstruction ]
        };
      }

      const response = await this.genAI.models.generateContent( requestConfig );
      const theResponse = response?.text || "No response text available";

      if ( theResponse !== "No response text available" ) {
        logger.debug( `🤖 [MachineLearningService] askGoogleAI - Response from ${ fallbackModel }: ${ theResponse }` );
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