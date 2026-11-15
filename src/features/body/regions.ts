import type { MetricKnowledge } from '../health/knowledge';
import type { MetricId } from '../health/types';

export type RegionId = 'brain' | 'heart' | 'lungs' | 'metabolism' | 'skin' | 'bones' | 'radiation';

export interface BodyRegion {
  id: RegionId;
  label: string;
  /** Metrics SYNORA tracks for this region (may be empty). */
  metrics: MetricId[];
  /** Pixel rects [x, y, w, h] on a 24×40 grid. */
  rects: [number, number, number, number][];
  /** What the region does, in plain language (general knowledge). */
  role: string;
  /** Extra context for regions with no tracked metric. Must cite a read source. */
  note?: MetricKnowledge['inSpace'];
  /** Honest note when SYNORA cannot measure this region. */
  notTracked?: string;
}

export const REGIONS: BodyRegion[] = [
  {
    id: 'brain',
    label: 'Brain & mind',
    metrics: ['sleepDuration', 'mood', 'stress'],
    rects: [[9, 1, 6, 6], [10, 0, 4, 1]],
    role: 'Sleep, mood and stress affect attention, decisions and teamwork.',
  },
  {
    id: 'heart',
    label: 'Heart & circulation',
    metrics: ['heartRate', 'bloodPressure'],
    rects: [[10, 10, 4, 4]],
    role: 'The heart pumps blood; blood pressure shows how hard it pushes against the vessel walls.',
  },
  {
    id: 'lungs',
    label: 'Lungs & oxygen',
    metrics: ['spo2'],
    rects: [[8, 8, 8, 1], [7, 9, 3, 6], [14, 9, 3, 6], [10, 9, 4, 1], [10, 14, 4, 1]],
    role: 'The lungs move oxygen into the blood. SpO₂ estimates how much of the blood’s haemoglobin is carrying oxygen.',
  },
  {
    id: 'metabolism',
    label: 'Metabolism & nutrition',
    metrics: ['bloodGlucose'],
    rects: [[7, 15, 10, 7]],
    role: 'Digestion turns food into energy; blood glucose shows how much sugar is available in the blood.',
  },
  {
    id: 'skin',
    label: 'Immune system & temperature',
    metrics: ['bodyTemperature'],
    rects: [[11, 7, 2, 1], [5, 8, 2, 2], [17, 8, 2, 2], [4, 10, 2, 9], [18, 10, 2, 9], [4, 19, 2, 2], [18, 19, 2, 2]],
    role: 'Body temperature is kept in a narrow range; changes can accompany infection or a hot or cold environment.',
  },
  {
    id: 'bones',
    label: 'Bones & muscles',
    metrics: [],
    rects: [[8, 22, 3, 15], [13, 22, 3, 15], [7, 37, 4, 2], [13, 37, 4, 2]],
    role: 'Bones and muscles support the body and let us move.',
    note: [
      {
        text: 'Without gravity, bones break down and become more brittle, raising the chance of breaks. Research aims to preserve bone strength through diet, exercise and medication.',
        sourceId: 'risks',
      },
      {
        text: 'All astronauts exercise during missions to counter losses in bone density and muscle strength.',
        sourceId: 'risks',
      },
    ],
    notTracked: 'SYNORA does not track bone or muscle health. Bone density needs specialised imaging that this prototype cannot provide.',
  },
  {
    id: 'radiation',
    label: 'Whole body · radiation exposure',
    metrics: ['radiationDose'],
    rects: [],
    role: 'Space radiation affects the whole body. Exposure is measured with a personal dosimeter, not with vital-sign sensors.',
  },
];
