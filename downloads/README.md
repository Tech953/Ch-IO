# Bundled downloads

Drop a built Android **`.apk`** in this folder to have the deployed app serve it
directly (same-origin) from the **Download** page (`/download`) and the API:

- `GET /api/download/android` — JSON metadata (`available`, `source`, `version`, `filename`, `sizeBytes`)
- `GET /api/download/android.apk` — the file itself

## How serving works ("do both")

The API server (`artifacts/api-server/src/routes/download.ts`) resolves the APK
in this order:

1. **Bundled** — `ANDROID_APK_PATH` (a single file) if set, otherwise the
   newest `*.apk` in this directory (overridable with `ANDROID_APK_DIR`).
2. **GitHub fallback** — if no bundled file exists, it fetches the latest
   release of `ANDROID_APK_GITHUB_REPO` (default `pyri-ai/engram`) and
   proxy-streams its `.apk` asset, so the download still stays on this app's
   origin.

If neither is available, the Download page hides the Android card.

## Shipping a bundled APK to your deploy

The Replit deployment builds from the **committed git state**, so to bundle an
APK you must **commit the `.apk` file here** (it is not gitignored). Note an APK
is typically 30–100 MB, which permanently increases repo size — if you prefer
not to commit a large binary, just rely on the GitHub release fallback above
(no commit needed).

## Building the .apk

You cannot build an Android APK inside Replit (no Android SDK). See
[`docs/building-the-android-apk.md`](../docs/building-the-android-apk.md) for the
two supported paths (let CI build it, or build locally).
