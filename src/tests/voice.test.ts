import { describe, expect, it } from 'vitest';
import { parseVoiceCommand } from '../features/pet-input/voice';

describe('parseVoiceCommand', () => {
  it.each([
    ['Sit', 'sit'],
    ['sit down please', 'sit'],
    ['stand up', 'stand'],
    ['JUMP!', 'jump'],
    ['good boy', 'pet'],
    ["let's play", 'play'],
  ])('"%s" → %s', (t, cmd) => expect(parseVoiceCommand(t)).toBe(cmd));

  it('returns undefined for unrelated speech', () => {
    expect(parseVoiceCommand('what is my heart rate')).toBeUndefined();
    expect(parseVoiceCommand('')).toBeUndefined();
  });

  it('does not match words inside other words', () => {
    expect(parseVoiceCommand('situation update')).toBeUndefined();
    expect(parseVoiceCommand('petrol')).toBeUndefined();
  });

  it('picks the first command spoken', () => {
    expect(parseVoiceCommand('jump then sit')).toBe('jump');
  });
});

describe("float is the axolotl's stand", () => {
  it('maps float/swim to stand for the axolotl only', () => {
    expect(parseVoiceCommand('float around', 'axolotl')).toBe('stand');
    expect(parseVoiceCommand('can you swim', 'axolotl')).toBe('stand');
    expect(parseVoiceCommand('float around', 'cat')).toBeUndefined();
    expect(parseVoiceCommand('stand up', 'axolotl')).toBe('stand');
  });
  it('suggests the words that match the buttons', async () => {
    const { voiceHints } = await import('../features/pet-input/voice');
    expect(voiceHints('axolotl')).toEqual(['sit', 'float', 'jump', 'pet', 'play']);
    expect(voiceHints('dog')).toEqual(['sit', 'stand', 'jump', 'pet', 'play']);
  });
});
