---
name: OpenAPI codegen param collisions
description: Why an operation with BOTH a path param and query params breaks Orval codegen in this repo, and how to avoid it.
---

# OpenAPI codegen: path-param + query-param collisions

In this repo's Orval codegen (`pnpm --filter @workspace/api-spec run codegen`), an
operation that declares **both** a path parameter and query parameters produces two
clashing `...Params` exports: the Zod generator emits `<Op>Params` for the path
parameter set, and the types generator emits `<Op>Params` for the query set. They
collide and the generated package fails to typecheck.

**Why:** the two generators independently derive the `Params` suffix from the
operation id without disambiguating path vs query.

**How to apply:** when adding an endpoint like `GET /engrams/{id}/world-model`, do
**not** add query parameters to it. Keep the path param only and do any
filtering/grouping/pagination client-side (or in the request body for write ops).
If you truly need server-side query filtering on a path-param route, give the query
a distinct shape via a request body or a separate operation id — don't mix path +
query on one operation.
