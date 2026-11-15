# SYNORA — Reference Links

Sources for metric explanations and alert rules. **Status** records whether a team member (or Claude) has actually read the source. Do not cite a source in the app until it is marked *reviewed* and the specific claim is noted.

| # | Source | Publisher | URL | Relevant to | Status | Notes |
|---|---|---|---|---|---|---|
| 1 | Create Health Monitoring Software for Astronauts on Space Missions (challenge) | NASA Space Apps 2026 | https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/ | Requirements | reviewed (text pasted by team) | Names BP, heart rate, blood sugar (mg/dL), body temperature, sleep hours, mood; five hazards; suggests charts, color coding, gamification, routine prompts, how-to explanations, clickable body figure. |
| 2 | 5 Hazards of Human Spaceflight | NASA HRP | https://www.nasa.gov/hrp/hazards/ | Hazard tags on every metric/rule | not yet reviewed | |
| 3 | Risks of Human Spaceflight | NASA HRP | https://www.nasa.gov/hrp/risks/ | Rule explanations | not yet reviewed | |
| 4 | Ongoing HRP Research in Space | NASA HRP | https://www.nasa.gov/hrp/ongoing-hrp-research/ | Background | not yet reviewed | |
| 5 | Monitoring Radiation for Astronaut Health | CSA | https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp | Radiation dose metric | not yet reviewed | |
| 6 | Why Do We Conduct Science Experiments in Space? | CSA | https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp | Background | not yet reviewed | |
| 7 | Human Research Roadmap | NASA HRP | https://humanresearchroadmap.nasa.gov/Explore/ | Risk detail | not yet reviewed | Reachable from the dev environment. |
| 8 | Open Science Data Repository (Biological) | NASA OSDR | https://osdr.nasa.gov/bio/repo | Possible datasets | not yet reviewed | Check license and study context (spaceflight / analog / simulation) before use. |

## Rules of use

- Every assessment threshold is **demonstration-only** unless a row above supports it and the rule's `citation` points to it.
- Input plausibility limits in `src/features/health/metrics.ts` are typo guards, not clinical thresholds.
- Never present a dataset as an individual astronaut's real-time values.
