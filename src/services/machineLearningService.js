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

    try {
      const model = this.genAI.getGenerativeModel( { model: "gemini-2.5-flash" } );
      const reply = await model.generateContent( theQuestion );
      const theResponse = reply?.response?.text?.() || "No response text available";

      if ( theResponse !== "No response text available" ) {
        logger.debug( `🤖 [MachineLearningService] askGoogleAI - Response: ${ theResponse }` );
        return theResponse;
      } else {
        return "No response";
      }
    } catch ( error ) {
      console.error( "Google AI error:", error );
      return "An error occurred while connecting to Google Gemini. Please wait a minute and try again";
    }
  }
}

module.exports = MachineLearningService;