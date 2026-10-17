/**
 * Keep top-level DRESSO navigation dropdowns mutually exclusive.
 *
 * WordPress may render the homepage's .dresso-top-nav dynamically or via
 * Site Editor overrides, so use a capturing listener for native <details>
 * toggle events rather than binding only to elements present at page load.
 *
 * Nested category <details> elements are intentionally left untouched.
 */
(() => {
  'use strict';

  document.addEventListener('toggle', (event) => {
    const opened = event.target;
    if (!opened || opened.tagName !== 'DETAILS' || !opened.open) return;

    // Only direct children of a primary menu are independent dropdowns.
    const nav = opened.parentElement;
    if (!nav || !nav.matches('.dresso-inner-nav, .dresso-top-nav')) return;

    for (const sibling of nav.children) {
      if (sibling !== opened && sibling.tagName === 'DETAILS' && sibling.open) {
        sibling.open = false;
      }
    }
  }, true); // <details> toggle does not bubble, but can be captured.
})();
