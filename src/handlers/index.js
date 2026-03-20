const services = require( '../services/serviceContainer.js' );
const message = require( './message.js' );
const playedSong = require( './playedSong.js' );
const userJoined = require( './userJoined.js' );
const userLeft = require( './userLeft.js' );
const playedOneTimeAnimation = require( "./playedOneTimeAnimation.js" );
const votedOnSong = require( "./votedOnSong.js" );
const addedDj = require( "./addedDj.js" );
const removedDj = require( "./removedDj.js" );
const nothingPlaying = require( "./nothingPlaying.js" );
const updatedRoomSettings = require( "./updatedRoomSettings.js" );
const updatedNextSong = require( "./updatedNextSong.js" );
const lookedUpSong = require( "./lookedUpSong.js" );

const handlers = {
  message,
  playedSong,
  userJoined,
  userLeft,
  playedOneTimeAnimation,
  votedOnSong,
  addedDj,
  removedDj,
  nothingPlaying,
  updatedRoomSettings,
  updatedNextSong,
  lookedUpSong,
}

module.exports = handlers;