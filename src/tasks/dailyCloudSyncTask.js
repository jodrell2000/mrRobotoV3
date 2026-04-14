const { logger } = require( '../lib/logging' );

/**
 * Daily Cloud Sync Task
 * Automatically syncs data directory to Google Cloud Storage once per day
 */

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SYNC_TIME_HOUR = 3; // 3 AM local time

/**
 * Calculate milliseconds until next sync (3 AM)
 * @returns {number} Milliseconds until next sync
 */
function msUntilNextSync () {
    const now = new Date();
    const next = new Date( now );

    // Set to 3 AM
    next.setHours( SYNC_TIME_HOUR, 0, 0, 0 );

    // If we've passed 3 AM today, schedule for 3 AM tomorrow
    if ( next <= now ) {
        next.setDate( next.getDate() + 1 );
    }

    return next - now;
}

/**
 * Perform daily cloud sync
 * @param {Object} services - Services container
 */
async function performDailySync ( services ) {
    const { cloudStorageService } = services;

    if ( !cloudStorageService || !cloudStorageService.isEnabled() ) {
        logger.debug( '☁️ [DailyCloudSyncTask] Cloud storage not enabled, skipping sync' );
        return;
    }

    logger.info( '☁️ [DailyCloudSyncTask] Starting daily backup to cloud...' );

    try {
        const result = await cloudStorageService.syncToCloud();

        if ( result.success ) {
            logger.info( `☁️ [DailyCloudSyncTask] Daily backup complete: ${ result.uploaded } files uploaded` );
        } else {
            logger.warn( `☁️ [DailyCloudSyncTask] Daily backup completed with errors: ${ result.uploaded } uploaded, ${ result.failed } failed` );
        }
    } catch ( error ) {
        logger.error( `☁️ [DailyCloudSyncTask] Daily backup failed: ${ error.message }` );
    }
}

/**
 * Schedule the next sync
 * @param {Object} services - Services container
 * @returns {NodeJS.Timeout} Timer ID
 */
function scheduleNextSync ( services ) {
    const msUntilSync = msUntilNextSync();
    const nextSyncDate = new Date( Date.now() + msUntilSync );

    logger.info( `☁️ [DailyCloudSyncTask] Next daily sync scheduled for: ${ nextSyncDate.toISOString() }` );

    return setTimeout( async () => {
        await performDailySync( services );

        // Schedule the next sync (24 hours later)
        scheduleNextSync( services );
    }, msUntilSync );
}

/**
 * Initialize daily cloud sync task
 * @param {Object} services - Services container
 * @returns {Object} Task control object
 */
function initialize ( services ) {
    logger.info( '☁️ [DailyCloudSyncTask] Initializing daily cloud backup...' );

    if ( !services.cloudStorageService || !services.cloudStorageService.isEnabled() ) {
        logger.info( '☁️ [DailyCloudSyncTask] Cloud storage not enabled, task will not run' );
        return {
            enabled: false,
            stop: () => { }
        };
    }

    // Schedule first sync
    const timerId = scheduleNextSync( services );

    return {
        enabled: true,
        timerId,
        stop: () => {
            if ( timerId ) {
                clearTimeout( timerId );
                logger.info( '☁️ [DailyCloudSyncTask] Stopped daily cloud sync task' );
            }
        }
    };
}

module.exports = {
    initialize,
    performDailySync,
};
