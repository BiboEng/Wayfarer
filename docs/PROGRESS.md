# Wayfarer — Progress

## Current status
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
- **Subagent models:** sonnet for mobile-ui, landmark-data, backend and qa; the session model for tour-engine and reviewer. (Approved.)
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
- **Wikipedia returns geotagged events** (e.g. "740 Constantinople earthquake") as landmarks. Phase 5 ranking must push down results with no OSM match / non-place articles.
- **Wikipedia is capped at the 20 nearest pages** (`exlimit`). Fine for walking and Explore; for 1–2 km driving radii, revisit in Phase 5 (wider geosearch, extracts only for the top-ranked).
- **Phase 3 to-dos from Phase 2:** call `CacheStore.close()` on shutdown; the narration endpoint must use `getById` and never trust text from the app.
- **Lead edited outside its paths in Phase 2** (`server/src/index.ts` wiring, a one-character fix in `server/src/landmarks/merge.ts`, a one-line typed-href fix in `src/app/settings.tsx`), all small and noted here.
- **Expo Go can't open the project** (phone has SDK 58 Expo Go, project is SDK 57). Use the dev build.
- **First dev build has no Google Maps key**, so maps are blank. Do SETUP §3 (the keystore SHA-1 is on expo.dev → Credentials) and rebuild before Phase 4.
- **Fonts and app on a device not seen yet.** iOS PostScript font names in `typography.ts` are unverified; iOS is out of scope for now.
- **App icons and splash** are still Expo's template art; replace them before Phase 8.
- **Custom subagent types aren't registered in this session.** The `.claude/agents/*` files exist, but the Lead ran each role as a general-purpose agent that loads its role file. A fresh Claude Code session should pick them up.
- **The Expo MCP local tools** (screenshots, logs) need `expo-mcp` and `EXPO_UNSTABLE_MCP_SERVER=1`. Set them up once a dev build runs.
- **The repo is on GitHub** at `BiboEng/Wayfarer` (private until the Phase 8 secret scan).
  - The first CI run failed: the server tests read the root tsconfig through `shared/`, and it extends Expo settings that the server-only job doesn't install.
  - Fixed with a standalone `shared/tsconfig.json`.
  - Lesson: local runs can hide this because all `node_modules` exist. Test the server job from a fresh clone with only `server/` installed.
- `C:\Users\bibo2` is itself an empty git repo. The human decides whether to delete it.

## Setup I've done
- 2026-10-07: Expo account created. Expo plugin installed and Expo MCP server connected in Claude Code.
- 2026-10-27: EAS project `@biboeng/wayfarer` linked (projectId and `owner` in `app.config.ts`). EAS generated the Android keystore in the cloud. First development build installed on the phone; phone ↔ laptop over Wi-Fi works (`.env.local` points at the laptop's LAN IP).
- Dev machine: Windows 11, Node 24.22.1 (upgraded from 20 before Phase 2), git 2.55. No Java or Android SDK (not needed with EAS Build).
- *To do (see `docs/SETUP.md`):*
  - Google Maps key from the keystore SHA-1 → EAS env var `GOOGLE_MAPS_ANDROID_API_KEY`, then rebuild
  - OpenRouter, ElevenLabs and Railway accounts before Phase 3

## Next phase
Phase 3: narration pipeline + deployment (`docs/BRIEF.md` Part D), after the human hand-tests Phase 2 and it is committed. Needs OpenRouter, ElevenLabs and Railway accounts.
