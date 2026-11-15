import type { PetSpecies, PetWellness } from '../health/types';

/**
 * Original 16×16 placeholder pixel sprites (front view), drawn for SYNORA.
 * Each grid is 16 rows × 16 chars; '.' is transparent. Eyes sit at columns
 * 4 and 11 on rows 6–7 for every species so one face overlay fits all.
 */

type Palette = Record<string, string>;

export interface SpriteDef {
  grid: string[];
  palette: Palette;
}

const EYE = '#111827';

export const SPRITES: Record<PetSpecies, SpriteDef> = {
  // Silver-gray / cream cat
  cat: {
    palette: { o: '#2A2F3A', b: '#AEB6C2', l: '#F3E8D2', p: '#F4A7B9', e: EYE, c: '#F4A7B9' },
    grid: [
      '................',
      '...o........o...',
      '..obo......obo..',
      '..obpo....opbo..',
      '..obbboooobbbo..',
      '.obbbbbbbbbbbbo.',
      '.obbbbbbbbbbbbo.',
      '.obbbbbbbbbbbbo.',
      '.obbbllppllbbbo.',
      '..obbllllllbbo..',
      '...oobbbbbboo...',
      '...obllllllbo.oo',
      '..obbllllllbbobo',
      '..obbllllllbbbo.',
      '..obbobbbbobbo..',
      '...oo.oooo.oo...',
    ],
  },
  // Warm tan / brown dog
  dog: {
    palette: { o: '#3B2414', b: '#C8915A', l: '#F1D3A8', d: '#7A4A2A', e: EYE, c: '#E8A07A' },
    grid: [
      '................',
      '................',
      '...oooooooooo...',
      '..obbbbbbbbbbo..',
      '.odobbbbbbbbodo.',
      'oddobbbbbbbboddo',
      'oddobbbbbbbboddo',
      'oddobbbbbbbboddo',
      '.odoblloollbodo.',
      '..oobllllllboo..',
      '...obbllllbbo...',
      '...obbbbbbbbo.o.',
      '..obbllllllbbodo',
      '..obbllllllbbbo.',
      '..obbobbbbobbo..',
      '...oo.oooo.oo...',
    ],
  },
  // Pink axolotl with frilled gills
  axolotl: {
    palette: { o: '#7A2E4C', b: '#F7A8C4', l: '#FBD3E2', g: '#E0568A', e: EYE, c: '#E0568A' },
    grid: [
      '................',
      'g..............g',
      'gg............gg',
      '.gg.oooooooo.gg.',
      '..gobbbbbbbbog..',
      'ggobbbbbbbbbbogg',
      '.gobbbbbbbbbbog.',
      'ggobbbbbbbbbbogg',
      '.gobbbbbbbbbbog.',
      '..obbbbbbbbbbo..',
      '...oobbbbbboo...',
      '....obllllbo....',
      '...obllllllbo...',
      '..obbllllllbbo..',
      '...obllllllbooo.',
      '....oooooooo....',
    ],
  },
};

/** [col, row, paletteKey] pixels drawn over the base sprite. */
export type Pixel = [number, number, string];

const OPEN_EYES: Pixel[] = [
  [4, 6, 'e'],
  [4, 7, 'e'],
  [11, 6, 'e'],
  [11, 7, 'e'],
];

/** Facial expressions — these show WELLNESS only, never actions. */
export const EXPRESSIONS: Record<PetWellness, Pixel[]> = {
  happy: [
    [3, 7, 'e'], [4, 6, 'e'], [5, 7, 'e'],
    [10, 7, 'e'], [11, 6, 'e'], [12, 7, 'e'],
    [6, 9, 'o'], [9, 9, 'o'], [7, 10, 'o'], [8, 10, 'o'],
    [3, 8, 'c'], [12, 8, 'c'],
  ],
  tired: [
    [4, 7, 'e'], [5, 7, 'e'], [10, 7, 'e'], [11, 7, 'e'],
    [7, 9, 'o'], [8, 9, 'o'],
  ],
  concerned: [
    ...OPEN_EYES,
    [5, 5, 'o'], [10, 5, 'o'],
    [7, 9, 'o'], [8, 9, 'o'], [6, 10, 'o'], [9, 10, 'o'],
  ],
  unknown: [
    [4, 7, 'e'], [11, 7, 'e'],
    [6, 9, 'o'], [7, 9, 'o'], [8, 9, 'o'], [9, 9, 'o'],
  ],
};

export const SPECIES_LABEL: Record<PetSpecies, string> = { cat: 'Cat', dog: 'Dog', axolotl: 'Axolotl' };
