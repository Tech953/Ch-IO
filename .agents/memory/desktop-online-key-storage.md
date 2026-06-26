---
name: Desktop online API key storage (no plaintext)
description: Security rule for how the Electron desktop build persists the cloud/online LLM API key.
---

# Desktop online API key storage

The desktop app's online (cloud) mode API key is **never written to disk in plaintext**.

- When the OS keychain is available (`safeStorage.isEncryptionAvailable()`), encrypt with
  Electron `safeStorage` and persist the ciphertext only; decrypt in-process to pass as
  `LLM_API_KEY` to the spawned server.
- When no keychain is available, hold the key in memory for the current session only
  (a module-level variable, not the persisted settings shape) and require re-entry next launch.

**Why:** task + user-facing docs promise safeStorage-backed key handling; an earlier
plaintext fallback (`apiKeyPlain` in settings.json) was flagged as a security blocker.
Persisting cloud credentials in cleartext on disk is unacceptable even as a convenience fallback.

**How to apply:** never add a disk-persisted plaintext path for any credential in the desktop
app, even behind an "encryption unavailable" branch. Session-only in-memory is the correct
degraded mode. Keep the settings UI honest about which mode is active.
