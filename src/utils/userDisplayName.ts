import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';

/**
 * Gets the name to show for a user outside of user management: the display name the server got from the identity
 * provider when there is one, the user name otherwise. User management (the dashboard) shows the user name.
 * @param user The user.
 * @returns The name to show, or undefined when the user has none.
 */
export function getUserDisplayName(user?: UserDto | null): string | undefined {
    if (!user) return undefined;

    // DisplayName is set by this fork's server; the generated SDK types do not know it.
    const displayName = (user as UserDto & { DisplayName?: string | null }).DisplayName;
    return (displayName?.trim() || user.Name) ?? undefined;
}
