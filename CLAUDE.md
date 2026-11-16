# SYNORA — NASA Space Apps Challenge 2026

> **Shared project instructions for Claude Code.** This file belongs in the root of the SYNORA repository. Read and follow it before making changes. It is an engineering brief, **not** evidence that any feature is implemented.

## Project and mission

- **Repository:** https://github.com/aymanakhan/SYNORA
- **NASA challenge:** Create Health Monitoring Software for Astronauts on Space Missions
- **Official challenge:** https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/
- **NASA challenge resources:** https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources
- **Additional research:** https://osdr.nasa.gov/bio/repo and https://humanresearchroadmap.nasa.gov/Explore/
- **Development context:** Team project, approximately 36-hour hackathon. Prioritize a working, explainable demonstration over feature count.

**Purpose:** Build SYNORA, an offline-capable, interactive astronaut wellness and health-monitoring *educational prototype*. Astronauts should be able to record health indicators, inspect trends, notice unusual changes, access spaceflight-specific research explanations, and prepare information for appropriate medical review. A selected virtual pet responds supportively to the **same monitoring assessment** used by the dashboard. SYNORA is **not** a certified medical device and does not diagnose or prescribe treatment.

## Execution rules — critical

1. **FIRST TASK IS ANALYSIS ONLY.** Inspect the repo and resources; return the report specified at the end of this file. **Do not edit files, install dependencies, create cloud resources, commit, or push until the user explicitly approves an implementation task.** Reading and non-destructive inspection are permitted.
2. Once approved, do **one scoped development task at a time**. Keep the application runnable; test each major change. Explain changed files and test results.
3. Follow existing repository patterns, frameworks, `CLAUDE.md`, and code. Do not redesign UI, overwrite teammates' changes, or migrate stacks without explicit approval. Avoid unnecessary dependencies and decoration.
4. Check `git status`, current branch, remote/tracking information, and recent commits before changes. Never discard uncommitted work, force-push, rewrite shared history, push to `main`, or merge PRs automatically. Do not push or commit unless authorized by the user for that task.
5. Work on an approved feature branch. Use small pull requests and obtain review before merging. If another teammate has changed overlapping files, surface the conflict and coordinate rather than guessing.
6. Never expose secrets; never commit `.env`, access tokens, real health records, or credentials. Use `.env.example` with placeholders. Use synthetic health data for demonstrations.
7. Keep explanations concise and technical. State uncertainties, unfinished features, inaccessible sources, and risks explicitly. Do not invent claims about the codebase or NASA research.
8. During initial analysis, **do not interpret this brief as permission to build the entire app**. This file defines intended architecture and acceptance criteria, not a single implementation request.

## MVP: one complete user journey

The key demo should work end to end, not as disconnected mockups:

1. A judge opens SYNORA **without needing Auth0** and enters clearly labeled offline **Demo Mode**.
2. They choose a **cat, dog, or axolotl**, and the selection persists. Pets use original consistent pixel-art sprites (placeholders acceptable initially).
3. They see the astronaut health dashboard and choose **Live Monitoring**.
4. On the Live Monitoring screen, they can choose **Manual Measurement** or **Simulated Sensor Feed**. A **Connected Monitoring Device** option is visibly labeled *Future / Stretch* and must not pretend to connect if unsupported.
5. A manual reading is entered, validated, labeled with units/source/time, saved, and displayed in history/chart; alternatively, a simulated reading arrives from a visibly synthetic feed.
6. A single independent assessment engine evaluates the new data, including data quality and personal baseline where sufficient data exist.
7. The dashboard shows an understandable, **non-diagnostic** monitoring result with the triggering rule and uncertainty; the pet reacts to **that identical result**.
8. A NASA- or other credible-source-supported explanation is available where relevant; when unsupported, label the rule as illustrative.
9. The judge selects a predefined mission scenario or mission day and sees the synthetic feed, dashboard, charts, alerts, and pet update coherently.
10. Demo profile and records persist after reload. The core demo works without Auth0, cloud AI, or live NASA APIs.

**Definition of done:** All of the above flows work and have been tested, with no simulated readings presented as real measurements. Auth0, AI, real wearables, webcam gestures, voice commands, elaborate animations, and PDF export must not block this demo. A mouse/touch pet command fallback must work before camera or microphone enhancements.

## Core features and scope

### 1. Health-data acquisition and Live Monitoring — HIGH PRIORITY

**SYNORA must account for where *current* measurements come from.** Implement a single input/ingestion pipeline with these sources:

- **Manual measurements — MVP:** Astronaut types values measured with instruments (e.g., heart-rate monitor, blood pressure cuff, thermometer, pulse oximeter, dosimeter), plus subjective check-ins (sleep, mood, stress, symptoms). Accept valid units, timestamps, and source notes. Do not imply continuous or automatic observation from a manually entered value.
- **Simulated sensor feed — MVP:** Deterministic, clearly marked synthetic readings with optional play/pause, selectable scenarios, mission-day navigation, and periodic demo updates. Must pass through **the same ingestion, storage, assessment, dashboard, and pet pathways** as manual input. Simulated readings are never real astronaut data.
- **Connected device — STRETCH:** Architect a source adapter interface for future Bluetooth Low Energy devices, suitable file imports, or authorized health-data APIs. Actual integration only if hardware/API can be tested. Never claim that any smartwatch measures all supported indicators or that consumer sensors are validated in spaceflight. Device support is not required to finish the hackathon MVP.

**Live Monitoring screen (important demo feature):** Show three unmistakable source choices: **Simulated Sensor Feed**, **Manual Measurement**, **Connected Monitoring Device (Future / Not Connected)**. Clearly display mode, connection status, last reading time, data provenance, and synthetic-data notices. In simulated mode show start/pause and a controlled scenario; in manual mode a usable form; in device mode an honest unsupported/coming-later message, not a fake sensor connection. Allow navigation to the dashboard and historical trends.

**Unified Measurement/Ingestion Service:** Source adapter → schema validation → unit normalization → associated profile/user → event timestamp and reception timestamp → provenance (`manual`, `simulated`, `device`, `import`) → quality flags → storage → assessment-engine notification → dashboards/charts/alerts/pet. Normalize the API once rather than making every page interpret source-specific formats. Reject malformed data, preserve relevant precision, handle out-of-order data and duplicates sensibly, and never silently fabricate missing values.

**Freshness:** Clearly identify current versus historical data, and indicate stale, disconnected, or missing streams. A simulated feed must have an obvious synthetic indicator at all times. A current-looking animation must never imply a live sensor is connected when none is.

**Suggested common record (adapt to existing code; avoid gratuitous rewrites):** `id`, `profileId`/verified `userId`, `metric`, `value` (or structured systolic/diastolic), `unit`, `measuredAt`, `recordedAt`, `source`, `isSynthetic`, `qualityStatus`, `deviceOrMethod?`, `notes?`, `scenarioId?`. Distinguish physiological readings, self-reports, and environmental/dosimeter exposure records.

### 2. Astronaut health dashboard

Include, where available: heart rate, blood pressure, body temperature, SpO₂, sleep duration/quality, stress/mood, radiation exposure, and trends. Show source, timestamp, units, missing/stale state, demo/real labeling, and the selected pet. Do not invent missing readings or show 'all clear' when evidence is insufficient.

### 3. Independent health assessment and alerts — HIGH PRIORITY

Build a **pure, testable assessment module** independent of UI, Auth0, FastAPI, AI, device integration, and storage. It consumes validated readings, history, check-ins, baselines, and documented demonstration rules; it returns structured outputs consumed by every feature.

Output: status (`stable`, `review`, `attention`, `unknown`), triggered rule IDs, explanation, evidence measurement references, confidence/limitations, missing-data flags, and suggested *non-prescriptive* next-step category (e.g., verify measurement; review credible guidance; consult flight surgeon per applicable protocol).

- **Stable:** No configured illustrative rule triggered among *adequate available data*, not proof of medical safety.
- **Review:** An unusual pattern merits verification/review.
- **Attention:** An illustrative rule flags a potentially concerning pattern for human medical review—not a diagnosis.
- **Unknown:** Not enough reliable information.

Use individual baselines only when enough suitable observations exist. Mark every threshold as sourced/validated or **demonstration-only**; do not invent NASA medical thresholds or official treatment protocols. Never claim emergency prediction or prescribe treatments. Address uncertainty, sensor errors, confounding factors, and missing data. Test every rule with representative and edge-case inputs.

### 4. Virtual pet companion — HIGH PRIORITY

Selection during onboarding/demo: **cat, dog, axolotl**, saved per profile. Basic placeholder artwork first; animations/art later. Derive pet state from the shared assessment result and check-in flags, not independent medical logic:

- `happy`: monitoring data sufficient and stable under demonstrative rules.
- `tired`: self-reported fatigue, poor sleep, or elevated stress, if no higher-priority concern.
- `concerned`: health monitoring engine flags review/attention.
- `unknown`/neutral: insufficient data or no assessment.

Define clear precedence (e.g., concerned > tired > happy; unknown when evidence insufficient) without turning the pet into a diagnostic indicator. Supportive messages only: no blaming, punishment, false reassurance, or discouraging symptom reporting. Pet uses the same data whether in manual or simulated mode.

### 5. Pet interaction controls — GESTURES HIGH-VALUE STRETCH; VOICE OPTIONAL

The companion is interactive, not just a status indicator. **Keep medical state independent of actions**:

- **Health-driven wellness state:** `happy`, `tired`, `concerned`, `unknown` comes only from the assessment engine and documented check-in flags.
- **Interaction/action state:** `idle`, `sit`, `stand`, `jump`, `pet`, `play` is temporary and comes from user commands. Actions must never modify a measurement, dismiss an alert, fake a better wellness state, or reward hiding symptoms. A concerned pet may still respond to play.
- **Pet choices:** cat, dog, and **axolotl**. The axolotl's distinctive motion is gentle zero-gravity floating and gill-wiggling/bubbles, not a forced terrestrial sit/stand animation. Define pet-specific mappings for shared commands; if unavailable, provide a meaningful equivalent and label it clearly.

**One shared command controller** receives events from on-screen mouse/touch buttons, optional camera gestures, and optional speech recognition. Command contract (team decision): `sit | stand | jump | pet | play`. There is no separate `float`; for the axolotl, `stand` is shown and labelled **Float**. A renderer translates these to each species' available actions. Add basic, tested action buttons **before** camera/voice integration. Actions should debounce or queue sensibly; include an accessible keyboard alternative.

**Camera hand gestures — high-value stretch after health MVP:** Use `@mediapipe/tasks-vision` (Gesture Recognizer or Hand Landmarker) with explicit camera permission. Agreed mappings (implemented): pointing up → stand (axolotl: float); pointing down → sit (derived from landmarks); closed fist → jump; open palm held still → pet; wave → play (derived from lateral wrist movement). A moving-hand-across-pet `pet` interaction is a later stretch goal requiring landmark tracking, region overlap, and temporal logic. Apply confidence threshold, multi-frame confirmation/smoothing, cooldown, and a visible recognized-gesture → dispatched-action label. Test lighting, mirrored webcam presentation, rapid repeats, and loss of tracking. Show camera on/off and permission/error status. **No webcam requirement for the core demo.** Process frames in the browser; never record, store, or upload footage by default. Bundle model/runtime assets locally if claiming offline gesture recognition. Reduce processing when inactive and stop tracks when disabled.

**Audio feedback — after working action animations:** Short licensed or original pet sounds and optional subtle UI feedback, with mute/volume and browser-autoplay compliant user-initiated playback. The axolotl may have a stylized original squeak rather than a falsely labeled zoological recording. Avoid excessive alerts and repetitive noise. Respect reduced-motion and sound preferences.

**Voice commands — optional stretch:** Push-to-talk recognition for `sit`, `stand`, `jump`, `pet`, `play` (and "float" as the axolotl's stand) where browser support allows; show transcription, permission/support/error status and equivalent buttons. Web Speech API implementations may send audio to a third-party service and may require connectivity; disclose this clearly and **do not promise private/offline recognition without verification**. Never listen continuously or upload audio to SYNORA servers. No paid speech API is required. Spoken responses or conversational AI are lower-priority stretch goals.

**Gesture and voice safety:** The camera/microphone are opt-in, off by default, with clear stopping controls. Never connect pet movement to clinical claims. Do not use webcam images to infer medical measurements or mood. Keep the app usable when permission is denied or the browser lacks these APIs.

### 6. Visual identity and pixel-art design system — AGREED STYLE

**Visual concept:** *Retro-futuristic space mission control + charming 2D pixel pet*, balanced with clear and trustworthy health information. Pixel art supplies emotion, identity, and delightful interactions; medical content remains readable, modern, restrained, and accessible. This is **not** a full-screen arcade game or a medical device aesthetic copied from NASA.

**Base design tokens (use existing tokens where present; avoid gratuitous redesign):**

| Role | Color |
| --- | --- |
| Deep space background | `#0B1020` |
| Navy background | `#111827` |
| Panel background | `#172033` |
| Card surface | `#1E293B` |
| Telemetry cyan | `#38BDF8` |
| Soft teal | `#2DD4BF` |
| Pixel mint | `#86EFAC` |
| Mission purple | `#A78BFA` |
| Stable indicator | `#22C55E` |
| Review indicator | `#FACC15` |
| Attention indicator | `#F97316` |
| Critical illustration only (not an official category) | `#EF4444` |
| Unknown/inactive | `#94A3B8` |
| Primary text | `#F8FAFC` |
| Secondary text | `#CBD5E1` |
| Muted text | `#94A3B8` |

Never rely on color alone for status: show icons/text and maintain contrast. There are **four monitoring assessment categories only** (`stable`, `review`, `attention`, `unknown`); the red token is not permission to invent a clinical 'critical' diagnosis. Token names and exact shades may be adjusted for accessibility if necessary and documented.

**Typography:** Use an appropriately licensed, self-hosted **pixel display font** only in short branding/headings, pet labels, mission day counter and decorative buttons. Use a readable sans-serif (e.g. Inter, IBM Plex Sans, Space Grotesk, or system sans-serif) for measurement values, forms, chart axes, alerts, explanations, and long text. Do not use tiny 8-bit text for clinical information.

**Layout:** Desktop-first responsive dashboard with restrained top bar (SYNORA identity, demo/account/mission status), nav for Dashboard, Live Monitoring, Check-In, Trends, Pet, Mission Simulator, Summary, Settings. Keep navigation adaptive on smaller screens. Health metric cards, charts, source labels, and alerts occupy primary space; pet panel is a visible but not obstructive companion. Space HUD/grid/star accents must be faint and non-distracting.

**Components:** Use layered dark panels, subtle edges, calm cyan/teal interaction accents, readable inputs, unambiguous alert text, and consistent spacing. Pixel-styled edges, badges, and buttons can be used primarily in pet/simulator regions. Avoid flashing, loud warnings, unnecessary glows, tiny text, giant block borders, or animated distractions. For health alerts, show status label, supporting measurement, provenance, explanation, and next-step category.

**Pet art:** Original cohesive 2D pixel-sprite lineup: **silver-gray/cream cat**, **warm tan/brown dog**, **pink axolotl with distinctive frilled gills**. Aim for a consistent 32×32 or 48×48 *base grid* and clear silhouettes, enlarged with crisp nearest-neighbor rendering (`image-rendering: pixelated` where appropriate). Placeholder sprites first. Core expressions: idle, happy, tired, concerned, neutral/unknown; action frames for sit, stand, jump, pet, play, and axolotl float/bob. Keep animations minimal (2–6 frames initially), never mislabeling action frames as medical state. Do not use third-party copyrighted characters or unlicensed sounds/fonts.

**Motion/audio:** UI transitions should be subtle; pet can blink, wiggle, bob, wag, float, etc. Honor `prefers-reduced-motion`, provide sound mute/volume, and avoid autoplay audio. Treat gesture/voice recognition UI as compact, accessible controls with camera preview, on/off button, gesture label, last action, and permission/error feedback; don't cover crucial charts.

**Branding:** SYNORA — *Your Health. Beyond Earth.* Use a compact original wordmark with optional orbit/pulse/pixel-star motif, no suggestion of NASA endorsement. Pixel art is the identity; scientific clarity is the priority. Do not redesign an existing usable UI without approval, especially during hackathon core implementation.

### 7. Daily astronaut check-in

Record sleep duration and quality, mood, stress, energy, symptoms, exercise, and notes; timestamp and scope by profile; permit reviewing history. The assessment/pet may use relevant inputs with transparent rules. Keep check-in short.

### 8. Trends and visualizations

Interactive charts for available vitals, sleep, stress/mood, radiation exposure, and wellness history. Show time ranges, units, uncertainty, provenance, gaps, and alert markers; do not join missing data misleadingly. Charts must update after manual entry and simulated ingestion.

### 9. Mission simulator — HIGH PRIORITY

Build a deterministic **fictional 180-day Mars mission** with selectable days and scenarios: stable, worsening sleep, elevated self-reported stress, atypical vital sign, and recovery. Use clearly labeled *synthetic* inputs; do not present forecasts of actual astronaut physiology. Simulation flows through the **normal measurement pipeline and shared assessment engine**; alerts, charts, and pets should change consistently. Maintain isolation from real accounts. This is the primary judge demo, not an afterthought.

### 10. Authentication and accounts — Auth0 FREE, after demo core is working

Plan identity and per-user data isolation from the beginning; implement **Auth0 Free** when the monitoring demo is reliable. Requirements: email/password registration/sign-in, logout, secure sessions, protected application routes and APIs, display name/email/optional photo, stored pet preferences, loading/error states. Google sign-in is optional if feasible within free limits.

**Match the actual repository framework:**
- If **React + Vite + FastAPI**: use `@auth0/auth0-react` and Auth0 Universal Login with Authorization Code + PKCE for a **Single Page Application**; register a protected Auth0 API/audience for FastAPI. Acquire API access tokens via the supported SDK flow, send in `Authorization: Bearer` headers, validate signature/JWKS, issuer, audience, and expiry on FastAPI. Use **verified token `sub`**, never a client-supplied user ID, for server-side access control.
- If **Next.js**: use the currently appropriate official Auth0 **Next.js SDK**; do **not** insert that SDK into a Vite SPA. Inspect existing routes and architecture first.
- Auth0 **client ID/domain are public configuration**. Client secrets and other private credentials are never exposed to the frontend or via `VITE_` variables. Use SDK-managed tokens; don't unnecessarily store tokens in localStorage. Use `.env.example`, exact permitted callback/logout/origin URLs, and no paid features.
- Auth0 manages identities, **not** SYNORA health-record storage. Isolate records server-side by authenticated user; never store private health histories in Auth0 metadata. A local SQLite file on one developer's machine is not automatically a shared, hosted database.
- **Offline mode:** separate, clearly labeled fictional demo profiles with local storage. Do not bypass real-user authorization, treat expired cloud sessions as valid, or merge demo records into real accounts automatically. Explain realistic offline account-access limitations.
- Cloud configuration, providers, deployments, paid upgrades, and secret-related changes require user approval. Implement authentication only after core monitoring, dashboard, and basic pets work.

### 11. Offline support

Use local storage (preferably IndexedDB for structured demo readings) with a clear separation per local demo profile/account. Previously available data, check-ins, the assessment engine, mission scenarios, and pets should work offline. A local development server alone is **not** proof that a deployed web application works offline; if true offline launching is required, test a service worker/PWA cache in a production build. Do not implement complicated cloud sync for MVP. Protect sensitive browser caches; use only synthetic demo data during the hackathon.

### 12. Radiation and data provenance

Radiation readings require a stated unit (and exposure period/type where relevant), provenance, and preferably dosimeter source. Do not claim a smartwatch produces radiation measurements or infer personal radiation dose from unrelated vitals. Clearly distinguish imported, manual, and synthetic records. For any external NASA datasets, identify source, study conditions, licenses, and whether they are spaceflight, ground analog, or simulation; do not imply they are an individual astronaut's real-time values.

### 13. AI assistant — OPTIONAL STRETCH

Only after MVP: explain measurements/trends, summarize records, contextualize NASA science, and describe rules *non-diagnostically*. No autonomous treatment, diagnosis, or fabricated citations. Do not send real personal health records to external AI without suitable privacy design and explicit informed action. Entire core app must function without AI, API keys, or paid usage.

### 14. Mission health summary — MEDIUM/STRETCH

An on-screen, source-aware summary for a selected time range: latest metrics, trends, check-ins, rules triggered, gaps, assumptions, and a brief exportable report concept for flight-surgeon review. No automatic transfer. PDF export is optional.

## Research and evidence rules

Read the official NASA challenge and resources and applicable NASA/CSA original research. NASA's five spaceflight hazards provide context; document what can actually be measured aboard spacecraft versus what a prototype merely simulates. For any feature or alert explanation, link relevant claims to the source, state limitations, and distinguish research findings from design assumptions. Build `resources/nasa/reference-links.md` or equivalent after approval, with source URL/title, relevant metric, study population/context, and notes. If a link/PDF is inaccessible, report it; never pretend to have read it. Check asset and dataset permissions before redistributing. Use no real medical records in demos.

## Recommended stack — inspect before selecting

- Frontend: **React + TypeScript + Vite**, **Tailwind CSS**, **Recharts**.
- Backend (only if needed by existing architecture/account records): **FastAPI / Python**.
- Server database: **SQLite** for local/prototype backend; document limitations of hosted/persistent storage.
- Offline demo records: **IndexedDB**.
- Auth: **Auth0 Free** with official SDK matched to framework.
- Optional later: Claude API (only if explicit budget/privacy approval).

Do **not** migrate a pre-existing Next.js or other project just to match this recommendation. Choose minimum necessary dependencies. Prefer a lightweight local assessment module that can be reused by manual and simulated inputs.

## Proposed modular layout (adapt after repo inspection)

```text
SYNORA/
├── CLAUDE.md
├── README.md
├── .env.example
├── resources/nasa/
│   ├── reference-links.md
│   └── research-notes.md
├── src/                         # if React/Vite is used
│   ├── app/                      # routes, providers, navigation
│   ├── components/               # dashboard, charts, pet, forms
│   ├── features/
│   │   ├── monitoring/           # LiveMonitoring: manual/simulated/device UI
│   │   ├── health/               # metric schemas, validation, assessment engine
│   │   ├── pets/                 # selection, state mapping, pixel sprites, command controller
│   │   ├── pet-input/            # optional camera/MediaPipe, push-to-talk speech, sound
│   │   ├── simulation/           # deterministic 180-day mission scenarios
│   │   ├── checkins/
│   │   ├── theme/                # only if needed; shared palette/typography tokens
│   │   └── auth/                 # later Auth0 integration
│   ├── services/
│   │   ├── ingestion/            # input adapters and normalized measurements
│   │   └── storage/              # IndexedDB/demo profile abstraction
│   └── tests/
└── backend/                     # only if required; FastAPI + persistence
```

Do not create this layout wholesale if the existing repository already has a reasonable structure. The central separation is **sources → ingestion → storage/assessment → UI/pet/simulation**.

## Implementation phases (only after approval)

1. **Analysis and research (NOW; no coding):** Inspect repo, `CLAUDE.md`, relevant NASA references, branch/status, stack, features, risks; propose an MVP and first coding task.
2. **Data contract and acquisition:** Define measurement schema, provenance, manual-entry validation, simulated source adapter, shared ingestion interface. Test source labeling and input boundaries.
3. **Assessment engine:** Implement baseline and demo-only alert logic independent of UI, with `unknown` behavior and tests.
4. **Dashboard, Live Monitoring, and pets:** Build working manual/simulated mode selector, chart update, pet selection and four states; use placeholder graphics.
5. **Mission simulator:** Deterministic synthetic scenarios through shared ingestion/assessment, including 180-day navigation.
6. **Check-ins and fuller charts:** Add persisted daily wellness entries, visualization, and explanatory detail.
7. **Auth0 Free and real account records:** Only after core demo works; secure backend authorization and account isolation, with explicit configuration approvals.
8. **Offline deployment reliability:** Confirm persistence, offline behavior of actual deployed build, profile isolation, and optional on-screen mission summary.
9. **Pet interaction polish — only after MVP:** Add on-screen pet commands + basic action sprites first; next webcam/MediaPipe 2–3 stable gestures; then pet audio; optional petting-motion tracking and push-to-talk voice. Preserve pixel style and allow mouse/touch fallback.
10. **Optional polish:** AI, file/device import, PWA install, exports—only with time remaining.
11. **Submission:** Tests, scientific citations, clear synthetic labels, README, screenshots/demo video, deployment link, pull request and final submission. Reserve time to demonstrate; avoid last-minute feature creep.

## Team collaboration / handoffs

- Each member uses their own clone and approved feature branch (for example `feature/health-engine`, `feature/live-monitoring`, `feature/pets`, `feature/auth0`, `feature/simulator`). Agree on shared measurement/assessment interfaces **before parallel editing**.
- Before continuing somebody's work: inspect current branch and `git status`; fetch latest changes without discarding edits; inspect merged commits/PR descriptions and existing tests. **Claude does not automatically know teammates' unpushed files or private chats.**
- Document in each pull request: scope, modified files, setup instructions, tests run, unfinished items, and dependencies. Review integration and CI/test results before merge.
- Do not change cross-team interfaces without coordinating; never silently resolve merge conflicts or overwrite others.

## What to test

- Manual values validate and persist; invalid/unknown inputs handled.
- Simulated feed is explicitly labeled, reproducible, and **not** stored as real health data.
- Dashboard and charts update on both manual and simulated input.
- Assessment alerts are reproducible, source-aware, and honest about missing data.
- Pet reactions match assessment/check-in state; concerning conditions are not overridden by a cheerful pet. Pet action commands never change health state or readings.
- Pet selection offers **cat, dog, axolotl** with persistent selection, accessible button actions, and correct per-species animation mapping.
- If gesture/voice features are approved, test permission-denied states, browser support, clear status indicators, trigger cooldowns, and stop-camera/stop-microphone behavior.
- Verify readable text and charts, keyboard access, status labels beyond color, reduced-motion behavior, and local asset licensing.
- Scenario/day changes flow through the same ingestion and assessment contracts.
- Local reload preserves demo records and pet choice; separate profiles do not leak data.
- Authenticated APIs reject unauthenticated and wrong-user access once Auth0 is built.
- Offline behavior is tested realistically, including app reload where supported.
- Scientific claims cite verifiable sources; demonstration-only thresholds and data are clearly labeled.

## FIRST TASK — ANALYSIS ONLY (start here)

Before editing any code:

1. Inspect the actual repository and Git status/branch/remotes. Read this `CLAUDE.md` and any existing project conventions. Do **not** assume folders and features shown above already exist.
2. Identify actual files, frameworks, dependencies, implemented features, and test commands.
3. Review accessible NASA challenge requirements/resources; distinguish verified information from assumptions and list unavailable sources.
4. Recommend the smallest hackathon MVP and minimal architecture **based on existing code**.
5. Describe the source-agnostic measurement ingestion architecture, particularly **Live Monitoring's three choices** and source labeling/freshness.
6. Describe the shared assessment engine, personalized baseline safeguards, and **cat/dog/axolotl** wellness states versus separate user-triggered action states.
7. Describe deterministic simulated mission data and how judges can demo the app without hardware/accounts.
8. Recommend folder structure and precise files that would be created/changed (do not create them yet).
9. Recommend phased implementation, first coding task, tests, and a safe feature-branch workflow.
10. Determine whether Auth0 should use the React SDK or Next.js SDK; list eventual configuration, protected API approach, and secrets handling.
11. Identify the minimum pixel-art design tokens and existing UI elements to preserve; propose a gesture/voice implementation path with browser/permission/offline caveats and clear stretch-goal prioritization.
12. Identify missing information, data/science limitations, security issues, and teammate integration risks.

**Response format, ideally under 500 words:** Repository status; recommended architecture; achievable MVP; data acquisition / Live Monitoring; pet + assessment design; pixel visual plan; gesture/voice stretch approach; simulator; Auth0 approach; phases; exact first coding task; missing information / access limitations.

**Stop after the analysis. Wait for the user's explicit approval before implementing anything.**

---

## Final engineering recommendations

1. **One independent assessment engine is non-negotiable.** It must not depend on UI, Auth0, cloud services, pet artwork, or demo machinery. Both Live Monitoring inputs use the same pipeline and the same assessment output drives dashboard, alerts, and pet.
2. **Build one polished end-to-end demo story:** select pet → choose simulated feed or enter manual measurement → see source and timestamp → save → chart updates → monitoring explanation appears → pet reacts → switch mission day/scenario → see coherent changes and sensible next-step guidance.
3. **Scientific credibility over drama:** cite NASA/CSA or other original scientific references where possible; identify illustrative rules, uncertainty, and data gaps. Do not imply actual clinical validation.
4. **Make current data provenance obvious:** manual vs synthetic vs future device; reading time; stale/disconnected state; no fabricated live hardware connection. The three-option Live Monitoring screen is a *core feature*, not just a stretch UI.
5. **Functionality over feature count:** ingestion, assessment, dashboard, pets, simulator, and charts first; Auth0 and fuller offline reliability next; gesture pet controls and audio only once the core demo works; AI, hardware, elaborate art, and PDFs last.
6. **Demonstrable without dependencies:** no required Auth0 login, live NASA API, paid AI, or real wearable for the core judge demo. Use local synthetic scenarios and offline-capable assets.
7. **Integration discipline:** shared data contracts first, independent feature branches, small PRs, short handoff notes, no unreviewed overwrites, and a reliable presentation path before the deadline.

8. **Pixel personality, clinical readability:** Apply the dark mission-control palette, readable metric charts, concise alerts, and crisp original pixel sprites for cat/dog/axolotl. Do not use pixel fonts for measurement data. No redesign without approval.
9. **Gesture wow-factor with graceful fallback:** For judging, a reliable open-palm/pointing-up/fist gesture with clear webcam indicator, visible pet response, and optional short sound is preferable to five unreliable gestures. Always keep on-screen buttons. Push-to-talk voice is optional.
10. **Keep fun and wellness separate:** Pet actions are animation events; health-driven wellness states are evaluation outputs. A jumping, purring, or floating pet must not change or conceal the astronaut's actual monitoring status.
