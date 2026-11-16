# SYNORA: Submission Notes & Full Project Briefing

> **How to use this file:** Part A has ready-to-paste drafts for each field of the NASA Space Apps project form. Part B is a complete briefing on the project, so you can paste this whole file into any AI assistant and ask it questions. Part C has likely judge questions with answers.
>
> Team: **Terra.Byte** · Challenge: **Create Health Monitoring Software for Astronauts on Space Missions** (NASA Space Apps Challenge 2026)
> Live app: **https://aymanakhan.github.io/SYNORA/** · Code: **https://github.com/aymanakhan/SYNORA**
> **Deadline: Sunday 15 November 2026, 11:59 PM local time. Only "Submit for Judging" counts; "Save Progress" alone does not.**

---

## Part A: Ready-to-paste form answers

### 1. Project Name
SYNORA

### 2. Summary (form limit 1,500 characters; suggested 50–200 words)
*About 190 words, under 1,500 characters.*

> SYNORA is an offline-capable web app that helps astronauts on long missions monitor their own health, understand what their readings mean, and know when to involve a flight surgeon. Astronauts record vital signs from their instruments (heart rate, blood pressure, temperature, SpO₂, blood glucose, dosimeter radiation dose) and a short daily check-in (sleep, mood, stress, energy, symptoms). One transparent assessment engine turns these into a clear, non-diagnostic status (Stable, Review, Attention, or Unknown when data is insufficient). It shows the rule that triggered, its uncertainty, and simple next steps such as "sit for 5 minutes and re-measure". It explains why each indicator matters in space using NASA Human Research Program and Canadian Space Agency sources, and tracks the five spaceflight hazards, including cumulative radiation dose. A deterministic 180-day Mars mission simulator lets anyone see trends and alerts develop. A pixel-art companion (cat, dog or axolotl) reacts to the same assessment, and daily measurement reminders with rewards keep astronauts engaged. It runs in the browser without accounts or internet and labels all demo data as synthetic. SYNORA is an educational prototype, not a medical device.

### 3. Project Demonstration (required; ≤ 30-second video OR ≤ 7 slides; public link with no login)
**You still need to create this.** You can't just reuse the app link: the form asks for a video or slides. Two options:

**Option 1: 30-second screen recording** (record https://aymanakhan.github.io/SYNORA/ with your phone or computer's screen recorder, then upload to YouTube as *Unlisted* or *Public*, or to Google Drive with "Anyone with the link can view"):
- **0:00–0:03** Title screen / dashboard header: "SYNORA: Your Health. Beyond Earth. Team Terra.Byte, NASA Space Apps 2026."
- **0:03–0:10** Problem: "On a 3-year Mars mission, astronauts must assess their own health far from doctors." Show the dashboard.
- **0:10–0:20** How it works: Mission Simulator → "Atypical vital sign" → D124 Peak → the dashboard turns **Attention**, shows the rule, guidance, the body overview with heart highlighted, and the pet looks concerned. Quick cut to Live Monitoring manual entry, or the Trends whole-mission chart.
- **0:20–0:30** Future: "Built on NASA HRP and CSA research, offline-first, ready for real dosimeters and health devices. A companion that keeps crews engaged and safe."

**Option 2: 7-slide deck** (Google Slides shared as "Anyone with the link can view"):
1. Title: SYNORA, "Your Health. Beyond Earth.", team Terra.Byte, team member names, challenge name
2. The problem: long missions, the five hazards, astronauts self-assessing
3. What SYNORA does: dashboard screenshot (`docs/screenshots/02-dashboard-attention.png`)
4. How it works: record → one assessment engine → status + guidance + pet (diagram)
5. NASA/CSA data used: HRP hazards and risks, CSA radiation, cumulative dose tracking
6. User experience: simulator, trends, routine and pet rewards, gestures
7. Future: real devices, flight-surgeon review export, validated thresholds, accounts

Must be in English (or have English subtitles). Test the link in a private/incognito window before submitting.

### 4. Project (required; public link to the final project)
Use either, or put the live app first:
- **https://aymanakhan.github.io/SYNORA/** (live app, no login)
- **https://github.com/aymanakhan/SYNORA** (source code, README, tests)

### 5. Project Details (rich text; covers: what it does, how it works, benefits, impact, tools, creativity, factors considered)

> **What it does**
> SYNORA is a self-monitoring companion for astronauts on long-duration missions. It brings together three things astronauts need when the nearest doctor is millions of kilometres away: a simple way to record health indicators, an honest assessment of what those readings mean, and clear guidance on what to do next.
>
> **How it works**
> - **Record:** Live Monitoring offers three clearly separated data sources: *Manual Measurement* (values typed from instruments, with units such as °C/°F or mg/dL/mmol/L, timestamps and method), a *Simulated Sensor Feed* (clearly labelled synthetic data), and *Connected Monitoring Device*, honestly marked "Future / Not connected". A one-minute daily check-in records sleep, mood, stress, energy, exercise and symptoms. Every entry is validated (e.g. temperature must be 25–43 °C) and can be edited or deleted.
> - **Assess:** One pure, tested assessment engine evaluates all data and returns **Stable, Review, Attention or Unknown**. It never says "all clear" when data is missing or stale. It checks vital-sign ranges, multi-night sleep patterns, sustained stress or low mood, reported symptoms, deviations from the astronaut's own personal baseline, data-quality problems, and radiation (daily dose rate and cumulative mission dose). Every threshold is clearly labelled *demonstration-only*, because no clinically validated thresholds were available to us.
> - **Explain & guide:** Each alert shows the triggering rule, the reading and threshold in the user's chosen unit, confidence and limitations, and 2–4 practical steps (e.g. "Sit for 5 minutes, back supported… take two readings one minute apart"), escalating to the crew medical officer or flight surgeon when needed. "Why it matters in space" panels cite NASA Human Research Program and CSA pages.
> - **Visualise:** A clickable body overview (brain, heart, lungs, metabolism, immune/temperature, bones, whole-body radiation) coloured by the same assessment, plus trend charts (7/14/30 days/whole mission) with gaps left blank instead of joined, threshold lines, and flagged points.
> - **Simulate:** A deterministic fictional 180-day Mars mission with six scenarios (stable, worsening sleep, elevated stress, atypical vital sign, recovery, solar particle event) flows through the same validation, storage and assessment pipeline, so judges can explore without hardware or accounts.
> - **Engage:** A pixel-art companion (cat, dog or axolotl) mirrors the assessment (happy, tired, concerned, waiting for data) but never hides a flagged result. A daily routine reminds the astronaut what still needs measuring ("You haven't measured your blood pressure today") and rewards *logging*, never good numbers, so reporting a problem earns the same reward. Optional controls: buttons, keyboard, camera hand gestures (processed on-device), and push-to-talk voice.
> - **Summarise:** A source-aware mission health summary that can be copied for flight-surgeon review.
>
> **Benefits & intended impact**
> Earlier recognition of concerning trends, fewer missed measurements, and better-prepared conversations with flight surgeons, especially with communication delays far from Earth. Being honest about uncertainty (Unknown / demonstration-only / synthetic labels) builds trust and avoids false reassurance.
>
> **Tools & technology**
> React 18, TypeScript, Vite, Tailwind CSS, Recharts (charts), IndexedDB via `idb` (offline storage), a service worker (offline reload), MediaPipe Tasks Vision (on-device hand gestures), the Web Speech API (optional voice), the Web Audio API (original synthesized pet sounds), the Pixelify Sans font (SIL OFL), Vitest (236 automated tests), Playwright (browser testing), GitHub Actions and GitHub Pages (CI and hosting). Built with AI assistance from Claude Code (see SI section).
>
> **What makes it creative**
> A mission-control interface combined with a supportive pixel companion; a body map tied directly to the assessment; a solar-storm scenario showing cumulative radiation; rewards for honest reporting rather than "good" numbers.
>
> **Factors we considered**
> Safety and honesty (non-diagnostic language, no medications or doses, demonstration-only labels, synthetic-data labels everywhere); offline operation for deep space; privacy (data stays in the browser, camera and mic are opt-in and never recorded); accessibility (status always shown with icon and text, not colour alone; keyboard support; reduced motion); and scientific credibility (citing only sources we actually read).

### 6. Use of Super Intelligence (SI): disclose honestly
The form has a dropdown ("Select options"). We couldn't see the options in the PDF. Pick the ones covering **code generation** and **text/content writing/research summarisation**. **Do not pick "I did not use SI".**

Suggested descriptive text, if there's a text box (the guide says code and data must acknowledge SI in descriptive text and metadata):
> We used Claude Code (Anthropic's AI coding assistant) throughout development: to plan the architecture, write and test most of the application code, draft documentation, and summarise the NASA and CSA web pages we used as sources. Team members directed the requirements and design decisions (features, thresholds to label as illustrative, pet commands, gestures, layout), reviewed and tested the results, and approved every change through GitHub pull requests. All pixel art (pet sprites, body figure, logo) was drawn in code, not with image generators. Pet sounds are synthesized in code. No NASA logos or branding are used. The git history records AI co-authorship on each commit.

> ⚠️ The guide says **code and data must acknowledge SI generation in descriptive text and metadata**. Each commit already carries a `Co-Authored-By: Claude` line. A short "Built with AI assistance (Claude Code)" note in the README would also help (see the to-do list at the end).

### 7. NASA Data (required for Global Award eligibility; "Link Text" + "Link URL", one row each)
| Link Text | Link URL |
|---|---|
| NASA HRP: 5 Hazards of Human Spaceflight | https://www.nasa.gov/hrp/hazards/ |
| NASA HRP: Risks of Human Spaceflight | https://www.nasa.gov/hrp/risks/ |
| NASA HRP: Ongoing HRP Research in Space | https://www.nasa.gov/hrp/ongoing-hrp-research/ |
| NASA Space Apps 2026: Health Monitoring Software challenge | https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/ |

*(Don't list NASA's Human Research Roadmap or OSDR: we didn't actually use them.)*

### 8. Space Agency Partner & Other Data
| Link Text | Link URL |
|---|---|
| CSA: Monitoring radiation for astronaut health | https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp |
| CSA: Why do we conduct science experiments in space? | https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp |
| MediaPipe Gesture Recognizer (Google; on-device hand-gesture model) | https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer |
| Pixelify Sans font (SIL Open Font License) | https://fonts.google.com/specimen/Pixelify+Sans |
| React (MIT) | https://react.dev |
| Vite (MIT) | https://vite.dev |
| Tailwind CSS (MIT) | https://tailwindcss.com |
| Recharts (MIT) | https://recharts.org |
| idb, IndexedDB wrapper (ISC) | https://github.com/jakearchibald/idb |
| Claude Code (AI coding assistant, Anthropic) | https://www.anthropic.com/claude-code |

⚠️ **Check the MediaPipe gesture model's licence** on its model card before submitting (we believe Google's MediaPipe models are released under Apache 2.0, but nobody on the team has confirmed it). If unsure, you can mention it but say it's loaded from Google's public model storage.

### 9. Checkboxes
- "Agree to Terms and Conditions": tick after reading.
- "Confirm All Work is Original": the team must decide. All code was produced for this project (with AI assistance, which is permitted when disclosed). The project uses open-source libraries and a font under permissive licences, all listed above; no copyrighted images, music or NASA logos.

### 10. Then click **"Submit for Judging"** (not just Save Progress) before 11:59 PM local time.

---

## Part B: Full project briefing (for answering any question)

### B1. The challenge (official text, summarised)
Long-duration missions expose astronauts to space radiation, isolation and confinement, altered gravity, distance from Earth and hostile closed environments (NASA's **five hazards**). These can cause immune changes, bone loss, cardiovascular events and behavioural health problems. Astronauts must assess their own health. The task: build health monitoring software that gathers health indicators and helps astronauts evaluate and act on their health status, including guidance on treatments and improvements. Suggested indicators: blood pressure, heart rate, blood sugar (mg/dL), body temperature, daily sleep hours, mood. Suggested features: routine measurement prompts, gamification, dynamic charts, colour coding, simple instructions and explanations, and a clickable human figure.

### B2. How SYNORA maps to the challenge
| Challenge asks for | SYNORA |
|---|---|
| Gather health indicators | Manual instrument entry (11 metrics) + daily check-in + simulated feed; device adapter planned |
| Evaluate health status | One assessment engine → Stable / Review / Attention / Unknown |
| Act on it / guidance | "What you can do now" steps per finding; escalation to flight surgeon; no drugs or doses |
| Blood pressure, heart rate, blood sugar, temperature, sleep, mood | All included (plus SpO₂, stress, energy, sleep quality, radiation dose) |
| Five hazards | Each metric is tagged with related hazards; radiation dose rate + cumulative dose |
| Prompt measurements as routine | "Today's routine" reminders with "Measure now" links |
| Gamification | Pixel pet companion, stars, treats, streaks (rewarding logging, not values) |
| Dynamic charts | Trends: 7/14/30 days/whole mission, thresholds, flagged points, gap-aware |
| Colour coding | Green/yellow/orange/grey, always with icon and text too |
| Instructions & explanations | How-to-measure tips + "why it matters in space" with NASA/CSA citations |
| Clickable human figure | Body overview with labelled, clickable regions |
| Different environments | Fictional 180-day Mars mission simulator |

### B3. Features in detail
- **Demo Mode, no login:** onboarding chooses a pet (cat, dog, axolotl) and name; everything stays in the browser (IndexedDB) and survives reloads. "DEMO MODE · Offline" and "not a medical device" banners are always visible.
- **Live Monitoring:** three sources (Simulated feed with start/pause/speed and scenario; Manual form; Device = honest "Not connected"). Shows mode, last reading time, provenance, and synthetic notices.
- **Manual entry:** unit choice (°C/°F, mg/dL/mmol/L, h/min, mSv/µSv). The chosen unit becomes the display unit everywhere (warnings, charts, limits; changeable in Settings). Input sanity limits: temperature 25–43 °C (77–109.4 °F), BP systolic 50–300 / diastolic 30–200 mmHg, HR 20–250 bpm, SpO₂ 50–100 %, glucose 20–600 mg/dL, sleep 0–24 h, scales 1–5, radiation 0–1000 mSv. Time defaults to the moment of saving. Edit/Delete per entry. Duplicate detection.
- **Daily check-in:** sleep hours, sleep quality, mood, stress, energy (1–5), exercise minutes, symptoms, notes. One check-in per day (a second one updates that day's). Edit/Delete with confirmation.
- **Dashboard:** monitoring result with findings, guidance, confidence, limitations, missing data; today's routine; body overview; metric cards (value, unit, source badge, age, "not current" if stale, edited tag); pet companion.
- **Assessment rules (all *demonstration-only*; not clinical or NASA thresholds):**
  - Heart rate: review ≥100 or <50 bpm; attention ≥120 or <40
  - Systolic BP: review ≥140 or <90; attention ≥160. Diastolic: review ≥90; attention ≥100
  - Temperature: review ≥38.0 or <35.5 °C; attention ≥39.0 or <35.0
  - SpO₂: review <95 %; attention <92 %
  - Blood glucose: review ≥180 or <70 mg/dL; attention ≥250 or <54
  - Sleep: review if last night <5 h, or 3 consecutive nights each <6 h (one entry per night; a skipped night breaks the streak)
  - Stress ≥4/5 or mood ≤2/5 on 3 consecutive days → review
  - Any reported symptom → review (with a "thank you for reporting")
  - Personal baseline: a reading ≥3 standard deviations from the person's own average → review (needs ≥7 readings over ≥3 days; uses a minimum spread so tiny variations don't alarm)
  - Data quality: suspicious readings (e.g. very narrow BP gap) → "re-measure"
  - Radiation: latest dose rate ≥2 mSv/day review, ≥10 attention; cumulative recorded dose ≥150 mSv review, ≥300 attention (illustrative, **not NASA limits**)
  - **Unknown** when fewer than 2 of 4 core vitals (HR, BP, temperature, SpO₂) are current. Vitals count as current for 24 h, self-reports 36 h, dosimeter 7 days. Stale data is explained ("your latest readings are from 26 h ago").
- **Guidance:** 2–4 practical steps per rule, different for high and low readings; escalation wording; never medications or doses (enforced by an automated test).
- **Knowledge panels:** "Why it matters in space" for every metric, quoting/paraphrasing only NASA HRP and CSA pages the team read, plus general "how to measure" tips labelled as not mission procedure.
- **Body overview:** full-width labelled body scan (brain & mind, heart & circulation, lungs & oxygen, metabolism & nutrition, immune & temperature, bones & muscles marked "not tracked", whole-body radiation). Region colours come from the same assessment. Subtle seams between regions. Details for the selected region below.
- **Trends:** charts per metric; 7/14/30 days/All (whole mission); dashed demonstration thresholds; flagged points (square = review, diamond = attention); gaps left blank; values in the chosen units.
- **Mission simulator:** fictional 180-day Mars mission; scenarios: Stable, Worsening sleep (from day 40), Elevated stress (from day 70), Atypical vital sign (days 120–127, peak 123–124), Recovery (poor early, recovers days 45–75), Solar particle event (days 95–97, cumulative review near day 175). Day slider, key-day buttons, play mission, colour timeline of all 180 days computed by the same engine. Data is deterministic (same every time) and always labelled synthetic.
- **Pet companion:** wellness (concerned > tired > unknown > happy) comes only from the assessment. Commands sit, stand (called **Float** for the axolotl), jump, pet (keys 1–4) are cosmetic only. Camera gestures (opt-in, processed on-device, never recorded): point up → stand/float, point down → sit, fist → jump, open palm held still → pet. Push-to-talk voice (discloses that browser speech services may send audio to the provider). Original synthesized sounds, off by default.
- **Routine & rewards:** heart rate, BP, temperature, SpO₂, dosimeter, check-in each day; a star per task logged; a treat and celebration when complete; streak counter.
- **Summary:** copyable, source-aware plain-text summary for a flight-surgeon conversation (nothing is sent automatically).
- **Settings:** units, reset data, rule list (in chosen units), sources.
- **Offline & reliability:** service worker so the deployed app reloads without internet; the gesture model is bundled into the site build; if another tab blocks a storage upgrade, the app explains it instead of hanging.

### B4. Architecture (one paragraph)
Sources (manual form, simulated feed, future device) → a single ingestion service (validation, unit normalisation, provenance, synthetic flag, quality flags, duplicate check) → IndexedDB storage → one pure TypeScript assessment engine (no UI or storage dependencies) → the dashboard, alerts, charts, body map and pet all read the same result. Manual and simulated data are never mixed in one assessment. The simulator uses the same pipeline as manual entry.

### B5. Research sources actually read
- NASA HRP "5 Hazards of Human Spaceflight": the five hazards; radiation "one of the most hazardous aspects of spaceflight"; Mars at 3/8 Earth gravity; ~3-year Mars round trip.
- NASA HRP "Risks of Human Spaceflight": cardiovascular adaptations; altered immune responses (viral reactivation → rashes/symptoms); hypoxia; nutrition; sensorimotor (motion sickness, dizziness); bone loss and exercise countermeasures; behavioural health; sleep loss and irregular schedules; radiation-induced cancer risk.
- NASA "Ongoing HRP Research in Space": Artemis II ARCHeR study of well-being, activity and sleep.
- CSA "Monitoring radiation for astronaut health": neutron radiation ≈30 % of ISS radiation; the CANS instrument.
- CSA "Why do we conduct science experiments in space?": longer missions mean more weightlessness, radiation, isolation, communication delays, and less reliance on Earth for medical help.
- **None of these sources give numeric medical thresholds**, so all rules are labelled demonstration-only.

### B6. Honest limitations / not done
- Thresholds are illustrative, not clinically validated.
- Simulated physiology is hand-tuned and fictional (not a forecast of real astronauts).
- No real device integration yet (BLE/imports planned); no accounts/Auth0 (no tenant); no backend.
- Gestures and voice were tested with automated browser tests but not with a real webcam and microphone by the developer.
- Pet sprites are 16×16 placeholders (the design brief suggested 32×32 or 48×48).
- Demo data only; not for real medical records.

### B7. Development story (timeline)
Analysis → shared data contract and validation → assessment engine → storage → simulator → full UI → NASA/CSA explanations → offline support → body map → CI and GitHub Pages hosting → pet font, sounds, gestures, voice → team feedback round: fixed the false multi-night sleep alert, edit/delete, radiation rules, guidance, routine reminders, unit-aware display, input limits, 30-day and whole-mission trends, simplified pet commands (removed float as a separate command and play), redesigned body overview. Changes went through GitHub pull requests #1–#6 with automated tests (236 passing).

---

## Part C: Likely judge questions (with short answers)

- **Is this a medical device? Does it diagnose?** No. It's an educational prototype that flags patterns for human review and never diagnoses or prescribes.
- **Where do the thresholds come from?** They're illustrative, round numbers chosen for the demo and clearly labelled. The NASA/CSA sources explain *why* indicators matter but don't give thresholds. In a real system, flight surgeons would configure validated ones.
- **How do you avoid false reassurance?** "Unknown" when data is missing or stale, confidence levels, limitations shown, and the pet can never look happy when something is flagged.
- **How does it work without internet?** All data and logic are in the browser (IndexedDB plus a service worker). There's no server or cloud AI.
- **What NASA data did you use?** NASA HRP hazard, risk and research pages for explanations and hazard mapping, plus CSA radiation material. Radiation is tracked as both a daily dose rate and a cumulative mission dose.
- **What about privacy?** Data never leaves the device. The camera and microphone are opt-in, processed locally and never recorded.
- **Why a pet?** Engagement on long, isolating missions. It rewards *logging* (including reporting problems), not good numbers, to avoid encouraging astronauts to hide symptoms.
- **What's next?** Real dosimeter and health-device adapters, flight-surgeon-configured validated thresholds, secure accounts and sync, a PDF export for medical review, larger sprites, and more languages.

---

## Last-minute to-do (in order)
1. ☐ Make the 30-second video or 7-slide deck; upload it with a public, no-login link; test it in a private window.
2. ☐ Fill in Summary, Project Details, SI, NASA Data, Partner Data (copy from Part A).
3. ☐ Project link: https://aymanakhan.github.io/SYNORA/ (and/or the GitHub repo).
4. ☐ Tick both checkboxes, then click **Submit for Judging** before 11:59 PM local time. You can edit and resubmit until the deadline.
5. ☐ (Nice to have) Add an "AI assistance" line to the README; check the MediaPipe model licence.
