import { describe, expect, it } from 'vitest';

import { getUserDisplayName } from 'utils/userDisplayName';

describe('getUserDisplayName', () => {
    it('prefers the display name', () => {
        expect(getUserDisplayName({ Name: 'andrew@example.com', DisplayName: 'Andy' } as never)).toBe('Andy');
    });

    it('falls back to the user name', () => {
        expect(getUserDisplayName({ Name: 'andrew@example.com' })).toBe('andrew@example.com');
        expect(getUserDisplayName({ Name: 'andrew@example.com', DisplayName: '  ' } as never)).toBe('andrew@example.com');
        expect(getUserDisplayName()).toBeUndefined();
    });
});
