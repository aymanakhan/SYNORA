import { describe, expect, it } from 'vitest';
import {
  GESTURE_COMMANDS,
  GestureInterpreter,
  classifyFrame,
  isPointingDown,
  type GestureFrame,
  type Landmark,
} from '../features/pet-input/gestures';
import { COMMANDS } from '../features/pets/commands';

/** Synthetic 21-point hand. `index` = 'down' | 'up'; other fingers curled unless `open`. */
function hand({ wristX = 0.5, index = 'up', open = false }: { wristX?: number; index?: 'up' | 'down'; open?: boolean } = {}): Landmark[] {
  const p = (x: number, y: number) => ({ x: wristX + x, y });
  const dir = index === 'down' ? 1 : -1;
  const lm: Landmark[] = Array.from({ length: 21 }, () => p(0, 0.5));
  lm[0] = p(0, 0.5 - dir * 0.15); // wrist
  // index finger: mcp → pip → dip → tip, extended in `dir`
  lm[5] = p(0, 0.5);
  lm[6] = p(0, 0.5 + dir * 0.06);
  lm[7] = p(0, 0.5 + dir * 0.1);
  lm[8] = p(0, 0.5 + dir * 0.14);
  // middle, ring, pinky: curled (tip close to mcp) unless open
  for (const [mcp, dx] of [[9, 0.03], [13, 0.06], [17, 0.09]] as const) {
    lm[mcp] = p(dx, 0.5);
    lm[mcp + 3] = open ? p(dx, 0.5 + dir * 0.14) : p(dx, 0.5 + dir * 0.03);
  }
  return lm;
}

const frames = (spec: Partial<GestureFrame>[], step = 100): GestureFrame[] =>
  spec.map((f, i) => ({ score: 0.9, t: i * step, ...f }));
const run = (fs: GestureFrame[], g = new GestureInterpreter()) => fs.map((f) => g.push(f)?.command).filter(Boolean);
const repeat = <T,>(n: number, x: T) => Array.from({ length: n }, () => x);

describe('gesture mapping', () => {
  it('maps the four gestures the team chose', () => {
    expect(Object.fromEntries(Object.entries(GESTURE_COMMANDS).map(([k, v]) => [k, v.command]))).toEqual({
      Pointing_Up: 'stand',
      Pointing_Down: 'sit',
      Closed_Fist: 'jump',
      Open_Palm: 'pet',
    });
    for (const { command } of Object.values(GESTURE_COMMANDS)) expect(COMMANDS).toContain(command);
  });
});

describe('pointing down (from landmarks)', () => {
  it('detects an index finger pointing down with the others curled', () => {
    expect(isPointingDown(hand({ index: 'down' }))).toBe(true);
    expect(classifyFrame({ t: 0, score: 0, landmarks: hand({ index: 'down' }) })).toBe('Pointing_Down');
  });
  it('does not detect pointing up, an open hand, or missing landmarks', () => {
    expect(isPointingDown(hand({ index: 'up' }))).toBe(false);
    expect(isPointingDown(hand({ index: 'down', open: true }))).toBe(false);
    expect(isPointingDown(undefined)).toBe(false);
  });
  it('fires sit after confirmation', () => {
    expect(run(frames(repeat(5, { landmarks: hand({ index: 'down' }) })))).toEqual(['sit']);
  });
});

describe('static gestures', () => {
  it('pointing up → stand, fist → jump', () => {
    expect(run(frames(repeat(4, { gesture: 'Pointing_Up' })))).toEqual(['stand']);
    expect(run(frames(repeat(4, { gesture: 'Closed_Fist' })))).toEqual(['jump']);
  });
  it('ignores low-confidence frames and unmapped gestures', () => {
    expect(run(frames(repeat(8, { gesture: 'Closed_Fist', score: 0.5 })))).toEqual([]);
    expect(run(frames(repeat(8, { gesture: 'Thumb_Up', score: 0.99 })))).toEqual([]);
  });
  it('resets confirmation when the gesture flickers', () => {
    expect(run(frames([{ gesture: 'Closed_Fist' }, { gesture: 'Closed_Fist' }, { gesture: 'Pointing_Up' }, { gesture: 'Closed_Fist' }, { gesture: 'Closed_Fist' }]))).toEqual([]);
  });
  it('fires a held gesture only once, and again after release + cooldown', () => {
    expect(run(frames(repeat(30, { gesture: 'Pointing_Up' })))).toEqual(['stand']);
    expect(run(frames([...repeat(4, { gesture: 'Closed_Fist' }), ...repeat(12, {}), ...repeat(4, { gesture: 'Closed_Fist' })]))).toEqual(['jump', 'jump']);
  });
  it('enforces the cooldown between different gestures', () => {
    expect(run(frames([...repeat(4, { gesture: 'Closed_Fist' }), ...repeat(4, { gesture: 'Pointing_Up' })], 50))).toEqual(['jump']);
  });
});

describe('open palm (pet)', () => {
  const palm = (x: number) => ({ gesture: 'Open_Palm', landmarks: hand({ wristX: x, open: true }) });

  it('an open palm held still → pet', () => {
    const out = run(frames(repeat(6, palm(0.5))));
    expect(out).toEqual(['pet']);
  });

  it('an open palm needs a little longer than other gestures', () => {
    expect(run(frames(repeat(5, palm(0.5))))).toEqual([]);
  });

  it('a hand moving side to side does not pet (no wave/play gesture any more)', () => {
    const xs = [0.4, 0.5, 0.6, 0.5, 0.4, 0.5, 0.6, 0.5];
    expect(run(frames(xs.map(palm)))).toEqual([]);
  });

  it('a palm passing across the camera does not pet', () => {
    const xs = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65];
    expect(run(frames(xs.map(palm)))).toEqual([]);
  });

  it('small jitter still counts as holding still', () => {
    const xs = [0.5, 0.505, 0.5, 0.505, 0.5, 0.505, 0.5, 0.505];
    expect(run(frames(xs.map(palm)))).toEqual(['pet']);
  });
});
