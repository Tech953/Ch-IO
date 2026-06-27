---
name: pdfkit footer / below-margin text pagination
description: Why drawing pdfkit text below the bottom margin with `width` set appends trailing blank pages, and how to avoid it.
---

# pdfkit auto-adds a page for text drawn below the bottom margin when `width` is set

Drawing text in pdfkit at a y position below `page.maxY()` (height − bottom
margin) — e.g. a footer/page-number stamped near the very bottom of the page —
will append a spurious page **if the `text()` call passes a `width` option**.

**Why:** when `width` is set, pdfkit routes the call through `LineWrapper.wrap()`,
which begins with `if (document.y > this.maxY || nextY > this.maxY) this.nextSection()`.
`nextSection()` adds a page. This check runs *regardless of `lineBreak`*, so
`{ lineBreak: false }` does NOT prevent it (a tempting but wrong first fix).
Without `width`, the call takes the non-wrapper branch (`text.split('\n')` →
direct line callback) which never checks `maxY`, so no page is added.

When the doc also draws a header on the `pageAdded` event, each of these
auto-added pages renders header-only → looks like a trailing "blank" page. In a
multi-page doc that stamps footers in a loop (one per content page), you get one
blank page per footer drawn, all appended after the real content.

**How to apply:** for any text intentionally placed below the bottom margin
(footers, page numbers, bottom stamps), do not pass `width`/`align`. Right-align
manually instead: `doc.text(label, right - doc.widthOfString(label), y, { lineBreak: false })`.
Top-of-page headers are unaffected because their y is within the margins.
