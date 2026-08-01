import { Router } from "express";
import { llmProviderInfo } from "../lib/llm";

const router = Router();

router.get("/health", (_req, res) => {
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
});

export default router;
