---
name: Simulation quarantine guarantee
description: How simulated engram state is structurally prevented from becoming observed reality.
---

Engram simulations (`engram_simulations` + `engram_simulation_steps`) must never bleed into observed reality. The guarantee is structural, not convention:

- The ONLY world-model write on the simulation path is `appendSimulationStep` (in `lib/simulations-store.ts`), which hardcodes `provenance: "simulated"`.
- No route or engine code path patches a world-model entry's provenance, and there is no "promote to observed" endpoint.
- Gating is in the pure policy `canSimulate` (engram-policy.ts): requires a `simulation_chamber` space with `actionScope === "simulate"`, mode ∈ {simulation, full_bounded}, per-engram `simulationEnabled`, space allows initiative, not globally paused; quiescent/unknown fail closed.

**Why:** the product's hard rule is that simulated state stays clearly distinguished from observed/shared reality; relying on prompt instructions or UI labels alone would be a convention, not a guarantee.

**How to apply:** if you add any new write from simulation logic, route it through `appendSimulationStep` (or otherwise keep `provenance: "simulated"`); never add a path that rewrites provenance or copies simulated rows into observed ones. The `/simulations` UI marks everything SIMULATED, but that is presentation only — the enforcement is the hardcoded provenance.
