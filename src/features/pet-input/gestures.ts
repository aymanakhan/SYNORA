import type { PetCommand } from '../health/types';

/**
 * Camera-gesture → pet-command mapping. Three gestures only: a few reliable
 * gestures beat many unreliable ones. Gestures drive animation commands
 * ONLY; they never touch readings, alerts, or wellness state.
 */
export const GESTURE_COMMANDS: Record<string, { command: PetCommand; label: string }> = {
  Open_Palm: { command: 'stand', label: 'Open palm' },
  Pointing_Up: { command: 'sit', label: 'Pointing up' },
  Closed_Fist: { command: 'jump', label: 'Closed fist' },
};

export interface GestureFrame {
  /** MediaPipe category name, e.g. "Open_Palm", "None"; undefined = no hand. */
  gesture?: string;
  score: number;
  /** Timestamp in ms. */
  t: number;
}

export interface StabilizerOptions {
  minScore: number;
  /** Consecutive matching frames required before a gesture fires. */
  framesToConfirm: number;
  /** Minimum time between fired commands. */
  cooldownMs: number;
}

export const DEFAULT_STABILIZER: StabilizerOptions = { minScore: 0.7, framesToConfirm: 4, cooldownMs: 1200 };

/**
 * Multi-frame confirmation + cooldown. A held gesture fires once; it must be
 * released (hand lost, "None", or a different gesture) before it can fire again.
 */
export class GestureStabilizer {
  private candidate?: string;
  private count = 0;
  private lastFiredAt = -Infinity;
  private latched?: string;

  constructor(private opts: StabilizerOptions = DEFAULT_STABILIZER) {}

  /** Returns the command to dispatch for this frame, if any. */
  push(frame: GestureFrame): { command: PetCommand; gesture: string } | undefined {
    const g = frame.gesture;
    const mapped = g ? GESTURE_COMMANDS[g] : undefined;
    if (!g || !mapped || frame.score < this.opts.minScore) {
      this.candidate = undefined;
      this.count = 0;
      if (!g || g === 'None' || !mapped) this.latched = undefined;
      return undefined;
    }
    if (g !== this.candidate) {
      this.candidate = g;
      this.count = 0;
      if (g !== this.latched) this.latched = undefined;
    }
    this.count++;
    if (this.count < this.opts.framesToConfirm) return undefined;
    if (this.latched === g) return undefined;
    if (frame.t - this.lastFiredAt < this.opts.cooldownMs) return undefined;
    this.lastFiredAt = frame.t;
    this.latched = g;
    return { command: mapped.command, gesture: g };
  }

  reset() {
    this.candidate = undefined;
    this.count = 0;
    this.latched = undefined;
  }
}
