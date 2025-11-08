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

## Current Work: Image Validation System

### Overview
The image validation system was implemented to identify and remove dead image links from chat commands. It runs as a background task (1 image per second) and can be controlled entirely via chat commands.

### Architecture
- **ValidationService** (`src/services/validationService.js`): Core validation logic
  - State: `{isValidating, currentIndex, allImages, results, startedAt, deadImages}`
  - Cache: Separate `data/image-validation-cache.json` file (NOT in chat.json)
  - Cache TTL: 30 days - images checked more recently are skipped
  - Validation method: HTTP HEAD requests via axios with 5-second timeout
  - Rate limiting: 1 image per second via background task

- **Command Handler** (`src/commands/handleImageValidatorCommand.js`): User interface
  - Requires MODERATOR role
  - Subcommands: `start`, `status`, `report`, `remove`
  - Usage: `!imageValidator [start|status|report|remove]`

- **Integration Points**:
  - `src/services/serviceContainer.js`: Registered as service dependency
  - `src/index.js`: Background task via `setInterval(1000)` calling `processNextImage()`
  - Loads cache on startup: `services.validationService.loadCache()`

### How It Works
1. User runs `!imageValidator start`
2. `startValidation()` extracts all images from `chat.json` (all commands' pictures arrays)
3. `getImagesToCheck()` filters images: returns only those NOT in cache OR expired (>30 days old)
4. If no images need checking, returns "All images were checked recently, nothing to validate"
5. Background task runs every second, calling `processNextImage()`
6. Each image checked via HTTP HEAD request, result stored in cache
7. Dead images (4xx, 5xx, timeout, network errors) tracked in `state.deadImages`
8. User can view progress with `!imageValidator status` or `!imageValidator report`
9. User can delete all dead images with `!imageValidator remove`

### Known Issues

#### Issue 1: First-Run "Nothing to Validate" Message
**Symptom**: On first run with no cache file, command returns "All images were checked recently, nothing to validate"

**Root Cause**: Under investigation. Theory: Either (a) cache is being pre-populated somewhere, or (b) `extractAllImages()` is returning empty array due to dataService not loading chat.json correctly

**Expected Behavior**: First run should extract all images from chat.json and begin validation

**Next Steps**: 
- Verify `dataService.getValue(null)` returns full chat.json data
- Check if cache file is being created before first validation attempt
- Add debug logging to trace data flow in `extractAllImages()` and `getImagesToCheck()`
- May need to modify startup logic to ensure dataService is fully initialized before loading cache

**Workaround**: None currently - feature blocked on first run

#### Issue 2: Unrelated Bug Found
A separate bug was discovered unrelated to the validation system. Details TBD.

### Testing
- **39 tests** created and passing (validationService: 24 tests, handleImageValidatorCommand: 15 tests)
- Test file paths:
  - `tests/services/validationService.test.js`
  - `tests/commands/handleImageValidatorCommand.test.js`
- All 852 tests passing in full suite

### Data Files
- **chat.json** (`data/chat.json`): 
  - Contains ~1,520 image URLs across 276 pictures arrays in various commands
  - Source of truth for all images to validate
  
- **image-validation-cache.json** (`data/image-validation-cache.json`): 
  - Created on first successful validation
  - Structure: `{ [imageUrl]: { lastChecked: timestamp, status: 'ok'|'dead', statusCode: number } }`
  - Persisted after each validation cycle
  - 30-day TTL controls re-checking frequency

```
