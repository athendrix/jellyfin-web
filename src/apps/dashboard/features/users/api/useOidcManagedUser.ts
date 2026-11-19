import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

export interface OidcManagedUser {
    Managed: boolean;
    Name: boolean;
    Administrator: boolean;
    Libraries: boolean;
}

const NOT_MANAGED: OidcManagedUser = { Managed: false, Name: false, Administrator: false, Libraries: false };

/**
 * Which settings of a user come from the identity provider (account name, administrator rights, library access).
 * Servers without OpenID Connect support manage nothing.
 * @param userId The user id.
 * @returns The query.
 */
export const useOidcManagedUser = (userId?: string | null) => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'Oidc', 'ManagedUser', api?.basePath, userId ],
        queryFn: async () => {
            try {
                const { data } = await api!.axiosInstance.get<OidcManagedUser>(
                    api!.getUri(`/Oidc/Users/${encodeURIComponent(userId!)}`),
                    { headers: { Authorization: api!.authorizationHeader } });
                return { ...NOT_MANAGED, ...data };
            } catch {
                return NOT_MANAGED;
            }
        },
        enabled: !!api && !!userId
    });
};
