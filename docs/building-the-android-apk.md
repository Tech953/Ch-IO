# Building the ENGRAM Android `.apk`

This guide explains how to produce the installable Android package (`.apk`) for
the ENGRAM mobile app (`@workspace/engram-mobile`, an Expo / React Native app),
and how to make it downloadable from the deployed web app.

> **Why you can't build it on Replit / inside Deploy**
> An Android build needs the Android SDK, a JDK, and Gradle (plus, for a release
> build, hundreds of MB of tooling). The Replit deploy environment has none of
> these, and a Gradle build is far too heavy for the deploy step. So the `.apk`
> is always built **elsewhere** (CI or your own machine) and then served by the
> deployed app — see [Make it downloadable](#make-it-downloadable-through-deploy).

---

## Option A — Let CI build it (recommended, no local setup)

The repo already builds the APK in GitHub Actions:
`.github/workflows/desktop-build.yml` (the **`android`** job).

1. Bump the version and push a tag:
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```
2. CI runs `expo prebuild` + Gradle `assembleRelease`, then attaches
   `ENGRAM-Mobile-<version>.apk` to the **same GitHub Release** as the desktop
   installers.
3. The deployed app's Download page picks it up automatically through the GitHub
   fallback (no further action needed).

**Signing note:** with no release keystore configured, CI produces a
**debug-signed** APK. It installs fine via sideload, but updating in place over
an older debug-signed build may require uninstalling first. To get update-safe
signing, add a release keystore via CI secrets.

---

## Option B — Build it locally

### Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 24.x | Matches the repo's `nodejs-24` module |
| pnpm | 9+ | Workspace package manager |
| JDK | 17 | Required by the Android Gradle Plugin |
| Android SDK | Platform 34 + build-tools | Easiest via **Android Studio** |
| Android NDK | As pinned by Expo | Installed via the SDK Manager |

Set the standard Android env vars so Gradle can find the SDK:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"   # or your SDK path
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

### Steps

From the repo root:

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Generate the native Android project from the Expo config.
#    --clean ensures a fresh android/ folder; --no-install skips a redundant
#    dependency install we already did above.
pnpm --filter @workspace/engram-mobile exec expo prebuild \
  --platform android --no-install --clean

# 3. Build the release APK with Gradle
cd artifacts/engram-mobile/android
./gradlew :app:assembleRelease
```

The signed (debug key by default) APK lands at:

```
artifacts/engram-mobile/android/app/build/outputs/apk/release/app-release.apk
```

### Install it on a device

- **Via USB (adb):**
  ```bash
  adb install -r app-release.apk
  ```
- **Via sideload:** copy the `.apk` to the phone and open it; enable
  "Install unknown apps" for your file manager/browser when prompted
  (Android 8+).

### Versioning

`app.json` carries `expo.version` (the user-visible version, e.g. `1.2.3`) and
`android.versionCode` (an integer that **must increase** for every release the
Play Store / in-place update accepts). In CI these are stamped from the git tag
and the run number; for local builds, bump them by hand in `app.json` before
prebuilding if you want an update-safe sequence.

### Release signing (optional, for update-safe installs)

A debug-signed APK is fine for testing but its signature changes per machine.
For a stable signature:

1. Generate a keystore:
   ```bash
   keytool -genkeypair -v -keystore engram-release.keystore \
     -alias engram -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Configure Gradle signing (`android/app/build.gradle` `signingConfigs`, or via
   `~/.gradle/gradle.properties`), then rebuild with `assembleRelease`.

Keep the keystore safe — losing it means you can no longer ship updates that
install over existing copies.

---

## Make it downloadable through Deploy

The deployed app serves the APK **same-origin** so visitors download it straight
from your site (no GitHub redirect). It resolves the file in two stages — "do
both":

1. **Bundled** — if you committed a `.apk` into the [`downloads/`](../downloads)
   directory (or pointed `ANDROID_APK_PATH` at one), that file is served.
2. **GitHub fallback** — otherwise the latest release of
   `ANDROID_APK_GITHUB_REPO` (default `Tech953/Ch-IO`) is fetched and
   proxy-streamed.

Endpoints (API server, `artifacts/api-server/src/routes/download.ts`):

- `GET /api/download/android` — JSON: `{ available, source, version, filename, sizeBytes }`
- `GET /api/download/android.apk` — the binary download

### To bundle your own APK

1. Build it (Option A or B above).
2. Copy it into `downloads/` and **commit it** (the deploy builds from the
   committed git state):
   ```bash
   cp app-release.apk downloads/ENGRAM-Mobile-1.2.3.apk
   git add downloads/ENGRAM-Mobile-1.2.3.apk
   git commit -m "Bundle Android v1.2.3 for download"
   ```
3. Re-deploy. The Download page now serves your bundled APK.

> An APK is large (30–100 MB). Committing it permanently grows the repo. If you
> would rather not commit a binary, skip bundling and rely on the GitHub release
> fallback (Option A).

### Relevant environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANDROID_APK_PATH` | _(unset)_ | Absolute path to a single bundled `.apk` |
| `ANDROID_APK_DIR` | `<repo>/downloads` | Directory scanned for the newest `*.apk` |
| `ANDROID_APK_GITHUB_REPO` | `Tech953/Ch-IO` | `owner/repo` for the GitHub fallback |
| `VITE_GITHUB_REPO` | `Tech953/Ch-IO` | Web build-time repo for the **desktop** release feed |
