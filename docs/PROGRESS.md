# Wayfarer — Progress

## Current status
**Phase 5 (Live Tour, foreground) is done: reviewed and approved by the human (2026-11-02).** `npm run check` passes (884 app tests, 837 server tests); `expo export --platform android` bundles. Added `expo-keep-awake` (already in the dev build through `expo`, so no rebuild).
- **Tour engine** (`src/tour/`, tour-engine): pure modules plus `create-tour-session.ts` (dependencies injected) and the `tourSession` singleton.
  - Speed modes with hysteresis: driving after ~15 s above 12 km/h, walking after ~30 s below 7 km/h; Settings can fix the mode. Walking searches 200 m and re-checks every 60 m; driving searches 800 m centred ~400 m ahead (works around Wikipedia's 20-nearest cap), re-checks every 250 m, and only takes places ahead.
  - Ranking needs a Wikipedia article; scores distance and ahead; `place-quality.ts` pushes down probable non-places and events (the Phase 2 open issue).
  - Queue rules in `tour-machine.ts`: one story at a time, the next only after the current one ends, at most one pre-fetch, in-flight requests reused, stale driving stories dropped, silence when nothing qualifies. Failures are silent and retried at the next check (distance, or 60 s after a failure while standing still). Fixes rougher than 100 m (walking) / 150 m (driving) are ignored.
  - No repeats: in the tour and per local day (`visited.ts`, AsyncStorage).
  - Orientation line in the same voice: server cues `GET /narrations/cues/:cue` ("Coming up ahead / on your left / on your right"), made once per voice, cached in the audio store (re-made after its 30-day purge for ~25 characters). The player plays an optional `intro` before the story as one narration; with the phone voice the phone speaks it; a missing cue never delays a story.
  - Permissions: foreground only (Phase 6 adds background). On-screen states for needs-permission, denied, location off and approximate-only (Android 12+); no popups mid-tour; Android's "improve accuracy" dialog is suppressed.
- **Location and simulator** (`src/location/`, `src/dev/`): `watchPositionAsync` at high accuracy (walking 10 m / 3 s, driving 30 m / 5 s, restarted on mode change). Dev-only route simulator feeds the same pipeline: walk Sultanahmet (~1.9 km at 5 km/h) and drive Karaköy → Ortaköy along the Bosphorus (~5.1 km at 40 km/h).
- **Screens** (mobile-ui): Live Tour (`src/app/tour.tsx`, `src/components/tour/`): now-playing card with photo and side line, big Pause/Resume and Skip, mini map with our own position marker and pins, narrated list with replay, Stop Tour, dev source picker, screen kept awake; leaving the screen stops the tour. Settings: voice (from `GET /voices`, "Phone voice" when empty), length, travel mode; saved in AsyncStorage (`src/settings/`), used by Live Tour and Explore (Explore keeps walking).
- **Server** (backend): `server/src/narration/audio-maker.ts` (TTS + audio store + cap, extracted from `narrate.ts`, shared by narrations and cues), `narration/cues.ts`, `routes/cues.ts`. Cue audio key is `sha256("cue|provider|voice|text")`.
- **Review:** no blockers; five should-fixes (permission race, approximate location, retry while stationary, accuracy gate, driving search cap) and nine nits fixed.

**Phase 4 (Explore the World) is done: reviewed, phone-tested and approved by the human (2026-11-01).** Dev build `737ab19b` carries the Maps key. `npm run check` passes (427 app tests, 813 server tests); `expo export --platform android` bundles. No new packages, no server changes.
- **Explore screen** (`src/app/explore.tsx`, `src/components/explore/`): full-screen Google map in a warm dark style (`src/theme/map-style.ts`, reused by Live Tour later). Tap → nearest landmark → pin + bottom card (thumbnail, name, kind, distance, Wikipedia link) → the story plays. States: searching, writing the story, getting ready, playing/paused, ended (Replay), nothing within 10 km, error + Retry. Collapsible "Read the story" transcript.
- **Explore flow** (`src/explore/`, Lead): pure reducer + view mapping; stale responses are dropped by request id; a new tap stops the current story; leaving the screen stops Explore's story only. Explore narrates as `medium` / `walking` / server default voice until Settings exists (Phase 5). Retry after a playback failure replays the story it already has (no new server calls).
- **Narration player** (`src/audio/`, shared with Live Tour): app-wide singleton, one sound at a time, token-guarded so late callbacks from a stopped sound can't change state. Plays the server audio file (`src/api/narration-audio.ts` adds the app token header) and falls back quietly to expo-speech if it fails or doesn't start within 15 s. Device voice speaks ~300-character chunks; Android can't pause speech, so pause = stop and resume restarts the current chunk. Audio mode: `duckOthers`, background off.
- **Own country labels** (human's request after the first phone test, 2026-11-01): Google can't rename one label, so the map style hides Google's country names and `src/components/map/country-labels.tsx` draws our own from Natural Earth (public domain, 241 entries, `country-labels.data.ts`, generated by `scripts/country-labels/generate.mjs`). Per the human, the label at Israel's position reads "Palestine" (Natural Earth's separate Palestine entry is dropped). Labels follow Natural Earth's zoom ranges, capped at zoom 8, only those on screen, max 50. On Android a tap on a label marker searches from the label's point.
- **Review:** no blockers; three should-fixes (marker redraws, map framing under the card, Retry re-requesting) and three nits fixed.

**Phase 3 (narration pipeline) is done, except the deploy, which moves to Phase 6** (see Decisions). Reviewed with no blockers; `npm run check` passes (142 app tests, 807 server tests). The human ran the sample script with OpenRouter and ElevenLabs (2026-10-31).
- **Server:** `POST /narration` takes a landmark id + length + travel mode + voice. It reloads the landmark with `getById`, writes the story with OpenRouter (`OPENROUTER_MODEL`, default `google/gemini-2.5-flash-lite`, about $0.00015 a story) and makes audio through `TTSProvider` (`elevenlabs` or `none`). Text and audio are cached by landmark + length + mode + voice + prompt version. Daily caps (`DAILY_LLM_CALL_CAP`, `DAILY_TTS_CHAR_CAP`) fall back to the Wikipedia intro or to text only. Narration has its own per-IP rate limit. `GET /voices` lists voices. `server/scripts/sample-narration.ts` narrates one landmark and prints the cost.
- **App:** `src/api/narration.ts`, `src/hooks/use-narration.ts`, and a Narrate panel on the landmark debug screen (text only; playback comes in Phase 4).
- **Deploy files ready:** `server/Dockerfile`, `railway.json`.
- **Review follow-ups, fixed (Lead, 2026-10-31):**
  - The cap counters get their own store in memory mode (`server/src/costs/create-cap-store.ts`), so landmark lookups can't evict them.
  - The Dockerfile defaults to `CACHE_PATH=/data/cache.sqlite` and `AUDIO_DIR=/data/audio`. Memory mode still resets on restart, and the server warns about it at startup.
  - An unknown voice now falls back to the default voice (logged without the id).
  - The sample script prints a voice cost estimate, plus a token-based AI estimate when OpenRouter reports no cost (`server/src/costs/estimate.ts`).
  - The fake `sk-or-` test key was renamed.
  - The Lead edited backend-owned files for these.
- **Review nits still open:** drop a cut-off last sentence when `finishReason` is `length`; add the model to the cache key; the voice timeout can push past the app's 45 s; walking short/long fall slightly outside the brief's 60–90 s.

**Phase 2 (landmark discovery) is done.** Reviewed, `npm run check` passes (115 app tests, 419 server tests), and the human tested the debug screen on their phone in the first dev build (2026-10-27).
- **Contract:** `Landmark` and `LandmarkProvider` are final (adds `wikidataId`, `castle`, `archaeological_site`, `getById`). `shared/landmarks/search.ts` holds the radius limits and Explore steps; `shared/geo/distance.ts` is the shared haversine. Routes `GET /landmarks/nearby` and `GET /landmarks/nearest` (`null` = nothing found, a 200).
- **Server:** `server/src/landmarks/` merges Wikipedia GeoSearch (one call, ≤20 pages with intro extracts) with Overpass (Wikidata id → en title → name within 75 m). Time budgets: nearby 8 s (Overpass ≤6 s, no retry), nearest 16 s. One source failing gives partial results, cached 10 min; full results 7 days, empty 1 day; errors never cached. `server/src/cache/` has the `CacheStore` with memory and `node:sqlite` stores (`CACHE_PATH`), purging expired rows.
- **App:** `src/api/landmarks.ts` (nearest waits 20 s); debug screen Settings → Developer → Landmark debug, dev builds only (`Stack.Protected`).

**Phase 1 (project setup) is done and committed.** The human saw the four screens running in Expo Go on their phone (2026-10-08). The custom dev build (real fonts, connection to the server) is next.
- **App:** a dark "old map" themed shell with a Stack between Home, Live Tour, Explore and Settings, all placeholders. Fonts are Playfair Display and Inter, embedded through the expo-font plugin. Settings shows the server status through `src/api/health`.
- **Server:** Express 5 skeleton in `server/`.
  - zod env validation
  - per-IP rate limit on every route
  - app-token check (timing-safe)
  - public `GET /health`
  - `ApiError` responses with no stack traces
  - tsup bundles `@shared` into `dist/index.js`
- **Contract:** `shared/` has the API endpoints, error codes, health, narration options, and drafts of `Landmark`, `LandmarkProvider` and `TTSProvider`.
- **Checks:** `npm run check` runs typecheck, lint and tests for the app and the server, and all of it passes: 53 app tests (Jest), 45 server tests (Vitest). `expo export --platform android` bundles. CI (`.github/workflows/ci.yml`) runs the same checks plus the server build on Node 24.

## Decisions
- **Brief moved** from `BRIEF.md/brief.md` to `docs/BRIEF.md`, wording unchanged (human approved). The stale copy was deleted in Phase 1.
- **Project stays in the OneDrive folder** (human's choice). If npm hits EPERM/EBUSY errors, pause sync.
- **Expo SDK 57, default template.** Routes live in `src/app/`.
- **Template MIT LICENSE removed.** The human picks a license in Phase 8.
- **Git repo in the project folder, branch `main`.**
- **Android dev build through EAS Build (cloud).** Reason: Windows, no Android SDK, OneDrive path. (Approved 2026-10-08.)
- **Contract in a dependency-free `shared/`.**
  - Imported as `@shared/...` on both sides.
  - The app relies on Metro and tsconfig paths; Jest has an explicit `moduleNameMapper`.
  - The server resolves it with tsx in dev, and tsup inlines it into the bundle. Reason: no workspaces needed, nothing to publish. (Approved.)
- **Backend on Railway Hobby with a persistent volume.** It must build from the repo root so `shared/` is included. (Approved.)
- **Server deploy postponed from Phase 3 to the start of Phase 6 at the latest** (human approved 2026-10-31; deviates from Part D). Reason: Phases 4–5 can be tested at the desk over home Wi-Fi (Phase 5 has the route simulator), and Railway paused new signups after its 2026-10-21 security incident, so the host may change. Phase 6 needs the phone to reach the server over mobile data. A Cloudflare Tunnel from the laptop works as a stopgap. `server/Dockerfile` and `railway.json` stay ready.
- **Subagent models:** sonnet for mobile-ui, landmark-data, backend and qa; the session model for tour-engine and reviewer. (Approved.)
- **`src/explore/` is Lead-owned** (Explore flow logic and hook), since the brief gives the Explore wiring to the Lead. Added to the CLAUDE.md ownership table. (Phase 4)
- **Country names on maps come from our own data, not Google** (human's choice, so the app controls every name). Overrides live at the top of `scripts/country-labels/generate.mjs`. (Phase 4)
- **One app-wide narration player** shared by Explore and Live Tour; Explore uses `duckOthers` audio focus. (Phase 4 plan, approved.)
- **Live Tour rules (Phase 5 plan, approved):** a new story only after the current one ends; Skip, Replay (plays now) and Stop are the only interruptions; screen kept awake and the tour stops on leaving the screen until Phase 6; orientation line in the same voice from server cues (human's choice).
- **`src/settings/` is mobile-ui-owned** (CLAUDE.md row added). Settings uses themed buttons instead of `@expo/ui` pickers (their popups ignore the theme); `@expo/ui` is unused for now but kept for later switches. (Phase 5)
- **Package id `com.biboeng.wayfarer`.** It's tied to the Maps key restriction.
- **Native modules installed up front:** maps, location, task-manager, audio, speech, async-storage, dev-client. One dev build covers Phases 1–5; Phase 6 permissions mean one rebuild. (Human approved; deviates from the per-phase installs in Part D.)
- **Config in `app.config.ts` only (no `app.json`)**, so the Maps key comes from env. `npx expo install` can't auto-add plugins to it, so plugin entries are added by hand.
- **Node 24 LTS target.** CI and server `engines` use 24. Local Node is 24.22.1.
- **Test runners:** Jest (`jest-expo`) for the app and `shared/`; Vitest + supertest for the server. Reason: Expo's documented preset for the app; Vitest handles ESM and TypeScript in the server without extra config.
- **App API calls never throw.** `ApiResult` returns `{ ok, data | error }`, so the Live Tour can skip failures quietly.
- **The server loads `.env` with `process.loadEnvFile`** (guarded), not a CLI flag. It works on Node 20 and 24 with no "file not found" noise.
- **Removed unused template packages** (`expo-glass-effect`, `expo-symbols`, `expo-web-browser`, `expo-device`). `@expo/ui` is kept for the native pickers and switches in Settings.

## Open issues
- **Overpass (OpenStreetMap) was down or at capacity throughout Phase 2 testing** (2026-10-26; main server and two mirrors). The fallback to Wikipedia-only results works, but merging has only been tested on a hand-made fixture. Re-run `server/src/landmarks/__fixtures__/record.ts` when it recovers. If it stays unreliable, get landmark types from Wikidata instead (every Wikipedia result has a Wikidata id).
- **Wikipedia returns geotagged events** (e.g. "740 Constantinople earthquake") as landmarks. Handled in Phase 5 ranking (`src/tour/place-quality.ts`); Explore's `/landmarks/nearest` still can return one.
- **Wikipedia is capped at the 20 nearest pages** (`exlimit`). Phase 5 works around it for driving by centring the search ~400 m ahead. A wider geosearch (extracts only for the top-ranked) is still an option if driving finds too few places.
- **Phase 3 to-dos from Phase 2:** done (caches close on shutdown; narration looks the landmark up with `getById`).
- **Phase 3 prompt review (2026-10-31, Lead):** prompt v2 (sentence-count target, use the material fully, end early instead of padding, years as digits, rulers' numbers as words). `cleanNarration` strips AD/CE next to years. Measured on six Istanbul places: medium walking went from 64% to 80–100% of target with flash-lite; `google/gemini-2.5-flash` hits the target more reliably and keeps more detail. The human chose to keep flash-lite (cheapest); switching is one line in `.env`. The Lead edited backend-owned `server/src/narration/prompt.ts` and `clean-text.ts` and their tests, since the review needed live iteration.
- **"Long" narrations run short (55–70%)** because only the Wikipedia intro is sent. Fix later (Phase 5 or 7): send more of the article for the top-ranked landmark.
- **Wikipedia pages without coordinates (e.g. Galata Tower) can't be narrated by id.** `getById` returns null. Revisit if OSM-matched landmarks need it.
- **ElevenLabs free plan can't use Voice Library voices over the API** (HTTP 402). Using the premade voice George (`JBFqnCBsd6RMkjVDRZzb`). Library voices need a paid plan.
- **Lead edited outside its paths in Phase 2** (`server/src/index.ts` wiring, a one-character fix in `server/src/landmarks/merge.ts`, a one-line typed-href fix in `src/app/settings.tsx`), all small and noted here.
- **Expo Go can't open the project** (phone has SDK 58 Expo Go, project is SDK 57). Use the dev build.
- **Maps key:** EAS env var `GOOGLE_MAPS_ANDROID_API_KEY` (development environment, Sensitive), loaded since build `737ab19b`. A phone still running the old build crashes with "API key not found": uninstall it and install the new build.
- **Phase 5 notes for later:**
  - Needs a real phone: whether GPS headings are good enough for left/right at walking speed; the short gap between the cue and the story audio; the visited list surviving restarts.
  - Phase 6: the Live Tour stops when the screen is left or locked; background tracking and the notification controls come next. No lower location accuracy at steady driving speed yet.
  - The backend edited qa-owned `server/src/__fixtures__/test-app.ts` (added the `cues` dependency) so the test app compiles.
  - Route data in `src/dev/routes/` ships in release bundles (small, harmless).
  - After a failed pre-fetch, later fixes before the next check can pre-fetch the next-best place, one at a time, so a failing server sees one failed request per candidate until then. Cost-neutral; tighten if it shows up in logs.
  - Not unit-tested (device-only): the expo-location and permission adapters, and the tour/settings screens (no React Native testing library).
- **Phase 4 notes for later:**
  - Phase 6: the device voice keeps talking in the background while audio files pause (`shouldPlayInBackground: false`), and expo-speech doesn't duck other audio. Align both when background audio is turned on.
  - A tap replaced by a newer one doesn't cancel its in-flight requests; the server still writes (and caches) that story. Optional: pass an abort signal through `apiClient`.
  - The sentence splitter treats "St.", "No.", "c." and initials as abbreviations, so a sentence really ending in one isn't split there (only makes a chunk longer).
  - Not covered by unit tests (device-only): the expo-audio / expo-speech adapters, the hooks, and map rendering.
- **Fonts and app on a device not seen yet.** iOS PostScript font names in `typography.ts` are unverified; iOS is out of scope for now.
- **App icons and splash** are still Expo's template art; replace them before Phase 8.
- **Custom subagent types aren't registered in this session.** The `.claude/agents/*` files exist, but the Lead ran each role as a general-purpose agent that loads its role file. A fresh Claude Code session should pick them up.
- **The Expo MCP local tools** (screenshots, logs) need `expo-mcp` and `EXPO_UNSTABLE_MCP_SERVER=1`. Set them up once a dev build runs.
- **The repo is on GitHub** at `BiboEng/Wayfarer` (private until the Phase 8 secret scan).
  - The first CI run failed: the server tests read the root tsconfig through `shared/`, and it extends Expo settings that the server-only job doesn't install.
  - Fixed with a standalone `shared/tsconfig.json`.
  - Lesson: local runs can hide this because all `node_modules` exist. Test the server job from a fresh clone with only `server/` installed.
- The Windows user folder (one level above the project) is itself an empty git repo. The human decides whether to delete it.

## Setup I've done
- 2026-10-07: Expo account created. Expo plugin installed and Expo MCP server connected in Claude Code.
- 2026-10-27: EAS project `@biboeng/wayfarer` linked (projectId and `owner` in `app.config.ts`). EAS generated the Android keystore in the cloud. First development build installed on the phone; phone ↔ laptop over Wi-Fi works (`.env.local` points at the laptop's LAN IP).
- Dev machine: Windows 11, Node 24.22.1 (upgraded from 20 before Phase 2), git 2.55. No Java or Android SDK (not needed with EAS Build).
- *To do (see `docs/SETUP.md`):*
  - Google Maps key from the keystore SHA-1 → EAS env var `GOOGLE_MAPS_ANDROID_API_KEY`, then rebuild
  - OpenRouter, ElevenLabs and Railway accounts before Phase 3

## Next phase
Phase 6: background location + background audio (`docs/BRIEF.md` Part D), when the human gives the go-ahead. Deploy the server first (postponed to the start of Phase 6). Needs one dev build rebuild for the new permissions.
