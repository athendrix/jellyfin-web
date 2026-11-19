import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('lib/globalize', () => ({
    default: { translate: (key) => key }
}));

import { consumePendingLogin, getOidcConfig, getOidcErrorMessage, redeemOidcCode, startOidcLogin } from 'apps/legacy/controllers/session/login/oidc';

function createApi(overrides = {}) {
    return {
        deviceInfo: { id: 'device 1', name: 'Living room' },
        clientInfo: { name: 'Jellyfin Web', version: '13.0.0' },
        authorizationHeader: 'MediaBrowser DeviceId="device 1"',
        getUri: (path, params) => {
            const url = new URL('https://jellyfin.example.com' + path);
            for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);
            return url.toString();
        },
        axiosInstance: { get: vi.fn(), post: vi.fn() },
        ...overrides
    };
}

describe('OIDC login helpers', () => {
    const originalLocation = window.location;

    afterEach(() => {
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    });

    it('falls back to password login when the server has no OIDC support', async () => {
        const api = createApi();
        api.axiosInstance.get.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }));

        await expect(getOidcConfig(api)).resolves.toEqual({ Enabled: false, PasswordLoginEnabled: true });
    });

    it('does not assume password login when the server cannot be reached', async () => {
        const api = createApi();
        api.axiosInstance.get.mockRejectedValue(Object.assign(new Error('Bad gateway'), { response: { status: 502 } }));

        await expect(getOidcConfig(api)).rejects.toThrow('Bad gateway');
    });

    it('reads the login options', async () => {
        const api = createApi();
        api.axiosInstance.get.mockResolvedValue({ data: { Enabled: true, PasswordLoginEnabled: false, ProviderName: 'Charon' } });

        await expect(getOidcConfig(api)).resolves.toEqual({ Enabled: true, PasswordLoginEnabled: false, ProviderName: 'Charon' });
    });

    it('starts the login with a full-page navigation carrying the device', () => {
        const location = { href: '' };
        Object.defineProperty(window, 'location', { configurable: true, value: location });

        startOidcLogin(createApi());

        const url = new URL(location.href);
        expect(url.pathname).toBe('/Oidc/Start');
        expect(url.searchParams.get('deviceId')).toBe('device 1');
        expect(url.searchParams.get('client')).toBe('Jellyfin Web');
    });

    it('accepts a login result only once, and only after starting a login', () => {
        Object.defineProperty(window, 'location', { configurable: true, value: { href: '' } });
        window.sessionStorage.clear();

        expect(consumePendingLogin()).toBe(false);

        startOidcLogin(createApi());
        expect(consumePendingLogin()).toBe(true);
        expect(consumePendingLogin()).toBe(false);
    });

    it('redeems the code with the device authorization header', async () => {
        const api = createApi();
        api.axiosInstance.post.mockResolvedValue({ data: { AccessToken: 'token', ServerId: 'server' } });

        await expect(redeemOidcCode(api, 'code-1')).resolves.toEqual({ AccessToken: 'token', ServerId: 'server' });
        expect(api.axiosInstance.post).toHaveBeenCalledWith(
            'https://jellyfin.example.com/Oidc/Redeem',
            { Code: 'code-1' },
            { headers: { Authorization: api.authorizationHeader } });
    });

    it('maps unknown errors to a generic message', () => {
        expect(getOidcErrorMessage('AccessDenied')).toBe('OidcErrorAccessDenied');
        expect(getOidcErrorMessage('<script>')).toBe('OidcErrorGeneric');
        expect(getOidcErrorMessage('constructor')).toBe('OidcErrorGeneric');
        expect(getOidcErrorMessage('__proto__')).toBe('OidcErrorGeneric');
    });
});
