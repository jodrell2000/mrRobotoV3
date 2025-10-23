/**
 * Trigger Service - Manages and executes user-configurable command triggers
 * Allows OWNER users to configure commands to automatically execute when certain events occur
 */

const { logger } = require( '../lib/logging.js' );

class TriggerService {
    constructor ( services ) {
        this.services = services;
        this.logger = logger;
    }

    /**
     * Gets available trigger types and their descriptions
     * @returns {Object} Object mapping trigger names to descriptions
     */
    getAvailableTriggers() {
        return {
            'newSong': 'Fires when a new song starts playing',
            'userJoined': 'Fires when a user joins the hangout',
            'userLeft': 'Fires when a user leaves the hangout',
            'djAdded': 'Fires when a DJ is added to the booth',
            'djRemoved': 'Fires when a DJ is removed from the booth'
        };
    }

    /**
     * Gets all configured triggers from the data service
     * @returns {Object} Triggers configuration object
     */
    getAllTriggers() {
        try {
            return this.services.dataService.getValue( 'triggers' ) || {};
        } catch ( error ) {
            this.logger.error( `[TriggerService] Error getting triggers: ${ error.message }` );
            return {};
        }
    }

    /**
     * Gets commands configured for a specific trigger
     * @param {string} triggerName - The trigger name to get commands for
     * @returns {Array} Array of command names, or empty array if none configured
     */
    getTriggerCommands( triggerName ) {
        try {
            const triggers = this.getAllTriggers();
            const commands = triggers[ triggerName ];
            
            if ( !commands || !Array.isArray( commands ) ) {
                return [];
            }
            
            return commands;
        } catch ( error ) {
            this.logger.error( `[TriggerService] Error getting commands for trigger '${ triggerName }': ${ error.message }` );
            return [];
        }
    }

    /**
     * Adds a command to a trigger
     * @param {string} triggerName - The trigger name
     * @param {string} commandName - The command to add
     * @returns {Object} Result object with success status and message
     */
    async addTriggerCommand( triggerName, commandName ) {
        try {
            const availableTriggers = this.getAvailableTriggers();
            
            // Validate trigger name
            if ( !availableTriggers[ triggerName ] ) {
                return {
                    success: false,
                    error: `Invalid trigger name: ${ triggerName }`,
                    availableTriggers: Object.keys( availableTriggers )
                };
            }

            // Load current data
            await this.services.dataService.loadData();
            
            // Get current triggers or initialize empty object
            let triggers = this.getAllTriggers();
            
            // Initialize trigger array if it doesn't exist
            if ( !triggers[ triggerName ] ) {
                triggers[ triggerName ] = [];
            }
            
            // Check if command is already in the trigger
            if ( triggers[ triggerName ].includes( commandName ) ) {
                return {
                    success: false,
                    error: `Command "${ commandName }" is already configured for trigger "${ triggerName }"`
                };
            }
            
            // Add command to trigger
            triggers[ triggerName ].push( commandName );
            
            // Save updated triggers
            await this.services.dataService.setValue( 'triggers', triggers );
            
            this.logger.info( `[TriggerService] Added command "${ commandName }" to trigger "${ triggerName }"` );
            
            return {
                success: true,
                message: `Added command "${ commandName }" to trigger "${ triggerName }"`,
                currentCommands: triggers[ triggerName ]
            };
        } catch ( error ) {
            this.logger.error( `[TriggerService] Error adding command to trigger: ${ error.message }` );
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Removes a command from a trigger
     * @param {string} triggerName - The trigger name
     * @param {string} commandName - The command to remove
     * @returns {Object} Result object with success status and message
     */
    async removeTriggerCommand( triggerName, commandName ) {
        try {
            const availableTriggers = this.getAvailableTriggers();
            
            // Validate trigger name
            if ( !availableTriggers[ triggerName ] ) {
                return {
                    success: false,
                    error: `Invalid trigger name: ${ triggerName }`,
                    availableTriggers: Object.keys( availableTriggers )
                };
            }

            // Load current data
            await this.services.dataService.loadData();
            
            // Get current triggers
            let triggers = this.getAllTriggers();
            
            // Check if trigger exists and has commands
            if ( !triggers[ triggerName ] || !Array.isArray( triggers[ triggerName ] ) ) {
                return {
                    success: false,
                    error: `No commands configured for trigger "${ triggerName }"`
                };
            }
            
            // Check if command exists in trigger
            const commandIndex = triggers[ triggerName ].indexOf( commandName );
            if ( commandIndex === -1 ) {
                return {
                    success: false,
                    error: `Command "${ commandName }" is not configured for trigger "${ triggerName }"`,
                    currentCommands: triggers[ triggerName ]
                };
            }
            
            // Remove command from trigger
            triggers[ triggerName ].splice( commandIndex, 1 );
            
            // If trigger is now empty, remove it entirely
            if ( triggers[ triggerName ].length === 0 ) {
                delete triggers[ triggerName ];
            }
            
            // Save updated triggers
            await this.services.dataService.setValue( 'triggers', triggers );
            
            this.logger.info( `[TriggerService] Removed command "${ commandName }" from trigger "${ triggerName }"` );
            
            return {
                success: true,
                message: `Removed command "${ commandName }" from trigger "${ triggerName }"`,
                currentCommands: triggers[ triggerName ] || []
            };
        } catch ( error ) {
            this.logger.error( `[TriggerService] Error removing command from trigger: ${ error.message }` );
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clears all commands from a trigger
     * @param {string} triggerName - The trigger name to clear
     * @returns {Object} Result object with success status and message
     */
    async clearTrigger( triggerName ) {
        try {
            const availableTriggers = this.getAvailableTriggers();
            
            // Validate trigger name
            if ( !availableTriggers[ triggerName ] ) {
                return {
                    success: false,
                    error: `Invalid trigger name: ${ triggerName }`,
                    availableTriggers: Object.keys( availableTriggers )
                };
            }

            // Load current data
            await this.services.dataService.loadData();
            
            // Get current triggers
            let triggers = this.getAllTriggers();
            
            // Check if trigger exists
            if ( !triggers[ triggerName ] ) {
                return {
                    success: false,
                    error: `No commands configured for trigger "${ triggerName }"`
                };
            }
            
            const clearedCommands = triggers[ triggerName ].slice(); // Copy array
            
            // Remove trigger entirely
            delete triggers[ triggerName ];
            
            // Save updated triggers
            await this.services.dataService.setValue( 'triggers', triggers );
            
            this.logger.info( `[TriggerService] Cleared all commands from trigger "${ triggerName }"` );
            
            return {
                success: true,
                message: `Cleared all commands from trigger "${ triggerName }"`,
                clearedCommands: clearedCommands
            };
        } catch ( error ) {
            this.logger.error( `[TriggerService] Error clearing trigger: ${ error.message }` );
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Executes all commands configured for a specific trigger
     * @param {string} triggerName - The trigger name to execute
     * @param {Object} context - Context object with information about the triggering event
     * @param {Object} context.eventData - Data specific to the triggering event
     * @param {Object} context.sender - Optional sender information (defaults to system)
     * @returns {Promise<Object>} Result object with execution details
     */
    async executeTrigger( triggerName, context = {} ) {
        try {
            this.logger.debug( `[TriggerService] Executing trigger: ${ triggerName }` );
            
            // Get commands for this trigger
            const commands = this.getTriggerCommands( triggerName );
            
            if ( commands.length === 0 ) {
                this.logger.debug( `[TriggerService] No commands configured for trigger: ${ triggerName }` );
                return {
                    success: true,
                    executed: 0,
                    results: []
                };
            }

            this.logger.info( `[TriggerService] Executing ${ commands.length } command(s) for trigger '${ triggerName }': ${ commands.join( ', ' ) }` );

            // Create a system context for executing commands if none provided
            const botContext = {
                sender: context.sender || {
                    username: 'System',
                    uuid: this.services.config.BOT_UID || 'bot-system'
                },
                fullMessage: context.fullMessage || {
                    isPrivateMessage: false
                },
                chatMessage: context.chatMessage || null
            };

            const results = [];

            // Execute each command in the trigger
            for ( const commandName of commands ) {
                try {
                    this.logger.debug( `[TriggerService] Executing triggered command: ${ commandName }` );
                    
                    // Execute the command using the command service
                    // Use empty args since triggers don't have arguments by default
                    const result = await this.services.commandService( 
                        commandName, 
                        '', 
                        this.services, 
                        botContext 
                    );

                    results.push({
                        command: commandName,
                        success: result.success,
                        error: result.error || null
                    });

                    if ( result.success ) {
                        this.logger.info( `[TriggerService] Successfully executed triggered command: ${ commandName }` );
                    } else {
                        this.logger.warn( `[TriggerService] Triggered command '${ commandName }' failed: ${ result.error || 'Unknown error' }` );
                    }
                } catch ( commandError ) {
                    this.logger.error( `[TriggerService] Error executing triggered command '${ commandName }': ${ commandError.message }` );
                    results.push({
                        command: commandName,
                        success: false,
                        error: commandError.message
                    });
                }
            }

            const successCount = results.filter( r => r.success ).length;
            const totalCount = results.length;

            return {
                success: true,
                executed: totalCount,
                successful: successCount,
                failed: totalCount - successCount,
                results: results
            };

        } catch ( error ) {
            this.logger.error( `[TriggerService] Error executing trigger '${ triggerName }': ${ error.message }` );
            return {
                success: false,
                error: error.message,
                executed: 0,
                results: []
            };
        }
    }
}

module.exports = TriggerService;