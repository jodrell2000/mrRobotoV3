---
description: "Guidelines for writing Node.js and JavaScript code within the Mr. Roboto V3 project"
applyTo: '**/*.js, **/*.mjs, **/*.cjs'
---

# Code Generation Guidelines

## General Guidelines
- Keep responses concise and focused - when summarizing changes, provide one brief paragraph instead of verbose details
- When implementing features, confirm understanding before proceeding if requirements are unclear

## Coding standards
- Always use CommonJS modules
- Use Node.js built-in modules and avoid external dependencies where possible
- Ask the user if you require any additional dependencies before adding them
- Always use async/await for asynchronous code, and use 'node:util' promisify function to avoid callbacks
- Keep the code simple and maintainable
- Use descriptive variable and function names
- Do not add comments unless absolutely necessary, the code should be self-explanatory
- Never use `null`, always use `undefined` for optional values
- Prefer functions over classes

## Testing
- Use jest for testing
- do not rely on debug comments in tests
- Write tests for all new features and bug fixes
- Ensure tests cover edge cases and error handling

## Documentation
- When adding new features (not bug fixes), always update the CHANGELOG's unreleased section and the README.md file where necessary
- Do not create documentation files for bug fixes or routine changes

## User interactions
- Ask questions if you are unsure about the implementation details, design choices, or need clarification on the requirements

# Service Guidelines
- all new services should be added to the serviceContainer

## Command Development Guidelines

### Command Structure
- All commands must follow the `handleXXXCommand.js` naming pattern in `src/commands/{folder}/`
- Commands are automatically discovered by the help system through filename parsing
- Command pathways are explicitly stored for the help command. If a new pathway is created the help command must be updated accordingly
- Each command must export required metadata: `requiredRole`, `description`, `example`, and `hidden`
- Use the standard command parameter object: `{command, args, services, context, responseChannel}`
- Always attach metadata to the exported function before module.exports

### Command Metadata Requirements
- `requiredRole`: Must be 'USER', 'MODERATOR', or 'OWNER'
- `description`: Keep under 50 characters, use present tense, be concise
- `example`: Show realistic usage without the command prefix (!), use meaningful placeholders
- `hidden`: Set to `true` for internal commands, `false` for user-facing commands

### Response Handling
- Always use `messageService.sendResponse()` for consistent channel routing
- Include proper response channel parameters: `responseChannel`, `isPrivateMessage`, `sender`, `services`
- Return standardized response object: `{success: boolean, shouldRespond: boolean, response: string, error?: string}`

## Data Management

### DataService Usage
- NEVER use direct file operations (`fs.writeFile`, `fs.readFile`) in commands
- Always use `dataService.setValue()` and `dataService.getValue()` for data persistence
- Use dot notation for nested keys: `'editableMessages.welcomeMessage'`
- Always call `dataService.loadData()` before reading data in commands

### StateService Usage
- **Access hangout state via `stateService._getCurrentState()`** - this is the primary way to get live hangout state
- StateService is initialized with hangout state and stores it as both internal state and through services.hangoutState
- The state contains: `allUserData` (user profiles by UUID), `voteCounts`, `currentSong`, `djs`, and other hangout properties
- `allUserData` has structure: `{ [uuid]: { userProfile: { nickname, id, uuid, ... }, position, songVotes }, ... }`
- Use `stateService.getUserRole(uuid)` to get a user's role instead of accessing raw state
- Use `stateService.getHangoutName()` to get the hangout name
- Use `stateService._getDjs()` to get the current DJ list
- When accessing hangout state from services that don't have direct stateService methods, use `services.stateService._getCurrentState()` to get live updates

### DatabaseService Usage
- **Use `services.databaseService` for historical data storage** - SQLite database for long-term data persistence
- DatabaseService handles: song play history, conversation logs, image validation cache
- **Record song plays**: `services.databaseService.recordSongPlay({ djUuid, djNickname, artistName, trackName, voteCounts })`
- **Query song history**: `services.databaseService.getRecentSongs(limit)`, `services.databaseService.getSongsByDJ(djUuid)`
- **Save conversations**: `services.databaseService.saveConversation({ messageId, userId, userName, messageText, timestamp })`
- **Always check initialization**: Database initializes asynchronously, check `services.databaseService.initialized` before use
- **Separation of concerns**: Use DataService for JSON config data, DatabaseService for historical records
- **Database file**: Stored at `./data/mrroboto.db`, persists across container restarts via Docker volumes

### Service Container Pattern
- All new services must be registered in `serviceContainer.js`
- Services should be accessed through the `services` parameter, never imported directly
- Use dependency injection pattern - services should accept required dependencies in constructor
- Maintain singleton pattern for stateful services

## Error Handling
- Use try/catch blocks for all async operations
- Log errors with appropriate level: `logger.error()` for failures, `logger.warn()` for recoverable issues
- Provide user-friendly error messages in command responses
- Handle edge cases: missing data, network failures, permission issues

## Testing Requirements

### Command Tests
- Include metadata tests: verify `requiredRole`, `description`, `example`, and `hidden` properties
- Test all argument validation scenarios
- Mock all external dependencies including `fs` operations
- Test both success and error paths
- Verify proper response channel handling (public vs private)

### Test Mocking Guidelines
- Always mock `fs` module to prevent real file operations during tests
- Mock `dataService` methods: `getValue`, `setValue`, `loadData`, `getAllData`
- Use proper jest mocking patterns: `jest.mock()` before require statements
- Reset mocks in `beforeEach()` to ensure test isolation

### File System Safety
- Commands must never perform direct file I/O operations
- Tests must mock all file system interactions to prevent data corruption
- Use `dataService` abstraction for all data persistence needs

## Code Organization

### Service Dependencies
- Services should declare dependencies explicitly in constructors
- Use composition over inheritance for service relationships
- Keep services focused on single responsibilities
- Maintain clear separation between data access and business logic

### State Management
- Use `serviceContainer.setState()` and `getState()` for shared state
- Initialize state properties with appropriate default values
- Document state structure and lifecycle in service comments
