# SYNORA: Reference Links

Sources behind the metric explanations and alert rules. **Status** records whether a team member (or Claude) has actually read the source. A source may be cited in the app only once it is marked *reviewed* and the specific claim is noted here.

| # | Source | Publisher | URL | Used for | Status | What it supports |
|---|---|---|---|---|---|---|
| 1 | Create Health Monitoring Software for Astronauts on Space Missions (challenge) | NASA Space Apps 2026 | https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/ | Requirements | reviewed (text pasted by team) | Lists BP, heart rate, blood sugar (mg/dL), body temperature, sleep hours and mood; the five hazards; suggests charts, colour coding, gamification, routine prompts, how-to explanations and a clickable body figure. |
| 2 | 5 Hazards of Human Spaceflight | NASA HRP | https://www.nasa.gov/hrp/hazards/ | Hazard tags; radiation, isolation and gravity explanations | reviewed 2026-11-15 | Five hazards (radiation, isolation & confinement, distance from Earth, gravity, hostile/closed environments); hazards compound each other; radiation "considered one of the most hazardous aspects of spaceflight"; Mars = 3/8 Earth gravity; habitability factors include temperature, pressure, lighting, noise and microbes. |
| 3 | Risks of Human Spaceflight | NASA HRP | https://www.nasa.gov/hrp/risks/ | "Why it matters in space" for HR, BP, temperature, SpO₂, glucose, sleep, stress, mood, radiation and symptoms | reviewed 2026-11-15 | Cardiovascular adaptations; altered immune responses (viral reactivation → rashes and symptoms); host-microorganism changes; hypoxia; inadequate nutrition; sensorimotor/vestibular (motion sickness, dizziness); reduced fitness and exercise countermeasures; bone changes; SANS; behavioural/psychiatric; inadequate sleep and irregular schedules; radiation-induced cancer. **No numeric thresholds.** |
| 4 | Ongoing HRP Research in Space | NASA HRP | https://www.nasa.gov/hrp/ongoing-hrp-research/ | Sleep context | reviewed 2026-11-15 | Artemis II ARCHeR monitored well-being, activity and sleep patterns; immune biomarkers from blood/saliva; standard measures data bank. |
| 5 | Monitoring Radiation for Astronaut Health | CSA | https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp | Radiation dose metric | reviewed 2026-11-15 | Neutron radiation ≈ 30% of total radiation on the ISS; CANS is a continuous, autonomous neutron spectrometer; earlier Canadian detectors (bubble detectors, MOSFET, EVARM, Radi-N/N2). |
| 6 | Why Do We Conduct Science Experiments in Space? | CSA | https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp | Mission-context explanations | reviewed 2026-11-15 | Moon and Mars missions mean more weightlessness, more radiation, longer isolation, communication delays, and less reliance on Earth for food, materials and emergency medical help. |
| 7 | Human Research Roadmap | NASA HRP | https://humanresearchroadmap.nasa.gov/Explore/ | Risk detail | not yet reviewed | Reachable from the dev environment. |
| 8 | Open Science Data Repository (Biological) | NASA OSDR | https://osdr.nasa.gov/bio/repo | Possible datasets | not yet reviewed | Check licence and study context (spaceflight / analog / simulation) before use. |

## Rules of use

- The sources above explain **why** indicators matter. **None of them supplies numeric thresholds**, so every rule in `src/features/health/assessment/rules.ts` remains **demonstration-only**.
- The "how to measure" tips in `src/features/health/knowledge.ts` are general good practice, labelled in the UI as *not mission procedure*.
- Input plausibility limits in `src/features/health/metrics.ts` are typo guards, not clinical thresholds.
- Simulator physiology, the illustrative radiation dose (~0.6 mSv/day) and the fictional solar particle event are hand-tuned for the demo and are not taken from these sources.
- Radiation rules (dose rate ≥ 2 / ≥ 10 mSv/day; cumulative ≥ 150 / ≥ 300 mSv) are **illustrative, not NASA exposure limits**. Replace them only with values from a reviewed primary source.
- Never present a dataset as an individual astronaut's real-time values.
