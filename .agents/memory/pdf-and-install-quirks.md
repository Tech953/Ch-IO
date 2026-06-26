---
name: PDF generation & package-install quirks
description: How to generate/verify PDFs in this repo without Chromium, and an install fallback when the package-management tool fails generically.
---

# Generating PDFs without Chromium
There is no Chromium/wkhtmltopdf/weasyprint in this environment. Use **pdfkit**
(pure JS, ships the 14 standard PDF fonts — no external font files needed) to
build documents programmatically. WinAnsi encoding only, so stick to ASCII plus
em dash and bullet; fancy Unicode glyphs (arrows, diamonds) render blank.

**Verify output visually:** poppler and imagemagick *are* installed —
`pdftoppm -png -f N -l N -r 100 file.pdf out` renders a page to PNG you can read,
and `pdfinfo` reports page count. Always render the cover + a content page before
delivering.

# Package install fallback
**Why:** Installing `@react-pdf/renderer` and `pdfkit` via the
`installLanguagePackages` wrapper both returned a generic "Package installation
failed" with no detail. The workspace enforces `minimumReleaseAge: 1440` and
`autoInstallPeers: false` in `pnpm-workspace.yaml`, which the wrapper interacts
with poorly.

**How to apply:** When the install wrapper fails generically, run the real pnpm
command to see the actual error and target a specific workspace package, e.g.
`pnpm --filter @workspace/scripts add pdfkit`. That succeeded immediately for the
same package the wrapper rejected. Do NOT disable `minimumReleaseAge`.
