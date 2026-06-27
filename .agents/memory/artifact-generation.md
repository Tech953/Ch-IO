---
name: artifact generation subsystem
description: How engram artifact generation mirrors media perception, what the autonomous path may do, and why there is deliberately no world-model "generated" write path.
---

# Artifact generation (the GENERATION mirror of media perception)

Generation is a SEPARATE subsystem from media perception. It shares the *job-lifecycle
architecture* (async worker, atomic `FOR UPDATE SKIP LOCKED` claim, stuck-job recovery,
1:1 metadata/blob split) and the *provenance-pinning discipline*, NOT a write path.

## Autonomous vs operator
- Operator "create now" may request any kind (pdf/image/video).
- The autonomous engine path is **PDF-ONLY**: the scheduler hardcodes `kind:"pdf"`,
  `trigger:"autonomous"`. It provably cannot reach the dedicated **paid** image/video
  provider seam (`generation-client.ts`), so autonomy never incurs the image/video cost.
- **Why PDF still calls the LLM is fine:** PDF *authoring* goes through the text-LLM seam
  (`lib/llm.ts`) — the SAME seam every other autonomous behavior already uses (transmissions,
  simulation premise/step/exit). "Always local" means rendering is local + the LLM is
  local-capable via `LLM_BASE_URL`, exactly like the rest of the app. The spec's cost concern
  is scoped to image/video, not PDF. Do NOT cripple PDF to a no-LLM "deterministic" doc — that
  would make it inconsistent with the simulation mirror.

## Policy gates (in `engram-policy.ts`)
- `canGenerateArtifacts` is **NARROWER than `canSimulate`**: `full_bounded` mode ONLY (NOT
  `simulation` mode), AND a generate-scoped `studio` space (`actionScope:"generate"`), AND
  per-engram `artifactGenerationEnabled` (defaults true). Fails closed under global pause /
  resting space / quiescent / unknown mode. Block reasons: `…does not permit artifact
  generation` / `…not in a studio space` / `artifact generation disabled for this engram`.
- `canMirrorHumanContactToChat` = humanContact permitted at the **social** bar
  (`minHumanPriority==='social'`). The engine `emit()` outreach uses it to target
  `chatConversation` vs `busOnly`; quiet mode and `initiative_limited` (urgent-only bar) stay
  off chat and only hit the audit bus.

## The world-model "generated" provenance is DELIBERATELY not implemented
- `WORLD_MODEL_PROVENANCES` does NOT include `"generated"`, and there is NO artifact→world-model
  write path. `artifact-worker` completes blob+metadata only.
- **Why:** the user invariant is *conditional* — "**IF** a generated artifact **ever** writes a
  world-model entry, provenance is HARDCODED 'generated', source 'artifact:<id>'." Acceptance
  required generating+downloading files and autonomous-within-caps, NOT world-model entries.
  Generation's deliverable is a FILE; perception's deliverable IS world-model OBSERVED entries —
  the asymmetry is inherent. The guard holds vacuously and safely: no write path ⇒ nothing can
  choose provenance.
- **How to apply:** if a future task adds artifact→world-model feedback, THAT task adds
  `"generated"` to `WORLD_MODEL_PROVENANCES` (+ `db push` + a generated migration + codegen) and
  a single hardcoded append helper (mirror of `appendMediaObservation`/`appendSimulationStep`)
  that pins `provenance:"generated"` + `source:"artifact:<id>"`. Never let model output choose it.
  An architect review may flag the missing path as an incomplete "mirror" — that is a maximalist
  reading; the authoritative spec made it conditional.
