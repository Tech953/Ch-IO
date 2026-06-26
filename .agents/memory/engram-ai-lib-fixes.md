---
name: ENGRAM AI lib template fixes
description: Two fixes required to make the Replit OpenAI AI integration template libs typecheck cleanly in this workspace.
---

**Fix 1 — `lib/integrations-openai-ai-react` missing React types**

The lib declares `"peerDependencies": { "react": ">=18" }` but no devDependencies. Add `"@types/react": "catalog:"` to devDependencies. Without it, all `import { useState } from "react"` calls error with TS2307, which cascades into TS7006 implicit-any errors on unrelated lines.

**Fix 2 — `lib/integrations-openai-ai-server/src/image/client.ts` TS18048**

`response.data[0]` needs optional chaining: `response.data?.[0]?.b64_json`. The openai SDK types `data` as possibly undefined for image responses.

**Why:** These are template files copied in verbatim — they ship with latent type errors that only surface when `tsc --build` runs strict checks across the whole lib graph.

**How to apply:** Any time the OpenAI AI integration template libs are copied in, apply both fixes before running `typecheck:libs`.
