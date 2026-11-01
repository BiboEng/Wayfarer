@AGENTS.md

# Wayfarer — project rules

Android-first Expo app (SDK 57, Expo Router) with a Node + Express server in `server/`.
Spec: `docs/BRIEF.md` — never edit it without the human's approval. Status log: `docs/PROGRESS.md`.

**At the start of each phase, read `docs/PROGRESS.md` and the current phase in `docs/BRIEF.md` (Part D).**

## Conventions
- TypeScript everywhere, `strict` on. No `any` without a comment saying why.
- Small, focused files: one job per file. Split anything that turns into a grab-bag.
- Pure logic (geo math, ranking, queue rules, cache keys, cost caps) lives in plain TS modules with no React/Expo imports, so it can be unit-tested.
- Folders: routes only in `src/app/`; other app code in `src/<area>/`; server code in `server/src/`; the API contract in `shared/`.
- `shared/` is dependency-free TypeScript (types, interfaces, error codes, constants), imported by both app (`@shared/...`) and server. Only the Lead changes it — if you need a change, stop and report it.
- Add app packages with `npx expo install <pkg>`; server packages with `npm install` inside `server/`. List every added package in your summary.
- Import the contract as `@shared/...` in both app and server. The server resolves it with `tsx` in dev and bundles it with `tsup` for production (no runtime `../shared` imports).
- Config lives in `app.config.ts` only (there is no `app.json`); `npx expo install` can't auto-edit it, so add plugin entries by hand.
- `npm run check` at the root runs typecheck, lint, and tests for the app and `server/`. CI runs the same on every push.
- Check the SDK 57 docs before using any Expo / React Native API (Expo MCP `read_documentation`, or `https://docs.expo.dev/versions/v57.0.0/`). Don't code from memory.
- Live Tour must be hands-free: no popups or prompts that need a tap while moving; failures skip quietly.

## Secrets — no exceptions
- The repo is public. Nothing secret in the repo, git history, app bundle, or logs.
- Server secrets live only in `server/.env` (git-ignored); `server/.env.example` holds placeholders.
- The only key the app carries is the Google Maps Android key, injected through `app.config.ts` from an env var (EAS environment variables for builds) — never written into `app.json`.
- Anything in `EXPO_PUBLIC_*` ships inside the app bundle: treat it as public.
- Never print real keys in logs, test output, or chat.

## File ownership
| Owner | Paths |
|---|---|
| Lead | `shared/`, `src/api/`, `src/config/`, `src/explore/`, `docs/`, `.github/`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, root config (`package.json` scripts, `app.json` / `app.config.ts`, `eas.json`, `tsconfig.json`, lint config, `.gitignore`) |
| mobile-ui | `src/app/`, `src/components/`, `src/theme/`, `src/hooks/`, `assets/` |
| tour-engine | `src/tour/`, `src/location/`, `src/audio/`, `src/dev/` |
| landmark-data | `server/src/landmarks/` |
| backend | everything else in `server/` |
| qa | `**/__tests__/`, `**/__fixtures__/`, test config |
| reviewer | nothing — read-only |

Edit only your own paths. If something outside them must change, say so in your summary for the Lead.

## Definition of done (every task)
1. `npx tsc --noEmit` passes in the app and in `server/`.
2. Pure logic has unit tests, and they pass.
3. Lint passes.
4. No file has become a grab-bag; split files that do more than one thing.
5. The owning agent writes a 3–5 line summary: what changed, packages added, anything the Lead needs to know.
