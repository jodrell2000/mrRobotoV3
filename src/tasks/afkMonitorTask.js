'use strict';

const TICK_INTERVAL_MS = 30 * 1000;
const DEFAULT_FIRST_WARNING_MS = 15 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 60 * 1000;

async function runAfkMonitorTick ( services ) {
    if ( !services.featuresService?.isFeatureEnabled( 'afkMonitor' ) ) return;
    if ( !services.stateService || !services.afkService ) return;

    const firstWarningMs = services.dataService?.getValue( 'afk.firstWarningMs' ) ?? DEFAULT_FIRST_WARNING_MS;
    const intervalMs = services.dataService?.getValue( 'afk.intervalMs' ) ?? DEFAULT_INTERVAL_MS;

    const warn1Ms = firstWarningMs;
    const warn2Ms = firstWarningMs + intervalMs;
    const warn3Ms = firstWarningMs + 2 * intervalMs;
    const removeMs = firstWarningMs + 3 * intervalMs;

    const rawDjs = services.stateService._getDjs();
    const seen = new Set();
    const djs = rawDjs.filter( dj => {
        if ( seen.has( dj.uuid ) ) return false;
        seen.add( dj.uuid );
        return true;
    } );
    if ( !djs.length ) return;

    const snapshotByUuid = new Map(
        services.afkService.getActivitySnapshot().map( e => [ e.uuid, e ] )
    );

    const now = Date.now();

    services.logger.debug( `[afkMonitor] tick — ${ djs.length } DJ(s) on decks` );
    for ( const dj of djs ) {
        const entry = snapshotByUuid.get( dj.uuid );
        if ( !entry ) {
            services.logger.debug( `[afkMonitor]   ${ dj.uuid } — not in activity map (seeding may not have run yet)` );
            continue;
        }
        if ( entry.exempted ) {
            services.logger.debug( `[afkMonitor]   ${ entry.nickname || dj.uuid } — exempt from AFK monitor` );
            continue;
        }
        if ( !entry.mostRecent ) {
            services.logger.debug( `[afkMonitor]   ${ entry.nickname || dj.uuid } — no activity recorded yet` );
            continue;
        }
        const inactiveMs = now - entry.mostRecent.getTime();
        const inactiveMinutes = Math.floor( inactiveMs / 60000 );
        const nickname = entry.nickname || dj.uuid;
        const mention = services.messageService.formatMention( dj.uuid );
        services.logger.debug( `[afkMonitor]   ${ nickname } — last active: ${ entry.mostRecent.toISOString() } (${ ( inactiveMs / 60000 ).toFixed( 1 ) } min ago) warningLevel=${ entry.warningLevel }` );

        if ( entry.warningLevel === 3 && inactiveMs >= removeMs ) {
            services.afkService.setWarningLevel( dj.uuid, 4 );
            const isCurrentlyPlaying = djs[ 0 ]?.uuid === dj.uuid;
            if ( isCurrentlyPlaying ) {
                services.afkService.setPendingRemoval( dj.uuid );
                await services.messageService.sendResponse(
                    `⏳ ${ nickname } is AFK and will be removed from the decks after their current song ends.`,
                    { responseChannel: 'public', services }
                );
            } else {
                await services.hangSocketServices.removeDj( services.socket, dj.uuid );
                await services.messageService.sendResponse(
                    `🚫 ${ nickname } has been removed from the decks for being AFK for ${ inactiveMinutes } minutes.`,
                    { responseChannel: 'public', services }
                );
            }
        } else if ( entry.warningLevel < 3 && inactiveMs >= warn3Ms ) {
            services.afkService.setWarningLevel( dj.uuid, 3 );
            await services.messageService.sendResponse(
                `⚠️ ${ mention }, third AFK warning — inactive for ${ inactiveMinutes } minutes. Moderators may remove you from the decks shortly.`,
                { responseChannel: 'public', services }
            );
        } else if ( entry.warningLevel < 2 && inactiveMs >= warn2Ms ) {
            services.afkService.setWarningLevel( dj.uuid, 2 );
            await services.messageService.sendResponse(
                `⚠️ ${ mention }, second AFK warning — inactive for ${ inactiveMinutes } minutes. Please show some activity.`,
                { responseChannel: 'public', services }
            );
        } else if ( entry.warningLevel < 1 && inactiveMs >= warn1Ms ) {
            services.afkService.setWarningLevel( dj.uuid, 1 );
            await services.messageService.sendResponse(
                `⚠️ ${ mention }, you have been inactive for ${ inactiveMinutes } minutes. Please show some activity to stay on the decks.`,
                { responseChannel: 'public', services }
            );
        }
    }
}

module.exports = { runAfkMonitorTick, TICK_INTERVAL_MS };
