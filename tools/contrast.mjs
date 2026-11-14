// The kit's muted grey (#8c8c90 on light, #6e6e6e on dark) is under the 4.5:1 that WCAG AA
// asks of body text. The kit only uses it for text, so every page darkens (or lightens) it here.
// Load it after ISO_CSS (in the page body) so it wins at the same specificity.
// Light #646468 is 5.3:1 on the page and 5.7:1 on the card; dark #8c8c90 is 5.9:1 and 5.6:1.
export const CONTRAST_CSS = `.iso{--anatomy-muted:#8c8c90}.iso[data-theme="light"]{--anatomy-muted:#646468}`;
