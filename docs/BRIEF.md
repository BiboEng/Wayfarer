# Wayfarer — Build Brief for Claude Code (Lead Agent + Subagents)

You are the **Lead Agent** for building a mobile app called "Wayfarer" (placeholder name). You will not write most of the code yourself. Your job is to plan, define contracts between parts of the system, delegate work to specialist subagents, review and integrate their output, and keep me (the human) in the loop.

This file lives at `docs/BRIEF.md`. It is my spec. **You may propose changes to it, but never edit it without my approval.** Progress and decisions go in `docs/PROGRESS.md` (see A7).

Read this whole brief once before doing anything. Then follow "Step 0" below. In later sessions, you do not need to re-read the whole brief: read `docs/PROGRESS.md` and the Part D section for the current phase.

---

## Project context (read first)

- **Purpose:** a personal side project for my GitHub and LinkedIn portfolio. I may scale it later, so keep provider interfaces clean, but do not build for scale now. Code quality, a clear README, and a working demo matter more than features.
- **Test device:** Android phone only. iOS is out of scope for now, but do not make choices that would block adding iOS later.
- **Budget:** about $10–30 per month total for APIs and hosting. Cost controls (caching, caps, cheap defaults) are requirements, not nice-to-haves.
- **Public repo:** the repo will be public. Nothing secret may ever be committed, including in git history.
- **I am new to Expo.** When a step involves Expo/EAS concepts (dev builds, config plugins, EAS env vars), explain them briefly in plain language the first time.

---

## Part A — How the team works

### A1. Subagent mode (default)
- Use **subagents** defined in `.claude/agents/` and coordinate everything yourself: give each subagent a focused task, collect its summary, and pass relevant results to the next one.
- Do **not** use experimental agent teams unless I explicitly ask. They cost far more usage and I want to follow what is happening.
- Run subagents in parallel only when their work is truly independent and the shared contract for that work is already final (marked "PARALLEL OK" in Part D).
- Do not spin up agents for trivial tasks. If a task is a few lines, do it yourself.

### A2. Step 0 — before any phase
1. Ask me one question: am I on Windows, macOS, or Linux? This decides whether the Android dev build is made locally (Android Studio) or in the cloud with EAS Build. Recommend one and explain why.
2. Check that the official Expo plugin (`expo@claude-plugins-official`) and the Expo MCP server are available in this session. If not, stop and tell me exactly how to install/connect them.
3. Create the Expo app with `create-expo-app`. It generates its own `CLAUDE.md`, `AGENTS.md`, and `.claude/settings.json`. **Extend the existing `CLAUDE.md`; do not overwrite it.** Add the project conventions: TypeScript everywhere, small focused files, folder structure, the "no secrets in the repo or app bundle" rule, the file ownership table from A4, the definition of done from A5, and the rule "at the start of each phase, read `docs/PROGRESS.md` and the current phase in `docs/BRIEF.md`". Keep `CLAUDE.md` short (about one page); it is loaded every session.
4. Create the subagent definition files in `.claude/agents/` for each role in A3. Each file has YAML frontmatter (`name`, `description`, `tools`, optionally `model`) and a system prompt describing the role, the folders it owns, the folders it must not touch, and the definition of done. Give the reviewer read-only tools.
5. Initialise git with a `.gitignore` that covers `.env`, `server/.env`, build outputs, and keystores. Create `docs/PROGRESS.md`.
6. Show me: a short overall plan, the folder structure, the list of agents with one line each, how the API contract will be shared (see A4), and your hosting recommendation for the backend (see Part B, Backend hosting). Then **wait for my go-ahead**.

### A3. Roles

| Agent | Responsibility |
|---|---|
| **Lead (you)** | Planning, writing and owning the shared contracts, assigning tasks, integrating, running the final checks for each phase, writing my setup instructions, updating `docs/PROGRESS.md`, committing, and talking to me. The only agent that asks me questions or declares a phase complete. |
| **mobile-ui** | Expo app shell, navigation (Expo Router), screens (Home, Live Tour, Explore, Settings, debug screens), components, theme, fonts, custom warm Google map style. |
| **tour-engine** | Device-side logic: expo-location (foreground + background via expo-task-manager), Android foreground service config, speed detection, heading/bearing math, landmark ranking, narration queue, pre-fetch, visited list (AsyncStorage), audio playback config, on-device TTS fallback, and the "simulate a route" fake-GPS tool. Keeps this logic in plain, testable TypeScript modules separate from UI. |
| **landmark-data** | The `LandmarkProvider` interface implementation: Wikipedia GeoSearch + extracts + OSM Overpass, rate limiting, polite User-Agent headers, merging/deduplicating results, caching lookups, and the widening-radius search for Explore mode. |
| **backend** | Node.js + Express server in `/server`: env config, endpoints, OpenRouter narration (model name in config), the narration prompt, the `TTSProvider` interface and implementations, caching, cost caps, rate limiting, error responses, deployment config. |
| **qa** | Unit tests for pure logic (bearing, left/right/ahead, speed modes, ranking, queue rules, cache keys, cost caps), integration checks for endpoints, type-checking, and running the app/server where possible. Reports failures back to the owning agent rather than silently fixing other agents' code. |
| **reviewer** (read-only) | Reviews each phase before I see it: security (no secrets in the repo, app bundle, logs, or git history), cost controls, hands-free safety rules, correctness, file size and clarity, and whether the brief's requirements were actually met. Produces a short findings list for the Lead. |

### A4. Coordination rules
- **Contracts first.** Before parallel work starts in a phase, the Lead writes or updates the shared contract: request/response types for every endpoint, the `Landmark` type, the `LandmarkProvider` and `TTSProvider` interfaces, and error shapes. Put them in one place both app and server use. Choose the simplest reliable way to share them (e.g. a `/shared` folder with Metro configured to watch it, or npm workspaces) and explain the choice to me. Agents code against the contract; only the Lead changes it.
- **File ownership.** Each agent edits only its own folders. Suggested ownership (adjust in Step 0 and record it in `CLAUDE.md`):
  - mobile-ui → `app/` screens, `src/components/`, `src/theme/`
  - tour-engine → `src/tour/`, `src/location/`, `src/audio/`, `src/dev/`
  - landmark-data → `server/src/landmarks/` (landmark discovery runs on the server so lookups can be cached and rate-limited in one place; change this only with a stated reason)
  - backend → the rest of `server/`
  - qa → `**/__tests__/`, test config
  - Lead → `/shared`, `CLAUDE.md`, root config, `docs/`, `.github/`
- **Secrets.** Server secrets live only in `server/.env` (git-ignored), with `server/.env.example` holding placeholders. The Google Maps Android key is injected through `app.config.ts` from an environment variable (EAS environment variables for builds), never hard-coded in `app.json`. Never print real keys in logs or chat.
- **Things only I can do.** If a step needs me (creating accounts, pasting API keys, running a dev build, installing on my phone, granting permissions, walking or driving outside), stop and tell me in plain language exactly what to do, then wait. Do not fake it or skip it.
- **Don't guess at libraries.** Expo and React Native APIs change between SDK versions. Check the Expo skills/MCP docs for the installed SDK before using an API, especially for background location, background audio, foreground services, and react-native-maps.

### A5. Definition of done (every task)
- TypeScript compiles with no errors (`tsc --noEmit`) in both app and server.
- Pure logic has unit tests and they pass.
- Lint passes.
- No file grows into a grab-bag; split files that do more than one thing.
- The owning agent writes a 3–5 line summary of what changed and anything the Lead needs to know.

### A6. End of each phase
1. Lead integrates the work and runs all checks.
2. Reviewer reviews; owning agents fix findings.
3. Lead updates `docs/PROGRESS.md` (see A7).
4. Lead reports to me: what was built, how to run/test it myself, any setup I need to do, open issues, and anything in this brief that turned out to be a bad idea or has a simpler alternative (as a proposed edit to this brief, not a direct edit).
5. After I approve, Lead commits with a clear message (one commit per phase is fine; conventional-commit style, e.g. `feat: landmark discovery`).
6. **Wait for my go-ahead before starting the next phase.**

### A7. `docs/PROGRESS.md`
A running log the Lead keeps up to date. Sections: **Current status** (which phase, what works), **Decisions** (each with a one-line reason), **Open issues**, **Setup I've done** (accounts created, keys added, build method), **Next phase**. Keep it concise; it is read at the start of every session.

---

## Part B — Product spec

### Core idea
The user opens the app, puts on headphones, and taps "Start Tour". As they move, the app detects notable landmarks nearby (buildings, monuments, mosques/churches/temples, historic districts, bridges, squares, museums). It generates a short, engaging spoken narration about each one's history and plays it automatically. There is also a second mode: a world map where the user can tap anywhere on Earth, and the app narrates the history of the nearest notable landmark to that point.

Narration language: English only for now.

### Tech stack
- React Native with Expo (TypeScript), Expo Router. Use an Expo development build, not Expo Go, because background location and background audio require it. Target Android.
- Location: expo-location, with background location via expo-task-manager running as an Android foreground service (persistent notification while a tour is active).
- Audio: expo-audio, configured to keep playing in the background and with the screen locked, and to handle Android audio focus sensibly (pause or duck for calls and navigation prompts).
- Map: react-native-maps with the Google provider (Maps SDK for Android key, restricted to the app's package name and signing certificate). Custom JSON map style.
- Backend: a small Node.js + Express server in `/server`. It holds all API keys and proxies every AI and TTS call.
- AI narration: OpenRouter (chat completions API). Model name is a config value. Default to a cheap, capable model; tell me the expected cost per narration.
- Voice: behind a `TTSProvider` interface (`synthesize(text, voice) -> audio`). Implementations, selected by a `TTS_PROVIDER` env value:
  - `elevenlabs` — best quality, for demos.
  - `openai` — cheaper option (add when convenient, at the latest in Phase 7).
  - `none` — server returns text only and the app speaks it with on-device TTS (expo-speech). Free; the default during development.
- Landmark data: Wikipedia GeoSearch API plus page extracts for facts, and the OpenStreetMap Overpass API for landmark types (historic=*, tourism=attraction, amenity=place_of_worship, etc.). Behind a `LandmarkProvider` interface so Google Places can be added later.

### Backend hosting
The phone must be able to reach the server over mobile data, not just home Wi-Fi.
- During early development: phone and laptop on the same Wi-Fi using the laptop's LAN IP, or a tunnel (e.g. Cloudflare Tunnel or ngrok).
- From Phase 3 onward: deploy the server to a cheap host (e.g. Render, Railway, or Fly.io). Recommend one in Step 0 within my budget and explain trade-offs such as free tiers sleeping (cold starts) and whether the disk is persistent (affects the cache).
- The server URL is app config, not hard-coded.

### Cost controls and abuse protection
- Cache narration text and audio by `landmarkId + length + voice`. Put the cache behind a small `CacheStore` interface; start with the simplest option that survives redeploys on the chosen host, and tell me if it doesn't.
- Cache landmark lookups (Wikipedia/Overpass) by rounded coordinates and radius, with a sensible expiry.
- A daily cap on TTS characters and LLM calls, set in `.env`. When reached, the server falls back to text-only (app uses on-device TTS) and logs it, rather than failing.
- Per-IP rate limiting on all endpoints.
- A simple app token header checked by the server. This is a speed bump against casual abuse, not real authentication; say so in the README.

### Feature 1: Live Tour mode (the main feature)
1. User taps Start Tour. Request foreground location, then background location ("Allow all the time", which Android sends the user to Settings for), and notification permission (needed for the foreground service notification). Show a clear explanation screen before each request. If the user refuses background location, the tour still works in the foreground with a short note explaining the limitation.
2. Track location continuously. Re-check for landmarks whenever the user has moved a meaningful distance (not every GPS tick).
3. Adapt to speed:
   - Walking (< ~10 km/h): search radius ~150–250 m, narrations ~60–90 seconds.
   - Driving (> ~10 km/h): search radius ~600–1000 m, prioritize landmarks AHEAD in the direction of travel (use heading), narrations ~30–60 seconds so they finish before the place is behind you.
4. Rank candidate landmarks by: has a Wikipedia article (notability), distance, and whether it is ahead of the user. Pick the best one not already narrated.
5. Never repeat a landmark in the same tour. Persist a "visited" list locally (AsyncStorage) so it is not repeated on the same day either.
6. Narration queue: never overlap audio, and never cut off a narration halfway. If nothing notable is nearby, stay silent. Do not invent filler.
7. Pre-fetch: while one narration plays, prepare the next most likely landmark so there's little delay.
8. Optionally give a brief orientation line before a narration when it helps, e.g. "Coming up on your left..." (calculate left/right/ahead from heading and bearing).
9. Battery: use the lowest location accuracy and update frequency that still meets the rules above, and lower them while driving at steady speed if that's reliable.
10. Weak or no signal: if a request fails, skip quietly and retry at the next check. Never block the tour or show a popup.

### Feature 2: Explore the World mode
- Full-screen world map in the app's theme.
- User taps anywhere. The app finds the nearest notable landmark to that point (Wikipedia GeoSearch, widening the radius if nothing is found), drops a pin, shows its name and a short card, and plays the narration.
- Show a loading state while the narration is generated.
- If nothing notable is found (e.g. the middle of the ocean), say so in the UI instead of narrating something made up.

### Narration quality (AI prompt on the backend)
- Ground every narration in the Wikipedia extract and OSM data passed to the model. Use only facts supported by that source material; never invent dates, names, or events.
- For places of worship and other culturally or religiously significant sites, stay respectful and factual.
- Tone: a warm, knowledgeable local guide telling a story, not reading an encyclopedia. Open with a hook, give the most interesting history, end naturally.
- Write for the ear: short sentences, no lists, no markdown, numbers written so they read well aloud.
- Length target is passed in by the app (driving vs walking, and the Settings length choice).

### UI / design
Reddish-brown, warm, "old map and leather-bound journal" feel. Dark theme by default. Starting palette, which you can refine:
- Background: #2A1410 (deep brown)
- Surface/cards: #3D1F18
- Primary: #8B3A2B (reddish brown)
- Accent: #C1693C (burnt orange/copper)
- Text: #F3E6D8 (warm cream); secondary text: #C9B3A0

Use a serif font for headings (e.g. Playfair Display or Cormorant) and a clean sans-serif for body text. Style the map with a custom warm-toned Google map style that matches the palette.

Screens:
1. Home: large Start/Stop Tour button (big enough to hit while driving, without needing to look closely), plus a button to Explore the World.
2. Live Tour: what's playing now (landmark name, a photo from Wikipedia if available), a pause/skip control, a small map with your position and nearby landmarks, and a scrollable list of places narrated so far (tap to replay).
3. Explore the World: full-screen tappable map with a bottom card for the selected landmark.
4. Settings: voice choice, narration length (short/medium/long), and a toggle for walking/driving/auto-detect.

**Safety:** in Live Tour, everything must work hands-free once started. No popups that need interaction while moving. The foreground-service notification should include pause and stop actions so the tour can be controlled from the lock screen.

---

## Part C — General instructions
- TypeScript everywhere, clear folder structure, small focused files.
- Explain any setup steps I need to do myself (API keys, building the dev build, running on my phone) in plain language.
- Tell me if any decision here is a bad idea or if there's a simpler way to do something.
- When you finish a phase, suggest what I should test by hand and what to watch for.

---

## Part D — Phases and who does what

Each phase ends with the steps in A6. Start each phase in plan mode and show me the plan before writing code.

**Phase 1 — Project setup** (Lead first, then PARALLEL OK)
- Lead: repo layout, root config, `/shared` contract skeleton, `CLAUDE.md` additions, `docs/PROGRESS.md`, a GitHub Actions workflow that runs type-check, lint, and tests on every push.
- Then in parallel: **mobile-ui** sets up theme/colors/fonts and navigation between all four screens (placeholder content); **backend** sets up Express, env config, `.env.example`, app-token check, rate limiting, and a health-check endpoint.
- qa: confirm both start and type-check.
- Lead: write my instructions for creating accounts and keys (OpenRouter, ElevenLabs, Google Cloud Maps SDK for Android with key restrictions), and for making the first Android dev build and installing it on my phone.

**Phase 2 — Landmark discovery** (PARALLEL OK)
- Lead: finalize `Landmark` type and `LandmarkProvider` interface in the contract.
- **landmark-data**: Wikipedia GeoSearch + extracts + Overpass provider, with lookup caching.
- **mobile-ui**: debug screen that lists nearby landmarks for any coordinates I type in.
- qa: tests for merging/deduplication and the widening-radius search, using recorded sample responses rather than hitting live APIs in tests.

**Phase 3 — Narration pipeline + deployment** (mostly backend)
- **backend**: endpoint taking a landmark + length + voice, returning narration text (OpenRouter) and audio (via `TTSProvider`), with caching and the daily cost caps. Implement `elevenlabs` and `none` TTS providers.
- **backend**: deploy the server to the chosen host; Lead gives me step-by-step instructions for the parts I must do (account, env vars).
- Lead: review the narration prompt against the "Narration quality" rules before it ships.
- qa: tests for caching, cost caps, and error handling; a small script to generate a sample narration for a known landmark so I can listen to it, and that prints the estimated cost.

**Phase 4 — Explore the World mode** (PARALLEL OK)
- **mobile-ui**: full-screen styled map, tap handling, pin, bottom card, loading and "nothing found" states.
- **tour-engine**: the audio player module (shared later by Live Tour), including the on-device TTS fallback for text-only responses.
- Lead: wire them to the Phase 2 and 3 endpoints end to end, using the deployed server.

**Phase 5 — Live Tour mode, foreground** (tour-engine leads, mobile-ui supports)
- **tour-engine**: tracking, movement threshold, speed detection, heading/bearing and left/right/ahead, ranking, queue, pre-fetch, visited list.
- **tour-engine**: the "simulate a route" dev tool (moved earlier from Phase 7) that feeds fake GPS points into the same pipeline as real GPS, with a walking route and a driving route, so I can test at my desk.
- **mobile-ui**: Live Tour screen (now playing, photo, pause/skip, mini map, narrated list with replay) and Settings screen.
- qa: thorough unit tests for every rule in Feature 1 (no overlap, no cut-off, no repeats, silence when nothing is nearby).

**Phase 6 — Background location + background audio** (tour-engine, Lead verifies)
- **tour-engine**: expo-task-manager background task as an Android foreground service, notification with pause/stop actions, background audio config, permissions in app config.
- Lead: tell me exactly how to rebuild the dev build and test with the screen locked, and how to exempt the app from battery optimisation on my phone if the tour stops in the background (some Android brands kill background apps aggressively).

**Phase 7 — Polish** (PARALLEL OK)
- **mobile-ui**: loading states, error and offline-friendly messages.
- **backend**: API failure handling, timeouts, sensible fallbacks; add the `openai` TTS provider.
- **reviewer**: final full-app review against this entire brief, with a checklist of every requirement marked done / partial / missing.

**Phase 8 — Portfolio packaging** (Lead)
- README: what the app does, screenshots/GIF placeholders for me to fill, architecture overview, how to run it locally, cost notes, and the honest limitations (e.g. the app token is not real auth).
- `docs/ARCHITECTURE.md` with a Mermaid diagram of app ↔ server ↔ external APIs.
- A LICENSE (ask me which).
- Run a secret scan over the full git history (e.g. gitleaks) before I make the repo public.
- Tell me what to record for a short demo video.
