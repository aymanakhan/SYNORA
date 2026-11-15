import { describe, expect, it } from 'vitest';
import { GESTURE_COMMANDS, GestureStabilizer } from '../features/pet-input/gestures';
import { COMMANDS } from '../features/pets/commands';

const run = (s: GestureStabilizer, frames: [string | undefined, number][], start = 0, step = 100) =>
  frames.map(([gesture, score], i) => s.push({ gesture, score, t: start + i * step })?.command);

describe('gesture mapping', () => {
  it('maps the three supported gestures to valid pet commands', () => {
    expect(Object.keys(GESTURE_COMMANDS).sort()).toEqual(['Closed_Fist', 'Open_Palm', 'Pointing_Up']);
    for (const { command } of Object.values(GESTURE_COMMANDS)) expect(COMMANDS).toContain(command);
  });
});

describe('GestureStabilizer', () => {
  it('fires only after several consecutive confident frames', () => {
    const out = run(new GestureStabilizer(), Array(4).fill(['Open_Palm', 0.9]));
    expect(out).toEqual([undefined, undefined, undefined, 'stand']);
  });

  it('ignores low-confidence frames', () => {
    expect(run(new GestureStabilizer(), Array(8).fill(['Closed_Fist', 0.5])).filter(Boolean)).toEqual([]);
  });

  it('resets confirmation when the gesture flickers', () => {
    const out = run(new GestureStabilizer(), [
      ['Open_Palm', 0.9], ['Open_Palm', 0.9], ['Closed_Fist', 0.9], ['Open_Palm', 0.9], ['Open_Palm', 0.9], ['Open_Palm', 0.9],
    ]);
    expect(out.filter(Boolean)).toEqual([]);
  });

  it('fires a held gesture only once', () => {
    expect(run(new GestureStabilizer(), Array(30).fill(['Pointing_Up', 0.95])).filter(Boolean)).toEqual(['sit']);
  });

  it('can fire again after the hand is released, once the cooldown has passed', () => {
    const s = new GestureStabilizer();
    const frames: [string | undefined, number][] = [
      ...Array(4).fill(['Closed_Fist', 0.9]),
      ...Array(10).fill([undefined, 0]),
      ...Array(4).fill(['Closed_Fist', 0.9]),
    ];
    expect(run(s, frames).filter(Boolean)).toEqual(['jump', 'jump']);
  });

  it('enforces the cooldown between different gestures', () => {
    const s = new GestureStabilizer();
    const out = run(s, [...Array(4).fill(['Closed_Fist', 0.9]), ...Array(4).fill(['Open_Palm', 0.9])], 0, 50);
    expect(out.filter(Boolean)).toEqual(['jump']);
  });

  it('ignores unmapped gestures such as Thumb_Up', () => {
    expect(run(new GestureStabilizer(), Array(6).fill(['Thumb_Up', 0.99])).filter(Boolean)).toEqual([]);
  });
});
