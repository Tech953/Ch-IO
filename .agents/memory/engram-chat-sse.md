---
name: ENGRAM chat SSE pattern
description: How streaming chat is implemented — raw fetch, not generated hooks.
---

SSE streaming from the Express route uses `res.setHeader("Content-Type", "text/event-stream")` + `res.write("data: ...\n\n")`. Each chunk: `data: {"content":"..."}`, final: `data: {"done":true}`.

Client uses raw `fetch` + `ReadableStream` reader — Orval-generated TanStack Query hooks cannot model SSE. Parse lines with `startsWith("data: ")`, slice 6 chars, JSON.parse. Accumulate text into a React state array via index-based update. AbortController ref lets user cancel mid-stream.

**Why:** Orval only generates request/response hooks; SSE is a long-lived connection pattern outside that model.
