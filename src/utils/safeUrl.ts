/**
 * Whether a URL is an http(s) web address. Links built from metadata (homepages, external links, image results) are
 * only rendered or opened when they are, so a javascript:, data:, file: or other scheme cannot be used.
 * @param url The URL.
 * @returns _true_ for http: and https: URLs.
 */
export function isWebUrl(url: string | URL | null | undefined): boolean {
    if (!url) return false;
    try {
        const { protocol } = typeof url === 'string' ? new URL(url) : url;
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Makes a URL safe inside CSS url('...'): characters that could end the url() are percent-encoded.
 * @param url The URL.
 * @returns The URL with quotes, parentheses, backslashes and whitespace encoded.
 */
export function encodeCssUrl(url: string): string {
    return url.replace(/['"()\\\s]/g, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'));
}
