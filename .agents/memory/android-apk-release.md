---
name: Android APK CI release
description: How the ENGRAM Android .apk is built in CI without an Expo account and attached to electron-builder's draft GitHub release, plus signing and OS-detection gotchas.
---

# Android APK build + release (ENGRAM)

The Download page no longer calls GitHub from the browser — both desktop installers
and the `.apk` are served **same-origin** by the app's API (`/api/download/*`, pure
logic in `lib/downloads.ts`), which resolves a committed `downloads/` file first and
otherwise proxy-streams the latest GitHub release asset (matched to an OS by file
extension). The Android `.apk` still rides the SAME release as the desktop installers,
built by an `android` job in the desktop CI workflow. The CI mechanics below are
unchanged regardless of how the page fetches.

## Attaching a non-electron-builder asset to electron-builder's draft release
- electron-builder publishes desktop installers to a **draft** release whose
  `tag_name` is set but is **not yet a real git tag**.
- **Why it matters:** `gh release upload <tag> ...` and the `repos/.../releases/tags/<tag>`
  API only resolve **published** releases, so they cannot see/target the draft.
- **How to apply:** resolve the draft by **name** (the tag string) to get its release
  **id** (same jq filter the `publish` un-draft job uses), then upload via
  `https://uploads.github.com/repos/<repo>/releases/<id>/assets?name=<file>` (curl or
  the uploads host — NOT plain `gh api`, which targets api.github.com). Make it
  idempotent by deleting any same-named asset first. Order the job `needs: build`
  (so the draft exists) and make the `publish` job `needs: [build, android]`.

## No-Expo-account, no-secrets APK signing
- `expo prebuild --platform android` + Gradle `:app:assembleRelease` yields an
  **installable** APK because the RN/Expo template's `release` build type falls back to
  the **debug** signing config when no release keystore exists.
- **Why it matters:** a debug/ephemeral signature is **not update-safe** — installing a
  newer build over an older install can require an uninstall first. Fine for sideload
  distribution; add an optional release keystore (via secrets) for seamless in-place
  updates. Never commit a keystore.

## OS/device detection ordering
- An Android browser User-Agent string also contains the substring `linux`.
- **How to apply:** in any UA-based OS detection, check `android` **before** `linux`,
  or Android devices get misclassified as Linux.

## Build env notes
- JDK 17 for RN 0.81 / AGP 8.x. `prebuild --no-install` is correct after a root
  `pnpm install`; invoke the Expo CLI from the mobile package so pnpm autolinking
  resolves. Build shared libs (codegen + `typecheck:libs`) before Gradle so Metro can
  bundle the workspace-lib imports for the release APK. `android/` is gitignored
  (prebuild output) so CI must regenerate it (`--clean`).
