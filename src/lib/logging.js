/**
 * Centralized logging module
 * Provides a consistent logging interface throughout the application
 */
const winston = require( 'winston' );
require( 'winston-daily-rotate-file' );
const fs = require( 'fs' );
const path = require( 'path' );

// Ensure logs directory exists
const logsDir = path.join( process.cwd(), 'logs' );
if ( !fs.existsSync( logsDir ) ) {
  fs.mkdirSync( logsDir, { recursive: true } );
}

// Define custom levels to ensure debug is below info
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue'
  }
};

// Add colors to Winston
winston.addColors( customLevels.colors );

// Format for log entries
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf( ( { level, message, timestamp } ) => {
    return `${ timestamp } [${ level.toUpperCase() }]: ${ message }`;
  } )
);

// Create transports array
const transports = [
  // Daily rotating file
  new winston.transports.DailyRotateFile( {
    dirname: logsDir,
    filename: '%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: 30
  } )
];

// Add console transport in production (for Cloud Run) or if explicitly enabled
if ( process.env.NODE_ENV === 'production' || process.env.LOG_TO_CONSOLE === 'true' ) {
  transports.push(
    new winston.transports.Console( {
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    } )
  );
}

// Create a Winston logger with custom levels
const logger = winston.createLogger( {
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'debug',
  format: logFormat,
  transports,
  exitOnError: false
} );

// Export the logger
module.exports = {
  logger
};