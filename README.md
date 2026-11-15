# SYNORA

**Your Health. Beyond Earth.** An offline-capable astronaut wellness monitoring *educational prototype* for the NASA Space Apps Challenge 2026 — *Create Health Monitoring Software for Astronauts on Space Missions*.

> SYNORA is **not** a medical device. It does not diagnose or prescribe treatment. All demo data is synthetic.

## Quick start

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build
```

No accounts, API keys, or network access are needed for the demo.

## Judge demo (about 3 minutes)

1. Open the app. **No login.** Choose a **cat, dog, or axolotl** and name it, then click *Start demo mission*.
2. **Dashboard:** the simulated mission (stable scenario, day 30) shows **Stable**, and the pet is happy. Every value is labelled *SIMULATED · synthetic*.
3. **Mission Simulator:** choose **Atypical vital sign**, then key day **D124 · Peak**. The result becomes **Attention**, with the rules that fired, the readings behind them, and a non-diagnostic next step. The pet becomes *concerned*. Try **D132 · After** to see it recover.
4. **Live Monitoring:**
   - *Simulated Sensor Feed*: press **Start feed** to watch new mission days arrive.
   - *Connected Monitoring Device*: honestly says nothing is connected.
   - *Manual Measurement*: enter a heart rate of `400` to see it rejected, then `72`, a blood pressure of `118/76` and a temperature of `98.4 °F` (converted to °C). The dashboard switches to your manual entries.
5. **Check-In:** log `4` hours of sleep. The result becomes **Review** (short sleep) and the pet becomes concerned.
6. **Pet:** try the command buttons or keys 1–6. The axolotl shows labelled equivalents (it floats rather than sits), and the status doesn't change.
7. **Reload the page:** the pet, manual entries and check-ins are still there.
8. **Trends** and **Summary:** charts with the demonstration thresholds and flagged points, plus a copyable, source-labelled summary.

## Status

| Area | State |
|---|---|
| Shared data contract, validation, unit normalization | ✅ |
| Ingestion service + IndexedDB storage (per-profile, survives reload) | ✅ |
| Assessment engine (demonstration rules, personal baseline, `unknown` handling) | ✅ |
| Live Monitoring: simulated feed / manual / device (honest "not connected") | ✅ |
| Dashboard, monitoring result, metric cards with provenance and freshness | ✅ |
| Pet companion: cat / dog / axolotl, 4 wellness states, 6 commands + keys | ✅ |
| 180-day mission simulator, 5 scenarios, timeline preview | ✅ |
| Daily check-in, trends charts, mission summary | ✅ |
| Citations for rules (NASA/CSA sources) | ⏳ in progress |
| Offline PWA build, Auth0, camera gestures, voice, sound | stretch |

## Architecture

```
sources (manual | simulated | device-stub)
  → ingestion: validate → normalize units → provenance & quality flags
  → storage (IndexedDB, per demo profile)
  → assessment engine (pure TypeScript)
  → AssessmentResult → dashboard / alerts / charts / pet wellness
pet commands (buttons → later gesture/voice) → animation only, never health state
```

| Path | Purpose |
|---|---|
| `src/features/health/types.ts` | Shared contract: `Measurement`, `CheckIn`, `AssessmentResult`, pet types. **Coordinate before changing.** |
| `src/features/health/metrics.ts` | Metric catalog: units, hazards, input plausibility limits (not clinical thresholds) |
| `src/features/health/assessment/` | `assess()` — the single pure assessment engine; `rules.ts` holds all demonstration-only thresholds |
| `src/features/pets/wellness.ts` | `derivePetWellness()` — pet mood from the assessment result only |
| `src/features/simulation/` | Deterministic scenarios + timeline preview |
| `src/app/state.tsx` | Provider wiring storage → ingestion → assessment → UI |
| `src/services/storage/` | `HealthRepository` (IndexedDB + in-memory) |
| `src/services/ingestion/` | `validateMeasurement()` — the single entry point for every data source |
| `src/theme/tokens.ts`, `src/index.css` | Design tokens |
| `resources/nasa/reference-links.md` | Sources and review status |
| `CLAUDE.md` | Full project brief and engineering rules |

## Stack

React 18 · TypeScript · Vite · Tailwind CSS v4 · Recharts · IndexedDB (`idb`) · Vitest.

## Screenshots

![Dashboard at the peak of the atypical-vital scenario](docs/screenshots/02-dashboard-attention.png)

## License

MIT — see [LICENSE](LICENSE).
