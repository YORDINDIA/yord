/**
 * `server-only` resolves to a module that throws on import when it is pulled
 * into a client bundle, and to nothing at all on the server. Next picks the
 * right one per bundle; vitest runs in node with the browser condition, so it
 * would get the throwing one and every suite that imports a server module would
 * fail to load.
 *
 * Aliasing it to this empty module (see `vitest.config.ts`) keeps the marker
 * meaningful where it matters — the client bundle — and invisible in tests.
 * Nothing else belongs in this file.
 */
export {};
