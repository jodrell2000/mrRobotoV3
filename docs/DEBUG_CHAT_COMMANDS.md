# Chat Command Debug Logging Guide

## Overview
Added comprehensive debug logging to trace the chat command sender name through the entire message pipeline. This document explains what to look for when debugging why messages appear from "Bot" instead of the user's nickname.

## Debug Log Flow

### 1. Handle Chat Command Layer
**File:** `src/commands/handleChatCommand.js`

Look for these debug lines:
```
[handleChatCommand] DEBUG - context.username: <username>
[handleChatCommand] DEBUG - senderName extracted: <username>
[handleChatCommand] DEBUG - senderUuid extracted: <uuid>
[handleChatCommand] DEBUG - Sending <picture|text> message with senderName: <username>
[handleChatCommand] DEBUG - Options being passed: {"senderUid":"<uuid>","senderName":"<username>"}
```

**What to check:**
- Is `context.username` being populated from the incoming context?
- Is `senderName` correctly extracted?
- Are the options being passed to the message service with both `senderUid` and `senderName`?

### 2. Group Message Service Layer
**File:** `src/services/groupMessageService.js`

Look for these debug lines:
```
[groupMessageService.sendGroupMessage] DEBUG - senderName input: <username>
[groupMessageService.sendGroupMessage] DEBUG - senderUid input: <uuid>
[groupMessageService.sendGroupMessage] DEBUG - customData after buildCustomData: {"userName":"<username>","triggeredBy":"<uuid>"}
[groupMessageService.sendGroupMessage] DEBUG - full payload: { "receiver": "...", "data": { "metadata": { "chatMessage": { "userName": "<username>", ... } } } }
```

**What to check:**
- Is `senderName` received in the service?
- After `buildCustomData()`, is `customData.userName` set to the sender's name?
- In the full payload, is the `metadata.chatMessage.userName` set to the sender's name?

### 3. CometChat API Layer
**File:** `src/services/cometchatApi.js` - `buildCustomData()` function

Look for these debug lines:
```
[cometchatApi.buildCustomData] DEBUG - senderName parameter: <username>
[cometchatApi.buildCustomData] DEBUG - senderUid parameter: <uuid>
[cometchatApi.buildCustomData] DEBUG - userName in customData: <username>
```

**What to check:**
- Is the `senderName` parameter reaching `buildCustomData()`?
- Is the conditional logic `senderName || dataService?.getValue(...) || 'Bot'` working correctly?
- Is the final `userName` in customData set to the sender's name or defaulting to "Bot"?

## Possible Issues and Solutions

### Issue 1: `context.username` is undefined
**Symptom:** `senderName extracted: undefined` in handleChatCommand logs

**Cause:** The context object doesn't contain the username field

**Solution:** Check how the context is being built in the command handler. The username should come from the user profile data.

### Issue 2: `senderName` doesn't reach buildCustomData
**Symptom:** 
- handleChatCommand shows `senderName: Jodrell`
- But buildCustomData shows `senderName parameter: undefined`

**Cause:** The parameter isn't being passed through one of the message service layers

**Solution:** Check the chain:
1. handleChatCommand → messageService.sendResponse() or sendGroupPictureMessage()
2. messageService.sendResponse() → messageService.sendGroupMessage()
3. messageService.sendGroupMessage() → cometchatApi.buildCustomData()

### Issue 3: `buildCustomData` receives senderName but customData.userName is still "Bot"
**Symptom:** 
- `senderName parameter: Jodrell` in buildCustomData logs
- But `userName in customData: Bot` in buildCustomData logs

**Cause:** Conditional logic issue: `senderName || dataService?.getValue(...) || 'Bot'`

**Solution:** Check if `senderName` is truthy. It might be an empty string, whitespace, or falsy value.

### Issue 4: customData has correct userName but message still appears from "Bot"
**Symptom:** All debug logs show correct values, but the message still displays from "Bot"

**Cause:** This would indicate a client-side rendering issue or CometChat configuration issue

**Solution:** Check:
- Is the payload being sent to CometChat correctly with the `metadata.chatMessage.userName` field?
- Is the CometChat client using this metadata field to display the sender name?

## Complete Debug Log Example

A successful chat command message should show this sequence:
```
[handleChatCommand] DEBUG - context.username: Jodrell
[handleChatCommand] DEBUG - senderName extracted: Jodrell
[handleChatCommand] DEBUG - senderUuid extracted: f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc
[handleChatCommand] DEBUG - Sending picture message with senderName: Jodrell
[handleChatCommand] DEBUG - Options being passed: {"senderUid":"f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc","senderName":"Jodrell"}

[groupMessageService.sendGroupMessage] DEBUG - senderName input: Jodrell
[groupMessageService.sendGroupMessage] DEBUG - senderUid input: f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc
[cometchatApi.buildCustomData] DEBUG - senderName parameter: Jodrell
[cometchatApi.buildCustomData] DEBUG - userName in customData: Jodrell
[groupMessageService.sendGroupMessage] DEBUG - customData after buildCustomData: {"userName":"Jodrell","triggeredBy":"f813b9cc-28c4-4ec6-a9eb-2cdfacbcafbc"}
[groupMessageService.sendGroupMessage] DEBUG - full payload: { ... "metadata": { "chatMessage": { "userName": "Jodrell", ... } } }
```

## How to Collect Logs

1. Run the bot and execute a chat command
2. Look for the debug messages in the console output
3. Collect the logs from handleChatCommand through groupMessageService through cometchatApi
4. Trace where the `senderName` value gets lost or doesn't change the `userName`

