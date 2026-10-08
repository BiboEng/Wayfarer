# Wayfarer — your setup steps

Things only you can do: accounts, keys, the phone build. Do them in order. Never paste a real key into chat, an issue, a commit, or a file that isn't git-ignored
---

## 0. Three Expo ideas in plain language

- **Development build ("dev build")**: your own debug version of the app, installed on your phone like a normal app. Expo Go (the app from the Play Store) can't do background location or our map key, so we build our own. You rebuild it only when *native* code changes (new native library, permissions, app config). Ordinary code changes reload instantly over Wi-Fi from your laptop.
- **Config plugin**: a small script that edits the Android project for us at build time (permissions, the Maps key, fonts). We list plugins in `app.config.ts` instead of editing Android files by hand. The `android/` folder is generated and never committed.
- **EAS environment variables vs `EXPO_PUBLIC_*`**: EAS env vars live on Expo's servers and are fed to cloud builds. We use one for the Google Maps key. Anything named `EXPO_PUBLIC_*` gets baked into the app bundle, so anyone with the APK can read it. Only non-secret values go there (the server URL and the app token, which is a speed bump, not a password).

---

## 1. Upgrade Node to 24 LTS

1. Download the Windows installer (LTS, v24) from https://nodejs.org and run it.
2. Open a **new** terminal: `node -v` should print `v24.x`.
3. In the project folder, run `npm ci` and then `cd server` + `npm ci`. That reinstalls everything under Node 24.

## 2. Expo / EAS (needed for the first build)

1. Log in (you already have an Expo account): `npx eas-cli@latest login`
2. Link the project: `npx eas-cli@latest init`.
   - Because our config is `app.config.ts` (code, not JSON), EAS can't write into it. It prints a **project ID**.
   - Send it to me, or paste it yourself into `app.config.ts` where the comment says `extra: { eas: { projectId } }`. The project ID isn't secret.

## 3. Google Maps key (Maps SDK for Android)

A Maps key can't be hidden inside an app, so Google protects it with **restrictions**: it only works for an app with our package name *and* our signing certificate.

1. **Get the signing fingerprint (SHA-1) first.**
   - Run `npx eas-cli@latest credentials`, then choose **Android** and the **development** build profile.
   - Let it **generate a new keystore**. EAS stores it for you.
   - Copy the **SHA-1 fingerprint** it shows. It's also on expo.dev → your project → *Credentials*.
2. **Create the Google project and enable the API.**
   - Go to https://console.cloud.google.com and create a project ("Wayfarer").
   - Google requires a billing account for Maps. Showing maps with the Android SDK is free; still set a **budget alert** (Billing → Budgets) of a few dollars.
   - Open *APIs & Services → Library* and enable **Maps SDK for Android**.
3. **Create the key.** In *APIs & Services → Credentials*, choose **Create credentials → API key**, then **Edit**:
   - **Application restrictions**: *Android apps*, then **Add**: package `com.biboeng.wayfarer` plus the SHA-1 from step 1.
   - **API restrictions**: *Restrict key*, with only **Maps SDK for Android**.
   - Save.
4. **Give it to EAS (not to the repo).**
   - On expo.dev, open your project → *Environment variables* → **Add**.
   - Name: `GOOGLE_MAPS_ANDROID_API_KEY`. Value: the key. Environments: **development** (add preview/production later). Visibility: **Sensitive**.
   - Use the website rather than the CLI so the key doesn't end up in your shell history.

## 4. First dev build and install

1. Run `npx eas-cli@latest build --profile development --platform android`.
   - It builds in the cloud (about 10–20 min) and prints a link and a QR code.
2. Open the link on your phone and install the APK. Android will ask you to allow installs from your browser; allow it for this install.
3. If you see "file locked" (EPERM/EBUSY) errors before the upload, pause OneDrive sync and run it again.

## 5. Run it: phone ↔ laptop on the same Wi-Fi

1. **Server.**
   - In `server/`, copy `.env.example` to `.env` and set `APP_TOKEN` to a long random string (32+ characters).
   - Run `npm run dev`.
   - When Windows Firewall asks, allow Node on **Private networks**.
2. **Your laptop's LAN IP.** Run `ipconfig` and look for the *IPv4 Address* of your Wi-Fi adapter, e.g. `192.168.1.23`.
3. **App env.** In the project root, copy `.env.example` to `.env.local` (git-ignored) and set:
   - `EXPO_PUBLIC_API_URL=http://<that IP>:3000`
   - `EXPO_PUBLIC_APP_TOKEN=` the same value as `APP_TOKEN` in `server/.env`
4. **Start Metro and open the app.** Run `npx expo start`, then open the Wayfarer dev build on your phone and pick the server it shows (or scan the QR code).
5. **Check.** Settings should show **Server: ok**. If it says unreachable:
   - Check that both devices are on the same Wi-Fi (not a guest network).
   - Check the firewall prompt.
   - Check the IP.
6. **Still unreachable?** Some routers isolate devices, and Android can block plain `http://`. Use a free HTTPS tunnel instead:
   - Run `npx cloudflared tunnel --url http://localhost:3000` (or ngrok).
   - Put the `https://…` URL it prints into `EXPO_PUBLIC_API_URL`.
   - Restart `npx expo start`.

> If the build keystore ever changes (new EAS credentials, or a production keystore later), add its SHA-1 to the Maps key's Android restriction too. Otherwise the map goes blank.

## 6. Accounts for later phases (create now or when asked)

- **OpenRouter** (AI narration, needed in Phase 3).
  1. Sign up at https://openrouter.ai.
  2. Add a small prepaid credit (e.g. $5). Prepaid means it can't overspend.
  3. Create an API key, ideally with a credit limit on the key.
  4. It goes only into `server/.env` as `OPENROUTER_API_KEY`, and later into Railway's variables.
- **ElevenLabs** (premium voice, Phase 3).
  1. Sign up at https://elevenlabs.io and start on the free plan, which has a monthly character quota.
  2. Create an API key restricted to *Text to Speech*.
  3. It goes only into `server/.env` as `ELEVENLABS_API_KEY`.
- **Railway** (hosting, Phase 3). Sign up at https://railway.com with GitHub. I'll walk you through the deploy then.

**Golden rule:** keys live in `server/.env` (git-ignored), in Railway's variables, or in EAS env vars. Nowhere else.
