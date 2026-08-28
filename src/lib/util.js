/*
 * Shared helpers. Loaded into the service worker with importScripts(), so this
 * is a classic script that hangs everything off globalThis.
 */
(function (root) {
  'use strict';

  /** FNV-1a, hex. Stable across sessions - used to build cache keys. */
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  /** Collapse whitespace and trim, so the same mail hashes the same either way. */
  function norm(str) {
    return (str || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Cache keys for one email. Gmail exposes a thread id in both the list and the
   * conversation view, so that is the primary key; the sender+subject digest is
   * a fallback for the cases where the DOM does not carry one.
   */
  function cacheKeys(email) {
    const keys = [];
    if (email.threadId) keys.push('t:' + email.threadId);
    keys.push('h:' + hash(norm(email.senderEmail || email.senderName) + ' ' + norm(email.subject)));
    return keys;
  }

  function clamp(n, lo, hi) {
    if (typeof n !== 'number' || Number.isNaN(n)) return lo;
    return Math.min(hi, Math.max(lo, n));
  }

  function truncate(str, max) {
    const s = str || '';
    return s.length > max ? s.slice(0, max) + ' [truncated]' : s;
  }

  root.MailLensUtil = { hash, norm, cacheKeys, clamp, truncate };
})(typeof self !== 'undefined' ? self : globalThis);
