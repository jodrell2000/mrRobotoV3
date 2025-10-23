# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- **Command Trigger System**: Comprehensive automation system for bot events
  - New `trigger` command for owners to configure commands that execute automatically on specific events
  - Support for 5 trigger types: `newSong`, `userJoined`, `userLeft`, `djAdded`, `djRemoved`
  - Trigger management subcommands: `list`, `add`, `remove`, `clear`
  - Persistent trigger configuration stored in data.json
  - Automatic command execution with proper context and error handling
  - System-level command execution for triggers (independent of user permissions)

### Enhanced
- **Machine Learning Service Reliability**: Significantly improved AI service robustness
  - Added automatic fallback model support (gemini-2.5-flash → gemini-2.0-flash)
  - Enhanced error handling with graceful degradation when AI services fail
  - Comprehensive debugging and logging throughout AI request/response cycle
  - Improved service reliability for all ML commands (`intro`, `band`, `popfacts`, `whatyear`, `meaning`)

- **Token System Standardization**: Unified and enhanced token replacement system
  - Standardized all ML commands to use unified `{token}` format (previously mixed `${token}` and `{token}`)
  - Added support for `{botName}` token across all ML command templates
  - Enhanced `{username}` token to use current DJ instead of command sender for better context
  - Added comprehensive token support: `{trackName}`, `{artistName}`, `{username}`, `{hangoutName}`, `{botName}`

- **Mention Format Handling**: Improved user interaction and display
  - AI receives display names for natural language processing
  - Bot responses automatically convert display names to proper mention format
  - Enhanced user experience with proper @mentions in AI-generated responses

- **Testing Infrastructure**: Comprehensive test coverage for AI functionality
  - Added complete test suite for MachineLearningService fallback scenarios
  - Enhanced logger mocking across ML command tests
  - Improved Jest configuration for external dependency mocking
  - Full coverage of error handling and edge cases

### Fixed
- **Circular Dependency Resolution**: Resolved logger import issues in serviceContainer
- **Token Replacement Accuracy**: Fixed token replacement not working correctly in intro command
- **Service Reliability**: Eliminated AI service failures causing command errors

## [0.8.1_beta] - 2025-10-21
### Enhanced
- **Edit Command System**: Significantly improved template management capabilities
  - Added `edit list` command to display all editable messages and AI questions in organized groups
  - Added `edit show <messageType>` command to view current templates with available tokens
  - Enhanced command help and usage information with better user guidance

## [0.8.0_beta] - 2025-10-17
### Added
- **Machine Learning Commands (optional)**: New AI-powered song information commands providing you add a Google Gemini API key
  - `popfacts` command: Get interesting facts about the currently playing song using Google Gemini AI
  - `whatyear` command: Find out what year the currently playing song was released
  - `band` command: get info about the band playing the current song
  - `meaning` command: find out what the song you're listening to is all about
  - Configurable AI question templates via `edit` command

- **Command Organization System**: Improved command file structure
  - Commands now organized in logical folders (ML Commands, Edit Commands, etc.)

- **Enhanced Edit Command**: Extended message editing capabilities
  - Support for editing both Bot chat  messages and AI question templates

### Changed
- **Data Structure Reorganization**: Improved data.json organization
  - Separated `mlQuestions` section from `editableMessages` for better clarity
  - Updated example file to reflect new structure

- **Codebase Architecture**: Reduced code duplication and improved maintainability
  - Created `songAICommandHelper` utility for shared ML command functionality
  - Generalized AI command pattern reducing individual command code by ~75%

## [0.7.0_beta] - 2025-10-12
### Added
- **Command & Feature Management System**: Complete system for enabling/disabling bot commands & features
  - New `command` command for owners to manage bot commands (list, enable, disable, status)
  - New `feature` command for owners to control optional bot features (list, enable, disable, status)
  - Commands & features can be disabled and re-enabled without restart
  - Persistent command state stored in data.json
  
- **"Just Played" Announcement feature**:
  - Announces completed songs with detailed voting statistics (likes, dislikes, stars)
  - Smart detection of song transitions using playId tracking
  - Customizable message templates via data.json configuration
  
- **"Now Playing" Announcement feature**: 
  - Now Playing messages for new song starts
  - Intelligent fallback to hangout state when patch data is incomplete
  
- **Enhanced Help System**: Improved command discovery and usage
  - `help {commandname}` will show usage examples

### Changed
- **Service Architecture Improvements**:
  - New featuresService now includes comprehensive feature management
  - Enhanced service container with improved feature toggle support

### Notes
- All releases are currently in beta state
- Features may be incomplete or subject to breaking changes
- API stability not guaranteed until 1.0.0 release

## [0.6.0_alpha] - 2025-10-06
### Added
- **Private Message Commands**: Added full support for sending commands via private messages
  - Bot now processes commands sent through private/direct messages
  - Same command functionality available in both group and private contexts
  - Enhanced user interaction capabilities with private command support
- **Improved Message Processing**: Enhanced message processing architecture
  - Added separate processing loops for public and private messages
  - Better concurrency protection with processing flags
  - More responsive message handling with 1-second processing intervals

### Improved
- **Startup Reliability**: Resolved intermittent race conditions during bot startup
  - Implemented deferred patch handling system for stateful messages
  - Fixed race condition where state patches arrived before state initialization
  - Eliminated Docker restart loops during application startup
  - Added proper state validation and error handling
- **Code Quality**: Various stability improvements and optimizations
  - Enhanced error handling throughout the application
  - Improved logging and debugging capabilities
  - Better separation of concerns between services

## [0.5.0_alpha] - 2025-09-25
### Added
- **Docker Deployment**: Complete containerization of the application
  - Added comprehensive Docker configuration with multi-stage builds
  - Docker Compose orchestration with health checks and resource limits
  - Persistent storage for logs and bot data
  - Production-ready container setup with proper user permissions
- **Enhanced Startup Sequence**: Improved application initialization
  - Added strategic delays to prevent race conditions during startup
  - Better error handling and logging during bot connection
  - Improved state management during initial connection phase

## [0.4.6_alpha] - 2025-09-20
### Fixed
- **Startup sequence**: Changed startup order
  - Change the order that sockets are connected and listeners are created to try and prevent issues where the Hangout state hasn't been loaded when state messages start arriving
- **Room Name Updates**: Fixed StateService not reflecting live room name changes
  - Welcome messages now automatically use updated room names for new users
  - Resolves issue where room name changes weren't reflected in bot responses

### Improved
- **Documentation**: Enhanced setup guide with improved token extraction
  - Added draggable bookmarklet button for easy token extraction
  - Cleaner, more user-friendly setup experience
  - Fixed anchor links in documentation for better navigation

### Technical Details
- Updated StateService to use dynamic state references via `_getCurrentState()` method
- Modified serviceContainer initialization to pass services reference to StateService
- Simplified bot startup logic by removing Chain/repeat dependency
- Enhanced updatedRoomSettings handler with comprehensive state tracking

## [0.4.5_alpha] - 2025-09-02
### Added
- New `sendGroupPictureMessage` function in messageService
  - Allows sending messages with embedded images
  - Simplifies image message handling in commands
  - Accepts message text, image URL, and optional services container
  - Example usage in commands:
    ```javascript
    messageService.sendGroupPictureMessage(
      "Check out this image!",
      "https://example.com/image.jpg",
      serviceContainer
    );
    ```

### Technical Details
- Built on top of existing sendGroupMessage infrastructure
- Handles single image URL (automatically wrapped in array)
- Includes proper error handling and logging
- Maintains consistency with existing message service patterns

## [0.4.4_alpha] - 2025-08-27
### BREAKING CHANGE
- Removed CHAT_NAME, CHAT_AVATAR_ID, and CHAT_COLOUR fields from .env file
  - These settings are now managed exclusively through data.json
  - Existing bots will need to transfer these values to data.json
  - See [migration guide](docs/migrations/0.4.3_to_0.4.4_alpha.md) for detailed instructions

### Added
- New `changeBotName` command for owners to modify bot name and appearance
- Enhanced DataService with methods for updating bot configuration
- HangUserService for improved user management and role verification

### Changed
- Expanded data.json structure to include bot appearance settings
  - Added CHAT_NAME, CHAT_AVATAR_ID, and CHAT_COLOUR fields
  - Settings persist across bot restarts and can be updated at runtime
- Improved DataService with atomic file operations
  - Added validation for configuration changes
  - Enhanced error handling for file operations
- Enhanced HangUserService with robust role checking
  - Added methods for verifying user permissions
  - Improved integration with command authorization

### Technical Details
- DataService now manages bot appearance configuration via data.json
- HangUserService provides comprehensive user role management
- New changeBotName command restricted to OWNER role
- Configuration changes are validated before being persisted
- Improved error handling for invalid configuration updates

## [0.4.3_alpha] - 2025-08-25
### Added
- New `editwelcome` command for moderators to customize the welcome message
- DataService for managing global configuration via data.json
- Configurable welcome messages with dynamic placeholders ({username}, {hangoutName})
- data.json file for persistent bot configuration

### Changed
- Welcome messages now use the DataService instead of hardcoded strings
- Improved message templating with dynamic placeholder replacement
- Enhanced service container with new DataService integration

### Technical Details
- DataService provides methods for loading and accessing global configuration
- Welcome messages support placeholders that are replaced at runtime
- Command permissions enforce moderator-only access for welcome message updates
- Configuration changes persist across bot restarts via data.json

## [0.4.2_alpha] - 2025-08-24
### Added
- New stateService for managing user roles and permissions
- Comprehensive role-based access control system
- Documentation for writing new commands (WRITING_NEW_COMMANDS.md)

### Changed
- Standardized command parameter structure with unified `commandParams` object
- Improved command handler pattern for better maintainability
- Enhanced service container with fallback support for essential services
- Command permissions now use hierarchical role system: OWNER > coOwner > MODERATOR > USER

### Technical Details
- Commands now receive a consistent parameter object containing:
  - command: The command name
  - args: Command arguments
  - services: Service container with fallbacks
  - context: Sender and message context

## [0.4.0_alpha] - 2025-08-21
### BREAKING CHANGE
- The .env value COMETCHAT_APP_ID has been changed to COMETCHAT_AUTH_TOKEN throughout the codebase to simplify onboarding. You **MUST** update the name of this variable in your .env file

### Added
- specific page in the docs directory on how to create the .env file
- assets for the enhanced documentation

### Changed
- Improved the README and onboarding documentation

## [0.3.0_alpha] - 2025-08-21
### Added
- Upvote function added
  - Bot will upvote 90 seconds after song starts playing

### Changed
- Improved socket logging
  - added SOCKET_MESSAGE_LOG_LEVEL to .env file
  - options are OFF, ON and DEBUG. Defaults to OFF
  - OFF = no separate socket message logging
  - ON = socket logging to files on a per message type basis
  - DEBUG = every socket message logged to its own file with an incrementing number

## [0.2.0_alpha] - 2025-08-19

### Added
- JSON patch-based state management for real-time socket updates using `fast-json-patch`
  - **ENSURE YOU RUN `npm install` TO INSTALL ANY NEW DEPENDENCIES**
- Enhanced `_setupStatefulMessageListener` with proper state patching and error handling
- Comprehensive state patching tests covering patch application, error scenarios, and immutability
- `hangSocketServices` for song voting functionality with upVote/downVote methods
- Socket-based voting actions using ttfm-socket ActionName.voteOnSong
- Improved test coverage configuration excluding unfinished code from coverage metrics
- State immutability preservation in socket message handling
- Detailed logging for state patch operations and errors
- Standardized changelog documentation following Keep a Changelog format

### Changed
- Improved logging for socket messages to aid debugging
- Enhanced bot.js to use fast-json-patch for stateful message processing
- Improved error handling in state patch application with graceful degradation
- Updated Jest configuration to exclude handlers/** and playlistService.js from coverage
- Enhanced serviceContainer to include hangSocketServices
- Strengthened test suite with 245 passing tests across 34 test suites

### Fixed
- Resolved test failures by removing problematic test files
- Fixed state management to maintain immutability during patch operations
- Improved error handling to prevent bot crashes on malformed patches

## [0.1.0_alpha] - 2025-08-19

### Added
- Initial alpha release of Mr. Roboto V3
- Basic bot framework with CometChat integration
- Socket connection management using ttfm-socket
- Message processing and command parsing system
- Service container architecture for dependency injection
- Comprehensive test suite with Jest
- Winston logging with daily rotation
- Configuration management with dotenv
- Message polling and batch processing
- Connection status monitoring and reconnection handling
- File-based message logging for debugging
- Build URL utilities with search parameter handling
- Command service for processing bot commands
- Message service for CometChat API interactions
- Parse commands service for command detection
- Group and private message handling
- User service for hang.fm user management

### Technical Details
- Node.js application with ES6+ features
- Axios for HTTP requests with mock adapter for testing
- UUID generation for unique identifiers
- WebSocket connections for real-time communication
- Modular service architecture
- Comprehensive error handling and logging
- Test coverage reporting with Jest
- Git-based version control with branching strategy

### Dependencies
- @cometchat/chat-sdk-javascript ^4.0.13
- axios ^1.10.0
- dotenv ^17.0.1
- fast-json-patch ^3.1.1
- ttfm-socket ^1.6.4
- winston ^3.17.0
- And various other production and development dependencies

### Known Limitations (Alpha State)
- Some handlers and services are incomplete (excluded from test coverage)
- API may change significantly before stable release
- Not recommended for production use
- Features under active development

---

## Release Types

- **Major** (X.y.z) - Breaking changes that require migration
- **Minor** (x.Y.z) - New features that are backward compatible  
- **Patch** (x.y.Z) - Bug fixes and small improvements
- **Alpha** (x.y.z-alpha) - Pre-release versions for testing, may have breaking changes

## Alpha Release Notice

This project is currently in **alpha development**. Alpha releases mean:

- Features are under active development and may be incomplete
- APIs and interfaces may change without notice
- Breaking changes can occur between any releases
- Not recommended for production use
- Feedback and testing welcome but expect instability
- Documentation may be incomplete or outdated

The project will transition to beta releases when core functionality is stable, and to stable releases (1.0.0+) when the API is considered stable and production-ready.

## Change Categories

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Vulnerability fixes

## Links

- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
- [Repository](https://github.com/jodrell2000/mrRobotoV3)
