import { Router } from "express";
import { llmProviderInfo } from "../lib/llm";

const router = Router();

const healthHandler = (_req: any, res: any): void => {
  res.json({
    status: "ok",
    llm: {
      provider: llmProviderInfo.provider,
      model: llmProviderInfo.model,
      baseURL: llmProviderInfo.baseURL,
      requiresKey: llmProviderInfo.requiresKey,
      offline: !llmProviderInfo.requiresKey,
    },
  });
};

// /api/health  — human-readable health check
router.get("/health", healthHandler);
// /api/healthz — polled by the Electron main process (waitForHealth in main.ts)
router.get("/healthz", healthHandler);

export default router;
