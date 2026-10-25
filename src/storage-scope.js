// Keep this fixed for the page lifetime, including fullscreen and installation changes.
export const STORAGE_PREFIX = globalThis.matchMedia?.('(display-mode: standalone)')?.matches
  ? 'pl.solitaire.pwa'
  : 'pl.solitaire.browser';
