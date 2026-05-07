const Database = require( 'better-sqlite3' );
const path = require( 'path' );

/**
 * DatabaseService - Handles SQLite database operations for historical data
 * Separate from DataService which handles JSON configuration data
 */
class DatabaseService {
    /**
     * Insert DJ if not exists, or update nickname if changed. Never update firstSeen after insert.
     */
    insertOrUpdateDjNickname ( { uuid, nickname } ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const row = this.db.prepare( 'SELECT nickname FROM djs WHERE uuid = ?' ).get( uuid );
        if ( !row ) {
            // Insert new DJ (firstSeen will be set)
            this.upsertDj( { uuid, nickname } );
            return { action: 'inserted', uuid, nickname };
        } else if ( row.nickname !== nickname ) {
            // Only update nickname, never update firstSeen
            this.db.prepare( 'UPDATE djs SET nickname = ? WHERE uuid = ?' ).run( nickname, uuid );
            return { action: 'updated', uuid, oldNickname: row.nickname, newNickname: nickname };
        }
        return { action: 'none', uuid, nickname };
    }
    constructor ( logger ) {
        this.db = null;
        this.logger = logger;
        this.dbPath = path.join( process.cwd(), 'data', 'mrroboto.db' );
        this.initialized = false;
    }

    async initialize () {
        try {
            this.db = new Database( this.dbPath );
            this.createTables();
            this.createViews();
            this.initialized = true;
            this.logger.info( 'DatabaseService initialized successfully' );
        } catch ( error ) {
            this.logger.error( `Failed to initialize database: ${ error.message }` );
            throw error;
        }
    }

    createTables () {
        // DJs table
        const createDjsTable = `
            CREATE TABLE IF NOT EXISTS djs (
                uuid TEXT PRIMARY KEY,
                nickname TEXT,
                firstSeen DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        // Songs table
        const createSongsTable = `
            CREATE TABLE IF NOT EXISTS songs (
                song_id TEXT PRIMARY KEY,
                sevenDigital_id TEXT,
                artist_name TEXT,
                track_name TEXT,
                apple_id TEXT,
                spotify_id TEXT,
                youtube_id TEXT
            )
        `;
        // Songs played table
        const createSongsPlayedTable = `
            CREATE TABLE IF NOT EXISTS songs_played (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                song_id TEXT,
                dj_uuid TEXT,
                likes INTEGER DEFAULT 0,
                dislikes INTEGER DEFAULT 0,
                stars INTEGER DEFAULT 0,
                FOREIGN KEY(song_id) REFERENCES songs(song_id),
                FOREIGN KEY(dj_uuid) REFERENCES djs(uuid)
            )
        `;
        this.db.exec( createDjsTable );
        this.db.exec( createSongsTable );
        this.db.exec( createSongsPlayedTable );
        // Indexes
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_songs_played_timestamp ON songs_played(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_songs_played_song_id ON songs_played(song_id)',
            'CREATE INDEX IF NOT EXISTS idx_songs_played_dj_uuid ON songs_played(dj_uuid)'
        ];
        indexes.forEach( index => this.db.exec( index ) );

        // Create personality tables
        this.createPersonalityTables();
    }

    createPersonalityTables () {
        // Central personalities table with name, description, and timestamps
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS personalities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                description TEXT NOT NULL CHECK(length(description) <= 50),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ` );
        this.db.exec( 'CREATE INDEX IF NOT EXISTS idx_personality_name ON personalities(name COLLATE NOCASE)' );

        // Instruction types and content
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS instruction_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS instructions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (type_id) REFERENCES instruction_types(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS personality_instructions (
                personality_id INTEGER NOT NULL,
                instruction_id INTEGER NOT NULL,
                PRIMARY KEY (personality_id, instruction_id),
                FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
                FOREIGN KEY (instruction_id) REFERENCES instructions(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( 'CREATE INDEX IF NOT EXISTS idx_personality_instructions ON personality_instructions(personality_id)' );

        // Editable message types and content
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS editable_message_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS editable_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (type_id) REFERENCES editable_message_types(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS personality_editable_messages (
                personality_id INTEGER NOT NULL,
                message_id INTEGER NOT NULL,
                PRIMARY KEY (personality_id, message_id),
                FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
                FOREIGN KEY (message_id) REFERENCES editable_messages(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( 'CREATE INDEX IF NOT EXISTS idx_personality_editable_messages ON personality_editable_messages(personality_id)' );

        // Configuration types and content
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS configuration_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS configurations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (type_id) REFERENCES configuration_types(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS personality_configurations (
                personality_id INTEGER NOT NULL,
                configuration_id INTEGER NOT NULL,
                PRIMARY KEY (personality_id, configuration_id),
                FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
                FOREIGN KEY (configuration_id) REFERENCES configurations(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( 'CREATE INDEX IF NOT EXISTS idx_personality_configurations ON personality_configurations(personality_id)' );

        // ML question types and content
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS ml_question_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS ml_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type_id INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (type_id) REFERENCES ml_question_types(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS personality_ml_questions (
                personality_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                PRIMARY KEY (personality_id, question_id),
                FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES ml_questions(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( 'CREATE INDEX IF NOT EXISTS idx_personality_ml_questions ON personality_ml_questions(personality_id)' );

        // Disabled commands
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS disabled_commands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                command_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS personality_disabled_commands (
                personality_id INTEGER NOT NULL,
                command_id INTEGER NOT NULL,
                PRIMARY KEY (personality_id, command_id),
                FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
                FOREIGN KEY (command_id) REFERENCES disabled_commands(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( 'CREATE INDEX IF NOT EXISTS idx_personality_disabled_commands ON personality_disabled_commands(personality_id)' );

        // Disabled features
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS disabled_features (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feature_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS personality_disabled_features (
                personality_id INTEGER NOT NULL,
                feature_id INTEGER NOT NULL,
                PRIMARY KEY (personality_id, feature_id),
                FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
                FOREIGN KEY (feature_id) REFERENCES disabled_features(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( 'CREATE INDEX IF NOT EXISTS idx_personality_disabled_features ON personality_disabled_features(personality_id)' );

        // Trigger types and content
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS trigger_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS triggers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type_id INTEGER NOT NULL,
                pattern TEXT NOT NULL,
                response TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (type_id) REFERENCES trigger_types(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS personality_triggers (
                personality_id INTEGER NOT NULL,
                trigger_id INTEGER NOT NULL,
                PRIMARY KEY (personality_id, trigger_id),
                FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
                FOREIGN KEY (trigger_id) REFERENCES triggers(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( 'CREATE INDEX IF NOT EXISTS idx_personality_triggers ON personality_triggers(personality_id)' );

        // Custom tokens
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS custom_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_key TEXT NOT NULL,
                token_value TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ` );
        this.db.exec( `
            CREATE TABLE IF NOT EXISTS personality_custom_tokens (
                personality_id INTEGER NOT NULL,
                token_id INTEGER NOT NULL,
                PRIMARY KEY (personality_id, token_id),
                FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
                FOREIGN KEY (token_id) REFERENCES custom_tokens(id) ON DELETE CASCADE
            )
        ` );
        this.db.exec( 'CREATE INDEX IF NOT EXISTS idx_personality_custom_tokens ON personality_custom_tokens(personality_id)' );
    }

    createViews () {
        // View for song play history
        const createSongPlayHistoryView = `
            CREATE VIEW IF NOT EXISTS song_play_history AS
            SELECT
                sp.timestamp,
                s.artist_name,
                s.track_name,
                d.nickname
            FROM songs_played sp
            JOIN songs s ON sp.song_id = s.song_id
            JOIN djs d ON sp.dj_uuid = d.uuid
            ORDER BY sp.timestamp DESC
        `;
        this.db.exec( createSongPlayHistoryView );
    }

    /**
     * Upsert a DJ
     */
    /**
     * Insert DJ if not exists, set firstSeen only on insert
     */
    upsertDj ( { uuid, nickname } ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        // Check if DJ exists
        const exists = this.db.prepare( 'SELECT 1 FROM djs WHERE uuid = ?' ).get( uuid );
        if ( exists ) {
            // Only update nickname if changed, never update firstSeen
            const stmt = this.db.prepare( 'UPDATE djs SET nickname = ? WHERE uuid = ?' );
            return stmt.run( nickname, uuid );
        } else {
            // Insert with firstSeen as now
            const stmt = this.db.prepare( 'INSERT INTO djs (uuid, nickname) VALUES (?, ?)' );
            return stmt.run( uuid, nickname );
        }
    }

    /**
     * Upsert a song
     */
    upsertSong ( { songId, sevenDigitalId, artistName, trackName, appleId, spotifyId, youtubeId } ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const stmt = this.db.prepare( `
            INSERT INTO songs (song_id, sevenDigital_id, artist_name, track_name, apple_id, spotify_id, youtube_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(song_id) DO UPDATE SET
                sevenDigital_id=excluded.sevenDigital_id,
                artist_name=excluded.artist_name,
                track_name=excluded.track_name,
                apple_id=excluded.apple_id,
                spotify_id=excluded.spotify_id,
                youtube_id=excluded.youtube_id
        `);
        return stmt.run( songId, sevenDigitalId, artistName, trackName, appleId, spotifyId, youtubeId );
    }

    /**
     * Record a song play
     */
    recordSongPlay ( { songId, djUuid, likes = 0, dislikes = 0, stars = 0 } ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const stmt = this.db.prepare( `
            INSERT INTO songs_played (song_id, dj_uuid, likes, dislikes, stars)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run( songId, djUuid, likes, dislikes, stars );
    }

    // ...existing code...

    /**
     * Get the last N songs played with DJ information
     * @param {number} limit - Number of records to return (default 5)
     * @returns {Array} Array of play records with DJ and song info
     */
    getRecentSongs ( limit = 5 ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const stmt = this.db.prepare( `
            SELECT 
                sp.id,
                sp.timestamp,
                sp.song_id,
                sp.dj_uuid,
                sp.likes,
                sp.dislikes,
                sp.stars,
                s.artist_name,
                s.track_name,
                d.nickname
            FROM songs_played sp
            LEFT JOIN songs s ON sp.song_id = s.song_id
            LEFT JOIN djs d ON sp.dj_uuid = d.uuid
            ORDER BY sp.timestamp DESC
            LIMIT ?
        ` );
        return stmt.all( limit );
    }

    /**
     * Close database connection
     */
    close () {
        if ( this.db ) {
            this.db.close();
            this.initialized = false;
        }
    }

    /**
     * Find a DJ record by nickname (case-insensitive)
     * @param {string} nickname - The nickname to search for
     * @returns {Object|null} Row with uuid and nickname, or null if not found
     */
    findDjByNickname ( nickname ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        return this.db.prepare( 'SELECT uuid, nickname FROM djs WHERE LOWER(nickname) = LOWER(?) LIMIT 1' ).get( nickname ) || null;
    }

    getAllDjNicknames () {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        return this.db.prepare( 'SELECT uuid, nickname FROM djs ORDER BY nickname' ).all();
    }

    // ===== Personality Store Helper Methods =====

    /**
     * Get or create an instruction type
     */
    getOrCreateInstructionType ( typeName ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        let type = this.db.prepare( 'SELECT id FROM instruction_types WHERE name = ? COLLATE NOCASE' ).get( typeName );
        if ( !type ) {
            const result = this.db.prepare( 'INSERT INTO instruction_types (name) VALUES (?)' ).run( typeName );
            return result.lastInsertRowid;
        }
        return type.id;
    }

    /**
     * Get or create an editable message type
     */
    getOrCreateEditableMessageType ( typeName ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        let type = this.db.prepare( 'SELECT id FROM editable_message_types WHERE name = ? COLLATE NOCASE' ).get( typeName );
        if ( !type ) {
            const result = this.db.prepare( 'INSERT INTO editable_message_types (name) VALUES (?)' ).run( typeName );
            return result.lastInsertRowid;
        }
        return type.id;
    }

    /**
     * Get or create a configuration type
     */
    getOrCreateConfigurationType ( typeName ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        let type = this.db.prepare( 'SELECT id FROM configuration_types WHERE name = ? COLLATE NOCASE' ).get( typeName );
        if ( !type ) {
            const result = this.db.prepare( 'INSERT INTO configuration_types (name) VALUES (?)' ).run( typeName );
            return result.lastInsertRowid;
        }
        return type.id;
    }

    /**
     * Get or create an ML question type
     */
    getOrCreateMlQuestionType ( typeName ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        let type = this.db.prepare( 'SELECT id FROM ml_question_types WHERE name = ? COLLATE NOCASE' ).get( typeName );
        if ( !type ) {
            const result = this.db.prepare( 'INSERT INTO ml_question_types (name) VALUES (?)' ).run( typeName );
            return result.lastInsertRowid;
        }
        return type.id;
    }

    /**
     * Get or create a trigger type
     */
    getOrCreateTriggerType ( typeName ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        let type = this.db.prepare( 'SELECT id FROM trigger_types WHERE name = ? COLLATE NOCASE' ).get( typeName );
        if ( !type ) {
            const result = this.db.prepare( 'INSERT INTO trigger_types (name) VALUES (?)' ).run( typeName );
            return result.lastInsertRowid;
        }
        return type.id;
    }

    /**
     * Find or create an instruction
     */
    findOrCreateInstruction ( typeId, content ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const existing = this.db.prepare( 'SELECT id FROM instructions WHERE type_id = ? AND content = ?' ).get( typeId, content );
        if ( existing ) return existing.id;
        const result = this.db.prepare( 'INSERT INTO instructions (type_id, content) VALUES (?, ?)' ).run( typeId, content );
        return result.lastInsertRowid;
    }

    /**
     * Find or create an editable message
     */
    findOrCreateEditableMessage ( typeId, content ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const existing = this.db.prepare( 'SELECT id FROM editable_messages WHERE type_id = ? AND content = ?' ).get( typeId, content );
        if ( existing ) return existing.id;
        const result = this.db.prepare( 'INSERT INTO editable_messages (type_id, content) VALUES (?, ?)' ).run( typeId, content );
        return result.lastInsertRowid;
    }

    /**
     * Find or create a configuration
     */
    findOrCreateConfiguration ( typeId, content ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const existing = this.db.prepare( 'SELECT id FROM configurations WHERE type_id = ? AND content = ?' ).get( typeId, content );
        if ( existing ) return existing.id;
        const result = this.db.prepare( 'INSERT INTO configurations (type_id, content) VALUES (?, ?)' ).run( typeId, content );
        return result.lastInsertRowid;
    }

    /**
     * Find or create an ML question
     */
    findOrCreateMlQuestion ( typeId, questionText ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const existing = this.db.prepare( 'SELECT id FROM ml_questions WHERE type_id = ? AND question_text = ?' ).get( typeId, questionText );
        if ( existing ) return existing.id;
        const result = this.db.prepare( 'INSERT INTO ml_questions (type_id, question_text) VALUES (?, ?)' ).run( typeId, questionText );
        return result.lastInsertRowid;
    }

    /**
     * Find or create a disabled command
     */
    findOrCreateDisabledCommand ( commandName ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const existing = this.db.prepare( 'SELECT id FROM disabled_commands WHERE command_name = ?' ).get( commandName );
        if ( existing ) return existing.id;
        const result = this.db.prepare( 'INSERT INTO disabled_commands (command_name) VALUES (?)' ).run( commandName );
        return result.lastInsertRowid;
    }

    /**
     * Find or create a disabled feature
     */
    findOrCreateDisabledFeature ( featureName ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const existing = this.db.prepare( 'SELECT id FROM disabled_features WHERE feature_name = ?' ).get( featureName );
        if ( existing ) return existing.id;
        const result = this.db.prepare( 'INSERT INTO disabled_features (feature_name) VALUES (?)' ).run( featureName );
        return result.lastInsertRowid;
    }

    /**
     * Find or create a trigger
     */
    findOrCreateTrigger ( typeId, pattern, response ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const existing = this.db.prepare( 'SELECT id FROM triggers WHERE type_id = ? AND pattern = ? AND response = ?' ).get( typeId, pattern, response );
        if ( existing ) return existing.id;
        const result = this.db.prepare( 'INSERT INTO triggers (type_id, pattern, response) VALUES (?, ?, ?)' ).run( typeId, pattern, response );
        return result.lastInsertRowid;
    }

    /**
     * Find or create a custom token
     */
    findOrCreateCustomToken ( key, value ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const existing = this.db.prepare( 'SELECT id FROM custom_tokens WHERE token_key = ? AND token_value = ?' ).get( key, value );
        if ( existing ) return existing.id;
        const result = this.db.prepare( 'INSERT INTO custom_tokens (token_key, token_value) VALUES (?, ?)' ).run( key, value );
        return result.lastInsertRowid;
    }

    /**
     * Link personality to content
     */
    linkPersonalityToContent ( personalityId, componentType, contentId ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const tableMap = {
            instructions: 'personality_instructions',
            editable_messages: 'personality_editable_messages',
            configurations: 'personality_configurations',
            ml_questions: 'personality_ml_questions',
            disabled_commands: 'personality_disabled_commands',
            disabled_features: 'personality_disabled_features',
            triggers: 'personality_triggers',
            custom_tokens: 'personality_custom_tokens'
        };
        const columnMap = {
            instructions: 'instruction_id',
            editable_messages: 'message_id',
            configurations: 'configuration_id',
            ml_questions: 'question_id',
            disabled_commands: 'command_id',
            disabled_features: 'feature_id',
            triggers: 'trigger_id',
            custom_tokens: 'token_id'
        };
        const tableName = tableMap[ componentType ];
        const columnName = columnMap[ componentType ];
        if ( !tableName || !columnName ) throw new Error( `Unknown component type: ${ componentType }` );

        this.db.prepare( `INSERT OR IGNORE INTO ${ tableName } (personality_id, ${ columnName }) VALUES (?, ?)` ).run( personalityId, contentId );
    }

    /**
     * Get content reference count (how many personalities use this content)
     */
    getContentReferenceCount ( componentType, contentId ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        const tableMap = {
            instructions: 'personality_instructions',
            editable_messages: 'personality_editable_messages',
            configurations: 'personality_configurations',
            ml_questions: 'personality_ml_questions',
            disabled_commands: 'personality_disabled_commands',
            disabled_features: 'personality_disabled_features',
            triggers: 'personality_triggers',
            custom_tokens: 'personality_custom_tokens'
        };
        const columnMap = {
            instructions: 'instruction_id',
            editable_messages: 'message_id',
            configurations: 'configuration_id',
            ml_questions: 'question_id',
            disabled_commands: 'command_id',
            disabled_features: 'feature_id',
            triggers: 'trigger_id',
            custom_tokens: 'token_id'
        };
        const tableName = tableMap[ componentType ];
        const columnName = columnMap[ componentType ];
        if ( !tableName || !columnName ) throw new Error( `Unknown component type: ${ componentType }` );

        const result = this.db.prepare( `SELECT COUNT(*) as count FROM ${ tableName } WHERE ${ columnName } = ?` ).get( contentId );
        return result.count;
    }

    /**
     * Update instruction content in-place
     */
    updateInstruction ( instructionId, newContent ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        this.db.prepare( 'UPDATE instructions SET content = ? WHERE id = ?' ).run( newContent, instructionId );
    }

    /**
     * Update editable message content in-place
     */
    updateEditableMessage ( messageId, newContent ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        this.db.prepare( 'UPDATE editable_messages SET content = ? WHERE id = ?' ).run( newContent, messageId );
    }

    /**
     * Update configuration content in-place
     */
    updateConfiguration ( configId, newContent ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        this.db.prepare( 'UPDATE configurations SET content = ? WHERE id = ?' ).run( newContent, configId );
    }

    /**
     * Update ML question in-place
     */
    updateMlQuestion ( questionId, newQuestionText ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        this.db.prepare( 'UPDATE ml_questions SET question_text = ? WHERE id = ?' ).run( newQuestionText, questionId );
    }

    /**
     * Update trigger in-place
     */
    updateTrigger ( triggerId, newPattern, newResponse ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        this.db.prepare( 'UPDATE triggers SET pattern = ?, response = ? WHERE id = ?' ).run( newPattern, newResponse, triggerId );
    }

    /**
     * Update custom token in-place
     */
    updateCustomToken ( tokenId, newValue ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        this.db.prepare( 'UPDATE custom_tokens SET token_value = ? WHERE id = ?' ).run( newValue, tokenId );
    }

    /**
     * Cleanup orphaned content (content not linked to any personality)
     */
    cleanupOrphanedContent () {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        let totalCleaned = 0;

        // Clean instructions
        const orphanedInstructions = this.db.prepare( `
            DELETE FROM instructions WHERE id IN (
                SELECT i.id FROM instructions i
                LEFT JOIN personality_instructions pi ON i.id = pi.instruction_id
                WHERE pi.instruction_id IS NULL
            )
        ` ).run();
        totalCleaned += orphanedInstructions.changes;

        // Clean editable messages
        const orphanedMessages = this.db.prepare( `
            DELETE FROM editable_messages WHERE id IN (
                SELECT em.id FROM editable_messages em
                LEFT JOIN personality_editable_messages pem ON em.id = pem.message_id
                WHERE pem.message_id IS NULL
            )
        ` ).run();
        totalCleaned += orphanedMessages.changes;

        // Clean configurations
        const orphanedConfigs = this.db.prepare( `
            DELETE FROM configurations WHERE id IN (
                SELECT c.id FROM configurations c
                LEFT JOIN personality_configurations pc ON c.id = pc.configuration_id
                WHERE pc.configuration_id IS NULL
            )
        ` ).run();
        totalCleaned += orphanedConfigs.changes;

        // Clean ML questions
        const orphanedQuestions = this.db.prepare( `
            DELETE FROM ml_questions WHERE id IN (
                SELECT mq.id FROM ml_questions mq
                LEFT JOIN personality_ml_questions pmq ON mq.id = pmq.question_id
                WHERE pmq.question_id IS NULL
            )
        ` ).run();
        totalCleaned += orphanedQuestions.changes;

        // Clean disabled commands
        const orphanedCommands = this.db.prepare( `
            DELETE FROM disabled_commands WHERE id IN (
                SELECT dc.id FROM disabled_commands dc
                LEFT JOIN personality_disabled_commands pdc ON dc.id = pdc.command_id
                WHERE pdc.command_id IS NULL
            )
        ` ).run();
        totalCleaned += orphanedCommands.changes;

        // Clean disabled features
        const orphanedFeatures = this.db.prepare( `
            DELETE FROM disabled_features WHERE id IN (
                SELECT df.id FROM disabled_features df
                LEFT JOIN personality_disabled_features pdf ON df.id = pdf.feature_id
                WHERE pdf.feature_id IS NULL
            )
        ` ).run();
        totalCleaned += orphanedFeatures.changes;

        // Clean triggers
        const orphanedTriggers = this.db.prepare( `
            DELETE FROM triggers WHERE id IN (
                SELECT t.id FROM triggers t
                LEFT JOIN personality_triggers pt ON t.id = pt.trigger_id
                WHERE pt.trigger_id IS NULL
            )
        ` ).run();
        totalCleaned += orphanedTriggers.changes;

        // Clean custom tokens
        const orphanedTokens = this.db.prepare( `
            DELETE FROM custom_tokens WHERE id IN (
                SELECT ct.id FROM custom_tokens ct
                LEFT JOIN personality_custom_tokens pct ON ct.id = pct.token_id
                WHERE pct.token_id IS NULL
            )
        ` ).run();
        totalCleaned += orphanedTokens.changes;

        return totalCleaned;
    }

    // ===== Main Personality CRUD Methods =====

    /**
     * Save a new personality with all components
     */
    savePersonality ( { name, description, mlPersonality, mlInstructions, editableMessages, configuration, mlQuestions, disabledCommands, disabledFeatures, triggers, customTokens } ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );

        // Validate description
        if ( !description || description.length === 0 ) {
            throw new Error( 'Description is required' );
        }
        if ( description.length > 50 ) {
            throw new Error( `Description must be 50 characters or less (currently: ${ description.length })` );
        }

        const transaction = this.db.transaction( () => {
            // Create personality record
            const result = this.db.prepare( 'INSERT INTO personalities (name, description) VALUES (?, ?)' ).run( name, description );
            const personalityId = result.lastInsertRowid;

            // Save MLPersonality instruction
            if ( mlPersonality ) {
                const typeId = this.getOrCreateInstructionType( 'MLPersonality' );
                const contentId = this.findOrCreateInstruction( typeId, mlPersonality );
                this.linkPersonalityToContent( personalityId, 'instructions', contentId );
            }

            // Save MLInstructions
            if ( mlInstructions ) {
                const typeId = this.getOrCreateInstructionType( 'MLInstructions' );
                const contentId = this.findOrCreateInstruction( typeId, mlInstructions );
                this.linkPersonalityToContent( personalityId, 'instructions', contentId );
            }

            // Save editable messages
            if ( editableMessages && typeof editableMessages === 'object' ) {
                Object.keys( editableMessages ).forEach( key => {
                    const typeId = this.getOrCreateEditableMessageType( key );
                    const contentId = this.findOrCreateEditableMessage( typeId, editableMessages[ key ] );
                    this.linkPersonalityToContent( personalityId, 'editable_messages', contentId );
                } );
            }

            // Save configuration
            if ( configuration && typeof configuration === 'object' ) {
                Object.keys( configuration ).forEach( key => {
                    const typeId = this.getOrCreateConfigurationType( key );
                    const contentId = this.findOrCreateConfiguration( typeId, JSON.stringify( configuration[ key ] ) );
                    this.linkPersonalityToContent( personalityId, 'configurations', contentId );
                } );
            }

            // Save ML questions
            if ( mlQuestions && typeof mlQuestions === 'object' ) {
                Object.keys( mlQuestions ).forEach( key => {
                    const typeId = this.getOrCreateMlQuestionType( key );
                    const contentId = this.findOrCreateMlQuestion( typeId, mlQuestions[ key ] );
                    this.linkPersonalityToContent( personalityId, 'ml_questions', contentId );
                } );
            }

            // Save disabled commands
            if ( Array.isArray( disabledCommands ) ) {
                disabledCommands.forEach( commandName => {
                    const contentId = this.findOrCreateDisabledCommand( commandName );
                    this.linkPersonalityToContent( personalityId, 'disabled_commands', contentId );
                } );
            }

            // Save disabled features
            if ( Array.isArray( disabledFeatures ) ) {
                disabledFeatures.forEach( featureName => {
                    const contentId = this.findOrCreateDisabledFeature( featureName );
                    this.linkPersonalityToContent( personalityId, 'disabled_features', contentId );
                } );
            }

            // Save triggers
            if ( triggers && typeof triggers === 'object' ) {
                Object.keys( triggers ).forEach( triggerType => {
                    const typeId = this.getOrCreateTriggerType( triggerType );
                    const triggerList = triggers[ triggerType ];
                    if ( Array.isArray( triggerList ) ) {
                        triggerList.forEach( trigger => {
                            // Handle both string format (command names) and object format (pattern/response)
                            const pattern = typeof trigger === 'string' ? trigger : trigger.pattern;
                            const response = typeof trigger === 'string' ? trigger : trigger.response;
                            const contentId = this.findOrCreateTrigger( typeId, pattern, response );
                            this.linkPersonalityToContent( personalityId, 'triggers', contentId );
                        } );
                    }
                } );
            }

            // Save custom tokens
            if ( customTokens && typeof customTokens === 'object' ) {
                Object.keys( customTokens ).forEach( key => {
                    const value = JSON.stringify( customTokens[ key ] );
                    const contentId = this.findOrCreateCustomToken( key, value );
                    this.linkPersonalityToContent( personalityId, 'custom_tokens', contentId );
                } );
            }

            return personalityId;
        } );

        const personalityId = transaction();
        this.logger.info( `Personality "${ name }" saved with ID ${ personalityId }` );
        return personalityId;
    }

    /**
     * Get all personalities (lightweight - no component data)
     */
    getAllPersonalities () {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );
        return this.db.prepare( 'SELECT id, name, description, created_at, updated_at FROM personalities ORDER BY name COLLATE NOCASE' ).all();
    }

    /**
     * Get a personality by name with all components
     */
    getPersonalityByName ( name ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );

        // Get personality record
        const personality = this.db.prepare( 'SELECT * FROM personalities WHERE name = ? COLLATE NOCASE' ).get( name );
        if ( !personality ) return undefined;

        // Get instructions
        const instructions = {};
        const instructionRows = this.db.prepare( `
            SELECT it.name as type, i.content
            FROM personality_instructions pi
            JOIN instructions i ON pi.instruction_id = i.id
            JOIN instruction_types it ON i.type_id = it.id
            WHERE pi.personality_id = ?
        ` ).all( personality.id );
        instructionRows.forEach( row => {
            instructions[ row.type ] = row.content;
        } );

        // Get editable messages
        const editableMessages = {};
        const messageRows = this.db.prepare( `
            SELECT emt.name as type, em.content
            FROM personality_editable_messages pem
            JOIN editable_messages em ON pem.message_id = em.id
            JOIN editable_message_types emt ON em.type_id = emt.id
            WHERE pem.personality_id = ?
        ` ).all( personality.id );
        messageRows.forEach( row => {
            editableMessages[ row.type ] = row.content;
        } );

        // Get configuration
        const configuration = {};
        const configRows = this.db.prepare( `
            SELECT ct.name as type, c.content
            FROM personality_configurations pc
            JOIN configurations c ON pc.configuration_id = c.id
            JOIN configuration_types ct ON c.type_id = ct.id
            WHERE pc.personality_id = ?
        ` ).all( personality.id );
        configRows.forEach( row => {
            try {
                configuration[ row.type ] = JSON.parse( row.content );
            } catch ( e ) {
                configuration[ row.type ] = row.content;
            }
        } );

        // Get ML questions
        const mlQuestions = {};
        const questionRows = this.db.prepare( `
            SELECT mqt.name as type, mq.question_text
            FROM personality_ml_questions pmq
            JOIN ml_questions mq ON pmq.question_id = mq.id
            JOIN ml_question_types mqt ON mq.type_id = mqt.id
            WHERE pmq.personality_id = ?
        ` ).all( personality.id );
        questionRows.forEach( row => {
            mlQuestions[ row.type ] = row.question_text;
        } );

        // Get disabled commands
        const disabledCommands = [];
        const commandRows = this.db.prepare( `
            SELECT dc.command_name
            FROM personality_disabled_commands pdc
            JOIN disabled_commands dc ON pdc.command_id = dc.id
            WHERE pdc.personality_id = ?
        ` ).all( personality.id );
        commandRows.forEach( row => {
            disabledCommands.push( row.command_name );
        } );

        // Get disabled features
        const disabledFeatures = [];
        const featureRows = this.db.prepare( `
            SELECT df.feature_name
            FROM personality_disabled_features pdf
            JOIN disabled_features df ON pdf.feature_id = df.id
            WHERE pdf.personality_id = ?
        ` ).all( personality.id );
        featureRows.forEach( row => {
            disabledFeatures.push( row.feature_name );
        } );

        // Get triggers
        const triggers = {};
        const triggerRows = this.db.prepare( `
            SELECT tt.name as type, t.pattern, t.response
            FROM personality_triggers pt
            JOIN triggers t ON pt.trigger_id = t.id
            JOIN trigger_types tt ON t.type_id = tt.id
            WHERE pt.personality_id = ?
        ` ).all( personality.id );
        triggerRows.forEach( row => {
            if ( !triggers[ row.type ] ) {
                triggers[ row.type ] = [];
            }
            // Convert back to simple command name format (matching botConfig structure)
            // If pattern and response are the same, it's a simple command trigger
            if ( row.pattern === row.response ) {
                triggers[ row.type ].push( row.pattern );
            } else {
                // Preserve full object format for future pattern/response triggers
                triggers[ row.type ].push( { pattern: row.pattern, response: row.response } );
            }
        } );

        // Get custom tokens
        const customTokens = {};
        const tokenRows = this.db.prepare( `
            SELECT ct.token_key, ct.token_value
            FROM personality_custom_tokens pct
            JOIN custom_tokens ct ON pct.token_id = ct.id
            WHERE pct.personality_id = ?
        ` ).all( personality.id );
        tokenRows.forEach( row => {
            try {
                customTokens[ row.token_key ] = JSON.parse( row.token_value );
            } catch ( e ) {
                customTokens[ row.token_key ] = row.token_value;
            }
        } );

        return {
            id: personality.id,
            name: personality.name,
            description: personality.description,
            instructions,
            editableMessages,
            configuration,
            mlQuestions,
            disabledCommands,
            disabledFeatures,
            triggers,
            customTokens,
            created_at: personality.created_at,
            updated_at: personality.updated_at
        };
    }

    /**
     * Delete a personality and cleanup orphaned content
     */
    deletePersonality ( name ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );

        const transaction = this.db.transaction( () => {
            // Get personality to verify it exists
            const personality = this.db.prepare( 'SELECT id, name FROM personalities WHERE name = ? COLLATE NOCASE' ).get( name );
            if ( !personality ) return undefined;

            // Delete personality (CASCADE will handle junction tables)
            this.db.prepare( 'DELETE FROM personalities WHERE id = ?' ).run( personality.id );

            // Cleanup orphaned content
            const cleaned = this.cleanupOrphanedContent();

            return { name: personality.name, orphanedContentCleaned: cleaned };
        } );

        const result = transaction();
        if ( result ) {
            this.logger.info( `Personality "${ result.name }" deleted, cleaned up ${ result.orphanedContentCleaned } orphaned content items` );
        }
        return result;
    }

    /**
     * Update a personality with smart content management
     */
    updatePersonality ( { name, description, mlPersonality, mlInstructions, editableMessages, configuration, mlQuestions, disabledCommands, disabledFeatures, triggers, customTokens } ) {
        if ( !this.initialized ) throw new Error( 'DatabaseService not initialized' );

        // Validate description if provided
        if ( description !== undefined ) {
            if ( description.length > 50 ) {
                throw new Error( `Description must be 50 characters or less (currently: ${ description.length })` );
            }
        }

        const transaction = this.db.transaction( () => {
            // Get personality
            const personality = this.db.prepare( 'SELECT id FROM personalities WHERE name = ? COLLATE NOCASE' ).get( name );
            if ( !personality ) throw new Error( `Personality "${ name }" not found` );

            const personalityId = personality.id;

            // Update description if provided
            if ( description !== undefined ) {
                this.db.prepare( 'UPDATE personalities SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?' ).run( description, personalityId );
            } else {
                // Just update timestamp
                this.db.prepare( 'UPDATE personalities SET updated_at = CURRENT_TIMESTAMP WHERE id = ?' ).run( personalityId );
            }

            // Update MLPersonality if provided
            if ( mlPersonality !== undefined ) {
                const typeId = this.getOrCreateInstructionType( 'MLPersonality' );
                // Remove all current links for this type
                const currentLinks = this.db.prepare( `
                    SELECT pi.instruction_id
                    FROM personality_instructions pi
                    JOIN instructions i ON pi.instruction_id = i.id
                    WHERE pi.personality_id = ? AND i.type_id = ?
                ` ).all( personalityId, typeId );

                currentLinks.forEach( link => {
                    const refCount = this.getContentReferenceCount( 'instructions', link.instruction_id );
                    if ( refCount === 1 ) {
                        this.updateInstruction( link.instruction_id, mlPersonality );
                    } else {
                        this.db.prepare( 'DELETE FROM personality_instructions WHERE personality_id = ? AND instruction_id = ?' ).run( personalityId, link.instruction_id );
                        const newContentId = this.findOrCreateInstruction( typeId, mlPersonality );
                        this.linkPersonalityToContent( personalityId, 'instructions', newContentId );
                    }
                } );
            }

            // Update MLInstructions if provided
            if ( mlInstructions !== undefined ) {
                const typeId = this.getOrCreateInstructionType( 'MLInstructions' );
                const currentLinks = this.db.prepare( `
                    SELECT pi.instruction_id
                    FROM personality_instructions pi
                    JOIN instructions i ON pi.instruction_id = i.id
                    WHERE pi.personality_id = ? AND i.type_id = ?
                ` ).all( personalityId, typeId );

                currentLinks.forEach( link => {
                    const refCount = this.getContentReferenceCount( 'instructions', link.instruction_id );
                    if ( refCount === 1 ) {
                        this.updateInstruction( link.instruction_id, mlInstructions );
                    } else {
                        this.db.prepare( 'DELETE FROM personality_instructions WHERE personality_id = ? AND instruction_id = ?' ).run( personalityId, link.instruction_id );
                        const newContentId = this.findOrCreateInstruction( typeId, mlInstructions );
                        this.linkPersonalityToContent( personalityId, 'instructions', newContentId );
                    }
                } );
            }

            // For other components, we'll do a simpler approach: delete all links and re-add
            // This is simpler than tracking each individual item

            if ( editableMessages !== undefined ) {
                this.db.prepare( 'DELETE FROM personality_editable_messages WHERE personality_id = ?' ).run( personalityId );
                Object.keys( editableMessages ).forEach( key => {
                    const typeId = this.getOrCreateEditableMessageType( key );
                    const contentId = this.findOrCreateEditableMessage( typeId, editableMessages[ key ] );
                    this.linkPersonalityToContent( personalityId, 'editable_messages', contentId );
                } );
            }

            if ( configuration !== undefined ) {
                this.db.prepare( 'DELETE FROM personality_configurations WHERE personality_id = ?' ).run( personalityId );
                Object.keys( configuration ).forEach( key => {
                    const typeId = this.getOrCreateConfigurationType( key );
                    const contentId = this.findOrCreateConfiguration( typeId, JSON.stringify( configuration[ key ] ) );
                    this.linkPersonalityToContent( personalityId, 'configurations', contentId );
                } );
            }

            if ( mlQuestions !== undefined ) {
                this.db.prepare( 'DELETE FROM personality_ml_questions WHERE personality_id = ?' ).run( personalityId );
                Object.keys( mlQuestions ).forEach( key => {
                    const typeId = this.getOrCreateMlQuestionType( key );
                    const contentId = this.findOrCreateMlQuestion( typeId, mlQuestions[ key ] );
                    this.linkPersonalityToContent( personalityId, 'ml_questions', contentId );
                } );
            }

            if ( disabledCommands !== undefined ) {
                this.db.prepare( 'DELETE FROM personality_disabled_commands WHERE personality_id = ?' ).run( personalityId );
                disabledCommands.forEach( commandName => {
                    const contentId = this.findOrCreateDisabledCommand( commandName );
                    this.linkPersonalityToContent( personalityId, 'disabled_commands', contentId );
                } );
            }

            if ( disabledFeatures !== undefined ) {
                this.db.prepare( 'DELETE FROM personality_disabled_features WHERE personality_id = ?' ).run( personalityId );
                disabledFeatures.forEach( featureName => {
                    const contentId = this.findOrCreateDisabledFeature( featureName );
                    this.linkPersonalityToContent( personalityId, 'disabled_features', contentId );
                } );
            }

            if ( triggers !== undefined ) {
                this.db.prepare( 'DELETE FROM personality_triggers WHERE personality_id = ?' ).run( personalityId );
                Object.keys( triggers ).forEach( triggerType => {
                    const typeId = this.getOrCreateTriggerType( triggerType );
                    const triggerList = triggers[ triggerType ];
                    if ( Array.isArray( triggerList ) ) {
                        triggerList.forEach( trigger => {
                            // Handle both string format (command names) and object format (pattern/response)
                            const pattern = typeof trigger === 'string' ? trigger : trigger.pattern;
                            const response = typeof trigger === 'string' ? trigger : trigger.response;
                            const contentId = this.findOrCreateTrigger( typeId, pattern, response );
                            this.linkPersonalityToContent( personalityId, 'triggers', contentId );
                        } );
                    }
                } );
            }

            if ( customTokens !== undefined ) {
                this.db.prepare( 'DELETE FROM personality_custom_tokens WHERE personality_id = ?' ).run( personalityId );
                Object.keys( customTokens ).forEach( key => {
                    const value = JSON.stringify( customTokens[ key ] );
                    const contentId = this.findOrCreateCustomToken( key, value );
                    this.linkPersonalityToContent( personalityId, 'custom_tokens', contentId );
                } );
            }

            // Cleanup any orphaned content created during update
            this.cleanupOrphanedContent();

            return personalityId;
        } );

        const result = transaction();
        this.logger.info( `Personality "${ name }" updated` );
        return result;
    }
}

module.exports = DatabaseService;