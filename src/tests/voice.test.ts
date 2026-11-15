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
    ['float around', 'float'],
    ['can you swim', 'float'],
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
