/**
 * Stub for the `server-only` package under vitest.
 *
 * `server-only` throws when its module is imported outside a React Server
 * Component, which is exactly the guard we want in the app — but it also makes
 * server modules unimportable in Node tests. Aliasing it to this no-op (see
 * `vitest.config.ts`) keeps the guard in production builds while letting the
 * unit tests exercise the real server modules.
 */
export {};
