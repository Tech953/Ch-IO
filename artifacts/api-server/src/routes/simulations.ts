import { Router } from "express";
import type { EngramSimulation, EngramSimulationStep, SimulationStatus } from "@workspace/db";
import {
  ListSimulationsQueryParams,
  ListSimulationStepsParams,
  ControlSimulationParams,
  ControlSimulationBody,
} from "@workspace/api-zod";
import {
  loadSimulations,
  loadSimulationById,
  loadSimulationSteps,
} from "../lib/simulations-store";
import { applySimulationControl, SimulationTransitionError } from "../lib/simulations";

const router = Router();

function serializeSimulation(s: EngramSimulation) {
  return {
    id: s.id,
    engramId: s.engramId,
    spaceId: s.spaceId,
    premise: s.premise,
    status: s.status,
    currentStep: s.currentStep,
    maxSteps: s.maxSteps,
    stepCooldownSeconds: s.stepCooldownSeconds,
    lastSteppedAt: s.lastSteppedAt ? s.lastSteppedAt.toISOString() : null,
    exitSummary: s.exitSummary ?? null,
    startedAt: s.startedAt ? s.startedAt.toISOString() : null,
    pausedAt: s.pausedAt ? s.pausedAt.toISOString() : null,
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function serializeStep(s: EngramSimulationStep) {
  return {
    id: s.id,
    simulationId: s.simulationId,
    stepNumber: s.stepNumber,
    narrative: s.narrative,
    worldModelEntryId: s.worldModelEntryId ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/simulations", async (req, res) => {
  const parsed = ListSimulationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await loadSimulations({
    engramId: parsed.data.engramId,
    status: parsed.data.status as SimulationStatus | undefined,
  });
  res.json(rows.map(serializeSimulation));
});

router.get("/simulations/:id/steps", async (req, res) => {
  const parsed = ListSimulationStepsParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const sim = await loadSimulationById(parsed.data.id);
  if (!sim) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }
  const steps = await loadSimulationSteps(sim.id);
  res.json(steps.map(serializeStep));
});

router.post("/simulations/:id/control", async (req, res) => {
  const parsedParams = ControlSimulationParams.safeParse({ id: req.params.id });
  const parsedBody = ControlSimulationBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const sim = await loadSimulationById(parsedParams.data.id);
  if (!sim) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }
  try {
    const updated = await applySimulationControl(sim, parsedBody.data.action);
    res.json(serializeSimulation(updated));
  } catch (err) {
    if (err instanceof SimulationTransitionError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error(err);
    res.status(503).json({ error: "Simulation control failed" });
  }
});

export default router;
