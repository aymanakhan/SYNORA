import type { PetCommand, PetSpecies } from '../health/types';

/**
 * Shared pet command controller. On-screen buttons, keyboard shortcuts and
 * (later) camera gestures or push-to-talk all dispatch these commands.
 *
 * Commands only produce a temporary animation. They NEVER change a
 * measurement, an assessment, an alert, or the pet's wellness state.
 */

export const COMMANDS: PetCommand[] = ['sit', 'stand', 'jump', 'pet', 'play'];

export const COMMAND_KEYS: Record<string, PetCommand> = {
  '1': 'sit',
  '2': 'stand',
  '3': 'jump',
  '4': 'pet',
  '5': 'play',
};

/** Button/voice label for a command: the axolotl's "stand" is called Float. */
export function commandLabel(species: PetSpecies, command: PetCommand): string {
  return species === 'axolotl' && command === 'stand' ? 'float' : command;
}

export interface ResolvedAction {
  /** CSS animation class in index.css. */
  animation: 'sit' | 'stand' | 'jump' | 'pet' | 'play' | 'float' | 'settle' | 'bob' | 'gills';
  /** What the user sees, e.g. "Pip sits". */
  verb: string;
  /** True when the species shows an equivalent rather than the literal command. */
  equivalent: boolean;
}

const LITERAL: Record<PetCommand, ResolvedAction> = {
  sit: { animation: 'sit', verb: 'sits', equivalent: false },
  stand: { animation: 'stand', verb: 'stands up', equivalent: false },
  jump: { animation: 'jump', verb: 'jumps', equivalent: false },
  pet: { animation: 'pet', verb: 'enjoys being petted', equivalent: false },
  play: { animation: 'play', verb: 'plays', equivalent: false },
};

/** Axolotls don't sit or stand: they drift, bob and wiggle their gills. */
const AXOLOTL: Record<PetCommand, ResolvedAction> = {
  sit: { animation: 'settle', verb: 'settles gently (axolotl equivalent of sit)', equivalent: true },
  stand: { animation: 'float', verb: 'floats up in zero-g', equivalent: true },
  jump: { animation: 'bob', verb: 'bobs (axolotl equivalent of jump)', equivalent: true },
  pet: { animation: 'gills', verb: 'wiggles its gills happily', equivalent: false },
  play: { animation: 'play', verb: 'swirls through some bubbles', equivalent: false },
};

export function resolveCommand(species: PetSpecies, command: PetCommand): ResolvedAction {
  return species === 'axolotl' ? AXOLOTL[command] : LITERAL[command];
}

/** Minimum gap between accepted commands (debounces rapid repeats). */
export const COMMAND_COOLDOWN_MS = 400;
/** How long an action animation lasts before returning to idle. */
export const ACTION_DURATION_MS = 1200;

export function acceptCommand(lastAcceptedAt: number | undefined, now: number): boolean {
  return lastAcceptedAt === undefined || now - lastAcceptedAt >= COMMAND_COOLDOWN_MS;
}
