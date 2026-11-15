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

## Status

| Area | State |
|---|---|
| App shell, design tokens, Demo Mode banner | ✅ done |
| Shared data contract (`src/features/health/types.ts`) | ✅ done |
| Measurement validation + unit normalization (+ tests) | ✅ done |
| Storage (IndexedDB), ingestion pipeline | ⏳ next |
| Assessment engine | ⏳ next |
| Live Monitoring, dashboard, charts | ⏳ planned |
| Pet companion (cat / dog / axolotl) | ⏳ planned |
| 180-day mission simulator | ⏳ planned |
| Auth0, gestures, voice | stretch |

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
| `src/services/ingestion/` | `validateMeasurement()` — the single entry point for every data source |
| `src/theme/tokens.ts`, `src/index.css` | Design tokens |
| `resources/nasa/reference-links.md` | Sources and review status |
| `CLAUDE.md` | Full project brief and engineering rules |

## Stack

React 18 · TypeScript · Vite · Tailwind CSS v4 · Vitest. Planned: Recharts, IndexedDB.

## License

MIT — see [LICENSE](LICENSE).
