# Wayfarer

An Android app that acts as a personal tour guide. Put on headphones and start a tour: as you walk or drive, Wayfarer finds notable landmarks nearby and narrates their history. You can also tap anywhere on a world map to hear about the nearest landmark there.

**Status:** early development (Phase 1, project setup). The full README, with screenshots, an architecture overview and cost notes, comes at the end of the project.

## Layout
- `src/`: the Expo (React Native) app; routes are in `src/app/`
- `server/`: Node + Express backend that holds all API keys and proxies AI and TTS calls
- `shared/`: the API contract (types and constants) used by both
- `docs/`: the spec, progress log, and [setup guide](docs/SETUP.md)

## Develop
See [docs/SETUP.md](docs/SETUP.md) for accounts, keys, and the Android dev build. Then:

```bash
npm ci && npm --prefix server ci
npm --prefix server run dev   # server on :3000
npx expo start                # app, opened in the Wayfarer dev build
npm run check                 # typecheck + lint + tests for app and server
```

## A note on security
The app sends a shared token header that the server checks. That token ships inside the app, so it is **a speed bump against casual abuse, not real authentication**. The real protections are per-IP rate limiting, daily cost caps, and keeping every paid API key on the server.
