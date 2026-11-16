import type { PetAction, PetSpecies, PetWellness } from '../health/types';
import { EXPRESSIONS, SPRITES } from './sprites';
import type { ResolvedAction } from './commands';

/** Renders a pixel sprite as crisp SVG rects. Expression = wellness; animation = action. */
export function PetSprite({
  species,
  wellness,
  animation,
  size = 160,
  label,
}: {
  species: PetSpecies;
  wellness: PetWellness;
  animation?: ResolvedAction['animation'] | PetAction;
  size?: number;
  label: string;
}) {
  const { grid, palette } = SPRITES[species];
  const rects: JSX.Element[] = [];
  grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== '.') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={palette[ch]} />);
    }),
  );
  for (const [x, y, key] of EXPRESSIONS[wellness]) {
    rects.push(<rect key={`f${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={palette[key] ?? palette.o} />);
  }
  const idle = species === 'axolotl' ? 'anim-idle-float' : 'anim-idle';
  const anim = animation && animation !== 'idle' ? `anim-${animation}` : idle;
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        shapeRendering="crispEdges"
        role="img"
        aria-label={label}
        className={`pixelated ${anim}`}
      >
        {rects}
      </svg>
      {animation === 'pet' || animation === 'gills' ? (
        <span aria-hidden className="anim-heart absolute -top-1 right-2 text-lg text-[#F4A7B9]">♥</span>
      ) : null}
      {species === 'axolotl' && animation === 'float' ? (
        <span aria-hidden className="anim-bubbles absolute top-2 left-1 text-sm text-cyan/80">∘ ° ∘</span>
      ) : null}
      {wellness === 'tired' ? (
        <span aria-hidden className="font-pixel absolute top-0 right-0 text-xs text-text-muted">z z</span>
      ) : null}
    </div>
  );
}
