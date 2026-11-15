import type { MetricId, SpaceflightHazard } from './types';

/**
 * Educational content. Every "inSpace" statement paraphrases or quotes a
 * source page that the team has actually read (see
 * resources/nasa/reference-links.md). These sources explain WHY an
 * indicator matters in spaceflight; none of them supplies SYNORA's numeric
 * thresholds, which remain demonstration-only.
 *
 * "howTo" tips are general measurement good practice, not mission
 * procedures, and are labelled as such in the UI.
 */

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
}

export const SOURCES: Record<string, Source> = {
  hazards: {
    id: 'hazards',
    title: '5 Hazards of Human Spaceflight',
    publisher: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/hazards/',
  },
  risks: {
    id: 'risks',
    title: 'Risks of Human Spaceflight',
    publisher: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/risks/',
  },
  ongoing: {
    id: 'ongoing',
    title: 'Ongoing HRP Research in Space',
    publisher: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/',
  },
  csaRadiation: {
    id: 'csaRadiation',
    title: 'Monitoring radiation for astronaut health',
    publisher: 'Canadian Space Agency',
    url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
  },
  csaScience: {
    id: 'csaScience',
    title: 'Why do we conduct science experiments in space?',
    publisher: 'Canadian Space Agency',
    url: 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp',
  },
};

export interface MetricKnowledge {
  /** Source-backed: why this indicator matters in spaceflight. */
  inSpace: { text: string; sourceId: keyof typeof SOURCES }[];
  /** General measurement good practice (not mission procedure). */
  howTo: string;
}

export const KNOWLEDGE: Partial<Record<MetricId, MetricKnowledge>> = {
  heartRate: {
    inSpace: [
      {
        text: 'NASA lists cardiovascular adaptation as a spaceflight risk: weightlessness alters blood circulation and how the heart and blood vessels work, which may increase the risk of cardiovascular events.',
        sourceId: 'risks',
      },
      {
        text: 'Astronauts exercise during missions to counter losses in bone density, muscle strength, and heart and blood vessel performance.',
        sourceId: 'risks',
      },
    ],
    howTo: 'Measure at rest after sitting quietly for a few minutes, at a similar time each day. Note the instrument you used.',
  },
  bloodPressure: {
    inSpace: [
      {
        text: 'NASA lists cardiovascular adaptation as a spaceflight risk: weightlessness alters blood circulation and how the heart and blood vessels work.',
        sourceId: 'risks',
      },
      {
        text: 'Gravity is one of the five hazards: on Mars, astronauts would live in three-eighths of Earth gravity, and their organs keep adjusting to new gravitational loads.',
        sourceId: 'hazards',
      },
    ],
    howTo: 'Sit quietly for about 5 minutes. Put the cuff on your bare upper arm at heart level with the arm supported, and stay still and quiet. Taking two readings a minute apart helps spot errors.',
  },
  bodyTemperature: {
    inSpace: [
      {
        text: 'The stresses of spaceflight can awaken inactive viruses in astronauts’ bodies, leading to rashes and other symptoms (NASA: altered immune system responses).',
        sourceId: 'risks',
      },
      {
        text: 'Skin and gut microbiomes can change in space, which may increase the risk of crew members getting sick.',
        sourceId: 'risks',
      },
    ],
    howTo: 'Use the same thermometer and body site each time. For oral readings, avoid hot or cold drinks for about 15 minutes beforehand.',
  },
  spo2: {
    inSpace: [
      {
        text: 'NASA lists hypoxia as a risk: steps taken to avoid decompression sickness on future deep-space spacewalks can raise the risk of mild hypoxia, when oxygen levels in body tissues are lower than normal.',
        sourceId: 'risks',
      },
      {
        text: 'Spacewalk risks include low oxygen and high carbon dioxide levels.',
        sourceId: 'risks',
      },
    ],
    howTo: 'Warm your hand and stay still. Use a clean finger with no nail polish, and wait for the reading to settle before recording it.',
  },
  bloodGlucose: {
    inSpace: [
      {
        text: 'NASA lists inadequate food and nutrition as a risk: a healthy, balanced diet is essential for crew health and performance on deep-space missions.',
        sourceId: 'risks',
      },
      {
        text: 'Longer missions mean less ability to rely on Earth for food, materials and emergency medical help.',
        sourceId: 'csaScience',
      },
    ],
    howTo: 'Wash and dry your hands and use a fresh test strip. Note whether you were fasting or had recently eaten, because that changes the expected value.',
  },
  sleepDuration: {
    inSpace: [
      {
        text: 'NASA lists inadequate sleep and irregular schedules as a risk: crews face chronic sleep loss, constant work demands and disrupted internal biological clocks.',
        sourceId: 'risks',
      },
      {
        text: 'A study on Artemis II monitored astronauts’ well-being, activity and sleep patterns (ARCHeR).',
        sourceId: 'ongoing',
      },
    ],
    howTo: 'Estimate the time you were actually asleep, not the time spent in your sleep station.',
  },
  stress: {
    inSpace: [
      {
        text: 'Isolation, radiation, distance from Earth and other intense space stressors may all take a toll on the mental health of the crew.',
        sourceId: 'risks',
      },
      {
        text: 'Isolation and confinement is one of the five hazards: behavioural responses occur among people isolated and confined in a small space for a long time.',
        sourceId: 'hazards',
      },
    ],
    howTo: 'Rate honestly how you feel right now. There is no right answer, and reporting high stress is useful information, not a failure.',
  },
  mood: {
    inSpace: [
      {
        text: 'Isolation, radiation, distance from Earth and other intense space stressors may all take a toll on the mental health of the crew.',
        sourceId: 'risks',
      },
      {
        text: 'Missions to the Moon and Mars bring longer periods of isolation far from home and longer communication delays with Earth.',
        sourceId: 'csaScience',
      },
    ],
    howTo: 'Rate your overall mood today. Checking in at a similar time each day makes trends easier to read.',
  },
  radiationDose: {
    inSpace: [
      {
        text: 'Space radiation is invisible and is considered one of the most hazardous aspects of spaceflight.',
        sourceId: 'hazards',
      },
      {
        text: 'Crews exposed to space radiation may be more likely to develop cancer (NASA: radiation-induced cancers).',
        sourceId: 'risks',
      },
      {
        text: 'Neutron radiation makes up about 30% of total radiation on the ISS. The CSA is developing CANS, an instrument that measures neutron exposure continuously and autonomously.',
        sourceId: 'csaRadiation',
      },
    ],
    howTo: 'Read your personal dosimeter and record the time period the dose covers. A smartwatch or other vital-sign sensor cannot measure radiation.',
  },
};

/** Knowledge for symptom reports. */
export const SYMPTOM_KNOWLEDGE: MetricKnowledge = {
  inSpace: [
    {
      text: 'Gravity changes can cause motion sickness, coordination problems and dizziness (NASA: altered sensorimotor and vestibular function).',
      sourceId: 'risks',
    },
    {
      text: 'Spaceflight stress can reactivate dormant viruses, leading to rashes and other symptoms.',
      sourceId: 'risks',
    },
  ],
  howTo: 'Describe symptoms briefly and early. Reporting them helps your crew and flight surgeons support you.',
};

export const HAZARD_LABEL: Record<SpaceflightHazard, string> = {
  radiation: 'Space radiation',
  'isolation-confinement': 'Isolation & confinement',
  'distance-from-earth': 'Distance from Earth',
  'gravity-fields': 'Gravity fields',
  'hostile-closed-environment': 'Hostile / closed environment',
};
