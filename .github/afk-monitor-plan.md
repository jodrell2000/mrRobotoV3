# AFK Monitor — Implementation Plan

Track user activity across the room and automatically warn/remove inactive DJs from the decks.

---

## Overview

- All users in the room are tracked (not just current DJs), because any user can join the decks at any time
- Activity signals: chat messages, snag/emoji reactions, joining/leaving the decks, joining/leaving the room
- Configurable warning and removal timeouts (stored via `dataService`)
- Controlled by the `afkMonitor` feature flag
- Voting and queue-change tracking are deferred (see notes at the end)

---

## Phase 1 — `afkService` (new service)

Create `src/services/afkService.js`.

### Responsibility
Maintain an in-memory activity map for every user currently in the room, and expose helper methods for the rest of the codebase to call.

### Internal state
```
activityMap: Map<uuid, {
  nickname: string,
  activity: {
    chat:        Date | undefined,   // chat message sent (command or non-command)
    emoji:       Date | undefined,   // snag or any emoji reaction
    joinedDecks: Date | undefined,   // joined the DJ decks
    leftDecks:   Date | undefined,   // left the DJ decks
    joinedRoom:  Date | undefined,   // joined the room
  },
  mostRecent:    Date | undefined,   // kept in sync — max of all activity timestamps
  warningLevel: 0 | 1 | 2 | 3,       // 0 = no warning sent; 1/2/3 = warnings sent so far; reset to 0 on any activity
}>
```

Activity types are defined as a constant so callers always use a valid key:
```js
const ACTIVITY_TYPES = {
  CHAT:         'chat',
  EMOJI:        'emoji',
  JOINED_DECKS: 'joinedDecks',
  LEFT_DECKS:   'leftDecks',
  JOINED_ROOM:  'joinedRoom',
};
```

### Methods
| Method | Signature | Purpose |
|---|---|---|
| `addUser` | `(uuid, nickname)` | Called when a user joins or is already in the room at bot start |
| `removeUser` | `(uuid)` | Called when a user leaves the room |
| `recordActivity` | `(uuid, activityType)` | Stamps `activity[activityType]` and updates `mostRecent` to `new Date()` for that UUID |
| `getInactiveUsers` | `(thresholdMs)` | Returns array of `{ uuid, nickname, inactiveMs, warningLevel }` for all users whose `mostRecent` exceeds threshold |
| `getActivitySnapshot` | `()` | Returns the full map as a plain array, including the per-type breakdown (for `!afkMonitor status`) |
| `clear` | `()` | Resets the map (for testing / reconnect scenarios) |

### Notes
- `addUser` should be idempotent — if the UUID already exists, update the nickname but leave all activity timestamps unchanged
- `recordActivity` is a no-op if the UUID is not in the map (user may have joined before the bot started)
- `mostRecent` is updated synchronously inside `recordActivity` — it is always `max(activity.*)` — no need to recompute on read
- `recordActivity` must also reset `warningLevel` to `0` on any activity
- No disk persistence; the map is rebuilt on reconnect from the current room state

### Register in `serviceContainer.js`
```js
const AfkService = require('./afkService.js');
// ...
const afkService = new AfkService();
// export alongside other services
```

---

## Phase 2 — Wire up activity signals

### 2a. `src/handlers/userJoined.js`
After the existing welcome-message logic, add:
```js
if (services.afkService) {
  services.afkService.addUser(userData.userProfile.uuid, userData.userProfile.nickname);
  services.afkService.recordActivity(userData.userProfile.uuid, 'joinedRoom');
}
```

### 2b. `src/handlers/userLeft.js`
After existing logic, add:
```js
if (services.afkService) {
  services.afkService.removeUser(/* uuid extracted from event */);
}
```
Check how the `userLeft` handler receives user data and extract the UUID the same way `userJoined` does.

### 2c. `src/lib/bot.js` — `_handleMessage()`
At the `// TODO: Add additional message handling logic here` comment (after command processing), add:
```js
if (sender && this.services.afkService) {
  this.services.afkService.recordActivity(sender, 'chat');
}
```
`sender` is already the UUID at this point (`message?.sender?.uid || message?.sender`). This covers both command and non-command chat messages.

### 2d. `src/handlers/playedOneTimeAnimation.js`
After existing logic (snag / emoji reactions), add:
```js
if (message.params?.userUuid && services.afkService) {
  services.afkService.recordActivity(message.params.userUuid, 'emoji');
}
```

### 2e. `src/handlers/addedDj.js` (currently a stub)
Replace body with:
```js
function addedDj( message, state, services ) {
  // UUID is in the add op for /djs/0
  const djPatch = message.statePatch?.find( p => p.op === 'add' && p.path === '/djs/0' );
  const uuid = djPatch?.value?.uuid;

  if ( !uuid ) {
    services.logger.debug( 'addedDj handler: no UUID found in patch' );
    return;
  }

  // Nickname is not in the patch — look it up from hangout state
  const nickname = services.stateService?._getCurrentState()?.allUserData?.[ uuid ]?.userProfile?.nickname || uuid;

  if ( services.afkService ) {
    services.afkService.addUser( uuid, nickname ); // ensure they are tracked
    services.afkService.recordActivity( uuid, 'joinedDecks' );
  }

  services.logger.debug( `addedDj handler: recorded joinedDecks activity for ${ uuid } (${ nickname })` );
}
```

**Note:** The addedDj `statePatch` always contains `{ op: 'add', path: '/djs/0', value: { uuid, tokenRole, canDj, highestRole, nextSong, ... } }`. No nickname is included — it must be resolved from `allUserData` in `stateService`. The `/visibleDjs/0` add op contains the same UUID and can be used as a fallback.

### 2f. `src/handlers/removedDj.js` (currently a stub)
Replace body with:
```js
function removedDj( message, state, services ) {
  // The remove op for /djs/0 carries no value — find the UUID from the
  // corresponding add op that moves the DJ back into /audienceUsers/N
  const audiencePatch = message.statePatch?.find(
    p => p.op === 'add' && /^\/audienceUsers\/\d+$/.test( p.path )
  );
  const uuid = audiencePatch?.value?.uuid;

  if ( !uuid ) {
    services.logger.debug( 'removedDj handler: no UUID found in patch' );
    return;
  }

  if ( services.afkService ) {
    services.afkService.recordActivity( uuid, 'leftDecks' ); // leaving is activity
  }

  services.logger.debug( `removedDj handler: recorded leftDecks activity for ${ uuid }` );
}
```

**Note:** The removedDj `statePatch` contains `{ op: 'remove', path: '/djs/0' }` and `{ op: 'remove', path: '/visibleDjs/0' }` with no value. The DJ who stepped off the decks is always re-added to `/audienceUsers/N` and `/floorUsers/N` as `add` operations — either can be used to recover the UUID. `audienceUsers` is preferred as the more semantically clear source. Nickname is not in the patch and is not needed here since `addUser` was already called when they joined the room.

---

## Phase 3 — Warning and removal timer

Create a periodic check inside `afkService` or as a separate task wired up in `serviceContainer.js`.

### Timeline
| Inactive for | Action |
|---|---|
| 15 min | Warning 1 |
| 16 min | Warning 2 |
| 17 min | Warning 3 |
| 18 min | Removed from decks |

### Configuration keys (stored via `dataService`)
| Key | Default | Description |
|---|---|---|
| `afk.firstWarningMs` | `900000` (15 min) | Inactivity before the first warning is sent |
| `afk.intervalMs` | `60000` (1 min) | Time between each subsequent warning, and between the last warning and removal |

Derived thresholds (not stored — computed at runtime):
- Warning 1: `firstWarningMs` (15 min)
- Warning 2: `firstWarningMs + intervalMs` (16 min)
- Warning 3: `firstWarningMs + 2 * intervalMs` (17 min)
- Removal:   `firstWarningMs + 3 * intervalMs` (18 min)

### Check interval
Run every 30 seconds (a `setInterval` started when the service initialises or when the feature is enabled).

### Logic per tick
```
currentDjs = stateService._getDjs()              // UUIDs of users currently on decks
for each dj in currentDjs:
  inactiveMs = Date.now() - activityMap[dj.uuid].mostRecent
  removalMs  = firstWarningMs + 3 * intervalMs  // 18 min
  warn3Ms    = firstWarningMs + 2 * intervalMs  // 17 min
  warn2Ms    = firstWarningMs + intervalMs       // 16 min
  warn1Ms    = firstWarningMs                    // 15 min

  if inactiveMs >= removalMs                         → remove from decks + notify
  else if dj.warningLevel < 3 AND inactiveMs >= warn3Ms → send warning 3, set warningLevel = 3
  else if dj.warningLevel < 2 AND inactiveMs >= warn2Ms → send warning 2, set warningLevel = 2
  else if dj.warningLevel < 1 AND inactiveMs >= warn1Ms → send warning 1, set warningLevel = 1
```

Removal fires at 18 min regardless of warning level (catches cases where warnings were missed due to timer jitter).

### Warning de-duplication
`warningLevel` in each user entry (see Phase 1 state shape) tracks the highest warning sent. A warning is only emitted when `warningLevel` is below the target level. `recordActivity()` resets `warningLevel` to `0`, so if a DJ becomes active again their warning counter resets and the full 15-minute window restarts.

### Deck removal
Look at how the existing room-state management fires socket events to move a DJ off the decks. Use the same socket action that the human moderator would use. Confirm the exact socket event/payload needed before implementing.

### Response routing
Use `messageService.sendResponse()` (same pattern as other commands) to post the warning to the group channel.

---

## Phase 4 — Feature flag + configuration

### Register the feature
In `src/services/featuresService.js`, add `'afkMonitor'` to the `allFeatures` array inside `getAllFeatures()`:
```js
const allFeatures = [
  'welcomeMessage',
  'nowPlayingMessage',
  'justPlayed',
  'afkMonitor',          // add this
];
```

### Guard every check
Wrap all AFK-triggered actions (warnings, removals) with:
```js
if (!services.featuresService.isFeatureEnabled('afkMonitor')) return;
```

Activity recording (Phase 2) does NOT need the guard — recording is cheap and means a human can enable the feature at any time without a cold start for the activity map.

### Timeout configuration commands
Either extend the existing `!edit` command to support `afkWarningTime` and `afkRemovalTime` keys, or create a dedicated `!afkMonitor set warning <seconds>` / `!afkMonitor set removal <seconds>` subcommand (see Phase 5). Confirm preference before implementing.

---

## Phase 5 — `!afkMonitor` management command

Create `src/commands/Admin Commands/handleAfkMonitorCommand.js`.

### Subcommands
| Subcommand | Example | Role | Description |
|---|---|---|---|
| `status` | `!afkMonitor status` | MODERATOR | Show all DJs and their last-activity timestamp |
| `exempt <name>` | `!afkMonitor exempt "DJ Cool"` | OWNER | Exclude a DJ from AFK removal for the current session |
| `reset <name>` | `!afkMonitor reset "DJ Cool"` | OWNER | Manually reset a DJ's activity timer to now |
| `set warning <sec>` | `!afkMonitor set warning 900` | OWNER | Update first-warning threshold (seconds) |
| `set interval <sec>` | `!afkMonitor set interval 60` | OWNER | Update time between warnings / before removal (seconds) |

### Metadata
```js
handleAfkMonitorCommand.requiredRole = 'MODERATOR';
handleAfkMonitorCommand.description = 'Manage AFK monitor settings';
handleAfkMonitorCommand.example = 'afkMonitor status';
handleAfkMonitorCommand.hidden = false;
```

### Response format for `!afkMonitor status`
```
AFK Monitor — active DJs
DJ Cool      last active: 2 min ago  (chat: 2m  emoji: 8m  decks: 12m)
DJ Sonic     last active: just now   (chat: —   emoji: just now  decks: 3m)
```
Show `mostRecent` as the primary column, then each per-type age in a compact parenthetical. Use `—` when a type has never fired for that user. Compute human-readable `X min ago` / `just now` from each timestamp.

### Update help command pathways
The command pathway map in `handleHelpCommand.js` must include the new `afkMonitor` command.

---

## Phase 6 — Tests

### `tests/services/afkService.test.js`
- `addUser` adds a new entry with all activity types `undefined`
- `addUser` is idempotent (duplicate call does not overwrite existing activity timestamps)
- `recordActivity` stamps the correct activity type and updates `mostRecent`
- `recordActivity` with one type does not affect other type timestamps
- `recordActivity` is a no-op for unknown UUID
- `mostRecent` always equals the maximum of all activity timestamps
- `removeUser` removes the entry
- `getInactiveUsers` compares against `mostRecent`, not individual types
- `getActivitySnapshot` includes the full per-type breakdown for each user
- `clear` empties the map
- `warnedAt` is reset when `recordActivity` is called

### `tests/handlers/addedDj.test.js` / `removedDj.test.js`
- Calls `afkService.recordActivity` with the correct UUID
- Handles missing UUID gracefully (no crash)

### `tests/lib/bot.test.js` (additions)
- Non-command message calls `afkService.recordActivity(sender)` after command processing
- Missing `afkService` does not throw (defensive check)

### `tests/commands/handleAfkMonitorCommand.test.js`
- Metadata properties (role, description, example, hidden)
- `status` subcommand returns activity list
- `exempt` / `reset` validate arguments and update state
- `set warning` / `set interval` validate and persist thresholds
- Unknown subcommand returns usage text
- All paths guarded by `featuresService.isFeatureEnabled('afkMonitor')`
- `set warning` / `set interval` validate positive integers and persist thresholds

---

## Open questions before starting

1. ~~**`addedDj` / `removedDj` message payloads**~~ — ✅ Resolved from debug logs. See phases 2e and 2f for exact extraction logic.
2. **Deck removal socket action** — what event and payload does the bot need to fire to remove a DJ? Check existing socket/state mutation code.
3. **`!afkMonitor set` vs. extending `!edit`** — which approach for timeout configuration?
4. **Timer ownership** — should the interval live inside `afkService` itself, or be started by `serviceContainer` / `index.js` after all services are ready? (Keeping it in the service makes it self-contained and easier to test; starting it externally makes the lifecycle more explicit.)
5. **Bot startup — populate activity map** — on connect, should the bot call `stateService._getCurrentState()` to get all current users and pre-populate the activity map? Without this, users who were in the room before the bot started will have no `lastActivity` and could be immediately flagged. Safest option: treat a missing entry as "active" (i.e. skip AFK check) until the user performs at least one trackable action.

---

## Deferred items

- **Vote tracking**: `votedOnSong.js` receives aggregate patch counts only — voter UUID is not available at the socket level. Needs investigation into whether CometChat or the Plug.DJ socket exposes per-voter data. Deferred.
- **Queue changes**: No handler is currently registered for queue-add/remove events. Deferred until the event payload format and registration point are confirmed.
