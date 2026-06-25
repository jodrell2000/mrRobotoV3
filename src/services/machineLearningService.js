const { logger } = require( "../lib/logging" );
const GemmaBackend = require( "./gemmaBackend" );
const MistralBackend = require( "./mistralBackend" );

/**
 * Machine Learning Service
 * Orchestrator for AI-powered functionality
 * Supports multiple backend implementations (Gemma, Mistral, etc.)
 */
class MachineLearningService {
  constructor ( services ) {
    this.services = services;
    this.activeBackend = null;
    this.backends = {
      gemma: new GemmaBackend(),
      mistral: new MistralBackend()
    };
    this.config = {
      active: "mistral",
      fallbackOrder: [ "mistral", "gemma" ],
      gemma: {
        enabled: true
      },
      mistral: {
        enabled: true
      }
    };
  }

  /**
   * Initialize the machine learning service
   * Loads configuration and initializes the active backend
   * @returns {Promise<Object>} Initialization result
   */
  async initialize () {
    try {
      // Load configuration from data service if available
      if ( this.services?.dataService ) {
        await this.services.dataService.loadData();
        const configData = this.services.dataService.getValue( 'llmBackend' );
        if ( configData ) {
          this.config = { ...this.config, ...configData };
        }
      }

      // Initialize the active backend
      const backendName = this.config.active || "gemma";
      const backend = this.backends[ backendName ];

      if ( !backend ) {
        logger.error( `🤖 [MachineLearningService] Unknown backend: ${ backendName }` );
        return {
          success: false,
          error: `Unknown backend: ${ backendName }`
        };
      }

      const result = await backend.initialize( this.config[ backendName ] );

      if ( result.success ) {
        this.activeBackend = backendName;
        logger.info( `🤖 [MachineLearningService] Initialized with backend: ${ backendName }` );
      } else {
        logger.warn( `🤖 [MachineLearningService] Failed to initialize ${ backendName }: ${ result.error }` );
        // Try fallback
        return await this.tryFallbackBackend();
      }

      return result;
    } catch ( error ) {
      logger.error( `🤖 [MachineLearningService] Initialization error: ${ error.message }` );
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Try to initialize a fallback backend
   * @private
   * @returns {Promise<Object>} Initialization result
   */
  async tryFallbackBackend () {
    const current = this.config.active || "gemma";
    const fallbackOrder = this.config.fallbackOrder || [ "gemma", "mistral" ];

    for ( const backendName of fallbackOrder ) {
      if ( backendName === current ) {
        continue; // Skip the one that already failed
      }

      const backend = this.backends[ backendName ];
      if ( !backend ) {
        continue;
      }

      logger.warn( `🤖 [MachineLearningService] Attempting fallback to ${ backendName }` );

      const result = await backend.initialize( this.config[ backendName ] );
      if ( result.success ) {
        this.activeBackend = backendName;
        logger.info( `🤖 [MachineLearningService] Switched to fallback backend: ${ backendName }` );
        return result;
      }
    }

    return {
      success: false,
      error: "No available backends"
    };
  }

  /**
   * Get current active backend name
   * @returns {string} Active backend name
   */
  getActiveBackend () {
    return this.activeBackend;
  }

  /**
   * Switch to a different backend
   * @param {string} backendName - Name of the backend to switch to
   * @returns {Promise<Object>} Switch result
   */
  async switchBackend ( backendName ) {
    if ( !this.backends[ backendName ] ) {
      return {
        success: false,
        error: `Unknown backend: ${ backendName }`
      };
    }

    const backend = this.backends[ backendName ];
    const result = await backend.initialize( this.config[ backendName ] );

    if ( result.success ) {
      this.activeBackend = backendName;

      // Save to data service if available
      if ( this.services?.dataService ) {
        try {
          await this.services.dataService.loadData();
          await this.services.dataService.setValue( 'llmBackend.active', backendName );
        } catch ( error ) {
          logger.warn( `🤖 [MachineLearningService] Could not persist backend switch: ${ error.message }` );
        }
      }

      logger.info( `🤖 [MachineLearningService] Switched to backend: ${ backendName }` );
      return {
        success: true,
        message: `Switched to ${ backendName } backend`
      };
    }

    return result;
  }

  /**
   * Check health of the active backend
   * @returns {Promise<Object>} Health status
   */
  async healthCheck () {
    if ( !this.activeBackend || !this.backends[ this.activeBackend ] ) {
      return {
        healthy: false,
        status: "not_initialized",
        message: "No active backend"
      };
    }

    return await this.backends[ this.activeBackend ].healthCheck();
  }

  /**
   * Load conversation history from data service
   * Currently returns empty array (mlConversationHistory removed)
   * @deprecated - mlConversationHistory no longer sent with requests
   * @returns {Array} Empty array
   */
  async loadConversationHistory ( skipDataLoad = false ) {
    return [];
  }

  /**
   * Load ML conversation history
   * Currently returns empty array (mlConversationHistory removed)
   * @deprecated - mlConversationHistory no longer sent with requests
   * @returns {Array} Empty array
   */
  async loadMLConversationHistory ( skipDataLoad = false ) {
    return [];
  }

  /**
   * Save conversation entry to data service
   * Currently a no-op (mlConversationHistory no longer stored)
   * @deprecated - mlConversationHistory no longer stored
   * @returns {Promise<void>}
   */
  async saveConversationEntry ( question, response, skipDataLoad = false ) {
    return;
  }

  /**
   * Create comprehensive system instruction by combining MLPersonality and MLInstructions
   * @param {boolean} skipDataLoad - Skip calling loadData() if data is already loaded
   * @returns {Promise<Array|null>} Array of system instruction strings or null
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

      const systemInstructionArray = [
        "## Safety & Constraints\n- **Prohibited Content:** No sexist, racist, or homophobic language.\n- **Use of Gender Pronouns:** Always use gender-neutral pronouns unless specified otherwise."
      ];

      if ( personality ) {
        const processedPersonality = this.services.tokenService
          ? await this.services.tokenService.replaceTokens( personality, {}, true )
          : personality;
        systemInstructionArray.push( "\n" + processedPersonality );
      }

      if ( instructions ) {
        const processedInstructions = this.services.tokenService
          ? await this.services.tokenService.replaceTokens( instructions, {}, true )
          : instructions;
        systemInstructionArray.push( "\n" + processedInstructions );
      }

      return systemInstructionArray;
    } catch ( error ) {
      logger.error( `🤖 [MachineLearningService] Error creating system instruction: ${ error.message }` );
      return null;
    }
  }

  /**
   * Get system instructions with template replacement (backward compatibility)
   * @param {boolean} skipDataLoad - Skip calling loadData() if data is already loaded
   * @returns {Promise<Array|null>} System instructions
   */
  async getSystemInstructions ( skipDataLoad = false ) {
    return await this.createSystemInstruction( skipDataLoad );
  }

  /**
   * List available models (for current backend)
   * @returns {Promise<Array>} Array of model names
   */
  async listModels () {
    if ( !this.activeBackend || !this.backends[ this.activeBackend ] ) {
      logger.warn( "🤖 [MachineLearningService] No active backend" );
      return [];
    }

    // Currently only Gemma backend has model listing
    if ( this.activeBackend === "gemma" ) {
      return this.backends.gemma.availableModels || [];
    }

    return [];
  }

  /**
   * Query the active LLM backend with a question
   * @param {string} theQuestion - The question to ask
   * @param {Object} chatFunctions - Optional chat functions (reserved for future use)
   * @returns {Promise<string>} The AI's response or error message
   */
  async askGoogleAI ( theQuestion, chatFunctions ) {
    if ( !this.activeBackend ) {
      return "Machine learning service is not initialized. Please check your configuration.";
    }

    try {
      // Load data once
      if ( this.services?.dataService ) {
        await this.services.dataService.loadData();
      }

      // Create system instructions
      const systemInstruction = await this.createSystemInstruction( true );

      // Get the active backend
      const backend = this.backends[ this.activeBackend ];

      // Query the backend (without conversation history)
      const result = await backend.queryLLM( theQuestion, {
        systemInstruction: systemInstruction
      } );

      if ( result.success ) {
        return result.response;
      }

      // If active backend fails, try fallback
      logger.warn( `🤖 [MachineLearningService] Active backend (${ this.activeBackend }) failed: ${ result.error }` );
      return await this.tryFallbackQuery( theQuestion, systemInstruction );
    } catch ( error ) {
      logger.error( `🤖 [MachineLearningService] Error in askGoogleAI: ${ error.message }` );
      return "I'm unable to process your request at the moment. Please try again later.";
    }
  }

  /**
   * Try query with fallback backend
   * @private
   * @param {string} question - Question to ask
   * @param {Array} systemInstruction - System instructions
   * @returns {Promise<string>} Response or error message
   */
  async tryFallbackQuery ( question, systemInstruction ) {
    const current = this.activeBackend;
    const fallbackOrder = this.config.fallbackOrder || [ "gemma", "mistral" ];

    for ( const backendName of fallbackOrder ) {
      if ( backendName === current ) {
        continue;
      }

      try {
        logger.warn( `🤖 [MachineLearningService] Attempting fallback to ${ backendName }` );

        const backend = this.backends[ backendName ];
        const initResult = await backend.initialize( this.config[ backendName ] );

        if ( !initResult.success ) {
          continue;
        }

        const result = await backend.queryLLM( question, {
          systemInstruction: systemInstruction
        } );

        if ( result.success ) {
          this.activeBackend = backendName;
          logger.info( `🤖 [MachineLearningService] Switched to fallback backend: ${ backendName }` );
          return result.response;
        }
      } catch ( error ) {
        logger.warn( `🤖 [MachineLearningService] Fallback to ${ backendName } failed: ${ error.message }` );
      }
    }

    return "I'm unable to process your request at the moment. Please try again later.";
  }
}

module.exports = MachineLearningService;