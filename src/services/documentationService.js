const { logger } = require( '../lib/logging.js' );

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
            max-width: 1200px;
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
            <p>Mr. Roboto V3 - TT.fm Music Bot</p>
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
            let state = {
                hangoutName: undefined,
                allUserData: {},
                djs: []
            };
            
            if ( this.services.stateService ) {
                try {
                    state = this.services.stateService._getCurrentState();
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
                    Mr. Roboto V3 is a music bot for TT.fm rooms, providing automated DJ services,
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
                        <p><strong>Room:</strong> ${ this.escapeHtml( state.hangoutName || 'Not connected' ) }</p>
                        <p><strong>Users:</strong> ${ Object.keys( state.allUserData || {} ).length }</p>
                        <p><strong>DJs:</strong> ${ ( state.djs || [] ).length }</p>
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
                    It connects to TT.fm rooms via WebSocket and provides various features including:
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
}

module.exports = DocumentationService;
