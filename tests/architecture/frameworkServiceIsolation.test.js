/**
 * Architecture test: Enforce that framework-specific services
 * (hangUserService, hangSocketServices, openchatApi) are only used
 * within adapters and never directly imported/required by central codebase.
 *
 * This test validates the architectural principle:
 * "All framework-specific operations must be accessed through platformActions
 * or other adapter-based abstractions, never directly."
 */

const fs = require( 'fs' );
const path = require( 'path' );

const FRAMEWORK_SPECIFIC_MODULES = [
    'hangUserService',
    'hangSocketServices',
    'openchatApi',
    'WavezFmApiAdapter',
    'HangFmApiAdapter'
];

const ADAPTER_DIRECTORIES = [
    'src/apiAdapters',
    'src/socketAdapters',
    'src/messagingAdapters'
];

// List of files that are allowed to import framework-specific modules
const ALLOWED_FILES = [
    // Adapter implementations and barrel exports - expected to have these
    'apiAdapters/index.js',                 // Barrel export for adapters
    'apiAdapters/HangFmApiAdapter.js',
    'apiAdapters/WavezFmApiAdapter.js',
    'socketAdapters/HangFmSocketAdapter.js',
    'socketAdapters/WavezFmSocketAdapter.js',
    'messagingAdapters/HangFmMessagingAdapter.js',
    'messagingAdapters/WavezFmMessagingAdapter.js',
    // Services that wrap adapters (internal adapter layer, not called by central code)
    'services/hangUserService.js',
    'services/hangSocketServices.js',
    'services/messageService.js',           // Wraps openchatApi and messaging adapters
    'services/groupMessageService.js',      // Wraps openchatApi
    'services/privateMessageService.js',    // Wraps openchatApi
    // Service container that registers all services
    'services/serviceContainer.js',
    // Tests can import these for mocking
    '../tests/services/hangUserService.test.js',
    '../tests/commands/handleChangebotnameCommand.test.js',
    '../tests/commands/handlePersonalityCommand.test.js',
    '../tests/services/tokenService.test.js',
    '../tests/lib/songAICommandHelper.test.js',
    '../tests/integration/commandFlow.test.js',
    '../tests/integration/startup.test.js',
    '../tests/lib/serviceContainer.test.js'
];

function getAllJsFiles ( dir ) {
    const results = [];

    function walk ( currentPath ) {
        const entries = fs.readdirSync( currentPath, { withFileTypes: true } );

        for ( const entry of entries ) {
            // Skip node_modules, coverage, and dot files
            if ( entry.name.startsWith( '.' ) || entry.name === 'node_modules' || entry.name === 'coverage' ) {
                continue;
            }

            const fullPath = path.join( currentPath, entry.name );
            const relativePath = path.relative( dir, fullPath );

            if ( entry.isDirectory() ) {
                walk( fullPath );
            } else if ( entry.name.endsWith( '.js' ) && !entry.name.endsWith( '.test.js' ) ) {
                results.push( relativePath );
            }
        }
    }

    walk( dir );
    return results;
}

function isInAdapterDirectory ( filePath ) {
    return ADAPTER_DIRECTORIES.some( adapterDir =>
        filePath.startsWith( adapterDir )
    );
}

function isAllowedFile ( filePath ) {
    return ALLOWED_FILES.some( allowed => filePath.endsWith( allowed ) );
}

function checkFileForFrameworkDependencies ( filePath, fileContent ) {
    const violations = [];

    for ( const frameworkModule of FRAMEWORK_SPECIFIC_MODULES ) {
        // Check for require statements
        const requirePattern = new RegExp( `require\\s*\\(\\s*['"]\\.?/?.*${ frameworkModule }`, 'g' );
        const requireMatches = fileContent.matchAll( requirePattern );
        for ( const match of requireMatches ) {
            violations.push( {
                module: frameworkModule,
                pattern: match[ 0 ]
            } );
        }

        // Check for import statements
        const importPattern = new RegExp( `from\\s+['"]\\.?/?.*${ frameworkModule }`, 'g' );
        const importMatches = fileContent.matchAll( importPattern );
        for ( const match of importMatches ) {
            violations.push( {
                module: frameworkModule,
                pattern: match[ 0 ]
            } );
        }
    }

    return violations;
}

describe( 'Architecture: Framework Service Isolation', () => {
    it( 'should prevent direct imports of hangUserService outside adapters', () => {
        const srcDir = path.join( __dirname, '../../src' );
        const files = getAllJsFiles( srcDir );

        const violations = [];

        for ( const filePath of files ) {
            const fullPath = path.join( srcDir, filePath );
            const fileContent = fs.readFileSync( fullPath, 'utf8' );

            const frameworkViolations = checkFileForFrameworkDependencies( filePath, fileContent );

            if ( frameworkViolations.length > 0 ) {
                // Check if this file is allowed
                if ( !isInAdapterDirectory( filePath ) && !isAllowedFile( filePath ) ) {
                    violations.push( {
                        file: filePath,
                        violations: frameworkViolations
                    } );
                }
            }
        }

        if ( violations.length > 0 ) {
            const message = violations
                .map( v => `\n  📄 ${ v.file }:\n${ v.violations.map( vv => `    - ${ vv.pattern }` ).join( '\n' ) }` )
                .join( '\n' );

            throw new Error(
                'Framework-specific services detected outside adapters:\n' +
                message +
                '\n\n💡 Solution: Route through platformActions or other adapter-based abstractions'
            );
        }
    } );

    it( 'should prevent direct imports of hangSocketServices outside adapters', () => {
        const srcDir = path.join( __dirname, '../../src' );
        const files = getAllJsFiles( srcDir );

        const violations = [];

        for ( const filePath of files ) {
            const fullPath = path.join( srcDir, filePath );
            const fileContent = fs.readFileSync( fullPath, 'utf8' );

            // Look for require/import statements of hangSocketServices
            const requirePattern = /require\s*\(\s*['"]\.?\/?\.*hangSocketServices/;
            const importPattern = /from\s+['"]\.?\/?\.*hangSocketServices/;

            if ( requirePattern.test( fileContent ) || importPattern.test( fileContent ) ) {
                // Check if this file is allowed (adapters or service definitions)
                if ( !isInAdapterDirectory( filePath ) && !isAllowedFile( filePath ) ) {
                    violations.push( filePath );
                }
            }
        }

        if ( violations.length > 0 ) {
            const message = violations.map( v => `  📄 ${ v }` ).join( '\n' );

            throw new Error(
                'Direct hangSocketServices imports detected outside adapters:\n' +
                message +
                '\n\n💡 Solution: Route through platformActions.removeFromDJQueue() or other platformActions methods'
            );
        }
    } );

    it( 'should ensure platformActions is the abstraction layer for all framework operations', () => {
        const platformActionsPath = path.join( __dirname, '../../src/services/platformActions.js' );
        const platformActionsContent = fs.readFileSync( platformActionsPath, 'utf8' );

        // Verify that platformActions methods exist for key operations
        const requiredMethods = [
            'voteOnTrack',
            'removeFromDJQueue',
            'skipTrack',
            'updateBotIdentity',
            'getUserProfile',
            'getPresentUsers',
            'getUserNicknameByUuid',
            'getChatAuthToken'
        ];

        const missingMethods = requiredMethods.filter( method =>
            !platformActionsContent.includes( `${ method } (` )
        );

        if ( missingMethods.length > 0 ) {
            throw new Error(
                `platformActions missing required abstraction methods:\n` +
                missingMethods.map( m => `  - ${ m }` ).join( '\n' )
            );
        }
    } );
} );
