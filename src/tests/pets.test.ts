import { describe, expect, it } from 'vitest';
import type { PetSpecies } from '../features/health/types';
import { COMMANDS, COMMAND_COOLDOWN_MS, COMMAND_KEYS, acceptCommand, resolveCommand } from '../features/pets/commands';
import { EXPRESSIONS, SPRITES } from '../features/pets/sprites';

const SPECIES: PetSpecies[] = ['cat', 'dog', 'axolotl'];

describe('pet command controller', () => {
  it('maps every command for every species', () => {
    for (const s of SPECIES) for (const c of COMMANDS) {
      const r = resolveCommand(s, c);
      expect(r.animation).toBeTruthy();
      expect(r.verb).toBeTruthy();
    }
  });

  it("has no separate float command; the axolotl's stand is labelled Float", async () => {
    const { commandLabel } = await import('../features/pets/commands');
    expect(COMMANDS).toEqual(['sit', 'stand', 'jump', 'pet']);
    expect(commandLabel('axolotl', 'stand')).toBe('float');
    expect(commandLabel('cat', 'stand')).toBe('stand');
    expect(resolveCommand('axolotl', 'stand').animation).toBe('float');
    expect(resolveCommand('dog', 'stand').animation).toBe('stand');
  });

  it('labels axolotl equivalents instead of faking sit/jump', () => {
    for (const c of ['sit', 'jump'] as const) {
      const r = resolveCommand('axolotl', c);
      expect(r.equivalent).toBe(true);
      expect(r.verb).toMatch(/axolotl equivalent/);
      expect(r.animation).not.toBe(c);
    }
    expect(resolveCommand('cat', 'sit')).toMatchObject({ animation: 'sit', equivalent: false });
  });

  it('has a keyboard shortcut for every command', () => {
    expect(new Set(Object.values(COMMAND_KEYS))).toEqual(new Set(COMMANDS));
  });

  it('debounces rapid repeats', () => {
    expect(acceptCommand(undefined, 1000)).toBe(true);
    expect(acceptCommand(1000, 1000 + COMMAND_COOLDOWN_MS - 1)).toBe(false);
    expect(acceptCommand(1000, 1000 + COMMAND_COOLDOWN_MS)).toBe(true);
  });
});

describe('pixel sprites', () => {
  it.each(SPECIES)('%s grid is 16×16 with every colour defined', (s) => {
    const { grid, palette } = SPRITES[s];
    expect(grid).toHaveLength(16);
    for (const row of grid) {
      expect(row).toHaveLength(16);
      for (const ch of row) if (ch !== '.') expect(palette[ch]).toBeDefined();
    }
  });

  it('expression pixels stay inside the grid', () => {
    for (const px of Object.values(EXPRESSIONS).flat()) {
      expect(px[0]).toBeGreaterThanOrEqual(0);
      expect(px[0]).toBeLessThan(16);
      expect(px[1]).toBeGreaterThanOrEqual(0);
      expect(px[1]).toBeLessThan(16);
    }
  });
});
