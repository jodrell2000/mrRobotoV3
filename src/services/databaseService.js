const Database = require('better-sqlite3');
const path = require('path');

/**
 * DatabaseService - Handles SQLite database operations for historical data
 * Separate from DataService which handles JSON configuration data
 */
class DatabaseService {
    constructor(logger) {
        this.db = null;
        this.logger = logger;
        this.dbPath = path.join(process.cwd(), 'data', 'mrroboto.db');
        this.initialized = false;
    }

    async initialize() {
        try {
            this.db = new Database(this.dbPath);
            this.createTables();
            this.initialized = true;
            this.logger.info('DatabaseService initialized successfully');
        } catch (error) {
            this.logger.error(`Failed to initialize database: ${error.message}`);
            throw error;
        }
    }

    createTables() {
        const createSongsTable = `
            CREATE TABLE IF NOT EXISTS played_songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                dj_uuid TEXT NOT NULL,
                dj_nickname TEXT,
                artist_name TEXT NOT NULL,
                track_name TEXT NOT NULL,
                likes INTEGER DEFAULT 0,
                dislikes INTEGER DEFAULT 0,
                stars INTEGER DEFAULT 0
            )
        `;

        const createConversationTable = `
            CREATE TABLE IF NOT EXISTS conversation_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                question TEXT NOT NULL,
                response TEXT NOT NULL,
                user_uuid TEXT,
                command_used TEXT
            )
        `;

        const createImageCacheTable = `
            CREATE TABLE IF NOT EXISTS image_validation_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL,
                status_code INTEGER,
                last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
                attempts INTEGER DEFAULT 1,
                error_message TEXT
            )
        `;

        // Create tables
        this.db.exec(createSongsTable);
        this.db.exec(createConversationTable);
        this.db.exec(createImageCacheTable);

        // Create indexes for performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_songs_timestamp ON played_songs(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_songs_dj_uuid ON played_songs(dj_uuid)',
            'CREATE INDEX IF NOT EXISTS idx_songs_artist ON played_songs(artist_name)',
            'CREATE INDEX IF NOT EXISTS idx_conversation_timestamp ON conversation_history(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_image_cache_url ON image_validation_cache(url)',
            'CREATE INDEX IF NOT EXISTS idx_image_cache_status ON image_validation_cache(status)'
        ];

        indexes.forEach(index => this.db.exec(index));
    }

    /**
     * Record a song play with vote counts
     */
    recordSongPlay(songData) {
        if (!this.initialized) {
            throw new Error('DatabaseService not initialized');
        }

        const stmt = this.db.prepare(`
            INSERT INTO played_songs (dj_uuid, dj_nickname, artist_name, track_name, likes, dislikes, stars)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        return stmt.run(
            songData.djUuid,
            songData.djNickname || null,
            songData.artistName,
            songData.trackName,
            songData.voteCounts?.likes || 0,
            songData.voteCounts?.dislikes || 0,
            songData.voteCounts?.stars || 0
        );
    }

    /**
     * Get recent song history
     */
    getRecentSongs(limit = 50) {
        if (!this.initialized) {
            throw new Error('DatabaseService not initialized');
        }

        const stmt = this.db.prepare(`
            SELECT * FROM played_songs 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);

        return stmt.all(limit);
    }

    /**
     * Get songs played by a specific DJ
     */
    getSongsByDJ(djUuid, limit = 50) {
        if (!this.initialized) {
            throw new Error('DatabaseService not initialized');
        }

        const stmt = this.db.prepare(`
            SELECT * FROM played_songs 
            WHERE dj_uuid = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);

        return stmt.all(djUuid, limit);
    }

    /**
     * Get song statistics for a time period
     */
    getSongStats(startDate, endDate) {
        if (!this.initialized) {
            throw new Error('DatabaseService not initialized');
        }

        const stmt = this.db.prepare(`
            SELECT 
                COUNT(*) as total_songs,
                COUNT(DISTINCT dj_uuid) as unique_djs,
                AVG(likes) as avg_likes,
                AVG(dislikes) as avg_dislikes,
                AVG(stars) as avg_stars,
                SUM(likes + dislikes + stars) as total_votes
            FROM played_songs 
            WHERE timestamp BETWEEN ? AND ?
        `);

        return stmt.get(startDate, endDate);
    }

    /**
     * Save conversation entry for ML context
     */
    saveConversation(question, response, userUuid = null, command = null) {
        if (!this.initialized) {
            throw new Error('DatabaseService not initialized');
        }

        const stmt = this.db.prepare(`
            INSERT INTO conversation_history (question, response, user_uuid, command_used)
            VALUES (?, ?, ?, ?)
        `);

        return stmt.run(question, response, userUuid, command);
    }

    /**
     * Get recent conversation history for ML context
     */
    getConversationHistory(hoursBack = 1, limit = 20) {
        if (!this.initialized) {
            throw new Error('DatabaseService not initialized');
        }

        const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000)).toISOString();

        const stmt = this.db.prepare(`
            SELECT question, response, timestamp 
            FROM conversation_history 
            WHERE timestamp > ? 
            ORDER BY timestamp ASC 
            LIMIT ?
        `);

        return stmt.all(cutoffTime, limit);
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.initialized = false;
        }
    }
}

module.exports = DatabaseService;