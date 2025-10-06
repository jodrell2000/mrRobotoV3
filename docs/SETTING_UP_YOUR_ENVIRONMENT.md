# Setting Up Your Environment

This guide will walk you through setting up your environment for the bot. Expected setup time: ~30 minutes.

> ⚠️ **IMPORTANT**: Every user can have one, and only one, Bot registered to them.

## Prerequisites
- A personal Hang.fm account
- Access to your browser's Developer Tools
- A text editor

## Table of Contents
[The .env file](#the-env-file)
   - [Step 1: Setting up the Environment File](#step-1-setting-up-the-environment-file)
   - [Step 2: Getting Your User Token](#step-2-getting-your-user-token)
   - [Step 3: Registering Your Bot with Hang.fm](#step-3-registering-your-bot-with-hangfm)
   - [Step 4: Getting Bot Tokens](#step-4-getting-bot-tokens)
   - [Step 5: Obtaining a Chat Token](#step-5-obtaining-a-chat-token)
   - [Step 6: Getting the Bot UUID](#step-6-getting-the-bot-uuid)
   - [Step 7: Tell the bot which Hangout enter](#step-7-tell-the-bot-which-hangout-enter)
   - [Step 8: Configuring the Command Prefix](#step-8-configuring-the-command-prefix)


[The data.json file](#understanding-datajson)
   - [Step 1: Creating your data.json file](#step-1-creating-your-datajson-file)
   - [Step 2: Welcome Message Configuration](#step-2-welcome-message-configuration)
   - [Step 3: Bot Data Configuration](#step-3-bot-data-configuration)

---

# The .env file
**Time Estimate: 20-25 minutes**

## Step 1: Setting up the Environment File
**Time: ~2 minutes**

1. Create a new file in the project root folder called `.env`
2. Copy/Paste the contents of `.env_example` into that file

## Step 2: Getting Your User Token
**Time: ~5 minutes**
In order to register a bot and get other details you first need your security token from Hang.fm

To do this you can either use a bookmarklet, either by dragging it to your browser bar or manually creating it, or failing that you can get it using the Developer tools in your web browser

> 🔒 **SECURITY WARNING**: Your user token gives full access to your account. Never share it with anyone!

### Option 1: Using a Bookmarklet (Recommended)

1. Create a new bookmark in your browser (ideally on your favourites bar so you can just click it)
2. Title it 'Get Hang User Token'
3. Copy the javascript below and paste it as the bookmark's as the URL/address
4. Log into Hang.fm and click the bookmark to copy your token to clipboard

Bookmarklet code:
```
javascript:(function()%7B%20var%20token%20=%20localStorage.getItem('token-storage');%20if(!token)%7Balert('No%20token%20found');return;%7D%20if(token.startsWith('%22')%20&&%20token.endsWith('%22'))%7Btoken=token.slice(1,-1);%7D%20token=token.trim();%20navigator.clipboard.writeText(token).then(function()%7B%20alert('Token%20copied%20to%20clipboard');%20%7D).catch(function(err)%7B%20alert('Clipboard%20copy%20failed:%20'+err);%20%7D);%20%7D)();
```

### Option 2: Manual Method
If the bookmarklet doesn't work, you can get your token manually:

1. Log into Hang.fm as your personal user and open the Developer Tools
   * Chrome: https://developer.chrome.com/docs/devtools/storage/localstorage
   * Firefox: https://firefox-source-docs.mozilla.org/devtools-user/storage_inspector/
   * Safari: https://developer.apple.com/documentation/safari-developer-tools/enabling-developer-features

2. Navigate to Storage/Local Storage
3. Look for a key called `token-storage`
4. Copy its value (remember to remove the double quotes if present)

## Step 3: Registering Your Bot with Hang.fm
**Time: ~5 minutes**

   * Head to: https://gateway.prod.tt.fm/api/user-service/api/#/Bot%20endpoints/signUpBot

   * You should the following
   ![Screenshot showing the /user/sign-up-bot Swagger page](/docs/assets/sign-up-bot.png "/user/sign-up-bot Screenshot")

   * Click the light grey padlock on the right side of that screen and you will see an `Available authorizations` window pop open
   ![Screenshot showing the 'Available authorizations' window](/docs/assets/available-authorizations.png "/user/Available authorizations Screenshot")

   * Paste your user-token (remembering to have stripped off the quotes from both ends if necessary) into the value box and click Authorize

   * The Authorize button will change to say 'Logout'. You can now click the small X in the top right of that window to close it. When you return to the sign-up-bot screen you should see that the light grey open padlock on the top right is now locked and a solid black colour. This means you are successfully authorised

   * Click the button immediatly underneath the padlock titled 'Try it out'. This will open a text box entitled 'Request body'. This is where you need to enter the details for your Bot

      ```json
      {
         "botNickName": "string",
         "avatarId": "string",
         "color": "string"
      }
      ```

   * Replace the 3 instances of string, leaving the quotes in place
      * botNickName: what you want your Bot to be called
      * avatarId: this can be either bot-01 or bot-2 (yes, there's an inconsistency in the names on the hang.fm site). Both are grey robot avatars. bot-01 has blue eyes and detailing, bot-2 has green eyes and orange detailing
      * color: this si the colour you want your Bot's name to appear as in the chat. The colour value needs to be a hex representation of a colour, without the leading `#` character, eg "ff9900" for orange. Look here if you need help finding a colour: https://www.w3schools.com/colors/colors_picker.asp

   * You will also need these details later when you fill out the information in the data.json file so don't lose them

   * <a name="example-registration"></a>The request body should end up looking something like,
      ```json
      {
         "botNickName": "Mr HangBot",
         "avatarId": "bot-1",
         "color": "00ccff"
      }
      ```
   * Once you've filled that in, click the large blue 'Execute' button

   * You should see a brief 'Loading' mesage followed by a response that will include the curl message sent and below that the server response with a 201 code. Congratulation, you've registered your Bot!

   * Now that it's registered we can get the Bot's user-token!

## Step 4: Getting Bot Tokens
**Time: ~5 minutes**
   * Head to: https://gateway.prod.tt.fm/api/user-service/api/#/Bot%20endpoints/getBotToken
   ![Screenshot showing /users/bot-token](/docs/assets/bot-token.png "/users/bot-token Screenshot")

   * if the padlock is light gray and open, repeat the process from above to authorise yourself so that the padlock is closed and solid black

   * Click the 'Try it out' button underneath the paclock followed by clicking the blue 'Execute' button

   * After a breif 'Loading' message you will see the 'curl' message sent by the server and below that the 'Response body'. This includes an 'accessToken', eg.
      ```json
      {
      "accessToken": "eyJhbGciOiKGJhKJVHJKHVvhjkhjvVJHcCI6IkpXVCJ9.eyJpZCI6MzE2MjA5Miwic3ViIjoiNTQ1OTQ0MjItNWE5MC00N2E4LTk4MjQtYWY1YWRkMjE2Mzc0Iiwicm9sZSI6ImJvdCIsImNhcGFiaWxpdGllcyI6W10sInR5cGUiOiJ1c2VyIiwiaWF0IjoxNzU1ODYwNzg4LCJleHAiOjIwNzEyMjA3ODgsImlzcyI6InR1cm50YWJsZS11c2VyLXNlcnZpY2UifQ.0aZD0_LIyd3eCif6zlqX2stPjkvKJVJVHJVHJVKHjvhVHVHvVvVvvVKjkvvyuCTckVJVvw5M_74kp4zscwfj00vruIQ_-tocZ10klVFylQo0KH3fxo1xPxspL92op0MPY5a3vx4ZZoKYZabJ-2NCr73hD3GEAuXThZlaigkCJXfO_7SqVjFFc_oRsQ5EfFSBKmq-vbzU0F_dQsGjl,jvJHKVjJVKjvvjjvkjvhhjvvjhjhvjvvjhjvhvjhkjvhkvjkvvjhJhvVHJJVKHvGIv20myR3vH5Cpg8c7NDIFpg2HhsFoFIb-It-r10K9hRCv1WsmZKw44jAWqSIuEYxcGyNRNKHBZATcG0m04P3znED9YCSNKtAQEMTPSI7ymek61YrQ_FEzS4KyVth-tRXpxSAKjC53T2eickbR-hfhOltLoIIVrcYY7-orbK5u2kQPWmbA1a02XErwiAqjYzSSB7_p7Te2ev93d1pfCq11XonqoGAknvmXbOcb-hK54k8Vy7Z8jc7-yA5g31Zn5AqomZFYipv4NWxNSvIK50ckV6YgZiso",
      "codeSyncNewUser": "123456"
      }
      ```
   * Copy the value field next to 'accessToken', once again removing the double-quotes from either end and paste it into your .env file replacing 'paste-your-bot-token-here'

   * You should probably have a cup of tea now! ;-)

## Step 5: Obtaining a Chat Token
**Time: ~2 minutes**
Next we're going to use the Bot token to get the COMETCHAT_AUTH_TOKEN to add to the .env file
   * Head to: https://gateway.prod.tt.fm/api/user-service/api/#/CometChat/getUserCometChatAuthToken
   * as above, click the light gray padlock and authosire yourself, but this time **use the Bot's token** rather than your personal one. If the padlock is already closed, click it and then click 'Logout' on the popup that appears
   * Click the 'Try it out' button underneath the padlock, and then the blue 'Execute' button. You should see a response returned containing a value for cometAuthToken
      ```json
      {
      "cometAuthToken": "asdaad-asd-45f7-asd-c3756a8c4a84_17186129asdasdasdasdcd717e3646f8b"
      }
      ```
   * Copy the value from this response, without the quotes, and paste it into your .env file replacing 'paste-your-comet-chat-auth-token-here'

## Step 6: Getting the Bot UUID
**Time: ~2 minutes**
We now need to get the Bot's UserID on the Hang.fm site. Head to: https://gateway.prod.tt.fm/api/user-service/api/#/User%20profile/getProfile
   * As before, authenticate using the padlock on the right side and the Bot Token
   * Click 'Try it out' and then 'Execute'
   * The Response body will contain all the details about the Bot User including, towards the bottom, the uuid (Universally unique identifier)
   * Copy the value for the uuid and paste it into the .env file replacing paste-your-bot-uuid-here

## Step 7: Tell the bot which Hangout enter
**Time: ~5 minutes**
Next we need to tell the Bot which Hangout it should appear in
   * Firstly log onto Hang.fm and go to the hangout you want the bot to appear in. Copy the URL of the hangout
   * For the next step you need the 'slug' of the Hangout. It's the last part of the URL, eg. for https://hang.fm/da/i-love-the-80s the slug would be i-love-the-80s
   * Head to: https://gateway.prod.tt.fm/api/room-service/api/#/Rooms%20data/getRoom
   * As before, authotise yourself using the padlock on the right side and yout Bot's token and click 'Try it out'
   * You will see a text box entitled slug. Paste the slug from your Hangout into that box and click 'Execute'
   * The response here is quite large and can include data about songs plaued, users from the Hangout and pinned chat messages. Once again you're looking for the uuid value, eg.
      ```json
      "isLive": false,
      "posterUrl": "https://events.prod.tt.fm/room_covers/i-love-the-80s-1755750134292.gif",
      "discordServer": null,
      "externalUrl": "https://80s-c473bb.webflow.io/",
      "uuid": "fc0c1a01-83d6-49ad-9050-4379431a015e",
      "explicit": true,
      "positionPriority": 0,
      "genres": [
         "Rock",
         "Alternative",
         "1980s"
      ], 
      ```
   * Copy the uuid value and paste it into your .env file replacing paste-hangout-uuid-here

## Step 8: Configuring the Command Prefix
**Time: ~1 minutes**
Finally, you need to decide how the bot will identify commands. The Bot will ignore everything in chat and Private messages unless it starts with this character
   * eg. hello would be ignored, but if you pick '/' as youd command switch then /hello would send a command to the Bot
   * the characters / or ! are typically used but you can choose anything that suits your Hangout

---

## Understanding data.json
**Time: ~5 minutes**

## Step 1: Creating your data.json file
In the project root there is a file called `data.json_example`. 

Create a copy of this file and name it `data.json`

This file contains the Bot's "memory" and serves two purposes:
1. Initial configuration when the Bot starts
2. Persistent storage for settings that can be updated via commands while running

> 💡 **TIP**: While you should set these values initially, afterwards it's recommended to use Bot commands to modify them.

### Example Configuration

```json
{
   "welcomeMessage": "Hi {username}, welcome to {hangoutName}",
   "botData": {
      "CHAT_AVATAR_ID": "bot-1",
      "CHAT_NAME": "HangBot",
      "CHAT_COLOUR": "00ccff"
   }
} 
```

## Step 2: Welcome Message Configuration
Firstly we update the value for "welcomeMessage"
   * this is use by the Bot to greet people when they arrive in the Hangout
   * the token {username} will be automatically converted to a mention of the user joining the Hangout
   * the token {hangoutName} will be substituted for the name/title of the Hangout

## Step 3: Bot Data Configuration
Next we have to update the botData section
   * this is data used with Hang.fm itself, as well as the Chat provider CometChat
   * the data in this section *MUST* mirror the data entered when the Bot was registered
   * if the data here (matching the [registration example above](#example-registration)) was used to register the Bot, then the data.json file should be as in the example above
