import type { PetCommand } from '../health/types';

/** Words (and close variants) that map to pet commands. */
const WORDS: [RegExp, PetCommand][] = [
  [/\b(sit|sit down|settle)\b/, 'sit'],
  [/\b(stand|stand up|get up|up)\b/, 'stand'],
  [/\b(jump|hop|bounce)\b/, 'jump'],
  [/\b(pet|good (boy|girl|kitty|pup)|cuddle)\b/, 'pet'],
  [/\b(play|let's play|fetch)\b/, 'play'],
  [/\b(float|swim|hover|drift)\b/, 'float'],
];

/** First recognised command in a transcript, or undefined. Case-insensitive. */
export function parseVoiceCommand(transcript: string): PetCommand | undefined {
  const t = transcript.toLowerCase();
  let best: { cmd: PetCommand; at: number } | undefined;
  for (const [re, cmd] of WORDS) {
    const m = re.exec(t);
    if (m && (best === undefined || m.index < best.at)) best = { cmd, at: m.index };
  }
  return best?.cmd;
}
