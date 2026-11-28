/**
 * The colour schemes every end-to-end and accessibility run must cover: the unified brief sets WCAG 2.2 AA, axe and
 * keyboard runs "in both themes". Values match Playwright's `colorScheme` option.
 */
export const COLOR_SCHEMES = ["light", "dark"] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number];
