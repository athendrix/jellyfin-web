import type { Api } from '@jellyfin/sdk/lib/api';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { getOidcConfig } from 'apps/legacy/controllers/session/login/oidc';

import { useApi } from './useApi';

export const getOidcConfigQuery = (
    api?: Api
) => queryOptions({
    queryKey: [ 'Oidc', 'Config', api?.basePath ],
    queryFn: () => getOidcConfig(api!),
    enabled: !!api,
    staleTime: 5 * 60 * 1000
});

/**
 * How users log in to the server: single sign-on, and whether passwords are used at all.
 */
export const useOidcConfig = () => {
    const { api } = useApi();
    return useQuery(getOidcConfigQuery(api));
};
