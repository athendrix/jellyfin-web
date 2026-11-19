/**
 * Module that shows which SyncPlay group members the group is waiting for, and how far along they are.
 * @module components/syncPlay/ui/WaitStatusOverlay
 */

import globalize from '../../../lib/globalize';
import Events from '../../../utils/events.ts';
import './waitStatusOverlay.scss';

/**
 * Time after which the "start now" button is offered, in milliseconds.
 */
const StartNowDelay = 15000;

/**
 * Time the panel lingers once everyone is ready, in milliseconds, so the last change is visible.
 */
const HideDelay = 1200;

const StageStrings = {
    Unknown: 'SyncPlayWaitStageWaiting',
    Loading: 'SyncPlayWaitStageLoading',
    Buffering: 'SyncPlayWaitStageBuffering',
    Seeking: 'SyncPlayWaitStageSeeking',
    Ready: 'SyncPlayWaitStageReady'
};

function formatElapsed(millis) {
    const totalSeconds = Math.max(0, Math.floor(millis / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function createElement(tag, className, text) {
    const elem = document.createElement(tag);
    if (className) elem.className = className;
    // Names come from other users: always set them as text, never as markup.
    if (text !== undefined) elem.textContent = text;
    return elem;
}

/**
 * Class that renders the SyncPlay wait status.
 */
class WaitStatusOverlay {
    constructor(syncPlayManager) {
        this.manager = syncPlayManager;
        this.status = null;
        this.element = null;
        this.tickInterval = null;
        this.hideTimeout = null;

        Events.on(this.manager, 'wait-status', (_event, status) => this.update(status));
        Events.on(this.manager, 'enabled', (_event, enabled) => {
            if (!enabled) this.update(null);
        });
    }

    /**
     * Whether the status describes a group that is waiting for somebody.
     * @param {Object|null} status The wait status.
     * @returns {boolean} _true_ if the panel should be visible.
     */
    static isWaiting(status) {
        return !!status
            && status.State === 'Waiting'
            && Array.isArray(status.Members)
            && status.Members.some(m => !m.IsReady && !m.IsIgnoringWait);
    }

    ensureElement() {
        if (this.element) return this.element;

        const root = createElement('div', 'syncPlayWaitStatus syncPlayWaitStatus-hidden');
        root.setAttribute('role', 'status');
        root.setAttribute('aria-live', 'polite');

        const title = createElement('div', 'syncPlayWaitStatus-title');
        this.titleText = createElement('span', null, '');
        this.elapsedText = createElement('span', 'syncPlayWaitStatus-elapsed', '');
        title.appendChild(this.titleText);
        title.appendChild(this.elapsedText);

        this.membersContainer = createElement('div', 'syncPlayWaitStatus-members');

        const actions = createElement('div', 'syncPlayWaitStatus-actions');
        this.startNowButton = createElement('button', 'syncPlayWaitStatus-startNow', globalize.translate('SyncPlayWaitStartNow'));
        this.startNowButton.type = 'button';
        this.startNowButton.addEventListener('click', () => {
            // An unpause while the group waits starts playback for the members that are ready.
            this.manager.getController().unpause();
        });
        actions.appendChild(this.startNowButton);

        root.appendChild(title);
        root.appendChild(this.membersContainer);
        root.appendChild(actions);
        document.body.appendChild(root);

        this.element = root;
        return root;
    }

    getWaitingSinceLocal() {
        const since = this.status?.WaitingSince;
        if (!(since instanceof Date) || isNaN(since.getTime())) return null;

        try {
            return this.manager.getTimeSyncCore().remoteDateToLocal(since);
        } catch {
            return since;
        }
    }

    update(status) {
        this.status = status;

        if (WaitStatusOverlay.isWaiting(status)) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
            this.render();
            this.element.classList.remove('syncPlayWaitStatus-hidden');

            if (!this.tickInterval) {
                this.tickInterval = setInterval(() => this.renderElapsed(), 1000);
            }
            return;
        }

        if (!this.element || this.element.classList.contains('syncPlayWaitStatus-hidden')) {
            this.stopTicking();
            return;
        }

        // Show the final state briefly (everyone ready), then get out of the way.
        if (status?.Members) this.render();
        clearTimeout(this.hideTimeout);
        this.hideTimeout = setTimeout(() => {
            this.element.classList.add('syncPlayWaitStatus-hidden');
            this.stopTicking();
        }, status ? HideDelay : 0);
    }

    stopTicking() {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
    }

    renderElapsed() {
        if (!this.element) return;

        const sinceLocal = this.getWaitingSinceLocal();
        const elapsed = sinceLocal ? Date.now() - sinceLocal.getTime() : null;
        this.elapsedText.textContent = elapsed === null ? '' : formatElapsed(elapsed);
        this.startNowButton.hidden = !(WaitStatusOverlay.isWaiting(this.status) && elapsed !== null && elapsed >= StartNowDelay);
    }

    render() {
        this.ensureElement();

        const members = this.status?.Members || [];
        const waitingFor = members.filter(m => !m.IsReady && !m.IsIgnoringWait).length;
        this.titleText.textContent = waitingFor > 0 ?
            globalize.translate('SyncPlayWaitTitle', waitingFor) :
            globalize.translate('SyncPlayWaitEveryoneReady');

        while (this.membersContainer.firstChild) {
            this.membersContainer.removeChild(this.membersContainer.firstChild);
        }
        for (const member of members) {
            this.membersContainer.appendChild(this.renderMember(member));
        }
        this.renderElapsed();
    }

    renderMember(member) {
        const row = createElement('div', 'syncPlayWaitStatus-member');
        if (member.IsReady) row.classList.add('syncPlayWaitStatus-ready');
        if (member.IsStalled) row.classList.add('syncPlayWaitStatus-stalled');

        const line = createElement('div', 'syncPlayWaitStatus-memberLine');
        const name = createElement('span', 'syncPlayWaitStatus-name', member.UserName || '');
        if (member.DeviceName) {
            name.appendChild(document.createTextNode(' '));
            name.appendChild(createElement('span', 'syncPlayWaitStatus-device', `(${member.DeviceName})`));
        }

        let stageText;
        if (member.IsReady) {
            stageText = globalize.translate('SyncPlayWaitStageReady');
        } else if (member.IsIgnoringWait) {
            stageText = globalize.translate('SyncPlayWaitStageNotFollowing');
        } else if (member.IsStalled) {
            stageText = globalize.translate('SyncPlayWaitStageNotResponding');
        } else {
            stageText = globalize.translate(StageStrings[member.Stage] || StageStrings.Unknown);
            if (typeof member.Progress === 'number') {
                stageText += ` ${Math.round(member.Progress * 100)}%`;
            }
        }
        const stage = createElement('span', 'syncPlayWaitStatus-stage', stageText);

        line.appendChild(name);
        line.appendChild(stage);

        const bar = createElement('div', 'syncPlayWaitStatus-bar');
        const fill = createElement('div', 'syncPlayWaitStatus-barFill');
        if (member.IsReady) {
            fill.style.width = '100%';
        } else if (typeof member.Progress === 'number') {
            fill.style.width = `${Math.round(member.Progress * 100)}%`;
        } else if (!member.IsStalled && !member.IsIgnoringWait) {
            bar.classList.add('syncPlayWaitStatus-indeterminate');
        } else {
            fill.style.width = '0%';
        }
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-label', member.UserName || '');
        if (typeof member.Progress === 'number' || member.IsReady) {
            bar.setAttribute('aria-valuemin', '0');
            bar.setAttribute('aria-valuemax', '100');
            bar.setAttribute('aria-valuenow', String(member.IsReady ? 100 : Math.round(member.Progress * 100)));
        }
        bar.appendChild(fill);

        row.appendChild(line);
        row.appendChild(bar);
        return row;
    }
}

export default WaitStatusOverlay;
