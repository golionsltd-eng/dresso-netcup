/**
 * Progressive enhancement for the static DRESSO product-category menu.
 *
 * The hardcoded links in parts/header.html remain available if the REST
 * endpoint is blocked, slow or not public. No request is issued on page load.
 * Categories are fetched only on first open. Fresh data is shared across tabs
 * for 24 hours; stale data can be used for seven days if REST fails.
 */
(() => {
  'use strict';

  const CACHE_KEY = 'dresso-product-categories-v3';
  const FAILURE_KEY = 'dresso-product-categories-retry-v3';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const FAILURE_TTL_MS = 2 * 60 * 1000;
  const MAX_PAGES = 10;
  const API_PATH = '/wp-json/wp/v2/product_cat?per_page=100&page=';

  const nav = document.querySelector('.dresso-inner-nav');
  if (!nav || !nav.querySelector('details[data-cat]')) {
    return;
  }

  let request = null;

  // The REST endpoint can return the same category ID on multiple pages.
  // Validate and deduplicate before rendering or writing the long-lived cache.
  function normalizeCategories(categories) {
    if (!Array.isArray(categories)) {
      throw new Error('Invalid category list');
    }

    const unique = new Map();
    categories.forEach((cat) => {
      if (!cat || typeof cat.name !== 'string' || !cat.name.trim() ||
          typeof cat.link !== 'string') {
        throw new Error('Invalid category record');
      }

      const id = Number(cat.id);
      const parent = Number(cat.parent);
      if (!Number.isSafeInteger(id) || id <= 0 ||
          !Number.isSafeInteger(parent) || parent < 0) {
        throw new Error('Invalid category ID or parent');
      }

      let url;
      try {
        url = new URL(cat.link, location.href);
      } catch (_) {
        throw new Error('Invalid category URL');
      }
      if (url.origin !== location.origin) {
        throw new Error('Unexpected category URL origin');
      }

      const count = Number(cat.count);
      const stockCount = Number.isFinite(count) ? Math.max(count, 0) : 0;
      const existing = unique.get(id);
      if (existing) {
        // Do not cache a partial/inconsistent hierarchy if paginated
        // responses disagree about the same category.
        if (existing.parent !== parent || existing.link !== url.href) {
          throw new Error('Conflicting category records for ID ' + id);
        }
        // Keep a category visible if one paginated result reports products.
        existing.count = Math.max(existing.count, stockCount);
        return;
      }

      unique.set(id, {
        id,
        parent,
        name: cat.name,
        link: url.href,
        count: stockCount
      });
    });
    return Array.from(unique.values());
  }

  function fromCache(allowStale = false) {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!saved || !Array.isArray(saved.data) || !Number.isFinite(saved.savedAt)) {
        return null;
      }
      const age = Date.now() - saved.savedAt;
      const ttl = allowStale ? STALE_TTL_MS : CACHE_TTL_MS;
      return age >= 0 && age < ttl ? normalizeCategories(saved.data) : null;
    } catch (_) {
      return null;
    }
  }

  function saveCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        data
      }));
      localStorage.removeItem(FAILURE_KEY);
    } catch (_) {
      // Storage can be blocked or full; the static links still work.
    }
  }

  function recentlyFailed() {
    try {
      return Number(localStorage.getItem(FAILURE_KEY)) > Date.now();
    } catch (_) {
      return false;
    }
  }

  function rememberFailure() {
    try {
      localStorage.setItem(FAILURE_KEY, String(Date.now() + FAILURE_TTL_MS));
    } catch (_) {
      // Failed API requests are handled safely without persistent storage.
    }
  }

  async function fetchCategories() {
    const fresh = fromCache();
    if (fresh) {
      return fresh;
    }

    const stale = fromCache(true);
    if (recentlyFailed()) {
      return stale;
    }

    try {
      const first = await fetch(API_PATH + '1', { credentials: 'same-origin' });
    if (!first.ok) {
      throw new Error('Category endpoint HTTP ' + first.status);
    }

    const pages = Number(first.headers.get('X-WP-TotalPages') || 1);
    const result = await first.json();

    if (!Array.isArray(result) || !Number.isInteger(pages) ||
        pages < 1 || pages > MAX_PAGES ||
        (!first.headers.has('X-WP-TotalPages') && result.length === 100)) {
      // Never replace the complete static menu with incomplete REST data.
      throw new Error('Category response cannot be safely paginated');
    }

    for (let page = 2; page <= pages; page++) {
      const response = await fetch(API_PATH + page, { credentials: 'same-origin' });
      if (!response.ok) {
        throw new Error('Category endpoint HTTP ' + response.status);
      }
      const categories = await response.json();
      if (!Array.isArray(categories)) {
        throw new Error('Invalid category response');
      }
      result.push(...categories);
    }

      const unique = normalizeCategories(result);
      saveCache(unique);
      return unique;
    } catch (error) {
      rememberFailure();
      if (stale) {
        return stale;
      }
      throw error;
    }
  }

  function renderCategories(categories) {
    const byParent = new Map();
    const byId = new Map();

    categories.forEach((cat) => {
      if (!cat || !Number.isInteger(Number(cat.id)) ||
          !Number.isInteger(Number(cat.parent)) ||
          typeof cat.name !== 'string' || typeof cat.link !== 'string') {
        return;
      }

      const id = Number(cat.id);
      const parent = Number(cat.parent);
      // Preserve same-origin navigational destinations.
      let link;
      try {
        link = new URL(cat.link, location.href);
        if (link.origin !== location.origin) return;
      } catch (_) {
        return;
      }

      if (byId.has(id)) return;
      const clean = { id, parent, name: cat.name, link: link.href, count: Number(cat.count) || 0 };
      byId.set(id, clean);
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(clean);
    });

    function visible(cat, seen = new Set()) {
      if (cat.count > 0) return true;
      if (seen.has(cat.id)) return false;
      const next = new Set(seen);
      next.add(cat.id);
      return (byParent.get(cat.id) || []).some((child) => visible(child, next));
    }

    function items(parentId, depth, seen = new Set()) {
      const fragment = document.createDocumentFragment();
      if (depth > 8 || seen.has(parentId)) return fragment;

      const next = new Set(seen);
      next.add(parentId);
      const children = (byParent.get(parentId) || [])
        .filter((cat) => visible(cat, next))
        .sort((a, b) => a.name.localeCompare(b.name));

      children.forEach((cat) => {
        const a = document.createElement('a');
        a.href = cat.link;
        a.textContent = cat.name;
        const nested = items(cat.id, depth + 1, next);

        if (nested.childNodes.length > 0) {
          const detail = document.createElement('details');
          detail.className = 'dresso-inner-node';
          const summary = document.createElement('summary');
          summary.append(a);
          const inner = document.createElement('div');
          inner.className = 'dresso-inner-children';
          inner.append(nested);
          detail.append(summary, inner);
          fragment.append(detail);
        } else {
          fragment.append(a);
        }
      });
      return fragment;
    }

    nav.querySelectorAll('details[data-cat]').forEach((detail) => {
      const id = Number(detail.dataset.cat);
      const root = byId.get(id);
      const panel = detail.querySelector('.dresso-inner-panel');
      if (!root || !panel) return;

      const nodes = items(id, 1);
      if (!nodes.childNodes.length) return;

      const allLink = document.createElement('a');
      allLink.href = root.link;
      const label = detail.querySelector('summary');
      allLink.textContent = 'ALL ' + (label ? label.textContent.trim() : root.name);
      panel.replaceChildren(allLink, nodes);
    });
  }

  function enhance() {
    if (!request) {
      request = fetchCategories()
        .then((categories) => {
          if (categories) renderCategories(categories);
        })
        .catch((err) => {
          if (window.console && console.warn) {
            console.warn('DRESSO: preserving static category menu:', err.message);
          }
        });
    }
  }

  nav.querySelectorAll('details[data-cat]').forEach((detail) => {
    detail.addEventListener('toggle', () => {
      if (detail.open) enhance();
    });
    if (detail.open) enhance();
  });
})();
