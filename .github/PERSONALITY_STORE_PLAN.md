# Plan: Personality Store Feature

Add a comprehensive personality management system that allows saving, loading, and switching between different complete bot configuration presets stored in the SQLite database.

## TL;DR

Create a `!personality` command with 7 subcommands (list, show, showall, save, update, delete, activate) that manages comprehensive bot personality presets using a normalized SQLite database design (17 tables). Personalities link directly to reusable content records (instructions, messages, configuration, ML questions, triggers, tokens) via junction tables. Automatic content deduplication: when saving personalities with identical content, the same database records are reused. This enables quick switching between different bot modes (e.g., "Admin Mode" with all features enabled, "Public Mode" with restrictions, "Event Mode" with custom triggers) while automatically saving storage through content reuse. Only bot identity (name/avatar/color) and conversation history are excluded.

## Steps

### Phase 1: Database Schema

1. **Add normalized personality tables to DatabaseService**
   - Modify [src/services/databaseService.js](src/services/databaseService.js)
   - Add `createPersonalityTables()` method in `createTables()`
   - **Normalized Schema Design:**

   ```sql
   -- Central personalities table (only ID, name, timestamps)
   CREATE TABLE IF NOT EXISTS personalities (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE COLLATE NOCASE,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   CREATE INDEX IF NOT EXISTS idx_personality_name ON personalities(name COLLATE NOCASE);

   -- Instructions: Types → Content → Junction to Personality
   CREATE TABLE IF NOT EXISTS instruction_types (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE COLLATE NOCASE  -- e.g., 'MLPersonality', 'MLInstructions'
   );
   
   CREATE TABLE IF NOT EXISTS instructions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     type_id INTEGER NOT NULL,
     content TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (type_id) REFERENCES instruction_types(id) ON DELETE CASCADE
   );
   
   CREATE TABLE IF NOT EXISTS personality_instructions (
     personality_id INTEGER NOT NULL,
     instruction_id INTEGER NOT NULL,
     PRIMARY KEY (personality_id, instruction_id),
     FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
     FOREIGN KEY (instruction_id) REFERENCES instructions(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_personality_instructions ON personality_instructions(personality_id);

   -- Editable Messages: Types → Content → Junction
   CREATE TABLE IF NOT EXISTS editable_message_types (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE COLLATE NOCASE  -- e.g., 'welcomeMessage', 'nowPlayingMessage'
   );
   
   CREATE TABLE IF NOT EXISTS editable_messages (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     type_id INTEGER NOT NULL,
     content TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (type_id) REFERENCES editable_message_types(id) ON DELETE CASCADE
   );
   
   CREATE TABLE IF NOT EXISTS personality_editable_messages (
     personality_id INTEGER NOT NULL,
     message_id INTEGER NOT NULL,
     PRIMARY KEY (personality_id, message_id),
     FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
     FOREIGN KEY (message_id) REFERENCES editable_messages(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_personality_editable_messages ON personality_editable_messages(personality_id);

   -- Configuration: Types → Content → Junction
   CREATE TABLE IF NOT EXISTS configuration_types (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE COLLATE NOCASE  -- JSON keys from configuration object
   );
   
   CREATE TABLE IF NOT EXISTS configurations (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     type_id INTEGER NOT NULL,
     content TEXT NOT NULL,  -- Serialized JSON value
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (type_id) REFERENCES configuration_types(id) ON DELETE CASCADE
   );
   
   CREATE TABLE IF NOT EXISTS personality_configurations (
     personality_id INTEGER NOT NULL,
     configuration_id INTEGER NOT NULL,
     PRIMARY KEY (personality_id, configuration_id),
     FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
     FOREIGN KEY (configuration_id) REFERENCES configurations(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_personality_configurations ON personality_configurations(personality_id);

   -- ML Questions: Types → Content → Junction
   CREATE TABLE IF NOT EXISTS ml_question_types (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE COLLATE NOCASE  -- popfactsQuestion, whatyearQuestion, meaningQuestion, bandQuestion, introQuestion
   );
   
   CREATE TABLE IF NOT EXISTS ml_questions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     type_id INTEGER NOT NULL,
     question_text TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (type_id) REFERENCES ml_question_types(id) ON DELETE CASCADE
   );
   
   CREATE TABLE IF NOT EXISTS personality_ml_questions (
     personality_id INTEGER NOT NULL,
     question_id INTEGER NOT NULL,
     PRIMARY KEY (personality_id, question_id),
     FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
     FOREIGN KEY (question_id) REFERENCES ml_questions(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_personality_ml_questions ON personality_ml_questions(personality_id);

   -- Disabled Commands: Content → Junction
   CREATE TABLE IF NOT EXISTS disabled_commands (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     command_name TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE TABLE IF NOT EXISTS personality_disabled_commands (
     personality_id INTEGER NOT NULL,
     command_id INTEGER NOT NULL,
     PRIMARY KEY (personality_id, command_id),
     FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
     FOREIGN KEY (command_id) REFERENCES disabled_commands(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_personality_disabled_commands ON personality_disabled_commands(personality_id);

   -- Disabled Features: Content → Junction
   CREATE TABLE IF NOT EXISTS disabled_features (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     feature_name TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE TABLE IF NOT EXISTS personality_disabled_features (
     personality_id INTEGER NOT NULL,
     feature_id INTEGER NOT NULL,
     PRIMARY KEY (personality_id, feature_id),
     FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
     FOREIGN KEY (feature_id) REFERENCES disabled_features(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_personality_disabled_features ON personality_disabled_features(personality_id);

   -- Triggers: Types → Content → Junction
   CREATE TABLE IF NOT EXISTS trigger_types (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE COLLATE NOCASE
   );
   
   CREATE TABLE IF NOT EXISTS triggers (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     type_id INTEGER NOT NULL,
     pattern TEXT NOT NULL,
     response TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (type_id) REFERENCES trigger_types(id) ON DELETE CASCADE
   );
   
   CREATE TABLE IF NOT EXISTS personality_triggers (
     personality_id INTEGER NOT NULL,
     trigger_id INTEGER NOT NULL,
     PRIMARY KEY (personality_id, trigger_id),
     FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
     FOREIGN KEY (trigger_id) REFERENCES triggers(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_personality_triggers ON personality_triggers(personality_id);

   -- Custom Tokens: Content → Junction
   CREATE TABLE IF NOT EXISTS custom_tokens (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     token_key TEXT NOT NULL,
     token_value TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE TABLE IF NOT EXISTS personality_custom_tokens (
     personality_id INTEGER NOT NULL,
     token_id INTEGER NOT NULL,
     PRIMARY KEY (personality_id, token_id),
     FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
     FOREIGN KEY (token_id) REFERENCES custom_tokens(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_personality_custom_tokens ON personality_custom_tokens(personality_id);
   ```

   **Key Features:**
   - Central `personalities` table with only id, name (case-insensitive unique), timestamps
   - Type tables for categorized content (instructions, editable_messages, configurations, triggers)
   - Content tables storing actual data with foreign keys to type tables
   - Junction tables (personality_*) creating direct many-to-many relationships between personalities and content
   - No intermediate "set" tables - personalities link directly to content
   - ML personality and instructions stored as instruction types (not direct fields)
   - ON DELETE CASCADE ensures automatic cleanup when personalities or content are deleted
   - Indexes on junction tables for efficient personality-based queries

2. **Add CRUD methods to DatabaseService**
   - **Save Personality**: Multi-step transaction to save normalized data
     - `savePersonality({ name, mlPersonality, mlInstructions, editableMessages, configuration, mlQuestions, disabledCommands, disabledFeatures, triggers, customTokens })`
     - Creates personality record (just name and timestamps)
     - For each component type:
       - Creates instruction content for MLPersonality and MLInstructions
       - Creates content records (or reuses existing matching content for sharing)
       - Links personality to content via junction tables (personality_instructions, personality_editable_messages, etc.)
     - Returns personality ID
   
   - **Update Personality**: Smart update that modifies exclusive content in-place or creates new content if shared
     - `updatePersonality({ name, mlPersonality, mlInstructions, editableMessages, configuration, mlQuestions, disabledCommands, disabledFeatures, triggers, customTokens })`
     - For each content item:
       1. Get current content ID linked to this personality
       2. Check reference count: How many personalities link to this content?
       3. **If reference count = 1** (exclusive): Update content in-place
       4. **If reference count > 1** (shared): Use findOrCreate pattern (reuse matching content or create new)
       5. Update junction table to link personality to updated/new content
     - Updates personality timestamp (updated_at)
     - **No orphans created**: Exclusive content updated, shared content preserved for other personalities
     - Example flow for ml_questions:
       ```javascript
       // Get existing content ID for this personality
       const existingId = getContentIdForPersonality(personalityId, 'ml_questions', typeId);
       
       // Check how many personalities use this content
       const refCount = getContentReferenceCount('ml_questions', existingId);
       
       if (refCount === 1) {
         // Only this personality uses it - update in place
         updateMlQuestion(existingId, newQuestionText);
         // Junction entry stays the same (no relink needed)
       } else {
         // Shared by multiple personalities - don't modify existing
         const newId = findOrCreateMlQuestion(typeId, newQuestionText);
         updateJunctionEntry(personalityId, 'ml_questions', existingId, newId);
       }
       ```
   
   - **Get Personality By Name**: Retrieve complete personality with all components
     - `getPersonalityByName(name)`
     - Multiple queries to reconstruct full personality:
       ```sql
       -- Get personality
       SELECT * FROM personalities WHERE name = ? COLLATE NOCASE;
       
       -- Get instructions (including MLPersonality and MLInstructions)
       SELECT it.name as type, i.content
       FROM personality_instructions pi
       JOIN instructions i ON pi.instruction_id = i.id
       JOIN instruction_types it ON i.type_id = it.id
       WHERE pi.personality_id = ?;
       
       -- Get editable messages
       SELECT emt.name as type, em.content
       FROM personality_editable_messages pem
       JOIN editable_messages em ON pem.message_id = em.id
       JOIN editable_message_types emt ON em.type_id = emt.id
       WHERE pem.personality_id = ?;
       
       -- Repeat for other component types...
       ```
     - Reconstructs structured objects from query results
     - Returns personality object with all components parsed
   
   - **Get All Personalities**: List all personalities (lightweight)
     - `getAllPersonalities()`
     - Returns: id, name, created_at, updated_at only (no component data for listing)
   
   - **Delete Personality**: Remove personality and automatically cleanup orphaned content
     - `deletePersonality(name)`
     - Deletes personality record
     - Junction table entries automatically deleted via CASCADE
     - After deletion, checks each content table for orphaned records (content with zero personality links)
     - Deletes orphaned content automatically to maintain database cleanliness
     - Returns count of orphaned content items removed
   
   - **Helper Methods for Content Management**:
     - `findOrCreateInstruction(typeId, content)` - Find existing matching instruction or create new
     - `findOrCreateEditableMessage(typeId, content)` - Find/create message
     - `findOrCreateConfiguration(typeId, content)` - Find/create configuration
     - `findOrCreateMlQuestion(typeId, questionText)` - Find/create ML question
     - `findOrCreateDisabledCommand(commandName)` - Find/create disabled command
     - `findOrCreateDisabledFeature(featureName)` - Find/create disabled feature
     - `findOrCreateTrigger(typeId, pattern, response)` - Find/create trigger
     - `findOrCreateCustomToken(key, value)` - Find/create custom token
     - `updateInstruction(instructionId, newContent)` - Update instruction content in-place
     - `updateEditableMessage(messageId, newContent)` - Update message in-place
     - `updateConfiguration(configId, newContent)` - Update configuration in-place
     - `updateMlQuestion(questionId, newQuestionText)` - Update ML question in-place
     - `updateTrigger(triggerId, newPattern, newResponse)` - Update trigger in-place
     - `updateCustomToken(tokenId, newValue)` - Update custom token in-place
     - `getContentReferenceCount(tableName, contentId)` - Count how many personalities link to this content
     - `getContentIdForPersonality(personalityId, componentType, typeId)` - Get specific content ID for personality
     - `updateJunctionEntry(personalityId, componentType, oldContentId, newContentId)` - Relink personality to different content
     - `linkPersonalityToContent(personalityId, componentType, contentId)` - Create junction entry
     - `getPersonalityContent(personalityId, componentType)` - Retrieve all content for a component type
     - `cleanupOrphanedContent()` - Remove content not linked to any personality (used after delete)
   
   - Each method must check `if (!this.initialized)` and throw error
   - Use transactions for multi-table operations to ensure data consistency
   - Log operations using `this.logger.info()` and `this.logger.error()`
   - Use prepared statements for all queries

### Phase 2: Command Implementation (*depends on Phase 1*)

3. **Create handlePersonalityCommand.js**
   - Location: `src/commands/Edit Commands/handlePersonalityCommand.js`
   - Main handler function routes to subcommand helpers
   - Metadata:
     ```javascript
     handlePersonalityCommand.requiredRole = 'OWNER';
     handlePersonalityCommand.description = 'Manage bot personality presets';
     handlePersonalityCommand.example = 'list | save "Name" | activate "Name" | delete "Name"';
     handlePersonalityCommand.hidden = false;
     ```

4. **Implement subcommand: list**
   - Handler: `handleListPersonalities(services, context)`
   - Query database via `services.databaseService.getAllPersonalities()`
   - Format output: `📋 Saved Personalities:\n• Name 1 (created: DD/MM/YYYY)\n• Name 2 (created: DD/MM/YYYY)`
   - Show currently active personality at top: `🔵 Active: Current Name\n\n📋 All Personalities:`
   - If empty: `No saved personalities. Use !personality save "Name" to create one.`
   - Return success response via `sendSuccessResponse()`

5. **Implement subcommand: show <name>**
   - Handler: `handleShowPersonality(personalityName, services, context)`
   - Parse personality name from args (support quoted names with spaces)
   - Query database via `services.databaseService.getPersonalityByName(name)` (case-insensitive)
   - Format output: Show only `instructions.MLPersonality` field (truncate if >500 chars, show "...see full with showall")
   - Display using original stored case from database
   - If not found: Suggest similar names using Levenshtein distance (case-insensitive comparison)
   - Return success/error response

6. **Implement subcommand: showall <name>**
   - Handler: `handleShowAllPersonality(personalityName, services, context)`
   - Query database for full personality record (case-insensitive)
   - Format output: Show all personality data in organized sections:
     - ML Personality and Instructions
     - Editable Messages (formatted as YAML-like structure)
     - Configuration settings
     - ML Questions
     - Disabled Commands/Features
     - Triggers and Custom Tokens
   - Include metadata: created_at, updated_at
   - Split into multiple messages to avoid tt.fm limits (suggest sections: 1) ML/Messages, 2) Config/Features, 3) Triggers/Tokens)
   - Return success/error response

7. **Implement subcommand: save <name>**
   - Handler: `handleSavePersonality(personalityName, services, context)`
   - Validate name is provided and not reserved word "current" (case-insensitive check)
   - Validate name doesn't already exist (database handles via UNIQUE COLLATE NOCASE)
   - Load current botConfig via `services.dataService`
   - Extract all component data from botConfig
   - **Transaction flow**:
     ```javascript
     const transaction = db.transaction(() => {
       // Create personality record
       const result = db.prepare(`
         INSERT INTO personalities (name) VALUES (?)
       `).run(name);
       const personalityId = result.lastInsertRowid;
       
       // Create/link instructions (MLPersonality and MLInstructions)
       const mlPersonalityTypeId = getOrCreateInstructionType('MLPersonality');
       const mlInstructionsTypeId = getOrCreateInstructionType('MLInstructions');
       const personalityContentId = findOrCreateInstruction(mlPersonalityTypeId, mlPersonality);
       const instructionsContentId = findOrCreateInstruction(mlInstructionsTypeId, mlInstructions);
       linkPersonalityToContent(personalityId, 'instructions', personalityContentId);
       linkPersonalityToContent(personalityId, 'instructions', instructionsContentId);
       
       // Create/link editable messages
       Object.keys(editableMessages).forEach(key => {
         const typeId = getOrCreateEditableMessageType(key);
         const contentId = findOrCreateEditableMessage(typeId, editableMessages[key]);
         linkPersonalityToContent(personalityId, 'editable_messages', contentId);
       });
       
       // ... repeat for other component types
     });
     transaction();
     ```
   - Response: `✅ Personality "${name}" saved successfully` (echo user's case)
   - If name is "current" (any case): `❌ Name "current" is reserved. Please choose a different name.`
   - If name exists: `❌ Personality "${existingName}" already exists. Use 'update' to modify it.` (show DB case)

8. **Implement subcommand: update <name>**
   - Handler: `handleUpdatePersonality(personalityName, services, context)`
   - **Special case**: If name is "current" (case-insensitive), update the currently active personality
     - Read `botConfig.activePersonality` to get active personality name
     - If no active personality set: `❌ No active personality. Use 'save' to create one first, then 'activate' it.`
     - Update that personality in database
   - For named personalities: Validate name exists in database (case-insensitive)
   - Extract current botConfig sections (same as save)
   - Update database via `services.databaseService.updatePersonality()`
   - Response: `✅ Personality "${name}" updated successfully` (show DB case)
   - If not found: `❌ Personality "${name}" not found. Use 'save' to create it.`

9. **Implement subcommand: activate <name>**
   - Handler: `handleActivatePersonality(personalityName, services, context)`
   - Validate name is not "current" (reserved, case-insensitive)
   - Validate name exists in database (case-insensitive query)
   - **Retrieve personality with all components** via `services.databaseService.getPersonalityByName(name)`
     - DatabaseService performs multiple queries to retrieve all content via junction tables
     - Returns structured object:
       ```javascript
       {
         id: 1,
         name: 'Chill DJ',
         instructions: {
           MLPersonality: '...',
           MLInstructions: '...'
         },
         editableMessages: { welcomeMessage: '...', nowPlayingMessage: '...', ... },
         configuration: { ... },
         mlQuestions: { popfactsQuestion: '...', whatyearQuestion: '...', ... },
         // ... other components
       }
       ```
   - **Update botConfig** via `services.dataService.setValue()`:
     - `setValue('Instructions.MLPersonality', personality.instructions.MLPersonality)`
     - `setValue('Instructions.MLInstructions', personality.instructions.MLInstructions)`
     - For each message type: `setValue('editableMessages.<key>', value)`
     - `setValue('configuration', personality.configuration)`
     - `setValue('mlQuestions', personality.mlQuestions)`
     - `setValue('disabledCommands', personality.disabledCommands)`
     - `setValue('disabledFeatures', personality.disabledFeatures)`
     - `setValue('triggers', personality.triggers)`
     - `setValue('customTokens', personality.customTokens)`
     - `setValue('activePersonality', personality.name)` - Track which personality is active (use DB case)
   - Response: `✅ Activated personality "${personality.name}"` (use DB case)
   - Log activation: `logger.info(\`Personality "\${personality.name}" activated by \${context.sender}\`)`

10. **Implement subcommand: delete <name>**
    - Handler: `handleDeletePersonality(personalityName, services, context)`
    - Validate name is not "current" (reserved, case-insensitive)
    - Validate name exists in database (case-insensitive)
    - Retrieve personality to get proper case for response
    - Delete via `services.databaseService.deletePersonality(name)`
    - If deleted personality is currently active, clear `botConfig.activePersonality`
    - Response: `✅ Personality "${personality.name}" deleted` (use DB case)
    - If not found: Suggest similar names (case-insensitive Levenshtein)

11. **Add helper functions**
    - `parsePersonalityName(args)` - Extract name from args, handle quoted strings (preserve case as entered)
    - `isReservedName(name)` - Check if name is "current" (case-insensitive)
    - `sendResponse(message, services, context)` - Error response helper
    - `sendSuccessResponse(message, services, context)` - Success response helper
    - `formatPersonalityList(personalities)` - Format list output (uses DB stored case)
    - `suggestSimilarNames(invalidName, allNames)` - Levenshtein distance for typos (case-insensitive comparison)

### Phase 3: Testing (*depends on Phase 2*)

12. **Create comprehensive test suite**
    - File: `tests/commands/handlePersonalityCommand.test.js`
    - Mock dependencies:
      ```javascript
      jest.mock('../../src/services/databaseService.js');
      jest.mock('../../src/services/dataService.js');
      jest.mock('../../src/services/messageService.js');
      jest.mock('../../src/lib/logging.js');
      ```
    - Test cases:
      - ✅ Metadata properties exist and are correct
      - ✅ List personalities (empty and populated, shows active)
      - ✅ Show personality (exists and not found)
      - ✅ Showall personality
      - ✅ Save new personality (success and duplicate name)
      - ✅ Save with reserved name "current" (blocked)
      - ✅ Case-insensitive duplicate detection ("My DJ" vs "my dj")
      - ✅ Update existing personality (success and not found)
      - ✅ Update "current" personality (special case)
      - ✅ Activate personality (success, not found, botConfig updates, activePersonality set)
      - ✅ Activate with "current" (blocked)
      - ✅ Delete personality (success and not found, clears activePersonality if active)
      - ✅ Delete with "current" (blocked)
      - ✅ Parse quoted personality names
      - ✅ Case-insensitive name matching for all commands
      - ✅ Error handling for database failures
      - ✅ Error handling for missing arguments
      - ✅ Verify response channel routing (public vs PM)

13. **Create integration test**
    - File: `tests/integration/personalityStore.integration.test.js`
    - Test full workflow:
      1. Save personality from current botConfig
      2. Verify case-insensitive duplicate rejection
      3. Modify botConfig manually
      4. List personalities (verify shows active)
      5. Activate saved personality (verify activePersonality set)
      6. Update "current" special case
      7. Delete personality (verify activePersonality cleared)
    - Use actual DatabaseService (not mocked) with test database
    - Clean up test database after run

### Phase 4: Documentation (*parallel with Phase 3*)

14. **Update CHANGELOG.md**
    - Add to `## [Unreleased]` section under `### Added`
    - Entry: `- **Personality Store**: New \`!personality\` command to save, manage, and switch between bot personality presets stored in a normalized SQLite database. Smart content management: updates exclusive content in-place, preserves shared content to prevent unintended changes to other personalities. Automatic content deduplication via findOrCreate pattern. Includes case-insensitive personality names, reserved "current" keyword for updating active personality, and automatic tracking of active personality. Subcommands: list, show, showall, save, update, delete, activate.`

15. **Update README.md**
    - Add to features list (if user-facing features are listed)
    - Brief description: "Save and switch between personality presets with database storage"

16. **Create detailed documentation**
    - File: `docs/PERSONALITY_STORE.md`
    - Include:
      - Feature overview and use cases
      - Command syntax and examples for each subcommand
      - Special "current" keyword usage
      - Case-insensitive name handling
      - Best practices (naming conventions)
      - Database schema reference
      - Troubleshooting common issues

## Relevant Files

### To Create
- `src/commands/Edit Commands/handlePersonalityCommand.js` — Main command handler with subcommand routing, all helper functions (handleListPersonalities, handleShowPersonality, handleShowAllPersonality, handleSavePersonality, handleUpdatePersonality, handleDeletePersonality, handleActivatePersonality), and utility functions (parsePersonalityName, isReservedName, sendResponse, sendSuccessResponse, formatPersonalityList, suggestSimilarNames)
- `tests/commands/handlePersonalityCommand.test.js` — Unit tests for all subcommands, case-insensitive handling, and edge cases
- `tests/integration/personalityStore.integration.test.js` — Integration test for full workflow including activePersonality tracking
- `docs/PERSONALITY_STORE.md` — User documentation with examples and troubleshooting

### To Modify
- `src/services/databaseService.js` — Add `createPersonalityTables()` in the `createTables()` method with normalized schema (17 tables total: 1 personalities + 5 type tables + 8 content tables + 8 junction tables), and add comprehensive CRUD methods: `savePersonality` (multi-step transaction creating personality and linking to content), `updatePersonality` (smart update with reference counting to update exclusive content in-place or create new when shared), `getPersonalityByName` (multiple queries via junction tables), `getAllPersonalities`, `deletePersonality` (with automatic orphan cleanup), plus helper methods for content management (`findOrCreate*` for all content types, `update*` for all content types, `getContentReferenceCount`, `getContentIdForPersonality`, `updateJunctionEntry`, `linkPersonalityToContent`, `getPersonalityContent`, `cleanupOrphanedContent`)
- `docs/CHANGELOG.md` — Add entry to unreleased section describing the normalized component-based personality system
- `README.md` — Add Personality Store to features list (if applicable)

### To Reference (patterns and conventions)
- `src/commands/Edit Commands/handleChatCommandCommand.js` — Subcommand routing pattern, parseQuotedIdentifier function for name parsing, list formatting with bullet points
- `src/commands/Edit Commands/handleEditCommand.js` — botConfig update pattern via dataService.setValue(), dot notation for nested properties
- `src/commands/Edit Commands/handleEditWelcomeCommand.js` — resolveUuid and getNickname functions, Levenshtein distance calculation for name suggestions
- `src/services/databaseService.js` — Existing table schemas (song_plays, conversations, image_validation), CRUD patterns with prepared statements, error handling with this.logger

## Verification

### Automated Tests
1. **Run unit tests**: `npm test -- handlePersonalityCommand.test.js`
   - All 20+ test cases should pass
   - Coverage should be >90% for the command file

2. **Run integration test**: `npm test -- personalityStore.integration.test.js`
   - Full workflow should complete without errors
   - Database should be properly cleaned up

### Manual Verification
1. **Save personality**
   - Command: `!personality save "Test DJ"`
   - Verify: Success message with name "Test DJ"

2. **Test case-insensitive handling**
   - Command: `!personality save "test dj"`
   - Verify: Error - personality already exists
   - Command: `!personality activate "TEST DJ"`
   - Verify: Activates "Test DJ" (original case from first save)
   - Command: `!personality show "TeSt Dj"`
   - Verify: Displays "Test DJ" data

3. **Test reserved name**
   - Command: `!personality save "current"`
   - Verify: Error - name is reserved
   - Command: `!personality save "CURRENT"`
   - Verify: Error - name is reserved (case-insensitive)

4. **List personalities**
   - Command: `!personality list`
   - Verify: Shows active personality at top, then "Test DJ" in list

5. **Show personality**
   - Command: `!personality show "test dj"`
   - Verify: Displays MLPersonality text with name "Test DJ"

6. **Modify botConfig manually**
   - Edit `data/botConfig.json` Instructions.MLPersonality
   - Verify change persists in file

7. **Update current personality**
   - Command: `!personality update current`
   - Verify: "Test DJ" updated in database with modified values

8. **Activate saved personality**
   - Modify botConfig again (different changes)
   - Command: `!personality activate "Test DJ"`
   - Verify: botConfig.json Instructions restored to saved state
   - Verify: mlConversationHistory preserved (not cleared)
   - Verify: botConfig.activePersonality set to "Test DJ"

9. **Delete personality**
   - Command: `!personality delete "test dj"`
   - Verify: "Test DJ" removed from database
   - Verify: botConfig.activePersonality cleared

### Database Verification
```bash
# Connect to database
sqlite3 data/mrroboto.db

# Check normalized schema exists
.schema personalities
.schema instruction_types
.schema instructions
.schema personality_instructions
.schema editable_message_types
.schema editable_messages
.schema personality_editable_messages
# ... check other tables

# Test case-insensitive uniqueness
INSERT INTO personalities (name) VALUES ('Test');
INSERT INTO personalities (name) VALUES ('TEST');
-- Should fail with UNIQUE constraint error

# Verify normalized data structure and content sharing
-- Check personalities
SELECT * FROM personalities;

-- Check instructions linked to a personality
SELECT p.name, it.name as type, i.content
FROM personalities p
JOIN personality_instructions pi ON p.id = pi.personality_id
JOIN instructions i ON pi.instruction_id = i.id
JOIN instruction_types it ON i.type_id = it.id
WHERE p.name = 'Test' COLLATE NOCASE;

-- Check if content is shared between personalities
SELECT i.id, i.content, COUNT(pi.personality_id) as personality_count
FROM instructions i
LEFT JOIN personality_instructions pi ON i.id = pi.instruction_id
GROUP BY i.id
HAVING personality_count > 1;
-- Shows instructions shared by multiple personalities

# Check foreign key constraints
PRAGMA foreign_keys = ON;
PRAGMA foreign_key_list(personalities);
PRAGMA foreign_key_list(personality_instructions);

# Verify CASCADE behavior
DELETE FROM personalities WHERE id = 1;
-- Should cascade delete personality_instructions entries
-- Content (instructions) should remain if used by other personalities

# Check orphaned content
SELECT i.id, i.content
FROM instructions i
LEFT JOIN personality_instructions pi ON i.id = pi.instruction_id
WHERE pi.instruction_id IS NULL;
-- Shows content not linked to any personality
```

## Decisions

### Data Scope
- **Included**: 
  - Instructions: MLPersonality, MLInstructions (stored as instruction content with types)
  - editableMessages: All message types (stored as typed message content)
  - configuration: All bot configuration settings (stored as typed configuration content)
  - mlQuestions: ML prompt questions (stored as typed question content: popfactsQuestion, whatyearQuestion, meaningQuestion, bandQuestion, introQuestion)
  - disabledCommands: Command disable list (stored as command content)
  - disabledFeatures: Feature disable list (stored as feature content)
  - triggers: Custom chat triggers (stored as typed trigger content)
  - customTokens: Token substitution definitions (stored as token content)
- **Excluded**: 
  - botData: CHAT_NAME, CHAT_AVATAR_ID, CHAT_COLOUR (bot identity remains constant)
  - mlConversationHistory: Preserved across personality changes (contains valuable song/conversation context)
- **Rationale**: Personalities encompass complete bot behavior. The normalized design stores all components as reusable content: personalities link to content via junction tables, enabling multiple personalities to share the same instruction content, message content, configuration, etc. When content is updated, all personalities linking to it automatically reflect the change. Only bot identity (name/avatar/color) and conversation context are excluded.

### Storage Strategy
- **Choice**: Normalized SQLite database with set-based component architecture
- **Alternative considered**: 
  - Denormalized single table with JSON columns (simpler but no sharing)
  - JSON file in `data/personalities.json` (no querying, no relationships)
- **Rationale**: 
  - Normalized design enables true component sharing between personalities
  - Set-based architecture allows mix-and-match of reusable components
  - Foreign key constraints ensure referential integrity
  - Consistent with existing DatabaseService patterns (song plays, conversations)
  - Scales well for 10+ personalities with shared components
  - Automatic propagation of component updates across personalities
  - **Database serves as the backup** - no additional export/import needed
  - More complex than denormalized, but benefits outweigh complexity for component reuse

### Activation Behavior
- **No external updates**: Activating a personality only updates internal botConfig, does not change bot name/color on tt.fm
- **Preserve conversation context**: mlConversationHistory is preserved across personality changes to maintain song/conversation context
- **Track active personality**: New `botConfig.activePersonality` field stores currently active personality name for "update current" feature
- **Rationale**: Keeps bot identity stable while allowing behavior changes. Conversation history provides valuable context about previously played songs and ongoing conversations.

### Permissions
- **OWNER only**: Only bot owner can manage personalities
- **Rationale**: Personalities define core bot behavior and should be tightly controlled. Moderators have sufficient power with other commands.

### Name Handling
- **Support spaces**: Personality names can contain spaces via quoted strings: `!personality save "Chill DJ"`
- **Case insensitive**: "Chill DJ" = "chill dj" = "CHILL DJ" (treated as same personality)
- **Display case**: Original case from first save is preserved and displayed
  - First save as "Chill DJ" → always shown as "Chill DJ"
  - User types "chill dj" → matches and displays "Chill DJ"
- **Uniqueness**: Enforced at database level with `UNIQUE COLLATE NOCASE` constraint
- **Reserved names**: "current" is reserved (case-insensitive, so "Current", "CURRENT" also blocked)
- **Implementation**: SQLite `COLLATE NOCASE` on name column for case-insensitive uniqueness and queries

### Updated botConfig Structure
```json
{
  "botData": { "CHAT_NAME": "...", "CHAT_AVATAR_ID": "...", "CHAT_COLOUR": "..." },
  "Instructions": { "MLPersonality": "...", "MLInstructions": "..." },
  "editableMessages": { "welcomeMessage": "...", "nowPlayingMessage": "...", ... },
  "configuration": { ... },
  "mlQuestions": { "popfactsQuestion": "...", "whatyearQuestion": "...", ... },
  "disabledCommands": [ ... ],
  "disabledFeatures": [ ... ],
  "triggers": { "newSong": [...], ... },
  "customTokens": { "{location}": {...}, ... },
  "activePersonality": "Chill DJ",  // NEW: tracks which personality is currently active
  "mlConversationHistory": [ ... ]  // Preserved across personality changes
}
```

**Note**: Bot identity (botData) is never saved/restored by personalities. All other sections are included in personality presets.

## Further Considerations

### Implementation Notes Based on Requirements

**1. Database as Backup**
- The SQLite database serves as the persistent backup for all saved personalities
- The botConfig.json file contains the current active state
- No export/import functionality needed - users can manage database backups using standard SQLite backup tools if needed

**2. Preview Functionality**
- The `showall` subcommand serves as the preview mechanism
- Users can review all personality data before activation: `!personality showall "Name"`
- No separate preview command needed

**3. Current Personality Updates**
- Special case: `!personality update current` updates the currently active personality
- Requires tracking active personality in botConfig: `botConfig.activePersonality`
- "current" is a **reserved keyword** (case-insensitive) and cannot be used as a personality name
- Validation must reject save/activate/delete attempts with name "current"

**4. Personality Cloning**
- No inheritance system needed
- Users can clone personalities manually: activate desired personality → save with new name
- Example workflow:
  ```
  !personality activate "Chill DJ"
  // Make manual tweaks to botConfig
  !personality save "Chill DJ Evening"
  ```

### Reserved Names
- **"current"** - Reserved for updating the active personality (case-insensitive)
- Consider also reserving common keywords to avoid confusion: "default", "system", "admin" (optional for v2)

### Sharing Common Elements

The normalized database design enables content sharing between personalities through automatic deduplication, with smart update behavior that prevents unintended changes:

**Design Approach:**
- **Central personalities table** with only id, name (case-insensitive unique), timestamps
- **Type tables** for categorizing content (instruction_types, editable_message_types, configuration_types, ml_question_types, trigger_types)
- **Content tables** storing actual data (instructions, editable_messages, configurations, ml_questions, triggers, etc.)
- **Junction tables** (personality_instructions, personality_editable_messages, etc.) creating direct many-to-many relationships
- **No intermediate "set" tables** - personalities link directly to content
- **Content deduplication**: `findOrCreate` pattern reuses existing matching content
- **Smart updates**: Exclusive content updated in-place, shared content preserved

**Sharing Benefits:**

1. **Automatic Content Reuse at Save Time**
   ```
   Personality "Admin Mode" saves with:
     - Instructions: MLPersonality="Friendly admin assistant..."
     - Messages: welcomeMessage="Welcome! 👋"
     - Configuration: { featureX: true, featureY: true }
   
   Personality "Public Mode" saves with:
     - Instructions: MLPersonality="Professional public bot..." (unique)
     - Messages: welcomeMessage="Welcome! 👋" (REUSED - same content)
     - Configuration: { featureX: true, featureY: true } (REUSED - same content)
   ```
   - If two personalities have identical content, only one copy is stored
   - Both personalities link to the same content record via junction tables
   - No explicit "sharing" action needed - automatic based on content matching

2. **Smart Update Behavior - No Unintended Propagation**
   ```
   Scenario: Admin Mode and Public Mode both use welcomeMessage="Welcome! 👋"
   
   # Update Admin Mode's welcome message
   !personality activate "Admin Mode"
   # Edit welcomeMessage to "Hey there! 🎉"
   !personality update current
   
   Result:
   - System checks: "Is this welcomeMessage used by other personalities?"
   - Reference count = 2 (Admin Mode + Public Mode)
   - Decision: DON'T modify existing content (would affect Public Mode)
   - Action: Create new welcomeMessage="Hey there! 🎉"
   - Admin Mode now links to new message
   - Public Mode still links to old message "Welcome! 👋"
   - Both personalities remain independent
   ```
   
   ```
   Scenario: Admin Mode has exclusive customToken="{mytoken}"
   
   # Update Admin Mode's custom token
   !personality activate "Admin Mode"
   # Edit {mytoken} value
   !personality update current
   
   Result:
   - System checks: "Is this token used by other personalities?"
   - Reference count = 1 (only Admin Mode)
   - Decision: Safe to update in-place
   - Action: UPDATE custom_tokens SET token_value=... WHERE id=...
   - No new row created
   - No orphaned content
   ```
   - **Exclusive content (ref count = 1)**: Updated in-place, efficient
   - **Shared content (ref count > 1)**: Preserved, new content created for personality being updated
   - **Result**: Personalities remain independent after update, no surprising side effects

3. **Storage Efficiency**
   - Duplicate content automatically deduplicated at save time
   - Common configurations, messages, triggers stored once
   - In-place updates for exclusive content prevent orphans
   - Typical savings: 40-60% for personalities with overlapping content
   - Zero orphans from updates (only from deletes)

4. **Content Lifecycle Management**
   - Foreign key constraints with ON DELETE CASCADE ensure referential integrity
   - Deleting a personality removes its junction entries
   - Content remains if other personalities link to it
   - Automatic orphan cleanup after delete: removes content with zero personality links
   - In-place updates eliminate orphans during normal operations

**Implementation Trade-offs:**
- **Pros**: Automatic deduplication at save, no orphans from updates, personalities remain independent, prevents accidental changes to shared content, intuitive behavior ("my content" updates, "shared content" stays safe)
- **Cons**: Cannot intentionally propagate updates to all personalities sharing content, requires reference count query per content item during update, slightly more complex update logic
- **Best For**: Bot owners who want automatic space savings without surprising side effects when updating personalities