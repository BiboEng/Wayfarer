# Wayfarer — Progress

## Current status
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
- **Not yet verified on a phone:** this needs the human's first dev build (`docs/SETUP.md`).

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
- **Node 24 LTS target.** CI and server `engines` use 24. Local Node is still 20.20.2 until the human upgrades.
- **Test runners:** Jest (`jest-expo`) for the app and `shared/`; Vitest + supertest for the server. Reason: Expo's documented preset for the app; Vitest handles ESM and TypeScript in the server without extra config.
- **App API calls never throw.** `ApiResult` returns `{ ok, data | error }`, so the Live Tour can skip failures quietly.
- **The server loads `.env` with `process.loadEnvFile`** (guarded), not a CLI flag. It works on Node 20 and 24 with no "file not found" noise.
- **Removed unused template packages** (`expo-glass-effect`, `expo-symbols`, `expo-web-browser`, `expo-device`). `@expo/ui` is kept for the native pickers and switches in Settings.

## Open issues
- **Node 20 → 24.** Waiting on the human (SETUP §1). Nothing has run on Node 24 yet; CI will be the first.
- **Fonts and app on a device not seen yet.** iOS PostScript font names in `typography.ts` are unverified; iOS is out of scope for now.
- **App icons and splash** are still Expo's template art; replace them before Phase 8.
- **Custom subagent types aren't registered in this session.** The `.claude/agents/*` files exist, but the Lead ran each role as a general-purpose agent that loads its role file. A fresh Claude Code session should pick them up.
- **The Expo MCP local tools** (screenshots, logs) need `expo-mcp` and `EXPO_UNSTABLE_MCP_SERVER=1`. Set them up once a dev build runs.
- **No GitHub remote yet**, so CI hasn't run. It runs on the first push.
- `C:\Users\bibo2` is itself an empty git repo. The human decides whether to delete it.

## Setup I've done
- 2026-10-07: Expo account created. Expo plugin installed and Expo MCP server connected in Claude Code.
- Dev machine: Windows 11, Node 20.20.2, git 2.55. No Java or Android SDK (not needed with EAS Build).
- *To do (see `docs/SETUP.md`):*
  - Node 24
  - `eas init` (paste the projectId into `app.config.ts`)
  - EAS keystore → SHA-1 → Google Maps key → EAS env var `GOOGLE_MAPS_ANDROID_API_KEY`
  - the first dev build
  - phone ↔ laptop check
  - OpenRouter, ElevenLabs and Railway accounts before Phase 3

## Next phase
Phase 2: landmark discovery (`docs/BRIEF.md` Part D). It starts in plan mode after the go-ahead. The Lead first finalizes `Landmark` and `LandmarkProvider` in `shared/`.
