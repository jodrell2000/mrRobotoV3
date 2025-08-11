// src/services/messageService.js
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { buildUrl } = require('../lib/buildUrl');
const cometchatApi = require('./cometchatApi.js');
const config = require('../config.js');
const { logger } = require('../utils/logging.js');

// variables
const RECEIVER_TYPE = {
  USER: "user",
  GROUP: "group"
};

let latestGroupMessageId = null;

// ===============

// Helper functions

function setLatestGroupMessageId(id) {
  latestGroupMessageId = id;
}

function getLatestGroupMessageId() {
  return latestGroupMessageId;
}

async function buildCustomData( theMessage ) {
  return {
    message: theMessage,
    avatarId: config.CHAT_AVATAR_ID,
    userName: config.CHAT_NAME,
    color: `#${ config.CHAT_COLOUR }`,
    mentions: [],
    userUuid: config.BOT_UID,
    badges: [ 'VERIFIED', 'STAFF' ],
    id: uuidv4()
  };
}

async function buildPayload( receiver, receiverType, customData, theMessage ) {
  return {
    receiver: receiver,
    receiverType: receiverType,
    category: 'message',
    type: 'text',
    data: {
      text: theMessage,
      metadata: {
        chatMessage: customData
      }
    }
  };
}

// ===============

// exported functions

const messageService = {
  buildCustomData,
  buildPayload,
  getLatestGroupMessageId,
  setLatestGroupMessageId,

  sendPrivateMessage: async function(theMessage) {
    try {
      const customData = await this.buildCustomData(theMessage);
      const payload = await this.buildPayload(config.COMETCHAT_RECEIVER_UID, RECEIVER_TYPE.USER, customData, theMessage);
      const response = await axios.post(`${cometchatApi.BASE_URL}/v3.0/messages`, payload, { headers: cometchatApi.headers });
      logger.debug('✅ Private message sent:', JSON.stringify(response.data, null, 2));
    } catch (err) {
      logger.error('❌ Failed to send private message:', err.response?.data || err.message);
    }
  },

  sendGroupMessage: async function( theMessage ) {
    try {
      const customData = await this.buildCustomData( theMessage );
      const payload = await this.buildPayload( config.HANGOUT_ID, RECEIVER_TYPE.GROUP, customData, theMessage )
      await axios.post( `${ cometchatApi.BASE_URL }/v3.0/messages`, payload, { headers: cometchatApi.headers } );
      // logger.debug( '✅ Group message sent:', JSON.stringify( response.data.data.data.text, null, 2 ) );
    } catch (err) {
      logger.error('❌ Failed to send group message:', err.response?.data || err.message);
    }
  },

  fetchPrivateMessages: async function() {
    try {
      const url = buildUrl( cometchatApi.BASE_URL, [
        'v3',
        'users',
        config.COMETCHAT_RECEIVER_UID,
        'conversation'
      ], [
        [ 'conversationType', 'user' ],
        [ 'limit', 50 ],
        [ 'uid', config.BOT_UID ]
      ] );

      const res = await cometchatApi.apiClient.get( url );
      const msg = res.data.data.lastMessage;
      if ( msg ) {
        logger.debug( `📥 Private message from ${ msg.sender }: ${ msg.data?.text || '[No Text]' }` );
        if (msg.data?.text?.startsWith(config.COMMAND_SWITCH)) {
          return [msg]; // Return an array for consistency
        }
      } else {
        logger.debug( '📥 No private messages found.' );
      }
    } catch ( err ) {
      logger.error( '❌ Error fetching private messages:', err.message );
    }
  },

  fetchGroupMessagesRaw: async function(params = []) {
    const defaultParams = [
      ['hideMessagesFromBlockedUsers', 0],
      ['unread', 0],
      ['withTags', 0],
      ['hideDeleted', 0],
      ['affix', 'append']
    ];

    try {
      const url = buildUrl(cometchatApi.BASE_URL, [
        'v3.0', 'groups', config.HANGOUT_ID, 'messages'
      ], [...defaultParams, ...params]);

      const res = await cometchatApi.apiClient.get(url);
      return res.data?.data || [];
    } catch (err) {
      logger.error('❌ Error fetching group messages:', err.message);
      return [];
    }
  },
  
  fetchGroupMessages: async function() {
    const params = [
      ['per_page', 50],
      ['undelivered', 1]
    ];

    if (this.getLatestGroupMessageId() !== null) {
      params.push(['id', latestGroupMessageId]);
    } else {
      // Fallback to current timestamp for initial fetch
      params.push(['updatedAt', Math.floor(Date.now() / 1000)]);
    }

    const messages = await this.fetchGroupMessagesRaw(params);
    
    if (messages.length === 0) {
      // logger.debug('📥 No new group messages.');
      return [];
    }

    // Update latest message ID based on last message in list
    this.setLatestGroupMessageId(messages[messages.length - 1].id);
    
    const commandMessages = messages.filter(msg => msg.data?.text?.startsWith(config.COMMAND_SWITCH));
    if (commandMessages.length > 0) {
      logger.debug('📥 Group command messages:', commandMessages.map(m => `${m.id}: ${m.data.text}`));
    }

    return commandMessages;
  },

  returnLatestGroupMessageId: async function() {
    const MAX_LOOKBACK_MINUTES = 10;
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i <= MAX_LOOKBACK_MINUTES; i++) {
      const lookbackTimestamp = now - i * 60;

      const url = buildUrl(cometchatApi.BASE_URL, [
        'v3.0', 'groups', config.HANGOUT_ID, 'messages'
      ], [
        ['per_page', 1],
        ['hideMessagesFromBlockedUsers', 0],
        ['unread', 0],
        ['undelivered', 0],
        ['withTags', 0],
        ['hideDeleted', 0],
        ['affix', 'append'],
        ['updatedAt', lookbackTimestamp]
      ]);

      try {
        const res = await cometchatApi.apiClient.get(url);
        const messages = res.data?.data;

        if (Array.isArray(messages) && messages.length > 0) {
          const latest = messages[0];
          logger.debug(`✅ Found message: ID ${latest.id} at sentAt ${latest.sentAt} (lookback ${i}m)`);
          return latest.id;
        }
        logger.debug(`🔍 No messages at ${lookbackTimestamp} (${i} min ago)`);
      } catch (err) {
        logger.error(`❌ Error fetching messages at lookback ${i}m:`, err.message);
        return null;
      }
    }

    logger.warn('⚠️ No messages found in lookback window');
    return null;
  },
  
  listGroupMembers: async function() {
    const url = buildUrl(cometchatApi.BASE_URL, [
      'v3.0', 'groups', config.HANGOUT_ID, 'members'
    ], [
      ['limit', 50],
      ['uid', config.BOT_UID]
    ]);

    try {
      const res = await cometchatApi.apiClient.get(url);
      logger.debug(`members: ${JSON.stringify(res.data, null, 2)}`);
      return res.data;
    } catch (err) {
      logger.error(`❌ Error fetching group members: ${err.message}`);
      return null;
    }
  }
};

module.exports = {
  messageService
};
