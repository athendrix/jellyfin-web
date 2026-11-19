import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/globalize', () => ({
    default: {
        translate: (key, ...args) => [key, ...args].join(':')
    }
}));

import Events from '../../../utils/events.ts';
import WaitStatusOverlay from './WaitStatusOverlay';

function createManager() {
    return {
        getController: () => ({ unpause: vi.fn() }),
        getTimeSyncCore: () => ({ remoteDateToLocal: (date) => date })
    };
}

function waitingStatus(members) {
    return {
        State: 'Waiting',
        WaitingSince: new Date(Date.now() - 20000),
        Members: members
    };
}

describe('WaitStatusOverlay', () => {
    it('is shown only while somebody followed by the group is not ready', () => {
        expect(WaitStatusOverlay.isWaiting(null)).toBe(false);
        expect(WaitStatusOverlay.isWaiting({ State: 'Playing', Members: [{ IsReady: false }] })).toBe(false);
        expect(WaitStatusOverlay.isWaiting(waitingStatus([{ IsReady: true }]))).toBe(false);
        expect(WaitStatusOverlay.isWaiting(waitingStatus([{ IsReady: false, IsIgnoringWait: true }]))).toBe(false);
        expect(WaitStatusOverlay.isWaiting(waitingStatus([{ IsReady: true }, { IsReady: false }]))).toBe(true);
    });

    it('renders one progress row per member and keeps names as text', () => {
        const manager = createManager();
        new WaitStatusOverlay(manager);

        Events.trigger(manager, 'wait-status', [waitingStatus([
            { UserName: 'alice', DeviceName: 'Desktop', IsReady: true, Stage: 'Ready', Progress: 1 },
            { UserName: '<img src=x onerror=alert(1)>', DeviceName: 'Laptop', IsReady: false, Stage: 'Buffering', Progress: 0.42 },
            { UserName: 'carol', DeviceName: 'Browser', IsReady: false, Stage: 'Loading', Progress: null }
        ])]);

        const root = document.querySelector('.syncPlayWaitStatus');
        expect(root).not.toBeNull();
        expect(root.classList.contains('syncPlayWaitStatus-hidden')).toBe(false);

        const rows = root.querySelectorAll('.syncPlayWaitStatus-member');
        expect(rows).toHaveLength(3);
        expect(root.querySelector('img')).toBeNull();
        expect(rows[1].textContent).toContain('<img src=x onerror=alert(1)>');
        expect(rows[1].querySelector('.syncPlayWaitStatus-barFill').style.width).toBe('42%');
        expect(rows[1].textContent).toContain('42%');
        expect(rows[2].querySelector('.syncPlayWaitStatus-indeterminate')).not.toBeNull();
        expect(root.querySelector('.syncPlayWaitStatus-title').textContent).toContain('SyncPlayWaitTitle:2');

        // Waiting for 20 seconds: the group can be started without the slow members.
        expect(root.querySelector('.syncPlayWaitStatus-startNow').hidden).toBe(false);

        root.remove();
    });
});
