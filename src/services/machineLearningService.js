const { GoogleGenerativeAI } = require( "@google/generative-ai" );
const { logger } = require( "../lib/logging" );

/**
 * Machine Learning Service
 * Provides AI-powered functionality using Google's Generative AI
 */
class MachineLearningService {
  constructor () {
    this.googleAIKey = process.env.googleAIKey;
    this.genAI = null;

    if ( this.googleAIKey ) {
      this.genAI = new GoogleGenerativeAI( this.googleAIKey );
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
      const model = this.genAI.getGenerativeModel( { model: primaryModel } );
      const reply = await model.generateContent( theQuestion );
      const theResponse = reply?.response?.text?.() || "No response text available";

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
      const model = this.genAI.getGenerativeModel( { model: fallbackModel } );
      const reply = await model.generateContent( theQuestion );
      const theResponse = reply?.response?.text?.() || "No response text available";

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