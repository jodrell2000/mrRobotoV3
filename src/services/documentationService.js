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
            <a href="/health">Health</a>
            <a href="/status">Status</a>
        </nav>
        ${ content }
        <div class="footer">
            <p>Mr. Roboto V3 - hang.fm Music Bot</p>
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
                    <li><a href="/status">Bot Status</a> - Detailed bot status and live information (coming soon)</li>
                    <li><a href="/commands">Commands Reference</a> - Technical command documentation (coming soon)</li>
                    <li><a href="/chatcommands">Chat Commands</a> - User-friendly command guide with examples (coming soon)</li>
                </ul>

                <h2>About This Bot</h2>
                <p>
                    Mr. Roboto V3 is built with Node.js and runs in a Docker container.
                    It connects to hang.fm rooms via WebSocket and provides various features including:
                </p>
                <ul>
                    <li>Automated DJ rotation and queue management</li>
                    <li>Chat commands for users, moderators, and owners</li>
                    <li>Song history tracking and statistics</li>
                    <li>Customizable bot personality</li>
                    <li>Welcome messages and image posting</li>
                </ul>
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
                    display: flex;
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
}

module.exports = DocumentationService;
