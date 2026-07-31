type GlowColor = 'blue' | 'midnight' | 'yellow';

const COLORS: Record<GlowColor, string> = {
  blue: 'rgba(91,141,239,0.28)',
  midnight: 'rgba(20,33,61,0.20)',
  yellow: 'rgba(244,211,94,0.32)',
};

/** Soft, heavily-blurred accent blob anchored to a section edge — free-floating, no hard boundary. */
export function SectionGlow({ side, color }: { side: 'left' | 'right'; color: GlowColor }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute top-1/2 -z-10 h-96 w-96 -translate-y-1/2 rounded-full blur-[110px] ${
        side === 'left' ? '-left-32' : '-right-32'
      }`}
      style={{ background: COLORS[color] }}
    />
  );
}
