import type { Hono } from 'hono';

/**
 * The proxy's Hono app is type-checked by the root tsconfig, which targets Bun
 * and omits DOM. Re-checking its sources under this Next.js program resolves
 * Hono's context generics differently and produces spurious errors, so the
 * route handlers see it through this boundary type instead.
 */
export declare const app: Hono;
