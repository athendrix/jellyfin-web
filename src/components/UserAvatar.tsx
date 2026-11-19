import React, { type FC } from 'react';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import Avatar, { type AvatarProps } from '@mui/material/Avatar';
import type {} from '@mui/material/themeCssVarsAugmentation';

import { useApi } from 'hooks/useApi';
import { getUserDisplayName } from 'utils/userDisplayName';

interface UserAvatarProps extends AvatarProps {
    user?: UserDto,
    size?: number
}

const UserAvatar: FC<UserAvatarProps> = ({
    user,
    size
}) => {
    const { api } = useApi();
    const imageUrl = api ? getImageApi(api).getUserImageUrl(user) : undefined;

    return user ? (
        <Avatar
            alt={getUserDisplayName(user)}
            src={imageUrl}
            sx={(theme) => ({
                bgcolor: imageUrl ?
                    theme.vars.palette.background.paper :
                    theme.vars.palette.primary.dark,
                color: 'inherit',
                width: size,
                height: size
            })}
        />
    ) : null;
};

export default UserAvatar;
