import type { PetCommand, PetSpecies } from '../health/types';

/** Words (and close variants) that map to pet commands. */
const WORDS: [RegExp, PetCommand][] = [
  [/\b(sit|sit down|settle)\b/, 'sit'],
  [/\b(stand|stand up|get up|up)\b/, 'stand'],
  [/\b(jump|hop|bounce)\b/, 'jump'],
  [/\b(pet|good (boy|girl|kitty|pup)|cuddle)\b/, 'pet'],
  [/\b(play|let's play|fetch)\b/, 'play'],
];

/** For the axolotl, "float" is the name of its stand command. */
const AXOLOTL_FLOAT: RegExp = /\b(float|swim|hover|drift)\b/;

/** First recognised command in a transcript, or undefined. Case-insensitive. */
export function parseVoiceCommand(transcript: string, species?: PetSpecies): PetCommand | undefined {
  const t = transcript.toLowerCase();
  const words: [RegExp, PetCommand][] = species === 'axolotl' ? [...WORDS, [AXOLOTL_FLOAT, 'stand']] : WORDS;
  let best: { cmd: PetCommand; at: number } | undefined;
  for (const [re, cmd] of words) {
    const m = re.exec(t);
    if (m && (best === undefined || m.index < best.at)) best = { cmd, at: m.index };
  }
  return best?.cmd;
}

/** Words to suggest in the UI, matching the pet's buttons. */
export function voiceHints(species?: PetSpecies): string[] {
  return ['sit', species === 'axolotl' ? 'float' : 'stand', 'jump', 'pet', 'play'];
}
