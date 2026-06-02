const dotenv = require( 'dotenv' );
dotenv.config();

module.exports = {
  COMETCHAT_API_KEY: process.env.COMETCHAT_API_KEY,
  COMETCHAT_AUTH_TOKEN: process.env.COMETCHAT_AUTH_TOKEN,
  OPENCHAT_BASE_URL: process.env.OPENCHAT_BASE_URL || 'https://openchat.prod.tt.fm/',
  LOG_LEVEL: process.env.LOG_LEVEL,
  SOCKET_MESSAGE_LOG_LEVEL: process.env.SOCKET_MESSAGE_LOG_LEVEL || 'OFF',
  BOT_UID: process.env.BOT_UID,
  HANGOUT_ID: process.env.HANGOUT_ID,
  BOT_USER_TOKEN: process.env.BOT_USER_TOKEN,
  CHAT_AVATAR_ID: process.env.CHAT_AVATAR_ID,
  CHAT_NAME: process.env.CHAT_NAME,
  CHAT_COLOUR: process.env.CHAT_COLOUR,
  COMMAND_SWITCH: process.env.COMMAND_SWITCH,
  COMETCHAT_RECEIVER_UID: process.env.COMETCHAT_RECEIVER_UID,
  TTFM_GATEWAY_BASE_URL: process.env.TTFM_GATEWAY_BASE_URL,
  googleAIKey: process.env.googleAIKey,
  // Web documentation server
  PORT: process.env.PORT || 8080,
  WEB_DOCS_URL: process.env.WEB_DOCS_URL, // Auto-configured by deployment script
};
