---
name: Responsive refactor of pages with portaled dialogs
description: Why mobile/desktop variants of a page containing a shared-state Radix Dialog/Sheet must branch via a JS breakpoint hook, not CSS hidden classes.
---

When making a page responsive where the same JSX contains a portaled, shared-state
Radix `Dialog` (e.g. the chat "New Conversation" dialog in `pages/chat.tsx`), do
NOT render two copies of that subtree toggled with CSS (`hidden md:block` /
`block md:hidden`). Both copies mount, and because the Dialog portals to
`document.body`, you get two live dialogs bound to the same open-state — clicks
land on the wrong one / duplicate overlays.

**Why:** CSS visibility hides the trigger but the component still mounts and its
portal still renders. Two mounted Dialogs = two portals.

**How to apply:** Extract the shared panel into a single `const sidebar = (...)`
and choose the wrapper with the `useIsMobile()` hook (`hooks/use-mobile.tsx`,
breakpoint 768px): desktop → permanent column; mobile → a `Sheet`. Render the
Dialog exactly once. Accept that `useIsMobile()` returns `false` on first paint
(brief desktop flash on mobile), which is acceptable here.

Related layout rule: the shared layout wraps page content in `p-4 md:p-8`, so any
full-bleed child (chat) must use matching negative margins `-m-4 md:-m-8` — keep
them in lockstep with the layout padding or the bleed misaligns at one breakpoint.
