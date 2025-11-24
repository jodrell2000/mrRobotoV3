const Database = require('better-sqlite3');
const path = require('path');

/**
 * DatabaseService - Handles SQLite database operations for historical data
 * Separate from DataService which handles JSON configuration data
 */
class DatabaseService {
        /**
         * Insert DJ if not exists, or update nickname if changed. Never update firstSeen after insert.
         */
        insertOrUpdateDjNickname({ uuid, nickname }) {
            if (!this.initialized) throw new Error('DatabaseService not initialized');
            const row = this.db.prepare('SELECT nickname FROM djs WHERE uuid = ?').get(uuid);
            if (!row) {
                // Insert new DJ (firstSeen will be set)
                this.upsertDj({ uuid, nickname });
                return { action: 'inserted', uuid, nickname };
            } else if (row.nickname !== nickname) {
                // Only update nickname, never update firstSeen
                this.db.prepare('UPDATE djs SET nickname = ? WHERE uuid = ?').run(nickname, uuid);
                return { action: 'updated', uuid, oldNickname: row.nickname, newNickname: nickname };
            }
            return { action: 'none', uuid, nickname };
        }
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
        this.db.exec(createDjsTable);
        this.db.exec(createSongsTable);
        this.db.exec(createSongsPlayedTable);
        // Indexes
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_songs_played_timestamp ON songs_played(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_songs_played_song_id ON songs_played(song_id)',
            'CREATE INDEX IF NOT EXISTS idx_songs_played_dj_uuid ON songs_played(dj_uuid)'
        ];
        indexes.forEach(index => this.db.exec(index));
    }

    /**
     * Upsert a DJ
     */
    /**
     * Insert DJ if not exists, set firstSeen only on insert
     */
    upsertDj({ uuid, nickname }) {
        if (!this.initialized) throw new Error('DatabaseService not initialized');
        // Check if DJ exists
        const exists = this.db.prepare('SELECT 1 FROM djs WHERE uuid = ?').get(uuid);
        if (exists) {
            // Only update nickname if changed, never update firstSeen
            const stmt = this.db.prepare('UPDATE djs SET nickname = ? WHERE uuid = ?');
            return stmt.run(nickname, uuid);
        } else {
            // Insert with firstSeen as now
            const stmt = this.db.prepare('INSERT INTO djs (uuid, nickname) VALUES (?, ?)');
            return stmt.run(uuid, nickname);
        }
    }

    /**
     * Upsert a song
     */
    upsertSong({ songId, artistName, trackName, appleId, spotifyId, youtubeId }) {
        if (!this.initialized) throw new Error('DatabaseService not initialized');
        const stmt = this.db.prepare(`
            INSERT INTO songs (song_id, artist_name, track_name, apple_id, spotify_id, youtube_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(song_id) DO UPDATE SET
                artist_name=excluded.artist_name,
                track_name=excluded.track_name,
                apple_id=excluded.apple_id,
                spotify_id=excluded.spotify_id,
                youtube_id=excluded.youtube_id
        `);
        return stmt.run(songId, artistName, trackName, appleId, spotifyId, youtubeId);
    }

    /**
     * Record a song play
     */
    recordSongPlay({ songId, djUuid, likes = 0, dislikes = 0, stars = 0 }) {
        if (!this.initialized) throw new Error('DatabaseService not initialized');
        const stmt = this.db.prepare(`
            INSERT INTO songs_played (song_id, dj_uuid, likes, dislikes, stars)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(songId, djUuid, likes, dislikes, stars);
    }

    // ...existing code...

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