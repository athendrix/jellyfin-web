/**
 * DOMPurify options for HTML that comes from metadata, subtitles or other users (overviews, subtitle cues, dialog
 * text with item names). DOMPurify's defaults remove scripts but keep forms, inputs, buttons, styles, classes and
 * data attributes, which is enough to draw a convincing fake sign-in form over the page or to trigger the app's own
 * actions. This keeps text formatting and links only.
 */
export const UNTRUSTED_HTML = {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- DOMPurify option name
    FORBID_TAGS: [ 'style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'label', 'fieldset', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'dialog' ],
    // eslint-disable-next-line @typescript-eslint/naming-convention -- DOMPurify option name
    FORBID_ATTR: [ 'style', 'class', 'id', 'name', 'action', 'formaction', 'target' ],
    // eslint-disable-next-line @typescript-eslint/naming-convention -- DOMPurify option name
    ALLOW_DATA_ATTR: false
};
