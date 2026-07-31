/** Shared button styles per DESIGN.md — Lovable-inspired inset-shadow system. */

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-midnight px-4 py-2 font-sans text-sm font-medium text-paper shadow-[inset_0_0.5px_0_0_rgba(255,255,255,0.2),inset_0_0_0_0.5px_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.05)] transition-opacity hover:opacity-85 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:shadow-[0_4px_12px_rgba(0,0,0,0.1)]';

export const BTN_GHOST =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-ink/40 bg-transparent px-4 py-2 font-sans text-sm font-medium text-ink transition-opacity hover:opacity-85 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:shadow-[0_4px_12px_rgba(0,0,0,0.1)]';

export const BTN_PILL =
  'inline-flex h-9 w-9 items-center justify-center rounded-full bg-paper text-ink shadow-[inset_0_0.5px_0_0_rgba(255,255,255,0.2),inset_0_0_0_0.5px_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.05)] transition-opacity hover:opacity-85 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:shadow-[0_4px_12px_rgba(0,0,0,0.1)]';
