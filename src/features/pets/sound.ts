import { useCallback, useEffect, useState } from 'react';
import type { PetCommand, PetSpecies } from '../health/types';

/**
 * Original pet sounds synthesized with the Web Audio API, so there are no
 * recordings to license. Sounds play only in response to a user command
 * (never automatically), are off by default, and have a volume control.
 * The axolotl's "squeak" is stylized; real axolotls are essentially silent.
 */

let ctx: AudioContext | undefined;
function audio(): AudioContext | undefined {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

function tone(
  ac: AudioContext,
  { type, from, to, start, dur, gain }: { type: OscillatorType; from: number; to: number; start: number; dur: number; gain: number },
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  const t0 = ac.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playPetSound(species: PetSpecies, command: PetCommand, volume: number) {
  const ac = audio();
  if (!ac || volume <= 0) return;
  const v = Math.min(1, volume) * 0.25;
  const excited = command === 'jump' || command === 'play';
  if (species === 'cat') {
    // "mew": rising then falling glide
    tone(ac, { type: 'triangle', from: 600, to: excited ? 1100 : 900, start: 0, dur: 0.14, gain: v });
    tone(ac, { type: 'triangle', from: excited ? 1100 : 900, to: 500, start: 0.13, dur: 0.18, gain: v * 0.8 });
  } else if (species === 'dog') {
    // "woof" (twice when excited): short low square bark
    const barks = excited ? 2 : 1;
    for (let i = 0; i < barks; i++) {
      tone(ac, { type: 'square', from: 260, to: 140, start: i * 0.22, dur: 0.14, gain: v * 0.6 });
    }
  } else {
    // axolotl: stylized squeak + bubble blips
    tone(ac, { type: 'sine', from: 1400, to: 1900, start: 0, dur: 0.08, gain: v });
    [0.12, 0.2, 0.3].forEach((s, i) => tone(ac, { type: 'sine', from: 500 + i * 180, to: 900 + i * 200, start: s, dur: 0.06, gain: v * 0.5 }));
  }
}

const KEY = 'synora.sound.v1';
interface SoundPrefs {
  enabled: boolean;
  volume: number;
}

function load(): SoundPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '') as Partial<SoundPrefs>;
    return { enabled: p.enabled === true, volume: typeof p.volume === 'number' ? p.volume : 0.6 };
  } catch {
    return { enabled: false, volume: 0.6 };
  }
}

export function useSoundPrefs() {
  const [prefs, setPrefs] = useState<SoundPrefs>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* not remembered */
    }
  }, [prefs]);
  const setEnabled = useCallback((enabled: boolean) => setPrefs((p) => ({ ...p, enabled })), []);
  const setVolume = useCallback((volume: number) => setPrefs((p) => ({ ...p, volume })), []);
  return { ...prefs, setEnabled, setVolume };
}
