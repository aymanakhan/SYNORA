import type { PetCommand } from '../health/types';

/**
 * Camera-gesture → pet-command mapping. Gestures drive animation commands
 * ONLY; they never touch readings, alerts, or wellness state.
 *
 * Pointing up, closed fist and open palm come from MediaPipe's built-in
 * Gesture Recognizer. Pointing down (no built-in category) is derived from
 * hand landmarks, and wave from side-to-side wrist movement over time.
 */
export type GestureKey = 'Pointing_Up' | 'Pointing_Down' | 'Closed_Fist' | 'Open_Palm' | 'Wave';

export const GESTURE_COMMANDS: Record<GestureKey, { command: PetCommand; label: string; emoji: string }> = {
  Pointing_Up: { command: 'stand', label: 'Pointing up', emoji: '☝' },
  Pointing_Down: { command: 'sit', label: 'Pointing down', emoji: '👇' },
  Closed_Fist: { command: 'jump', label: 'Closed fist', emoji: '✊' },
  Open_Palm: { command: 'pet', label: 'Open palm (held still)', emoji: '✋' },
  Wave: { command: 'play', label: 'Wave', emoji: '👋' },
};

/** Normalised image coordinates (0–1, y grows downward), 21 MediaPipe hand points. */
export interface Landmark {
  x: number;
  y: number;
}

export interface GestureFrame {
  /** MediaPipe category name, e.g. "Open_Palm", "None"; undefined = no hand. */
  gesture?: string;
  score: number;
  /** Timestamp in ms. */
  t: number;
  landmarks?: Landmark[];
}

export interface InterpreterOptions {
  minScore: number;
  /** Consecutive matching frames before a static gesture fires. */
  framesToConfirm: number;
  /** Open palm must be held this many frames AND stay still (it's also how a wave starts). */
  palmFramesToConfirm: number;
  /** Max side-to-side wrist travel (normalised) for a palm to count as "still". */
  palmStillRange: number;
  /** Wave: look back this far… */
  waveWindowMs: number;
  /** …for at least this many direction changes… */
  waveReversals: number;
  /** …covering at least this much horizontal travel. */
  waveMinRange: number;
  /** Minimum time between fired commands. */
  cooldownMs: number;
}

export const DEFAULT_INTERPRETER: InterpreterOptions = {
  minScore: 0.7,
  framesToConfirm: 4,
  palmFramesToConfirm: 6,
  palmStillRange: 0.05,
  waveWindowMs: 1500,
  waveReversals: 2,
  waveMinRange: 0.12,
  cooldownMs: 1200,
};

const WRIST = 0;
const INDEX = { mcp: 5, pip: 6, tip: 8 };
const OTHER_FINGERS = [
  { mcp: 9, tip: 12 },
  { mcp: 13, tip: 16 },
  { mcp: 17, tip: 20 },
];

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Index finger extended and pointing DOWN, other fingers curled.
 * Orientation-independent finger lengths are used for "curled".
 */
export function isPointingDown(lm: Landmark[] | undefined): boolean {
  if (!lm || lm.length < 21) return false;
  const tip = lm[INDEX.tip];
  const pip = lm[INDEX.pip];
  const mcp = lm[INDEX.mcp];
  const indexLen = dist(tip, mcp);
  const pointsDown = tip.y > pip.y && pip.y > mcp.y && tip.y - mcp.y > 0.08;
  const othersCurled = OTHER_FINGERS.every((f) => dist(lm[f.tip], lm[f.mcp]) < 0.6 * indexLen);
  return pointsDown && othersCurled;
}

/** Classify one frame into a static gesture key (wave is detected over time). */
export function classifyFrame(f: GestureFrame, minScore = DEFAULT_INTERPRETER.minScore): GestureKey | undefined {
  if (f.gesture === 'Pointing_Up' && f.score >= minScore) return 'Pointing_Up';
  if (isPointingDown(f.landmarks)) return 'Pointing_Down';
  if (f.gesture === 'Closed_Fist' && f.score >= minScore) return 'Closed_Fist';
  if (f.gesture === 'Open_Palm' && f.score >= minScore) return 'Open_Palm';
  return undefined;
}

/**
 * Turns a stream of frames into commands, with confidence threshold,
 * multi-frame confirmation, a hold-latch (a held gesture fires once) and a
 * cooldown. Wave is checked first because a waving hand is an open palm.
 */
export class GestureInterpreter {
  private candidate?: GestureKey;
  private count = 0;
  private latched?: GestureKey;
  private lastFiredAt = -Infinity;
  private palmXs: number[] = [];
  private wrist: { t: number; x: number }[] = [];
  /** What the interpreter currently sees (for the on-screen label). */
  seen?: GestureKey;

  constructor(private opts: InterpreterOptions = DEFAULT_INTERPRETER) {}

  push(f: GestureFrame): { command: PetCommand; gesture: GestureKey } | undefined {
    const key = classifyFrame(f, this.opts.minScore);
    const wristX = f.landmarks?.[WRIST]?.x;

    // --- Wave: open palm (or an unclassified moving hand) swinging side to side.
    if (wristX !== undefined && (key === 'Open_Palm' || key === undefined)) {
      this.wrist.push({ t: f.t, x: wristX });
      this.wrist = this.wrist.filter((p) => f.t - p.t <= this.opts.waveWindowMs);
      if (this.isWave()) {
        this.wrist = [];
        this.resetCandidate();
        this.seen = 'Wave';
        return this.fire('Wave', f.t);
      }
    } else {
      this.wrist = [];
    }

    this.seen = key;
    if (!key) {
      this.resetCandidate();
      this.latched = undefined;
      return undefined;
    }
    if (key !== this.candidate) {
      this.candidate = key;
      this.count = 0;
      this.palmXs = [];
      if (key !== this.latched) this.latched = undefined;
    }
    this.count++;

    if (key === 'Open_Palm') {
      if (wristX !== undefined) this.palmXs.push(wristX);
      const recent = this.palmXs.slice(-this.opts.palmFramesToConfirm);
      const still = recent.length === 0 || Math.max(...recent) - Math.min(...recent) <= this.opts.palmStillRange;
      if (this.count < this.opts.palmFramesToConfirm || !still) return undefined;
    } else if (this.count < this.opts.framesToConfirm) {
      return undefined;
    }

    if (this.latched === key) return undefined;
    return this.fire(key, f.t);
  }

  reset() {
    this.resetCandidate();
    this.latched = undefined;
    this.wrist = [];
    this.seen = undefined;
  }

  private fire(key: GestureKey, t: number) {
    if (t - this.lastFiredAt < this.opts.cooldownMs) return undefined;
    this.lastFiredAt = t;
    this.latched = key;
    return { command: GESTURE_COMMANDS[key].command, gesture: key };
  }

  private resetCandidate() {
    this.candidate = undefined;
    this.count = 0;
    this.palmXs = [];
  }

  private isWave(): boolean {
    const xs = this.wrist.map((p) => p.x);
    if (xs.length < 4 || Math.max(...xs) - Math.min(...xs) < this.opts.waveMinRange) return false;
    let reversals = 0;
    let dir = 0;
    for (let i = 1; i < xs.length; i++) {
      const dx = xs[i] - xs[i - 1];
      if (Math.abs(dx) < 0.01) continue; // ignore jitter
      const d = Math.sign(dx);
      if (dir !== 0 && d !== dir) reversals++;
      dir = d;
    }
    return reversals >= this.opts.waveReversals;
  }
}
