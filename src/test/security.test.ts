import DOMPurify from 'dompurify';
import { describe, expect, it } from 'vitest';

import { encodeCssUrl, isWebUrl } from 'utils/safeUrl';
import { UNTRUSTED_HTML } from 'utils/sanitize';

describe('isWebUrl', () => {
    it('accepts http and https only', () => {
        expect(isWebUrl('https://example.com/a')).toBe(true);
        expect(isWebUrl('http://example.com')).toBe(true);
        // eslint-disable-next-line sonarjs/code-eval -- the test checks that this URL is rejected
        expect(isWebUrl('javascript:alert(1)//" onmouseover="x')).toBe(false);
        expect(isWebUrl('file:///etc/passwd')).toBe(false);
        expect(isWebUrl('x:"><img src=x onerror=alert(1)>')).toBe(false);
        expect(isWebUrl('not a url')).toBe(false);
        expect(isWebUrl(undefined)).toBe(false);
    });
});

describe('encodeCssUrl', () => {
    it('cannot end the url()', () => {
        expect(encodeCssUrl("https://x/a');background:url('//evil")).not.toMatch(/['()]/);
    });
});

describe('UNTRUSTED_HTML', () => {
    it('keeps formatting and drops forms, styles and app action attributes', () => {
        const html = '<b>bold</b> <a href="https://x">link</a>'
            + '<form action="https://evil"><input type="password" name="pw"><button>Sign in</button></form>'
            + '<div style="position:fixed;inset:0" class="itemAction" data-action="delete">x</div>'
            + '<img src=x onerror=alert(1)>';
        const clean = DOMPurify.sanitize(html, UNTRUSTED_HTML);

        expect(clean).toContain('<b>bold</b>');
        expect(clean).toContain('href="https://x"');
        expect(clean).not.toMatch(/<form|<input|<button|style=|class=|data-action|onerror/);
    });
});
