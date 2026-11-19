/**
 * Module that tells the SyncPlay group how far along this client is in loading the media.
 * @module components/syncPlay/core/LoadProgressReporter
 */

import * as Helper from './Helper';

/**
 * Interval between two reports, in milliseconds.
 * The server treats every report as a sign of life, so this must stay well under its stall timeout.
 */
const ReportInterval = 1000;

/**
 * How much media must be buffered ahead of the playback position to count as fully buffered, in milliseconds.
 */
const BufferTargetMillis = 10000;

/**
 * Load stages, matching GroupMemberLoadStage on the server.
 */
export const LoadStage = {
    Loading: 'Loading',
    Buffering: 'Buffering',
    Seeking: 'Seeking'
};

/**
 * Class that reports the loading progress of this client while the group waits for it.
 */
class LoadProgressReporter {
    constructor() {
        this.manager = null;
        this.stage = null;
        this.interval = null;
        this.unsupported = false;
    }

    /**
     * Initializes the reporter.
     * @param {Manager} syncPlayManager The SyncPlay manager.
     */
    init(syncPlayManager) {
        this.manager = syncPlayManager;
    }

    /**
     * Starts (or keeps) reporting, with the given stage.
     * @param {string} stage One of {@link LoadStage}.
     */
    start(stage) {
        this.stage = stage;

        if (!this.interval) {
            this.interval = setInterval(() => this.report(), ReportInterval);
        }

        this.report();
    }

    /**
     * Stops reporting, once this client is ready or no longer follows the group.
     */
    stop() {
        this.stage = null;

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    /**
     * Gets whether the reporter is running.
     * @returns {boolean} _true_ if reporting.
     */
    isActive() {
        return this.interval !== null;
    }

    /**
     * Estimates how far along the player is, between 0 and 1, or null when it cannot tell.
     * @returns {Promise<number|null>} The progress.
     */
    async estimateProgress() {
        const playerWrapper = this.manager.getPlayerWrapper();
        if (!this.manager.isPlaybackActive()) {
            return null;
        }

        // Players that know their own buffering state (such as the desktop app's mpv player) report it directly.
        const player = playerWrapper.player;
        if (player && typeof player.getSyncPlayLoadProgress === 'function') {
            const progress = player.getSyncPlayLoadProgress();
            if (typeof progress === 'number' && isFinite(progress)) {
                return Math.min(1, Math.max(0, progress));
            }
        }

        // Otherwise, compare how much is buffered ahead of the playback position with what we want buffered.
        if (!player || typeof player.getBufferedRanges !== 'function') {
            return null;
        }

        const ranges = player.getBufferedRanges() || [];
        const positionMillis = playerWrapper.currentTimeAsync ?
            await playerWrapper.currentTimeAsync() :
            playerWrapper.currentTime();
        if (typeof positionMillis !== 'number' || !isFinite(positionMillis)) {
            return null;
        }

        const positionTicks = positionMillis * Helper.TicksPerMillisecond;
        // Allow for a range that starts a little after the position, as players report keyframe-aligned ranges.
        const slackTicks = 1000 * Helper.TicksPerMillisecond;
        const range = ranges.find(r => r.start <= positionTicks + slackTicks && r.end >= positionTicks);
        if (!range) {
            return 0;
        }

        const aheadMillis = (range.end - positionTicks) / Helper.TicksPerMillisecond;
        return Math.min(1, Math.max(0, aheadMillis / BufferTargetMillis));
    }

    /**
     * Sends one report to the server.
     */
    async report() {
        if (!this.stage || !this.manager || !this.manager.isSyncPlayEnabled() || this.unsupported) {
            return;
        }

        const playlistItemId = this.manager.getQueueCore().getCurrentPlaylistItemId();
        if (!playlistItemId) {
            return;
        }

        let progress = null;
        try {
            progress = await this.estimateProgress();
        } catch (error) {
            console.debug('SyncPlay LoadProgressReporter: unable to estimate progress.', error);
        }

        // The stage may have changed while estimating.
        if (!this.stage) {
            return;
        }

        const apiClient = this.manager.getApiClient();
        try {
            await apiClient.ajax({
                type: 'POST',
                url: apiClient.getUrl('SyncPlay/LoadProgress'),
                data: JSON.stringify({
                    PlaylistItemId: playlistItemId,
                    Progress: progress,
                    Stage: this.stage
                }),
                contentType: 'application/json'
            });
        } catch (error) {
            // An older server does not have the endpoint. Stop trying, the group works as before.
            if (error && error.status === 404) {
                console.warn('SyncPlay LoadProgressReporter: server does not support load progress.');
                this.unsupported = true;
                this.stop();
            } else {
                console.debug('SyncPlay LoadProgressReporter: report failed.', error);
            }
        }
    }
}

export default LoadProgressReporter;
