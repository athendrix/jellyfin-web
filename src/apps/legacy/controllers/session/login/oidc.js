/**
 * OpenID Connect login against the Jellyfin server.
 * @module apps/legacy/controllers/session/login/oidc
 */

import globalize from 'lib/globalize';

const PendingLoginKey = 'oidcLoginPending';

const ErrorMessages = {
    ProviderError: 'OidcErrorProviderError',
    ProviderUnavailable: 'OidcErrorProviderUnavailable',
    InvalidState: 'OidcErrorInvalidState',
    AccessDenied: 'OidcErrorAccessDenied',
    MissingUsername: 'OidcErrorMissingUsername',
    InvalidUsername: 'OidcErrorInvalidUsername'
};

/**
 * Gets how users log in to the server.
 * @param {import('@jellyfin/sdk').Api} api The API of the server.
 * @returns {Promise<{Enabled: boolean, PasswordLoginEnabled: boolean, ProviderName?: string}>} The login options.
 */
export async function getOidcConfig(api) {
    try {
        const { data } = await api.axiosInstance.get(api.getUri('/Oidc/Config'));
        return {
            Enabled: data?.Enabled === true,
            PasswordLoginEnabled: data?.PasswordLoginEnabled !== false,
            ProviderName: typeof data?.ProviderName === 'string' ? data.ProviderName : undefined
        };
    } catch (error) {
        // Servers without OpenID Connect support do not have the endpoint.
        console.debug('[OIDC] login options unavailable, assuming password login', error);
        return { Enabled: false, PasswordLoginEnabled: true };
    }
}

/**
 * Sends the browser to the identity provider. The server sends it back to the login page when done.
 * @param {import('@jellyfin/sdk').Api} api The API of the server.
 */
export function startOidcLogin(api) {
    const url = api.getUri('/Oidc/Start', {
        deviceId: api.deviceInfo.id,
        deviceName: api.deviceInfo.name,
        client: api.clientInfo.name,
        version: api.clientInfo.version
    });

    // Remember that this tab started a login, so a login result it did not ask for is not accepted.
    try {
        window.sessionStorage.setItem(PendingLoginKey, String(Date.now()));
    } catch (error) {
        console.debug('[OIDC] unable to remember the pending login', error);
    }

    // A full-page navigation, not a popup: the desktop app does not support popups, and the server binds the
    // login to this browser with a cookie.
    window.location.href = url;
}

/**
 * Checks, and forgets, that this tab started a login.
 * @returns {boolean} _true_ if this tab started a login in the last 15 minutes.
 */
export function consumePendingLogin() {
    try {
        const startedAt = Number(window.sessionStorage.getItem(PendingLoginKey));
        window.sessionStorage.removeItem(PendingLoginKey);
        return startedAt > 0 && Date.now() - startedAt < 15 * 60 * 1000;
    } catch (error) {
        console.debug('[OIDC] unable to read the pending login', error);
        return false;
    }
}

/**
 * Exchanges the one-time code of a completed login for the session.
 * @param {import('@jellyfin/sdk').Api} api The API of the server.
 * @param {string} code The one-time code.
 * @returns {Promise<Object>} The authentication result.
 */
export async function redeemOidcCode(api, code) {
    const { data } = await api.axiosInstance.post(
        api.getUri('/Oidc/Redeem'),
        { Code: code },
        // The server checks the code was issued to this device, so the device id must be sent.
        { headers: { Authorization: api.authorizationHeader } }
    );
    return data;
}

/**
 * Gets the message to show for a login error reported by the server.
 * @param {string} error The error code.
 * @returns {string} The translated message.
 */
export function getOidcErrorMessage(error) {
    return globalize.translate(ErrorMessages[error] || 'OidcErrorGeneric');
}

/**
 * Removes the login result from the address bar, so it is not kept in the history or reused on reload.
 * @param {string} serverId The server id.
 */
export function clearOidcParams(serverId) {
    try {
        const target = '#/login' + (serverId ? '?serverid=' + encodeURIComponent(serverId) : '');
        window.history.replaceState(window.history.state, '', target);
    } catch (error) {
        console.debug('[OIDC] unable to clear the address bar', error);
    }
}
