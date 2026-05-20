const { logger } = require( '../lib/logging.js' );
const fs = require( 'fs' );
const path = require( 'path' );

class DocumentationService {
    constructor ( { versionService, services } ) {
        this.versionService = versionService;
        this.services = services;
    }

    /**
     * Generate HTML wrapper with common structure
     * @param {string} title - Page title
     * @param {string} content - HTML content to wrap
     * @returns {string} Complete HTML page
     */
    generateHtmlWrapper ( title, content ) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${ this.escapeHtml( title ) } - Mr. Roboto V3</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #e0e0e0;
            line-height: 1.6;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 100%;
            margin: 0 auto;
            background: rgba(30, 30, 46, 0.8);
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 {
            color: #00d9ff;
            margin-bottom: 20px;
            font-size: 2.5rem;
            text-shadow: 0 2px 4px rgba(0, 217, 255, 0.3);
        }
        h2 {
            color: #00aeff;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 1.8rem;
        }
        h3 {
            color: #66d9ff;
            margin-top: 20px;
            margin-bottom: 10px;
            font-size: 1.3rem;
        }
        p {
            margin-bottom: 15px;
        }
        a {
            color: #00d9ff;
            text-decoration: none;
            transition: color 0.2s;
        }
        a:hover {
            color: #66ffff;
            text-decoration: underline;
        }
        ul {
            margin-left: 30px;
            margin-bottom: 15px;
        }
        li {
            margin-bottom: 8px;
        }
        .nav {
            background: rgba(0, 0, 0, 0.3);
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .nav a {
            margin-right: 20px;
            font-weight: 500;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .info-card {
            background: rgba(0, 0, 0, 0.3);
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #00d9ff;
        }
        .info-card h3 {
            margin-top: 0;
            font-size: 1.1rem;
        }
        .info-card p {
            margin-bottom: 5px;
            color: #b0b0b0;
        }
        .version-badge {
            display: inline-block;
            background: #00d9ff;
            color: #1a1a2e;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9rem;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            text-align: center;
            color: #888;
            font-size: 0.9rem;
        }
        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }
            h1 {
                font-size: 2rem;
            }
            .nav a {
                display: block;
                margin: 10px 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <nav class="nav">
            <a href="/">Home</a>
            <a href="/status">Status</a>
            <a href="/commands">Commands</a>
            <a href="/chatcommands">Chat Commands</a>
            <a href="/stats">Statistics</a>
        </nav>
        ${ content }
        <div class="footer">
            <p>Mr. Roboto V3 - a Management Bot for hang.fm Hangouts</p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml ( text ) {
        if ( text === undefined || text === null ) {
            return '';
        }
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.toString().replace( /[&<>"']/g, m => map[ m ] );
    }

    /**
     * Generate landing page HTML
     * @returns {Promise<string>} HTML for landing page
     */
    async generateLandingPage () {
        try {
            const version = await this.versionService.getVersion();

            // Get state if stateService is initialized, otherwise use empty state
            let hangoutName = 'Not connected';
            let userCount = 0;
            let djCount = 0;

            if ( this.services.stateService ) {
                try {
                    hangoutName = this.services.stateService.getHangoutName();
                    const state = this.services.stateService._getCurrentState();
                    userCount = Object.keys( state.allUserData || {} ).length;
                    djCount = ( state.djs || [] ).length;
                } catch ( stateError ) {
                    logger.warn( `Could not get state: ${ stateError.message }` );
                }
            }

            const content = `
                <h1>Welcome to Mr. Roboto V3</h1>
                <p>
                    <span class="version-badge">${ this.escapeHtml( version.tag ) }</span>
                </p>
                
                <p>
                    Mr. Roboto V3 is a music bot for hang.fm rooms, providing automated DJ services,
                    chat commands, and room management features.
                </p>

                <h2>Current Status</h2>
                <div class="info-grid">
                    <div class="info-card">
                        <h3>Version Information</h3>
                        <p><strong>Version:</strong> ${ this.escapeHtml( version.version ) }</p>
                        <p><strong>Tag:</strong> ${ this.escapeHtml( version.tag ) }</p>
                        ${ version.buildDate ? `<p><strong>Built:</strong> ${ this.escapeHtml( new Date( version.buildDate ).toLocaleString() ) }</p>` : '' }
                        ${ version.gitCommit ? `<p><strong>Commit:</strong> ${ this.escapeHtml( version.gitCommit.substring( 0, 8 ) ) }</p>` : '' }
                    </div>
                    
                    <div class="info-card">
                        <h3>Hangout Information</h3>
                        <p><strong>Room:</strong> ${ this.escapeHtml( hangoutName ) }</p>
                        <p><strong>Users:</strong> ${ userCount }</p>
                        <p><strong>DJs:</strong> ${ djCount }</p>
                    </div>
                </div>

                <h2>Available Pages</h2>
                <ul>
                    <li><a href="/health">Health Check</a> - Simple health check endpoint</li>
                    <li><a href="/status">Bot Status</a> - Live bot and hangout information</li>
                    <li><a href="/chatcommands">Chat Commands</a> - User-friendly command guide with examples</li>
                    <li><a href="/commands">Commands Reference</a> - Technical command documentation</li>
                    <li><a href="/tokens">Token Reference</a> - Available tokens for messages and AI</li>
                    <li><a href="/personality">Personality</a> - Current bot personality configuration</li>
                    <li><a href="/stats">Statistics</a> - Song history and DJ statistics</li>
                </ul>

                <h2>About This Bot</h2>
                <p>
                    Mr. Roboto V3 is built with Node.js and runs in a Docker container.
                    It connects to hang.fm rooms via WebSocket and provides various features including:
                </p>
                <ul>
                    <li>Song introductions and announcements using customisable "AI" Personalities</li>
                    <li>Chat commands for users, moderators, and owners</li>
                    <li>Song history tracking and statistics</li>
                    <li>Personalised user welcome messages and image posting</li>
                </ul>
                <p>
                    <strong>Source Code:</strong> <a href="https://github.com/jodrell2000/mrRobotoV3" target="_blank">github.com/jodrell2000/mrRobotoV3</a>
                </p>
            `;

            return this.generateHtmlWrapper( 'Home', content );
        } catch ( error ) {
            logger.error( `Failed to generate landing page: ${ error.message }` );
            const errorContent = `
                <h1>Error</h1>
                <p>Failed to load bot information. Please try again later.</p>
            `;
            return this.generateHtmlWrapper( 'Error', errorContent );
        }
    }

    /**
     * Generate chat commands documentation HTML and write to file
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async rebuildChatDocumentation () {
        try {
            const chatPath = path.join( __dirname, '../../data/chat.json' );
            const aliasesPath = path.join( __dirname, '../../data/aliases.json' );
            const outputPath = path.join( __dirname, '../../html/chat.html' );

            // Ensure html directory exists
            const htmlDir = path.dirname( outputPath );
            if ( !fs.existsSync( htmlDir ) ) {
                fs.mkdirSync( htmlDir, { recursive: true } );
            }

            // Read chat.json
            let chatData = {};
            if ( fs.existsSync( chatPath ) ) {
                const chatDataRaw = fs.readFileSync( chatPath, 'utf8' );
                chatData = JSON.parse( chatDataRaw );
            } else {
                logger.warn( 'chat.json not found, generating empty documentation' );
            }

            // Read aliases.json
            let aliasesData = {};
            if ( fs.existsSync( aliasesPath ) ) {
                const aliasesDataRaw = fs.readFileSync( aliasesPath, 'utf8' );
                aliasesData = JSON.parse( aliasesDataRaw );
            }

            // Build reverse alias map (command -> array of aliases)
            const commandAliases = {};
            for ( const [ alias, data ] of Object.entries( aliasesData ) ) {
                const targetCommand = data.command;
                if ( !commandAliases[ targetCommand ] ) {
                    commandAliases[ targetCommand ] = [];
                }
                commandAliases[ targetCommand ].push( alias );
            }

            // Generate HTML
            const html = this._generateChatCommandsHTML( chatData, commandAliases );

            // Write to file
            fs.writeFileSync( outputPath, html, 'utf8' );

            const commandCount = Object.keys( chatData ).length;
            logger.info( `✅ Rebuilt chat documentation: ${ commandCount } commands written to ${ outputPath }` );

            return {
                success: true,
                message: `Generated documentation for ${ commandCount } commands`
            };
        } catch ( error ) {
            logger.error( `❌ Failed to rebuild chat documentation: ${ error.message }` );
            return {
                success: false,
                message: `Failed to rebuild documentation: ${ error.message }`
            };
        }
    }

    /**
     * Generate HTML for chat commands table
     * @private
     * @param {Object} chatData - Chat commands data
     * @param {Object} commandAliases - Map of command -> array of aliases
     * @returns {string} Complete HTML page
     */
    _generateChatCommandsHTML ( chatData, commandAliases ) {
        // Sort commands alphabetically
        const sortedCommands = Object.keys( chatData ).sort();

        // Generate table rows
        let tableRows = '';
        for ( const commandName of sortedCommands ) {
            const command = chatData[ commandName ];
            const aliases = commandAliases[ commandName ] || [];
            const messages = command.messages || [];
            const pictures = command.pictures || [];

            tableRows += this._generateCommandRow( commandName, aliases, messages, pictures );
        }

        const content = `
            <h1>Chat Commands</h1>
            <p>
                This page lists all available chat commands that Mr. Roboto can respond to.
                Commands are user-created and can include text messages and images.
            </p>
            <p>
                <strong>Total Commands:</strong> ${ sortedCommands.length }
            </p>

            <style>
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 8px;
                    overflow: hidden;
                }
                th {
                    background: rgba(0, 217, 255, 0.2);
                    color: #00d9ff;
                    padding: 15px;
                    text-align: left;
                    font-weight: 600;
                    border-bottom: 2px solid #00d9ff;
                }
                td {
                    padding: 12px 15px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                tr:hover {
                    background: rgba(0, 217, 255, 0.05);
                }
                .command-name {
                    color: #00d9ff;
                    font-weight: 600;
                    font-family: 'Courier New', monospace;
                }
                .aliases {
                    color: #b0b0b0;
                    font-style: italic;
                }
                .messages {
                    color: #e0e0e0;
                }
                .message-item {
                    margin: 5px 0;
                    padding-left: 10px;
                    border-left: 2px solid rgba(0, 217, 255, 0.3);
                }
                .images-cell {
                    text-align: center;
                }
                .image-toggle-btn {
                    background: #00d9ff;
                    color: #1a1a2e;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .image-toggle-btn:hover {
                    background: #66ffff;
                    transform: translateY(-2px);
                }
                .images-container {
                    display: none;
                    margin-top: 10px;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .images-container.visible {
                    display: flex;
                }
                .image-item {
                    flex: 0 0 auto;
                }
                .image-item img {
                    width: 100px;
                    height: auto;
                    border-radius: 5px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                }
                @media (max-width: 768px) {
                    table {
                        font-size: 0.9rem;
                    }
                    th, td {
                        padding: 10px;
                    }
                    .image-item img {
                        max-width: 100%;
                    }
                }
            </style>

            <table>
                <thead>
                    <tr>
                        <th>Command</th>
                        <th>Aliases</th>
                        <th>Messages</th>
                        <th>Images</th>
                    </tr>
                </thead>
                <tbody>
                    ${ tableRows }
                </tbody>
            </table>

            <script>
                function toggleImages(commandName) {
                    const container = document.getElementById('images-' + commandName);
                    const btn = document.getElementById('btn-' + commandName);
                    if (container.classList.contains('visible')) {
                        container.classList.remove('visible');
                        btn.textContent = 'Show Images';
                    } else {
                        container.classList.add('visible');
                        btn.textContent = 'Hide Images';
                    }
                }
            </script>
        `;

        return this.generateHtmlWrapper( 'Chat Commands', content );
    }

    /**
     * Generate a single table row for a command
     * @private
     * @param {string} commandName - Name of the command
     * @param {Array<string>} aliases - Array of alias names
     * @param {Array<string>} messages - Array of message templates
     * @param {Array<string>} pictures - Array of image URLs
     * @returns {string} HTML table row
     */
    _generateCommandRow ( commandName, aliases, messages, pictures ) {
        const escapedCommandName = this.escapeHtml( commandName );
        const safeCommandId = commandName.replace( /[^a-zA-Z0-9]/g, '_' );

        // Generate aliases cell
        let aliasesHtml = '';
        if ( aliases.length > 0 ) {
            aliasesHtml = `<span class="aliases">${ aliases.map( a => this.escapeHtml( a ) ).join( ', ' ) }</span>`;
        } else {
            aliasesHtml = '<span class="aliases">none</span>';
        }

        // Generate messages cell
        let messagesHtml = '';
        if ( messages.length > 0 ) {
            messagesHtml = messages.map( msg =>
                `<div class="message-item">${ this.escapeHtml( msg ) }</div>`
            ).join( '' );
        } else {
            messagesHtml = '<span class="aliases">none</span>';
        }

        // Generate images cell
        let imagesHtml = '';
        if ( pictures.length > 0 ) {
            const imagesContent = pictures.map( url =>
                `<div class="image-item"><img src="${ this.escapeHtml( url ) }" alt="Command image" loading="lazy"></div>`
            ).join( '' );

            imagesHtml = `
                <button class="image-toggle-btn" id="btn-${ safeCommandId }" onclick="toggleImages('${ safeCommandId }')">
                    Show Images (${ pictures.length })
                </button>
                <div class="images-container" id="images-${ safeCommandId }">
                    ${ imagesContent }
                </div>
            `;
        } else {
            imagesHtml = '<span class="aliases">none</span>';
        }

        return `
            <tr>
                <td><span class="command-name">${ escapedCommandName }</span></td>
                <td>${ aliasesHtml }</td>
                <td class="messages">${ messagesHtml }</td>
                <td class="images-cell">${ imagesHtml }</td>
            </tr>
        `;
    }

    /**
     * Check if a command is disabled in botConfig.json
     * @private
     * @param {string} commandName - The command name to check
     * @returns {boolean} True if command is disabled, false if enabled
     */
    _isCommandDisabled ( commandName ) {
        try {
            const dataPath = path.join( __dirname, '../../data/botConfig.json' );
            const data = JSON.parse( fs.readFileSync( dataPath, 'utf8' ) );
            return Array.isArray( data.disabledCommands ) && data.disabledCommands.includes( commandName );
        } catch ( error ) {
            return false; // Default to enabled if we can't read the file
        }
    }

    /**
     * Discover all commands from file system with their metadata
     * @private
     * @returns {Object} Commands organized by folder/category
     */
    _discoverCommands () {
        const commandsByFolder = {};
        const baseDir = path.join( __dirname, '../commands' );

        // Define static folder structure (matching help command)
        const folders = [
            { path: 'Bot Commands', name: 'Bot Commands' },
            { path: 'Debug Commands', name: 'Debug Commands' },
            { path: 'Edit Commands', name: 'Edit Commands' },
            { path: 'General Commands', name: 'General Commands' },
            { path: 'ML Commands', name: 'ML Commands' },
            { path: 'Moderator Commands', name: 'Moderator Commands' },
            { path: 'System Admin', name: 'System Admin' }
        ];

        // Helper function to load commands from a directory
        const loadFromDirectory = ( dirPath, folderName ) => {
            let items;
            try {
                items = fs.readdirSync( dirPath );
            } catch ( error ) {
                return; // Skip directories that can't be accessed
            }

            items.forEach( item => {
                if ( item.endsWith( '.js' ) ) {
                    // Extract command name from filename: handleStateCommand.js -> state
                    const match = item.match( /^handle(.*)Command\.js$/ );
                    if ( match && match[ 1 ] ) {
                        const commandName = match[ 1 ].toLowerCase();

                        try {
                            const commandModule = require( path.join( dirPath, item ) );

                            // Include all commands with metadata (even hidden ones for documentation)
                            // but mark them as hidden
                            if ( commandModule.requiredRole && commandModule.description ) {
                                const isDisabled = this._isCommandDisabled( commandName );
                                const isHidden = commandModule.hidden || false;

                                if ( !commandsByFolder[ folderName ] ) {
                                    commandsByFolder[ folderName ] = [];
                                }

                                commandsByFolder[ folderName ].push( {
                                    name: commandName,
                                    role: commandModule.requiredRole,
                                    description: commandModule.description,
                                    example: commandModule.example || commandName,
                                    hidden: isHidden,
                                    disabled: isDisabled
                                } );
                            }
                        } catch ( error ) {
                            logger.warn( `Failed to load command ${ commandName }: ${ error.message }` );
                        }
                    }
                }
            } );
        };

        // Load commands from each folder
        folders.forEach( folder => {
            const folderPath = path.join( baseDir, folder.path );
            loadFromDirectory( folderPath, folder.name );
        } );

        // Note: Root directory commands (handleChatCommand.js, handleUnknownCommand.js) are
        // internal handlers and should not appear in documentation

        // Sort commands within each folder alphabetically
        Object.keys( commandsByFolder ).forEach( folder => {
            commandsByFolder[ folder ].sort( ( a, b ) => a.name.localeCompare( b.name ) );
        } );

        return commandsByFolder;
    }

    /**
     * Generate commands reference documentation HTML and write to file
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async rebuildCommandsDocumentation () {
        try {
            const outputPath = path.join( __dirname, '../../html/commands.html' );

            // Ensure html directory exists
            const htmlDir = path.dirname( outputPath );
            if ( !fs.existsSync( htmlDir ) ) {
                fs.mkdirSync( htmlDir, { recursive: true } );
            }

            // Discover all commands
            const commandsByFolder = this._discoverCommands();

            // Count total commands
            let totalCommands = 0;
            Object.values( commandsByFolder ).forEach( commands => {
                totalCommands += commands.length;
            } );

            // Generate HTML
            const html = this._generateCommandsHTML( commandsByFolder, totalCommands );

            // Write to file
            fs.writeFileSync( outputPath, html, 'utf8' );

            logger.info( `✅ Rebuilt commands documentation: ${ totalCommands } commands written to ${ outputPath }` );

            return {
                success: true,
                message: `Generated documentation for ${ totalCommands } commands`
            };
        } catch ( error ) {
            logger.error( `❌ Failed to rebuild commands documentation: ${ error.message }` );
            return {
                success: false,
                message: `Failed to rebuild documentation: ${ error.message }`
            };
        }
    }

    /**
     * Generate HTML for commands reference page
     * @private
     * @param {Object} commandsByFolder - Commands organized by folder
     * @param {number} totalCommands - Total number of commands
     * @returns {string} Complete HTML page
     */
    _generateCommandsHTML ( commandsByFolder, totalCommands ) {
        // Generate category sections
        let categorySections = '';
        const sortedFolders = Object.keys( commandsByFolder ).sort();

        for ( const folder of sortedFolders ) {
            const commands = commandsByFolder[ folder ];
            if ( commands.length === 0 ) continue;

            let commandRows = '';
            for ( const cmd of commands ) {
                const statusBadges = [];
                if ( cmd.hidden ) statusBadges.push( '<span class="badge badge-hidden">Hidden</span>' );
                if ( cmd.disabled ) statusBadges.push( '<span class="badge badge-disabled">Disabled</span>' );

                const roleBadgeClass = {
                    'USER': 'role-user',
                    'MODERATOR': 'role-moderator',
                    'OWNER': 'role-owner'
                }[ cmd.role ] || 'role-user';

                commandRows += `
                    <tr data-command="${ this.escapeHtml( cmd.name ) }" data-category="${ this.escapeHtml( folder ) }">
                        <td><span class="command-name">${ this.escapeHtml( cmd.name ) }</span></td>
                        <td><span class="role-badge ${ roleBadgeClass }">${ this.escapeHtml( cmd.role ) }</span></td>
                        <td>${ this.escapeHtml( cmd.description ) }</td>
                        <td><code class="example">${ this.escapeHtml( cmd.example ) }</code></td>
                        <td>${ statusBadges.join( ' ' ) }</td>
                    </tr>
                `;
            }

            categorySections += `
                <div class="category-section">
                    <h2 class="category-title">${ this.escapeHtml( folder ) } (${ commands.length })</h2>
                    <table class="commands-table">
                        <thead>
                            <tr>
                                <th>Command</th>
                                <th>Permission Required</th>
                                <th>Description</th>
                                <th>Example</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ commandRows }
                        </tbody>
                    </table>
                </div>
            `;
        }

        const content = `
            <h1>Commands Reference</h1>
            <p>
                This page lists all available bot commands with their usage, required permissions, and examples.
                Use the search box below to filter commands by name, description, or category.
            </p>
            <p>
                <strong>Total Commands:</strong> ${ totalCommands }
            </p>

            <div class="search-container">
                <input type="text" id="commandSearch" placeholder="Search commands..." class="search-input">
                <div id="searchResults" class="search-results"></div>
            </div>

            <style>
                .category-section {
                    margin: 30px 0;
                }
                .category-title {
                    color: #00d9ff;
                    font-size: 1.5rem;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid rgba(0, 217, 255, 0.3);
                }
                .commands-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 8px;
                    overflow: hidden;
                }
                .commands-table th {
                    background: rgba(0, 217, 255, 0.2);
                    color: #00d9ff;
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                    border-bottom: 2px solid #00d9ff;
                }
                .commands-table td {
                    padding: 10px 12px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                .commands-table tr:hover {
                    background: rgba(0, 217, 255, 0.05);
                }
                .commands-table tr.hidden {
                    display: none;
                }
                .command-name {
                    color: #00d9ff;
                    font-weight: 600;
                    font-family: 'Courier New', monospace;
                }
                .role-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .role-user {
                    background: rgba(76, 175, 80, 0.3);
                    color: #4caf50;
                }
                .role-moderator {
                    background: rgba(255, 152, 0, 0.3);
                    color: #ff9800;
                }
                .role-owner {
                    background: rgba(244, 67, 54, 0.3);
                    color: #f44336;
                }
                .example {
                    background: rgba(0, 0, 0, 0.4);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-family: 'Courier New', monospace;
                    color: #00ff00;
                }
                .badge {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    margin-left: 5px;
                }
                .badge-hidden {
                    background: rgba(158, 158, 158, 0.3);
                    color: #9e9e9e;
                }
                .badge-disabled {
                    background: rgba(244, 67, 54, 0.3);
                    color: #f44336;
                }
                .search-container {
                    margin: 20px 0;
                }
                .search-input {
                    width: 100%;
                    max-width: 600px;
                    padding: 12px 20px;
                    font-size: 1rem;
                    background: rgba(0, 0, 0, 0.4);
                    border: 2px solid rgba(0, 217, 255, 0.3);
                    border-radius: 8px;
                    color: #e0e0e0;
                    outline: none;
                    transition: all 0.3s;
                }
                .search-input:focus {
                    border-color: #00d9ff;
                    box-shadow: 0 0 10px rgba(0, 217, 255, 0.3);
                }
                .search-results {
                    margin-top: 10px;
                    font-size: 0.9rem;
                    color: #b0b0b0;
                }
                @media (max-width: 768px) {
                    .commands-table {
                        font-size: 0.85rem;
                    }
                    .commands-table th,
                    .commands-table td {
                        padding: 8px;
                    }
                    .category-title {
                        font-size: 1.2rem;
                    }
                }
            </style>

            ${ categorySections }

            <script>
                const searchInput = document.getElementById('commandSearch');
                const searchResults = document.getElementById('searchResults');
                const allRows = document.querySelectorAll('.commands-table tr[data-command]');
                const allCategories = document.querySelectorAll('.category-section');

                searchInput.addEventListener('input', function() {
                    const searchTerm = this.value.toLowerCase().trim();
                    
                    if (searchTerm === '') {
                        // Show all commands and categories
                        allRows.forEach(row => row.classList.remove('hidden'));
                        allCategories.forEach(cat => cat.style.display = 'block');
                        searchResults.textContent = '';
                        return;
                    }

                    let visibleCount = 0;
                    const visibleCategories = new Set();

                    // Filter rows
                    allRows.forEach(row => {
                        const commandName = row.dataset.command;
                        const category = row.dataset.category;
                        const description = row.textContent.toLowerCase();

                        if (commandName.includes(searchTerm) || 
                            description.includes(searchTerm) ||
                            category.toLowerCase().includes(searchTerm)) {
                            row.classList.remove('hidden');
                            visibleCategories.add(category);
                            visibleCount++;
                        } else {
                            row.classList.add('hidden');
                        }
                    });

                    // Show/hide categories based on visible commands
                    allCategories.forEach(cat => {
                        const categoryTitle = cat.querySelector('.category-title').textContent;
                        const hasVisibleCommands = Array.from(visibleCategories).some(
                            vc => categoryTitle.includes(vc)
                        );
                        cat.style.display = hasVisibleCommands ? 'block' : 'none';
                    });

                    // Update results message
                    if (visibleCount === 0) {
                        searchResults.textContent = 'No commands found matching "' + searchTerm + '"';
                        searchResults.style.color = '#f44336';
                    } else {
                        searchResults.textContent = 'Found ' + visibleCount + ' command(s) matching "' + searchTerm + '"';
                        searchResults.style.color = '#4caf50';
                    }
                });
            </script>
        `;

        return this.generateHtmlWrapper( 'Commands Reference', content );
    }

    /**
     * Generate live status page with bot and hangout information
     * @returns {Promise<string>} HTML page
     */
    async generateStatusPage () {
        try {
            // Get version info
            const versionInfo = await this.versionService.getVersion();

            // Get bot uptime
            const uptimeSeconds = Math.floor( process.uptime() );
            const uptimeDays = Math.floor( uptimeSeconds / 86400 );
            const uptimeHours = Math.floor( ( uptimeSeconds % 86400 ) / 3600 );
            const uptimeMinutes = Math.floor( ( uptimeSeconds % 3600 ) / 60 );
            const uptimeFormatted = `${ uptimeDays }d ${ uptimeHours }h ${ uptimeMinutes }m`;

            // Get state from stateService
            const state = this.services.stateService?._getCurrentState?.() || {};
            const hangoutName = this.services.stateService?.getHangoutName?.() || 'Not connected';
            const botNickname = this.services.getState?.( 'botNickname' ) || 'Unknown';

            // Get user count
            const allUsers = state.allUserData || {};
            const userCount = Object.keys( allUsers ).length;

            // Get DJ list
            const djs = state.djs || [];
            const djList = djs.length > 0
                ? djs.map( dj => {
                    const userData = allUsers[ dj.uuid ];
                    return userData?.userProfile?.nickname || 'Unknown';
                } ).join( ', ' )
                : 'No DJs currently spinning';

            // Get current song from nowPlaying
            const nowPlaying = state.nowPlaying || {};
            const currentSong = nowPlaying.song || {};
            const songDisplay = currentSong.trackName
                ? `<strong>${ this.escapeHtml( currentSong.trackName ) }</strong> by ${ this.escapeHtml( currentSong.artistName || 'Unknown Artist' ) }`
                : 'No song currently playing';

            // Current DJ is the first DJ in the djs array
            const currentDj = djs.length > 0 ? djs[ 0 ] : null;
            const djNickname = currentDj && allUsers[ currentDj.uuid ]?.userProfile?.nickname
                ? this.escapeHtml( allUsers[ currentDj.uuid ].userProfile.nickname )
                : 'N/A';

            // Get vote counts
            const voteCounts = state.voteCounts || { likes: 0, dislikes: 0, stars: 0 };

            // Connection status
            const isConnected = hangoutName !== 'Not connected';
            const connectionStatus = isConnected
                ? '<span style="color: #4caf50;">● Connected</span>'
                : '<span style="color: #f44336;">● Disconnected</span>';

            const content = `
            <div class="status-grid">
                <div class="status-card">
                    <h2>🤖 Bot Information</h2>
                    <div class="info-row">
                        <span class="label">Status:</span>
                        <span class="value">${ connectionStatus }</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Bot Name:</span>
                        <span class="value">${ this.escapeHtml( botNickname ) }</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Version:</span>
                        <span class="value">${ this.escapeHtml( versionInfo.tag || versionInfo.version ) }</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Build Date:</span>
                        <span class="value">${ versionInfo.buildDate || 'N/A' }</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Git Commit:</span>
                        <span class="value"><code>${ versionInfo.gitCommit ? versionInfo.gitCommit.substring( 0, 7 ) : 'N/A' }</code></span>
                    </div>
                    <div class="info-row">
                        <span class="label">Uptime:</span>
                        <span class="value">${ uptimeFormatted }</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Node.js:</span>
                        <span class="value">${ process.version }</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Platform:</span>
                        <span class="value">${ process.platform }</span>
                    </div>
                </div>

                <div class="status-card">
                    <h2>🎵 Hangout Information</h2>
                    <div class="info-row">
                        <span class="label">Hangout:</span>
                        <span class="value">${ this.escapeHtml( hangoutName ) }</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Users:</span>
                        <span class="value">${ userCount }</span>
                    </div>
                    <div class="info-row">
                        <span class="label">DJs:</span>
                        <span class="value">${ this.escapeHtml( djList ) }</span>
                    </div>
                </div>

                <div class="status-card">
                    <h2>🎧 Now Playing</h2>
                    <div class="info-row">
                        <span class="label">Track:</span>
                        <span class="value">${ songDisplay }</span>
                    </div>
                    <div class="info-row">
                        <span class="label">DJ:</span>
                        <span class="value">${ djNickname }</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Votes:</span>
                        <span class="value">
                            <span style="color: #4caf50;">👍 ${ voteCounts.likes }</span>
                            <span style="color: #f44336; margin-left: 15px;">👎 ${ voteCounts.dislikes }</span>
                            <span style="color: #ffeb3b; margin-left: 15px;">⭐ ${ voteCounts.stars }</span>
                        </span>
                    </div>
                </div>
            </div>

            <style>
                .status-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }
                .status-card {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 20px;
                }
                .status-card h2 {
                    margin-bottom: 20px;
                    color: #64b5f6;
                    font-size: 1.2em;
                    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
                    padding-bottom: 10px;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .info-row:last-child {
                    border-bottom: none;
                }
                .info-row .label {
                    color: #9e9e9e;
                    font-weight: 500;
                }
                .info-row .value {
                    color: #e0e0e0;
                    font-weight: 400;
                    text-align: right;
                }
                .info-row code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 0.9em;
                }
            </style>
        `;

            return this.generateHtmlWrapper( 'Bot Status', content );
        } catch ( error ) {
            logger.error( `Error generating status page: ${ error.message }` );
            return this.generateHtmlWrapper( 'Error', '<p>Failed to generate status page</p>' );
        }
    }

    /**
     * Generate tokens reference page
     * @returns {Promise<string>} HTML page
     */
    async generateTokensPage () {
        try {
            const tokenService = this.services.tokenService;

            if ( !tokenService ) {
                return this.generateHtmlWrapper( 'Tokens', '<p>Token service not available</p>' );
            }

            const tokenList = await tokenService.getTokenList();

            const builtInTokens = tokenList.filter( t => t.type === 'built-in' );
            const customTokens = tokenList.filter( t => t.type === 'custom' );

            let content = `
            <div class="tokens-container">
                <div class="intro">
                    <p>Tokens are dynamic placeholders that can be used in messages, AI instructions, and chat commands.</p>
                    <p>They are automatically replaced with their corresponding values when used.</p>
                </div>
            `;

            // Built-in tokens section
            if ( builtInTokens.length > 0 ) {
                content += `
                <div class="token-section">
                    <h2>🔧 Built-in Tokens (${ builtInTokens.length })</h2>
                    <div class="token-grid">
                `;

                builtInTokens.forEach( token => {
                    content += `
                        <div class="token-card">
                            <div class="token-name"><code>${ this.escapeHtml( token.name ) }</code></div>
                            <div class="token-description">${ this.escapeHtml( token.description ) }</div>
                        </div>
                    `;
                } );

                content += `
                    </div>
                </div>
                `;
            }

            // Custom tokens section
            if ( customTokens.length > 0 ) {
                content += `
                <div class="token-section">
                    <h2>✨ Custom Tokens (${ customTokens.length })</h2>
                    <div class="token-grid">
                `;

                customTokens.forEach( token => {
                    content += `
                        <div class="token-card custom">
                            <div class="token-name"><code>${ this.escapeHtml( token.name ) }</code></div>
                            <div class="token-description">${ this.escapeHtml( token.description ) }</div>
                            ${ token.createdAt ? `<div class="token-meta">Created: ${ new Date( token.createdAt ).toLocaleDateString() }</div>` : '' }
                        </div>
                    `;
                } );

                content += `
                    </div>
                </div>
                `;
            } else {
                content += `
                <div class="token-section">
                    <h2>✨ Custom Tokens</h2>
                    <p class="empty-state">No custom tokens defined yet. Use <code>!token add</code> to create one.</p>
                </div>
                `;
            }

            content += `
                <div class="usage-section">
                    <h2>💡 Usage Examples</h2>
                    <div class="example-card">
                        <div class="example-title">In Chat Commands:</div>
                        <code>Welcome to {hangoutName}, {senderUsername}!</code>
                    </div>
                    <div class="example-card">
                        <div class="example-title">In AI Instructions:</div>
                        <code>You are {botName}, a DJ bot in {hangoutName}. Current time: {currentTime}</code>
                    </div>
                </div>
            </div>

            <style>
                .tokens-container {
                    max-width: 1200px;
                }
                .intro {
                    background: rgba(100, 181, 246, 0.1);
                    border-left: 4px solid #64b5f6;
                    padding: 15px 20px;
                    margin-bottom: 30px;
                    border-radius: 4px;
                }
                .intro p {
                    margin: 5px 0;
                }
                .token-section {
                    margin-bottom: 40px;
                }
                .token-section h2 {
                    color: #64b5f6;
                    margin-bottom: 20px;
                    font-size: 1.5em;
                }
                .token-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 15px;
                }
                .token-card {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-left: 4px solid #4caf50;
                    padding: 15px;
                    border-radius: 4px;
                }
                .token-card.custom {
                    border-left-color: #ff9800;
                }
                .token-name {
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                .token-name code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 1em;
                    color: #64b5f6;
                }
                .token-description {
                    color: #b0b0b0;
                    font-size: 0.9em;
                    line-height: 1.5;
                }
                .token-meta {
                    color: #808080;
                    font-size: 0.8em;
                    margin-top: 8px;
                    font-style: italic;
                }
                .usage-section {
                    margin-top: 40px;
                    padding-top: 40px;
                    border-top: 2px solid rgba(255, 255, 255, 0.1);
                }
                .usage-section h2 {
                    color: #64b5f6;
                    margin-bottom: 20px;
                    font-size: 1.5em;
                }
                .example-card {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 15px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                }
                .example-title {
                    color: #9e9e9e;
                    font-size: 0.9em;
                    margin-bottom: 8px;
                    font-weight: 500;
                }
                .example-card code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 8px 12px;
                    border-radius: 4px;
                    display: block;
                    color: #e0e0e0;
                    font-size: 0.95em;
                    overflow-x: auto;
                }
                .empty-state {
                    color: #808080;
                    font-style: italic;
                    padding: 20px;
                    text-align: center;
                }
                .empty-state code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 2px 6px;
                    border-radius: 4px;
                }
            </style>
        `;

            return this.generateHtmlWrapper( 'Token Reference', content );
        } catch ( error ) {
            logger.error( `Error generating tokens page: ${ error.message }` );
            return this.generateHtmlWrapper( 'Error', '<p>Failed to generate tokens page</p>' );
        }
    }

    /**
     * Generate personality configuration page
     * @returns {Promise<string>} HTML page
     */
    async generatePersonalityPage () {
        try {
            const dataService = this.services.dataService;
            const databaseService = this.services.databaseService;

            if ( !dataService ) {
                return this.generateHtmlWrapper( 'Personality', '<p>Data service not available</p>' );
            }

            await dataService.loadData();

            const instructions = dataService.getValue( 'Instructions' ) || {};
            const mlPersonality = instructions.MLPersonality || 'No personality configured';
            const mlInstructions = instructions.MLInstructions || 'No instructions configured';
            const configuration = dataService.getValue( 'configuration' ) || {};
            const botNickname = this.services.getState?.( 'botNickname' ) || 'Unknown';
            const activePersonality = dataService.getValue( 'activePersonality' ) || null;

            // Get available personalities from database
            let personalitiesHTML = '<p style="color: #888;">Database not available</p>';
            if ( databaseService && databaseService.initialized ) {
                try {
                    const personalities = await databaseService.getAllPersonalities();
                    if ( personalities.length > 0 ) {
                        personalitiesHTML = personalities.map( p => {
                            const isActive = activePersonality && p.name.toLowerCase() === activePersonality.toLowerCase();
                            const badge = isActive ? '<span class="active-badge">ACTIVE</span>' : '';
                            const date = new Date( p.created_at ).toLocaleDateString( 'en-GB' );
                            return `
                                <div class="personality-item ${ isActive ? 'active-personality' : '' }">
                                    <div class="personality-header">
                                        <strong>${ this.escapeHtml( p.name ) }</strong>
                                        ${ badge }
                                    </div>
                                    <div class="personality-desc">${ this.escapeHtml( p.description ) }</div>
                                    <div class="personality-date">Created: ${ date }</div>
                                </div>
                            `;
                        } ).join( '' );
                    } else {
                        personalitiesHTML = '<p style="color: #888;">No saved personalities yet</p>';
                    }
                } catch ( error ) {
                    personalitiesHTML = '<p style="color: #f44336;">Error loading personalities</p>';
                }
            }

            const content = `
            <div class="personality-layout">
                <div class="personality-main">
                    <div class="intro">
                        <p>This page displays the current AI personality configuration for the bot.</p>
                        <p>These settings control how the bot behaves and responds to users.</p>
                    </div>

                    <div class="personality-section">
                        <h2>🤖 Bot Identity</h2>
                        <div class="config-card">
                            <div class="config-row">
                                <span class="label">Bot Name:</span>
                                <span class="value">${ this.escapeHtml( botNickname ) }</span>
                            </div>
                            ${ activePersonality ? `
                            <div class="config-row">
                                <span class="label">Active Personality:</span>
                                <span class="value">${ this.escapeHtml( activePersonality ) }</span>
                            </div>
                            ` : '' }
                            <div class="config-row">
                                <span class="label">Timezone:</span>
                                <span class="value">${ this.escapeHtml( configuration.timezone || 'Europe/London' ) }</span>
                            </div>
                            <div class="config-row">
                                <span class="label">Locale:</span>
                                <span class="value">${ this.escapeHtml( configuration.locale || 'en-GB' ) }</span>
                            </div>
                            <div class="config-row">
                                <span class="label">Date Format:</span>
                                <span class="value">${ this.escapeHtml( configuration.dateFormat || 'DD/MM/YYYY' ) }</span>
                            </div>
                            <div class="config-row">
                                <span class="label">Time Format:</span>
                                <span class="value">${ this.escapeHtml( configuration.timeFormat || '24' ) }-hour</span>
                            </div>
                        </div>
                    </div>

                    <div class="personality-section">
                        <h2>💭 AI Personality</h2>
                        <div class="instructions-card">
                            <pre>${ this.escapeHtml( mlPersonality ) }</pre>
                        </div>
                    </div>

                    <div class="personality-section">
                        <h2>📋 DJ Logic & Instructions</h2>
                        <div class="instructions-card">
                            <pre>${ this.escapeHtml( mlInstructions ) }</pre>
                        </div>
                    </div>
                </div>

                <div class="personality-sidebar">
                    <h2>💾 Saved Personalities</h2>
                    <div class="personalities-list">
                        ${ personalitiesHTML }
                    </div>
                </div>
            </div>

            <style>
                .personality-layout {
                    display: grid;
                    grid-template-columns: 1fr 350px;
                    gap: 30px;
                    max-width: 1400px;
                }
                .personality-main {
                    min-width: 0;
                }
                .personality-sidebar {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 20px;
                    max-height: 800px;
                    overflow-y: auto;
                }
                .personality-sidebar h2 {
                    color: #64b5f6;
                    margin-top: 0;
                    margin-bottom: 20px;
                    font-size: 1.3em;
                }
                .personalities-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .personality-item {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    padding: 12px;
                    transition: all 0.2s;
                }
                .personality-item:hover {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(100, 181, 246, 0.3);
                }
                .personality-item.active-personality {
                    border-color: #4caf50;
                    background: rgba(76, 175, 80, 0.1);
                }
                .personality-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                }
                .personality-header strong {
                    color: #e0e0e0;
                    font-size: 1.05em;
                }
                .active-badge {
                    background: #4caf50;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-size: 0.7em;
                    font-weight: bold;
                }
                .personality-desc {
                    color: #b0b0b0;
                    font-size: 0.9em;
                    line-height: 1.4;
                    margin-bottom: 4px;
                }
                .personality-date {
                    color: #666;
                    font-size: 0.75em;
                }
                .intro {
                    background: rgba(100, 181, 246, 0.1);
                    border-left: 4px solid #64b5f6;
                    padding: 15px 20px;
                    margin-bottom: 30px;
                    border-radius: 4px;
                }
                .intro p {
                    margin: 5px 0;
                }
                .personality-section {
                    margin-bottom: 40px;
                }
                .personality-section h2 {
                    color: #64b5f6;
                    margin-bottom: 20px;
                    font-size: 1.5em;
                }
                .config-card, .instructions-card {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 20px;
                }
                .config-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .config-row:last-child {
                    border-bottom: none;
                }
                .config-row .label {
                    color: #9e9e9e;
                    font-weight: 500;
                }
                .config-row .value {
                    color: #e0e0e0;
                    font-weight: 400;
                }
                pre {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 15px;
                    border-radius: 4px;
                    overflow-x: auto;
                    color: #e0e0e0;
                    line-height: 1.6;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                @media (max-width: 1024px) {
                    .personality-layout {
                        grid-template-columns: 1fr;
                    }
                    .personality-sidebar {
                        order: -1;
                        max-height: 400px;
                    }
                }
            </style>
        `;

            return this.generateHtmlWrapper( 'Personality Configuration', content );
        } catch ( error ) {
            logger.error( `Error generating personality page: ${ error.message }` );
            return this.generateHtmlWrapper( 'Error', '<p>Failed to generate personality page</p>' );
        }
    }

    /**
     * Generate database statistics page
     * @returns {Promise<string>} HTML page
     */
    async generateStatsPage () {
        try {
            const databaseService = this.services.databaseService;

            if ( !databaseService || !databaseService.initialized ) {
                return this.generateHtmlWrapper( 'Statistics', '<p>Database not initialized or not available</p>' );
            }

            // Get recent songs (last 10)
            const recentSongs = await databaseService.getRecentSongs( 10 );

            // Get top DJs (if method exists)
            let topDJs = [];
            if ( typeof databaseService.getTopDJs === 'function' ) {
                topDJs = await databaseService.getTopDJs( 10 );
            }

            // Get conversation count (if method exists)
            let conversationCount = 0;
            if ( typeof databaseService.getConversationCount === 'function' ) {
                conversationCount = await databaseService.getConversationCount();
            }

            let content = `
            <div class="stats-container">
                <div class="intro">
                    <p>Statistics and insights from the bot's database.</p>
                    <p>This data is collected and stored locally for analysis and reporting.</p>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number">${ recentSongs.length }</div>
                        <div class="stat-label">Recent Songs Tracked</div>
                    </div>
                    ${ topDJs.length > 0 ? `
                    <div class="stat-card">
                        <div class="stat-number">${ topDJs.length }</div>
                        <div class="stat-label">Active DJs</div>
                    </div>
                    ` : '' }
                    ${ conversationCount > 0 ? `
                    <div class="stat-card">
                        <div class="stat-number">${ conversationCount }</div>
                        <div class="stat-label">Conversations Logged</div>
                    </div>
                    ` : '' }
                </div>

                <div class="stats-section">
                    <h2>🎵 Recent Songs</h2>
                    ${ recentSongs.length > 0 ? `
                    <div class="songs-list">
                        ${ recentSongs.map( song => `
                        <div class="song-card">
                            <div class="song-info">
                                <div class="song-title">${ this.escapeHtml( song.track_name || 'Unknown Track' ) }</div>
                                <div class="song-artist">by ${ this.escapeHtml( song.artist_name || 'Unknown Artist' ) }</div>
                            </div>
                            <div class="song-meta">
                                <div class="dj-name">DJ: ${ this.escapeHtml( song.nickname || 'Unknown DJ' ) }</div>
                                <div class="song-votes">
                                    <span style="color: #4caf50;">👍 ${ song.likes || 0 }</span>
                                    <span style="color: #f44336;">👎 ${ song.dislikes || 0 }</span>
                                    <span style="color: #ffeb3b;">⭐ ${ song.stars || 0 }</span>
                                </div>
                            </div>
                        </div>
                        ` ).join( '' ) }
                    </div>
                    ` : '<p class="empty-state">No songs tracked yet</p>' }
                </div>

                ${ topDJs.length > 0 ? `
                <div class="stats-section">
                    <h2>👑 Top DJs</h2>
                    <div class="djs-list">
                        ${ topDJs.map( ( dj, index ) => `
                        <div class="dj-card">
                            <div class="dj-rank">#${ index + 1 }</div>
                            <div class="dj-info">
                                <div class="dj-nickname">${ this.escapeHtml( dj.nickname || 'Unknown DJ' ) }</div>
                                <div class="dj-stats">${ dj.playCount || 0 } songs played</div>
                            </div>
                        </div>
                        ` ).join( '' ) }
                    </div>
                </div>
                ` : '' }
            </div>

            <style>
                .stats-container {
                    max-width: 1200px;
                }
                .intro {
                    background: rgba(100, 181, 246, 0.1);
                    border-left: 4px solid #64b5f6;
                    padding: 15px 20px;
                    margin-bottom: 30px;
                    border-radius: 4px;
                }
                .intro p {
                    margin: 5px 0;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 40px;
                }
                .stat-card {
                    background: rgba(100, 181, 246, 0.1);
                    border: 1px solid rgba(100, 181, 246, 0.3);
                    border-radius: 8px;
                    padding: 30px 20px;
                    text-align: center;
                }
                .stat-number {
                    font-size: 3em;
                    font-weight: bold;
                    color: #64b5f6;
                    line-height: 1;
                }
                .stat-label {
                    color: #9e9e9e;
                    font-size: 0.9em;
                    margin-top: 10px;
                }
                .stats-section {
                    margin-bottom: 40px;
                }
                .stats-section h2 {
                    color: #64b5f6;
                    margin-bottom: 20px;
                    font-size: 1.5em;
                }
                .songs-list, .djs-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .song-card, .dj-card {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .song-info {
                    flex: 1;
                }
                .song-title {
                    font-weight: bold;
                    color: #e0e0e0;
                    font-size: 1.1em;
                }
                .song-artist {
                    color: #9e9e9e;
                    font-size: 0.9em;
                    margin-top: 4px;
                }
                .song-meta {
                    text-align: right;
                }
                .dj-name {
                    color: #64b5f6;
                    font-size: 0.9em;
                    margin-bottom: 4px;
                }
                .song-votes {
                    font-size: 0.9em;
                }
                .song-votes span {
                    margin-left: 10px;
                }
                .dj-card {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }
                .dj-rank {
                    font-size: 2em;
                    font-weight: bold;
                    color: #64b5f6;
                    min-width: 60px;
                    text-align: center;
                }
                .dj-info {
                    flex: 1;
                }
                .dj-nickname {
                    font-weight: bold;
                    color: #e0e0e0;
                    font-size: 1.1em;
                }
                .dj-stats {
                    color: #9e9e9e;
                    font-size: 0.9em;
                    margin-top: 4px;
                }
                .empty-state {
                    color: #808080;
                    font-style: italic;
                    padding: 40px 20px;
                    text-align: center;
                }
            </style>
        `;

            return this.generateHtmlWrapper( 'Statistics', content );
        } catch ( error ) {
            logger.error( `Error generating stats page: ${ error.message }` );
            return this.generateHtmlWrapper( 'Error', '<p>Failed to generate statistics page</p>' );
        }
    }
}

module.exports = DocumentationService;
