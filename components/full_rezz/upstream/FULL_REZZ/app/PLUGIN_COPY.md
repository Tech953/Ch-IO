# FULL_REZZ 3D + audio chat renderer — plug-in copy

Copied 2026-11-25 from `Tech953/Black_Sakura_Project` main @ `d4481817`
into `Tech953/Ch-IO` on branch `plugin/full-rezz-render`, for separate
plug-in development in the frozen Ch-IO repo.

## What this is

The 3D + audio chat renderer plug-in from the FULL_REZZ 3.0 source core
(import commit `8aefff25`, 2026-11-08; source archive
`FULL_REZZ_3.0_Replit_Source_Core.zip`, 91.8 MB):

- `full_rezz_render/` — 3D scene renderer (geometry, rig, scene, layout, pipeline, timing, render, audit)
- `f5_tts/` — F5-TTS speech synthesis model code
- `vocos/` — Vocos neural vocoder code
- `voice_studio/` — voice studio app (synthesis, engine, worker, server, desktop)
- `full_rezz_bridge/` — render verification bridge (schema 1.0.0)
- `full_rezz_companion/` — companion module (imported by voice_studio; imports voice_studio back)

79 files total, all text. The six directories are self-contained as code;
runtime dependencies (PySide6, torch, transformers, speechbrain,
faster_whisper, av, etc.) come from the FULL_REZZ `requirements.txt`, not
from this copy.

## What is NOT in this copy

- Model weights (external archives only)
- The Rebecca reference WAV — local-only, never distributed
- The FULL_REZZ soul/seed (immutable; lives on Black_Sakura_Project main under `components/full_rezz/`)
- The rest of the FULL_REZZ component (archives, delivery, guides, recovery, reference-packs)

## Drift rule

`Black_Sakura_Project` stays the integration copy. This branch is the dev
sandbox. Changes that work here port back by review — never by silent
overwrite. Licenses: F5-TTS CC-BY-NC-4.0, Vocos/Whisper MIT; personal,
noncommercial use only.
